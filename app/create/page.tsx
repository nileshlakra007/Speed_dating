"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { TwynLogo } from "@/components/Logo";
import { api, saveHostToken } from "@/lib/client";

type Mode = "dating" | "mixer" | "networking";

const MODE_PRESETS: Record<
  Mode,
  { label: string; emoji: string; categories: { name: string; cap: number }[]; cross: boolean }
> = {
  dating: {
    label: "Dating",
    emoji: "💘",
    categories: [
      { name: "Men", cap: 20 },
      { name: "Women", cap: 20 },
    ],
    cross: true,
  },
  mixer: {
    label: "Social mixer",
    emoji: "🪩",
    categories: [{ name: "Everyone", cap: 40 }],
    cross: false,
  },
  networking: {
    label: "Networking",
    emoji: "💼",
    categories: [{ name: "Everyone", cap: 40 }],
    cross: false,
  },
};

export default function CreateEvent() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [mode, setMode] = useState<Mode>("mixer");
  const [categories, setCategories] = useState(MODE_PRESETS.mixer.categories);
  const [cross, setCross] = useState(false);
  const [roundMinutes, setRoundMinutes] = useState(10);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const pickMode = (m: Mode) => {
    setMode(m);
    setCategories(MODE_PRESETS[m].categories.map((c) => ({ ...c })));
    setCross(MODE_PRESETS[m].cross);
  };

  const setCat = (i: number, patch: Partial<{ name: string; cap: number }>) =>
    setCategories((cs) => cs.map((c, j) => (j === i ? { ...c, ...patch } : c)));

  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await api<{ code: string; hostToken: string }>("/api/events", {
        title,
        mode,
        categories,
        crossCategory: cross && categories.length === 2,
        roundMinutes,
      });
      saveHostToken(res.code, res.hostToken);
      router.push(`/host/${res.code}`);
    } catch (e: any) {
      setError(e.message);
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto max-w-md px-6 py-8">
      <TwynLogo size={30} />
      <h1 className="mt-6 text-3xl font-extrabold">Host an event 🪩</h1>

      <div className="card mt-6 space-y-5">
        <div>
          <label className="text-sm font-semibold text-white/60">Event name</label>
          <input
            className="input mt-1.5"
            placeholder="Rooftop mixer @ Luna Bar"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={60}
          />
        </div>

        <div>
          <label className="text-sm font-semibold text-white/60">Vibe</label>
          <div className="mt-2 flex flex-wrap gap-2">
            {(Object.keys(MODE_PRESETS) as Mode[]).map((m) => (
              <button
                key={m}
                className={`chip ${mode === m ? "chip-on" : ""}`}
                onClick={() => pickMode(m)}
              >
                {MODE_PRESETS[m].emoji} {MODE_PRESETS[m].label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <label className="text-sm font-semibold text-white/60">
              Groups &amp; slots
            </label>
            {categories.length < 4 && (
              <button
                className="text-sm font-bold text-fuchsia-300"
                onClick={() =>
                  setCategories((cs) => [...cs, { name: "", cap: 20 }])
                }
              >
                + add group
              </button>
            )}
          </div>
          <div className="mt-2 space-y-2">
            {categories.map((c, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  className="input flex-1"
                  placeholder="Group name"
                  value={c.name}
                  onChange={(e) => setCat(i, { name: e.target.value })}
                  maxLength={20}
                />
                <input
                  className="input w-24 text-center"
                  type="number"
                  min={1}
                  max={500}
                  value={c.cap}
                  onChange={(e) => setCat(i, { cap: Number(e.target.value) })}
                />
                {categories.length > 1 && (
                  <button
                    className="px-1 text-white/40 hover:text-rose-400"
                    onClick={() =>
                      setCategories((cs) => cs.filter((_, j) => j !== i))
                    }
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-white/35">
            When a group is full, new joiners go to that group&apos;s waitlist.
          </p>
        </div>

        {categories.length === 2 && (
          <button
            className={`chip w-full ${cross ? "chip-on" : ""}`}
            onClick={() => setCross(!cross)}
          >
            {cross ? "✓ " : ""}Only match across the two groups
          </button>
        )}

        <div>
          <label className="text-sm font-semibold text-white/60">
            Round length
          </label>
          <div className="mt-2 flex gap-2">
            {[3, 5, 10, 15, 20].map((m) => (
              <button
                key={m}
                className={`chip ${roundMinutes === m ? "chip-on" : ""}`}
                onClick={() => setRoundMinutes(m)}
              >
                {m}m
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-white/35">
            Tip: use 3 minutes when testing with friends.
          </p>
        </div>
      </div>

      {error && <p className="mt-3 text-sm text-rose-400">{error}</p>}

      <button
        className="btn-primary mt-5 w-full text-lg"
        disabled={busy || !title.trim() || categories.some((c) => !c.name.trim())}
        onClick={submit}
      >
        {busy ? "Creating…" : "Create event ✨"}
      </button>
    </main>
  );
}
