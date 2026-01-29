"use client";

import React, { useRef, useEffect, useState } from "react";

// Quick actions that should auto-dismiss
const QUICK_ACTIONS = ["set_weather", "set_time", "camera_control"];

interface SearchResult {
  intent: {
    action: string;
    location_query?: string;
    building_attributes?: {
      sort_by?: string;
      building_type?: string;
      limit?: number;
    };
    reasoning?: string;
  };
  action?: string; // Primary action type
  answer: string;
  coordinates?: [number, number] | null;
  target?: GeoJSON.Feature | null;
  candidates: GeoJSON.Feature[];
  should_fly_to: boolean;
  zoom_level?: number | null;
  weather_settings?: { type: string };
  time_settings?: { preset: string };
  camera_settings?: { zoom_delta?: number; pitch?: number; bearing_delta?: number };
  delete_target?: GeoJSON.Feature;
  qa_data?: Record<string, unknown>;
}

// Get icon and label for different action types
function getActionDisplay(result: SearchResult): { icon: React.ReactElement; label: string } {
  const action = result.action || result.intent?.action;

  switch (action) {
    case "set_weather":
      return {
        icon: (
          <svg className="w-4 h-4 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
          </svg>
        ),
        label: "Weather Changed",
      };
    case "set_time":
      return {
        icon: (
          <svg className="w-4 h-4 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
        ),
        label: "Time Changed",
      };
    case "camera_control":
      return {
        icon: (
          <svg className="w-4 h-4 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
        ),
        label: "Camera Adjusted",
      };
    case "delete_building":
      return {
        icon: (
          <svg className="w-4 h-4 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        ),
        label: "Building Deleted",
      };
    case "question":
      return {
        icon: (
          <svg className="w-4 h-4 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ),
        label: "Answer",
      };
    default:
      return {
        icon: (
          <svg className="w-4 h-4 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        ),
        label: "Search Result",
      };
  }
}

interface SearchResultPopupProps {
  result: SearchResult;
  onClose: () => void;
  onCandidateClick: (candidate: GeoJSON.Feature) => void;
}

function getBuildingName(feature: GeoJSON.Feature): string {
  const props = feature.properties || {};
  return (
    props.name ||
    props["addr:housename"] ||
    props["addr:housenumber"] ||
    `Building ${feature.id || ""}`
  );
}

export function SearchResultPopup({
  result,
  onClose,
  onCandidateClick,
}: SearchResultPopupProps) {
  const popupRef = useRef<HTMLDivElement>(null);
  const [isFadingOut, setIsFadingOut] = useState(false);

  // Check if this is a quick action that should auto-dismiss
  const action = result.action || result.intent?.action;
  const isQuickAction = QUICK_ACTIONS.includes(action || "");

  // Auto-dismiss for quick actions after 2 seconds
  useEffect(() => {
    if (!isQuickAction) return;

    const fadeTimer = setTimeout(() => {
      setIsFadingOut(true);
    }, 2000);

    const closeTimer = setTimeout(() => {
      onClose();
    }, 2300); // 2s delay + 0.3s fade animation

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(closeTimer);
    };
  }, [isQuickAction, onClose]);

  // Close on escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        popupRef.current &&
        !popupRef.current.contains(event.target as Node)
      ) {
        // Don't close if clicking on the search bar
        const searchBar = document.querySelector('[data-search-container]');
        if (searchBar && searchBar.contains(event.target as Node)) {
          return;
        }
        onClose();
      }
    };

    // Delay to avoid closing immediately on search
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [onClose]);

  return (
    <div
      ref={popupRef}
      className={`absolute bottom-24 left-1/2 -translate-x-1/2 z-20 w-[500px] max-h-[320px] rounded-2xl bg-black/60 backdrop-blur-md border border-white/10 shadow-xl overflow-hidden transition-opacity duration-300 ${
        isFadingOut ? "opacity-0" : "opacity-100 animate-[fadeIn_0.2s_ease-out_forwards]"
      }`}
    >
      {/* Header with close button */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          {getActionDisplay(result).icon}
          <span className="text-xs text-white/50 uppercase tracking-wide font-medium">
            {getActionDisplay(result).label}
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 hover:bg-white/10 rounded-lg transition-colors duration-200"
        >
          <svg
            className="w-4 h-4 text-white/60 hover:text-white"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="p-4 overflow-y-auto max-h-[250px]">
        {/* Main answer */}
        <div className="text-white font-serif font-medium text-base leading-relaxed mb-4">
          {result.answer}
        </div>

        {/* Candidates list */}
        {result.candidates && result.candidates.length > 0 && (
          <div className="border-t border-white/10 pt-3">
            <div className="text-xs text-white/50 uppercase tracking-wide font-medium mb-2.5">
              Other results
            </div>
            <div className="flex flex-col gap-2">
              {result.candidates.map((candidate, idx) => (
                <button
                  key={candidate.id || idx}
                  onClick={() => onCandidateClick(candidate)}
                  className="w-full text-left px-3 py-2.5 text-sm bg-white/5 hover:bg-white/10 text-white/70 hover:text-white rounded-lg border border-white/10 transition-all duration-200 flex items-center gap-2"
                >
                  <svg
                    className="w-4 h-4 text-white/40 flex-shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                    />
                  </svg>
                  <span className="truncate">{getBuildingName(candidate)}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
