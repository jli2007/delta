import type { IconProps } from "@radix-ui/react-icons/dist/types";

// Tool types from the map page
export type ToolType = "select" | "draw" | "insert" | "generate";

// Weather types
export type WeatherType = "clear" | "rain" | "snow";

// Light mode types
export type LightMode = "day" | "night";

// Command categories for grouping in UI
export type CommandCategory =
  | "navigation"
  | "camera"
  | "weather"
  | "time"
  | "tools"
  | "models"
  | "buildings"
  | "history"
  | "map"
  | "help";

// Argument types
export type ArgumentType = "string" | "number" | "select" | "location" | "model";

// Command argument definition
export interface CommandArgument {
  name: string;
  type: ArgumentType;
  required: boolean;
  placeholder?: string;
  options?: string[]; // For 'select' type
}

// Parsed arguments from user input
export interface ParsedArgs {
  [key: string]: string | number | undefined;
  _raw: string; // The full raw argument string
}

// Inserted model type (matches map page)
export interface InsertedModel {
  id: string;
  name?: string;
  position: [number, number]; // [lng, lat]
  height: number;
  scale: number;
  rotationX: number;
  rotationY: number;
  rotationZ: number;
  modelUrl: string;
}

// Context passed to command execute functions
export interface CommandContext {
  // Map instance
  map: mapboxgl.Map | null;

  // Tool state
  activeTool: ToolType;
  setActiveTool: (tool: ToolType) => void;

  // Model state
  insertedModels: InsertedModel[];
  setInsertedModels: React.Dispatch<React.SetStateAction<InsertedModel[]>>;
  selectedModelId: string | null;
  setSelectedModelId: (id: string | null) => void;

  // Weather/Time
  setWeather: (weather: WeatherType) => void;
  setLightMode: (mode: LightMode) => void;

  // History
  handleUndo: () => void;
  handleRedo: () => void;

  // Model operations
  handleFlyToModel: (position: [number, number]) => void;
  handleDeleteModel: (id: string) => void;

  // UI state
  setShowInsertModal: (show: boolean) => void;
  setIsGeneratorVisible: (visible: boolean) => void;

  // Search (for natural language fallback and teleport)
  handleSearch: () => void;
  setSearchQuery: (query: string) => void;

  // Map style
  setShowLabels: (show: boolean) => void;
  setShowRoads: (show: boolean) => void;
  setShowPOIs: (show: boolean) => void;

  // Help modal
  setShowHelp: (show: boolean) => void;
}

// Command definition
export interface Command {
  id: string;
  name: string;
  trigger: string;
  aliases: string[];
  description: string;
  category: CommandCategory;
  icon: React.ComponentType<IconProps>;
  arguments?: CommandArgument[];
  execute: (args: ParsedArgs, context: CommandContext) => void | Promise<void>;
}

// Fuzzy match result
export interface FuzzyMatch {
  command: Command;
  score: number;
  matchedOn: string; // Which string was matched (trigger, alias, or name)
  highlights: { start: number; end: number }[]; // Character positions to highlight
}

// Category display info
export const CATEGORY_LABELS: Record<CommandCategory, string> = {
  navigation: "Navigation",
  camera: "Camera",
  weather: "Weather",
  time: "Time",
  tools: "Tools",
  models: "Models",
  buildings: "Buildings",
  history: "History",
  map: "Map Style",
  help: "Help",
};

// Category order for display
export const CATEGORY_ORDER: CommandCategory[] = [
  "navigation",
  "tools",
  "camera",
  "weather",
  "time",
  "models",
  "buildings",
  "history",
  "map",
  "help",
];
