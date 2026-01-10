"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css";
import area from "@turf/area";
import bbox from "@turf/bbox";
import { Toolbar } from "@/components/Toolbar";
import { BuildingDetailsPanel } from "@/components/BuildingDetailsPanel";
import { TeleportModal } from "@/components/TeleportModal";
import { InsertModelModal } from "@/components/InsertModelModal";
import { AssetManagerPanel } from "@/components/AssetManagerPanel";
import { Prompt3DGenerator } from "@/components/Prompt3DGenerator";

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
  position: [number, number];
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

export default function MapPage() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const drawRef = useRef<MapboxDraw | null>(null);
  const [activeTool, setActiveTool] = useState<"select" | "teleport" | "draw" | "insert" | null>(null);
  const [selectedBuilding, setSelectedBuilding] = useState<SelectedBuilding | null>(null);
  const [drawnArea, setDrawnArea] = useState<DrawnArea | null>(null);
  const [isLoadingAddress, setIsLoadingAddress] = useState(false);
  const [deletedFeatures, setDeletedFeatures] = useState<GeoJSON.Feature[]>([]);
  const [showPromptGenerator, setShowPromptGenerator] = useState(false);
  const [redoStack, setRedoStack] = useState<GeoJSON.Feature[]>([]);
  const [pendingModel, setPendingModel] = useState<PendingModel | null>(null);
  const [insertedModels, setInsertedModels] = useState<InsertedModel[]>([]);
  const [isPlacingModel, setIsPlacingModel] = useState(false);
  const [showAssetManager, setShowAssetManager] = useState(false);

  const activeToolRef = useRef(activeTool);
  const deletedFeaturesRef = useRef(deletedFeatures);
  const redoStackRef = useRef(redoStack);
  const pendingModelRef = useRef(pendingModel);
  const insertedModelsRef = useRef(insertedModels);
  const isPlacingModelRef = useRef(isPlacingModel);

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

  // Undo last deletion
  const handleUndo = useCallback(() => {
    const currentDeleted = deletedFeaturesRef.current;
    if (currentDeleted.length === 0) return;

    const lastFeature = currentDeleted[currentDeleted.length - 1];
    const newDeleted = currentDeleted.slice(0, -1);

    setDeletedFeatures(newDeleted);
    setRedoStack(prev => [...prev, lastFeature]);
    updateDeletedAreasSource(newDeleted);
  }, [updateDeletedAreasSource]);

  // Redo last undone deletion
  const handleRedo = useCallback(() => {
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

  // Keyboard shortcuts for undo/redo
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

  const handleTeleport = useCallback((coordinates: [number, number]) => {
    if (map.current) {
      map.current.flyTo({
        center: coordinates,
        zoom: 15.5,
        pitch: 60,
        bearing: -17.6,
        duration: 2000,
      });
    }
    setActiveTool(null);
  }, []);

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

  // Update a model's scale or rotation
  const handleUpdateModel = useCallback((modelId: string, updates: { scale?: number; rotationX?: number; rotationY?: number; rotationZ?: number }) => {
    setInsertedModels(prev => {
      const updated = prev.map(m =>
        m.id === modelId ? { ...m, ...updates } : m
      );
      updateModelsSource(updated);
      return updated;
    });
  }, [updateModelsSource]);

  // Handle map click for model placement
  const handleModelPlacement = useCallback((e: mapboxgl.MapMouseEvent) => {
    if (!isPlacingModelRef.current || !pendingModelRef.current || !map.current) return;

    const pending = pendingModelRef.current;
    const newModel: InsertedModel = {
      id: `model-${Date.now()}`,
      position: [e.lngLat.lng, e.lngLat.lat],
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

    // Reset placement state and show asset manager
    setPendingModel(null);
    setIsPlacingModel(false);
    setShowAssetManager(true);
  }, [updateModelsSource]);

  const handleBuildingClick = useCallback(
    async (e: mapboxgl.MapMouseEvent) => {
      if (activeToolRef.current !== "select" || !map.current) return;

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
    []
  );

  useEffect(() => {
    if (map.current) return;

    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

    if (mapContainer.current) {
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: "mapbox://styles/mapbox/standard",
        projection: { name: "globe" },
        center: [-74.006, 40.7128],
        zoom: 15.5,
        pitch: 60,
        bearing: -17.6,
      });

      map.current.addControl(new mapboxgl.NavigationControl(), "top-right");

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
              "fill-color": "#00ffff",
              "fill-opacity": 0.15,
            },
          },
          {
            id: "gl-draw-polygon-stroke",
            type: "line",
            filter: ["all", ["==", "$type", "Polygon"]],
            paint: {
              "line-color": "#00ffff",
              "line-width": 2,
            },
          },
          {
            id: "gl-draw-point",
            type: "circle",
            filter: ["all", ["==", "$type", "Point"]],
            paint: {
              "circle-radius": 5,
              "circle-color": "#00ffff",
            },
          },
          {
            id: "gl-draw-line",
            type: "line",
            filter: ["all", ["==", "$type", "LineString"]],
            paint: {
              "line-color": "#00ffff",
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
        map.current.setConfigProperty("basemap", "lightPreset", "dusk");

        // Add source for selected building highlight
        map.current.addSource("selected-building", {
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
            "fill-color": "#00ffff",
            "fill-opacity": 0.12,
          },
        });

        map.current.addLayer({
          id: "selected-building-glow",
          type: "line",
          source: "selected-building",
          paint: {
            "line-color": "#00ffff",
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
            "line-color": "#7fffff",
            "line-width": 2.5,
            "line-opacity": 0.95,
          },
        });

        // Add source for custom 3D models
        map.current.addSource("custom-models", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });

        // Add native model layer for custom 3D models
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
            "model-cast-shadows": true,
            "model-emissive-strength": 0.6,
          },
        } as mapboxgl.LayerSpecification);
      });

      map.current.on("click", handleBuildingClick);
      map.current.on("click", handleModelPlacement);
    }
  }, [handleBuildingClick, handleDrawCreate, handleModelPlacement]);

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

  return (
    <div className="relative h-screen w-full">
      <Toolbar
          activeTool={activeTool}
          setActiveTool={setActiveTool}
          showAssetManager={showAssetManager}
          onToggleAssetManager={() => setShowAssetManager(!showAssetManager)}
          showPromptGenerator={showPromptGenerator}
          onTogglePromptGenerator={() => setShowPromptGenerator(!showPromptGenerator)}
        />
      {activeTool === "teleport" && (
        <TeleportModal
          onClose={() => setActiveTool(null)}
          onTeleport={handleTeleport}
        />
      )}
      {activeTool === "insert" && (
        <InsertModelModal
          onClose={() => setActiveTool(null)}
          onPlaceModel={handlePlaceModel}
        />
      )}
      {isPlacingModel && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 px-4 py-2 rounded-lg bg-black/60 backdrop-blur-md border border-white/10 text-white text-sm">
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
      {showAssetManager && (
        <AssetManagerPanel
          models={insertedModels}
          onClose={() => setShowAssetManager(false)}
          onFlyTo={handleFlyToModel}
          onDelete={handleDeleteModel}
          onUpdateModel={handleUpdateModel}
        />
      )}
      {showPromptGenerator && (
        <Prompt3DGenerator
          onClose={() => setShowPromptGenerator(false)}
          onGenerate={(prompt) => {
            console.log("Generated prompt:", prompt);
            // TODO: Integrate with 3D generation API
            // For now, just log it
          }}
        />
      )}
      <div ref={mapContainer} className="h-full w-full" />
    </div>
  );
}
