"use client";

import { useState, useEffect, useCallback } from "react";
import { 
  PlusIcon, 
  MinusIcon, 
  InfoCircledIcon,
  Cross2Icon,
} from "@radix-ui/react-icons";
import * as Tooltip from "@radix-ui/react-tooltip";

interface MapControlsProps {
  map: mapboxgl.Map | null;
}

export function MapControls({ map }: MapControlsProps) {
  const [is2D, setIs2D] = useState(true);
  const [bearing, setBearing] = useState(0);
  const [zoom, setZoom] = useState(1.5);
  const [showShortcuts, setShowShortcuts] = useState(false);

  // Sync with map state
  useEffect(() => {
    if (!map) return;

    const updateState = () => {
      setBearing(Math.round(map.getBearing()));
      setZoom(Math.round(map.getZoom() * 10) / 10);
      setIs2D(map.getPitch() === 0);
    };

    map.on("move", updateState);
    map.on("pitch", updateState);
    map.on("rotate", updateState);
    map.on("zoom", updateState);

    // Initial sync
    updateState();

    return () => {
      map.off("move", updateState);
      map.off("pitch", updateState);
      map.off("rotate", updateState);
      map.off("zoom", updateState);
    };
  }, [map]);

  const handleZoomIn = useCallback(() => {
    if (!map) return;
    map.zoomIn({ duration: 300 });
  }, [map]);

  const handleZoomOut = useCallback(() => {
    if (!map) return;
    map.zoomOut({ duration: 300 });
  }, [map]);

  const handleResetNorth = useCallback(() => {
    if (!map) return;
    map.easeTo({ bearing: 0, duration: 500 });
  }, [map]);

  const handleToggle2D = useCallback(() => {
    if (!map) return;
    const newIs2D = !is2D;
    setIs2D(newIs2D);
    map.easeTo({ 
      pitch: newIs2D ? 0 : 60, 
      duration: 500 
    });
  }, [map, is2D]);

  return (
    <Tooltip.Provider delayDuration={0}>

      <div className="absolute right-4 bottom-8 z-20 flex flex-col-reverse items-end gap-2">
        {/* Main Controls Row */}
        <div className="flex flex-row items-center gap-2">
          {/* Zoom Controls */}
          <div className="flex flex-row items-center rounded-xl bg-black/40 backdrop-blur-md border border-white/10 overflow-hidden">
            <Tooltip.Root>
              <Tooltip.Trigger asChild>
                <button
                  onClick={handleZoomOut}
                  className="p-3 text-white/60 hover:text-white hover:bg-white/10 transition-all"
                >
                  <MinusIcon width={18} height={18} />
                </button>
              </Tooltip.Trigger>
              <Tooltip.Content
                className="select-none rounded-lg bg-black/80 backdrop-blur-md border border-white/10 px-3 py-1.5 text-xs font-medium text-white shadow-xl z-50"
                side="top"
                sideOffset={5}
              >
                Zoom out
              </Tooltip.Content>
            </Tooltip.Root>
            
            <div className="px-2 text-white/50 text-xs font-medium min-w-[40px] text-center border-x border-white/10">
              {zoom.toFixed(1)}
            </div>
            
            <Tooltip.Root>
              <Tooltip.Trigger asChild>
                <button
                  onClick={handleZoomIn}
                  className="p-3 text-white/60 hover:text-white hover:bg-white/10 transition-all"
                >
                  <PlusIcon width={18} height={18} />
                </button>
              </Tooltip.Trigger>
              <Tooltip.Content
                className="select-none rounded-lg bg-black/80 backdrop-blur-md border border-white/10 px-3 py-1.5 text-xs font-medium text-white shadow-xl z-50"
                side="top"
                sideOffset={5}
              >
                Zoom in
              </Tooltip.Content>
            </Tooltip.Root>
          </div>

          {/* 2D/3D Toggle */}
          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              <button
                onClick={handleToggle2D}
                className={`px-4 py-2.5 rounded-xl font-bold text-sm transition-all border ${
                  is2D
                    ? "bg-white/20 text-white border-white/20"
                    : "bg-black/40 text-white/60 border-white/10 hover:text-white hover:bg-white/10"
                } backdrop-blur-md`}
              >
                {is2D ? "2D" : "3D"}
              </button>
            </Tooltip.Trigger>
            <Tooltip.Content
              className="select-none rounded-lg bg-black/80 backdrop-blur-md border border-white/10 px-3 py-1.5 text-xs font-medium text-white shadow-xl z-50"
              side="top"
              sideOffset={5}
            >
              Switch to {is2D ? "3D" : "2D"} view
            </Tooltip.Content>
          </Tooltip.Root>

          {/* Compass / Reset North */}
          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              <button
                onClick={handleResetNorth}
                className="relative p-2.5 rounded-xl bg-black/40 backdrop-blur-md border border-white/10 text-white/60 hover:text-white hover:bg-white/10 transition-all"
                style={{ transform: `rotate(${-bearing}deg)` }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="12,2 19,21 12,17 5,21" fill="currentColor" opacity="0.3" />
                  <polygon points="12,2 12,17 5,21" fill="#ef4444" opacity="0.9" />
                  <polygon points="12,2 19,21 12,17" fill="white" opacity="0.9" />
                </svg>
              </button>
            </Tooltip.Trigger>
            <Tooltip.Content
              className="select-none rounded-lg bg-black/80 backdrop-blur-md border border-white/10 px-3 py-1.5 text-xs font-medium text-white shadow-xl z-50"
              side="top"
              sideOffset={5}
            >
              Reset to north ({Math.round(bearing)}°)
            </Tooltip.Content>
          </Tooltip.Root>

          {/* Keyboard Shortcuts Info */}
          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              <button
                onClick={() => setShowShortcuts(!showShortcuts)}
                className={`p-2.5 rounded-xl backdrop-blur-md border transition-all ${
                  showShortcuts 
                    ? "bg-white/20 text-white border-white/20" 
                    : "bg-black/40 text-white/60 border-white/10 hover:text-white hover:bg-white/10"
                }`}
              >
                <InfoCircledIcon width={18} height={18} />
              </button>
            </Tooltip.Trigger>
            <Tooltip.Content
              className="select-none rounded-lg bg-black/80 backdrop-blur-md border border-white/10 px-3 py-1.5 text-xs font-medium text-white shadow-xl z-50"
              side="top"
              sideOffset={5}
            >
              Keyboard shortcuts
            </Tooltip.Content>
          </Tooltip.Root>
        </div>

        {/* Keyboard Shortcuts Panel */}
        {showShortcuts && (
          <div className="p-4 rounded-xl bg-black/40 backdrop-blur-md border border-white/10 max-w-[280px]">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-white font-semibold text-sm">Keyboard shortcuts</h4>
              <button
                onClick={() => setShowShortcuts(false)}
                className="p-1 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-all"
              >
                <Cross2Icon width={14} height={14} />
              </button>
            </div>
            <p className="text-white/70 text-xs leading-relaxed mb-3">
              Hold <kbd className="px-1.5 py-0.5 rounded bg-white/20 text-white font-mono text-[10px]">Ctrl</kbd> while dragging to up and down to change viewing angle.
            </p>
            <p className="text-white/70 text-xs leading-relaxed mb-3">
              Hold <kbd className="px-1.5 py-0.5 rounded bg-white/20 text-white font-mono text-[10px]">Ctrl</kbd> while dragging left and right to rotate.
            </p>
          </div>
        )}
      </div>
    </Tooltip.Provider>
  );
}
