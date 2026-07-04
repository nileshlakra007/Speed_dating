"use client";

export interface GroupDraft {
  id?: string;
  name: string;
  cap: number;
  min?: number | "";
  max?: number | "";
}

export type GroupingMode = "label" | "range";

export const LABEL_QUICKFILLS: { label: string; groups: GroupDraft[] }[] = [
  {
    label: "Gender",
    groups: [
      { name: "Men", cap: 20 },
      { name: "Women", cap: 20 },
    ],
  },
  {
    label: "Mentors / Mentees",
    groups: [
      { name: "Mentors", cap: 15 },
      { name: "Mentees", cap: 15 },
    ],
  },
  {
    label: "Founders / Investors",
    groups: [
      { name: "Founders", cap: 20 },
      { name: "Investors", cap: 10 },
    ],
  },
];

export const RANGE_QUICKFILLS: { label: string; attribute: string; groups: GroupDraft[] }[] = [
  {
    label: "Age brackets",
    attribute: "Age",
    groups: [
      { name: "", cap: 15, min: 18, max: 25 },
      { name: "", cap: 15, min: 26, max: 35 },
      { name: "", cap: 15, min: 36, max: 60 },
    ],
  },
  {
    label: "Years of experience",
    attribute: "Years of experience",
    groups: [
      { name: "", cap: 20, min: 0, max: 5 },
      { name: "", cap: 20, min: 6, max: 40 },
    ],
  },
];

export function GroupsEditor({
  groups,
  onChange,
  mode,
  lockedIds = new Set(),
}: {
  groups: GroupDraft[];
  onChange: (groups: GroupDraft[]) => void;
  mode: GroupingMode;
  /** groups that already have members — editable, not removable */
  lockedIds?: Set<string>;
}) {
  const set = (i: number, patch: Partial<GroupDraft>) =>
    onChange(groups.map((g, j) => (j === i ? { ...g, ...patch } : g)));

  const num = (v: string): number | "" => (v === "" ? "" : Number(v));

  return (
    <div>
      {/* column headers */}
      <div className="mb-1.5 flex items-center gap-2">
        {mode === "range" ? (
          <>
            <span className="label flex-1 text-center">From</span>
            <span className="label flex-1 text-center">To</span>
            <span className="label w-24 text-center">Spots</span>
          </>
        ) : (
          <>
            <span className="label flex-1">Group name</span>
            <span className="label w-24 text-center">Spots</span>
          </>
        )}
        <span className="w-5" />
      </div>

      <div className="space-y-2">
        {groups.map((g, i) => (
          <div key={g.id ?? `new-${i}`} className="flex items-center gap-2">
            {mode === "range" ? (
              <>
                <input
                  className="input flex-1 text-center"
                  type="number"
                  placeholder="18"
                  value={g.min ?? ""}
                  onChange={(e) => set(i, { min: num(e.target.value) })}
                />
                <input
                  className="input flex-1 text-center"
                  type="number"
                  placeholder="25"
                  value={g.max ?? ""}
                  onChange={(e) => set(i, { max: num(e.target.value) })}
                />
              </>
            ) : (
              <input
                className="input flex-1"
                placeholder="e.g. Designers"
                value={g.name}
                maxLength={24}
                onChange={(e) => set(i, { name: e.target.value })}
              />
            )}
            <input
              className="input w-24 text-center"
              type="number"
              min={1}
              max={500}
              value={g.cap}
              onChange={(e) => set(i, { cap: Number(e.target.value) })}
            />
            <span className="w-5 text-center">
              {groups.length > 1 && !(g.id && lockedIds.has(g.id)) && (
                <button
                  type="button"
                  className="text-white/30 transition hover:text-red-300"
                  onClick={() => onChange(groups.filter((_, j) => j !== i))}
                >
                  ✕
                </button>
              )}
            </span>
          </div>
        ))}
      </div>

      {groups.length < 6 && (
        <button
          type="button"
          className="mt-2 text-sm font-semibold text-brand-light/90 hover:text-brand-light"
          onClick={() =>
            onChange([
              ...groups,
              mode === "range"
                ? { name: "", cap: 20, min: "", max: "" }
                : { name: "", cap: 20 },
            ])
          }
        >
          + add group
        </button>
      )}
    </div>
  );
}
