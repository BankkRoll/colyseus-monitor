const ENDPOINT = (
  process.env.GAME_SERVER_URL ||
  `${window.location.protocol}//${window.location.host}${window.location.pathname}`
).replace(/\/$/, ""); // remove trailing slash

// Get API prefix from options (if available via global variable)
const getApiPrefix = () => {
  const config = (window as any).__COLYSEUS_MONITOR_CONFIG || {};
  return config.apiPrefix || "/api";
};

// Basic error handling
const handleApiError = async (response: Response) => {
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || "API request failed");
  }
  return response.json();
};

// Enhanced room list fetching with filtering and pagination
export function fetchRoomList(
  options: {
    filter?: Record<string, any>;
    sort?: string;
    order?: "asc" | "desc";
    page?: number;
    limit?: number;
  } = {},
) {
  const { filter, sort, order, page, limit } = options;

  // Build query parameters
  const query = new URLSearchParams();
  if (filter) query.set("filter", JSON.stringify(filter));
  if (sort) query.set("sort", sort);
  if (order) query.set("order", order);
  if (page) query.set("page", page.toString());
  if (limit) query.set("limit", limit.toString());

  const queryStr = query.toString() ? `?${query.toString()}` : "";

  return fetch(`${ENDPOINT}${getApiPrefix()}${queryStr}`).then((response) =>
    handleApiError(response),
  );
}

// Enhanced room data fetching
export function fetchRoomData(roomId: string) {
  return fetch(`${ENDPOINT}${getApiPrefix()}/room?roomId=${roomId}`).then(
    (response) => handleApiError(response),
  );
}

// Call room method (regular or custom action)
export function remoteRoomCall(roomId: string, method: string, ...args: any[]) {
  const query = new URLSearchParams();
  query.set("roomId", roomId);
  query.set("method", method);
  query.set("args", JSON.stringify(args));

  return fetch(
    `${ENDPOINT}${getApiPrefix()}/room/call?${query.toString()}`,
  ).then((response) => handleApiError(response));
}

// Execute a custom room action
export function executeRoomAction(
  roomId: string,
  actionId: string,
  ...args: any[]
) {
  return remoteRoomCall(roomId, `customAction:${actionId}`, ...args);
}

// Execute a custom client action
export function executeClientAction(
  roomId: string,
  actionId: string,
  clientId: string,
  ...args: any[]
) {
  return remoteRoomCall(
    roomId,
    `customClientAction:${actionId}:${clientId}`,
    ...args,
  );
}

// Fetch server metrics
export function fetchServerMetrics() {
  return fetch(`${ENDPOINT}${getApiPrefix()}/metrics`).then((response) =>
    handleApiError(response),
  );
}

// Check server health
export function checkServerHealth() {
  return fetch(`${ENDPOINT}${getApiPrefix()}/health`).then((response) =>
    handleApiError(response),
  );
}

// Update room state at a specific path (if allowed)
export function updateRoomState(roomId: string, path: string, value: any) {
  return remoteRoomCall(roomId, "_updateRoomState", path, value);
}

// Get room logs (if enabled)
export function fetchRoomLogs(roomId: string) {
  return remoteRoomCall(roomId, "_getRoomLogs");
}
