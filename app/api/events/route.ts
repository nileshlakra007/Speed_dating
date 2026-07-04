import { NextResponse } from "next/server";
import { doorCode, eventCode, handle, id } from "@/lib/api";
import { recordEventOwnership, requireHost } from "@/lib/auth";
import { createEvent } from "@/lib/store";
import { ApiError, EventData, EventMode } from "@/lib/types";

const MODES: EventMode[] = ["dating", "mixer", "networking", "custom"];
const MODE_LABELS: Record<string, string> = {
  dating: "Dating",
  mixer: "Social mixer",
  networking: "Networking",
};

export const POST = handle(async (req) => {
  const body = await req.json();
  const host = await requireHost(body.session);

  const title = String(body.title ?? "").trim();
  const mode = (MODES.includes(body.mode) ? body.mode : "mixer") as EventMode;
  const vibeLabel =
    mode === "custom"
      ? String(body.vibeLabel ?? "").trim().slice(0, 30)
      : MODE_LABELS[mode];
  const roundMinutes = Math.min(120, Math.max(1, Number(body.roundMinutes) || 10));
  const crossCategory = !!body.crossCategory;
  const rawCategories: { name?: string; cap?: number }[] = Array.isArray(
    body.categories
  )
    ? body.categories
    : [];

  if (!title) throw new ApiError("Event needs a title");
  if (mode === "custom" && !vibeLabel)
    throw new ApiError("Give your custom vibe a name");
  const categories = rawCategories
    .map((c, i) => ({
      id: `c${i + 1}`,
      name: String(c.name ?? "").trim().slice(0, 24),
      cap: Math.min(500, Math.max(1, Number(c.cap) || 10)),
    }))
    .filter((c) => c.name);
  if (categories.length === 0)
    categories.push({ id: "c1", name: "Everyone", cap: 100 });
  if (categories.length > 6) throw new ApiError("Maximum 6 groups");
  if (crossCategory && categories.length !== 2)
    throw new ApiError("Cross-group matching needs exactly 2 groups");

  const event: EventData = {
    code: eventCode(),
    hostId: host.id,
    hostToken: id(24),
    doorCode: doorCode(),
    title,
    mode,
    vibeLabel,
    crossCategory,
    categories,
    roundMinutes,
    matchingMode: "random",
    status: "lobby",
    attendees: {},
    rounds: [],
    feedback: {},
    found: {},
    createdAt: Date.now(),
  };

  await createEvent(event);
  await recordEventOwnership(host, event.code);
  return NextResponse.json({ code: event.code });
});
