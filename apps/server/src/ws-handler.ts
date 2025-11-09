import type { FastifyRequest } from "fastify";
import type { WebSocket } from "ws";
import { v4 as uuidv4 } from "uuid";
import { connectionManager } from "./connection.js";
import { messageRouter } from "./router.js";
import { logger } from "./logger.js";
import { roomManager } from "./room/room-manager.js";
import { handleLeave } from "./room/handlers.js";
import { createMessage, validateMessage } from "@hitster/proto";
import { getPlayerModel } from "./room/handlers.js";

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
    // Mark player as disconnected instead of removing them
    const playerModel = getPlayerModel();
    if (playerModel) {
      const player = playerModel.getPlayerBySocketId(connectionId);
      if (player) {
        // Mark as disconnected but keep in database
        playerModel.markPlayerDisconnected(player.id);
        logger.info(
          {
            connectionId,
            playerId: player.id,
            roomId: player.roomId,
          },
          "Player marked as disconnected"
        );

        // Broadcast updated room state with disconnected player
        const roomId = player.roomId;
        const players = playerModel.getRoomPlayers(roomId);
        const { getRoomModel } = await import("./room/handlers.js");
        const roomModel = getRoomModel();
        if (roomModel) {
          const room = roomModel.getRoomById(roomId);
          if (room) {
            const { gameStateManager } = await import("./game/game-state-manager.js");
            const currentGameState = gameStateManager.getGameState(roomId);
            const roomStateResponse = createMessage("ROOM_STATE", {
              roomKey: room.roomKey,
              players: players.map((p) => ({
                id: p.id,
                name: p.name,
                avatar: p.avatar,
                connected: p.connected,
              })),
              gameState: currentGameState
                ? {
                    status: currentGameState.status,
                    currentRound: currentGameState.currentRound,
                    currentTrack:
                      currentGameState.rounds[currentGameState.currentRound]?.currentCard.trackUri,
                  }
                : undefined,
            });
            roomManager.broadcastToRoom(roomId, roomStateResponse);
          }
        }
      }
    }

    // Clean up room association
    const roomId = roomManager.getRoomForConnection(connectionId);
    if (roomId) {
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

