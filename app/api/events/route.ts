import { NextResponse } from "next/server";
import { doorCode, eventCode, handle, id } from "@/lib/api";
import { createEvent } from "@/lib/store";
import { ApiError, EventData, EventMode } from "@/lib/types";

export const POST = handle(async (req) => {
  const body = await req.json();
  const title = String(body.title ?? "").trim();
  const mode = (body.mode ?? "mixer") as EventMode;
  const roundMinutes = Math.min(60, Math.max(1, Number(body.roundMinutes) || 10));
  const crossCategory = !!body.crossCategory;
  const rawCategories: { name?: string; cap?: number }[] = Array.isArray(
    body.categories
  )
    ? body.categories
    : [];

  if (!title) throw new ApiError("Event needs a title");
  const categories = rawCategories
    .map((c, i) => ({
      id: `c${i + 1}`,
      name: String(c.name ?? "").trim(),
      cap: Math.min(500, Math.max(1, Number(c.cap) || 10)),
    }))
    .filter((c) => c.name);
  if (categories.length === 0)
    categories.push({ id: "c1", name: "Everyone", cap: 100 });
  if (crossCategory && categories.length !== 2)
    throw new ApiError("Cross-category matching needs exactly 2 categories");

  const event: EventData = {
    code: eventCode(),
    hostToken: id(24),
    doorCode: doorCode(),
    title,
    mode,
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
  return NextResponse.json({ code: event.code, hostToken: event.hostToken });
});
