/**
 * @colyseus/monitor - Development Example
 */

import { monitor } from "@colyseus/monitor";
import { playground } from "@colyseus/playground";
import { Schema, type } from "@colyseus/schema";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { Client, matchMaker, Room, Server } from "colyseus";
import express from "express";
import { createServer } from "http";
import path from "path";
import { getAPI } from "../build/api.js";

// Create express app
const app = express();
const port = 2567;

// Basic middleware
app.use(express.json());

// Simple state schema
class GameState extends Schema {
  @type("number") counter: number = 0;
  @type("string") status: string = "waiting";
  @type("number") players: number = 0;
}

// Simple game room
class GameRoom extends Room<GameState> {
  maxClients = 4;
  autoDispose = false;

  onCreate() {
    this.state = new GameState();
    console.log(`GameRoom created: ${this.roomId}`);

    // Register message handlers
    this.onMessage("start", (client: Client) => {
      this.state.status = "playing";
      this.broadcast("game-started");
    });

    this.onMessage("stop", (client: Client) => {
      this.state.status = "stopped";
      this.broadcast("game-stopped");
    });
  }

  onJoin(client: Client) {
    this.state.players++;
    console.log(`Client ${client.sessionId} joined`);
    this.broadcast("player-joined", { players: this.state.players });
  }

  onLeave(client: Client) {
    this.state.players--;
    console.log(`Client ${client.sessionId} left`);
    this.broadcast("player-left", { players: this.state.players });
  }
}

// Create HTTP server
const httpServer = createServer(app);

// Create game server with WebSocketTransport
const gameServer = new Server({
  transport: new WebSocketTransport({
    server: httpServer,
    pingInterval: 5000,
    pingMaxRetries: 3,
  }),
});

/**
 * Define your room handlers:
 */
gameServer.define(
  "my_room",
  class MyRoom extends Room<GameState> {
    autoDispose = false;
    maxClients = 8;

    onCreate() {
      this.state = new GameState();
    }
  },
);

// Define room handler
gameServer.define("game", GameRoom);

// Set up routes
// Legacy monitor
app.use("/monitor-legacy", monitor());

// New monitor - API endpoints
app.use("/monitor/api", getAPI({}));

// Serve static files for the new monitor
app.use(
  "/monitor/static",
  express.static(path.resolve(__dirname, "../build/static")),
);

// New monitor - Frontend
app.get("/monitor", (req, res) => {
  res.send(`
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta http-equiv="X-UA-Compatible" content="ie=edge" />
        <link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet" />
        <title>Colyseus Monitor</title>
        <script>
          window.__COLYSEUS_MONITOR_CONFIG = {
            apiPrefix: "/monitor/api"
          };
        </script>
        <link rel="stylesheet" href="/monitor/static/css/main.css" />
      </head>
      <body>
        <div id="app"></div>
        <script src="/monitor/static/js/main.js"></script>
      </body>
    </html>
  `);
});

// Playground
app.use("/playground", playground());

// Static explanation page
app.get("/", (req, res) => {
  res.send(`
    <html>
      <head>
        <title>Colyseus Monitor Example</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
          h1 { color: #3f51b5; }
          .links { display: flex; gap: 20px; margin: 20px 0; }
          .links a { background: #3f51b5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; }
        </style>
      </head>
      <body>
        <h1>Colyseus Monitor Example</h1>
        <div class="links">
          <a href="/monitor-legacy">Legacy Monitor</a>
          <a href="/monitor">New Monitor</a>
          <a href="/playground">Playground</a>
        </div>
        <p>This is a simple example with one game room type. Use the Playground to test the room.</p>
      </body>
    </html>
  `);
});

// Start server
gameServer.listen(port).then(async () => {
  console.log(`\n====================================`);
  console.log(`🚀 Colyseus Monitor Example Server`);
  console.log(`====================================`);
  console.log(`ℹ️  Info Page: http://localhost:${port}/`);
  console.log(`🎮 Playground: http://localhost:${port}/playground`);
  console.log(`🔍 Legacy Monitor: http://localhost:${port}/monitor-legacy`);
  console.log(`🔍 New Monitor: http://localhost:${port}/monitor`);
  console.log(`====================================\n`);

  // Create test rooms with different client counts
  for (let i = 0; i < 10; i++) {
    await matchMaker.createRoom("game", {});
    // @ts-ignore - Modifying internal properties for demo purposes
    matchMaker.driver.rooms[i].clients = [1, 2, 4, 8, 16, 32, 64, 100][
      Math.floor(Math.random() * 8)
    ];
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  console.log("Created test rooms with varying client counts");
});
