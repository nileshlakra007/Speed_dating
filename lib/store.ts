import { neon } from "@neondatabase/serverless";
import { Redis } from "@upstash/redis";
import { ApiError, EventData } from "./types";

/**
 * Repository pattern: all persistence goes through EventStore, so the
 * backing engine (in-memory dev store, Upstash Redis, or Neon Postgres)
 * can be swapped without touching routes or domain logic. `mutate` must
 * apply `fn` atomically with respect to concurrent mutations of the
 * same event.
 */
export interface EventStore {
  get(code: string): Promise<EventData | null>;
  create(data: EventData): Promise<void>;
  mutate(code: string, fn: (event: EventData) => void): Promise<EventData>;
}

type Versioned = { v: number; data: EventData };

// Data retention: events are kept ~6 months from last activity, then
// deleted automatically (Redis: native TTL; Neon: sweep in NeonEventStore).
const TTL_SECONDS = 60 * 60 * 24 * 183;
const key = (code: string) => `twyn:event:${code.toUpperCase()}`;

/** Dev/single-process store. Not suitable for serverless deploys. */
class MemoryEventStore implements EventStore {
  private map: Map<string, Versioned>;

  constructor() {
    const g = globalThis as unknown as { __twynStore?: Map<string, Versioned> };
    if (!g.__twynStore) g.__twynStore = new Map();
    this.map = g.__twynStore;
  }

  async get(code: string) {
    return this.map.get(key(code))?.data ?? null;
  }

  async create(data: EventData) {
    if (this.map.has(key(data.code)))
      throw new ApiError("Event code collision, try again", 409);
    this.map.set(key(data.code), { v: 1, data });
  }

  async mutate(code: string, fn: (event: EventData) => void) {
    const cur = this.map.get(key(code));
    if (!cur) throw new ApiError("Event not found", 404);
    const data: EventData = JSON.parse(JSON.stringify(cur.data));
    fn(data);
    this.map.set(key(code), { v: cur.v + 1, data });
    return data;
  }
}

/**
 * Upstash Redis store with optimistic concurrency (version + Lua
 * compare-and-swap), so concurrent joins/check-ins never clobber each other.
 */
class RedisEventStore implements EventStore {
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
    const raw = await this.redis.get<Versioned>(key(code));
    return raw?.data ?? null;
  }

  async create(data: EventData) {
    const existing = await this.redis.get(key(data.code));
    if (existing) throw new ApiError("Event code collision, try again", 409);
    await this.redis.set(key(data.code), { v: 1, data } satisfies Versioned, {
      ex: TTL_SECONDS,
    });
  }

  async mutate(code: string, fn: (event: EventData) => void) {
    for (let attempt = 0; attempt < 6; attempt++) {
      const cur = await this.redis.get<Versioned>(key(code));
      if (!cur) throw new ApiError("Event not found", 404);
      const data: EventData = JSON.parse(JSON.stringify(cur.data));
      fn(data);
      const ok = await this.redis.eval(
        RedisEventStore.CAS_LUA,
        [key(code)],
        [String(cur.v), JSON.stringify({ v: cur.v + 1, data }), String(TTL_SECONDS)]
      );
      if (ok === 1) return data;
      await new Promise((r) => setTimeout(r, 30 + Math.random() * 70));
    }
    throw new ApiError("Too much contention, please retry", 503);
  }
}

/**
 * Neon serverless Postgres store. One JSONB row per event with a version
 * column; optimistic concurrency via `UPDATE … WHERE v = <read version>`,
 * so concurrent joins/check-ins never clobber each other.
 */
class NeonEventStore implements EventStore {
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
        await this.sweep();
      })();
    }
    return this.ready;
  }

  /** Retention: drop events not touched in 6 months. Runs on every cold
   * start and on event creation, so no external cron is needed. */
  private sweep() {
    return this.sql`
      DELETE FROM twyn_events WHERE updated_at < now() - interval '6 months'`;
  }

  private static code(code: string) {
    return code.toUpperCase();
  }

  async get(code: string) {
    await this.init();
    const rows = (await this.sql`
      SELECT data FROM twyn_events WHERE code = ${NeonEventStore.code(code)}`) as {
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
        VALUES (${NeonEventStore.code(data.code)}, 1, ${JSON.stringify(data)}::jsonb)`;
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
        SELECT v, data FROM twyn_events WHERE code = ${NeonEventStore.code(code)}`) as {
        v: number;
        data: EventData;
      }[];
      if (!rows.length) throw new ApiError("Event not found", 404);
      const data: EventData = JSON.parse(JSON.stringify(rows[0].data));
      fn(data);
      const updated = (await this.sql`
        UPDATE twyn_events
        SET v = v + 1, data = ${JSON.stringify(data)}::jsonb, updated_at = now()
        WHERE code = ${NeonEventStore.code(code)} AND v = ${rows[0].v}
        RETURNING v`) as { v: number }[];
      if (updated.length) return data;
      await new Promise((r) => setTimeout(r, 30 + Math.random() * 70));
    }
    throw new ApiError("Too much contention, please retry", 503);
  }
}

function buildStore(): EventStore {
  const pg =
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.NEON_DATABASE_URL;
  if (pg) return new NeonEventStore(pg);

  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (url && token) return new RedisEventStore(new Redis({ url, token }));
  return new MemoryEventStore();
}

const store: EventStore = buildStore();

export const getEvent = (code: string) => store.get(code);
export const createEvent = (data: EventData) => store.create(data);
export const mutateEvent = (code: string, fn: (event: EventData) => void) =>
  store.mutate(code, fn);
