"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Countdown } from "@/components/Countdown";
import { TwynLogo } from "@/components/Logo";
import { api, loadHostToken } from "@/lib/client";

export default function HostDashboard() {
  const { code } = useParams<{ code: string }>();
  const [view, setView] = useState<any>(null);
  const [error, setError] = useState("");
  const [actionErr, setActionErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const tokenRef = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    if (!tokenRef.current) return;
    try {
      const res = await api(
        `/api/events/${code}?hostToken=${encodeURIComponent(tokenRef.current)}`
      );
      setView(res.view);
      setError("");
    } catch (e: any) {
      setError(e.message);
    }
  }, [code]);

  useEffect(() => {
    tokenRef.current = loadHostToken(code);
    if (!tokenRef.current) {
      setError("No host access for this event on this device.");
      return;
    }
    refresh();
    const t = setInterval(refresh, 2500);
    return () => clearInterval(t);
  }, [code, refresh]);

  const act = async (action: string, extra: Record<string, unknown> = {}) => {
    setBusy(true);
    setActionErr("");
    try {
      const res = await api(`/api/events/${code}/host`, {
        hostToken: tokenRef.current,
        action,
        ...extra,
      });
      setView(res.view);
    } catch (e: any) {
      setActionErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(`${location.origin}/e/${code}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (error)
    return (
      <main className="mx-auto max-w-md px-6 py-10">
        <TwynLogo size={30} />
        <p className="card mt-6 text-rose-300">{error}</p>
      </main>
    );
  if (!view)
    return (
      <main className="grid min-h-dvh place-items-center text-white/40">
        loading…
      </main>
    );

  const roundActive = view.round?.active;

  return (
    <main className="mx-auto max-w-md px-6 py-8 pb-24">
      <div className="flex items-center justify-between">
        <TwynLogo size={26} />
        <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white/60">
          host · {view.status}
        </span>
      </div>

      <h1 className="mt-5 text-2xl font-extrabold">{view.title}</h1>

      {/* Invite + door code */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <button className="card text-left transition hover:bg-white/10" onClick={copyLink}>
          <div className="text-xs font-semibold text-white/50">
            Invite link {copied ? "· copied! ✓" : "· tap to copy"}
          </div>
          <div className="mt-1 text-2xl font-extrabold tracking-[0.2em] text-fuchsia-300">
            {view.code}
          </div>
        </button>
        <div className="card">
          <div className="text-xs font-semibold text-white/50">
            Door code (for check-in)
          </div>
          <div className="mt-1 text-2xl font-extrabold tracking-[0.2em] text-sky-300">
            {view.doorCode}
          </div>
        </div>
      </div>

      {/* Category counts */}
      <div className="card mt-3">
        <div className="text-sm font-bold text-white/70">Slots</div>
        <div className="mt-2 space-y-2">
          {view.categories.map((c: any) => (
            <div key={c.id}>
              <div className="flex justify-between text-sm">
                <span className="font-semibold">{c.name}</span>
                <span className="text-white/50">
                  {c.registered}/{c.cap} in · {c.checkedIn} checked in
                  {c.waitlisted > 0 && ` · ${c.waitlisted} waiting`}
                </span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500"
                  style={{ width: `${Math.min(100, (c.registered / c.cap) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Round control */}
      <div className="card mt-3">
        <div className="flex items-center justify-between">
          <div className="text-sm font-bold text-white/70">
            {roundActive
              ? `Round ${view.round.n} live`
              : view.roundCount > 0
                ? `Round ${view.roundCount} done`
                : "No rounds yet"}
          </div>
          {roundActive && (
            <Countdown
              endsAt={view.round.endsAt}
              serverNow={view.serverNow}
              className="text-xl font-extrabold text-fuchsia-300"
            />
          )}
        </div>

        {view.status !== "ended" && (
          <div className="mt-3 flex gap-2">
            {!roundActive ? (
              <button
                className="btn-primary flex-1"
                disabled={busy}
                onClick={() => act("startRound")}
              >
                ▶ Start round {view.roundCount + 1} ({view.roundMinutes}m)
              </button>
            ) : (
              <button
                className="btn-ghost flex-1"
                disabled={busy}
                onClick={() => act("endRound")}
              >
                ⏹ End round early
              </button>
            )}
            <button
              className="btn-danger"
              disabled={busy}
              onClick={() => {
                if (confirm("End the event for everyone?")) act("endEvent");
              }}
            >
              End event
            </button>
          </div>
        )}
        {actionErr && <p className="mt-2 text-sm text-rose-400">{actionErr}</p>}

        {roundActive && (
          <div className="mt-4 space-y-2">
            {view.round.pairs.map((p: any, i: number) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2 text-sm"
              >
                <span>
                  {p.a?.emoji} {p.a?.name} + {p.b?.emoji} {p.b?.name}
                </span>
                <span
                  className="rounded-full px-2.5 py-0.5 font-bold text-black"
                  style={{ background: p.identifier.color }}
                >
                  {p.identifier.icon} {p.identifier.code}
                </span>
              </div>
            ))}
            {view.round.standbyCount > 0 && (
              <p className="text-xs text-white/40">
                {view.round.standbyCount} on standby (priority next round)
              </p>
            )}
          </div>
        )}
      </div>

      {/* Attendees */}
      <div className="card mt-3">
        <div className="text-sm font-bold text-white/70">
          People ({view.attendees.length})
        </div>
        <div className="mt-2 space-y-1.5">
          {view.attendees.length === 0 && (
            <p className="text-sm text-white/40">
              Nobody yet — share the invite link 👆
            </p>
          )}
          {view.attendees.map((a: any) => (
            <div
              key={a.id}
              className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2"
            >
              <span className="text-lg">{a.emoji}</span>
              <span className="flex-1 truncate text-sm font-semibold">
                {a.name}
                <span className="ml-2 text-xs font-normal text-white/40">
                  {view.categories.find((c: any) => c.id === a.category)?.name}
                </span>
              </span>
              {a.waitlisted ? (
                <button
                  className="rounded-full bg-amber-500/20 px-3 py-1 text-xs font-bold text-amber-300"
                  disabled={busy}
                  onClick={() => act("promote", { userId: a.id })}
                >
                  waitlist → let in
                </button>
              ) : a.checkedIn ? (
                <button
                  className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-bold text-emerald-300"
                  disabled={busy}
                  onClick={() => act("uncheck", { userId: a.id })}
                >
                  ✓ in
                </button>
              ) : (
                <button
                  className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-white/60"
                  disabled={busy}
                  onClick={() => act("checkin", { userId: a.id })}
                >
                  check in
                </button>
              )}
              <button
                className="px-1 text-white/30 hover:text-rose-400"
                disabled={busy}
                onClick={() => {
                  if (confirm(`Remove ${a.name}?`)) act("remove", { userId: a.id });
                }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
