import type { WebSocket } from "ws";
import { connectionManager, type ConnectionMetadata } from "../connection.js";
import { createMessage, validateMessage, type Message } from "@hitster/proto";
import { logger } from "../logger.js";

/**
 * Manages room state and broadcasting.
 * Tracks which connections belong to which rooms.
 */
export class RoomManager {
  // Map connectionId -> roomId
  private connectionToRoom = new Map<string, string>();
  // Map roomId -> deviceId (host device)
  private roomToDevice = new Map<string, string>();

  /**
   * Associate a connection with a room.
   */
  associateConnection(connectionId: string, roomId: string): void {
    this.connectionToRoom.set(connectionId, roomId);
    const metadata = connectionManager.getConnection(connectionId);
    if (metadata) {
      metadata.roomId = roomId;
    }
    logger.debug({ connectionId, roomId }, "Connection associated with room");
  }

  /**
   * Remove a connection from its room.
   */
  disassociateConnection(connectionId: string): void {
    const roomId = this.connectionToRoom.get(connectionId);
    if (roomId) {
      this.connectionToRoom.delete(connectionId);
      const metadata = connectionManager.getConnection(connectionId);
      if (metadata) {
        metadata.roomId = undefined;
        metadata.playerId = undefined;
        metadata.roomKey = undefined;
      }
      logger.debug({ connectionId, roomId }, "Connection disassociated from room");
    }
  }

  /**
   * Get the room ID for a connection.
   */
  getRoomForConnection(connectionId: string): string | undefined {
    return this.connectionToRoom.get(connectionId);
  }

  /**
   * Get all connection IDs in a room.
   */
  getConnectionsInRoom(roomId: string): string[] {
    const connections: string[] = [];
    for (const [connectionId, connRoomId] of this.connectionToRoom.entries()) {
      if (connRoomId === roomId) {
        connections.push(connectionId);
      }
    }
    return connections;
  }

  /**
   * Broadcast a message to all connections in a room.
   */
  broadcastToRoom(roomId: string, message: unknown): void {
    // Validate message before sending
    const validation = validateMessage(message);
    if (!validation.success) {
      logger.error(
        {
          roomId,
          errors: validation.error.errors,
          messageType: (message as any)?.type,
        },
        "Attempted to broadcast invalid message"
      );
      return;
    }

    const connections = this.getConnectionsInRoom(roomId);
    const messageStr = JSON.stringify(validation.data);

    logger.info(
      {
        roomId,
        messageType: validation.data.type,
        totalConnections: connections.length,
        connectionIds: connections,
      },
      "Broadcasting message to room"
    );

    let sentCount = 0;
    for (const connectionId of connections) {
      const metadata = connectionManager.getConnection(connectionId);
      if (metadata && metadata.socket.readyState === WebSocket.OPEN) {
        try {
          metadata.socket.send(messageStr);
          sentCount++;
          logger.debug(
            {
              connectionId,
              roomId,
              messageType: validation.data.type,
              playerId: metadata.playerId,
            },
            "Sent broadcast message to connection"
          );
        } catch (error) {
          logger.error(
            {
              connectionId,
              roomId,
              error: error instanceof Error ? error.message : String(error),
            },
            "Failed to broadcast message to connection"
          );
        }
      } else {
        logger.warn(
          {
            connectionId,
            roomId,
            hasMetadata: !!metadata,
            socketState: metadata?.socket.readyState,
          },
          "Skipping broadcast - connection not ready"
        );
      }
    }

    logger.info(
      {
        roomId,
        connectionCount: connections.length,
        sentCount,
        messageType: validation.data.type,
      },
      "Broadcast message to room completed"
    );
  }

  /**
   * Send a message to a specific connection.
   */
  sendToConnection(connectionId: string, message: unknown): void {
    // Validate message before sending
    const validation = validateMessage(message);
    if (!validation.success) {
      logger.error(
        {
          connectionId,
          errors: validation.error.errors,
          messageType: (message as any)?.type,
        },
        "Attempted to send invalid message"
      );
      return;
    }

    const metadata = connectionManager.getConnection(connectionId);
    if (!metadata) {
      logger.warn({ connectionId }, "Cannot send message: connection not found");
      return;
    }

    if (metadata.socket.readyState !== WebSocket.OPEN) {
      logger.warn({ connectionId }, "Cannot send message: socket not open");
      return;
    }

    try {
      const messageStr = JSON.stringify(validation.data);
      metadata.socket.send(messageStr);
    } catch (error) {
      logger.error(
        {
          connectionId,
          error: error instanceof Error ? error.message : String(error),
        },
        "Failed to send message to connection"
      );
    }
  }

  /**
   * Send an error message to a connection.
   */
  sendError(connectionId: string, code: string, message: string): void {
    const errorMessage = createMessage("ERROR", { code, message });
    this.sendToConnection(connectionId, errorMessage);
  }

  /**
   * Get all rooms (for debugging/stats).
   */
  getRoomCount(): number {
    const roomSet = new Set(this.connectionToRoom.values());
    return roomSet.size;
  }

  /**
   * Set the host device for a room.
   */
  setHostDevice(roomId: string, deviceId: string): void {
    this.roomToDevice.set(roomId, deviceId);
    logger.debug({ roomId, deviceId }, "Host device registered for room");
  }

  /**
   * Get the host device for a room.
   */
  getHostDevice(roomId: string): string | null {
    return this.roomToDevice.get(roomId) || null;
  }
}

// Singleton instance
export const roomManager = new RoomManager();

