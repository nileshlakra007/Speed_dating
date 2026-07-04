import { Attendee, EventData, Pair, Round } from "./types";

export interface PublicUser {
  id: string;
  name: string;
  emoji: string;
  category: string;
}

const publicUser = (a: Attendee): PublicUser => ({
  id: a.id,
  name: a.name,
  emoji: a.emoji,
  category: a.category,
});

export function categoryCounts(event: EventData) {
  return event.categories.map((c) => {
    const inCat = Object.values(event.attendees).filter(
      (a) => a.category === c.id && !a.left
    );
    return {
      ...c,
      registered: inCat.filter((a) => !a.waitlisted).length,
      checkedIn: inCat.filter((a) => a.checkedIn && !a.waitlisted).length,
      waitlisted: inCat.filter((a) => a.waitlisted).length,
    };
  });
}

function myPair(round: Round, userId: string): Pair | null {
  return (
    round.pairs.find((p) => p.a === userId || p.b === userId) ?? null
  );
}

/** Mutual connections: both said connect (and neither avoided) in some round. */
export function connectionsFor(event: EventData, userId: string): PublicUser[] {
  const out = new Map<string, PublicUser>();
  for (const round of event.rounds) {
    const pair = myPair(round, userId);
    if (!pair) continue;
    const other = pair.a === userId ? pair.b : pair.a;
    const mine = event.feedback[`${round.n}:${userId}`];
    const theirs = event.feedback[`${round.n}:${other}`];
    if (
      mine?.connect &&
      theirs?.connect &&
      !mine.avoid &&
      !theirs.avoid &&
      event.attendees[other]
    ) {
      out.set(other, publicUser(event.attendees[other]));
    }
  }
  return [...out.values()];
}

export function attendeeView(event: EventData, userId: string) {
  const me = event.attendees[userId];
  if (!me) return null;

  const currentRound = event.rounds[event.rounds.length - 1] ?? null;
  const roundActive = !!currentRound && Date.now() < currentRound.endsAt && event.status === "live";
  const pair = currentRound ? myPair(currentRound, userId) : null;
  const partnerId = pair ? (pair.a === userId ? pair.b : pair.a) : null;
  const partner = partnerId ? event.attendees[partnerId] : null;

  return {
    code: event.code,
    title: event.title,
    mode: event.mode,
    vibeLabel: event.vibeLabel,
    status: event.status,
    roundMinutes: event.roundMinutes,
    serverNow: Date.now(),
    me: {
      ...publicUser(me),
      checkedIn: me.checkedIn,
      waitlisted: me.waitlisted,
      left: me.left,
    },
    counts: {
      checkedIn: Object.values(event.attendees).filter(
        (a) => a.checkedIn && !a.left && !a.waitlisted
      ).length,
      registered: Object.values(event.attendees).filter(
        (a) => !a.left && !a.waitlisted
      ).length,
    },
    round: currentRound
      ? {
          n: currentRound.n,
          startedAt: currentRound.startedAt,
          endsAt: currentRound.endsAt,
          active: roundActive,
          standby: roundActive && !pair && me.checkedIn && !me.left,
          match: pair
            ? {
                identifier: pair.identifier,
                icebreaker: pair.icebreaker,
                partner: partner ? publicUser(partner) : null,
                iFound: !!event.found[`${currentRound.n}:${userId}`],
                theyFound: partnerId
                  ? !!event.found[`${currentRound.n}:${partnerId}`]
                  : false,
              }
            : null,
          feedbackGiven: !!event.feedback[`${currentRound.n}:${userId}`],
        }
      : null,
    connections:
      event.status === "ended" ? connectionsFor(event, userId) : null,
  };
}

export function hostView(event: EventData) {
  const currentRound = event.rounds[event.rounds.length - 1] ?? null;
  return {
    code: event.code,
    title: event.title,
    mode: event.mode,
    vibeLabel: event.vibeLabel,
    status: event.status,
    doorCode: event.doorCode,
    roundMinutes: event.roundMinutes,
    crossCategory: event.crossCategory,
    grouping: event.grouping ?? { type: "label" },
    serverNow: Date.now(),
    categories: categoryCounts(event),
    attendees: Object.values(event.attendees)
      .filter((a) => !a.left)
      .sort((a, b) => a.joinedAt - b.joinedAt)
      .map((a) => ({
        ...publicUser(a),
        checkedIn: a.checkedIn,
        waitlisted: a.waitlisted,
      })),
    roundCount: event.rounds.length,
    round: currentRound
      ? {
          n: currentRound.n,
          startedAt: currentRound.startedAt,
          endsAt: currentRound.endsAt,
          active: Date.now() < currentRound.endsAt && event.status === "live",
          standbyCount: currentRound.unmatched.length,
          pairs: currentRound.pairs.map((p) => ({
            a: event.attendees[p.a] ? publicUser(event.attendees[p.a]) : null,
            b: event.attendees[p.b] ? publicUser(event.attendees[p.b]) : null,
            identifier: p.identifier,
          })),
        }
      : null,
  };
}
