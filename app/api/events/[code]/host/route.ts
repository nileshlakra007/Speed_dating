import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { requireHost } from "@/lib/auth";
import { buildRound } from "@/lib/matching";
import { mutateEvent } from "@/lib/store";
import { ApiError, EventMode } from "@/lib/types";
import { hostView } from "@/lib/views";
import { promoteWaitlist } from "@/lib/waitlist";

export const POST = handle(async (req, ctx: { params: Promise<{ code: string }> }) => {
  const { code } = await ctx.params;
  const body = await req.json();
  const { session, hostToken, action, userId } = body as {
    session?: string;
    hostToken?: string;
    action: string;
    userId?: string;
  };

  const host = session ? await requireHost(session) : null;

  const updated = await mutateEvent(code, (event) => {
    const authorized =
      (host && host.id === event.hostId) ||
      (!host && hostToken && hostToken === event.hostToken); // legacy events
    if (!authorized)
      throw new ApiError("Only this event's host can do that", 403);

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
      case "update": {
        if (event.status === "ended") throw new ApiError("Event has ended");

        if (body.title !== undefined) {
          const title = String(body.title).trim();
          if (!title) throw new ApiError("Event needs a title");
          event.title = title;
        }
        if (body.mode !== undefined) {
          const mode = body.mode as EventMode;
          const labels: Record<string, string> = {
            dating: "Dating",
            mixer: "Social mixer",
            networking: "Networking",
          };
          if (mode === "custom") {
            const label = String(body.vibeLabel ?? "").trim().slice(0, 30);
            if (!label) throw new ApiError("Give your custom vibe a name");
            event.mode = "custom";
            event.vibeLabel = label;
          } else if (labels[mode]) {
            event.mode = mode;
            event.vibeLabel = labels[mode];
          }
        }
        if (body.roundMinutes !== undefined) {
          event.roundMinutes = Math.min(
            120,
            Math.max(1, Number(body.roundMinutes) || event.roundMinutes)
          );
        }
        if (Array.isArray(body.categories)) {
          const next = body.categories
            .map((c: { id?: string; name?: string; cap?: number }, i: number) => ({
              id: c.id || `n${i + 1}`,
              name: String(c.name ?? "").trim().slice(0, 24),
              cap: Math.min(500, Math.max(1, Number(c.cap) || 10)),
            }))
            .filter((c: { name: string }) => c.name);
          if (next.length === 0 || next.length > 6)
            throw new ApiError("Between 1 and 6 groups");
          // a group with people in it can't be deleted
          const keptIds = new Set(next.map((c: { id: string }) => c.id));
          for (const a of Object.values(event.attendees)) {
            if (!a.left && !keptIds.has(a.category))
              throw new ApiError(
                "Can't remove a group that already has people in it"
              );
          }
          // re-id new groups so they don't collide with existing ones
          let counter = event.categories.length;
          event.categories = next.map((c: { id: string; name: string; cap: number }) =>
            c.id.startsWith("n") ? { ...c, id: `c${++counter}` } : c
          );
        }
        if (body.crossCategory !== undefined) {
          event.crossCategory =
            !!body.crossCategory && event.categories.length === 2;
        }
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
