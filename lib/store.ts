import { neon } from "@neondatabase/serverless";
import { Redis } from "@upstash/redis";
import { ApiError, EventData, HostAccount } from "./types";

/**
 * Repository pattern: all persistence goes through Store, so the backing
 * engine (in-memory dev store, Upstash Redis, or Neon Postgres) can be
 * swapped without touching routes or domain logic. `mutate` must apply
 * `fn` atomically with respect to concurrent mutations of the same event.
 */
export interface Store {
  // events
  get(code: string): Promise<EventData | null>;
  create(data: EventData): Promise<void>;
  mutate(code: string, fn: (event: EventData) => void): Promise<EventData>;
  // host accounts
  getAccountByEmail(email: string): Promise<HostAccount | null>;
  getAccountById(id: string): Promise<HostAccount | null>;
  saveAccount(account: HostAccount): Promise<void>;
  // sessions (token -> hostId)
  getSession(token: string): Promise<string | null>;
  setSession(token: string, hostId: string): Promise<void>;
}

type Versioned = { v: number; data: EventData };

// Data retention: events/sessions are kept ~6 months from last activity,
// then deleted automatically (Redis: native TTL; Neon: periodic sweep).
const TTL_SECONDS = 60 * 60 * 24 * 183;

const eventKey = (code: string) => `twyn:event:${code.toUpperCase()}`;
const acctKey = (id: string) => `twyn:acct:${id}`;
const emailKey = (email: string) => `twyn:email:${email.toLowerCase()}`;
const sessKey = (token: string) => `twyn:sess:${token}`;

/** Dev/single-process store. Not suitable for serverless deploys. */
class MemoryStore implements Store {
  private events: Map<string, Versioned>;
  private accounts: Map<string, HostAccount>;
  private emails: Map<string, string>;
  private sessions: Map<string, string>;

  constructor() {
    const g = globalThis as unknown as {
      __twynEvents?: Map<string, Versioned>;
      __twynAccounts?: Map<string, HostAccount>;
      __twynEmails?: Map<string, string>;
      __twynSessions?: Map<string, string>;
    };
    this.events = g.__twynEvents ??= new Map();
    this.accounts = g.__twynAccounts ??= new Map();
    this.emails = g.__twynEmails ??= new Map();
    this.sessions = g.__twynSessions ??= new Map();
  }

  async get(code: string) {
    return this.events.get(eventKey(code))?.data ?? null;
  }

  async create(data: EventData) {
    if (this.events.has(eventKey(data.code)))
      throw new ApiError("Event code collision, try again", 409);
    this.events.set(eventKey(data.code), { v: 1, data });
  }

  async mutate(code: string, fn: (event: EventData) => void) {
    const cur = this.events.get(eventKey(code));
    if (!cur) throw new ApiError("Event not found", 404);
    const data: EventData = JSON.parse(JSON.stringify(cur.data));
    fn(data);
    this.events.set(eventKey(code), { v: cur.v + 1, data });
    return data;
  }

  async getAccountByEmail(email: string) {
    const id = this.emails.get(email.toLowerCase());
    return id ? (this.accounts.get(id) ?? null) : null;
  }

  async getAccountById(id: string) {
    return this.accounts.get(id) ?? null;
  }

  async saveAccount(account: HostAccount) {
    this.accounts.set(account.id, JSON.parse(JSON.stringify(account)));
    this.emails.set(account.email.toLowerCase(), account.id);
  }

  async getSession(token: string) {
    return this.sessions.get(token) ?? null;
  }

  async setSession(token: string, hostId: string) {
    this.sessions.set(token, hostId);
  }
}

/**
 * Upstash Redis store with optimistic concurrency (version + Lua
 * compare-and-swap), so concurrent joins/check-ins never clobber each other.
 */
class RedisStore implements Store {
  constructor(private redis: Redis) {}

  private static CAS_LUA = `
local cur = redis.call('GET', KEYS[1])
if cur then
  local decoded = cjson.decode(cur)
  if decoded.v ~= tonumber(ARGV[1]) then return 0 end
end
redis.call('SET', KEYS[1], ARGV[2], 'EX', tonumber(ARGV[3]))
return 1
`;

  async get(code: string) {
    const raw = await this.redis.get<Versioned>(eventKey(code));
    return raw?.data ?? null;
  }

  async create(data: EventData) {
    const existing = await this.redis.get(eventKey(data.code));
    if (existing) throw new ApiError("Event code collision, try again", 409);
    await this.redis.set(eventKey(data.code), { v: 1, data } satisfies Versioned, {
      ex: TTL_SECONDS,
    });
  }

  async mutate(code: string, fn: (event: EventData) => void) {
    for (let attempt = 0; attempt < 6; attempt++) {
      const cur = await this.redis.get<Versioned>(eventKey(code));
      if (!cur) throw new ApiError("Event not found", 404);
      const data: EventData = JSON.parse(JSON.stringify(cur.data));
      fn(data);
      const ok = await this.redis.eval(
        RedisStore.CAS_LUA,
        [eventKey(code)],
        [String(cur.v), JSON.stringify({ v: cur.v + 1, data }), String(TTL_SECONDS)]
      );
      if (ok === 1) return data;
      await new Promise((r) => setTimeout(r, 30 + Math.random() * 70));
    }
    throw new ApiError("Too much contention, please retry", 503);
  }

  async getAccountByEmail(email: string) {
    const id = await this.redis.get<string>(emailKey(email));
    return id ? this.getAccountById(id) : null;
  }

  async getAccountById(id: string) {
    return (await this.redis.get<HostAccount>(acctKey(id))) ?? null;
  }

  async saveAccount(account: HostAccount) {
    await this.redis.set(acctKey(account.id), account);
    await this.redis.set(emailKey(account.email), account.id);
  }

  async getSession(token: string) {
    return (await this.redis.get<string>(sessKey(token))) ?? null;
  }

  async setSession(token: string, hostId: string) {
    await this.redis.set(sessKey(token), hostId, { ex: TTL_SECONDS });
  }
}

/**
 * Neon serverless Postgres store. One JSONB row per record with a version
 * column on events; optimistic concurrency via `UPDATE … WHERE v = <read
 * version>`, so concurrent joins/check-ins never clobber each other.
 */
class NeonStore implements Store {
  private sql: ReturnType<typeof neon>;
  private ready: Promise<unknown> | null = null;

  constructor(url: string) {
    this.sql = neon(url);
  }

  private init() {
    if (!this.ready) {
      this.ready = (async () => {
        await this.sql`
          CREATE TABLE IF NOT EXISTS twyn_events (
            code TEXT PRIMARY KEY,
            v INT NOT NULL,
            data JSONB NOT NULL,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
          )`;
        await this.sql`
          CREATE INDEX IF NOT EXISTS twyn_events_updated_at_idx
          ON twyn_events (updated_at)`;
        await this.sql`
          CREATE TABLE IF NOT EXISTS twyn_accounts (
            id TEXT PRIMARY KEY,
            email TEXT UNIQUE NOT NULL,
            data JSONB NOT NULL
          )`;
        await this.sql`
          CREATE TABLE IF NOT EXISTS twyn_sessions (
            token TEXT PRIMARY KEY,
            host_id TEXT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
          )`;
        await this.sweep();
      })();
    }
    return this.ready;
  }

  /** Retention: drop events/sessions not touched in 6 months. Runs on
   * every cold start and on event creation, so no external cron is needed. */
  private async sweep() {
    await this.sql`
      DELETE FROM twyn_events WHERE updated_at < now() - interval '6 months'`;
    await this.sql`
      DELETE FROM twyn_sessions WHERE created_at < now() - interval '6 months'`;
  }

  private static code(code: string) {
    return code.toUpperCase();
  }

  async get(code: string) {
    await this.init();
    const rows = (await this.sql`
      SELECT data FROM twyn_events WHERE code = ${NeonStore.code(code)}`) as {
      data: EventData;
    }[];
    return rows.length ? rows[0].data : null;
  }

  async create(data: EventData) {
    await this.init();
    await this.sweep();
    try {
      await this.sql`
        INSERT INTO twyn_events (code, v, data)
        VALUES (${NeonStore.code(data.code)}, 1, ${JSON.stringify(data)}::jsonb)`;
    } catch (e: unknown) {
      if ((e as { code?: string })?.code === "23505")
        throw new ApiError("Event code collision, try again", 409);
      throw e;
    }
  }

  async mutate(code: string, fn: (event: EventData) => void) {
    await this.init();
    for (let attempt = 0; attempt < 6; attempt++) {
      const rows = (await this.sql`
        SELECT v, data FROM twyn_events WHERE code = ${NeonStore.code(code)}`) as {
        v: number;
        data: EventData;
      }[];
      if (!rows.length) throw new ApiError("Event not found", 404);
      const data: EventData = JSON.parse(JSON.stringify(rows[0].data));
      fn(data);
      const updated = (await this.sql`
        UPDATE twyn_events
        SET v = v + 1, data = ${JSON.stringify(data)}::jsonb, updated_at = now()
        WHERE code = ${NeonStore.code(code)} AND v = ${rows[0].v}
        RETURNING v`) as { v: number }[];
      if (updated.length) return data;
      await new Promise((r) => setTimeout(r, 30 + Math.random() * 70));
    }
    throw new ApiError("Too much contention, please retry", 503);
  }

  async getAccountByEmail(email: string) {
    await this.init();
    const rows = (await this.sql`
      SELECT data FROM twyn_accounts WHERE email = ${email.toLowerCase()}`) as {
      data: HostAccount;
    }[];
    return rows.length ? rows[0].data : null;
  }

  async getAccountById(id: string) {
    await this.init();
    const rows = (await this.sql`
      SELECT data FROM twyn_accounts WHERE id = ${id}`) as {
      data: HostAccount;
    }[];
    return rows.length ? rows[0].data : null;
  }

  async saveAccount(account: HostAccount) {
    await this.init();
    await this.sql`
      INSERT INTO twyn_accounts (id, email, data)
      VALUES (${account.id}, ${account.email.toLowerCase()}, ${JSON.stringify(account)}::jsonb)
      ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, email = EXCLUDED.email`;
  }

  async getSession(token: string) {
    await this.init();
    const rows = (await this.sql`
      SELECT host_id FROM twyn_sessions WHERE token = ${token}
      AND created_at >= now() - interval '6 months'`) as { host_id: string }[];
    return rows.length ? rows[0].host_id : null;
  }

  async setSession(token: string, hostId: string) {
    await this.init();
    await this.sql`
      INSERT INTO twyn_sessions (token, host_id) VALUES (${token}, ${hostId})`;
  }
}

function buildStore(): Store {
  const pg =
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.NEON_DATABASE_URL;
  if (pg) return new NeonStore(pg);

  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (url && token) return new RedisStore(new Redis({ url, token }));
  return new MemoryStore();
}

const store: Store = buildStore();

export const getEvent = (code: string) => store.get(code);
export const createEvent = (data: EventData) => store.create(data);
export const mutateEvent = (code: string, fn: (event: EventData) => void) =>
  store.mutate(code, fn);
export const getAccountByEmail = (email: string) =>
  store.getAccountByEmail(email);
export const getAccountById = (id: string) => store.getAccountById(id);
export const saveAccount = (account: HostAccount) =>
  store.saveAccount(account);
export const getSession = (token: string) => store.getSession(token);
export const setSession = (token: string, hostId: string) =>
  store.setSession(token, hostId);
