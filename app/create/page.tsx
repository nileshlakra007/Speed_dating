"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AuthCard } from "@/components/AuthCard";
import {
  GroupDraft,
  GroupsEditor,
  LABEL_QUICKFILLS,
  RANGE_QUICKFILLS,
} from "@/components/GroupsEditor";
import { TwynLogo } from "@/components/Logo";
import { api, clearSession, loadSession } from "@/lib/client";

type Mode = "dating" | "mixer" | "networking" | "custom";
type GroupingChoice = "single" | "label" | "range";

const VIBES: { key: Mode; label: string }[] = [
  { key: "dating", label: "Dating" },
  { key: "mixer", label: "Social mixer" },
  { key: "networking", label: "Networking" },
  { key: "custom", label: "Your own" },
];

const GROUPING_CHOICES: { key: GroupingChoice; label: string; hint: string }[] = [
  { key: "single", label: "One group", hint: "Everyone joins the same pool." },
  {
    key: "label",
    label: "Named groups",
    hint: "You define the groups — gender, roles, teams, anything. Guests pick theirs.",
  },
  {
    key: "range",
    label: "Number ranges",
    hint: "You define ranges (age, experience…). Guests enter their number and are placed automatically.",
  },
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

      <h1 className="mt-8 font-display text-4xl font-medium">
        Host an <span className="grad-text">event</span>
      </h1>

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
  const [grouping, setGrouping] = useState<GroupingChoice>("single");
  const [attribute, setAttribute] = useState("Age");
  const [singleCap, setSingleCap] = useState(40);
  const [groups, setGroups] = useState<GroupDraft[]>([
    { name: "", cap: 20 },
    { name: "", cap: 20 },
  ]);
  const [cross, setCross] = useState(false);
  const [roundMinutes, setRoundMinutes] = useState(10);
  const [customRound, setCustomRound] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const pickGrouping = (g: GroupingChoice) => {
    setGrouping(g);
    setCross(false);
    if (g === "label") setGroups([{ name: "", cap: 20 }, { name: "", cap: 20 }]);
    if (g === "range")
      setGroups([
        { name: "", cap: 20, min: "", max: "" },
        { name: "", cap: 20, min: "", max: "" },
      ]);
  };

  const pickVibe = (m: Mode) => {
    setMode(m);
    if (m === "dating") {
      setGrouping("label");
      setGroups(LABEL_QUICKFILLS[0].groups.map((g) => ({ ...g })));
      setCross(true);
    }
  };

  const groupsValid =
    grouping === "single" ||
    (grouping === "label"
      ? groups.every((g) => g.name.trim())
      : groups.every((g) => g.min !== "" && g.max !== ""));

  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await api<{ code: string }>("/api/events", {
        session: loadSession(),
        title,
        mode,
        vibeLabel,
        groupingType: grouping === "range" ? "range" : "label",
        attribute,
        categories:
          grouping === "single" ? [{ name: "Everyone", cap: singleCap }] : groups,
        crossCategory: cross && groups.length === 2 && grouping !== "single",
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
          <label className="label">How should guests be grouped?</label>
          <div className="mt-2 flex flex-wrap gap-2">
            {GROUPING_CHOICES.map((g) => (
              <button
                key={g.key}
                type="button"
                className={`chip ${grouping === g.key ? "chip-on" : ""}`}
                onClick={() => pickGrouping(g.key)}
              >
                {g.label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-white/35">
            {GROUPING_CHOICES.find((g) => g.key === grouping)?.hint}
          </p>

          {grouping === "single" && (
            <div className="mt-3 flex items-center gap-3">
              <input
                className="input w-24 text-center"
                type="number"
                min={2}
                max={500}
                value={singleCap}
                onChange={(e) => setSingleCap(Number(e.target.value))}
              />
              <span className="text-sm text-white/40">total spots</span>
            </div>
          )}

          {grouping === "label" && (
            <>
              <div className="mt-3 flex flex-wrap gap-2">
                {LABEL_QUICKFILLS.map((q) => (
                  <button
                    key={q.label}
                    type="button"
                    className="rounded-full border border-dashed border-white/20 px-3 py-1 text-xs text-white/50 transition hover:border-brand/50 hover:text-white"
                    onClick={() => setGroups(q.groups.map((g) => ({ ...g })))}
                  >
                    {q.label}
                  </button>
                ))}
              </div>
              <div className="mt-3">
                <GroupsEditor groups={groups} onChange={setGroups} mode="label" />
              </div>
            </>
          )}

          {grouping === "range" && (
            <>
              <div className="mt-3">
                <label className="label">Range of what?</label>
                <input
                  className="input mt-1.5"
                  placeholder="Age, years of experience…"
                  value={attribute}
                  maxLength={20}
                  onChange={(e) => setAttribute(e.target.value)}
                />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {RANGE_QUICKFILLS.map((q) => (
                  <button
                    key={q.label}
                    type="button"
                    className="rounded-full border border-dashed border-white/20 px-3 py-1 text-xs text-white/50 transition hover:border-brand/50 hover:text-white"
                    onClick={() => {
                      setAttribute(q.attribute);
                      setGroups(q.groups.map((g) => ({ ...g })));
                    }}
                  >
                    {q.label}
                  </button>
                ))}
              </div>
              <div className="mt-3">
                <GroupsEditor groups={groups} onChange={setGroups} mode="range" />
              </div>
            </>
          )}

          {grouping !== "single" && (
            <p className="mt-2 text-xs text-white/30">
              When a group is full, new joiners are waitlisted.
            </p>
          )}
        </div>

        {grouping !== "single" && groups.length === 2 && (
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
          !groupsValid ||
          (mode === "custom" && !vibeLabel.trim()) ||
          (grouping === "range" && !attribute.trim())
        }
        onClick={submit}
      >
        {busy ? "Creating…" : "Create event"}
      </button>
    </>
  );
}
