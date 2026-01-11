"use client";

import { type FuzzyMatch } from "@/lib/commands";

interface CommandItemProps {
  match: FuzzyMatch;
  isSelected: boolean;
  onSelect: () => void;
  onHover: () => void;
}

export function CommandItem({
  match,
  isSelected,
  onSelect,
  onHover,
}: CommandItemProps) {
  const { command, highlights, matchedOn } = match;
  const Icon = command.icon;

  // Render text with highlights
  const renderHighlighted = (text: string, highlights: { start: number; end: number }[]) => {
    if (highlights.length === 0) {
      return <span>{text}</span>;
    }

    const parts: React.ReactNode[] = [];
    let lastEnd = 0;

    // Sort highlights by start position
    const sorted = [...highlights].sort((a, b) => a.start - b.start);

    sorted.forEach((h, i) => {
      // Add non-highlighted text before this highlight
      if (h.start > lastEnd) {
        parts.push(
          <span key={`text-${i}`}>{text.slice(lastEnd, h.start)}</span>
        );
      }

      // Add highlighted text
      parts.push(
        <span key={`highlight-${i}`} className="text-white font-medium bg-white/10 rounded px-0.5">
          {text.slice(h.start, h.end)}
        </span>
      );

      lastEnd = h.end;
    });

    // Add remaining text
    if (lastEnd < text.length) {
      parts.push(<span key="text-end">{text.slice(lastEnd)}</span>);
    }

    return <>{parts}</>;
  };

  // Show the matched trigger/alias with highlights
  const displayTrigger = matchedOn.startsWith("/") ? matchedOn : command.trigger;

  return (
    <button
      onClick={onSelect}
      onMouseEnter={onHover}
      className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-all ${
        isSelected
          ? "bg-white/10 text-white"
          : "text-white/70 hover:bg-white/5"
      }`}
    >
      {/* Icon */}
      <div className={`flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg ${
        isSelected ? "bg-white/10" : "bg-white/5"
      }`}>
        <Icon className="w-4 h-4 text-white/60" />
      </div>

      {/* Command Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {/* Command Name */}
          <span className="font-medium text-sm">
            {command.name}
          </span>

          {/* Trigger with highlights */}
          <code className="text-xs text-white/40">
            {matchedOn.startsWith("/")
              ? renderHighlighted(displayTrigger, highlights)
              : displayTrigger}
          </code>

          {/* Aliases */}
          {command.aliases.length > 0 && (
            <span className="text-[10px] text-white/30">
              {command.aliases.slice(0, 2).join(", ")}
            </span>
          )}
        </div>

        {/* Description */}
        <p className="text-xs text-white/40 truncate">
          {command.description}
        </p>
      </div>

      {/* Arguments hint */}
      {command.arguments && (
        <div className="flex-shrink-0 text-xs text-white/30">
          {command.arguments.map((arg) => (
            <span key={arg.name}>
              {arg.required ? `<${arg.name}>` : `[${arg.name}]`}
            </span>
          ))}
        </div>
      )}
    </button>
  );
}
