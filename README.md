# Colyseus Monitor

An advanced monitoring panel for [Colyseus](https://github.com/colyseus/colyseus) game servers.

[![npm version](https://badge.fury.io/js/%40colyseus%2Fmonitor.svg)](https://badge.fury.io/js/%40colyseus%2Fmonitor)

## Features

- **Room Management**
  - List all active rooms with filterable, sortable columns
  - Force to dispose specific rooms
  - Inspect room details and state
  - Send/broadcast messages to clients
  - Force disconnect clients
  - View detailed room metrics
- **Advanced UI**
  - Customizable layout (full, compact, minimal)
  - Theme customization (light, dark, system, custom)
  - Responsive design for all devices
  - Configurable density settings
- **Enhanced API**
  - Filtering, sorting, and pagination
  - Real-time updates (optional)
  - Custom actions for rooms and clients
  - Server metrics and health monitoring
- **Security & Access Control**
  - Fine-grained permissions
  - Authentication support (Basic, JWT, custom)
  - CORS and rate limiting options

## Installation

This package is installed by default on new projects created via `npm create colyseus-app`.

```bash
npm install --save @colyseus/monitor
```

## Basic Usage

```typescript
// app.config.ts
import { monitor } from "@colyseus/monitor";

// ...
initializeExpress: (app) => {
  // bind it as an express middleware
  app.use("/monitor", monitor());
};
// ...
```

## Advanced Usage

### Using Direct Router Access

```typescript
// app.config.ts
import { createMonitorRouter } from "@colyseus/monitor";
import express from "express";

// ...
initializeExpress: (app) => {
  // Create a router with custom options
  const monitorRouter = createMonitorRouter({
    // Custom options here
  });

  // Apply your own middleware before the monitor
  const monitorPath = "/monitor";
  app.use(
    monitorPath,
    myCustomAuthMiddleware,
    express.static("/path/to/custom/assets"),
    monitorRouter,
  );
};
// ...
```

### Comprehensive Configuration Example

```typescript
import { monitor, MonitorOptions } from "@colyseus/monitor";
import basicAuth from "express-basic-auth";

// Authentication middleware
const basicAuthMiddleware = basicAuth({
  users: { admin: "secret-password" },
  challenge: true,
});

// Monitor options
const monitorOptions: Partial<MonitorOptions> = {
  // Column customization
  columns: [
    "roomId",
    "name",
    "clients",
    { metadata: "gameMode" }, // Display metadata field
    "locked",
    "elapsedTime",
  ],

  // UI customization
  ui: {
    theme: {
      mode: "system", // 'light', 'dark', 'system', or 'custom'
      primaryColor: "#3f51b5",
      secondaryColor: "#f50057",
    },
    layout: {
      style: "full", // 'full', 'compact', or 'minimal'
      density: "comfortable", // 'comfortable', 'compact', or 'standard'
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
    },
    roomInspect: {
      tabs: ["state", "clients", "metrics", "logs"],
      stateView: "tree",
      allowStateEdit: false,
    },
  },

  // Custom actions
  actions: {
    room: [
      {
        id: "restart",
        name: "Restart Room",
        description: "Reset the room state",
        icon: "refresh",
        confirmRequired: true,
        handler: "restartRoom", // Method name to call on the room
      },
    ],
    client: [
      {
        id: "ping",
        name: "Ping Client",
        description: "Send a ping to the client",
        icon: "wifi",
        confirmRequired: false,
        handler: "pingClient", // Method name to call on the room
      },
    ],
  },

  // Access control
  access: {
    allowStateInspection: true,
    allowStateModification: false,
    allowClientMessages: true,
    allowRoomDisposal: true,
  },

  // Room filtering
  filter: {
    includeTypes: ["GameRoom"], // Only show these room types
    excludeTypes: ["LobbyRoom"], // Hide these room types
  },

  // API configuration
  api: {
    prefix: "/api",
    rateLimiting: {
      enabled: true,
      maxRequests: 100,
      windowMs: 60000, // 1 minute
    },
    cors: {
      enabled: true,
      origin: "*",
    },
    caching: {
      enabled: true,
      duration: 30, // seconds
    },
  },

  // Authentication
  auth: {
    strategy: "basic",
    options: {
      users: { admin: "password" },
      challenge: true,
    },
  },

  // Real-time updates
  realtime: {
    enabled: true,
    transport: "websocket",
    updateInterval: 2000,
    subscriptions: {
      roomListUpdates: true,
      roomStateUpdates: true,
      clientUpdates: true,
      serverMetrics: true,
    },
  },
};

// Apply monitor with options
app.use("/monitor", basicAuthMiddleware, monitor(monitorOptions));
```

## Room Extension Methods

To enable custom actions and features, you can implement these methods in your room classes:

```typescript
import { Room } from "colyseus";

export class MyGameRoom extends Room {
  // Built-in monitor extensions

  // Called by the monitor to restart the room
  restartRoom() {
    // Your room restart logic
    this.setState(new MyRoomState());
    return { success: true, message: "Room restarted" };
  }

  // Called by the monitor to ping a client
  pingClient(clientId) {
    const client = this.clients.find((c) => c.sessionId === clientId);
    if (client) {
      client.send("ping", { timestamp: Date.now() });
      return { success: true };
    }
    return { success: false, message: "Client not found" };
  }

  // Track custom metrics for monitoring
  onMessage(client, type, message) {
    // Track custom metrics
    this.trackMetric("messageSize", JSON.stringify(message).length);

    // Your normal message handling
    // ...
  }
}
```

## Styling and Customization

You can inject custom CSS by serving your own static files before the monitor middleware:

```typescript
app.use("/monitor", express.static("/path/to/custom/styles"), monitor(options));
```

Create a `custom-monitor.css` file in your static directory to override styles.

## Programmatic Access to Monitor API

You can use the monitor API endpoints directly for automation:

```typescript
// Example of using the monitor API programmatically
const fetch = require("node-fetch");

async function getActiveRooms() {
  const response = await fetch("http://yourgame.com/monitor/api");
  const data = await response.json();
  return data.rooms;
}

async function disposeRoom(roomId) {
  const query = new URLSearchParams({
    roomId,
    method: "disconnect",
    args: "[]",
  });
  await fetch(`http://yourgame.com/monitor/api/room/call?${query}`);
}
```

## Security Recommendations

1. **Always use authentication** in production environments
2. Disable state modification in production
3. Consider using HTTPS for all monitor traffic
4. Set appropriate rate limits for API requests

## License

MIT
