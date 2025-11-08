import { networkInterfaces } from "node:os";

/**
 * Get the local IP address (preferring IPv4).
 * Returns the first non-internal IPv4 address found.
 */
export function getLocalIP(): string {
  const interfaces = networkInterfaces();

  for (const name of Object.keys(interfaces)) {
    const nets = interfaces[name];
    if (!nets) continue;

    for (const net of nets) {
      // Skip internal (i.e. 127.0.0.1) and non-IPv4 addresses
      if (net.family === "IPv4" && !net.internal) {
        return net.address;
      }
    }
  }

  // Fallback to localhost if no external IP found
  return "127.0.0.1";
}

/**
 * Generate a room URL for the frontend.
 * The frontend runs on port 3000 (or VITE_PORT), and the server on port 5173.
 * QR codes should point to the frontend, not the server.
 */
export function generateRoomURL(roomKey: string, serverPort: number): string {
  const ip = getLocalIP();
  // Frontend port - check environment variable or default to 3000
  const frontendPort = Number.parseInt(process.env.VITE_PORT || "3000", 10);
  // Use the frontend URL with the room route format
  return `http://${ip}:${frontendPort}/room/${roomKey}`;
}

