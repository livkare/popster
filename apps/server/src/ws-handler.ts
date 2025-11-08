import type { FastifyRequest } from "fastify";
import type { WebSocket } from "ws";
import { v4 as uuidv4 } from "uuid";
import { connectionManager } from "./connection.js";
import { messageRouter } from "./router.js";
import { logger } from "./logger.js";
import { roomManager } from "./room/room-manager.js";
import { handleLeave } from "./room/handlers.js";
import { createMessage, validateMessage } from "@hitster/proto";

/**
 * Handle WebSocket connection lifecycle.
 * In @fastify/websocket v8, the connection parameter is the WebSocket itself.
 */
export async function handleWebSocket(
  connection: WebSocket,
  _request: FastifyRequest
): Promise<void> {
  const connectionId = uuidv4();
  const socket = connection;

  // Add connection to manager
  connectionManager.addConnection(connectionId, socket);
  logger.info({ connectionId }, "WebSocket connection established");

  // Handle incoming messages
  socket.on("message", (rawMessage: Buffer) => {
    const messageStr = rawMessage.toString("utf-8");

    // Handle PING (heartbeat)
    if (messageStr === "PING" || messageStr.trim() === '{"type":"PING"}') {
      try {
        const pongMessage = createMessage("PONG", {});
        // Validate before sending
        const validation = validateMessage(pongMessage);
        if (!validation.success) {
          logger.error(
            {
              connectionId,
              errors: validation.error.errors,
            },
            "PONG message validation failed"
          );
          return;
        }
        socket.send(JSON.stringify(validation.data));
        logger.debug({ connectionId }, "Sent PONG response");
      } catch (error) {
        logger.error(
          {
            connectionId,
            error: error instanceof Error ? error.message : String(error),
          },
          "Failed to send PONG"
        );
      }
      return;
    }

    // Process regular message
    messageRouter.processMessage(connectionId, socket, messageStr).catch((error) => {
      logger.error(
        {
          connectionId,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        },
        "Unhandled error in message router"
      );
    });
  });

  // Handle connection close
  socket.on("close", async (code: number, reason: Buffer) => {
    // Clean up room association if player was in a room
    const roomId = roomManager.getRoomForConnection(connectionId);
    if (roomId) {
      // Handle player leave (this will remove from DB and broadcast)
      // Note: We pass empty playerId since handleLeave looks up by socketId
      try {
        await handleLeave(connectionId, socket, { playerId: "" });
      } catch (error) {
        logger.error(
          {
            connectionId,
            error: error instanceof Error ? error.message : String(error),
          },
          "Error during connection close cleanup"
        );
        // Still try to disassociate even if leave handler failed
        roomManager.disassociateConnection(connectionId);
      }
    } else {
      // Just disassociate if not in a room
      roomManager.disassociateConnection(connectionId);
    }

    // Remove from connection manager
    connectionManager.removeConnection(connectionId);
    logger.info(
      {
        connectionId,
        code,
        reason: reason.toString("utf-8") || undefined,
      },
      "WebSocket connection closed"
    );
  });

  // Handle connection errors
  socket.on("error", (error: Error) => {
    logger.error(
      {
        connectionId,
        error: error.message,
        stack: error.stack,
      },
      "WebSocket connection error"
    );

    // Try to send error message to client
    try {
      const errorMessage = createMessage("ERROR", {
        code: "CONNECTION_ERROR",
        message: "Connection error occurred",
      });
      // Validate before sending
      const validation = validateMessage(errorMessage);
      if (validation.success) {
        socket.send(JSON.stringify(validation.data));
      }
    } catch {
      // Ignore errors when sending error message
    }

    // Clean up room association if player was in a room
    const roomId = roomManager.getRoomForConnection(connectionId);
    if (roomId) {
      roomManager.disassociateConnection(connectionId);
    }

    // Remove connection on error
    connectionManager.removeConnection(connectionId);
  });
}

