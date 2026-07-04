import { NextResponse } from "next/server";
import { doorCode, eventCode, handle, id } from "@/lib/api";
import { recordEventOwnership, requireHost } from "@/lib/auth";
import { parseGroups } from "@/lib/groups";
import { createEvent } from "@/lib/store";
import { ApiError, Category, EventData, EventMode, Grouping } from "@/lib/types";

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
  const rawCategories: unknown[] = Array.isArray(body.categories)
    ? body.categories
    : [];

  if (!title) throw new ApiError("Event needs a title");
  if (mode === "custom" && !vibeLabel)
    throw new ApiError("Give your custom vibe a name");

  const grouping: Grouping =
    body.groupingType === "range"
      ? {
          type: "range",
          attribute:
            String(body.attribute ?? "").trim().slice(0, 20) || "Age",
        }
      : { type: "label" };

  let categories: Category[];
  if (rawCategories.length === 0 && grouping.type === "label") {
    categories = [{ id: "c1", name: "Everyone", cap: 100 }];
  } else {
    categories = parseGroups(rawCategories, grouping).map((c, i) => ({
      ...c,
      id: `c${i + 1}`,
    }));
  }
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
    grouping,
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
