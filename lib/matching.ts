import { makeIdentifierFactory, pickIcebreaker } from "./identifiers";
import { Attendee, EventData, MatchingMode, Pair, Round } from "./types";

const pairKey = (a: string, b: string) => [a, b].sort().join("|");

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function partnerOf(round: Round, userId: string): string | null {
  for (const p of round.pairs) {
    if (p.a === userId) return p.b;
    if (p.b === userId) return p.a;
  }
  return null;
}

/** Everything a strategy needs to decide who pairs with whom. */
export interface MatchingContext {
  eligible: Attendee[];
  /** hard constraints: never pair (block/avoid feedback) */
  avoid: Set<string>;
  /** soft constraints: pairs that already happened */
  past: Set<string>;
  /** users skipped last round — must get priority */
  priority: Set<string>;
  event: EventData;
  pairKey: (a: string, b: string) => string;
}

/**
 * Strategy pattern: each matching mode implements this. Adding
 * interest-based or networking-optimized matching later means adding an
 * entry to `strategies` — no caller changes.
 */
export interface MatchingStrategy {
  pair(ctx: MatchingContext): { pairs: [string, string][]; unmatched: string[] };
}

/** Greedy pairing honoring hard avoids always and repeats only if forced. */
function greedyPair(
  left: string[],
  right: string[] | null, // null → pair within one pool
  ctx: MatchingContext
): { pairs: [string, string][]; unmatched: string[] } {
  const { past, avoid } = ctx;
  const pairs: [string, string][] = [];
  const unmatched: string[] = [];

  const pickFrom = (a: string, pool: string[]) => {
    let idx = pool.findIndex(
      (b) => !avoid.has(pairKey(a, b)) && !past.has(pairKey(a, b))
    );
    if (idx === -1) idx = pool.findIndex((b) => !avoid.has(pairKey(a, b)));
    return idx;
  };

  if (right) {
    const pool = [...right];
    for (const a of left) {
      const idx = pickFrom(a, pool);
      if (idx === -1) unmatched.push(a);
      else pairs.push([a, pool.splice(idx, 1)[0]]);
    }
    unmatched.push(...pool);
  } else {
    const pool = [...left];
    while (pool.length > 1) {
      const a = pool.shift()!;
      const idx = pickFrom(a, pool);
      if (idx === -1) unmatched.push(a);
      else pairs.push([a, pool.splice(idx, 1)[0]]);
    }
    unmatched.push(...pool);
  }
  return { pairs, unmatched };
}

class RandomStrategy implements MatchingStrategy {
  pair(ctx: MatchingContext) {
    const { eligible, priority, event } = ctx;

    // standby users from last round go to the front of the shuffle
    const ordered = (ids: string[]) => [
      ...shuffle(ids.filter((id) => priority.has(id))),
      ...shuffle(ids.filter((id) => !priority.has(id))),
    ];

    if (event.crossCategory && event.categories.length === 2) {
      const [catA, catB] = event.categories;
      const sideA = ordered(
        eligible.filter((u) => u.category === catA.id).map((u) => u.id)
      );
      const sideB = ordered(
        eligible.filter((u) => u.category === catB.id).map((u) => u.id)
      );
      // iterate the smaller side so leftovers land in standby, not skipped
      return sideA.length <= sideB.length
        ? greedyPair(sideA, sideB, ctx)
        : greedyPair(sideB, sideA, ctx);
    }
    return greedyPair(ordered(eligible.map((u) => u.id)), null, ctx);
  }
}

const strategies: Record<MatchingMode, MatchingStrategy> = {
  random: new RandomStrategy(),
  // future: interest: new InterestWeightedStrategy(),
  // future: networking: new NetworkingOptimizedStrategy(),
};

function buildContext(event: EventData): MatchingContext {
  const eligible = Object.values(event.attendees).filter(
    (a) => a.checkedIn && !a.left && !a.waitlisted
  );

  const past = new Set<string>();
  for (const round of event.rounds)
    for (const p of round.pairs) past.add(pairKey(p.a, p.b));

  const avoid = new Set<string>();
  for (const round of event.rounds) {
    for (const [k, fb] of Object.entries(event.feedback)) {
      const [n, userId] = k.split(":");
      if (Number(n) !== round.n || !fb.avoid) continue;
      const partner = partnerOf(round, userId);
      if (partner) avoid.add(pairKey(userId, partner));
    }
  }

  const lastRound = event.rounds[event.rounds.length - 1];
  return {
    eligible,
    past,
    avoid,
    priority: new Set(lastRound?.unmatched ?? []),
    event,
    pairKey,
  };
}

export function buildRound(event: EventData, durationMs: number): Round {
  const strategy = strategies[event.matchingMode] ?? strategies.random;
  const raw = strategy.pair(buildContext(event));

  const nextIdentifier = makeIdentifierFactory();
  const now = Date.now();
  const n = event.rounds.length + 1;
  const pairs: Pair[] = raw.pairs.map(([a, b]) => {
    const identifier = nextIdentifier();
    return {
      a,
      b,
      identifier,
      icebreaker: pickIcebreaker(`${event.code}:${n}:${identifier.code}`),
    };
  });

  return { n, startedAt: now, endsAt: now + durationMs, pairs, unmatched: raw.unmatched };
}
