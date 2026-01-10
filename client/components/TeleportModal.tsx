"use client";

import { useState, useEffect, useRef } from "react";
import { Cross2Icon, MagnifyingGlassIcon } from "@radix-ui/react-icons";

interface City {
  name: string;
  country: string;
  coordinates: [number, number];
}

const POPULAR_CITIES: City[] = [
  { name: "New York City", country: "USA", coordinates: [-74.006, 40.7128] },
  { name: "London", country: "UK", coordinates: [-0.1276, 51.5074] },
  { name: "Tokyo", country: "Japan", coordinates: [139.6917, 35.6895] },
  { name: "Paris", country: "France", coordinates: [2.3522, 48.8566] },
  { name: "Dubai", country: "UAE", coordinates: [55.2708, 25.2048] },
  { name: "Sydney", country: "Australia", coordinates: [151.2093, -33.8688] },
  { name: "Singapore", country: "Singapore", coordinates: [103.8198, 1.3521] },
  { name: "San Francisco", country: "USA", coordinates: [-122.4194, 37.7749] },
  { name: "Los Angeles", country: "USA", coordinates: [-118.2437, 34.0522] },
];

const ALL_CITIES: City[] = [
  ...POPULAR_CITIES,
  // North America
  { name: "San Francisco", country: "USA", coordinates: [-122.4194, 37.7749] },
  { name: "Chicago", country: "USA", coordinates: [-87.6298, 41.8781] },
  { name: "Miami", country: "USA", coordinates: [-80.1918, 25.7617] },
  { name: "Las Vegas", country: "USA", coordinates: [-115.1398, 36.1699] },
  { name: "Seattle", country: "USA", coordinates: [-122.3321, 47.6062] },
  { name: "Boston", country: "USA", coordinates: [-71.0589, 42.3601] },
  { name: "Washington DC", country: "USA", coordinates: [-77.0369, 38.9072] },
  { name: "Toronto", country: "Canada", coordinates: [-79.3832, 43.6532] },
  { name: "Vancouver", country: "Canada", coordinates: [-123.1207, 49.2827] },
  { name: "Mexico City", country: "Mexico", coordinates: [-99.1332, 19.4326] },
  // Europe
  { name: "Berlin", country: "Germany", coordinates: [13.4050, 52.5200] },
  { name: "Rome", country: "Italy", coordinates: [12.4964, 41.9028] },
  { name: "Barcelona", country: "Spain", coordinates: [2.1734, 41.3851] },
  { name: "Madrid", country: "Spain", coordinates: [-3.7038, 40.4168] },
  { name: "Amsterdam", country: "Netherlands", coordinates: [4.9041, 52.3676] },
  { name: "Vienna", country: "Austria", coordinates: [16.3738, 48.2082] },
  { name: "Prague", country: "Czech Republic", coordinates: [14.4378, 50.0755] },
  { name: "Munich", country: "Germany", coordinates: [11.5820, 48.1351] },
  { name: "Milan", country: "Italy", coordinates: [9.1900, 45.4642] },
  { name: "Zurich", country: "Switzerland", coordinates: [8.5417, 47.3769] },
  { name: "Stockholm", country: "Sweden", coordinates: [18.0686, 59.3293] },
  { name: "Copenhagen", country: "Denmark", coordinates: [12.5683, 55.6761] },
  { name: "Dublin", country: "Ireland", coordinates: [-6.2603, 53.3498] },
  { name: "Lisbon", country: "Portugal", coordinates: [-9.1393, 38.7223] },
  { name: "Athens", country: "Greece", coordinates: [23.7275, 37.9838] },
  { name: "Istanbul", country: "Turkey", coordinates: [28.9784, 41.0082] },
  { name: "Moscow", country: "Russia", coordinates: [37.6173, 55.7558] },
  // Asia
  { name: "Beijing", country: "China", coordinates: [116.4074, 39.9042] },
  { name: "Seoul", country: "South Korea", coordinates: [126.9780, 37.5665] },
  { name: "Bangkok", country: "Thailand", coordinates: [100.5018, 13.7563] },
  { name: "Mumbai", country: "India", coordinates: [72.8777, 19.0760] },
  { name: "Delhi", country: "India", coordinates: [77.1025, 28.7041] },
  { name: "Osaka", country: "Japan", coordinates: [135.5023, 34.6937] },
  { name: "Taipei", country: "Taiwan", coordinates: [121.5654, 25.0330] },
  { name: "Kuala Lumpur", country: "Malaysia", coordinates: [101.6869, 3.1390] },
  { name: "Jakarta", country: "Indonesia", coordinates: [106.8456, -6.2088] },
  { name: "Manila", country: "Philippines", coordinates: [120.9842, 14.5995] },
  { name: "Ho Chi Minh City", country: "Vietnam", coordinates: [106.6297, 10.8231] },
  { name: "Shanghai", country: "China", coordinates: [121.4737, 31.2304] },
  { name: "Hong Kong", country: "China", coordinates: [114.1694, 22.3193] },
  // Middle East
  { name: "Abu Dhabi", country: "UAE", coordinates: [54.3773, 24.4539] },
  { name: "Doha", country: "Qatar", coordinates: [51.5310, 25.2854] },
  { name: "Riyadh", country: "Saudi Arabia", coordinates: [46.6753, 24.7136] },
  { name: "Tel Aviv", country: "Israel", coordinates: [34.7818, 32.0853] },
  // Africa
  { name: "Cairo", country: "Egypt", coordinates: [31.2357, 30.0444] },
  { name: "Cape Town", country: "South Africa", coordinates: [18.4241, -33.9249] },
  { name: "Johannesburg", country: "South Africa", coordinates: [28.0473, -26.2041] },
  { name: "Marrakech", country: "Morocco", coordinates: [-7.9811, 31.6295] },
  { name: "Lagos", country: "Nigeria", coordinates: [3.3792, 6.5244] },
  // South America
  { name: "São Paulo", country: "Brazil", coordinates: [-46.6333, -23.5505] },
  { name: "Rio de Janeiro", country: "Brazil", coordinates: [-43.1729, -22.9068] },
  { name: "Buenos Aires", country: "Argentina", coordinates: [-58.3816, -34.6037] },
  { name: "Lima", country: "Peru", coordinates: [-77.0428, -12.0464] },
  { name: "Bogotá", country: "Colombia", coordinates: [-74.0721, 4.7110] },
  { name: "Santiago", country: "Chile", coordinates: [-70.6693, -33.4489] },
  // Oceania
  { name: "Melbourne", country: "Australia", coordinates: [144.9631, -37.8136] },
  { name: "Auckland", country: "New Zealand", coordinates: [174.7633, -36.8485] },
  { name: "Brisbane", country: "Australia", coordinates: [153.0251, -27.4698] },
];

interface TeleportModalProps {
  onClose: () => void;
  onTeleport: (coordinates: [number, number]) => void;
}

export function TeleportModal({ onClose, onTeleport }: TeleportModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const filteredCities = searchQuery
    ? ALL_CITIES.filter(
        (city) =>
          city.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          city.country.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : POPULAR_CITIES;

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleCityClick = (city: City) => {
    onTeleport(city.coordinates);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={handleOverlayClick}
    >
      <div className="relative w-[520px] rounded-2xl bg-black/80 backdrop-blur-md border border-white/10 shadow-2xl overflow-hidden p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="relative w-full mr-4">
            <MagnifyingGlassIcon
              className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40"
              width={18}
              height={18}
            />
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search for major city..."
              className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-white/30 focus:bg-white/10 transition-all text-sm"
            />
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-all shrink-0"
          >
            <Cross2Icon width={16} height={16} />
          </button>
        </div>

        <div>
          <p className="text-white/40 text-xs font-medium uppercase tracking-wider mb-3 px-1">Popular Cities</p>
          <div className="flex flex-wrap gap-2">
            {filteredCities.map((city) => (
              <button
                key={city.name}
                onClick={() => handleCityClick(city)}
                className="px-3 py-1.5 rounded-md bg-white/5 hover:bg-white/10 text-white/70 hover:text-white text-sm transition-all border border-white/5 hover:border-white/10"
              >
                {city.name}
              </button>
            ))}
            {filteredCities.length === 0 && (
              <p className="text-white/30 text-sm px-1">No cities found</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
