/**
 * @colyseus/monitor - Advanced Development Example
 *
 * This example demonstrates a complete development setup with:
 * - Multiple room types with schemas
 * - Dummy data generation
 * - Monitor integration
 * - Playground integration
 * - Custom room logic and state
 */

// Import required packages
import { playground } from "@colyseus/playground";
import { ArraySchema, MapSchema, Schema, type } from "@colyseus/schema";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { Client, matchMaker, Room, Server } from "colyseus";
import express from "express";
import { createServer } from "http";
import { createMonitorRouter, monitor } from "../build/index.js";

// Create express app
const app = express();
const port = 2567;

// Basic middleware
app.use(express.json());

// === SCHEMA DEFINITIONS ===

// Player state schema
class PlayerState extends Schema {
  @type("string") id: string;
  @type("string") name: string;
  @type("number") x: number = 0;
  @type("number") y: number = 0;
  @type("number") score: number = 0;
  @type("boolean") isReady: boolean = false;
  @type("string") avatar: string;
  @type("number") health: number = 100;

  constructor(id: string, name: string) {
    super();
    this.id = id;
    this.name = name || `Player ${Math.floor(Math.random() * 1000)}`;
    this.avatar = `avatar_${Math.floor(Math.random() * 10)}`;
  }
}

// Item state schema
class ItemState extends Schema {
  @type("string") id: string;
  @type("string") type: string;
  @type("number") x: number;
  @type("number") y: number;
  @type("boolean") active: boolean = true;

  constructor(type: string, x: number, y: number) {
    super();
    this.id = Math.random().toString(36).substring(2, 9);
    this.type = type;
    this.x = x;
    this.y = y;
  }
}

// Game room state schema
class GameRoomState extends Schema {
  @type("string") roomName: string;
  @type("number") timeRemaining: number = 300; // 5 minutes
  @type("string") gameMode: string = "classic";
  @type("boolean") isGameStarted: boolean = false;
  @type("string") currentTurn: string;
  @type({ map: PlayerState }) players = new MapSchema<PlayerState>();
  @type([ItemState]) items = new ArraySchema<ItemState>();
  @type("number") createdAt: number = Date.now();
  @type("string") mapName: string = "default";
  @type("number") tickRate: number = 20;
  @type("number") maxPlayers: number = 8;
  @type("number") minPlayersToStart: number = 2;

  constructor(roomName: string, gameMode: string = "classic") {
    super();
    this.roomName = roomName;
    this.gameMode = gameMode;
    this.mapName = ["forest", "desert", "space", "ocean", "city"][
      Math.floor(Math.random() * 5)
    ];
  }

  createItem(type: string) {
    const x = Math.floor(Math.random() * 1000);
    const y = Math.floor(Math.random() * 1000);
    this.items.push(new ItemState(type, x, y));
  }
}

// Lobby state schema
class LobbyState extends Schema {
  @type("string") announcement: string = "Welcome to the lobby!";
  @type({ map: PlayerState }) players = new MapSchema<PlayerState>();
  @type("number") updatedAt: number = Date.now();
}

// Simple state schema (for basic examples)
class SimpleState extends Schema {
  @type("string") dummy: string = Math.random().toString();
  @type("number") counter: number = 0;
}

// === ROOM DEFINITIONS ===

// Game room with full features
class GameRoom extends Room<GameRoomState> {
  maxClients = 8;
  autoDispose = false;

  // Sample custom properties for demonstration
  tickInterval: NodeJS.Timeout;
  gameItems = ["health", "weapon", "shield", "speed", "coin"];

  onCreate(options: any) {
    const roomName =
      options.roomName || `Game ${Math.floor(Math.random() * 1000)}`;
    const gameMode = options.gameMode || "classic";

    this.state = new GameRoomState(roomName, gameMode);

    this.setMetadata({
      gameMode: this.state.gameMode,
      mapName: this.state.mapName,
      region: options.region || "us-east",
      private: !!options.private,
      version: "1.0.0",
    });

    // Generate some random items
    const itemCount = Math.floor(Math.random() * 10) + 5;
    for (let i = 0; i < itemCount; i++) {
      const itemType =
        this.gameItems[Math.floor(Math.random() * this.gameItems.length)];
      this.state.createItem(itemType);
    }

    // Set up game loop
    this.tickInterval = setInterval(
      () => this.gameTick(),
      1000 / this.state.tickRate,
    );

    // Register message handlers
    this.onMessage("move", (client, data) => this.handleMove(client, data));
    this.onMessage("ready", (client, data) => this.handleReady(client, data));
    this.onMessage("chat", (client, data) => this.handleChat(client, data));

    console.log(
      `GameRoom created: ${this.roomId} (${this.state.gameMode} mode on ${this.state.mapName})`,
    );
  }

  onJoin(client: Client, options: any) {
    const player = new PlayerState(client.sessionId, options.name);
    this.state.players.set(client.sessionId, player);

    console.log(`Player ${player.name} joined room ${this.roomId}`);

    // Broadcast join message
    this.broadcast("player-joined", { id: player.id, name: player.name });
  }

  onLeave(client: Client, consented: boolean) {
    const player = this.state.players.get(client.sessionId);
    if (player) {
      console.log(`Player ${player.name} left room ${this.roomId}`);
      this.state.players.delete(client.sessionId);
    }

    // Broadcast leave message
    this.broadcast("player-left", { id: client.sessionId });

    // End game if not enough players
    if (
      this.state.isGameStarted &&
      this.state.players.size < this.state.minPlayersToStart
    ) {
      this.endGame();
    }
  }

  onDispose() {
    console.log(`GameRoom ${this.roomId} disposed`);
    clearInterval(this.tickInterval);
  }

  // Game loop
  gameTick() {
    if (this.state.isGameStarted) {
      this.state.timeRemaining--;

      // Random events
      if (Math.random() < 0.05) {
        const itemType =
          this.gameItems[Math.floor(Math.random() * this.gameItems.length)];
        this.state.createItem(itemType);
        this.broadcast("new-item", { type: itemType });
      }

      // End game when time runs out
      if (this.state.timeRemaining <= 0) {
        this.endGame();
      }
    }
  }

  // Custom methods
  handleMove(client: Client, data: any) {
    const player = this.state.players.get(client.sessionId);
    if (player && this.state.isGameStarted) {
      player.x = data.x;
      player.y = data.y;
    }
  }

  handleReady(client: Client, data: any) {
    const player = this.state.players.get(client.sessionId);
    if (player) {
      player.isReady = data.ready;

      // Check if all players are ready to start
      let allReady = true;
      this.state.players.forEach((player) => {
        if (!player.isReady) allReady = false;
      });

      if (allReady && this.state.players.size >= this.state.minPlayersToStart) {
        this.startGame();
      }
    }
  }

  handleChat(client: Client, data: any) {
    const player = this.state.players.get(client.sessionId);
    if (player && data.message) {
      this.broadcast("chat", {
        sender: player.name,
        message: data.message,
        timestamp: Date.now(),
      });
    }
  }

  startGame() {
    this.state.isGameStarted = true;
    this.broadcast("game-start", { timeRemaining: this.state.timeRemaining });
    console.log(`Game started in room ${this.roomId}`);
  }

  endGame() {
    this.state.isGameStarted = false;

    // Calculate final scores
    const results: Array<{ id: string; name: string; score: number }> = [];
    this.state.players.forEach((player) => {
      results.push({
        id: player.id,
        name: player.name,
        score: player.score,
      });
    });

    this.broadcast("game-end", { results });
    console.log(`Game ended in room ${this.roomId}`);
  }

  // Methods for monitor custom actions
  restartGame() {
    this.state.timeRemaining = 300;
    this.state.isGameStarted = false;
    this.state.items = new ArraySchema<ItemState>();

    // Reset player scores
    this.state.players.forEach((player) => {
      player.score = 0;
      player.health = 100;
      player.x = 0;
      player.y = 0;
      player.isReady = false;
    });

    this.broadcast("game-restart");
    console.log(`Game restarted in room ${this.roomId}`);
    return { success: true, message: "Game restarted successfully" };
  }

  pauseGame() {
    // Implementation of pause functionality
    this.broadcast("game-paused");
    return { success: true, message: "Game paused successfully" };
  }

  kickPlayer(clientId: string) {
    const client = this.clients.find((c) => c.sessionId === clientId);
    if (client) {
      client.leave();
      return {
        success: true,
        message: `Player ${clientId} kicked successfully`,
      };
    }
    return { success: false, message: "Player not found" };
  }
}

// Lobby room
class LobbyRoom extends Room<LobbyState> {
  maxClients = 100;
  autoDispose = false;

  onCreate(options: any) {
    this.state = new LobbyState();

    this.setMetadata({
      type: "lobby",
      description: "Main lobby for players to connect",
    });

    this.onMessage("chat", (client, message) => {
      this.broadcast("chat", {
        sender: this.state.players.get(client.sessionId)?.name || "Anonymous",
        message,
      });
    });

    // Update announcement periodically
    setInterval(() => {
      this.state.announcement = `Welcome to the lobby! ${this.state.players.size} player(s) online. ${new Date().toLocaleString()}`;
      this.state.updatedAt = Date.now();
    }, 30000);
  }

  onJoin(client: Client, options: any) {
    this.state.players.set(
      client.sessionId,
      new PlayerState(client.sessionId, options.name || "Anonymous"),
    );
  }

  onLeave(client: Client) {
    this.state.players.delete(client.sessionId);
  }
}

// Simple room (as in user's example)
class SimpleRoom extends Room<SimpleState> {
  autoDispose = false;
  maxClients = 8;

  onCreate() {
    this.state = new SimpleState();

    // Increment counter every second
    setInterval(() => {
      this.state.counter++;
    }, 1000);
  }

  onJoin(client: Client) {
    console.log(`Client ${client.sessionId} joined SimpleRoom`);
  }
}

// Create HTTP server first
const httpServer = createServer(app);

// Create game server with WebSocketTransport
const gameServer = new Server({
  transport: new WebSocketTransport({
    server: httpServer,
    pingInterval: 5000,
    pingMaxRetries: 3,
    maxPayload: 1024 * 1024 * 2, // 2MB max payload
  }),
});

// Define room handlers
gameServer.define("game", GameRoom);
gameServer.define("lobby", LobbyRoom);
gameServer.define("simple", SimpleRoom);

// Set up routes
app.use("/monitor-legacy", monitor()); // DEPRECATED: Use createMonitorRouter() instead
app.use("/monitor", createMonitorRouter()); // New: createMonitorRouter()
app.use("/playground", playground()); // Playground

// Static explanation page
app.get("/", (req, res) => {
  res.send(`
    <html>
      <head>
        <title>Colyseus Monitor Development Server</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
          h1 { color: #3f51b5; }
          pre { background: #f5f5f5; padding: 10px; border-radius: 4px; overflow: auto; }
          .links { display: flex; gap: 20px; margin: 20px 0; }
          .links a { background: #3f51b5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; }
        </style>
      </head>
      <body>
        <h1>Colyseus Monitor Development Server</h1>
        <p>This example demonstrates a complete development setup for Colyseus Monitor.</p>
        
        <div class="links">
          <a href="/monitor-legacy">Legacy Monitor</a>
          <a href="/monitor">New Monitor</a>
          <a href="/playground">Playground</a>
        </div>
        
        <h2>Available Room Types</h2>
        <ul>
          <li><strong>game</strong> - Full-featured game room with player state, items, and game logic</li>
          <li><strong>lobby</strong> - Lobby for players to connect and chat</li>
          <li><strong>simple</strong> - Simple room with basic state</li>
        </ul>
        
        <h2>Development Features</h2>
        <ul>
          <li>Multiple room types with different schemas</li>
          <li>Full Schema integration with MapSchema and ArraySchema</li>
          <li>Auto-generated test rooms</li>
          <li>Custom room methods accessible via Monitor</li>
          <li>Playground integration for testing</li>
        </ul>
      </body>
    </html>
  `);
});

// Connect Express app to HTTP server
httpServer.on("request", app);

// Start server - using httpServer.listen instead of gameServer.listen
httpServer.listen(port, async () => {
  console.log(`\n====================================`);
  console.log(`🚀 Colyseus Monitor Development Server`);
  console.log(`====================================`);
  console.log(`ℹ️  Info Page: http://localhost:${port}/`);
  console.log(`🎮 Playground: http://localhost:${port}/playground`);
  console.log(`🔍 Legacy Monitor: http://localhost:${port}/monitor-legacy`);
  console.log(`🔍 New Monitor: http://localhost:${port}/monitor`);
  console.log(`====================================\n`);

  // Initialize the game server
  await gameServer.listen(2567);

  // Create multiple dummy rooms
  console.log("Creating dummy rooms...");

  // Create some lobby rooms
  await matchMaker.createRoom("lobby", { description: "Main Lobby" });

  // Create simple rooms
  for (let i = 0; i < 50; i++) {
    await matchMaker.createRoom("simple", {});
    // Small delay to avoid overwhelming the matchmaker
    if (i % 10 === 0) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  // Create game rooms with different configurations
  const gameModes = [
    "classic",
    "team_deathmatch",
    "capture_flag",
    "racing",
    "survival",
  ];
  const regions = ["us-east", "us-west", "eu-west", "asia", "brazil"];

  for (let i = 0; i < 50; i++) {
    const gameMode = gameModes[Math.floor(Math.random() * gameModes.length)];
    const region = regions[Math.floor(Math.random() * regions.length)];
    const isPrivate = Math.random() > 0.8;

    await matchMaker.createRoom("game", {
      roomName: `Game ${i + 1}`,
      gameMode,
      region,
      private: isPrivate,
    });

    // Small delay to avoid overwhelming the matchmaker
    if (i % 10 === 0) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  // Modify some rooms to have different numbers of clients (for testing)
  // Access the rooms directly from the matchMaker driver
  // @ts-ignore - Accessing internal properties for demo purposes
  const rooms = matchMaker.driver.rooms;
  const roomIds = Object.keys(rooms);

  if (roomIds.length > 0) {
    // Randomly assign different client counts to some rooms
    for (let i = 0; i < Math.min(20, roomIds.length); i++) {
      const randomIndex = Math.floor(Math.random() * roomIds.length);
      const randomClientsCount = [1, 2, 4, 8, 16, 32, 64, 100][
        Math.floor(Math.random() * 8)
      ];

      // @ts-ignore - Modifying internal properties for demo purposes
      rooms[roomIds[randomIndex]].clients = randomClientsCount;
    }
  }

  console.log(`Created ${roomIds.length} dummy rooms!`);
});
