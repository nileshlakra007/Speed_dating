export type EventMode = "dating" | "mixer" | "networking";

/** extend with "interest" | "networking" etc. as strategies are added */
export type MatchingMode = "random";

export interface Category {
  id: string;
  name: string;
  cap: number;
}

export interface Attendee {
  id: string;
  token: string;
  name: string;
  emoji: string;
  category: string; // category id
  checkedIn: boolean;
  left: boolean;
  waitlisted: boolean;
  joinedAt: number;
}

export interface MatchIdentifier {
  color: string; // hex
  colorName: string;
  icon: string; // emoji
  code: string; // e.g. "K7"
}

export interface Pair {
  a: string;
  b: string;
  identifier: MatchIdentifier;
  icebreaker: string;
}

export interface Round {
  n: number;
  startedAt: number;
  endsAt: number;
  pairs: Pair[];
  unmatched: string[]; // standby this round, priority next round
}

export interface Feedback {
  met: boolean;
  rating: number; // 1-5
  connect: boolean;
  avoid: boolean;
}

export interface EventData {
  code: string;
  hostToken: string;
  doorCode: string;
  title: string;
  mode: EventMode;
  crossCategory: boolean; // only match across the two categories (dating style)
  categories: Category[];
  roundMinutes: number;
  matchingMode: MatchingMode;
  status: "lobby" | "live" | "ended";
  attendees: Record<string, Attendee>;
  rounds: Round[];
  feedback: Record<string, Feedback>; // key `${roundN}:${userId}`
  found: Record<string, boolean>; // key `${roundN}:${userId}` — tapped "I found them"
  createdAt: number;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}
