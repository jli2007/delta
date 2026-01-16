"use client";

import { SunIcon, MoonIcon } from "@radix-ui/react-icons";
import { CloudRain, Snowflake, CloudOff } from "lucide-react";

type WeatherType = "clear" | "rain" | "snow";

interface WeatherPanelProps {
  lightMode: "day" | "night";
  onToggleLightMode: () => void;
  weather: WeatherType;
  onWeatherChange: (weather: WeatherType) => void;
}

export function WeatherPanel({ lightMode, onToggleLightMode, weather, onWeatherChange }: WeatherPanelProps) {
  return (
    <div data-tutorial="weather-panel" className="absolute left-4 top-1/2 -translate-y-1/2 z-10 flex flex-col items-center gap-2 rounded-2xl bg-black/40 backdrop-blur-md border border-white/10 p-3 shadow-xl">
      <button
        onClick={onToggleLightMode}
        className="flex flex-col items-center gap-1 p-2 rounded-lg transition-all w-10 bg-white/20 text-white shadow-lg"
      >
        {lightMode === "day" ? <SunIcon width={20} height={20} /> : <MoonIcon width={20} height={20} />}
        <span className="text-[10px] font-medium">{lightMode === "day" ? "Day" : "Night"}</span>
      </button>

      <div className="w-8 h-px bg-white/20 my-1" />

      <button
        onClick={() => onWeatherChange("clear")}
        className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-all w-10 ${
          weather === "clear"
            ? "bg-white/20 text-white shadow-lg"
            : "text-white/60 hover:text-white hover:bg-white/10"
        }`}
      >
        <CloudOff size={18} />
        <span className="text-[10px] font-medium">Clear</span>
      </button>

      <button
        onClick={() => onWeatherChange("rain")}
        className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-all w-10 ${
          weather === "rain"
            ? "bg-white/20 text-white shadow-lg"
            : "text-white/60 hover:text-white hover:bg-white/10"
        }`}
      >
        <CloudRain size={18} />
        <span className="text-[10px] font-medium">Rain</span>
      </button>

      <button
        onClick={() => onWeatherChange("snow")}
        className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-all w-10 ${
          weather === "snow"
            ? "bg-white/20 text-white shadow-lg"
            : "text-white/60 hover:text-white hover:bg-white/10"
        }`}
      >
        <Snowflake size={18} />
        <span className="text-[10px] font-medium">Snow</span>
      </button>
    </div>
  );
}
