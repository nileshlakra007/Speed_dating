import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { requireHost } from "@/lib/auth";
import { getEvent } from "@/lib/store";
import { ApiError } from "@/lib/types";
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
    const host = await requireHost(session);
    if (host.id !== event.hostId)
      throw new ApiError("This event belongs to a different host", 403);
    return NextResponse.json({ role: "host", view: hostView(event) });
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
  return NextResponse.json({
    role: "anon",
    view: {
      code: event.code,
      title: event.title,
      mode: event.mode,
      vibeLabel: event.vibeLabel,
      status: event.status,
      categories: categoryCounts(event).map((c) => ({
        id: c.id,
        name: c.name,
        cap: c.cap,
        registered: c.registered,
        waitlisted: c.waitlisted,
        full: c.registered >= c.cap,
      })),
    },
  });
});
