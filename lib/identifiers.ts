import { MatchIdentifier } from "./types";

export const COLORS: { name: string; hex: string }[] = [
  { name: "Violet", hex: "#8b5cf6" },
  { name: "Hot Pink", hex: "#ec4899" },
  { name: "Sky", hex: "#38bdf8" },
  { name: "Lime", hex: "#a3e635" },
  { name: "Amber", hex: "#fbbf24" },
  { name: "Coral", hex: "#fb7185" },
  { name: "Mint", hex: "#34d399" },
  { name: "Tangerine", hex: "#fb923c" },
];

export const ICONS = ["⭐", "⚡", "🔥", "🌙", "🎧", "🎲", "🌈", "🍀", "🪩", "👾", "🫧", "🦋"];

const CODE_LETTERS = "ABCDEFGHJKMNPQRSTUVWXYZ"; // no I/L/O — easy to read out loud

/** Generate identifiers unique within a round. */
export function makeIdentifierFactory() {
  const used = new Set<string>();
  return function next(): MatchIdentifier {
    for (let i = 0; i < 500; i++) {
      const color = COLORS[Math.floor(Math.random() * COLORS.length)];
      const icon = ICONS[Math.floor(Math.random() * ICONS.length)];
      const code =
        CODE_LETTERS[Math.floor(Math.random() * CODE_LETTERS.length)] +
        Math.floor(Math.random() * 10);
      const sig = `${color.hex}|${icon}|${code}`;
      if (used.has(sig)) continue;
      used.add(sig);
      return { color: color.hex, colorName: color.name, icon, code };
    }
    // practically unreachable (8×12×230 combos)
    return { color: "#8b5cf6", colorName: "Violet", icon: "⭐", code: "Z9" };
  };
}

export const ICEBREAKERS = [
  "What made you actually show up tonight?",
  "Best trip you've ever taken — go.",
  "What's the last thing you did for the first time?",
  "Pitch the weirdest idea you've heard this year.",
  "What's your most controversial food opinion?",
  "Last concert or gig you went to?",
  "If you quit everything tomorrow, what would you do instead?",
  "What's a small thing that instantly makes your day?",
  "Which app do you waste the most time on, honestly?",
  "What are you weirdly good at?",
  "Describe your week in exactly three words.",
  "What would your friends say your green flag is?",
];

export function pickIcebreaker(seed: string): string {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return ICEBREAKERS[h % ICEBREAKERS.length];
}
