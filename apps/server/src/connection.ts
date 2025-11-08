import type { WebSocket } from "ws";

export interface ConnectionMetadata {
  id: string;
  socket: WebSocket;
  connectedAt: Date;
  roomId?: string;
  playerId?: string;
  roomKey?: string;
}

/**
 * Connection manager for tracking active WebSocket connections.
 * Provides O(1) lookup and management of connections.
 */
export class ConnectionManager {
  private connections = new Map<string, ConnectionMetadata>();

  /**
   * Add a new connection to the manager.
   */
  addConnection(id: string, socket: WebSocket): void {
    this.connections.set(id, {
      id,
      socket,
      connectedAt: new Date(),
    });
  }

  /**
   * Remove a connection from the manager.
   */
  removeConnection(id: string): void {
    this.connections.delete(id);
  }

  /**
   * Get a connection by ID.
   */
  getConnection(id: string): ConnectionMetadata | undefined {
    return this.connections.get(id);
  }

  /**
   * Get all active connections.
   */
  getAllConnections(): ConnectionMetadata[] {
    return Array.from(this.connections.values());
  }

  /**
   * Get the count of active connections.
   */
  getConnectionCount(): number {
    return this.connections.size;
  }

  /**
   * Check if a connection exists.
   */
  hasConnection(id: string): boolean {
    return this.connections.has(id);
  }
}

// Singleton instance
export const connectionManager = new ConnectionManager();

