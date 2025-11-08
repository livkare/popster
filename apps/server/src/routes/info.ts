import type { FastifyReply, FastifyRequest } from "fastify";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { connectionManager } from "../connection.js";
import type { RoomModel } from "../db/models.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Get server version from package.json.
 */
function getServerVersion(): string {
  try {
    const packageJsonPath = join(__dirname, "../../package.json");
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
    return packageJson.version || "unknown";
  } catch {
    return "unknown";
  }
}

/**
 * Register server info endpoint.
 * GET /api/info
 */
export async function registerInfoRoute(fastify: any, roomModel: RoomModel): Promise<void> {
  fastify.get("/api/info", async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({
      version: getServerVersion(),
      connections: connectionManager.getConnectionCount(),
      rooms: roomModel.getRoomCount(),
    });
  });
}

