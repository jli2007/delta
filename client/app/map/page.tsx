"use client";

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

export default function MapPage() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);

  useEffect(() => {
    if (map.current) return; // initialize map only once
    
    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

    if (mapContainer.current) {
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        // Use Mapbox Standard style for clip layer support
        style: "mapbox://styles/mapbox/standard",
        projection: { name: "globe" },
        center: [-74.006, 40.7128], // New York City
        zoom: 15.5,
        pitch: 60, // Tilt the map for 3D view
        bearing: -17.6, // Rotate the map
      });

      // Add navigation controls
      map.current.addControl(new mapboxgl.NavigationControl(), "top-right");

      // Configure 3D buildings when style loads
      map.current.on("style.load", () => {
        if (map.current) {
          // Enable 3D buildings in the Standard style
          map.current.setConfigProperty("basemap", "showPlaceLabels", true);
          map.current.setConfigProperty("basemap", "showRoadLabels", true);
          map.current.setConfigProperty("basemap", "showPointOfInterestLabels", true);
          map.current.setConfigProperty("basemap", "lightPreset", "dusk");
        }
      });
    }
  }, []);

  return (
    <div className="h-screen w-full">
      <div ref={mapContainer} className="h-full w-full" />
    </div>
  );
}
