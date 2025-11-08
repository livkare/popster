import "dotenv/config";
import { fileURLToPath } from "url";
import { resolve } from "path";
import Fastify from "fastify";
import websocket from "@fastify/websocket";
import type Database from "better-sqlite3";
import { logger } from "./logger.js";
import { registerErrorHandler } from "./error-handler.js";
import { registerHealthRoute } from "./routes/health.js";
import { registerInfoRoute } from "./routes/info.js";
import { registerQrRoute } from "./routes/qr.js";
import { registerSpotifyRoute } from "./routes/spotify.js";
import { handleWebSocket } from "./ws-handler.js";
import { initializeDatabase } from "./db/database.js";
import { RoomModel, PlayerModel } from "./db/models.js";
import { initializeHandlers } from "./room/handlers.js";
import { initializeCleanup, startCleanup, stopCleanup } from "./room/cleanup.js";
import { startMdnsService, stopMdnsService } from "./discovery/mdns.js";
import { gameStateManager } from "./game/game-state-manager.js";
import { initializeGameHandlers } from "./game/handlers.js";

const PORT = Number.parseInt(process.env.PORT || "5173", 10);

// Global database instance
let db: Database.Database | null = null;

/**
 * Create and configure the Fastify server instance.
 */
async function createServer() {
  const server = Fastify({
    logger,
  });

  // Add CORS headers manually
  server.addHook("onRequest", async (request, reply) => {
    reply.header("Access-Control-Allow-Origin", "*");
    reply.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    reply.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    
    // Handle preflight requests
    if (request.method === "OPTIONS") {
      return reply.send();
    }
  });

  // Register WebSocket plugin
  await server.register(websocket);

  // Register error handler
  await registerErrorHandler(server as any);

  // Initialize database
  db = initializeDatabase();
  const roomModel = new RoomModel(db);
  const playerModel = new PlayerModel(db);

  // Initialize game state manager
  gameStateManager.initialize(roomModel);

  // Initialize game handlers
  initializeGameHandlers(roomModel);

  // Initialize room handlers
  initializeHandlers(roomModel, playerModel);

  // Initialize room cleanup
  initializeCleanup(roomModel, playerModel);

  // Register HTTP routes
  await registerHealthRoute(server as any);
  await registerInfoRoute(server as any, roomModel);
  await registerQrRoute(server as any);
  await registerSpotifyRoute(server as any);

  // Register WebSocket route
  server.get("/ws", { websocket: true }, handleWebSocket as any);

  return { server, roomModel };
}

/**
 * Start the server.
 */
async function start(): Promise<void> {
  try {
    const { server } = await createServer();

    // Load existing game states from database
    gameStateManager.loadAllGameStates();

    // Start mDNS service
    startMdnsService(PORT);

    // Start room cleanup task
    startCleanup();

    // Start listening
    await server.listen({ port: PORT, host: "0.0.0.0" });

    logger.info({ port: PORT }, "Server started successfully");

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info({ signal }, "Received shutdown signal, closing server");
      try {
        // Stop room cleanup
        stopCleanup();

        // Stop mDNS service
        stopMdnsService();

        // Close database
        if (db) {
          db.close();
          logger.info("Database closed");
        }

        // Close server
        await server.close();
        logger.info("Server closed gracefully");
        process.exit(0);
      } catch (error) {
        logger.error(
          {
            error: error instanceof Error ? error.message : String(error),
          },
          "Error during shutdown"
        );
        process.exit(1);
      }
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));

    // Handle uncaught errors
    process.on("unhandledRejection", (reason) => {
      logger.error(
        {
          reason: reason instanceof Error ? reason.message : String(reason),
          stack: reason instanceof Error ? reason.stack : undefined,
        },
        "Unhandled promise rejection"
      );
    });

    process.on("uncaughtException", (error) => {
      logger.error(
        {
          error: error.message,
          stack: error.stack,
        },
        "Uncaught exception"
      );
      process.exit(1);
    });
  } catch (error) {
    logger.fatal(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      "Failed to start server"
    );
    process.exit(1);
  }
}

// Start server if this is the main module
// In ES modules, check if this file is being run directly (not imported)
// process.argv[1] contains the path to the script being executed
// We need to normalize paths for comparison
const currentFile = fileURLToPath(import.meta.url);
const entryFile = resolve(process.argv[1]);

if (currentFile === entryFile) {
  start();
}

// Export for testing
export { createServer };
