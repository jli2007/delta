"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css";
import area from "@turf/area";
import bbox from "@turf/bbox";
import { Toolbar } from "@/components/Toolbar";
import { WeatherPanel } from "@/components/WeatherPanel";
import { BuildingDetailsPanel } from "@/components/BuildingDetailsPanel";
import { InsertModelModal } from "@/components/InsertModelModal";
import { AssetManagerPanel } from "@/components/AssetManagerPanel";
import { Prompt3DGenerator } from "@/components/Prompt3DGenerator";
import { TransformGizmo } from "@/components/TransformGizmo";
import { SearchBar } from "@/components/SearchBar";
import { SearchResultPopup } from "@/components/SearchResultPopup";
import { MapControls } from "@/components/MapControls";
import { GitHubLogoIcon } from "@radix-ui/react-icons";

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

interface PendingModel {
  file: File;
  url: string;
  scale: number;
  rotationX: number;
  rotationY: number;
  rotationZ: number;
}

interface InsertedModel {
  id: string;
  name?: string;
  position: [number, number];
  height: number;
  heightLocked: boolean; // When true, height auto-adjusts with scale (0.36 ratio)
  modelUrl: string;
  scale: number;
  rotationX: number;
  rotationY: number;
  rotationZ: number;
}

async function reverseGeocode(
  lng: number,
  lat: number,
  accessToken: string
): Promise<{ name: string; address: string }> {
  try {
    const response = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${accessToken}&types=address,poi`
    );
    const data = await response.json();

    if (data.features && data.features.length > 0) {
      const feature = data.features[0];
      const name = feature.text || "Building";
      const address = feature.place_name || `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
      return { name, address };
    }
  } catch (error) {
    console.error("Geocoding error:", error);
  }

  return {
    name: "Building",
    address: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
  };
}

function calculateMetrics(polygon: GeoJSON.Polygon): { areaM2: number; dimensions: { width: number; depth: number } } {
  const areaM2 = area({ type: "Feature", geometry: polygon, properties: {} });
  const [minLng, minLat, maxLng, maxLat] = bbox({ type: "Feature", geometry: polygon, properties: {} });

  const latMid = (minLat + maxLat) / 2;
  const width = (maxLng - minLng) * 111320 * Math.cos(latMid * Math.PI / 180);
  const depth = (maxLat - minLat) * 111320;

  return { areaM2, dimensions: { width: Math.round(width), depth: Math.round(depth) } };
}

function calculateFrontView(
  polygon: GeoJSON.Polygon
): { center: [number, number]; bearing: number } {
  // Get bounding box center of the polygon
  const coords = polygon.coordinates[0];
  let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
  for (const coord of coords) {
    minLng = Math.min(minLng, coord[0]);
    maxLng = Math.max(maxLng, coord[0]);
    minLat = Math.min(minLat, coord[1]);
    maxLat = Math.max(maxLat, coord[1]);
  }
  const centerLng = (minLng + maxLng) / 2;
  const centerLat = (minLat + maxLat) / 2;

  // Position camera to the SOUTH, looking NORTH at the building
  // Offset ~200m south for a good top-down angled view
  const offset = 0.002;
  return {
    center: [centerLng, centerLat - offset],
    bearing: 0  // Facing north
  };
}

export default function MapPage() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const drawRef = useRef<MapboxDraw | null>(null);
  const [activeTool, setActiveTool] = useState<"select" | "draw" | "insert" | null>(null);
  const [selectedBuilding, setSelectedBuilding] = useState<SelectedBuilding | null>(null);
  const [drawnArea, setDrawnArea] = useState<DrawnArea | null>(null);
  const [isLoadingAddress, setIsLoadingAddress] = useState(false);
  const [deletedFeatures, setDeletedFeatures] = useState<GeoJSON.Feature[]>([]);
  const [showPromptGenerator, setShowPromptGenerator] = useState(false);
  const [lightMode, setLightMode] = useState<"day" | "night">("day");
  const [weather, setWeather] = useState<"clear" | "rain" | "snow">("clear");
  const [redoStack, setRedoStack] = useState<GeoJSON.Feature[]>([]);
  const [pendingModel, setPendingModel] = useState<PendingModel | null>(null);
  const [insertedModels, setInsertedModels] = useState<InsertedModel[]>([]);
  const [isPlacingModel, setIsPlacingModel] = useState(false);
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [gizmoMode, setGizmoMode] = useState<"move" | "rotate">("move");
  const [gizmoScreenPos, setGizmoScreenPos] = useState<{ x: number; y: number } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [previewPosition, setPreviewPosition] = useState<[number, number] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<{
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
    action?: string; // Primary action type from backend
    answer: string;
    coordinates?: [number, number] | null;
    target?: GeoJSON.Feature | null;
    candidates: GeoJSON.Feature[];
    should_fly_to: boolean;
    zoom_level?: number | null;
    // New agentic action payloads
    weather_settings?: { type: "rain" | "snow" | "clear" };
    time_settings?: { preset: "day" | "night" };
    camera_settings?: { zoom_delta?: number; pitch?: number; bearing_delta?: number };
    delete_target?: GeoJSON.Feature;
    qa_data?: Record<string, unknown>;
  } | null>(null);
  
  // Search pin marker
  const searchPinRef = useRef<mapboxgl.Marker | null>(null);

  // Model transform history for undo/redo
  const [modelHistory, setModelHistory] = useState<InsertedModel[]>([]);
  const [modelRedoStack, setModelRedoStack] = useState<InsertedModel[]>([]);
  const modelHistoryRef = useRef(modelHistory);
  const modelRedoStackRef = useRef(modelRedoStack);

  const activeToolRef = useRef(activeTool);
  const deletedFeaturesRef = useRef(deletedFeatures);
  const redoStackRef = useRef(redoStack);
  const pendingModelRef = useRef(pendingModel);
  const insertedModelsRef = useRef(insertedModels);
  const isPlacingModelRef = useRef(isPlacingModel);
  const selectedModelIdRef = useRef(selectedModelId);
  const insertCooldownRef = useRef(false);

  // Wrapper for setActiveTool that prevents rapid Insert modal toggling
  const handleSetActiveTool = (tool: "select" | "draw" | "insert" | null) => {
    // Prevent opening Insert modal during cooldown period
    if (tool === "insert" && insertCooldownRef.current) {
      return;
    }

    // Start cooldown when closing Insert modal
    if (activeTool === "insert" && tool !== "insert") {
      insertCooldownRef.current = true;
      setTimeout(() => {
        insertCooldownRef.current = false;
      }, 200);
      
      // Cancel model placement if switching away from insert tool
      if (isPlacingModel) {
        setPendingModel(null);
        setIsPlacingModel(false);
        setPreviewPosition(null);
      }
    }

    // Hide search pin when switching tools
    if (searchPinRef.current) {
      searchPinRef.current.remove();
      searchPinRef.current = null;
    }
    // Clear search highlight
    if (map.current) {
      const source = map.current.getSource("search-target") as mapboxgl.GeoJSONSource;
      if (source) {
        source.setData({ type: "FeatureCollection", features: [] });
      }
    }
    setSearchResult(null);

    setActiveTool(tool);
  };

  useEffect(() => {
    deletedFeaturesRef.current = deletedFeatures;
  }, [deletedFeatures]);

  useEffect(() => {
    redoStackRef.current = redoStack;
  }, [redoStack]);
  useEffect(() => {
    activeToolRef.current = activeTool;
  }, [activeTool]);

  useEffect(() => {
    pendingModelRef.current = pendingModel;
  }, [pendingModel]);

  useEffect(() => {
    insertedModelsRef.current = insertedModels;
  }, [insertedModels]);

  useEffect(() => {
    isPlacingModelRef.current = isPlacingModel;
  }, [isPlacingModel]);

  useEffect(() => {
    selectedModelIdRef.current = selectedModelId;
  }, [selectedModelId]);

  useEffect(() => {
    modelHistoryRef.current = modelHistory;
  }, [modelHistory]);

  useEffect(() => {
    modelRedoStackRef.current = modelRedoStack;
  }, [modelRedoStack]);

  // Helper to update the deleted areas on the map
  const updateDeletedAreasSource = useCallback((features: GeoJSON.Feature[]) => {
    if (map.current) {
      const source = map.current.getSource("deleted-areas") as mapboxgl.GeoJSONSource;
      if (source) {
        source.setData({
          type: "FeatureCollection",
          features,
        });
      }
    }
  }, []);

  // Save model state before transform for undo
  const saveModelStateForUndo = useCallback(() => {
    if (!selectedModelIdRef.current) return;
    const model = insertedModelsRef.current.find(m => m.id === selectedModelIdRef.current);
    if (model) {
      setModelHistory(prev => [...prev, { ...model }]);
      setModelRedoStack([]); // Clear redo stack on new action
    }
  }, []);

  // Undo - handles both building deletions and model transforms
  const handleUndo = useCallback(() => {
    // First try model transform undo
    const currentModelHistory = modelHistoryRef.current;
    if (currentModelHistory.length > 0) {
      const previousState = currentModelHistory[currentModelHistory.length - 1];
      const currentModel = insertedModelsRef.current.find(m => m.id === previousState.id);

      if (currentModel) {
        // Save current state to redo stack
        setModelRedoStack(prev => [...prev, { ...currentModel }]);

        // Restore previous state
        setInsertedModels(prev => {
          const updated = prev.map(m => m.id === previousState.id ? previousState : m);
          updateModelsSource(updated);
          return updated;
        });

        // Update gizmo position if this model is selected
        if (selectedModelIdRef.current === previousState.id && map.current) {
          const screenPos = map.current.project(previousState.position);
          setGizmoScreenPos({ x: screenPos.x, y: screenPos.y });
        }
      }

      setModelHistory(prev => prev.slice(0, -1));
      return;
    }

    // Fall back to building deletion undo
    const currentDeleted = deletedFeaturesRef.current;
    if (currentDeleted.length === 0) return;

    const lastFeature = currentDeleted[currentDeleted.length - 1];
    const newDeleted = currentDeleted.slice(0, -1);

    setDeletedFeatures(newDeleted);
    setRedoStack(prev => [...prev, lastFeature]);
    updateDeletedAreasSource(newDeleted);
  }, [updateDeletedAreasSource]);

  // Redo - handles both building deletions and model transforms
  const handleRedo = useCallback(() => {
    // First try model transform redo
    const currentModelRedo = modelRedoStackRef.current;
    if (currentModelRedo.length > 0) {
      const nextState = currentModelRedo[currentModelRedo.length - 1];
      const currentModel = insertedModelsRef.current.find(m => m.id === nextState.id);

      if (currentModel) {
        // Save current state to history
        setModelHistory(prev => [...prev, { ...currentModel }]);

        // Apply redo state
        setInsertedModels(prev => {
          const updated = prev.map(m => m.id === nextState.id ? nextState : m);
          updateModelsSource(updated);
          return updated;
        });

        // Update gizmo position if this model is selected
        if (selectedModelIdRef.current === nextState.id && map.current) {
          const screenPos = map.current.project(nextState.position);
          setGizmoScreenPos({ x: screenPos.x, y: screenPos.y });
        }
      }

      setModelRedoStack(prev => prev.slice(0, -1));
      return;
    }

    // Fall back to building deletion redo
    const currentRedo = redoStackRef.current;
    if (currentRedo.length === 0) return;

    const featureToRedo = currentRedo[currentRedo.length - 1];
    const newRedo = currentRedo.slice(0, -1);

    setRedoStack(newRedo);
    setDeletedFeatures(prev => {
      const newDeleted = [...prev, featureToRedo];
      updateDeletedAreasSource(newDeleted);
      return newDeleted;
    });
  }, [updateDeletedAreasSource]);

  // Keyboard shortcuts for undo/redo and escape to deselect
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = /Mac|iPod|iPhone|iPad/.test(navigator.userAgent);
      const modifier = isMac ? e.metaKey : e.ctrlKey;

      if (modifier && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      } else if (modifier && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
        e.preventDefault();
        handleRedo();
      } else if (e.key === "Escape") {
        // Deselect model when pressing Escape
        if (selectedModelIdRef.current) {
          setSelectedModelId(null);
          setGizmoScreenPos(null);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleUndo, handleRedo]);

  const clearSelection = useCallback(() => {
    setSelectedBuilding(null);
    setDrawnArea(null);
    if (map.current) {
      const source = map.current.getSource("selected-building") as mapboxgl.GeoJSONSource;
      if (source) {
        source.setData({ type: "FeatureCollection", features: [] });
      }
    }
    if (drawRef.current) {
      drawRef.current.deleteAll();
    }
  }, []);

  // Show pin marker at coordinates
  const showSearchPin = useCallback((coordinates: [number, number]) => {
    if (!map.current) return;
    
    console.log("Showing search pin at:", coordinates);
    
    // Remove existing pin
    if (searchPinRef.current) {
      searchPinRef.current.remove();
    }
    
    // Create custom pin element
    const pinEl = document.createElement("div");
    pinEl.style.zIndex = "1000";
    pinEl.innerHTML = `
      <div class="search-pin-marker" style="
        display: flex;
        flex-direction: column;
        align-items: center;
        animation: searchPinBounce 0.6s ease-out;
        cursor: pointer;
        filter: drop-shadow(0 4px 8px rgba(0,0,0,0.4));
      ">
        <div style="
          width: 40px;
          height: 40px;
          background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          display: flex;
          align-items: center;
          justify-content: center;
          border: 3px solid white;
          box-shadow: 0 2px 10px rgba(0,0,0,0.3);
        ">
          <svg style="transform: rotate(45deg);" width="18" height="18" viewBox="0 0 24 24" fill="white">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
          </svg>
        </div>
        <div style="
          width: 0;
          height: 0;
          border-left: 8px solid transparent;
          border-right: 8px solid transparent;
          border-top: 12px solid #d97706;
          margin-top: -2px;
        "></div>
      </div>
    `;
    
    // Add bounce animation style
    if (!document.getElementById("search-pin-styles")) {
      const style = document.createElement("style");
      style.id = "search-pin-styles";
      style.textContent = `
        @keyframes searchPinBounce {
          0% { transform: translateY(-80px); opacity: 0; }
          60% { transform: translateY(5px); opacity: 1; }
          80% { transform: translateY(-3px); }
          100% { transform: translateY(0); }
        }
        .search-pin-marker:hover {
          transform: scale(1.1);
          transition: transform 0.2s ease;
        }
        .mapboxgl-marker { z-index: 1000 !important; }
      `;
      document.head.appendChild(style);
    }
    
    searchPinRef.current = new mapboxgl.Marker({
      element: pinEl,
      anchor: "bottom",
      offset: [0, -10],
    })
      .setLngLat(coordinates)
      .addTo(map.current);
      
    console.log("Search pin added successfully");
  }, []);

  // Hide search pin
  const hideSearchPin = useCallback(() => {
    if (searchPinRef.current) {
      searchPinRef.current.remove();
      searchPinRef.current = null;
    }
    // Also clear the search target highlight
    if (map.current) {
      const source = map.current.getSource("search-target") as mapboxgl.GeoJSONSource;
      if (source) {
        source.setData({ type: "FeatureCollection", features: [] });
      }
    }
  }, []);

  // Dispatch agentic actions based on search result
  const dispatchAgentAction = useCallback((result: typeof searchResult) => {
    if (!result || !map.current) return;

    const action = result.action || result.intent?.action;

    switch (action) {
      case "set_weather":
        if (result.weather_settings?.type) {
          const weatherType = result.weather_settings.type as "clear" | "rain" | "snow";
          setWeather(weatherType);

          // Apply directly to map (don't rely on useEffect timing)
          const mapInstance = map.current as any;
          if (weatherType === "rain") {
            mapInstance.setSnow?.(null);
            mapInstance.setRain?.({
              intensity: 0.5,
              color: "rgba(180, 220, 255, 0.5)",
              opacity: 0.8,
              density: 1.0,
              direction: [0, 80],
              centerThinning: 0.5,
            });
          } else if (weatherType === "snow") {
            mapInstance.setRain?.(null);
            mapInstance.setSnow?.({
              intensity: 0.6,
              color: "rgba(255, 255, 255, 0.9)",
              opacity: 0.9,
              density: 0.9,
              direction: [0, 50],
              centerThinning: 0.3,
              vignetteColor: "rgba(200, 220, 255, 0.3)",
            });
          } else {
            mapInstance.setRain?.(null);
            mapInstance.setSnow?.(null);
          }
        }
        break;

      case "set_time":
        if (result.time_settings?.preset) {
          const preset = result.time_settings.preset as "day" | "night";
          setLightMode(preset);

          // Apply directly to map (don't rely on useEffect timing)
          map.current.setConfigProperty("basemap", "lightPreset", preset);
        }
        break;

      case "camera_control":
        if (result.camera_settings) {
          const { zoom_delta, pitch, bearing_delta } = result.camera_settings;
          const currentZoom = map.current.getZoom();
          const currentPitch = map.current.getPitch();
          const currentBearing = map.current.getBearing();

          map.current.easeTo({
            zoom: zoom_delta ? currentZoom + zoom_delta : currentZoom,
            pitch: typeof pitch === "number" ? pitch : currentPitch,
            bearing: bearing_delta ? currentBearing + bearing_delta : currentBearing,
            duration: 1000,
          });
        }
        break;

      case "delete_building":
        if (result.delete_target) {
          const geometry = result.delete_target.geometry;
          if (geometry && geometry.type === "Polygon") {
            const newFeature = result.delete_target as GeoJSON.Feature<GeoJSON.Polygon>;

            // Update React state and directly update map source
            setDeletedFeatures((prev) => {
              const newFeatures = [...prev, newFeature];
              // Directly update map source (don't rely on useEffect timing)
              updateDeletedAreasSource(newFeatures);
              return newFeatures;
            });
          }
        }
        // Fly to front view of deleted building (top-down angled view from south)
        if (result.should_fly_to && result.delete_target?.geometry?.type === "Polygon") {
          const frontView = calculateFrontView(result.delete_target.geometry as GeoJSON.Polygon);
          map.current.flyTo({
            center: frontView.center,
            zoom: result.zoom_level || 17,
            pitch: 45,
            bearing: frontView.bearing,
            duration: 1500,
          });
        } else if (result.should_fly_to && result.coordinates) {
          // Fallback if no polygon available
          map.current.flyTo({
            center: result.coordinates as [number, number],
            zoom: result.zoom_level || 17,
            pitch: 45,
            bearing: 0,
            duration: 1500,
          });
        }
        break;

      case "question":
        // Q&A just displays answer, optionally fly to location
        if (result.should_fly_to && result.coordinates) {
          map.current.flyTo({
            center: result.coordinates as [number, number],
            zoom: result.zoom_level || 16,
            pitch: 45,
            duration: 2000,
          });
        }
        break;

      default:
        // Existing navigation/building search behavior
        if (result.should_fly_to && result.coordinates) {
          map.current.flyTo({
            center: result.coordinates as [number, number],
            zoom: result.zoom_level || 15,
            pitch: 60,
            bearing: -17.6,
            duration: 2000,
          });
        }
    }
  }, [setWeather, setLightMode, setDeletedFeatures, updateDeletedAreasSource]);

  // Handle search
  const handleSearch = useCallback(async () => {
    if (!map.current || !searchQuery.trim()) return;

    setIsSearching(true);

    try {
      // Get viewport bounds and center
      const bounds = map.current.getBounds();
      const center = map.current.getCenter();

      let apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      // Ensure API URL has protocol
      if (!apiUrl.startsWith("http://") && !apiUrl.startsWith("https://")) {
        apiUrl = `http://${apiUrl}`;
      }

      // Use POST with JSON body for the new agentic search
      const response = await fetch(`${apiUrl}/api/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: searchQuery,
          current_bounds: bounds ? {
            south: bounds.getSouth(),
            west: bounds.getWest(),
            north: bounds.getNorth(),
            east: bounds.getEast()
          } : null,
          current_center: center ? [center.lng, center.lat] : null
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: response.statusText }));
        alert(`Search failed: ${errorData.detail || response.statusText}`);
        return;
      }

      const data = await response.json();
      setSearchResult(data);
      setSearchQuery(""); // Clear input for next query

      // Dispatch agent action based on result
      dispatchAgentAction(data);

      // Highlight target building if present (for building searches)
      if (data.target && map.current) {
        const source = map.current.getSource("search-target") as mapboxgl.GeoJSONSource;
        if (source) {
          source.setData({
            type: "FeatureCollection",
            features: [data.target]
          });
        }
      } else if (map.current) {
        // Clear highlight if no target
        const source = map.current.getSource("search-target") as mapboxgl.GeoJSONSource;
        if (source) {
          source.setData({
            type: "FeatureCollection",
            features: []
          });
        }
      }
      
      // Show pin marker at coordinates (for any fly-to action)
      if (data.coordinates && data.should_fly_to) {
        // Small delay to let the fly animation start first
        setTimeout(() => {
          showSearchPin(data.coordinates as [number, number]);
        }, 500);
      } else {
        hideSearchPin();
      }
    } catch (error) {
      console.error("Search error:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      // Check if it's a network error
      let apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      if (!apiUrl.startsWith("http://") && !apiUrl.startsWith("https://")) {
        apiUrl = `http://${apiUrl}`;
      }
      if (errorMessage.includes("Failed to fetch") || errorMessage.includes("NetworkError")) {
        alert(`Cannot connect to backend server. Make sure it's running on ${apiUrl}`);
      } else {
        alert(`Search failed: ${errorMessage}`);
      }
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery, dispatchAgentAction]);

  // Clear selection when tool changes
  useEffect(() => {
    if (activeTool !== "select" && selectedBuilding) {
      setSelectedBuilding(null);
    }
    if (activeTool !== "draw" && drawnArea) {
      setDrawnArea(null);
      if (map.current) {
        const source = map.current.getSource("selected-building") as mapboxgl.GeoJSONSource;
        if (source) {
          source.setData({ type: "FeatureCollection", features: [] });
        }
      }
      if (drawRef.current) {
        drawRef.current.deleteAll();
      }
    }
  }, [activeTool, selectedBuilding, drawnArea]);

  // Handle draw tool mode changes
  useEffect(() => {
    if (!drawRef.current || !map.current) return;

    if (activeTool === "draw") {
      drawRef.current.changeMode("draw_polygon");
    } else {
      drawRef.current.changeMode("simple_select");
    }
  }, [activeTool]);

  // Handle draw create event
  const handleDrawCreate = useCallback((e: { features: GeoJSON.Feature[] }) => {
    const feature = e.features[0];
    if (!feature || feature.geometry.type !== "Polygon") return;

    const polygon = feature.geometry as GeoJSON.Polygon;
    const metrics = calculateMetrics(polygon);

    setDrawnArea({
      polygon,
      areaM2: metrics.areaM2,
      dimensions: metrics.dimensions,
    });

    // Update highlight layer
    if (map.current) {
      const source = map.current.getSource("selected-building") as mapboxgl.GeoJSONSource;
      if (source) {
        source.setData({
          type: "FeatureCollection",
          features: [{ type: "Feature", geometry: polygon, properties: {} }],
        });
      }
    }

    // Clear the drawn feature from MapboxDraw
    setTimeout(() => {
      if (drawRef.current && activeToolRef.current === "draw") {
        drawRef.current.deleteAll();
      }
    }, 50);
  }, []);

  // Handle delete area - add polygon to clip layer
  const handleDeleteArea = useCallback((polygon: GeoJSON.Polygon) => {
    const newFeature: GeoJSON.Feature = {
      type: "Feature",
      geometry: polygon,
      properties: {},
    };

    // Clear redo stack when new deletion is made
    setRedoStack([]);

    setDeletedFeatures(prev => {
      const updated = [...prev, newFeature];
      updateDeletedAreasSource(updated);
      return updated;
    });

    clearSelection();

    // Restart draw mode if still in draw tool
    if (activeToolRef.current === "draw" && drawRef.current) {
      drawRef.current.changeMode("draw_polygon");
    }
  }, [clearSelection, updateDeletedAreasSource]);

  // Handle placing model on map - called from modal
  const handlePlaceModel = useCallback((model: PendingModel) => {
    setPendingModel(model);
    setIsPlacingModel(true);
    setActiveTool(null); // Close modal but stay in placement mode
    
    // Initialize preview position at map center if available
    if (map.current) {
      const center = map.current.getCenter();
      setPreviewPosition([center.lng, center.lat]);
    }
  }, []);

  // Fly to a model's position
  const handleFlyToModel = useCallback((position: [number, number]) => {
    if (map.current) {
      map.current.flyTo({
        center: position,
        zoom: 18,
        pitch: 60,
        duration: 1500,
      });
    }
  }, []);

  // Update the custom models GeoJSON source
  const updateModelsSource = useCallback((models: InsertedModel[]) => {
    const source = map.current?.getSource("custom-models") as mapboxgl.GeoJSONSource;
    if (source) {
      source.setData({
        type: "FeatureCollection",
        features: models.map(m => ({
          type: "Feature" as const,
          properties: {
            "model-uri": m.modelUrl,
            "scale": m.scale,
            "height": m.height,
            "rotationX": m.rotationX,
            "rotationY": m.rotationY,
            "rotationZ": m.rotationZ,
          },
          geometry: {
            type: "Point" as const,
            coordinates: m.position,
          },
        })),
      });
    }
  }, []);

  // Delete a model
  const handleDeleteModel = useCallback((modelId: string) => {
    setInsertedModels(prev => {
      const updated = prev.filter(m => m.id !== modelId);
      updateModelsSource(updated);
      return updated;
    });
  }, [updateModelsSource]);

  // Keyboard shortcut for deleting selected model
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedModelIdRef.current) {
          // Only prevent default if we're actually deleting something
          e.preventDefault();
          handleDeleteModel(selectedModelIdRef.current);
          setSelectedModelId(null);
          setGizmoScreenPos(null);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleDeleteModel]);

  // Update a model's properties
  const handleUpdateModel = useCallback((modelId: string, updates: { name?: string; scale?: number; positionX?: number; positionY?: number; height?: number; heightLocked?: boolean; rotationX?: number; rotationY?: number; rotationZ?: number }) => {
    setInsertedModels(prev => {
      const updated = prev.map(m => {
        if (m.id !== modelId) return m;

        // Handle position updates separately since position is [lng, lat] tuple
        let newModel = { ...m };
        if (updates.name !== undefined) {
          newModel.name = updates.name;
        }
        if (updates.positionX !== undefined) {
          newModel.position = [updates.positionX, newModel.position[1]];
        }
        if (updates.positionY !== undefined) {
          newModel.position = [newModel.position[0], updates.positionY];
        }
        if (updates.heightLocked !== undefined) {
          newModel.heightLocked = updates.heightLocked;
        }
        if (updates.height !== undefined) {
          newModel.height = updates.height;
        }
        if (updates.scale !== undefined) {
          newModel.scale = updates.scale;
          // Auto-adjust height when scale changes if heightLocked is true
          // Keep height at 0 (ground level) when locked
          if (newModel.heightLocked) {
            newModel.height = 0;
          }
        }
        if (updates.rotationX !== undefined) {
          newModel.rotationX = updates.rotationX;
        }
        if (updates.rotationY !== undefined) {
          newModel.rotationY = updates.rotationY;
        }
        if (updates.rotationZ !== undefined) {
          newModel.rotationZ = updates.rotationZ;
        }
        return newModel;
      });
      updateModelsSource(updated);
      return updated;
    });
  }, [updateModelsSource]);

  // Update gizmo screen position for a model
  const updateGizmoPosition = useCallback((modelId: string) => {
    if (!map.current) return;
    const model = insertedModelsRef.current.find(m => m.id === modelId);
    if (model) {
      const screenPos = map.current.project(model.position);
      setGizmoScreenPos({ x: screenPos.x, y: screenPos.y });
    }
  }, []);

  // Select a model for transform
  const selectModel = useCallback((modelId: string | null) => {
    setSelectedModelId(modelId);
    if (modelId) {
      updateGizmoPosition(modelId);
    } else {
      setGizmoScreenPos(null);
    }
  }, [updateGizmoPosition]);

  // Handle gizmo move
  const handleGizmoMove = useCallback((deltaX: number, deltaY: number) => {
    if (!selectedModelIdRef.current || !map.current) return;

    const model = insertedModelsRef.current.find(m => m.id === selectedModelIdRef.current);
    if (!model) return;

    // Convert current position to screen coords, add delta, convert back
    const currentScreen = map.current.project(model.position);
    const newScreen = { x: currentScreen.x + deltaX, y: currentScreen.y + deltaY };
    const newGeo = map.current.unproject([newScreen.x, newScreen.y]);

    setInsertedModels(prev => {
      const updated = prev.map(m =>
        m.id === selectedModelIdRef.current
          ? { ...m, position: [newGeo.lng, newGeo.lat] as [number, number] }
          : m
      );
      updateModelsSource(updated);
      return updated;
    });

    // Update gizmo position
    setGizmoScreenPos(newScreen);
  }, [updateModelsSource]);

  // Handle gizmo rotate (supports all 3 axes)
  const handleGizmoRotate = useCallback((axis: "x" | "y" | "z", newRotation: number) => {
    if (!selectedModelIdRef.current) return;

    setInsertedModels(prev => {
      const updated = prev.map(m => {
        if (m.id !== selectedModelIdRef.current) return m;
        if (axis === "x") return { ...m, rotationX: newRotation };
        if (axis === "y") return { ...m, rotationY: newRotation };
        return { ...m, rotationZ: newRotation };
      });
      updateModelsSource(updated);
      return updated;
    });
  }, [updateModelsSource]);

  // Handle gizmo height change (Y axis in world space)
  const handleGizmoHeightChange = useCallback((deltaHeight: number) => {
    if (!selectedModelIdRef.current) return;

    setInsertedModels(prev => {
      const updated = prev.map(m =>
        m.id === selectedModelIdRef.current
          ? { ...m, height: Math.max(0, m.height + deltaHeight) }
          : m
      );
      updateModelsSource(updated);
      return updated;
    });
  }, [updateModelsSource]);

  // Check if click is near a model (helper function)
  const getModelAtPoint = useCallback((point: { x: number; y: number }): InsertedModel | null => {
    if (!map.current) return null;

    const clickThreshold = 100; // pixels - how close you need to click to a model
    let closestModel: InsertedModel | null = null;
    let closestDistance = Infinity;

    for (const model of insertedModelsRef.current) {
      const modelScreenPos = map.current.project(model.position);
      const distance = Math.sqrt(
        Math.pow(point.x - modelScreenPos.x, 2) +
        Math.pow(point.y - modelScreenPos.y, 2)
      );

      if (distance < clickThreshold && distance < closestDistance) {
        closestDistance = distance;
        closestModel = model;
      }
    }

    return closestModel;
  }, []);

  // Update preview model position on mouse move
  const handleMouseMove = useCallback((e: mapboxgl.MapMouseEvent) => {
    if (isPlacingModelRef.current && pendingModelRef.current) {
      setPreviewPosition([e.lngLat.lng, e.lngLat.lat]);
    }
  }, []);

  // Update preview model source
  const updatePreviewSource = useCallback((position: [number, number] | null, model: PendingModel | null) => {
    if (!map.current) return;
    
    const source = map.current.getSource("model-preview") as mapboxgl.GeoJSONSource;
    if (!source) return;

    if (!position || !model) {
      source.setData({ type: "FeatureCollection", features: [] });
      return;
    }

    // Place model on ground (height = 0) - Mapbox will handle terrain elevation
    // Small offset to ensure model sits on surface
    const groundHeight = 0;
    source.setData({
      type: "FeatureCollection",
      features: [{
        type: "Feature" as const,
        properties: {
          "model-uri": model.url,
          scale: model.scale,
          rotationX: model.rotationX,
          rotationY: model.rotationY,
          rotationZ: model.rotationZ,
          height: groundHeight,
        },
        geometry: {
          type: "Point" as const,
          coordinates: position,
        },
      }],
    });
  }, []);

  // Update preview when position or pending model changes
  useEffect(() => {
    if (isPlacingModel && pendingModel) {
      if (previewPosition) {
        updatePreviewSource(previewPosition, pendingModel);
      }
    } else {
      updatePreviewSource(null, null);
      setPreviewPosition(null);
    }
  }, [isPlacingModel, pendingModel, previewPosition, updatePreviewSource]);

  // Handle map click for model placement
  const handleModelPlacement = useCallback((e: mapboxgl.MapMouseEvent) => {
    if (!isPlacingModelRef.current || !pendingModelRef.current || !map.current) return;

    const pending = pendingModelRef.current;
    // Place model on ground - account for model origin point
    // If model origin is at center, we need a small offset to ensure bottom sits on ground
    // Using a small fraction of scale to approximate model height offset
    // This ensures models sit on the ground surface rather than floating or being underground
    const groundHeight = 0; // Start at ground level - Mapbox handles terrain elevation
    
    const newModel: InsertedModel = {
      id: `model-${Date.now()}`,
      position: [e.lngLat.lng, e.lngLat.lat],
      height: groundHeight,
      heightLocked: false, // Allow manual height adjustment if needed
      modelUrl: pending.url,
      scale: pending.scale,
      rotationX: pending.rotationX,
      rotationY: pending.rotationY,
      rotationZ: pending.rotationZ,
    };

    setInsertedModels(prev => {
      const updated = [...prev, newModel];
      updateModelsSource(updated);
      return updated;
    });

    // Reset placement state and clear preview
    setPendingModel(null);
    setIsPlacingModel(false);
    setPreviewPosition(null);
  }, [updateModelsSource]);

  const handleBuildingClick = useCallback(
    async (e: mapboxgl.MapMouseEvent) => {
      if (!map.current) return;

      // First, check if we clicked on a custom model (works with any tool)
      const clickedModel = getModelAtPoint(e.point);
      if (clickedModel) {
        selectModel(clickedModel.id);
        return;
      }

      // If we have a selected model and clicked elsewhere, deselect it
      if (selectedModelIdRef.current) {
        selectModel(null);
      }

      // Only proceed with building selection if in select mode
      if (activeToolRef.current !== "select") return;

      const lng = e.lngLat.lng;
      const lat = e.lngLat.lat;

      // Query all features at click point
      const features = map.current.queryRenderedFeatures(e.point);

      // Find building features
      const buildingFeature = features.find(
        (f) =>
          f.layer?.id?.includes("building") ||
          f.sourceLayer?.includes("building") ||
          f.layer?.type === "fill-extrusion" ||
          f.layer?.type === "model" ||
          f.layer?.id?.includes("3d")
      );

      // Set initial selection with loading state
      setIsLoadingAddress(true);
      const featureId = buildingFeature?.id || `${lng}-${lat}-${Date.now()}`;

      setSelectedBuilding({
        id: featureId,
        name: "Loading...",
        address: "Loading...",
        coordinates: [lng, lat],
        polygon: null,
      });

      // Get address via reverse geocoding
      const accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";
      const { name, address } = await reverseGeocode(lng, lat, accessToken);

      // Extract polygon from feature geometry if available
      let polygon: GeoJSON.Polygon | null = null;
      if (buildingFeature) {
        if (buildingFeature.geometry.type === "Polygon") {
          polygon = buildingFeature.geometry as GeoJSON.Polygon;
        } else if (buildingFeature.geometry.type === "MultiPolygon") {
          const multiPoly = buildingFeature.geometry as GeoJSON.MultiPolygon;
          polygon = {
            type: "Polygon",
            coordinates: multiPoly.coordinates[0],
          };
        }
      }

      setSelectedBuilding({
        id: featureId,
        name,
        address,
        coordinates: [lng, lat],
        polygon,
      });
      setIsLoadingAddress(false);
    },
    [getModelAtPoint, selectModel]
  );

  useEffect(() => {
    if (map.current) return;

    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

    if (mapContainer.current) {
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: "mapbox://styles/mapbox/standard",
        projection: { name: "globe" },
        center: [-100, 40], // Globe view - North America
        zoom: 1.5,
        pitch: 0,
        bearing: 0,
      });

      // Initialize MapboxDraw
      drawRef.current = new MapboxDraw({
        displayControlsDefault: false,
        defaultMode: "simple_select",
        styles: [
          {
            id: "gl-draw-polygon-fill",
            type: "fill",
            filter: ["all", ["==", "$type", "Polygon"]],
            paint: {
              "fill-color": "#404040",
              "fill-opacity": 0.15,
            },
          },
          {
            id: "gl-draw-polygon-stroke",
            type: "line",
            filter: ["all", ["==", "$type", "Polygon"]],
            paint: {
              "line-color": "#404040",
              "line-width": 2,
            },
          },
          {
            id: "gl-draw-point",
            type: "circle",
            filter: ["all", ["==", "$type", "Point"]],
            paint: {
              "circle-radius": 5,
              "circle-color": "#404040",
            },
          },
          {
            id: "gl-draw-line",
            type: "line",
            filter: ["all", ["==", "$type", "LineString"]],
            paint: {
              "line-color": "#404040",
              "line-width": 2,
              "line-dasharray": [2, 2],
            },
          },
        ],
      });
      map.current.addControl(drawRef.current);

      map.current.on("draw.create", handleDrawCreate);

      map.current.on("style.load", () => {
        if (!map.current) return;

        map.current.setConfigProperty("basemap", "showPlaceLabels", true);
        map.current.setConfigProperty("basemap", "showRoadLabels", true);
        map.current.setConfigProperty("basemap", "showPointOfInterestLabels", true);
        map.current.setConfigProperty("basemap", "lightPreset", lightMode);

        // Add source for selected building highlight
        map.current.addSource("selected-building", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });

        // Add source for search target building
        map.current.addSource("search-target", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });

        // Add source for deleted areas (clip layer)
        map.current.addSource("deleted-areas", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });

        // Add clip layer to erase buildings
        map.current.addLayer({
          id: "building-eraser",
          type: "clip",
          source: "deleted-areas",
          layout: {
            "clip-layer-types": ["model", "symbol"],
            "clip-layer-scope": ["basemap"],
          },
        });

        // Add highlight layers for draw mode
        map.current.addLayer({
          id: "selected-building-fill",
          type: "fill",
          source: "selected-building",
          paint: {
            "fill-color": "#404040",
            "fill-opacity": 0.12,
          },
        });

        map.current.addLayer({
          id: "selected-building-glow",
          type: "line",
          source: "selected-building",
          paint: {
            "line-color": "#404040",
            "line-width": 8,
            "line-opacity": 0.4,
            "line-blur": 3,
          },
        });

        map.current.addLayer({
          id: "selected-building-outline",
          type: "line",
          source: "selected-building",
          paint: {
            "line-color": "#404040",
            "line-width": 2.5,
            "line-opacity": 0.95,
          },
        });

        // Add search target highlight layers
        map.current.addLayer({
          id: "search-target-fill",
          type: "fill",
          source: "search-target",
          paint: {
            "fill-color": "#fbbf24",
            "fill-opacity": 0.4,
          },
        });

        map.current.addLayer({
          id: "search-target-outline",
          type: "line",
          source: "search-target",
          paint: {
            "line-color": "#f59e0b",
            "line-width": 3,
            "line-opacity": 1,
          },
        });

        // Add source for custom 3D models
        map.current.addSource("custom-models", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });

        // Add source for preview model
        map.current.addSource("model-preview", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });

        // Add native model layer for custom 3D models
        try {
          map.current.addLayer({
            id: "custom-models-layer",
            type: "model",
            source: "custom-models",
            layout: {
              "model-id": ["get", "model-uri"],
            },
            paint: {
              "model-opacity": 1,
              "model-rotation": [["get", "rotationX"], ["get", "rotationY"], ["get", "rotationZ"]],
              "model-scale": [["get", "scale"], ["get", "scale"], ["get", "scale"]],
              "model-translation": [0, 0, ["get", "height"]],
              "model-cast-shadows": true,
              "model-emissive-strength": 0.6,
            },
          } as mapboxgl.LayerSpecification);

          // Add preview model layer (semi-transparent)
          map.current.addLayer({
            id: "model-preview-layer",
            type: "model",
            source: "model-preview",
            layout: {
              "model-id": ["get", "model-uri"],
            },
            paint: {
              "model-opacity": 0.5, // Half opacity for preview
              "model-rotation": [["get", "rotationX"], ["get", "rotationY"], ["get", "rotationZ"]],
              "model-scale": [["get", "scale"], ["get", "scale"], ["get", "scale"]],
              "model-translation": [0, 0, ["get", "height"]],
              "model-cast-shadows": false, // No shadows for preview
              "model-emissive-strength": 0.3,
            },
          } as mapboxgl.LayerSpecification);

          // Model Loading failure catch
          map.current.on("error", (e) => {
            const errorMsg = e.error?.message || "";
            if (errorMsg.includes("meshes is not iterable") || errorMsg.includes("t1.json")) {
              console.error("Model loading error - GLB file may be malformed:", e);

              // Find and remove the problematic model
              setInsertedModels(prev => {
                const updated = prev.slice(0, -1);
                updateModelsSource(updated);
                return updated;
              });

              alert("Failed to load 3D model. The generated file may be corrupted. Please try generating again.");
            }
          });
        } catch (err) {
          console.error("Error adding model layer:", err);
        }

      });

      map.current.on("click", handleBuildingClick);
      map.current.on("click", handleModelPlacement);
      map.current.on("mousemove", handleMouseMove);

      // Update gizmo position when map moves
      map.current.on("move", () => {
        if (selectedModelIdRef.current && map.current) {
          const model = insertedModelsRef.current.find(m => m.id === selectedModelIdRef.current);
          if (model) {
            const screenPos = map.current.project(model.position);
            setGizmoScreenPos({ x: screenPos.x, y: screenPos.y });
          }
        }
      });
    }
  }, [handleBuildingClick, handleDrawCreate, handleModelPlacement, handleMouseMove, handleSearch]);

  // Update cursor based on active tool and placement mode
  useEffect(() => {
    if (map.current) {
      let cursor = "";
      if (isPlacingModel) {
        cursor = "crosshair";
      } else if (activeTool === "select") {
        cursor = "pointer";
      } else if (activeTool === "draw") {
        cursor = "crosshair";
      }
      map.current.getCanvas().style.cursor = cursor;
    }
  }, [activeTool, isPlacingModel]);

  // Update light mode (day/night weather)
  useEffect(() => {
    if (map.current && map.current.isStyleLoaded()) {
      map.current.setConfigProperty("basemap", "lightPreset", lightMode);

      // Update selection colors based on light mode
      const selectionColor = lightMode === "day" ? "#404040" : "#d0d0d0";

      // Update selected building layers
      if (map.current.getLayer("selected-building-fill")) {
        map.current.setPaintProperty("selected-building-fill", "fill-color", selectionColor);
      }
      if (map.current.getLayer("selected-building-glow")) {
        map.current.setPaintProperty("selected-building-glow", "line-color", selectionColor);
      }
      if (map.current.getLayer("selected-building-outline")) {
        map.current.setPaintProperty("selected-building-outline", "line-color", selectionColor);
      }

      // Update MapboxDraw layers
      if (map.current.getLayer("gl-draw-polygon-fill.cold")) {
        map.current.setPaintProperty("gl-draw-polygon-fill.cold", "fill-color", selectionColor);
      }
      if (map.current.getLayer("gl-draw-polygon-fill.hot")) {
        map.current.setPaintProperty("gl-draw-polygon-fill.hot", "fill-color", selectionColor);
      }
      if (map.current.getLayer("gl-draw-polygon-stroke.cold")) {
        map.current.setPaintProperty("gl-draw-polygon-stroke.cold", "line-color", selectionColor);
      }
      if (map.current.getLayer("gl-draw-polygon-stroke.hot")) {
        map.current.setPaintProperty("gl-draw-polygon-stroke.hot", "line-color", selectionColor);
      }
      if (map.current.getLayer("gl-draw-point.cold")) {
        map.current.setPaintProperty("gl-draw-point.cold", "circle-color", selectionColor);
      }
      if (map.current.getLayer("gl-draw-point.hot")) {
        map.current.setPaintProperty("gl-draw-point.hot", "circle-color", selectionColor);
      }
      if (map.current.getLayer("gl-draw-line.cold")) {
        map.current.setPaintProperty("gl-draw-line.cold", "line-color", selectionColor);
      }
      if (map.current.getLayer("gl-draw-line.hot")) {
        map.current.setPaintProperty("gl-draw-line.hot", "line-color", selectionColor);
      }
    }
  }, [lightMode]);

  // Update weather effects (rain/snow)
  useEffect(() => {
    if (map.current && map.current.isStyleLoaded()) {
      const mapInstance = map.current as any;
      
      if (weather === "rain") {
        mapInstance.setSnow(null);
        mapInstance.setRain({
          intensity: 0.5,
          color: "rgba(180, 220, 255, 0.5)",
          opacity: 0.8,
          density: 1.0,
          direction: [0, 80],
          centerThinning: 0.5,
        });
      } else if (weather === "snow") {
        mapInstance.setRain(null);
        mapInstance.setSnow({
          intensity: 0.6,
          color: "rgba(255, 255, 255, 0.9)",
          opacity: 0.9,
          density: 0.9,
          direction: [0, 50],
          centerThinning: 0.3,
          vignetteColor: "rgba(200, 220, 255, 0.3)",
        });
      } else {
        // Clear weather
        mapInstance.setRain(null);
        mapInstance.setSnow(null);
      }
    }
  }, [weather]);

  return (
    <div className="relative h-screen w-full">
      {/* GitHub icon - top left */}
      <a
        href="https://github.com/jli2007/delta"
        target="_blank"
        rel="noopener noreferrer"
        className="absolute top-4 left-4 z-10 p-3 rounded-xl bg-black/40 backdrop-blur-md border border-white/10 text-white/60 hover:text-white hover:bg-black/60 transition-all"
      >
        <GitHubLogoIcon width={20} height={20} />
      </a>

      <Toolbar
        activeTool={activeTool}
        setActiveTool={handleSetActiveTool}
        showPromptGenerator={showPromptGenerator}
        onTogglePromptGenerator={() => setShowPromptGenerator(!showPromptGenerator)}
      />
      <WeatherPanel
        lightMode={lightMode}
        onToggleLightMode={() => setLightMode(prev => prev === "day" ? "night" : "day")}
        weather={weather}
        onWeatherChange={setWeather}
      />
      <MapControls map={map.current} />
      {activeTool === "insert" && (
        <InsertModelModal
          onClose={() => handleSetActiveTool(null)}
          onPlaceModel={handlePlaceModel}
        />
      )}
      {isPlacingModel && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 z-20 px-4 py-2 rounded-lg bg-black/60 backdrop-blur-md border border-white/10 text-white text-sm">
          Click on the map to place your model
        </div>
      )}
      {selectedBuilding && (
        <BuildingDetailsPanel
          selectedBuilding={selectedBuilding}
          onClose={clearSelection}
          onDeleteArea={selectedBuilding.polygon ? () => handleDeleteArea(selectedBuilding.polygon!) : undefined}
          onActivateDeleteTool={() => setActiveTool("draw")}
          isLoading={isLoadingAddress}
          accessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN || ""}
        />
      )}
      {drawnArea && (
        <BuildingDetailsPanel
          drawnArea={drawnArea}
          onClose={clearSelection}
          onDeleteArea={() => handleDeleteArea(drawnArea.polygon)}
          accessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN || ""}
        />
      )}
      <AssetManagerPanel
        models={insertedModels}
        onClose={() => {}}
        onFlyTo={handleFlyToModel}
        onDelete={handleDeleteModel}
        onUpdateModel={handleUpdateModel}
      />
      <Prompt3DGenerator
        isVisible={showPromptGenerator}
        onClose={() => setShowPromptGenerator(false)}
        onRequestExpand={() => setShowPromptGenerator(true)}
        onPlaceModel={handlePlaceModel}
      />
      {selectedModelId && gizmoScreenPos && (
        <TransformGizmo
          screenPosition={gizmoScreenPos}
          mode={gizmoMode}
          currentRotation={{
            x: insertedModels.find(m => m.id === selectedModelId)?.rotationX ?? 0,
            y: insertedModels.find(m => m.id === selectedModelId)?.rotationY ?? 0,
            z: insertedModels.find(m => m.id === selectedModelId)?.rotationZ ?? 0,
          }}
          onMoveStart={() => {
            saveModelStateForUndo();
            map.current?.dragPan.disable();
          }}
          onMove={handleGizmoMove}
          onMoveEnd={() => {
            map.current?.dragPan.enable();
          }}
          onHeightChange={handleGizmoHeightChange}
          onRotate={handleGizmoRotate}
          onModeChange={setGizmoMode}
          onDelete={() => {
            if (selectedModelId) {
              handleDeleteModel(selectedModelId);
              setSelectedModelId(null);
              setGizmoScreenPos(null);
            }
          }}
        />
      )}
      {/* Search Result Popup - positioned above search bar */}
      {searchResult && (
        <SearchResultPopup
          result={searchResult}
          onClose={() => {
            setSearchResult(null);
            hideSearchPin();
          }}
          onCandidateClick={(candidate) => {
            // Calculate center of candidate polygon using bbox
            try {
              const [minLng, minLat, maxLng, maxLat] = bbox({ type: "Feature", geometry: candidate.geometry, properties: {} });
              const candidateCenter: [number, number] = [(minLng + maxLng) / 2, (minLat + maxLat) / 2];

              if (map.current) {
                map.current.flyTo({
                  center: candidateCenter,
                  zoom: 17,
                  pitch: 60,
                  bearing: -17.6,
                  duration: 2000,
                });

                // Highlight the candidate building
                const source = map.current.getSource("search-target") as mapboxgl.GeoJSONSource;
                if (source) {
                  source.setData({
                    type: "FeatureCollection",
                    features: [candidate]
                  });
                }
                
                // Show pin at candidate location
                showSearchPin(candidateCenter);

                // Update search result to show this candidate as target
                setSearchResult({
                  ...searchResult,
                  target: candidate,
                  coordinates: candidateCenter,
                });
              }
            } catch (error) {
              console.error("Error calculating candidate center:", error);
            }
          }}
        />
      )}

      {/* Search Bar */}
      <div
        data-search-container
        className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 w-[500px] rounded-2xl bg-black/40 backdrop-blur-md border border-white/10 shadow-xl px-4 py-2"
      >
        <SearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          onSearch={handleSearch}
          isLoading={isSearching}
          placeholder="Search anywhere... (e.g., 'take me to Paris', 'tallest building')"
        />
      </div>
      
      <div ref={mapContainer} className="h-full w-full" />
    </div>
  );
}
