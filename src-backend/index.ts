import express from "express";
import path from "path";

// required for ESM support. (esbuild uses it)
import { fileURLToPath } from "url";

import { getAPI } from "./api.js";
import "./ext/Room.js";

const frontendDirectory = path.resolve(__dirname, "..", "build", "static");

// Column types
export type ColumnType =
  | "roomId"
  | "name"
  | "clients"
  | "maxClients"
  | "locked"
  | "elapsedTime"
  | { metadata: string }
  | "processId"
  | "publicAddress";

// Theme configuration
export interface ThemeOptions {
  mode?: "light" | "dark" | "system" | "custom";
  primaryColor?: string;
  secondaryColor?: string;
  customTheme?: any;
}

// Layout options
export interface LayoutOptions {
  style?: "full" | "compact" | "minimal";
  density?: "comfortable" | "compact" | "standard";
  showHeader?: boolean;
  showFooter?: boolean;
}

// Room list options
export interface RoomListOptions {
  defaultSort?: string;
  defaultOrder?: "asc" | "desc";
  pageSize?: number;
  showPagination?: boolean;
  refreshInterval?: number;
  enableRealtime?: boolean;
  showEmptyRooms?: boolean;
}

// Room inspection options
export interface RoomInspectOptions {
  tabs?: Array<"state" | "clients" | "metrics" | "logs" | "custom">;
  stateView?: "tree" | "json" | "table" | "custom";
  allowStateEdit?: boolean;
  customTabs?: Array<{
    id: string;
    label: string;
    component: string;
  }>;
}

// Custom action definition
export interface CustomAction {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  confirmRequired?: boolean;
  handler: string; // Function name to be called
}

// Access control options
export interface AccessControlOptions {
  allowStateInspection?: boolean;
  allowStateModification?: boolean;
  allowClientMessages?: boolean;
  allowRoomDisposal?: boolean;
}

// Filtering options
export interface FilterOptions {
  includeTypes?: string[];
  excludeTypes?: string[];
  customFilter?: string; // Function name to be called
}

// Authentication options
export interface AuthOptions {
  strategy?: "none" | "basic" | "jwt" | "custom";
  options?: any;
  handler?: string; // Middleware function name
}

export interface MonitorOptions {
  // Original option
  columns?: Array<ColumnType>;

  // Enhanced UI options
  ui?: {
    theme?: ThemeOptions;
    layout?: LayoutOptions;
    roomList?: RoomListOptions;
    roomInspect?: RoomInspectOptions;
  };

  // Custom actions
  actions?: {
    room?: Array<CustomAction>;
    client?: Array<CustomAction>;
  };

  // Access control
  access?: AccessControlOptions;

  // Room filtering
  filter?: FilterOptions;

  // API configuration
  api?: {
    prefix?: string;
    rateLimiting?: {
      enabled: boolean;
      maxRequests: number;
      windowMs: number;
    };
    cors?: {
      enabled: boolean;
      origin: string[] | string;
    };
    caching?: {
      enabled: boolean;
      duration: number;
    };
  };

  // Authentication
  auth?: AuthOptions;

  // Real-time updates
  realtime?: {
    enabled?: boolean;
    transport?: "websocket" | "http-polling" | "sse";
    updateInterval?: number;
    subscriptions?: {
      roomListUpdates?: boolean;
      roomStateUpdates?: boolean;
      clientUpdates?: boolean;
      serverMetrics?: boolean;
    };
  };

  // Backend URL (can be different from the frontend URL)
  backendUrl?: string;
}

/**
 * Create Express router for Colyseus Monitor
 * This exposes just the router without serving static assets
 */
export function createMonitorRouter(
  opts: Partial<MonitorOptions> = {},
): express.Router {
  const router = express.Router();

  // Mount API with given options
  const apiPrefix = opts.api?.prefix || "/api";
  router.use(apiPrefix, getAPI(opts));

  return router;
}

/**
 * Create Express middleware for Colyseus Monitor
 * This serves both the API and the static frontend
 *
 * @deprecated Consider using createMonitorRouter() for more flexibility
 */
export function monitor(opts: Partial<MonitorOptions> = {}): express.Router {
  const router = express.Router();

  // Serve static frontend assets
  router.use(express.static(frontendDirectory));

  // Mount API with given options
  const apiPrefix = opts.api?.prefix || "/api";
  router.use(apiPrefix, getAPI(opts));

  return router;
}

// For type checking
export interface MonitorInstance {
  router: express.Router;
}
