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
  const [activeTool, setActiveTool] = useState<"select" | "teleport" | "draw" | null>(null);
  const [selectedBuilding, setSelectedBuilding] = useState<SelectedBuilding | null>(null);
  const [drawnArea, setDrawnArea] = useState<DrawnArea | null>(null);
  const [isLoadingAddress, setIsLoadingAddress] = useState(false);
  const [deletedFeatures, setDeletedFeatures] = useState<GeoJSON.Feature[]>([]);

  const activeToolRef = useRef(activeTool);
  useEffect(() => {
    activeToolRef.current = activeTool;
  }, [activeTool]);

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

    setDeletedFeatures(prev => {
      const updated = [...prev, newFeature];

      if (map.current) {
        const source = map.current.getSource("deleted-areas") as mapboxgl.GeoJSONSource;
        if (source) {
          source.setData({
            type: "FeatureCollection",
            features: updated,
          });
        }
      }

      return updated;
    });

    clearSelection();

    // Restart draw mode if still in draw tool
    if (activeToolRef.current === "draw" && drawRef.current) {
      drawRef.current.changeMode("draw_polygon");
    }
  }, [clearSelection]);

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
      });

      map.current.on("click", handleBuildingClick);
    }
  }, [handleBuildingClick, handleDrawCreate]);

  // Update cursor based on active tool
  useEffect(() => {
    if (map.current) {
      const cursor = activeTool === "select" ? "pointer" : activeTool === "draw" ? "crosshair" : "";
      map.current.getCanvas().style.cursor = cursor;
    }
  }, [activeTool]);

  return (
    <div className="relative h-screen w-full">
      <Toolbar activeTool={activeTool} setActiveTool={setActiveTool} />
      {activeTool === "teleport" && (
        <TeleportModal
          onClose={() => setActiveTool(null)}
          onTeleport={handleTeleport}
        />
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
      <div ref={mapContainer} className="h-full w-full" />
    </div>
  );
}
