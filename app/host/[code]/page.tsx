"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Countdown } from "@/components/Countdown";
import { GroupDraft, GroupsEditor } from "@/components/GroupsEditor";
import { TwynLogo } from "@/components/Logo";
import { Avatar } from "@/components/PhotoPicker";
import { api, loadHostToken, loadSession } from "@/lib/client";

type Cred = { session?: string; hostToken?: string };

export default function HostDashboard() {
  const { code } = useParams<{ code: string }>();
  const [view, setView] = useState<any>(null);
  const [error, setError] = useState("");
  const [actionErr, setActionErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [minutes, setMinutes] = useState<number | null>(null);
  const credRef = useRef<Cred>({});

  const refresh = useCallback(async () => {
    const { session, hostToken } = credRef.current;
    if (!session && !hostToken) return;
    const qs = session
      ? `session=${encodeURIComponent(session)}`
      : `hostToken=${encodeURIComponent(hostToken!)}`;
    try {
      const res = await api(`/api/events/${code}?${qs}`);
      if (res.role !== "host") {
        setError("This event belongs to a different host account.");
        return;
      }
      setView(res.view);
      setError("");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    }
  }, [code]);

  useEffect(() => {
    const session = loadSession();
    const hostToken = loadHostToken(code);
    if (!session && !hostToken) {
      setError("Sign in on the host page to manage this event.");
      return;
    }
    credRef.current = { session: session ?? undefined, hostToken: hostToken ?? undefined };
    refresh();
    const t = setInterval(refresh, 2500);
    return () => clearInterval(t);
  }, [code, refresh]);

  const act = async (action: string, extra: Record<string, unknown> = {}) => {
    setBusy(true);
    setActionErr("");
    try {
      const res = await api(`/api/events/${code}/host`, {
        ...credRef.current,
        action,
        ...extra,
      });
      setView(res.view);
      return true;
    } catch (e: unknown) {
      setActionErr(e instanceof Error ? e.message : "Something went wrong");
      return false;
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
        <TwynLogo size={28} />
        <p className="card mt-6 text-red-300/90">{error}</p>
        <Link className="btn-ghost mt-4 w-full" href="/create">
          Go to host sign-in
        </Link>
      </main>
    );
  if (!view)
    return (
      <main className="grid min-h-dvh place-items-center text-white/35">
        one moment…
      </main>
    );

  const roundActive = view.round?.active;
  const startMinutes = minutes ?? view.roundMinutes;

  return (
    <main className="mx-auto max-w-md px-6 py-8 pb-24">
      <div className="flex items-center justify-between">
        <Link href="/create">
          <TwynLogo size={26} />
        </Link>
        <span className="label">host · {view.status}</span>
      </div>

      <div className="mt-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-medium">{view.title}</h1>
          <p className="mt-1 text-sm text-white/40">{view.vibeLabel}</p>
        </div>
        {view.status !== "ended" && (
          <button
            className="chip shrink-0"
            onClick={() => setEditing(!editing)}
          >
            {editing ? "Close" : "Edit"}
          </button>
        )}
      </div>

      {editing && (
        <EditPanel
          view={view}
          busy={busy}
          onSave={async (patch) => {
            const ok = await act("update", patch);
            if (ok) setEditing(false);
          }}
        />
      )}
      {actionErr && <p className="mt-3 text-sm text-red-300/90">{actionErr}</p>}

      {/* Invite + door code */}
      <div className="mt-5 grid grid-cols-2 gap-3">
        <button className="card text-left transition hover:bg-white/[0.05]" onClick={copyLink}>
          <div className="label">{copied ? "Copied ✓" : "Invite · tap to copy"}</div>
          <div className="mt-1.5 text-2xl font-semibold tracking-[0.2em] text-brand-light">
            {view.code}
          </div>
        </button>
        <div className="card">
          <div className="label">Door code</div>
          <div className="mt-1.5 text-2xl font-semibold tracking-[0.2em] text-ivory">
            {view.doorCode}
          </div>
        </div>
      </div>

      {/* Group counts */}
      <div className="card mt-3">
        <div className="label">Groups</div>
        <div className="mt-3 space-y-3">
          {view.categories.map((c: any) => (
            <div key={c.id}>
              <div className="flex justify-between text-sm">
                <span className="font-medium">{c.name}</span>
                <span className="text-white/40">
                  {c.registered}/{c.cap} · {c.checkedIn} in
                  {c.waitlisted > 0 && ` · ${c.waitlisted} waiting`}
                </span>
              </div>
              <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/[0.07]">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.min(100, (c.registered / c.cap) * 100)}%`,
                    background: "linear-gradient(90deg, #8b5cf6, #ec4899)",
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Round control */}
      <div className="card mt-3">
        <div className="flex items-center justify-between">
          <div className="label">
            {roundActive
              ? `Round ${view.round.n} · live`
              : view.roundCount > 0
                ? `Round ${view.roundCount} finished`
                : "No rounds yet"}
          </div>
          {roundActive && (
            <Countdown
              endsAt={view.round.endsAt}
              serverNow={view.serverNow}
              className="text-xl font-semibold text-brand-light"
            />
          )}
        </div>

        {view.status !== "ended" && (
          <>
            {!roundActive && (
              <div className="mt-4 flex items-center gap-2">
                <input
                  className="input w-20 text-center"
                  type="number"
                  min={1}
                  max={120}
                  value={startMinutes}
                  onChange={(e) =>
                    setMinutes(Math.min(120, Math.max(1, Number(e.target.value) || 1)))
                  }
                />
                <span className="text-sm text-white/40">min</span>
                <button
                  className="btn-primary flex-1"
                  disabled={busy}
                  onClick={() => act("startRound", { minutes: startMinutes })}
                >
                  Start round {view.roundCount + 1}
                </button>
              </div>
            )}
            <div className="mt-3 flex gap-2">
              {roundActive && (
                <button
                  className="btn-ghost flex-1"
                  disabled={busy}
                  onClick={() => act("endRound")}
                >
                  End round early
                </button>
              )}
              <button
                className="btn-danger flex-1"
                disabled={busy}
                onClick={() => {
                  if (confirm("End the event for everyone?")) act("endEvent");
                }}
              >
                End event
              </button>
            </div>
          </>
        )}

        {roundActive && (
          <div className="mt-4 space-y-2">
            {view.round.pairs.map((p: any, i: number) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-lg bg-white/[0.04] px-3 py-2 text-sm"
              >
                <span>
                  {p.a?.emoji} {p.a?.name} &nbsp;·&nbsp; {p.b?.emoji} {p.b?.name}
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
              <p className="text-xs text-white/35">
                {view.round.standbyCount} on standby — priority next round
              </p>
            )}
          </div>
        )}
      </div>

      {/* Attendees */}
      <div className="card mt-3">
        <div className="label">Guests ({view.attendees.length})</div>
        <div className="mt-3 space-y-1.5">
          {view.attendees.length === 0 && (
            <p className="text-sm text-white/35">
              No one yet — share the invite code above.
            </p>
          )}
          {view.attendees.map((a: any) => (
            <div
              key={a.id}
              className="flex items-center gap-2 rounded-lg bg-white/[0.04] px-3 py-2"
            >
              <Avatar user={a} size={28} />
              <span className="flex-1 truncate text-sm font-medium">
                {a.name}
                <span className="ml-2 text-xs font-normal text-white/35">
                  {view.categories.find((c: any) => c.id === a.category)?.name}
                </span>
              </span>
              {a.waitlisted ? (
                <button
                  className="rounded-full border border-brand/40 px-3 py-1 text-xs font-semibold text-brand-light"
                  disabled={busy}
                  onClick={() => act("promote", { userId: a.id })}
                >
                  let in
                </button>
              ) : a.checkedIn ? (
                <button
                  className="rounded-full border border-emerald-400/30 px-3 py-1 text-xs font-semibold text-emerald-300/90"
                  disabled={busy}
                  onClick={() => act("uncheck", { userId: a.id })}
                >
                  ✓ in
                </button>
              ) : (
                <button
                  className="rounded-full border border-white/15 px-3 py-1 text-xs font-semibold text-white/50"
                  disabled={busy}
                  onClick={() => act("checkin", { userId: a.id })}
                >
                  check in
                </button>
              )}
              <button
                className="px-1 text-white/25 transition hover:text-red-300"
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

function EditPanel({
  view,
  busy,
  onSave,
}: {
  view: any;
  busy: boolean;
  onSave: (patch: Record<string, unknown>) => void;
}) {
  const groupingMode: "label" | "range" = view.grouping?.type ?? "label";
  const [title, setTitle] = useState(view.title);
  const [mode, setMode] = useState(view.mode);
  const [vibeLabel, setVibeLabel] = useState(view.mode === "custom" ? view.vibeLabel : "");
  const [attribute, setAttribute] = useState(view.grouping?.attribute ?? "Age");
  const [roundMinutes, setRoundMinutes] = useState(view.roundMinutes);
  const [groups, setGroups] = useState<GroupDraft[]>(
    view.categories.map((c: any) => ({
      id: c.id,
      name: c.name,
      cap: c.cap,
      min: c.min ?? "",
      max: c.max ?? "",
    }))
  );
  const [cross, setCross] = useState(view.crossCategory);

  const lockedIds = new Set<string>(
    view.categories
      .filter((c: any) => c.registered > 0 || c.waitlisted > 0)
      .map((c: any) => c.id as string)
  );

  return (
    <div className="card mt-4 space-y-5 border-brand/20">
      <p className="label">Edit event</p>
      <div>
        <label className="label">Name</label>
        <input
          className="input mt-1.5"
          value={title}
          maxLength={60}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>
      <div>
        <label className="label">Vibe</label>
        <div className="mt-2 flex flex-wrap gap-2">
          {[
            ["dating", "Dating"],
            ["mixer", "Social mixer"],
            ["networking", "Networking"],
            ["custom", "Your own"],
          ].map(([k, l]) => (
            <button
              key={k}
              type="button"
              className={`chip ${mode === k ? "chip-on" : ""}`}
              onClick={() => setMode(k)}
            >
              {l}
            </button>
          ))}
        </div>
        {mode === "custom" && (
          <input
            className="input mt-3"
            placeholder="Name your vibe"
            value={vibeLabel}
            maxLength={30}
            onChange={(e) => setVibeLabel(e.target.value)}
          />
        )}
      </div>
      <div>
        <label className="label">Groups</label>
        {groupingMode === "range" && (
          <input
            className="input mt-2"
            placeholder="Range of what? e.g. Age"
            value={attribute}
            maxLength={20}
            onChange={(e) => setAttribute(e.target.value)}
          />
        )}
        <div className="mt-2">
          <GroupsEditor
            groups={groups}
            onChange={setGroups}
            mode={groupingMode}
            lockedIds={lockedIds}
          />
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
        <label className="label">Default round length</label>
        <div className="mt-2 flex items-center gap-3">
          <input
            className="input w-24 text-center"
            type="number"
            min={1}
            max={120}
            value={roundMinutes}
            onChange={(e) =>
              setRoundMinutes(Math.min(120, Math.max(1, Number(e.target.value) || 1)))
            }
          />
          <span className="text-sm text-white/40">minutes (1–120)</span>
        </div>
      </div>
      <button
        className="btn-primary w-full"
        disabled={
          busy ||
          !title.trim() ||
          (groupingMode === "label"
            ? groups.some((g) => !g.name.trim())
            : groups.some((g) => g.min === "" || g.max === ""))
        }
        onClick={() =>
          onSave({
            title,
            mode,
            vibeLabel,
            attribute,
            roundMinutes,
            categories: groups,
            crossCategory: cross,
          })
        }
      >
        Save changes
      </button>
    </div>
  );
}
