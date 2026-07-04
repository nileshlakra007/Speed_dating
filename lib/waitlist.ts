import { EventData } from "./types";

/** Oldest waitlisted attendee in a category takes a freed slot. */
export function promoteWaitlist(event: EventData, categoryId: string) {
  const cat = event.categories.find((c) => c.id === categoryId);
  if (!cat) return;
  const registered = Object.values(event.attendees).filter(
    (a) => a.category === categoryId && !a.left && !a.waitlisted
  ).length;
  if (registered >= cat.cap) return;
  const next = Object.values(event.attendees)
    .filter((a) => a.category === categoryId && a.waitlisted && !a.left)
    .sort((a, b) => a.joinedAt - b.joinedAt)[0];
  if (next) next.waitlisted = false;
}
