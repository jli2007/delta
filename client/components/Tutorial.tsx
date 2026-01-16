"use client";

import { useState, useEffect, useRef } from "react";
import { ChevronLeftIcon, ChevronRightIcon, Cross2Icon, InfoCircledIcon } from "@radix-ui/react-icons";

interface TutorialStep {
  id: string;
  title: string;
  description: string;
  target?: string; // CSS selector for element to highlight
  position?: "top" | "bottom" | "left" | "right" | "center";
}

interface TutorialProps {
  onComplete: () => void;
  onSkip: () => void;
}

const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: "welcome",
    title: "Welcome",
    description: "Guide to main features. Skip or navigate with buttons below.",
    position: "center",
  },
  {
    id: "toolbar-select",
    title: "Select",
    description: "Click buildings to view details.",
    target: '[data-tutorial="toolbar-select"]',
    position: "bottom",
  },
  {
    id: "toolbar-delete",
    title: "Delete",
    description: "Draw polygons to remove buildings.",
    target: '[data-tutorial="toolbar-delete"]',
    position: "bottom",
  },
  {
    id: "toolbar-insert",
    title: "Insert",
    description: "Add 3D models from library or upload GLB files.",
    target: '[data-tutorial="toolbar-insert"]',
    position: "bottom",
  },
  {
    id: "toolbar-generate",
    title: "Generate",
    description: "Create 3D models from text prompts.",
    target: '[data-tutorial="toolbar-generate"]',
    position: "bottom",
  },
  {
    id: "search-bar",
    title: "Search",
    description: "Search buildings by location or attributes.",
    target: '[data-tutorial="search-bar"]',
    position: "top",
  },
  {
    id: "map-controls",
    title: "Map Controls",
    description: "Zoom, rotate, toggle 2D/3D view.",
    target: '[data-tutorial="map-controls"]',
    position: "left",
  },
  {
    id: "weather-panel",
    title: "Lighting",
    description: "Set time of day and weather.",
    target: '[data-tutorial="weather-panel"]',
    position: "right",
  },
  {
    id: "complete",
    title: "Complete",
    description: "Tutorial complete.",
    position: "center",
  },
];

const STORAGE_KEY = "arcki_tutorial_completed";

export function Tutorial({ onComplete, onSkip }: TutorialProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [highlightElement, setHighlightElement] = useState<HTMLElement | null>(null);
  const [highlightRect, setHighlightRect] = useState<DOMRect | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const step = TUTORIAL_STEPS[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === TUTORIAL_STEPS.length - 1;

  // Find and highlight target element
  useEffect(() => {
    if (!step.target) {
      setHighlightElement(null);
      setHighlightRect(null);
      return;
    }

    const findElement = () => {
      const element = document.querySelector(step.target!) as HTMLElement;
      if (element) {
        setHighlightElement(element);
        const rect = element.getBoundingClientRect();
        setHighlightRect(rect);
      } else {
        // Retry if element not found (might be loading)
        setTimeout(findElement, 100);
      }
    };

    findElement();

    // Update rect on scroll/resize
    const updateRect = () => {
      if (highlightElement) {
        const rect = highlightElement.getBoundingClientRect();
        setHighlightRect(rect);
      }
    };

    window.addEventListener("scroll", updateRect, true);
    window.addEventListener("resize", updateRect);

    return () => {
      window.removeEventListener("scroll", updateRect, true);
      window.removeEventListener("resize", updateRect);
    };
  }, [step.target, currentStep]);

  const handleNext = () => {
    if (isLastStep) {
      handleComplete();
    } else {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (!isFirstStep) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleComplete = () => {
    localStorage.setItem(STORAGE_KEY, "true");
    onComplete();
  };

  const handleSkip = () => {
    onSkip();
  };

  // Calculate tooltip position
  const getTooltipPosition = () => {
    if (!highlightRect || !step.position || step.position === "center") {
      return {
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
      };
    }

    const padding = 24;
    const tooltipWidth = 400; // Approximate tooltip width
    const tooltipHeight = 200; // Approximate tooltip height
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let top: string | number = "50%";
    let left: string | number = "50%";
    let transform = "translate(-50%, -50%)";

    switch (step.position) {
      case "top":
        // Position above the element, but check if there's enough space
        const spaceAbove = highlightRect.top;
        if (spaceAbove < tooltipHeight + padding) {
          // Not enough space above, position below instead
          top = highlightRect.bottom + padding;
          left = Math.max(padding, Math.min(
            highlightRect.left + highlightRect.width / 2,
            viewportWidth - tooltipWidth / 2 - padding
          ));
          transform = "translate(-50%, 0)";
        } else {
          top = highlightRect.top - padding;
          left = Math.max(tooltipWidth / 2 + padding, Math.min(
            highlightRect.left + highlightRect.width / 2,
            viewportWidth - tooltipWidth / 2 - padding
          ));
          transform = "translate(-50%, -100%)";
        }
        break;
      case "bottom":
        // Position below the element, but check if there's enough space
        const spaceBelow = viewportHeight - highlightRect.bottom;
        if (spaceBelow < tooltipHeight + padding) {
          // Not enough space below, position above instead
          top = highlightRect.top - padding;
          left = Math.max(padding, Math.min(
            highlightRect.left + highlightRect.width / 2,
            viewportWidth - tooltipWidth / 2 - padding
          ));
          transform = "translate(-50%, -100%)";
        } else {
          top = highlightRect.bottom + padding;
          left = Math.max(tooltipWidth / 2 + padding, Math.min(
            highlightRect.left + highlightRect.width / 2,
            viewportWidth - tooltipWidth / 2 - padding
          ));
          transform = "translate(-50%, 0)";
        }
        break;
      case "left":
        top = Math.max(padding, Math.min(
          highlightRect.top + highlightRect.height / 2,
          viewportHeight - tooltipHeight / 2 - padding
        ));
        left = Math.max(padding, highlightRect.left - padding);
        transform = "translate(-100%, -50%)";
        break;
      case "right":
        top = Math.max(padding, Math.min(
          highlightRect.top + highlightRect.height / 2,
          viewportHeight - tooltipHeight / 2 - padding
        ));
        left = Math.min(viewportWidth - tooltipWidth - padding, highlightRect.right + padding);
        transform = "translate(0, -50%)";
        break;
    }

    return { top: `${top}px`, left: `${left}px`, transform };
  };

  const tooltipStyle = getTooltipPosition();

  return (
    <>
      {/* Dimmed overlay with cutout */}
      <div
        ref={overlayRef}
        className="fixed inset-0 z-[9998] transition-opacity duration-300 pointer-events-none"
      >
        {/* Top overlay */}
        {highlightRect && (
          <div
            className="absolute bg-black/20 transition-all duration-300"
            style={{
              top: 0,
              left: 0,
              right: 0,
              height: highlightRect.top,
            }}
          />
        )}
        {/* Bottom overlay */}
        {highlightRect && (
          <div
            className="absolute bg-black/20 transition-all duration-300"
            style={{
              top: highlightRect.bottom,
              left: 0,
              right: 0,
              bottom: 0,
            }}
          />
        )}
        {/* Left overlay */}
        {highlightRect && (
          <div
            className="absolute bg-black/20 transition-all duration-300"
            style={{
              top: highlightRect.top,
              left: 0,
              width: highlightRect.left,
              height: highlightRect.height,
            }}
          />
        )}
        {/* Right overlay */}
        {highlightRect && (
          <div
            className="absolute bg-black/20 transition-all duration-300"
            style={{
              top: highlightRect.top,
              left: highlightRect.right,
              right: 0,
              height: highlightRect.height,
            }}
          />
        )}
        {/* Full overlay for center steps */}
        {!highlightRect && (
          <div className="absolute inset-0 bg-black/20" />
        )}
      </div>

      {/* Highlight border */}
      {highlightRect && (
        <div
          className="fixed z-[9999] pointer-events-none border-2 border-white rounded-lg transition-all duration-300 shadow-[0_0_20px_rgba(255,255,255,0.3)]"
          style={{
            top: highlightRect.top - 4,
            left: highlightRect.left - 4,
            width: highlightRect.width + 8,
            height: highlightRect.height + 8,
          }}
        />
      )}

      {/* Tooltip */}
      <div
        className="fixed z-[10000] max-w-[400px] bg-black/90 backdrop-blur-md border border-white/20 rounded-2xl shadow-2xl p-6 pointer-events-auto transition-all duration-300"
        style={tooltipStyle}
      >
        <div className="flex items-start gap-3 mb-4">
          <div className="p-2 rounded-lg bg-white/10">
            <InfoCircledIcon className="text-white w-5 h-5" />
          </div>
          <div className="flex-1">
            <h3 className="text-white font-semibold text-lg mb-1">{step.title}</h3>
            <p className="text-white/70 text-sm leading-relaxed">{step.description}</p>
          </div>
          <button
            onClick={handleSkip}
            className="p-1 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-all"
          >
            <Cross2Icon width={18} height={18} />
          </button>
        </div>

        {/* Progress indicator */}
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-white transition-all duration-300 rounded-full"
                style={{ width: `${((currentStep + 1) / TUTORIAL_STEPS.length) * 100}%` }}
              />
            </div>
            <span className="text-white/60 text-xs font-medium">
              {currentStep + 1} / {TUTORIAL_STEPS.length}
            </span>
          </div>
        </div>

        {/* Navigation buttons */}
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={handlePrevious}
            disabled={isFirstStep}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed text-sm font-medium"
          >
            <ChevronLeftIcon width={16} height={16} />
            Previous
          </button>

          <button
            onClick={handleSkip}
            className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-all text-sm font-medium"
          >
            Skip Tutorial
          </button>

          <button
            onClick={handleNext}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white hover:bg-white/90 text-black transition-all text-sm font-medium"
          >
            {isLastStep ? "Get Started" : "Next"}
            {!isLastStep && <ChevronRightIcon width={16} height={16} />}
          </button>
        </div>
      </div>
    </>
  );
}

// Hook to check if tutorial should be shown
export function shouldShowTutorial(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(STORAGE_KEY) !== "true";
}

// Function to reset tutorial (useful for testing or user preference)
export function resetTutorial() {
  if (typeof window !== "undefined") {
    localStorage.removeItem(STORAGE_KEY);
  }
}
