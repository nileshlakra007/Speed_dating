"use client";

export interface GroupDraft {
  id?: string;
  name: string;
  cap: number;
}

export const GROUP_PRESETS: { key: string; label: string; groups: GroupDraft[] }[] = [
  { key: "everyone", label: "Everyone", groups: [{ name: "Everyone", cap: 40 }] },
  {
    key: "gender",
    label: "Gender",
    groups: [
      { name: "Men", cap: 20 },
      { name: "Women", cap: 20 },
    ],
  },
  {
    key: "age",
    label: "Age range",
    groups: [
      { name: "18–25", cap: 15 },
      { name: "26–35", cap: 15 },
      { name: "36+", cap: 15 },
    ],
  },
  {
    key: "custom",
    label: "Custom",
    groups: [
      { name: "", cap: 20 },
      { name: "", cap: 20 },
    ],
  },
];

export function GroupsEditor({
  groups,
  onChange,
  lockedIds = new Set(),
}: {
  groups: GroupDraft[];
  onChange: (groups: GroupDraft[]) => void;
  /** groups that already have members — name/cap editable, not removable */
  lockedIds?: Set<string>;
}) {
  const set = (i: number, patch: Partial<GroupDraft>) =>
    onChange(groups.map((g, j) => (j === i ? { ...g, ...patch } : g)));

  return (
    <div>
      <div className="space-y-2">
        {groups.map((g, i) => (
          <div key={g.id ?? `new-${i}`} className="flex items-center gap-2">
            <input
              className="input flex-1"
              placeholder="Group name — anything works"
              value={g.name}
              maxLength={24}
              onChange={(e) => set(i, { name: e.target.value })}
            />
            <input
              className="input w-24 text-center"
              type="number"
              min={1}
              max={500}
              value={g.cap}
              onChange={(e) => set(i, { cap: Number(e.target.value) })}
            />
            {groups.length > 1 && !(g.id && lockedIds.has(g.id)) && (
              <button
                type="button"
                className="px-1 text-white/30 transition hover:text-red-300"
                onClick={() => onChange(groups.filter((_, j) => j !== i))}
              >
                ✕
              </button>
            )}
          </div>
        ))}
      </div>
      {groups.length < 6 && (
        <button
          type="button"
          className="mt-2 text-sm font-semibold text-gold-light/90 hover:text-gold-light"
          onClick={() => onChange([...groups, { name: "", cap: 20 }])}
        >
          + add group
        </button>
      )}
      <p className="mt-1.5 text-xs text-white/30">
        Group people however fits your event — gender, age range, mentors &amp;
        mentees, founders &amp; investors. When a group is full, new joiners are
        waitlisted.
      </p>
    </div>
  );
}
