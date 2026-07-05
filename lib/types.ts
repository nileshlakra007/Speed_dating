export type EventMode = "dating" | "mixer" | "networking" | "custom";

/** One account model for everyone — hosting and attending are
 * capabilities of the same person, not separate identities. */
export interface Account {
  id: string;
  name: string;
  email: string; // stored lowercase, verified when from Google
  passwordHash?: string; // salt.hash (PBKDF2-SHA256); absent for Google-only accounts
  googleSub?: string; // Google's stable subject id, set after first Google sign-in
  picture?: string; // profile photo URL from Google
  events: string[]; // codes of events this account hosts
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
  accountId?: string; // set when the guest joined signed-in — enables cross-device recovery
  name: string;
  emoji: string;
  photoUrl?: string; // optional avatar (Vercel Blob)
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
  hostId: string; // owning Account
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
