import type { WebSocket } from "ws";
import { validateMessage, createMessage, type Message } from "@hitster/proto";
import { logger } from "./logger.js";
import { roomManager } from "./room/room-manager.js";
import {
  handleCreateRoom,
  handleJoinRoom,
  handleLeave,
} from "./room/handlers.js";
import {
  handleStartRound,
  handlePlace,
  handleChallenge,
  handleReveal,
} from "./game/handlers.js";

export interface MessageHandlerContext {
  connectionId: string;
  socket: WebSocket;
  message: Message;
}

type MessageHandler = (ctx: MessageHandlerContext) => void | Promise<void>;

/**
 * Message router that validates and routes WebSocket messages.
 * Handlers are placeholders in Phase 3 - will be implemented in Phase 5.
 */
export class MessageRouter {
  private handlers = new Map<Message["type"], MessageHandler>();

  /**
   * Register a handler for a specific message type.
   */
  registerHandler(type: Message["type"], handler: MessageHandler): void {
    this.handlers.set(type, handler);
  }

  /**
   * Process an incoming message from a WebSocket connection.
   * Validates the message and routes it to the appropriate handler.
   */
  async processMessage(
    connectionId: string,
    socket: WebSocket,
    rawMessage: string
  ): Promise<void> {
    try {
      // Parse JSON
      let parsed: unknown;
      try {
        parsed = JSON.parse(rawMessage);
      } catch (error) {
        logger.warn(
          { connectionId, error: error instanceof Error ? error.message : String(error) },
          "Failed to parse message as JSON"
        );
        this.sendError(socket, "INVALID_JSON", "Message must be valid JSON");
        return;
      }

      // Validate message structure
      const validation = validateMessage(parsed);
      if (!validation.success) {
        logger.warn(
          { 
            connectionId, 
            errors: validation.error.errors,
            receivedMessage: parsed, // Log the actual message received
          },
          "Message validation failed"
        );
        this.sendError(
          socket,
          "INVALID_MESSAGE",
          `Invalid message: ${validation.error.errors.map((e) => e.message).join(", ")}`
        );
        return;
      }

      const message = validation.data;

      // Log message receipt
      logger.debug({ connectionId, messageType: message.type }, "Received message");

      // Room key validation (except for CREATE_ROOM, JOIN_ROOM, and REQUEST_ROOM_STATE)
      if (
        message.type !== "CREATE_ROOM" &&
        message.type !== "JOIN_ROOM" &&
        message.type !== "REQUEST_ROOM_STATE" &&
        message.type !== "PING" &&
        message.type !== "PONG"
      ) {
        const roomId = roomManager.getRoomForConnection(connectionId);
        if (!roomId) {
          logger.warn({ connectionId, messageType: message.type }, "Message requires room association");
          this.sendError(
            socket,
            "NOT_IN_ROOM",
            "You must be in a room to send this message"
          );
          return;
        }
      }

      // Route to handler
      const handler = this.handlers.get(message.type);
      if (handler) {
        await handler({
          connectionId,
          socket,
          message,
        });
      } else {
        logger.warn({ connectionId, messageType: message.type }, "No handler registered for message type");
        this.sendError(
          socket,
          "UNHANDLED_MESSAGE",
          `No handler registered for message type: ${message.type}`
        );
      }
    } catch (error) {
      logger.error(
        {
          connectionId,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        },
        "Error processing message"
      );
      this.sendError(socket, "INTERNAL_ERROR", "An error occurred processing your message");
    }
  }

  /**
   * Send an error message to a client.
   */
  private sendError(socket: WebSocket, code: string, message: string): void {
    try {
      const errorMessage = createMessage("ERROR", { code, message });
      socket.send(JSON.stringify(errorMessage));
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        "Failed to send error message"
      );
    }
  }
}

// Singleton instance
export const messageRouter = new MessageRouter();

// Register game action handlers (Phase 5)
messageRouter.registerHandler("START_ROUND", async (ctx) => {
  if (ctx.message.type === "START_ROUND") {
    await handleStartRound(ctx.connectionId, ctx.socket, ctx.message.payload);
  }
});

messageRouter.registerHandler("PLACE", async (ctx) => {
  if (ctx.message.type === "PLACE") {
    await handlePlace(ctx.connectionId, ctx.socket, ctx.message.payload);
  }
});

messageRouter.registerHandler("CHALLENGE", async (ctx) => {
  if (ctx.message.type === "CHALLENGE") {
    await handleChallenge(ctx.connectionId, ctx.socket, ctx.message.payload);
  }
});

messageRouter.registerHandler("REVEAL", async (ctx) => {
  if (ctx.message.type === "REVEAL") {
    await handleReveal(ctx.connectionId, ctx.socket, ctx.message.payload);
  }
});

// Register other handlers
messageRouter.registerHandler("SEAT", async (ctx) => {
  logger.info({ connectionId: ctx.connectionId }, "SEAT message received (placeholder)");
});

// START_SONG is sent by server, not received
messageRouter.registerHandler("START_SONG", async (ctx) => {
  logger.warn({ connectionId: ctx.connectionId }, "START_SONG message received but server only sends this message");
});

messageRouter.registerHandler("ROUND_SUMMARY", async (ctx) => {
  logger.info({ connectionId: ctx.connectionId }, "ROUND_SUMMARY message received (placeholder)");
});

messageRouter.registerHandler("CREATE_ROOM", async (ctx) => {
  if (ctx.message.type === "CREATE_ROOM") {
    await handleCreateRoom(ctx.connectionId, ctx.socket, ctx.message.payload);
  }
});

messageRouter.registerHandler("JOIN_ROOM", async (ctx) => {
  if (ctx.message.type === "JOIN_ROOM") {
    await handleJoinRoom(ctx.connectionId, ctx.socket, ctx.message.payload);
  }
});

messageRouter.registerHandler("LEAVE", async (ctx) => {
  if (ctx.message.type === "LEAVE") {
    await handleLeave(ctx.connectionId, ctx.socket, ctx.message.payload);
  }
});

messageRouter.registerHandler("ROOM_STATE", async (ctx) => {
  logger.info({ connectionId: ctx.connectionId }, "ROOM_STATE message received (placeholder)");
});

messageRouter.registerHandler("PONG", async (ctx) => {
  logger.debug({ connectionId: ctx.connectionId }, "PONG message received");
});

messageRouter.registerHandler("REGISTER_DEVICE", async (ctx) => {
  if (ctx.message.type !== "REGISTER_DEVICE") {
    return;
  }

  const { deviceId } = ctx.message.payload;
  const roomId = roomManager.getRoomForConnection(ctx.connectionId);

  if (!roomId) {
    roomManager.sendError(
      ctx.connectionId,
      "NOT_IN_ROOM",
      "You must be in a room to register a device"
    );
    return;
  }

  // Store device for room
  roomManager.setHostDevice(roomId, deviceId);

  // Send confirmation
  const confirmation = createMessage("DEVICE_REGISTERED", {
    deviceId,
    success: true,
  });
  roomManager.sendToConnection(ctx.connectionId, confirmation);

  logger.info({ connectionId: ctx.connectionId, roomId, deviceId }, "Device registered");
});

messageRouter.registerHandler("REQUEST_ROOM_STATE", async (ctx) => {
  if (ctx.message.type !== "REQUEST_ROOM_STATE") {
    return;
  }

  logger.info({ connectionId: ctx.connectionId }, "REQUEST_ROOM_STATE handler called");
  const { roomKey } = ctx.message.payload;
  logger.info({ connectionId: ctx.connectionId, roomKey }, "Processing REQUEST_ROOM_STATE");
  
  // Import handlers to access models
  const { getRoomModel, getPlayerModel } = await import("./room/handlers.js");
  const roomModel = getRoomModel();
  const playerModel = getPlayerModel();
  
  if (!roomModel || !playerModel) {
    roomManager.sendError(ctx.connectionId, "SERVER_ERROR", "Models not initialized");
    return;
  }
  
  // Find room by key
  const room = roomModel.getRoomByKey(roomKey);
  if (!room) {
    roomManager.sendError(ctx.connectionId, "ROOM_NOT_FOUND", "Room not found");
    return;
  }

  // Re-associate connection with room (in case connection changed)
  roomManager.associateConnection(ctx.connectionId, room.id);
  
  // Update connection metadata
  const { connectionManager } = await import("./connection.js");
  const metadata = connectionManager.getConnection(ctx.connectionId);
  if (metadata) {
    metadata.roomId = room.id;
    metadata.roomKey = room.roomKey;
  }

  // Get all players in room
  const players = playerModel.getRoomPlayers(room.id);
  
  // Get current game state
  const { gameStateManager } = await import("./game/game-state-manager.js");
  const currentGameState = gameStateManager.getGameState(room.id);

  // Send ROOM_STATE response
  const roomStateResponse = createMessage("ROOM_STATE", {
    roomKey: room.roomKey,
    players: players.map((p) => ({
      id: p.id,
      name: p.name,
      avatar: p.avatar,
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

  roomManager.sendToConnection(ctx.connectionId, roomStateResponse);

  logger.info(
    {
      connectionId: ctx.connectionId,
      roomId: room.id,
      roomKey: room.roomKey,
      playersCount: players.length,
    },
    "Room state requested and sent"
  );
});

