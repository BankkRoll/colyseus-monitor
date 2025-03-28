import { matchMaker } from "@colyseus/core";

import express from "express";
import osUtils from "node-os-utils";

import type { MonitorOptions } from "./index.js";

const UNAVAILABLE_ROOM_ERROR =
  "@colyseus/monitor: room $roomId is not available anymore.";

// Enhanced error handling
function handleError(
  res: express.Response,
  message: string,
  status: number = 500,
) {
  console.error(message);
  res.status(status);
  res.json({ error: true, message });
}

// Apply room filters based on options
function applyRoomFilters(
  rooms: any[],
  filterOptions?: MonitorOptions["filter"],
) {
  if (!filterOptions) return rooms;

  let filteredRooms = [...rooms];

  // Filter by room type inclusion
  if (filterOptions.includeTypes && filterOptions.includeTypes.length > 0) {
    filteredRooms = filteredRooms.filter((room) =>
      filterOptions.includeTypes?.includes(room.name),
    );
  }

  // Filter by room type exclusion
  if (filterOptions.excludeTypes && filterOptions.excludeTypes.length > 0) {
    filteredRooms = filteredRooms.filter(
      (room) => !filterOptions.excludeTypes?.includes(room.name),
    );
  }

  return filteredRooms;
}

// Apply sorting to rooms
function applySorting(rooms: any[], sort?: string, order?: "asc" | "desc") {
  if (!sort) return rooms;

  return [...rooms].sort((a, b) => {
    // Handle nested properties (like metadata.value)
    const parts = sort.split(".");
    let aVal = a;
    let bVal = b;

    for (const part of parts) {
      aVal = aVal?.[part];
      bVal = bVal?.[part];
    }

    // Compare values
    if (aVal === bVal) return 0;

    const result = aVal < bVal ? -1 : 1;
    return order === "desc" ? -result : result;
  });
}

// Enhanced API with support for new options
export function getAPI(opts: Partial<MonitorOptions>) {
  const api = express.Router();

  // Optional rate limiting middleware
  if (opts.api?.rateLimiting?.enabled) {
    // This would be implemented with express-rate-limit or similar
    console.log("Rate limiting enabled with", opts.api.rateLimiting);
    // We would add the middleware here
  }

  // Optional CORS middleware
  if (opts.api?.cors?.enabled) {
    // This would be implemented with cors package
    console.log("CORS enabled with", opts.api.cors);
    // We would add the middleware here
  }

  // Get room list with filtering and sorting
  api.get("/", async (req: express.Request, res: express.Response) => {
    try {
      // Get query parameters for filtering and pagination
      const filter = req.query.filter as string;
      const sort = (req.query.sort as string) || opts.ui?.roomList?.defaultSort;
      const order =
        (req.query.order as "asc" | "desc") ||
        opts.ui?.roomList?.defaultOrder ||
        "asc";
      const page = parseInt(req.query.page as string) || 1;
      const limit =
        parseInt(req.query.limit as string) ||
        opts.ui?.roomList?.pageSize ||
        100;

      // Get all rooms
      const rooms: any[] = await matchMaker.query({});

      // Apply configured filters
      let filteredRooms = applyRoomFilters(rooms, opts.filter);

      // Apply additional query filter if provided
      if (filter) {
        try {
          const filterObj = JSON.parse(filter);
          filteredRooms = filteredRooms.filter((room) => {
            // Simple field matching for now
            return Object.entries(filterObj).every(([key, value]) => {
              return (
                room[key] === value ||
                (room.metadata && room.metadata[key] === value)
              );
            });
          });
        } catch (e) {
          // Invalid filter JSON, ignore it
          console.error("Invalid filter JSON:", filter);
        }
      }

      // Apply sorting
      const sortedRooms = applySorting(filteredRooms, sort, order);

      // Apply pagination
      const startIndex = (page - 1) * limit;
      const endIndex = page * limit;
      const paginatedRooms = sortedRooms.slice(startIndex, endIndex);

      // Determine which columns to show
      const columns = opts.columns || [
        "roomId",
        "name",
        "clients",
        "maxClients",
        "locked",
        "elapsedTime",
      ];

      // Add "processId" column if present in any room
      if (!opts.columns && rooms[0] && rooms[0].publicAddress !== undefined) {
        columns.push("publicAddress");
      }

      // Calculate total connections
      let connections: number = 0;

      // Format room data
      const formattedRooms = paginatedRooms.map((room) => {
        const data = JSON.parse(JSON.stringify(room));

        // Count connections
        connections += room.clients;

        // Additional data
        data.locked = room.locked || false;
        data.private = room.private;
        data.maxClients = `${room.maxClients}`;
        data.elapsedTime = Date.now() - new Date(room.createdAt).getTime();

        return data;
      });

      // Get system information
      const cpu = await osUtils.cpu.usage();
      const memory = await osUtils.mem.used();

      // Return formatted response with pagination info
      res.json({
        columns,
        rooms: formattedRooms,
        pagination: {
          total: filteredRooms.length,
          page,
          limit,
          pages: Math.ceil(filteredRooms.length / limit),
        },
        connections,
        cpu,
        memory,
        // Include available actions if configured
        actions: {
          room: opts.actions?.room?.map((action) => ({
            id: action.id,
            name: action.name,
            description: action.description,
            icon: action.icon,
            confirmRequired: action.confirmRequired,
          })),
          client: opts.actions?.client?.map((action) => ({
            id: action.id,
            name: action.name,
            description: action.description,
            icon: action.icon,
            confirmRequired: action.confirmRequired,
          })),
        },
        // Include access control permissions
        access: opts.access,
      });
    } catch (e) {
      const message = e.message;
      handleError(res, message);
    }
  });

  // Get detailed room data
  api.get("/room", async (req: express.Request, res: express.Response) => {
    const roomId = req.query.roomId as string;

    try {
      // Check access permissions
      if (opts.access?.allowStateInspection === false) {
        return handleError(res, "State inspection is not allowed", 403);
      }

      const inspectData = await matchMaker.remoteRoomCall(
        roomId,
        "getInspectData",
      );

      // Add available room actions
      if (opts.actions?.room) {
        inspectData.actions = opts.actions.room.map((action) => ({
          id: action.id,
          name: action.name,
          description: action.description,
          icon: action.icon,
          confirmRequired: action.confirmRequired,
        }));
      }

      // Add available client actions
      if (opts.actions?.client) {
        inspectData.clientActions = opts.actions.client.map((action) => ({
          id: action.id,
          name: action.name,
          description: action.description,
          icon: action.icon,
          confirmRequired: action.confirmRequired,
        }));
      }

      res.json(inspectData);
    } catch (e) {
      const message = UNAVAILABLE_ROOM_ERROR.replace("$roomId", roomId);
      handleError(res, message);
    }
  });

  // Execute room method call (including standard and custom actions)
  api.get("/room/call", async (req: express.Request, res: express.Response) => {
    const roomId = req.query.roomId as string;
    const method = req.query.method as string;
    const args = JSON.parse((req.query.args as string) || "[]");

    try {
      // Check permissions for specific operations
      if (method === "disconnect" && opts.access?.allowRoomDisposal === false) {
        return handleError(res, "Room disposal is not allowed", 403);
      }

      if (
        method === "_sendMessageToClient" &&
        opts.access?.allowClientMessages === false
      ) {
        return handleError(res, "Sending client messages is not allowed", 403);
      }

      // Handle custom actions
      if (method.startsWith("customAction:")) {
        const actionId = method.replace("customAction:", "");

        // Find the custom room action
        const action = opts.actions?.room?.find((a) => a.id === actionId);

        if (action && action.handler) {
          // Call the handler function
          const data = await matchMaker.remoteRoomCall(
            roomId,
            action.handler,
            args,
          );
          return res.json(data);
        }

        return handleError(res, `Custom action ${actionId} not found`, 404);
      }

      // Handle custom client actions
      if (method.startsWith("customClientAction:")) {
        const parts = method.replace("customClientAction:", "").split(":");
        const actionId = parts[0];
        const clientId = parts[1];

        // Find the custom client action
        const action = opts.actions?.client?.find((a) => a.id === actionId);

        if (action && action.handler) {
          // Call the handler function with client ID
          const data = await matchMaker.remoteRoomCall(roomId, action.handler, [
            clientId,
            ...args,
          ]);
          return res.json(data);
        }

        return handleError(
          res,
          `Custom client action ${actionId} not found`,
          404,
        );
      }

      // Execute standard method call
      const data = await matchMaker.remoteRoomCall(roomId, method, args);
      res.json(data);
    } catch (e) {
      const message = UNAVAILABLE_ROOM_ERROR.replace("$roomId", roomId);
      handleError(res, message);
    }
  });

  // New endpoint: Get server metrics
  api.get("/metrics", async (req: express.Request, res: express.Response) => {
    try {
      const cpu = await osUtils.cpu.usage();
      const memory = await osUtils.mem.used();
      const drive = await osUtils.drive.info("/");
      const netStats = await osUtils.netstat.stats();

      res.json({
        cpu,
        memory,
        drive,
        netStats,
        timestamp: Date.now(),
      });
    } catch (e) {
      handleError(res, e.message);
    }
  });

  // Add health check endpoint
  api.get("/health", (req: express.Request, res: express.Response) => {
    res.json({ status: "ok" });
  });

  return api;
}
