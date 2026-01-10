"use client";

import { useState } from "react";
import {
  Cross2Icon,
  DrawingPinIcon,
  UpdateIcon,
  TrashIcon,
  SizeIcon,
  RulerSquareIcon,
  DimensionsIcon,
  CubeIcon,
} from "@radix-ui/react-icons";

interface SelectedBuilding {
  id: string | number;
  name: string;
  address: string;
  coordinates: [number, number];
  polygon: GeoJSON.Polygon | null;
}

interface DrawnArea {
  polygon: GeoJSON.Polygon;
  areaM2: number;
  dimensions: { width: number; depth: number };
}

interface BuildingDetailsPanelProps {
  selectedBuilding?: SelectedBuilding;
  drawnArea?: DrawnArea;
  onClose: () => void;
  onDeleteArea?: () => void;
  onActivateDeleteTool?: () => void;
  isLoading?: boolean;
  accessToken: string;
}

export function BuildingDetailsPanel({
  selectedBuilding,
  drawnArea,
  onClose,
  onDeleteArea,
  onActivateDeleteTool,
  isLoading = false,
  accessToken,
}: BuildingDetailsPanelProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  const isDrawMode = !!drawnArea;
  const coordinates = selectedBuilding?.coordinates || [0, 0];
  const [lng, lat] = coordinates;
  const staticImageUrl = `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/static/${lng},${lat},17,0,45/400x267@2x?access_token=${accessToken}`;

  // Format area for display
  const formatArea = (m2: number): string => {
    if (m2 >= 10000) {
      return `${(m2 / 10000).toFixed(2)} ha`;
    }
    return `${Math.round(m2).toLocaleString()} m²`;
  };

  return (
    <div className="absolute right-4 top-[45%] -translate-y-1/2 z-10 w-[18vw] min-w-[280px] max-w-[320px] flex flex-col rounded-2xl bg-black/40 backdrop-blur-md border border-white/10 shadow-xl overflow-hidden">
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-3 right-3 z-10 p-1 rounded-full bg-black/40 hover:bg-black/60 text-white/60 hover:text-white transition-all"
      >
        <Cross2Icon width={16} height={16} />
      </button>

      {/* Building satellite image - only show for building selection */}
      {!isDrawMode && (
        <div className="relative w-full aspect-[3/2] bg-gray-800 shrink-0">
          {!imageLoaded && !imageError && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-white/30 text-sm">Loading...</div>
            </div>
          )}
          {imageError ? (
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-700 to-gray-900">
              <div className="text-white/30 text-sm">Image unavailable</div>
            </div>
          ) : (
            <img
              src={staticImageUrl}
              alt="Building aerial view"
              className={`w-full h-full object-cover transition-opacity ${imageLoaded ? "opacity-100" : "opacity-0"}`}
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageError(true)}
            />
          )}
        </div>
      )}

      {/* Content */}
      <div className="p-4">
        {isDrawMode ? (
          // Draw mode content
          <>
            <h3 className="text-white font-semibold text-lg">Selected Area</h3>
            <p className="text-white/50 text-xs mt-0.5 mb-3">Draw selection</p>

            {/* Metrics */}
            <div className="space-y-2 mb-4">
              <div className="flex items-center gap-2 text-white/70 text-sm">
                <RulerSquareIcon width={14} height={14} className="shrink-0 text-white/50" />
                <span>Area: {formatArea(drawnArea.areaM2)}</span>
              </div>
              <div className="flex items-center gap-2 text-white/70 text-sm">
                <DimensionsIcon width={14} height={14} className="shrink-0 text-white/50" />
                <span>
                  {drawnArea.dimensions.width}m × {drawnArea.dimensions.depth}m
                </span>
              </div>
            </div>

            {/* Delete button */}
            <button
              onClick={onDeleteArea}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 hover:text-red-200 transition-all text-sm"
            >
              <TrashIcon width={16} height={16} />
              <span>Delete Buildings</span>
            </button>
          </>
        ) : (
          // Building selection content
          <>
            {isLoading ? (
              <div className="space-y-2">
                <div className="h-6 bg-white/10 rounded animate-pulse w-3/4" />
                <div className="h-4 bg-white/10 rounded animate-pulse w-full" />
              </div>
            ) : (
              <>
                <h3 className="text-white font-semibold text-lg mb-2">
                  {selectedBuilding?.name}
                </h3>
                <div className="flex items-start gap-2 text-white/70 text-sm">
                  <DrawingPinIcon width={14} height={14} className="mt-0.5 shrink-0" />
                  <span>{selectedBuilding?.address}</span>
                </div>
              </>
            )}

            {/* Action buttons */}
            <div className="mt-4 space-y-2">
              <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/80 hover:text-white transition-all text-sm">
                <CubeIcon width={16} height={16} />
                <span>Insert Model</span>
              </button>
              <button
                onClick={() => {
                  if (onActivateDeleteTool) {
                    onActivateDeleteTool();
                    onClose();
                  }
                }}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/80 hover:text-white transition-all text-sm"
              >
                <TrashIcon width={16} height={16} />
                <span>Delete</span>
              </button>
              <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/80 hover:text-white transition-all text-sm">
                <SizeIcon width={16} height={16} />
                <span>Resize</span>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
