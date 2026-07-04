import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { requireHost } from "@/lib/auth";
import { getEvent } from "@/lib/store";

export const GET = handle(async (req) => {
  const session = new URL(req.url).searchParams.get("session");
  const host = await requireHost(session);

  // resolve owned events (drop expired ones)
  const events = (
    await Promise.all(
      host.events.slice(-20).map(async (code) => {
        const e = await getEvent(code);
        return e
          ? { code: e.code, title: e.title, status: e.status, vibeLabel: e.vibeLabel }
          : null;
      })
    )
  ).filter(Boolean);

  return NextResponse.json({
    hostId: host.id,
    name: host.name,
    email: host.email,
    events: events.reverse(),
  });
});
