"use client";

import { useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

import "./glow.css";

export default function Home() {
  const [currentSection, setCurrentSection] = useState(0);
  const [photoCount, setPhotoCount] = useState(0);
  const [hasAnimated, setHasAnimated] = useState(false);
  const heroSectionRef = useRef<HTMLElement>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const popupRef = useRef<mapboxgl.Popup | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const demoMapContainerRef = useRef<HTMLDivElement>(null);
  const demoMapRef = useRef<mapboxgl.Map | null>(null);

  const handleIntersection = (entries: IntersectionObserverEntry[]) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const sectionId = parseInt(entry.target.getAttribute('data-section-id') || '0');
        setCurrentSection(sectionId);

        // Trigger counting animation when hero section is in view
        if (sectionId === 0 && !hasAnimated) {
          setHasAnimated(true);
          animateCount();
        }
      }
    });
  };

  // Detect initial section on mount/remount
  useEffect(() => {
    const detectCurrentSection = () => {
      const sections = document.querySelectorAll('section[data-section-id]');
      const windowHeight = window.innerHeight;

      sections.forEach((section) => {
        const rect = section.getBoundingClientRect();
        const sectionMiddle = rect.top + rect.height / 2;

        // Check if section middle is in viewport center area
        if (sectionMiddle >= 0 && sectionMiddle <= windowHeight) {
          const sectionId = parseInt(section.getAttribute('data-section-id') || '0');
          setCurrentSection(sectionId);
        }
      });
    };

    // Run detection after a short delay to ensure DOM is ready
    const timer = setTimeout(detectCurrentSection, 100);

    return () => clearTimeout(timer);
  }, []); // Only run on mount

  const animateCount = () => {
    const targetNumber = 100000; // Number of editable buildings across all cities
    const duration = 2000; // 2 seconds
    const steps = 60;
    const increment = targetNumber / steps;
    let currentCount = 0;
    let step = 0;

    const timer = setInterval(() => {
      step++;
      currentCount = Math.min(Math.floor(increment * step), targetNumber);
      setPhotoCount(currentCount);

      if (step >= steps) {
        clearInterval(timer);
        setPhotoCount(targetNumber);
      }
    }, duration / steps);
  };

  const formatNumber = (num: number) => {
    return num.toLocaleString();
  };

  useEffect(() => {
    const observer = new IntersectionObserver(handleIntersection, {
      threshold: 0.3, // Trigger when section is 30% visible
      rootMargin: '-80px 0px' // Adjust for navbar height
    });

    // Observe all sections
    document.querySelectorAll('section[data-section-id]').forEach((section) => {
      observer.observe(section);
    });

    return () => observer.disconnect();
  }, [hasAnimated]); // Include hasAnimated to prevent stale closure

  // Initialize Mapbox map (once)
  useEffect(() => {
    if (mapRef.current || !mapContainerRef.current) return;

    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

    if (!mapboxgl.accessToken) {
      console.warn("Mapbox token not found. Please set NEXT_PUBLIC_MAPBOX_TOKEN environment variable.");
      return;
    }

    // Define base camera settings - centered in middle of SF
    // More central SF coordinates - around Market Street / Financial District area
    const baseCenter: [number, number] = [-122.4050, 37.7840];
    const baseZoom = 13;
    const basePitch = 50;
    let baseBearing = -20; // Starting bearing, will vary

    // SF Attractions interface and array
    interface Attraction {
      name: string;
      coordinates: [number, number];
      icon: string;
      zoom: number;
      pitch: number;
      bearing: number; // Approach angle/bearing for unique rotation
      returnBearing?: number; // Optional return bearing variation
    }

    const attractions: Attraction[] = [
      {
        name: "Chase Center",
        coordinates: [-122.3879, 37.7680],
        icon: "🏀",
        zoom: 16.5,
        pitch: 58,
        bearing: 45, // Approach from southeast
        returnBearing: 225,
      },
      {
        name: "Golden Gate Bridge",
        coordinates: [-122.4783, 37.8199],
        icon: "🌉",
        zoom: 15.5,
        pitch: 52,
        bearing: 315, // Approach from northwest
        returnBearing: 135,
      },
      {
        name: "Transamerica Pyramid",
        coordinates: [-122.4019, 37.7951],
        icon: "🏢",
        zoom: 17,
        pitch: 62,
        bearing: 180, // Approach from south
        returnBearing: 0,
      },
      {
        name: "Alcatraz Island",
        coordinates: [-122.4230, 37.8267],
        icon: "🏝️",
        zoom: 15,
        pitch: 48,
        bearing: 270, // Approach from west
        returnBearing: 90,
      },
      {
        name: "Fisherman's Wharf",
        coordinates: [-122.4168, 37.8080],
        icon: "🐟",
        zoom: 16,
        pitch: 56,
        bearing: 135, // Approach from northeast
        returnBearing: 315,
      },
    ];

    let currentAttractionIndex = 0;

    // Start with lower zoom to hide buildings, then animate in
    // Centered in middle of SF (Market Street / Financial District area)
    mapRef.current = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: "mapbox://styles/mapbox/standard", // Standard style with 3D buildings
      center: baseCenter, // Centered in middle of SF
      zoom: 11, // Start zoomed out (buildings less visible)
      pitch: 35, // Lower pitch initially
      bearing: baseBearing, // Starting bearing
      interactive: false, // Non-interactive background
      attributionControl: false,
    });

    // Animate buildings popping up in 3D
    const animateBuildings = () => {
      if (!mapRef.current) return;

      // Wait a moment for map to stabilize, then animate
      setTimeout(() => {
        if (!mapRef.current) return;

        // Animate zoom and pitch to reveal 3D buildings with smooth ease-out
        // Also rotate to base bearing for variety
        mapRef.current.easeTo({
          center: baseCenter,
          zoom: baseZoom,
          pitch: basePitch,
          bearing: baseBearing,
          duration: 2000,
        });

        // Start attraction sequence after initial building animation completes
        setTimeout(() => {
          startAttractionSequence();
        }, 2000);
      }, 300);
    };

    // Show popup and visit attractions sequentially
    const visitAttraction = (attraction: Attraction, index: number) => {
      if (!mapRef.current) return;

      // Remove previous popup
      if (popupRef.current) {
        popupRef.current.remove();
        popupRef.current = null;
      }

      // Pause continuous movement during animation
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }

      // Create popup for this attraction
      popupRef.current = new mapboxgl.Popup({
        closeButton: false,
        closeOnClick: false,
        anchor: 'bottom',
        offset: [0, -15],
        className: 'building-popup',
        maxWidth: 'none',
      })
        .setLngLat(attraction.coordinates)
        .setHTML(`
          <div class="building-popup-content" style="
            display: flex;
            align-items: center;
            gap: 10px;
            color: white;
          ">
            <div style="font-size: 20px;">${attraction.icon}</div>
            <div style="
              font-size: 14px;
              font-weight: 600;
              color: #ffffff;
            ">${attraction.name}</div>
          </div>
        `)
        .addTo(mapRef.current);

      // Fade in popup
      const popupElement = document.querySelector('.building-popup') as HTMLElement;
      if (popupElement) {
        popupElement.style.opacity = '0';
        popupElement.style.transition = 'opacity 1s ease-in-out';
        setTimeout(() => {
          popupElement.style.opacity = '1';
        }, 100);
      }

      // Step 1: Fly to attraction with unique bearing/rotation for varied approach (per Mapbox docs)
      // Each attraction approached from different direction for uniqueness
      mapRef.current.flyTo({
        center: attraction.coordinates,
        zoom: attraction.zoom,
        pitch: attraction.pitch,
        bearing: attraction.bearing, // Unique rotation angle for each attraction
        duration: 2000, // 2 seconds to fly in
        // flyTo creates smooth arc path automatically
      });

      // Step 2: Rotate 360 degrees around the building
      setTimeout(() => {
        if (!mapRef.current) return;

        // Get current bearing and rotate 360 degrees around the building
        const currentBearing = mapRef.current.getBearing();
        const targetBearing = (currentBearing + 360) % 360;

        // Rotate 360 degrees while keeping center on building
        mapRef.current.easeTo({
          center: attraction.coordinates, // Keep center on building
          zoom: attraction.zoom, // Keep zoom level
          pitch: attraction.pitch, // Keep pitch
          bearing: targetBearing, // Rotate 360 degrees
          duration: 4000, // 4 seconds for smooth 360 rotation
        });

        // Step 3: After 360 rotation completes, hold briefly then zoom out
        setTimeout(() => {
          if (!mapRef.current) return;

          // Step 4: Zoom back out with VARIED center position and rotation for uniqueness
          // Each zoom-out goes to a slightly different center point to avoid repetition
          const nextIndex = (currentAttractionIndex + 1) % attractions.length;
          const nextAttraction = attractions[nextIndex];
          
          // Calculate dynamic return bearing with variation
          const baseReturnBearing = attraction.returnBearing ?? 
            ((nextAttraction.bearing + 180) % 360);
          const variation = (index * 30) % 60 - 30; // Rotates through -30 to +30
          const returnBearing = (baseReturnBearing + variation + 360) % 360;
          
          // Vary the return center position - offset based on attraction and cycle
          // This makes each zoom-out feel unique instead of always going to same center
          const cycleOffset = Math.floor(currentAttractionIndex / attractions.length);
          const angleOffset = (index * 72 + cycleOffset * 36) * (Math.PI / 180); // 72° per attraction, 36° per cycle
          const distanceOffset = 0.008; // ~800m offset in degrees
          const offsetLng = Math.cos(angleOffset) * distanceOffset;
          const offsetLat = Math.sin(angleOffset) * distanceOffset;
          const variedCenter: [number, number] = [
            baseCenter[0] + offsetLng,
            baseCenter[1] + offsetLat
          ];
          
          // Also vary zoom and pitch slightly for more uniqueness
          const zoomVariation = (index % 3) * 0.3 - 0.3; // -0.3, 0, +0.3
          const pitchVariation = (index % 4) * 2 - 3; // -3, -1, +1, +3
          const variedZoom = baseZoom + zoomVariation;
          const variedPitch = Math.max(45, Math.min(55, basePitch + pitchVariation));
          
          // Use flyTo for more dramatic, varied return path
          mapRef.current.flyTo({
            center: variedCenter, // Different center each time!
            zoom: variedZoom, // Slightly varied zoom
            pitch: variedPitch, // Slightly varied pitch
            bearing: returnBearing, // Varied return rotation
            duration: 2000, // 2 seconds to return
            // flyTo creates arc path for more interesting return journey
          });

          // Step 5: After returning, move to next attraction
          setTimeout(() => {
            if (!mapRef.current) return;

            // Remove popup
            if (popupRef.current) {
              popupRef.current.remove();
              popupRef.current = null;
            }

            // Move to next attraction
            currentAttractionIndex = (currentAttractionIndex + 1) % attractions.length;
            
            // Update base bearing slightly each cycle for continuous variation
            // This makes each complete cycle unique
            if (currentAttractionIndex === 0) {
              baseBearing = (baseBearing + 15) % 360; // Rotate 15 degrees each full cycle
            }
            
            // Small delay before next attraction
            setTimeout(() => {
              if (mapRef.current) {
                visitAttraction(attractions[currentAttractionIndex], currentAttractionIndex);
              }
            }, 1000);
          }, 2000);
        }, 1000); // Brief hold after 360 rotation (1 second)
      }, 500); // Small delay after zoom in before starting rotation
    };

    // Start the attraction sequence
    const startAttractionSequence = () => {
      if (!mapRef.current || attractions.length === 0) return;
      
      // Wait a bit after initial building animation, then start sequence
      setTimeout(() => {
        visitAttraction(attractions[currentAttractionIndex], currentAttractionIndex);
      }, 2000);
    };

    // Start continuous subtle camera movement with smooth transitions
    const startContinuousMovement = () => {
      if (!mapRef.current) return;

      let baseBearing = mapRef.current.getBearing();
      let basePitch = mapRef.current.getPitch();
      let time = 0;
      let lastUpdateTime = Date.now();
      const updateInterval = 500; // Update every 500ms for smooth movement

      const updateCamera = () => {
        if (!mapRef.current) return;

        const now = Date.now();
        const deltaTime = now - lastUpdateTime;

        // Only update every 500ms to allow smooth easing
        if (deltaTime >= updateInterval) {
          time += 0.02; // Slow animation speed
          
          // Calculate target positions using smooth sinusoidal functions
          const rotation = Math.sin(time) * 15; // ±15 degrees rotation
          const targetBearing = baseBearing + rotation;

          const pitchVariation = Math.sin(time * 0.7) * 3; // ±3 degrees pitch
          const targetPitch = Math.max(45, Math.min(55, basePitch + pitchVariation));

          // Use easeTo for smooth transitions (3 second duration for continuous smooth movement)
          mapRef.current.easeTo({
            bearing: targetBearing,
            pitch: targetPitch,
            duration: 3000,
          });

          lastUpdateTime = now;
        }

        animationFrameRef.current = requestAnimationFrame(updateCamera);
      };

      // Start the animation loop
      updateCamera();
    };

    // Wait for map to load before applying styles and animations
    mapRef.current.once("style.load", () => {
      if (mapRef.current) {
        mapRef.current.setConfigProperty("basemap", "showPlaceLabels", true);
        mapRef.current.setConfigProperty("basemap", "showRoadLabels", true);
        mapRef.current.setConfigProperty("basemap", "lightPreset", "dusk");
        
        // Wait a bit for layers to fully load, then animate buildings
        setTimeout(() => {
          animateBuildings();
        }, 500);
      }
    });

    return () => {
      // Cleanup animation frame
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      
      // Remove popup
      if (popupRef.current) {
        popupRef.current.remove();
        popupRef.current = null;
      }
      
      // Remove map
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []); // Only run once on mount

  // Initialize demo map for Mapbox section
  useEffect(() => {
    if (demoMapRef.current || !demoMapContainerRef.current) return;

    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

    if (!mapboxgl.accessToken) {
      console.warn("Mapbox token not found. Please set NEXT_PUBLIC_MAPBOX_TOKEN environment variable.");
      return;
    }

    // Initialize a simpler interactive map for the demo
    demoMapRef.current = new mapboxgl.Map({
      container: demoMapContainerRef.current,
      style: "mapbox://styles/mapbox/standard",
      center: [-79.3832, 43.6532], // Downtown Toronto
      zoom: 14,
      pitch: 55,
      bearing: -20,
      interactive: true,
      attributionControl: false,
    });

    // Add navigation controls
    const nav = new mapboxgl.NavigationControl({
      showCompass: true,
      showZoom: true,
    });
    demoMapRef.current.addControl(nav, "top-right");

    return () => {
      if (demoMapRef.current) {
        demoMapRef.current.remove();
        demoMapRef.current = null;
      }
    };
  }, []);

  // Adjust map based on current section for parallax effect
  // Note: This will temporarily pause continuous movement during section changes
  useEffect(() => {
    if (!mapRef.current) return;

    // Cancel continuous movement during section change
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    const zoom = 13 + currentSection * 0.3;
    const pitch = 50 + currentSection * 3;

    mapRef.current.easeTo({
      zoom: Math.min(zoom, 15),
      pitch: Math.min(pitch, 65),
      duration: 1000,
    });

    // Restart continuous movement after section transition with smooth easing
    setTimeout(() => {
      if (mapRef.current && !animationFrameRef.current) {
        let baseBearing = mapRef.current.getBearing();
        let basePitch = mapRef.current.getPitch();
        let time = 0;
        let lastUpdateTime = Date.now();
        const updateInterval = 500; // Update every 500ms for smooth movement

        const updateCamera = () => {
          if (!mapRef.current) return;

          const now = Date.now();
          const deltaTime = now - lastUpdateTime;

          // Only update every 500ms to allow smooth easing
          if (deltaTime >= updateInterval) {
            time += 0.02;
            
            const rotation = Math.sin(time) * 15;
            const targetBearing = baseBearing + rotation;

            const pitchVariation = Math.sin(time * 0.7) * 3;
            const adjustedBasePitch = 50 + currentSection * 3;
            const targetPitch = Math.max(45, Math.min(65, adjustedBasePitch + pitchVariation));

            // Use easeTo for smooth transitions
            mapRef.current.easeTo({
              bearing: targetBearing,
              pitch: targetPitch,
              duration: 3000,
            });

            lastUpdateTime = now;
          }

          animationFrameRef.current = requestAnimationFrame(updateCamera);
        };

        updateCamera();
      }
    }, 1000);
  }, [currentSection]);

  return (
    <div className="relative h-screen overflow-y-auto snap-y snap-mandatory scroll-smooth">
      {/* Background Map - City View */}
      <div className="fixed inset-0 z-0">
        <div ref={mapContainerRef} className="w-full h-full" />
        {/* Overlay gradient for better text readability */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/70 pointer-events-none" />
        {/* Vignette Effect */}
        <div className="vignette" />
      </div>

      {/* Navigation */}
      {/* <Navbar currentSection={currentSection} /> */}

      {/* Hero Section with Map */}
    <section ref={heroSectionRef} data-section-id="0" className="relative min-h-screen">
        <div className="absolute inset-0 pointer-events-none" />
        <div className="absolute inset-0 z-50 flex items-center">
          <div className="container mx-auto">
            <div className="max-w-4xl px-4">
              <h1 className="text-4xl md:text-5xl font-bold mb-4 leading-tight text-left">
                <span className="text-white">
                  Build Cities.
                </span>
                <br />
                <span className="text-white/90">
                  Replace Buildings.
                </span>
              </h1>
              <p className="text-base md:text-lg text-white/80 text-left max-w-xl mb-6 leading-relaxed">
                Edit layouts, swap structures, visualize changes in real-time.
              </p>
              <div className="mt-6 flex gap-4">
                <Button size="default" className="bg-white text-black hover:bg-white/95 font-medium px-8 py-6 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 border-0" asChild>
                  <a href="/map">Start Building</a>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" data-section-id="2" className="relative bg-gray-50 min-h-screen flex items-center py-32">
        <div className="container mx-auto px-6 max-w-5xl">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-16">
              <div className="inline-block px-4 py-2 rounded-full bg-black text-white text-xs font-semibold uppercase tracking-wider mb-6">
                About
              </div>
              <h2 className="text-5xl md:text-6xl font-bold mb-6 text-black leading-tight">
                Transforming Urban Planning
              </h2>
            </div>

            <div className="prose prose-lg max-w-none">
              <p className="text-xl text-gray-700 mb-8 leading-relaxed">
                Arcki is a comprehensive platform for real-time city editing and architectural visualization. Built on advanced 3D mapping technology, we enable urban planners, architects, and developers to visualize, modify, and plan city infrastructure with unprecedented precision.
              </p>

              <p className="text-lg text-gray-600 mb-8 leading-relaxed">
                Our platform combines photorealistic 3D mapping with intelligent AI-powered tools, allowing professionals to generate building designs, modify existing structures, and explore urban development scenarios in real-time. Every change is rendered instantly, providing immediate visual feedback for informed decision-making.
              </p>

              <div className="grid md:grid-cols-2 gap-12 mt-16">
                <div>
                  <h3 className="text-2xl font-bold mb-4 text-black">Mission</h3>
                  <p className="text-gray-600 leading-relaxed">
                    To democratize access to professional-grade urban planning tools, making sophisticated 3D city modeling accessible to professionals and organizations of all sizes.
                  </p>
                </div>
                <div>
                  <h3 className="text-2xl font-bold mb-4 text-black">Technology</h3>
                  <p className="text-gray-600 leading-relaxed">
                    Powered by Mapbox's advanced 3D rendering engine and integrated AI services, our platform delivers enterprise-level capabilities with intuitive, user-friendly interfaces.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section 2 - Mapbox Demo */}
      <section id="ai-powered" data-section-id="3" className="relative bg-white min-h-screen flex items-center py-32">
        <div className="container mx-auto px-6 max-w-6xl">
          {/* Header Section */}
          <div className="text-center mb-16">
            <div className="inline-block px-4 py-2 rounded-full bg-black text-white text-xs font-semibold uppercase tracking-wider mb-6">
              Powered by Mapbox
            </div>
            <h2 className="text-5xl md:text-7xl font-bold mb-6 text-black leading-tight">
              Photorealistic
              <br />
              <span className="text-gray-600">City Maps</span>
            </h2>
            <p className="text-xl text-gray-500 max-w-2xl mx-auto leading-relaxed">
              Experience cities in unprecedented detail. Every building, street, and landmark rendered in stunning 3D precision.
            </p>
          </div>

          {/* Map Container - Larger and Prominent */}
          <div className="mb-16">
            <div className="relative w-full h-[600px] rounded-3xl overflow-hidden bg-gray-100 border-2 border-gray-200 shadow-2xl">
              <div ref={demoMapContainerRef} className="w-full h-full" />
            </div>
          </div>

          {/* Feature Grid - Horizontal Layout */}
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center md:text-left">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 mb-4">
                <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
              </div>
              <h3 className="text-xl font-bold mb-3 text-black">3D Buildings</h3>
              <p className="text-gray-600 leading-relaxed">
                Every structure accurately modeled with real-world dimensions and architectural details.
              </p>
            </div>

            <div className="text-center md:text-left">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 mb-4">
                <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold mb-3 text-black">Global Coverage</h3>
              <p className="text-gray-600 leading-relaxed">
                Explore cities worldwide with consistent high-quality 3D data and real-time updates.
              </p>
            </div>

            <div className="text-center md:text-left">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 mb-4">
                <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold mb-3 text-black">Real-Time</h3>
              <p className="text-gray-600 leading-relaxed">
                Smooth, responsive interactions powered by advanced WebGL rendering technology.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative bg-black text-white py-12">
        <div className="container mx-auto px-6 max-w-6xl">
          <div className="grid md:grid-cols-3 gap-8 mb-8">
            <div>
              <h3 className="text-lg font-semibold mb-4">arcki.tech</h3>
              <p className="text-gray-400 text-sm">Real-time City Editor</p>
            </div>
            <div>
              <h4 className="text-sm font-semibold mb-4 uppercase tracking-wider">Navigation</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><a href="#hero" className="hover:text-white transition-colors">Home</a></li>
                <li><a href="#ai-powered" className="hover:text-white transition-colors">Features</a></li>
                <li><a href="#about" className="hover:text-white transition-colors">About</a></li>
                <li><a href="/map" className="hover:text-white transition-colors">Map</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold mb-4 uppercase tracking-wider">Contact</h4>
              <p className="text-sm text-gray-400">© {new Date().getFullYear()} All rights reserved</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}