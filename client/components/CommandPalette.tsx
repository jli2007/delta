"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { MagnifyingGlassIcon } from "@radix-ui/react-icons";
import {
  fuzzyMatchCommands,
  parseCommandInput,
  findCommand,
  commands,
  type CommandContext,
  type FuzzyMatch,
  type ParsedArgs,
} from "@/lib/commands";
import { CommandDropdown } from "./CommandDropdown";

interface CommandPaletteProps {
  value: string;
  onChange: (value: string) => void;
  onSearch: () => void;
  context: CommandContext;
  isLoading?: boolean;
  placeholder?: string;
}

export function CommandPalette({
  value,
  onChange,
  onSearch,
  context,
  isLoading = false,
  placeholder = "Type / for commands, or search naturally...",
}: CommandPaletteProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [suggestions, setSuggestions] = useState<FuzzyMatch[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Check if input is in command mode (starts with /)
  const isCommandMode = value.startsWith("/");

  // Parse current input
  const { trigger, args: argString } = useMemo(
    () => parseCommandInput(value),
    [value]
  );

  // Update suggestions when input changes
  useEffect(() => {
    if (!isCommandMode) {
      setShowDropdown(false);
      setSuggestions([]);
      return;
    }

    // Get the query part (everything after / but before the first argument)
    const query = trigger;
    const matches = fuzzyMatchCommands(query, commands);

    setSuggestions(matches);
    setShowDropdown(matches.length > 0);
    setSelectedIndex(0);
  }, [isCommandMode, trigger]);

  // Execute a command
  const executeCommand = useCallback(
    async (match: FuzzyMatch) => {
      const command = match.command;
      const args: ParsedArgs = { _raw: argString };

      try {
        await command.execute(args, context);
      } catch (error) {
        console.error(`Failed to execute command ${command.trigger}:`, error);
      }

      // Clear input and close dropdown
      onChange("");
      setShowDropdown(false);
    },
    [argString, context, onChange]
  );

  // Handle keyboard events
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!showDropdown) {
        // Not in command mode - handle as regular search
        if (e.key === "Enter" && value.trim()) {
          // Check if this is a complete command
          if (isCommandMode) {
            const command = findCommand(trigger, commands);
            if (command) {
              const args: ParsedArgs = { _raw: argString };
              command.execute(args, context);
              onChange("");
              return;
            }
          }
          onSearch();
        }
        return;
      }

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((i) => Math.min(i + 1, suggestions.length - 1));
          break;

        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((i) => Math.max(i - 1, 0));
          break;

        case "Tab":
          e.preventDefault();
          if (suggestions[selectedIndex]) {
            // Autocomplete to the command trigger
            const cmd = suggestions[selectedIndex].command;
            onChange(cmd.trigger + (cmd.arguments?.length ? " " : ""));
          }
          break;

        case "Enter":
          e.preventDefault();
          if (suggestions[selectedIndex]) {
            // If no arguments required, execute immediately
            const cmd = suggestions[selectedIndex].command;
            if (!cmd.arguments || argString.trim()) {
              executeCommand(suggestions[selectedIndex]);
            } else {
              // Autocomplete and wait for args
              onChange(cmd.trigger + " ");
            }
          }
          break;

        case "Escape":
          e.preventDefault();
          setShowDropdown(false);
          break;
      }
    },
    [
      showDropdown,
      value,
      isCommandMode,
      trigger,
      argString,
      context,
      onSearch,
      onChange,
      suggestions,
      selectedIndex,
      executeCommand,
    ]
  );

  // Handle click on suggestion
  const handleSuggestionClick = useCallback(
    (match: FuzzyMatch) => {
      const cmd = match.command;
      if (!cmd.arguments) {
        // No arguments - execute immediately
        executeCommand(match);
      } else {
        // Has arguments - autocomplete and focus
        onChange(cmd.trigger + " ");
        inputRef.current?.focus();
      }
    },
    [executeCommand, onChange]
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    };

    if (showDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showDropdown]);

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Command Suggestions Dropdown (appears above input) */}
      {showDropdown && suggestions.length > 0 && (
        <CommandDropdown
          matches={suggestions}
          selectedIndex={selectedIndex}
          onSelect={handleSuggestionClick}
          onHover={setSelectedIndex}
        />
      )}

      {/* Search Input */}
      <div className="relative flex items-center">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 z-10 pointer-events-none">
          <MagnifyingGlassIcon className="w-5 h-5 text-white/60" />
        </div>

        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full pl-12 pr-3 py-2 bg-transparent text-white text-sm placeholder:text-white/40 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={isLoading}
          autoComplete="off"
          spellCheck={false}
        />

        {isLoading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 z-10">
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          </div>
        )}

        {/* Command mode indicator */}
        {isCommandMode && !isLoading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 z-10">
            <span className="text-xs text-white/40 bg-white/5 px-2 py-0.5 rounded">
              ↑↓ navigate • Tab complete • Enter select
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
