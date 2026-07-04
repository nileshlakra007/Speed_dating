export type EventMode = "dating" | "mixer" | "networking" | "custom";

export interface HostAccount {
  id: string;
  name: string;
  email: string; // stored lowercase
  passwordHash: string; // salt.hash (PBKDF2-SHA256)
  events: string[]; // codes of events this host owns
  createdAt: number;
}

/** extend with "interest" | "networking" etc. as strategies are added */
export type MatchingMode = "random";

export interface Category {
  id: string;
  name: string;
  cap: number;
  /** set when the event groups by a numeric range (e.g. age 18–25) */
  min?: number;
  max?: number;
}

export interface Grouping {
  type: "label" | "range";
  /** what the range measures, e.g. "Age" — asked of guests when joining */
  attribute?: string;
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
  hostId: string; // owning HostAccount
  hostToken: string; // legacy device-bound access, kept for old events
  doorCode: string;
  title: string;
  mode: EventMode;
  vibeLabel: string; // display label; free text when mode === "custom"
  crossCategory: boolean; // only match across the two categories (dating style)
  grouping: Grouping;
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
