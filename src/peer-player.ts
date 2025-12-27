// PeerJS player implementation - replaces WebSocket client for player devices
import Peer, { DataConnection } from 'peerjs';

export type PlayerMessageHandler = (message: any) => void;

export class PeerPlayerManager {
  private peer: Peer | null = null;
  private hostConnection: DataConnection | null = null;
  private messageHandlers: Map<string, PlayerMessageHandler[]> = new Map();
  private playerId: string | null = null;

  // Connect to host peer
  async connect(hostPeerId: string, playerId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.playerId = playerId;

      // Create peer with unique ID for this player
      this.peer = new Peer(playerId, {
        debug: import.meta.env.DEV ? 2 : 0
      });

      this.peer.on('open', (id) => {
        console.log('Player peer initialized with ID:', id);

        // Connect to host
        this.hostConnection = this.peer!.connect(hostPeerId, {
          reliable: true
        });

        this.hostConnection.on('open', () => {
          console.log('Connected to host:', hostPeerId);
          resolve();
        });

        this.hostConnection.on('data', (data) => {
          this.handleMessage(data);
        });

        this.hostConnection.on('close', () => {
          console.log('Connection to host closed');
          this.emit('connection_closed', {});
        });

        this.hostConnection.on('error', (err) => {
          console.error('Connection error:', err);
          reject(err);
        });
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

  // Handle incoming message from host
  private handleMessage(data: any): void {
    try {
      const message = typeof data === 'string' ? JSON.parse(data) : data;
      console.log('Player received message:', message.type);

      // Emit to handlers
      this.emit(message.type, message);
    } catch (error) {
      console.error('Error handling message:', error);
    }
  }

  // Send message to host
  send(message: any): void {
    if (this.hostConnection && this.hostConnection.open) {
      this.hostConnection.send(message);
    } else {
      console.warn('No active connection to host');
    }
  }

  // Register message handler
  on(messageType: string, handler: PlayerMessageHandler): void {
    if (!this.messageHandlers.has(messageType)) {
      this.messageHandlers.set(messageType, []);
    }
    this.messageHandlers.get(messageType)!.push(handler);
  }

  // Remove message handler
  off(messageType: string, handler: PlayerMessageHandler): void {
    const handlers = this.messageHandlers.get(messageType);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index !== -1) {
        handlers.splice(index, 1);
      }
    }
  }

  // Emit message to handlers
  private emit(messageType: string, message: any): void {
    const handlers = this.messageHandlers.get(messageType);
    if (handlers) {
      handlers.forEach(handler => handler(message));
    }
  }

  // Check if connected to host
  isConnected(): boolean {
    return this.hostConnection ? this.hostConnection.open : false;
  }

  // Disconnect and cleanup
  disconnect(): void {
    if (this.hostConnection) {
      this.hostConnection.close();
      this.hostConnection = null;
    }

    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }

    this.playerId = null;
    this.messageHandlers.clear();
  }
}
