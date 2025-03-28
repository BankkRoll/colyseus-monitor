/**
 * Colyseus Monitor Frontend Configuration
 *
 * This file handles configuration for the frontend part of the Colyseus Monitor.
 * It reads options from a global variable that is initialized by the backend,
 * with sensible defaults for backward compatibility.
 */

// Type definitions for UI theme
export interface ThemeOptions {
  mode?: "light" | "dark" | "system" | "custom";
  primaryColor?: string;
  secondaryColor?: string;
  customTheme?: any;
}

// Type definitions for UI layout
export interface LayoutOptions {
  style?: "full" | "compact" | "minimal";
  density?: "comfortable" | "compact" | "standard";
  showHeader?: boolean;
  showFooter?: boolean;
}

// Type definitions for room list options
export interface RoomListOptions {
  defaultSort?: string;
  defaultOrder?: "asc" | "desc";
  pageSize?: number;
  showPagination?: boolean;
  refreshInterval?: number;
  enableRealtime?: boolean;
  showEmptyRooms?: boolean;
}

// Type definitions for room inspection options
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

// Type definitions for access control
export interface AccessControlOptions {
  allowStateInspection?: boolean;
  allowStateModification?: boolean;
  allowClientMessages?: boolean;
  allowRoomDisposal?: boolean;
}

// Type definitions for custom actions
export interface CustomAction {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  confirmRequired?: boolean;
}

// Frontend configuration options
export interface MonitorFrontendConfig {
  // Enhanced UI options
  theme?: ThemeOptions;
  layout?: LayoutOptions;
  roomList?: RoomListOptions;
  roomInspect?: RoomInspectOptions;

  // API configuration
  apiPrefix?: string;

  // Access control
  access?: AccessControlOptions;

  // Custom actions
  actions?: {
    room?: CustomAction[];
    client?: CustomAction[];
  };

  // Real-time updates
  realtime?: {
    enabled?: boolean;
    transport?: "websocket" | "http-polling" | "sse";
    updateInterval?: number;
  };
}

// Default configuration
const defaultConfig: MonitorFrontendConfig = {
  theme: {
    mode: "system",
  },
  layout: {
    style: "full",
    density: "comfortable",
    showHeader: true,
    showFooter: true,
  },
  roomList: {
    defaultSort: "clients",
    defaultOrder: "desc",
    pageSize: 20,
    showPagination: true,
    refreshInterval: 5000,
    enableRealtime: false,
    showEmptyRooms: true,
  },
  roomInspect: {
    tabs: ["state", "clients"],
    stateView: "tree",
    allowStateEdit: false,
  },
  apiPrefix: "/api",
  access: {
    allowStateInspection: true,
    allowStateModification: false,
    allowClientMessages: true,
    allowRoomDisposal: true,
  },
  realtime: {
    enabled: false,
    transport: "http-polling",
    updateInterval: 5000,
  },
};

// Get configuration from global variable or use defaults
export function getConfig(): MonitorFrontendConfig {
  // Try to get config from global variable
  const globalConfig = (window as any).__COLYSEUS_MONITOR_CONFIG || {};

  // Merge with defaults (simple shallow merge for now)
  return {
    ...defaultConfig,
    ...globalConfig,
    theme: { ...defaultConfig.theme, ...globalConfig.theme },
    layout: { ...defaultConfig.layout, ...globalConfig.layout },
    roomList: { ...defaultConfig.roomList, ...globalConfig.roomList },
    roomInspect: { ...defaultConfig.roomInspect, ...globalConfig.roomInspect },
    access: { ...defaultConfig.access, ...globalConfig.access },
    realtime: { ...defaultConfig.realtime, ...globalConfig.realtime },
  };
}

// Export singleton config instance
export const config = getConfig();
