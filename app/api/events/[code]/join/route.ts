import { NextResponse } from "next/server";
import { handle, id } from "@/lib/api";
import { resolveCategory } from "@/lib/groups";
import { mutateEvent } from "@/lib/store";
import { ApiError, Attendee } from "@/lib/types";

export const POST = handle(async (req, ctx: { params: Promise<{ code: string }> }) => {
  const { code } = await ctx.params;
  const body = await req.json();
  const name = String(body.name ?? "").trim().slice(0, 30);
  const emoji = String(body.emoji ?? "🙂").slice(0, 8);
  if (!name) throw new ApiError("Enter your name");

  const userId = id(10);
  const token = id(24);
  let waitlisted = false;

  await mutateEvent(code, (event) => {
    if (event.status === "ended") throw new ApiError("This event has ended", 410);
    const cat = resolveCategory(event, body);

    // Slot control: registered (non-waitlist, non-left) count vs cap.
    // The store's compare-and-swap makes this race-safe under concurrent joins.
    const registered = Object.values(event.attendees).filter(
      (a) => a.category === cat.id && !a.left && !a.waitlisted
    ).length;
    waitlisted = registered >= cat.cap;

    const attendee: Attendee = {
      id: userId,
      token,
      name,
      emoji,
      category: cat.id,
      checkedIn: false,
      left: false,
      waitlisted,
      joinedAt: Date.now(),
    };
    event.attendees[userId] = attendee;
  });

  return NextResponse.json({ userId, token, waitlisted });
});
