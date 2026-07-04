import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { buildRound } from "@/lib/matching";
import { mutateEvent } from "@/lib/store";
import { ApiError } from "@/lib/types";
import { hostView } from "@/lib/views";
import { promoteWaitlist } from "@/lib/waitlist";

export const POST = handle(async (req, ctx: { params: Promise<{ code: string }> }) => {
  const { code } = await ctx.params;
  const body = await req.json();
  const { hostToken, action, userId } = body as {
    hostToken: string;
    action: string;
    userId?: string;
  };

  const updated = await mutateEvent(code, (event) => {
    if (hostToken !== event.hostToken) throw new ApiError("Invalid host token", 403);

    switch (action) {
      case "checkin": {
        const a = userId && event.attendees[userId];
        if (!a) throw new ApiError("Attendee not found", 404);
        if (a.waitlisted) throw new ApiError("Promote them off the waitlist first");
        a.checkedIn = true;
        break;
      }
      case "uncheck": {
        const a = userId && event.attendees[userId];
        if (!a) throw new ApiError("Attendee not found", 404);
        a.checkedIn = false;
        break;
      }
      case "promote": {
        const a = userId && event.attendees[userId];
        if (!a) throw new ApiError("Attendee not found", 404);
        a.waitlisted = false; // host override — may exceed cap intentionally
        break;
      }
      case "remove": {
        const a = userId && event.attendees[userId];
        if (!a) throw new ApiError("Attendee not found", 404);
        a.left = true;
        a.checkedIn = false;
        promoteWaitlist(event, a.category);
        break;
      }
      case "startRound": {
        if (event.status === "ended") throw new ApiError("Event has ended");
        const current = event.rounds[event.rounds.length - 1];
        if (current && Date.now() < current.endsAt)
          throw new ApiError("A round is still running");
        const eligible = Object.values(event.attendees).filter(
          (a) => a.checkedIn && !a.left && !a.waitlisted
        );
        if (eligible.length < 2)
          throw new ApiError("Need at least 2 checked-in people");
        const minutes = Math.min(60, Math.max(1, Number(body.minutes) || event.roundMinutes));
        event.rounds.push(buildRound(event, minutes * 60 * 1000));
        event.status = "live";
        break;
      }
      case "endRound": {
        const current = event.rounds[event.rounds.length - 1];
        if (!current || Date.now() >= current.endsAt)
          throw new ApiError("No active round");
        current.endsAt = Date.now();
        break;
      }
      case "endEvent": {
        const current = event.rounds[event.rounds.length - 1];
        if (current && Date.now() < current.endsAt) current.endsAt = Date.now();
        event.status = "ended";
        break;
      }
      default:
        throw new ApiError("Unknown action");
    }
  });

  return NextResponse.json({ ok: true, view: hostView(updated) });
});
