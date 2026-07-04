"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AuthCard } from "@/components/AuthCard";
import { GROUP_PRESETS, GroupDraft, GroupsEditor } from "@/components/GroupsEditor";
import { TwynLogo } from "@/components/Logo";
import { api, clearSession, loadSession } from "@/lib/client";

type Mode = "dating" | "mixer" | "networking" | "custom";

const VIBES: { key: Mode; label: string }[] = [
  { key: "dating", label: "Dating" },
  { key: "mixer", label: "Social mixer" },
  { key: "networking", label: "Networking" },
  { key: "custom", label: "Your own" },
];

const ROUND_CHOICES = [3, 5, 10, 15, 20];

export default function CreateEvent() {
  const router = useRouter();
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [me, setMe] = useState<{ name: string; events: any[] } | null>(null);

  const loadMe = useCallback(async () => {
    const session = loadSession();
    if (!session) {
      setAuthed(false);
      return;
    }
    try {
      const res = await api(`/api/auth/me?session=${encodeURIComponent(session)}`);
      setMe(res);
      setAuthed(true);
    } catch {
      clearSession();
      setAuthed(false);
    }
  }, []);

  useEffect(() => {
    loadMe();
  }, [loadMe]);

  return (
    <main className="mx-auto max-w-md px-6 py-8 pb-20">
      <div className="flex items-center justify-between">
        <Link href="/">
          <TwynLogo size={28} />
        </Link>
        {authed && me && (
          <button
            className="text-xs font-medium text-white/35 transition hover:text-white/70"
            onClick={() => {
              clearSession();
              setAuthed(false);
              setMe(null);
            }}
          >
            {me.name} · sign out
          </button>
        )}
      </div>

      <h1 className="mt-8 font-display text-4xl font-medium">Host an event</h1>

      {authed === null && <p className="mt-8 text-white/35">One moment…</p>}
      {authed === false && <AuthCard onAuthed={() => loadMe()} />}
      {authed && me && (
        <>
          {me.events.length > 0 && (
            <div className="card mt-6">
              <p className="label">Your events</p>
              <div className="mt-3 space-y-1">
                {me.events.map((e: any) => (
                  <Link
                    key={e.code}
                    href={`/host/${e.code}`}
                    className="flex items-center justify-between rounded-lg px-3 py-2.5 transition hover:bg-white/[0.05]"
                  >
                    <span className="text-sm font-medium">{e.title}</span>
                    <span className="text-xs text-white/35">
                      {e.code} · {e.status}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}
          <CreateForm onCreated={(code) => router.push(`/host/${code}`)} />
        </>
      )}
    </main>
  );
}

function CreateForm({ onCreated }: { onCreated: (code: string) => void }) {
  const [title, setTitle] = useState("");
  const [mode, setMode] = useState<Mode>("mixer");
  const [vibeLabel, setVibeLabel] = useState("");
  const [preset, setPreset] = useState("everyone");
  const [groups, setGroups] = useState<GroupDraft[]>(
    GROUP_PRESETS[0].groups.map((g) => ({ ...g }))
  );
  const [cross, setCross] = useState(false);
  const [roundMinutes, setRoundMinutes] = useState(10);
  const [customRound, setCustomRound] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const pickVibe = (m: Mode) => {
    setMode(m);
    if (m === "dating") {
      applyPreset("gender");
      setCross(true);
    }
  };

  const applyPreset = (key: string) => {
    const p = GROUP_PRESETS.find((p) => p.key === key)!;
    setPreset(key);
    setGroups(p.groups.map((g) => ({ ...g })));
    setCross(false);
  };

  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await api<{ code: string }>("/api/events", {
        session: loadSession(),
        title,
        mode,
        vibeLabel,
        categories: groups,
        crossCategory: cross && groups.length === 2,
        roundMinutes,
      });
      onCreated(res.code);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setBusy(false);
    }
  };

  return (
    <>
      <div className="card mt-6 space-y-6">
        <div>
          <label className="label">Event name</label>
          <input
            className="input mt-1.5"
            placeholder="An Evening at Luna"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={60}
          />
        </div>

        <div>
          <label className="label">Vibe</label>
          <div className="mt-2 flex flex-wrap gap-2">
            {VIBES.map((v) => (
              <button
                key={v.key}
                type="button"
                className={`chip ${mode === v.key ? "chip-on" : ""}`}
                onClick={() => pickVibe(v.key)}
              >
                {v.label}
              </button>
            ))}
          </div>
          {mode === "custom" && (
            <input
              className="input mt-3"
              placeholder="Name your vibe — Wine & Strangers, Founders' Table…"
              value={vibeLabel}
              maxLength={30}
              onChange={(e) => setVibeLabel(e.target.value)}
            />
          )}
        </div>

        <div>
          <label className="label">How should people be grouped?</label>
          <div className="mt-2 flex flex-wrap gap-2">
            {GROUP_PRESETS.map((p) => (
              <button
                key={p.key}
                type="button"
                className={`chip ${preset === p.key ? "chip-on" : ""}`}
                onClick={() => applyPreset(p.key)}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="mt-3">
            <GroupsEditor groups={groups} onChange={setGroups} />
          </div>
        </div>

        {groups.length === 2 && (
          <button
            type="button"
            className={`chip w-full ${cross ? "chip-on" : ""}`}
            onClick={() => setCross(!cross)}
          >
            {cross ? "✓ " : ""}Only match across the two groups
          </button>
        )}

        <div>
          <label className="label">Round length</label>
          <div className="mt-2 flex flex-wrap gap-2">
            {ROUND_CHOICES.map((m) => (
              <button
                key={m}
                type="button"
                className={`chip ${!customRound && roundMinutes === m ? "chip-on" : ""}`}
                onClick={() => {
                  setCustomRound(false);
                  setRoundMinutes(m);
                }}
              >
                {m} min
              </button>
            ))}
            <button
              type="button"
              className={`chip ${customRound ? "chip-on" : ""}`}
              onClick={() => setCustomRound(true)}
            >
              Custom
            </button>
          </div>
          {customRound && (
            <div className="mt-3 flex items-center gap-3">
              <input
                className="input w-28 text-center"
                type="number"
                min={1}
                max={120}
                value={roundMinutes}
                onChange={(e) =>
                  setRoundMinutes(
                    Math.min(120, Math.max(1, Number(e.target.value) || 1))
                  )
                }
              />
              <span className="text-sm text-white/40">minutes per round (1–120)</span>
            </div>
          )}
          <p className="mt-1.5 text-xs text-white/30">
            You can adjust this any time, even between rounds.
          </p>
        </div>
      </div>

      {error && <p className="mt-3 text-sm text-red-300/90">{error}</p>}

      <button
        className="btn-primary mt-5 w-full"
        disabled={
          busy ||
          !title.trim() ||
          groups.some((g) => !g.name.trim()) ||
          (mode === "custom" && !vibeLabel.trim())
        }
        onClick={submit}
      >
        {busy ? "Creating…" : "Create event"}
      </button>
    </>
  );
}
