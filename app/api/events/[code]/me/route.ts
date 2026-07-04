import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { mutateEvent } from "@/lib/store";
import { ApiError } from "@/lib/types";
import { attendeeView } from "@/lib/views";
import { promoteWaitlist } from "@/lib/waitlist";

export const POST = handle(async (req, ctx: { params: Promise<{ code: string }> }) => {
  const { code } = await ctx.params;
  const body = await req.json();
  const { userId, token, action } = body as {
    userId: string;
    token: string;
    action: string;
  };

  const updated = await mutateEvent(code, (event) => {
    const me = event.attendees[userId];
    if (!me || me.token !== token) throw new ApiError("Invalid credentials", 403);
    if (me.left && action !== "rejoin") throw new ApiError("You left this event", 410);

    switch (action) {
      case "checkin": {
        if (me.waitlisted)
          throw new ApiError("You're on the waitlist — ask the host to let you in");
        if (me.checkedIn) return; // idempotent
        if (String(body.doorCode) !== event.doorCode)
          throw new ApiError("Wrong door code — it's on the host's screen");
        me.checkedIn = true;
        break;
      }
      case "leave": {
        me.left = true;
        me.checkedIn = false;
        promoteWaitlist(event, me.category);
        break;
      }
      case "found": {
        const round = event.rounds[event.rounds.length - 1];
        if (!round || Date.now() >= round.endsAt)
          throw new ApiError("No active round");
        const inPair = round.pairs.some((p) => p.a === userId || p.b === userId);
        if (!inPair) throw new ApiError("You don't have a match this round");
        event.found[`${round.n}:${userId}`] = true;
        break;
      }
      case "feedback": {
        const roundN = Number(body.round);
        const round = event.rounds.find((r) => r.n === roundN);
        if (!round) throw new ApiError("Unknown round");
        const inPair = round.pairs.some((p) => p.a === userId || p.b === userId);
        if (!inPair) throw new ApiError("You weren't matched that round");
        event.feedback[`${roundN}:${userId}`] = {
          met: !!body.met,
          rating: Math.min(5, Math.max(1, Number(body.rating) || 3)),
          connect: !!body.connect,
          avoid: !!body.avoid,
        };
        break;
      }
      default:
        throw new ApiError("Unknown action");
    }
  });

  return NextResponse.json({ ok: true, view: attendeeView(updated, userId) });
});
