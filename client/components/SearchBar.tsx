"use client";

import { useState, useRef, useEffect } from "react";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onSearch: () => void;
  isLoading?: boolean;
  placeholder?: string;
  quickPrompts?: string[];
}

export function SearchBar({
  value,
  onChange,
  onSearch,
  isLoading = false,
  placeholder = "Search...",
  quickPrompts = [],
}: SearchBarProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && value.trim()) {
      onSearch();
    }
  };

  const handlePromptClick = (prompt: string) => {
    onChange(prompt);
    setShowDropdown(false);
    inputRef.current?.focus();
    setTimeout(() => onSearch(), 100);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
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
    <div className="relative w-full">
      {/* Search Input */}
      <div className="relative flex items-center gap-2">
        <div className="relative flex-1">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 z-10 pointer-events-none">
            <svg
              className="w-5 h-5 text-white/60 transition-colors duration-200"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setTimeout(() => setIsFocused(false), 200)}
            placeholder={placeholder}
            className="w-full pl-12 pr-4 py-2 bg-transparent text-white placeholder:text-white/40 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isLoading}
          />
          {isLoading && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2 z-10">
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            </div>
          )}
        </div>

        {/* Dropdown Toggle Button */}
        {quickPrompts.length > 0 && (
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="px-3.5 py-3.5 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white rounded-xl border border-white/10 transition-all duration-200 flex items-center justify-center"
              disabled={isLoading}
            >
              <svg 
                className={`w-5 h-5 transition-transform duration-200 ${showDropdown ? 'rotate-180' : ''}`}
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Dropdown Menu */}
            {showDropdown && (
              <div className="absolute top-full right-0 mt-2 bg-black/40 backdrop-blur-md rounded-xl border border-white/10 shadow-xl p-3 z-30 min-w-[280px] animate-[fadeIn_0.2s_ease-out_forwards]">
                <div className="text-xs text-white/60 mb-2.5 px-1 font-medium tracking-wide uppercase">Quick prompts</div>
                <div className="flex flex-col gap-2">
                  {quickPrompts.map((prompt, idx) => (
                    <button
                      key={idx}
                      onClick={() => handlePromptClick(prompt)}
                      className="px-3.5 py-2 text-sm bg-white/5 hover:bg-white/10 text-white/70 hover:text-white rounded-lg border border-white/10 transition-all duration-200 text-left"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
