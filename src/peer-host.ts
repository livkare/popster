// PeerJS host implementation - replaces WebSocket server for host device
import Peer, { DataConnection } from 'peerjs';

export type PeerMessageHandler = (message: any, connection: DataConnection) => void;

export class PeerHostManager {
  private peer: Peer | null = null;
  private connections: Map<string, DataConnection> = new Map(); // playerId -> connection
  private messageHandlers: Map<string, PeerMessageHandler[]> = new Map();
  private peerId: string | null = null;

  // Initialize peer and create host server
  async initialize(gameId: string): Promise<string> {
    return new Promise((resolve, reject) => {
      // Use gameId as peer ID for simplicity
      this.peer = new Peer(gameId, {
        // Use public PeerJS server (can be replaced with custom server)
        debug: import.meta.env.DEV ? 2 : 0
      });

      this.peer.on('open', (id) => {
        console.log('Peer host initialized with ID:', id);
        this.peerId = id;
        resolve(id);
      });

      this.peer.on('connection', (conn) => {
        this.handleNewConnection(conn);
      });

      this.peer.on('error', (err) => {
        console.error('Peer error:', err);
        reject(err);
      });

      this.peer.on('disconnected', () => {
        console.log('Peer disconnected');
        // Try to reconnect
        if (this.peer && !this.peer.destroyed) {
          this.peer.reconnect();
        }
      });
    });
  }

  // Handle new player connection
  private handleNewConnection(conn: DataConnection): void {
    console.log('New peer connection from:', conn.peer);

    conn.on('open', () => {
      console.log('Connection opened with:', conn.peer);
    });

    conn.on('data', (data) => {
      this.handleMessage(data, conn);
    });

    conn.on('close', () => {
      console.log('Connection closed:', conn.peer);

      // Collect all keys to delete (avoid modifying Map during iteration)
      const keysToDelete: string[] = [];
      for (const [key, connection] of this.connections.entries()) {
        if (connection === conn) {
          keysToDelete.push(key);
        }
      }

      // Delete collected keys
      for (const key of keysToDelete) {
        this.connections.delete(key);
        this.emit('connection_closed', { peerId: key });
      }
    });

    conn.on('error', (err) => {
      console.error('Connection error:', err);
    });
  }

  // Handle incoming message
  private handleMessage(data: any, conn: DataConnection): void {
    try {
      const message = typeof data === 'string' ? JSON.parse(data) : data;
      console.log('Host received message:', message.type, 'from:', conn.peer);

      // Store connection using playerId as key (from PLAYER_JOIN message)
      if (message.type === 'PLAYER_JOIN' && message.playerId) {
        // Remove old connection under peer ID if it exists
        this.connections.delete(conn.peer);
        // Store under player ID
        this.connections.set(message.playerId, conn);
      }

      // Emit to handlers
      this.emit(message.type, message, conn);
    } catch (error) {
      console.error('Error handling message:', error);
    }
  }

  // Send message to specific player
  sendToPlayer(playerId: string, message: any): void {
    const conn = this.connections.get(playerId);
    if (conn && conn.open) {
      conn.send(message);
    } else {
      console.warn('No active connection for player:', playerId);
    }
  }

  // Broadcast message to all connected players
  broadcast(message: any): void {
    for (const [playerId, conn] of this.connections.entries()) {
      if (conn.open) {
        conn.send(message);
      }
    }
  }

  // Register message handler
  on(messageType: string, handler: PeerMessageHandler): void {
    if (!this.messageHandlers.has(messageType)) {
      this.messageHandlers.set(messageType, []);
    }
    this.messageHandlers.get(messageType)!.push(handler);
  }

  // Emit message to handlers
  private emit(messageType: string, message: any, conn?: DataConnection): void {
    const handlers = this.messageHandlers.get(messageType);
    if (handlers) {
      handlers.forEach(handler => handler(message, conn!));
    }
  }

  // Disconnect and cleanup
  disconnect(): void {
    // Close all connections
    for (const conn of this.connections.values()) {
      conn.close();
    }
    this.connections.clear();

    // Destroy peer
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }

    this.peerId = null;
    this.messageHandlers.clear();
  }
}
