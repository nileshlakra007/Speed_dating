import { ApiError, Category, EventData, Grouping } from "./types";

interface RawGroup {
  id?: string;
  name?: string;
  cap?: number;
  min?: number | string;
  max?: number | string;
}

export interface ParsedGroup extends Omit<Category, "id"> {
  /** present when editing an existing group; absent for newly added rows */
  id?: string;
}

/**
 * Validate and normalize host-supplied groups for either grouping mode.
 * Label mode: every group needs a name. Range mode: every group needs a
 * numeric min ≤ max, ranges must not overlap; names are derived (`18–25`).
 */
export function parseGroups(raw: unknown, grouping: Grouping): ParsedGroup[] {
  const list: RawGroup[] = Array.isArray(raw) ? raw : [];
  const groups = list.map((g, i) => {
    const cap = Math.min(500, Math.max(1, Number(g.cap) || 10));
    if (grouping.type === "range") {
      const min = Number(g.min);
      const max = Number(g.max);
      if (!Number.isFinite(min) || !Number.isFinite(max))
        throw new ApiError(`Group ${i + 1}: enter both range values`);
      if (min > max)
        throw new ApiError(`Group ${i + 1}: range start must be ≤ end`);
      return { id: g.id, name: `${min}–${max}`, cap, min, max };
    }
    const name = String(g.name ?? "").trim().slice(0, 24);
    return { id: g.id, name, cap };
  });

  const named = groups.filter((g) => g.name);
  if (named.length === 0) throw new ApiError("Add at least one group");
  if (named.length > 6) throw new ApiError("Maximum 6 groups");

  if (grouping.type === "range") {
    const sorted = [...named].sort((a, b) => (a.min ?? 0) - (b.min ?? 0));
    for (let i = 1; i < sorted.length; i++) {
      if ((sorted[i].min ?? 0) <= (sorted[i - 1].max ?? 0))
        throw new ApiError(
          `Ranges ${sorted[i - 1].name} and ${sorted[i].name} overlap`
        );
    }
  }
  return named;
}

/** Resolve which category a joining guest lands in. */
export function resolveCategory(
  event: EventData,
  body: { category?: string; value?: number | string }
): Category {
  const grouping = event.grouping ?? { type: "label" };
  if (grouping.type === "range") {
    const value = Number(body.value);
    const attr = grouping.attribute || "value";
    if (!Number.isFinite(value))
      throw new ApiError(`Enter your ${attr.toLowerCase()}`);
    const cat = event.categories.find(
      (c) => value >= (c.min ?? -Infinity) && value <= (c.max ?? Infinity)
    );
    if (!cat)
      throw new ApiError(
        `Sorry — this event has no group for ${attr.toLowerCase()} ${value}`
      );
    return cat;
  }
  const cat = event.categories.find((c) => c.id === body.category);
  if (!cat) throw new ApiError("Pick a group");
  return cat;
}
