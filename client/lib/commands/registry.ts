import {
  RocketIcon,
  HomeIcon,
  MagnifyingGlassIcon,
  ZoomInIcon,
  MixerVerticalIcon,
  ReloadIcon,
  DashboardIcon,
  CubeIcon,
  SunIcon,
  MoonIcon,
  OpacityIcon,
  CursorArrowIcon,
  Pencil1Icon,
  PlusCircledIcon,
  MagicWandIcon,
  ListBulletIcon,
  TrashIcon,
  ResetIcon,
  CounterClockwiseClockIcon,
  ClockIcon,
  EyeOpenIcon,
  QuestionMarkCircledIcon,
  TargetIcon,
} from "@radix-ui/react-icons";
import type { Command, ParsedArgs, CommandContext } from "./types";

// Helper to fly the map to coordinates
async function flyToLocation(
  context: CommandContext,
  query: string
): Promise<void> {
  if (!context.map || !query) return;

  // Use Mapbox Geocoding API
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) return;

  try {
    const response = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
        query
      )}.json?access_token=${token}&limit=1`
    );
    const data = await response.json();

    if (data.features && data.features.length > 0) {
      const [lng, lat] = data.features[0].center;
      context.map.flyTo({
        center: [lng, lat],
        zoom: 15,
        pitch: 60,
        duration: 2000,
      });
    }
  } catch (error) {
    console.error("Failed to geocode location:", error);
  }
}

// All command definitions
export const commands: Command[] = [
  // ==================== NAVIGATION ====================
  {
    id: "teleport",
    name: "Teleport",
    trigger: "/teleport",
    aliases: ["/goto", "/fly", "/tp"],
    description: "Fly to a location",
    category: "navigation",
    icon: RocketIcon,
    arguments: [
      { name: "location", type: "location", required: true, placeholder: "city, address, or landmark" },
    ],
    execute: async (args, context) => {
      const location = args._raw;
      if (location) {
        await flyToLocation(context, location);
      }
    },
  },
  {
    id: "home",
    name: "Home",
    trigger: "/home",
    aliases: ["/reset"],
    description: "Return to initial globe view",
    category: "navigation",
    icon: HomeIcon,
    execute: (_, context) => {
      context.map?.flyTo({
        center: [0, 20],
        zoom: 1.5,
        pitch: 0,
        bearing: 0,
        duration: 2000,
      });
    },
  },

  // ==================== CAMERA ====================
  {
    id: "zoom",
    name: "Zoom",
    trigger: "/zoom",
    aliases: ["/z"],
    description: "Set zoom level or zoom in/out",
    category: "camera",
    icon: ZoomInIcon,
    arguments: [
      { name: "level", type: "string", required: true, placeholder: "in, out, or 1-22" },
    ],
    execute: (args, context) => {
      const value = args._raw.toLowerCase();
      if (!context.map) return;

      if (value === "in") {
        context.map.zoomIn({ duration: 300 });
      } else if (value === "out") {
        context.map.zoomOut({ duration: 300 });
      } else {
        const level = parseFloat(value);
        if (!isNaN(level) && level >= 0 && level <= 22) {
          context.map.flyTo({ zoom: level, duration: 500 });
        }
      }
    },
  },
  {
    id: "pitch",
    name: "Pitch",
    trigger: "/pitch",
    aliases: ["/tilt"],
    description: "Set camera pitch (0-85 degrees)",
    category: "camera",
    icon: MixerVerticalIcon,
    arguments: [
      { name: "degrees", type: "number", required: true, placeholder: "0-85" },
    ],
    execute: (args, context) => {
      const degrees = parseFloat(args._raw);
      if (!isNaN(degrees) && degrees >= 0 && degrees <= 85) {
        context.map?.flyTo({ pitch: degrees, duration: 500 });
      }
    },
  },
  {
    id: "bearing",
    name: "Bearing",
    trigger: "/bearing",
    aliases: ["/rotate"],
    description: "Set map rotation (degrees)",
    category: "camera",
    icon: ReloadIcon,
    arguments: [
      { name: "degrees", type: "number", required: true, placeholder: "0-360" },
    ],
    execute: (args, context) => {
      const degrees = parseFloat(args._raw);
      if (!isNaN(degrees)) {
        context.map?.flyTo({ bearing: degrees % 360, duration: 500 });
      }
    },
  },
  {
    id: "2d",
    name: "2D View",
    trigger: "/2d",
    aliases: ["/flat", "/topdown"],
    description: "Switch to 2D top-down view",
    category: "camera",
    icon: DashboardIcon,
    execute: (_, context) => {
      context.map?.flyTo({ pitch: 0, duration: 500 });
    },
  },
  {
    id: "3d",
    name: "3D View",
    trigger: "/3d",
    aliases: ["/perspective"],
    description: "Switch to 3D perspective view",
    category: "camera",
    icon: CubeIcon,
    execute: (_, context) => {
      context.map?.flyTo({ pitch: 60, duration: 500 });
    },
  },
  {
    id: "north",
    name: "North",
    trigger: "/north",
    aliases: ["/compass"],
    description: "Reset bearing to north",
    category: "camera",
    icon: TargetIcon,
    execute: (_, context) => {
      context.map?.flyTo({ bearing: 0, duration: 500 });
    },
  },

  // ==================== WEATHER ====================
  {
    id: "weather",
    name: "Weather",
    trigger: "/weather",
    aliases: ["/w"],
    description: "Set weather (clear, rain, snow)",
    category: "weather",
    icon: OpacityIcon,
    arguments: [
      { name: "type", type: "select", required: true, options: ["clear", "rain", "snow"] },
    ],
    execute: (args, context) => {
      const type = args._raw.toLowerCase();
      if (type === "clear" || type === "rain" || type === "snow") {
        context.setWeather(type);
      }
    },
  },
  {
    id: "rain",
    name: "Rain",
    trigger: "/rain",
    aliases: ["/rainy"],
    description: "Enable rain weather",
    category: "weather",
    icon: OpacityIcon,
    execute: (_, context) => {
      context.setWeather("rain");
    },
  },
  {
    id: "snow",
    name: "Snow",
    trigger: "/snow",
    aliases: ["/snowy"],
    description: "Enable snow weather",
    category: "weather",
    icon: OpacityIcon,
    execute: (_, context) => {
      context.setWeather("snow");
    },
  },
  {
    id: "clear",
    name: "Clear",
    trigger: "/clear",
    aliases: ["/sunny"],
    description: "Clear weather effects",
    category: "weather",
    icon: SunIcon,
    execute: (_, context) => {
      context.setWeather("clear");
    },
  },

  // ==================== TIME ====================
  {
    id: "time",
    name: "Time",
    trigger: "/time",
    aliases: ["/t"],
    description: "Set time of day (day, night)",
    category: "time",
    icon: ClockIcon,
    arguments: [
      { name: "mode", type: "select", required: true, options: ["day", "night"] },
    ],
    execute: (args, context) => {
      const mode = args._raw.toLowerCase();
      if (mode === "day" || mode === "night") {
        context.setLightMode(mode);
      }
    },
  },
  {
    id: "day",
    name: "Day",
    trigger: "/day",
    aliases: ["/morning", "/daytime"],
    description: "Switch to daytime",
    category: "time",
    icon: SunIcon,
    execute: (_, context) => {
      context.setLightMode("day");
    },
  },
  {
    id: "night",
    name: "Night",
    trigger: "/night",
    aliases: ["/evening", "/nighttime"],
    description: "Switch to nighttime",
    category: "time",
    icon: MoonIcon,
    execute: (_, context) => {
      context.setLightMode("night");
    },
  },

  // ==================== TOOLS ====================
  {
    id: "select",
    name: "Select",
    trigger: "/select",
    aliases: ["/s", "/sel"],
    description: "Activate select tool",
    category: "tools",
    icon: CursorArrowIcon,
    execute: (_, context) => {
      context.setActiveTool("select");
    },
  },
  {
    id: "delete",
    name: "Delete",
    trigger: "/delete",
    aliases: ["/d", "/draw", "/erase"],
    description: "Activate delete/draw tool",
    category: "tools",
    icon: Pencil1Icon,
    execute: (_, context) => {
      context.setActiveTool("draw");
    },
  },
  {
    id: "insert",
    name: "Insert",
    trigger: "/insert",
    aliases: ["/i", "/add", "/model"],
    description: "Open insert model modal",
    category: "tools",
    icon: PlusCircledIcon,
    execute: (_, context) => {
      context.setActiveTool("insert");
      context.setShowInsertModal(true);
    },
  },
  {
    id: "generate",
    name: "Generate",
    trigger: "/generate",
    aliases: ["/g", "/gen", "/ai"],
    description: "Open AI 3D model generator",
    category: "tools",
    icon: MagicWandIcon,
    execute: (_, context) => {
      context.setActiveTool("generate");
      context.setIsGeneratorVisible(true);
    },
  },

  // ==================== MODELS ====================
  {
    id: "models",
    name: "Models",
    trigger: "/models",
    aliases: ["/assets", "/list"],
    description: "List all placed models",
    category: "models",
    icon: ListBulletIcon,
    execute: (_, context) => {
      const models = context.insertedModels;
      if (models.length === 0) {
        console.log("No models placed");
      } else {
        console.log(`${models.length} model(s) placed:`);
        models.forEach((m, i) => {
          console.log(`  ${i + 1}. ${m.name || `Model ${m.id.slice(0, 8)}`}`);
        });
      }
      // TODO: Could show a panel with models list
    },
  },
  {
    id: "flyto",
    name: "Fly To Model",
    trigger: "/flyto",
    aliases: ["/focus"],
    description: "Fly to a placed model",
    category: "models",
    icon: TargetIcon,
    arguments: [
      { name: "model", type: "model", required: true, placeholder: "model name" },
    ],
    execute: (args, context) => {
      const query = args._raw.toLowerCase();
      const model = context.insertedModels.find(
        (m) =>
          (m.name || `Model ${m.id.slice(0, 8)}`).toLowerCase().includes(query) ||
          m.id.toLowerCase().includes(query)
      );
      if (model) {
        context.handleFlyToModel(model.position);
        context.setSelectedModelId(model.id);
      }
    },
  },
  {
    id: "deletemodel",
    name: "Delete Model",
    trigger: "/deletemodel",
    aliases: ["/rm"],
    description: "Delete a placed model",
    category: "models",
    icon: TrashIcon,
    arguments: [
      { name: "model", type: "model", required: true, placeholder: "model name" },
    ],
    execute: (args, context) => {
      const query = args._raw.toLowerCase();
      const model = context.insertedModels.find(
        (m) =>
          (m.name || `Model ${m.id.slice(0, 8)}`).toLowerCase().includes(query) ||
          m.id.toLowerCase().includes(query)
      );
      if (model) {
        context.handleDeleteModel(model.id);
      }
    },
  },

  // ==================== BUILDINGS ====================
  {
    id: "find",
    name: "Find",
    trigger: "/find",
    aliases: ["/search"],
    description: "Find buildings (uses AI search)",
    category: "buildings",
    icon: MagnifyingGlassIcon,
    arguments: [
      { name: "query", type: "string", required: true, placeholder: "tallest, biggest, etc." },
    ],
    execute: (args, context) => {
      // Delegate to natural language search
      context.setSearchQuery(args._raw);
      context.handleSearch();
    },
  },
  {
    id: "demolish",
    name: "Demolish",
    trigger: "/demolish",
    aliases: [],
    description: "Delete a building at location",
    category: "buildings",
    icon: TrashIcon,
    arguments: [
      { name: "location", type: "location", required: true, placeholder: "building name or location" },
    ],
    execute: (args, context) => {
      // Delegate to natural language search with delete intent
      context.setSearchQuery(`delete ${args._raw}`);
      context.handleSearch();
    },
  },

  // ==================== HISTORY ====================
  {
    id: "undo",
    name: "Undo",
    trigger: "/undo",
    aliases: ["/u"],
    description: "Undo last action",
    category: "history",
    icon: CounterClockwiseClockIcon,
    execute: (_, context) => {
      context.handleUndo();
    },
  },
  {
    id: "redo",
    name: "Redo",
    trigger: "/redo",
    aliases: ["/r"],
    description: "Redo last undone action",
    category: "history",
    icon: ResetIcon,
    execute: (_, context) => {
      context.handleRedo();
    },
  },

  // ==================== MAP STYLE ====================
  {
    id: "labels",
    name: "Labels",
    trigger: "/labels",
    aliases: ["/showlabels"],
    description: "Toggle place labels (on/off)",
    category: "map",
    icon: EyeOpenIcon,
    arguments: [
      { name: "state", type: "select", required: true, options: ["on", "off"] },
    ],
    execute: (args, context) => {
      const state = args._raw.toLowerCase();
      context.setShowLabels(state === "on");
    },
  },
  {
    id: "roads",
    name: "Roads",
    trigger: "/roads",
    aliases: ["/showroads"],
    description: "Toggle road labels (on/off)",
    category: "map",
    icon: EyeOpenIcon,
    arguments: [
      { name: "state", type: "select", required: true, options: ["on", "off"] },
    ],
    execute: (args, context) => {
      const state = args._raw.toLowerCase();
      context.setShowRoads(state === "on");
    },
  },
  {
    id: "pois",
    name: "POIs",
    trigger: "/pois",
    aliases: ["/showpois"],
    description: "Toggle POI labels (on/off)",
    category: "map",
    icon: EyeOpenIcon,
    arguments: [
      { name: "state", type: "select", required: true, options: ["on", "off"] },
    ],
    execute: (args, context) => {
      const state = args._raw.toLowerCase();
      context.setShowPOIs(state === "on");
    },
  },

  // ==================== HELP ====================
  {
    id: "help",
    name: "Help",
    trigger: "/help",
    aliases: ["/h", "/?", "/commands"],
    description: "Show all available commands",
    category: "help",
    icon: QuestionMarkCircledIcon,
    execute: (_, context) => {
      context.setShowHelp(true);
    },
  },
];

// Export helper to get all commands
export function getAllCommands(): Command[] {
  return commands;
}
