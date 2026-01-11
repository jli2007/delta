"use client";

import { useEffect } from "react";
import { Cross2Icon } from "@radix-ui/react-icons";
import { commands, CATEGORY_LABELS, CATEGORY_ORDER } from "@/lib/commands";

interface CommandHelpProps {
  onClose: () => void;
}

export function CommandHelp({ onClose }: CommandHelpProps) {
  // Group commands by category
  const grouped = CATEGORY_ORDER.map((category) => ({
    category,
    label: CATEGORY_LABELS[category],
    commands: commands.filter((c) => c.category === category),
  })).filter((g) => g.commands.length > 0);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-[fadeIn_0.15s_ease-out_forwards]"
      onClick={onClose}
    >
      <div
        className="w-[700px] max-h-[80vh] overflow-hidden rounded-2xl bg-black/70 backdrop-blur-md border border-white/10 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 flex items-center justify-between p-4 border-b border-white/10 bg-black/50 backdrop-blur-sm">
          <div>
            <h2 className="text-white font-semibold text-lg">Command Palette</h2>
            <p className="text-white/50 text-sm">Type / in the search bar to use commands</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-all"
          >
            <Cross2Icon className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(80vh-80px)] p-4 space-y-6">
          {grouped.map((group) => (
            <div key={group.category}>
              <h3 className="text-white/60 text-xs uppercase tracking-wider font-medium mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-white/20" />
                {group.label}
              </h3>

              <div className="grid grid-cols-1 gap-1">
                {group.commands.map((cmd) => {
                  const Icon = cmd.icon;
                  return (
                    <div
                      key={cmd.id}
                      className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-white/5 transition-all group"
                    >
                      {/* Icon */}
                      <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 group-hover:bg-white/10 transition-all">
                        <Icon className="w-4 h-4 text-white/50" />
                      </div>

                      {/* Trigger */}
                      <code className="w-28 text-sm text-white/80 font-mono">
                        {cmd.trigger}
                      </code>

                      {/* Arguments */}
                      <span className="w-24 text-xs text-white/40">
                        {cmd.arguments
                          ? cmd.arguments.map((a) =>
                              a.required ? `<${a.name}>` : `[${a.name}]`
                            ).join(" ")
                          : "—"}
                      </span>

                      {/* Description */}
                      <span className="flex-1 text-sm text-white/50">
                        {cmd.description}
                      </span>

                      {/* Aliases */}
                      {cmd.aliases.length > 0 && (
                        <span className="text-xs text-white/30">
                          {cmd.aliases.join(", ")}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Tips Section */}
          <div className="mt-6 pt-6 border-t border-white/10">
            <h3 className="text-white/60 text-xs uppercase tracking-wider font-medium mb-3">
              Tips
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-2 text-white/50">
                <kbd className="px-2 py-1 bg-white/10 rounded text-xs text-white/70">↑ ↓</kbd>
                <span>Navigate commands</span>
              </div>
              <div className="flex items-center gap-2 text-white/50">
                <kbd className="px-2 py-1 bg-white/10 rounded text-xs text-white/70">Tab</kbd>
                <span>Autocomplete command</span>
              </div>
              <div className="flex items-center gap-2 text-white/50">
                <kbd className="px-2 py-1 bg-white/10 rounded text-xs text-white/70">Enter</kbd>
                <span>Execute command</span>
              </div>
              <div className="flex items-center gap-2 text-white/50">
                <kbd className="px-2 py-1 bg-white/10 rounded text-xs text-white/70">Esc</kbd>
                <span>Close dropdown</span>
              </div>
            </div>

            <p className="mt-4 text-white/40 text-sm">
              Type without <code className="text-white/60">/</code> to use natural language AI search
              (e.g., &quot;take me to Tokyo&quot; or &quot;find the tallest building&quot;)
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
