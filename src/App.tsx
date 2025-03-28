// @ts-nocheck
import { createHashHistory } from "history";
import React from "react";
import { Route, Router } from "react-router-dom";

import {
  createTheme,
  CssBaseline,
  ThemeProvider,
  useMediaQuery,
} from "@mui/material";

import { CAppBar } from "./components/CAppBar";
import { RoomInspect } from "./components/RoomInspect";
import { RoomList } from "./components/RoomList";
import { config } from "./config";

const history = createHashHistory();

// Configurable theme options based on settings
function createAppTheme(themeOptions = config.theme) {
  const prefersDarkMode = useMediaQuery("(prefers-color-scheme: dark)");

  // Determine theme mode
  let mode = themeOptions.mode || "system";
  if (mode === "system") {
    mode = prefersDarkMode ? "dark" : "light";
  }

  // Get layout density safely
  const layoutConfig = config.layout || {};
  const density = layoutConfig.density || "standard";
  const isDense = density === "compact";

  // Create theme with options
  return createTheme({
    palette: {
      mode: mode as "light" | "dark",
      primary: themeOptions.primaryColor
        ? {
            main: themeOptions.primaryColor,
          }
        : undefined,
      secondary: themeOptions.secondaryColor
        ? {
            main: themeOptions.secondaryColor,
          }
        : undefined,
    },
    // Apply density setting to components
    components: {
      MuiButton: {
        defaultProps: {
          size: isDense ? "small" : "medium",
        },
      },
      MuiTextField: {
        defaultProps: {
          size: isDense ? "small" : "medium",
        },
      },
      MuiFormControl: {
        defaultProps: {
          size: isDense ? "small" : "medium",
        },
      },
      MuiInputLabel: {
        defaultProps: {
          size: isDense ? "small" : "medium",
        },
      },
      MuiMenuItem: {
        defaultProps: {
          dense: isDense,
        },
      },
      MuiTable: {
        defaultProps: {
          size: isDense ? "small" : "medium",
        },
      },
      MuiDataGrid: {
        defaultProps: {
          density: isDense ? "compact" : "standard",
        },
      },
    },
    // Custom theme overrides if provided
    ...(themeOptions.customTheme || {}),
  });
}

export function App() {
  // Create theme with config options
  const theme = React.useMemo(
    () => createAppTheme(config.theme),
    [config.theme],
  );

  // Safe access to layout config
  const layoutConfig = config.layout || {};

  // Determine layout style
  const layoutStyle = layoutConfig.style || "full";

  // Optional custom routes from config
  const customRoutes = (window as any).__COLYSEUS_MONITOR_CUSTOM_ROUTES || [];

  // Safely access monitor options from window
  const monitorOptions = (window as any).COLYSEUS_MONITOR_OPTIONS || {};
  const themeConfig = monitorOptions.theme || {};
  const themeMode = themeConfig.mode || "auto";

  return (
    <Router history={history}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {/* Show header based on config */}
        {layoutConfig.showHeader !== false && <CAppBar />}

        {/* Main routes */}
        <div className={`layout-${layoutStyle}`}>
          <Route exact path="/" component={RoomList} />
          <Route path="/room/:roomId" component={RoomInspect} />

          {/* Custom routes if any */}
          {customRoutes.map((route) => (
            <Route
              key={route.path}
              path={route.path}
              component={route.component}
              exact={route.exact}
            />
          ))}
        </div>

        {/* Optional footer based on config */}
        {layoutConfig.showFooter && (
          <footer className="monitor-footer">
            <div className="monitor-footer-content">
              Colyseus Monitor v{process.env.npm_package_version}
            </div>
          </footer>
        )}
      </ThemeProvider>
    </Router>
  );
}
