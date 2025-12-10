export type MessageType = 
  | 'HOST_JOIN'
  | 'PLAYER_JOIN'
  | 'HOST_CONNECTED'
  | 'PLAYER_CONNECTED'
  | 'PLAYER_LIST'
  | 'PLAYER_DISCONNECTED'
  | 'ERROR'
  | 'PING'
  | 'PONG'
  | 'START_GAME'
  | 'GAME_STARTED'
  | 'PLAYER_CARD_DEALT'
  | 'MYSTERY_CARD_SET'
  | 'TIMELINE_UPDATED'
  | 'PLAY_MYSTERY_SONG'
  | 'MYSTERY_SONG_PLAYING'
  | 'STOP_MYSTERY_SONG'
  | 'MYSTERY_SONG_STOPPED'
  | 'REVEAL_MYSTERY_CARD'
  | 'MYSTERY_CARD_REVEALED'
  | 'NEXT_CARD'
  | 'NEXT_CARD_SET'
  | 'MYSTERY_CARD_REMOVED'
  | 'MYSTERY_CARD_CONVERTED'
  | 'REQUEST_STATE'
  | 'STATE_SYNC'
  | 'UPDATE_TIMELINE';

export interface WebSocketMessage {
  type: MessageType;
  [key: string]: any;
}

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000;
  private messageHandlers: Map<MessageType, ((message: WebSocketMessage) => void)[]> = new Map();
  private isConnecting = false;

  constructor(serverUrl: string = 'ws://localhost:3001') {
    this.url = serverUrl;
  }

  connect(): Promise<void> {
    if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.OPEN)) {
      return Promise.resolve();
    }

    this.isConnecting = true;

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
          console.log('WebSocket connected');
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message: WebSocketMessage = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (error) {
            console.error('Error parsing message:', error);
          }
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          this.isConnecting = false;
          reject(error);
        };

        this.ws.onclose = () => {
          console.log('WebSocket closed');
          this.isConnecting = false;
          this.attemptReconnect();
        };
      } catch (error) {
        this.isConnecting = false;
        reject(error);
      }
    });
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnect attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);

    setTimeout(() => {
      this.connect().catch(() => {
        // Reconnection will be attempted again in onclose
      });
    }, delay);
  }

  send(message: WebSocketMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.error('WebSocket is not open');
    }
  }

  on(type: MessageType, handler: (message: WebSocketMessage) => void): void {
    if (!this.messageHandlers.has(type)) {
      this.messageHandlers.set(type, []);
    }
    this.messageHandlers.get(type)!.push(handler);
  }

  off(type: MessageType, handler: (message: WebSocketMessage) => void): void {
    const handlers = this.messageHandlers.get(type);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  private handleMessage(message: WebSocketMessage): void {
    const handlers = this.messageHandlers.get(message.type);
    if (handlers) {
      handlers.forEach(handler => handler(message));
    }
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.messageHandlers.clear();
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}

