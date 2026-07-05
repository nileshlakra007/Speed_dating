"use client";

import { useState } from "react";
import { GoogleSignIn } from "@/components/GoogleSignIn";
import { api, saveSession } from "@/lib/client";

export function AuthCard({ onAuthed }: { onAuthed: (name: string) => void }) {
  const [tab, setTab] = useState<"login" | "signup">("signup");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const submit = async () => {
    setBusy(true);
    setErr("");
    try {
      const res = await api<{ session: string; name: string }>(
        `/api/auth/${tab}`,
        tab === "signup" ? { name, email, password } : { email, password }
      );
      saveSession(res.session, res.name);
      onAuthed(res.name);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Something went wrong");
      setBusy(false);
    }
  };

  return (
    <div className="card mt-8">
      <div className="flex gap-6">
        {(["signup", "login"] as const).map((t) => (
          <button
            key={t}
            className={`pb-2 text-sm font-semibold tracking-wide transition ${
              tab === t
                ? "border-b border-brand text-ivory"
                : "text-white/40 hover:text-white/70"
            }`}
            onClick={() => {
              setTab(t);
              setErr("");
            }}
          >
            {t === "signup" ? "Create account" : "Sign in"}
          </button>
        ))}
      </div>

      <p className="mt-4 text-sm text-white/45">
        {tab === "signup"
          ? "Hosting is by account — your guests join with just a name."
          : "Welcome back."}
      </p>

      <div className="mt-5">
        <GoogleSignIn onAuthed={onAuthed} />
      </div>
      <div className="my-5 flex items-center gap-4 text-xs uppercase tracking-widest text-white/20">
        <div className="hairline flex-1" />
        or with email
        <div className="hairline flex-1" />
      </div>

      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        {tab === "signup" && (
          <div>
            <label className="label">Name</label>
            <input
              className="input mt-1.5"
              value={name}
              maxLength={50}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
        )}
        <div>
          <label className="label">Email</label>
          <input
            className="input mt-1.5"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <label className="label">Password</label>
          <input
            className="input mt-1.5"
            type="password"
            autoComplete={tab === "signup" ? "new-password" : "current-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {tab === "signup" && (
            <p className="mt-1 text-xs text-white/30">At least 8 characters.</p>
          )}
        </div>
        {err && <p className="text-sm text-red-300/90">{err}</p>}
        <button
          className="btn-primary w-full"
          disabled={
            busy ||
            !email.trim() ||
            password.length < (tab === "signup" ? 8 : 1) ||
            (tab === "signup" && !name.trim())
          }
        >
          {busy ? "One moment…" : tab === "signup" ? "Create account" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
