"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Countdown } from "@/components/Countdown";
import { TwynLogo } from "@/components/Logo";
import { GoogleSignIn } from "@/components/GoogleSignIn";
import { Avatar, PhotoPicker } from "@/components/PhotoPicker";
import { api, loadIdentity, loadSession, saveIdentity } from "@/lib/client";

const EMOJIS = ["🦊", "🐼", "🦄", "🐸", "🐙", "🦋", "🐯", "🐨", "🐵", "🐳", "🌵", "🍕", "🎸", "🛸", "🌊", "🔥"];

export default function EventPage() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const [anon, setAnon] = useState<any>(null);
  const [view, setView] = useState<any>(null);
  const [error, setError] = useState("");
  const identityRef = useRef(loadIdentity(code));

  const refresh = useCallback(async () => {
    const id = identityRef.current;
    try {
      if (id) {
        const res = await api(
          `/api/events/${code}?uid=${id.userId}&token=${encodeURIComponent(id.token)}`
        );
        setView(res.view);
      } else {
        // signed in? the server can restore a previously joined spot on any device
        const session = loadSession();
        let res;
        if (session) {
          try {
            res = await api(
              `/api/events/${code}?session=${encodeURIComponent(session)}`
            );
          } catch {
            res = await api(`/api/events/${code}`); // stale session — browse anonymously
          }
        } else {
          res = await api(`/api/events/${code}`);
        }
        if (res.role === "attendee" && res.credentials) {
          identityRef.current = res.credentials;
          saveIdentity(code, res.credentials);
          setView(res.view);
        } else {
          setAnon(res.view);
        }
      }
      setError("");
    } catch (e: any) {
      setError(e.message);
    }
  }, [code]);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 2500);
    return () => clearInterval(t);
  }, [refresh]);

  const onJoined = (userId: string, token: string) => {
    identityRef.current = { userId, token };
    saveIdentity(code, { userId, token });
    refresh();
  };

  if (error && !view && !anon)
    return (
      <Shell>
        <p className="card mt-6 text-rose-300">{error}</p>
        <button className="btn-ghost mt-4 w-full" onClick={() => router.push("/")}>
          ← Home
        </button>
      </Shell>
    );

  if (!identityRef.current)
    return anon ? (
      <JoinScreen code={code} anon={anon} onJoined={onJoined} onRefresh={refresh} />
    ) : (
      <Loading />
    );

  if (!view) return <Loading />;
  return <AttendeeScreen code={code} view={view} setView={setView} />;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-md px-6 py-8 pb-24">
      <TwynLogo size={26} />
      {children}
    </main>
  );
}

function Loading() {
  return (
    <main className="grid min-h-dvh place-items-center text-white/40">
      loading…
    </main>
  );
}

/* ---------------- Join ---------------- */

function JoinScreen({
  code,
  anon,
  onJoined,
  onRefresh,
}: {
  code: string;
  anon: any;
  onJoined: (userId: string, token: string) => void;
  onRefresh: () => void;
}) {
  const isRange = anon.grouping?.type === "range";
  const attribute: string = anon.grouping?.attribute || "Age";
  const [name, setName] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    setHasSession(!!loadSession());
  }, []);

  // signed-in guests get their name prefilled from their account
  useEffect(() => {
    if (anon.signedInAs) setName((n: string) => n || anon.signedInAs);
  }, [anon.signedInAs]);
  const [emoji, setEmoji] = useState("🦊");
  const [value, setValue] = useState("");
  const [category, setCategory] = useState(
    anon.categories.length === 1 ? anon.categories[0].id : ""
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const selected = isRange
    ? anon.categories.find(
        (c: any) =>
          value !== "" && Number(value) >= c.min && Number(value) <= c.max
      )
    : anon.categories.find((c: any) => c.id === category);

  const join = async () => {
    setBusy(true);
    setErr("");
    try {
      const res = await api<{ userId: string; token: string; waitlisted: boolean }>(
        `/api/events/${code}/join`,
        isRange
          ? { name, emoji, photoUrl, value: Number(value), session: loadSession() }
          : { name, emoji, photoUrl, category, session: loadSession() }
      );
      onJoined(res.userId, res.token);
    } catch (e: any) {
      setErr(e.message);
      setBusy(false);
    }
  };

  return (
    <Shell>
      <h1 className="mt-6 font-display text-3xl font-medium">{anon.title}</h1>
      <p className="mt-1 text-white/50">
        You&apos;re joining with code{" "}
        <span className="font-bold tracking-widest text-brand-light">{anon.code}</span>
      </p>
      {anon.status === "ended" ? (
        <p className="card mt-6 text-white/60">This event has ended 👋</p>
      ) : (
        <div className="card mt-6 space-y-5">
          <div>
            <label className="text-sm font-semibold text-white/60">Your name</label>
            <input
              className="input mt-1.5"
              placeholder="First name is fine"
              value={name}
              maxLength={30}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          {anon.photosEnabled && (
            <PhotoPicker url={photoUrl} onChange={setPhotoUrl} />
          )}
          <div>
            <label className="text-sm font-semibold text-white/60">Pick a vibe</label>
            <div className="mt-2 grid grid-cols-8 gap-1.5">
              {EMOJIS.map((e) => (
                <button
                  key={e}
                  className={`rounded-xl p-1.5 text-2xl transition ${
                    emoji === e ? "bg-brand/20 ring-2 ring-brand" : "bg-white/5"
                  }`}
                  onClick={() => setEmoji(e)}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
          {isRange ? (
            <div>
              <label className="text-sm font-semibold text-white/60">
                Your {attribute.toLowerCase()}
              </label>
              <input
                className="input mt-2 w-32 text-center text-lg font-semibold"
                type="number"
                inputMode="numeric"
                placeholder="—"
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
              {value !== "" && !selected && (
                <p className="mt-2 text-sm text-red-300/90">
                  No group covers {attribute.toLowerCase()} {value} at this event.
                </p>
              )}
              {selected && !selected.full && (
                <p className="mt-2 text-sm text-white/45">
                  You&apos;ll join the {selected.name} group ·{" "}
                  {selected.cap - selected.registered} spots left.
                </p>
              )}
            </div>
          ) : (
            anon.categories.length > 1 && (
              <div>
                <label className="text-sm font-semibold text-white/60">I&apos;m joining as</label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {anon.categories.map((c: any) => (
                    <button
                      key={c.id}
                      className={`chip ${category === c.id ? "chip-on" : ""}`}
                      onClick={() => setCategory(c.id)}
                    >
                      {c.name}
                      {c.full ? " · waitlist" : ` · ${c.cap - c.registered} left`}
                    </button>
                  ))}
                </div>
              </div>
            )
          )}
          {selected?.full && (
            <p className="rounded-xl bg-brand/10 p-3 text-sm text-brand-light">
              This group is full — you&apos;ll join the waitlist and get in if a spot
              opens up.
            </p>
          )}
          {err && <p className="text-sm text-red-300/90">{err}</p>}
          <button
            className="btn-primary w-full text-lg"
            disabled={busy || !name.trim() || (isRange ? !selected : !category)}
            onClick={join}
          >
            {busy ? "Joining…" : selected?.full ? "Join waitlist" : "I'm in"}
          </button>

          {hasSession ? (
            <p className="text-center text-xs text-white/35">
              Signed in — your spot will follow you across devices.
            </p>
          ) : (
            <div>
              <div className="mb-3 flex items-center gap-3 text-xs uppercase tracking-widest text-white/20">
                <div className="hairline flex-1" />
                optional
                <div className="hairline flex-1" />
              </div>
              <GoogleSignIn
                onAuthed={() => {
                  setHasSession(true);
                  onRefresh();
                }}
              />
              <p className="mt-2 text-center text-xs text-white/30">
                Sign in to keep your spot if you switch phones or clear your
                browser.
              </p>
            </div>
          )}
        </div>
      )}
    </Shell>
  );
}

/* ---------------- Attendee ---------------- */

function AttendeeScreen({
  code,
  view,
  setView,
}: {
  code: string;
  view: any;
  setView: (v: any) => void;
}) {
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const act = async (action: string, extra: Record<string, unknown> = {}) => {
    const id = loadIdentity(code)!;
    setBusy(true);
    setErr("");
    try {
      const res = await api(`/api/events/${code}/me`, {
        userId: id.userId,
        token: id.token,
        action,
        ...extra,
      });
      setView(res.view);
      return true;
    } catch (e: any) {
      setErr(e.message);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const me = view.me;
  const round = view.round;
  const inActiveRound = round?.active;

  let body: React.ReactNode;

  if (me.left) {
    body = <p className="card mt-6 text-white/60">You left this event. Bye 👋</p>;
  } else if (view.status === "ended") {
    body = <Connections view={view} />;
  } else if (me.waitlisted) {
    body = (
      <div className="card mt-6 text-center">
        <div className="text-4xl">⏳</div>
        <h2 className="mt-2 text-xl font-bold">You&apos;re on the waitlist</h2>
        <p className="mt-1 text-sm text-white/50">
          If a spot opens in your group, you&apos;re in. Keep this page open.
        </p>
      </div>
    );
  } else if (!me.checkedIn) {
    body = <CheckIn act={act} busy={busy} />;
  } else if (inActiveRound && round.match) {
    body = <MatchCard code={code} view={view} act={act} busy={busy} />;
  } else if (inActiveRound && round.standby) {
    body = (
      <div className="card mt-6 text-center">
        <div className="text-4xl">🍹</div>
        <h2 className="mt-2 text-xl font-bold">Sit this one out</h2>
        <p className="mt-1 text-sm text-white/50">
          Odd numbers this round — you get priority for the next one. Grab a drink.
        </p>
        <Countdown
          endsAt={round.endsAt}
          serverNow={view.serverNow}
          className="mt-3 block font-display text-3xl font-medium text-brand-light"
        />
      </div>
    );
  } else if (round && !round.active && round.match && !round.feedbackGiven) {
    body = <FeedbackForm round={round} act={act} busy={busy} />;
  } else {
    body = (
      <div className="card mt-6 text-center">
        <div className="text-4xl">✅</div>
        <h2 className="mt-2 text-xl font-bold">You&apos;re in!</h2>
        <p className="mt-1 text-sm text-white/50">
          {view.counts.checkedIn} checked in · waiting for the host to start{" "}
          {round ? `round ${round.n + 1}` : "round 1"}…
        </p>
      </div>
    );
  }

  return (
    <Shell>
      <div className="mt-4 flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-medium">{view.title}</h1>
          <p className="text-xs text-white/40">
            {me.emoji} {me.name} · code {view.code}
          </p>
        </div>
        {!me.left && view.status !== "ended" && (
          <button
            className="text-xs font-semibold text-white/40 underline"
            onClick={() => {
              if (confirm("Leave the event? Your spot goes to the waitlist."))
                act("leave");
            }}
          >
            leave
          </button>
        )}
      </div>
      {err && <p className="mt-3 text-sm text-red-300/90">{err}</p>}
      {body}
    </Shell>
  );
}

function CheckIn({ act, busy }: { act: any; busy: boolean }) {
  const [door, setDoor] = useState("");
  return (
    <div className="card mt-6 text-center">
      <div className="text-4xl">🚪</div>
      <h2 className="mt-2 text-xl font-bold">Check in at the door</h2>
      <p className="mt-1 text-sm text-white/50">
        Ask the host for the 4-digit door code when you arrive.
      </p>
      <form
        className="mt-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          act("checkin", { doorCode: door });
        }}
      >
        <input
          className="input flex-1 text-center text-2xl font-semibold tracking-[0.4em]"
          inputMode="numeric"
          placeholder="0000"
          maxLength={4}
          value={door}
          onChange={(e) => setDoor(e.target.value.replace(/\D/g, ""))}
        />
        <button className="btn-primary" disabled={busy || door.length !== 4}>
          Check in
        </button>
      </form>
    </div>
  );
}

function MatchCard({
  code,
  view,
  act,
  busy,
}: {
  code: string;
  view: any;
  act: any;
  busy: boolean;
}) {
  const round = view.round;
  const m = round.match;
  const id = m.identifier;
  const bothFound = m.iFound && m.theyFound;

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold text-white/60">Round {round.n}</span>
        <Countdown
          endsAt={round.endsAt}
          serverNow={view.serverNow}
          className="text-2xl font-semibold text-brand-light"
        />
      </div>

      <div
        className="mt-3 rounded-3xl p-6 text-center text-black shadow-2xl"
        style={{ background: id.color }}
      >
        <p className="text-sm font-bold uppercase tracking-wider opacity-70">
          find the person showing
        </p>
        <div className="mt-2 text-7xl">{id.icon}</div>
        <div className="mt-1 text-6xl font-black tracking-widest">{id.code}</div>
        <p className="mt-2 text-sm font-bold opacity-70">{id.colorName}</p>
      </div>

      <div className="card mt-3 text-center">
        <p className="text-sm text-white/50">Your twin this round</p>
        <div className="mt-2 flex items-center justify-center gap-3">
          {m.partner && <Avatar user={m.partner} size={52} />}
          <p className="text-2xl font-semibold">{m.partner?.name}</p>
        </div>
        <p className="mt-3 rounded-xl bg-white/5 p-3 text-sm text-white/70">
          💬 {m.icebreaker}
        </p>
        {bothFound ? (
          <p className="mt-3 rounded-xl bg-emerald-500/15 p-3 font-bold text-emerald-300">
            You found each other 🎉 Timer&apos;s on — chat!
          </p>
        ) : m.iFound ? (
          <p className="mt-3 text-sm text-white/50">
            Waiting for them to confirm…
          </p>
        ) : (
          <button
            className="btn-primary mt-3 w-full"
            disabled={busy}
            onClick={() => act("found")}
          >
            👀 I found them
          </button>
        )}
      </div>
    </div>
  );
}

function FeedbackForm({ round, act, busy }: { round: any; act: any; busy: boolean }) {
  const [met, setMet] = useState<boolean | null>(null);
  const [rating, setRating] = useState(0);
  const [connect, setConnect] = useState(false);
  const [avoid, setAvoid] = useState(false);
  const partner = round.match.partner;

  return (
    <div className="card mt-6">
      <h2 className="font-display text-xl font-medium">
        Round {round.n} — how was {partner?.name}? {partner?.emoji}
      </h2>
      <p className="mt-1 text-xs text-white/40">
        Your answers are private. They never see this.
      </p>

      <div className="mt-4">
        <label className="text-sm font-semibold text-white/60">Did you find each other?</label>
        <div className="mt-2 flex gap-2">
          <button className={`chip flex-1 ${met === true ? "chip-on" : ""}`} onClick={() => setMet(true)}>
            Yes 🤝
          </button>
          <button className={`chip flex-1 ${met === false ? "chip-on" : ""}`} onClick={() => setMet(false)}>
            Never found them 🙈
          </button>
        </div>
      </div>

      {met && (
        <>
          <div className="mt-4">
            <label className="text-sm font-semibold text-white/60">Vibe check</label>
            <div className="mt-2 flex justify-between px-2">
              {[1, 2, 3, 4, 5].map((r) => (
                <button
                  key={r}
                  className={`text-3xl transition ${rating >= r ? "" : "opacity-25 grayscale"}`}
                  onClick={() => setRating(r)}
                >
                  ⭐
                </button>
              ))}
            </div>
          </div>
          <button className={`chip mt-4 w-full ${connect ? "chip-on" : ""}`} onClick={() => { setConnect(!connect); if (!connect) setAvoid(false); }}>
            {connect ? "✓ " : ""}💌 I&apos;d connect after the event
          </button>
          <p className="mt-1 text-xs text-white/35">
            Only revealed if you both say yes.
          </p>
        </>
      )}

      <button
        className={`chip mt-3 w-full ${avoid ? "chip-on" : ""}`}
        onClick={() => { setAvoid(!avoid); if (!avoid) setConnect(false); }}
      >
        {avoid ? "✓ " : ""}🚫 Don&apos;t match us again
      </button>

      <button
        className="btn-primary mt-5 w-full"
        disabled={busy || met === null || (met === true && rating === 0)}
        onClick={() =>
          act("feedback", {
            round: round.n,
            met: met === true,
            rating: rating || 3,
            connect,
            avoid,
          })
        }
      >
        Submit
      </button>
    </div>
  );
}

function Connections({ view }: { view: any }) {
  const conns = view.connections ?? [];
  return (
    <div className="card mt-6 text-center">
      <div className="text-4xl">{conns.length > 0 ? "💞" : "🌙"}</div>
      <h2 className="mt-2 font-display text-xl font-medium">
        {conns.length > 0 ? "Your mutuals" : "That's a wrap"}
      </h2>
      {conns.length > 0 ? (
        <>
          <p className="mt-1 text-sm text-white/50">
            You both said yes — go say hi before everyone leaves! 👋
          </p>
          <div className="mt-4 space-y-2">
            {conns.map((c: any) => (
              <div
                key={c.id}
                className="flex items-center justify-center gap-3 rounded-xl bg-white/5 px-4 py-3 text-lg font-bold"
              >
                <Avatar user={c} size={36} />
                {c.name}
              </div>
            ))}
          </div>
        </>
      ) : (
        <p className="mt-1 text-sm text-white/50">
          No mutual connections this time — the next event is a fresh start ✨
        </p>
      )}
    </div>
  );
}
