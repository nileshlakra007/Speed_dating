"use client";

export async function api<T = any>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
  return json as T;
}

export interface Identity {
  userId: string;
  token: string;
}

export const identityKey = (code: string) => `twyn:me:${code.toUpperCase()}`;
export const hostKey = (code: string) => `twyn:host:${code.toUpperCase()}`;

export function loadIdentity(code: string): Identity | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(identityKey(code));
    return raw ? (JSON.parse(raw) as Identity) : null;
  } catch {
    return null;
  }
}

export function saveIdentity(code: string, id: Identity) {
  localStorage.setItem(identityKey(code), JSON.stringify(id));
}

export function loadHostToken(code: string): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(hostKey(code));
}

export function saveHostToken(code: string, token: string) {
  localStorage.setItem(hostKey(code), token);
}
