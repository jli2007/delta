"use client";

import { useMemo } from "react";
import { type FuzzyMatch, CATEGORY_LABELS, CATEGORY_ORDER } from "@/lib/commands";
import { CommandItem } from "./CommandItem";

interface CommandDropdownProps {
  matches: FuzzyMatch[];
  selectedIndex: number;
  onSelect: (match: FuzzyMatch) => void;
  onHover: (index: number) => void;
}

export function CommandDropdown({
  matches,
  selectedIndex,
  onSelect,
  onHover,
}: CommandDropdownProps) {
  // Group matches by category
  const grouped = useMemo(() => {
    const groups = new Map<string, { match: FuzzyMatch; globalIndex: number }[]>();

    matches.forEach((match, globalIndex) => {
      const category = match.command.category;
      const existing = groups.get(category) || [];
      existing.push({ match, globalIndex });
      groups.set(category, existing);
    });

    // Sort by category order
    const sortedGroups: {
      category: string;
      label: string;
      items: { match: FuzzyMatch; globalIndex: number }[];
    }[] = [];

    for (const category of CATEGORY_ORDER) {
      const items = groups.get(category);
      if (items && items.length > 0) {
        sortedGroups.push({
          category,
          label: CATEGORY_LABELS[category],
          items,
        });
      }
    }

    return sortedGroups;
  }, [matches]);

  if (matches.length === 0) {
    return null;
  }

  return (
    <div className="absolute bottom-full left-0 right-0 mb-2 max-h-[400px] overflow-y-auto rounded-xl bg-black/90 backdrop-blur-md border border-white/10 shadow-xl z-50 animate-[fadeIn_0.15s_ease-out_forwards]">
      {grouped.map((group) => (
        <div key={group.category}>
          {/* Category Header */}
          <div className="sticky top-0 px-3 py-2 text-[10px] text-white/40 uppercase tracking-wider font-medium bg-black/80 backdrop-blur-sm border-b border-white/5">
            {group.label}
          </div>

          {/* Commands in Category */}
          {group.items.map(({ match, globalIndex }) => (
            <CommandItem
              key={match.command.id}
              match={match}
              isSelected={globalIndex === selectedIndex}
              onSelect={() => onSelect(match)}
              onHover={() => onHover(globalIndex)}
            />
          ))}
        </div>
      ))}

      {/* Hint at bottom */}
      <div className="px-3 py-2 text-[10px] text-white/30 border-t border-white/5 flex items-center justify-between">
        <span>Type without / for AI search</span>
        <span>/help for all commands</span>
      </div>
    </div>
  );
}
