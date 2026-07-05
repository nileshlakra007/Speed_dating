import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { requireAccount } from "@/lib/auth";
import { devAvatarsEnabled } from "@/lib/devAvatars";
import { getEvent } from "@/lib/store";
import { ApiError, EventData } from "@/lib/types";
import { attendeeView, categoryCounts, hostView } from "@/lib/views";

export const GET = handle(async (req, ctx: { params: Promise<{ code: string }> }) => {
  const { code } = await ctx.params;
  const event = await getEvent(code);
  if (!event) throw new ApiError("Event not found", 404);

  const url = new URL(req.url);
  const session = url.searchParams.get("session");
  const hostToken = url.searchParams.get("hostToken");
  const uid = url.searchParams.get("uid");
  const token = url.searchParams.get("token");

  if (session) {
    const account = await requireAccount(session);
    if (account.id === event.hostId)
      return NextResponse.json({ role: "host", view: hostView(event) });
    // cross-device recovery: a signed-in guest who joined before gets
    // their spot (and its credentials) back on any device
    const mine = Object.values(event.attendees).find(
      (a) => a.accountId === account.id && !a.left
    );
    if (mine)
      return NextResponse.json({
        role: "attendee",
        credentials: { userId: mine.id, token: mine.token },
        view: attendeeView(event, mine.id),
      });
    return anonView(event, account.name);
  }

  // legacy device-bound host access (events created before host accounts)
  if (hostToken) {
    if (hostToken !== event.hostToken)
      throw new ApiError("Invalid host token", 403);
    return NextResponse.json({ role: "host", view: hostView(event) });
  }

  if (uid && token) {
    const me = event.attendees[uid];
    if (!me || me.token !== token)
      throw new ApiError("Invalid credentials", 403);
    return NextResponse.json({ role: "attendee", view: attendeeView(event, uid) });
  }

  // Anonymous preview (join screen)
  return anonView(event);
});

function anonView(event: EventData, signedInAs?: string) {
  return NextResponse.json({
    role: "anon",
    view: {
      code: event.code,
      title: event.title,
      mode: event.mode,
      vibeLabel: event.vibeLabel,
      status: event.status,
      signedInAs: signedInAs ?? null,
      photosEnabled: !!process.env.BLOB_READ_WRITE_TOKEN || devAvatarsEnabled,
      grouping: event.grouping ?? { type: "label" },
      categories: categoryCounts(event).map((c) => ({
        id: c.id,
        name: c.name,
        cap: c.cap,
        min: c.min,
        max: c.max,
        registered: c.registered,
        waitlisted: c.waitlisted,
        full: c.registered >= c.cap,
      })),
    },
  });
}
