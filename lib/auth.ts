import { id } from "./api";
import { getAccountById, getSession, saveAccount, setSession } from "./store";
import { ApiError, HostAccount } from "./types";

const ITERATIONS = 100_000;

const b64 = (buf: ArrayBuffer | Uint8Array) =>
  Buffer.from(buf instanceof Uint8Array ? buf : new Uint8Array(buf)).toString(
    "base64"
  );

async function pbkdf2(password: string, salt: Uint8Array): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations: ITERATIONS },
    key,
    256
  );
  return b64(bits);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `${b64(salt)}.${await pbkdf2(password, salt)}`;
}

export async function verifyPassword(
  password: string,
  stored: string
): Promise<boolean> {
  const [saltB64, hash] = stored.split(".");
  if (!saltB64 || !hash) return false;
  const salt = new Uint8Array(Buffer.from(saltB64, "base64"));
  const candidate = await pbkdf2(password, salt);
  // constant-time compare
  if (candidate.length !== hash.length) return false;
  let diff = 0;
  for (let i = 0; i < hash.length; i++)
    diff |= candidate.charCodeAt(i) ^ hash.charCodeAt(i);
  return diff === 0;
}

export async function createSession(hostId: string): Promise<string> {
  const token = id(32);
  await setSession(token, hostId);
  return token;
}

/** Resolve a session token to its host account or throw 401. */
export async function requireHost(
  session: string | null | undefined
): Promise<HostAccount> {
  if (!session) throw new ApiError("Sign in to continue", 401);
  const hostId = await getSession(session);
  if (!hostId) throw new ApiError("Session expired — sign in again", 401);
  const account = await getAccountById(hostId);
  if (!account) throw new ApiError("Account not found", 401);
  return account;
}

export async function recordEventOwnership(host: HostAccount, code: string) {
  if (!host.events.includes(code)) {
    host.events.push(code);
    await saveAccount(host);
  }
}
