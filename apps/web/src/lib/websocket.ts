import type { Message } from "@hitster/proto";
import { createMessage, validateMessage } from "@hitster/proto";
import { WS_URL } from "../config.js";

type MessageHandler = (message: Message) => void;
type ConnectionStateHandler = (connected: boolean) => void;

export class WebSocketManager {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000; // Start with 1 second
  private maxReconnectDelay = 30000; // Max 30 seconds
  private reconnectTimeout: number | null = null;
  private connectionTimeout: number | null = null;
  private connectionTimeoutDelay = 5000; // 5 seconds timeout for initial connection
  private heartbeatInterval: number | null = null;
  private heartbeatDelay = 30000; // 30 seconds
  private messageHandlers = new Set<MessageHandler>();
  private connectionStateHandlers = new Set<ConnectionStateHandler>();
  private messageQueue: string[] = [];
  private isManualClose = false;

  /**
   * Connect to the WebSocket server
   */
  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return; // Already connected
    }

    if (this.ws?.readyState === WebSocket.CONNECTING) {
      return; // Already connecting
    }

    this.isManualClose = false;
    this.connectInternal();
  }

  private connectInternal(): void {
    try {
      // Clear any existing connection timeout
      this.clearConnectionTimeout();

      this.ws = new WebSocket(WS_URL);

      // Set connection timeout - if connection doesn't succeed within timeout, treat as failed
      this.connectionTimeout = window.setTimeout(() => {
        if (this.ws?.readyState === WebSocket.CONNECTING) {
          console.warn("[WebSocket] Connection timeout - server may not be running");
          this.ws.close();
          this.notifyConnectionState(false);
          // Schedule reconnect attempt
          if (!this.isManualClose && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.scheduleReconnect();
          }
        }
      }, this.connectionTimeoutDelay);

      this.ws.onopen = () => {
        console.log("WebSocket connected");
        this.clearConnectionTimeout();
        this.reconnectAttempts = 0;
        this.reconnectDelay = 1000;
        this.notifyConnectionState(true);
        this.startHeartbeat();
        this.flushMessageQueue();
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const validation = validateMessage(data);

          if (validation.success) {
            this.handleMessage(validation.data);
          } else {
            // Log validation errors but don't show them to users
            // These are typically protocol mismatches or malformed messages
            console.warn("[WebSocket] Invalid message received:", {
              error: validation.error.errors,
              receivedData: data,
            });
            // Don't set connection error for validation failures - these are expected
            // during development or when protocol versions mismatch
          }
        } catch (error) {
          console.error("[WebSocket] Failed to parse WebSocket message:", error);
        }
      };

      this.ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        this.clearConnectionTimeout();
        this.notifyConnectionState(false);
      };

      this.ws.onclose = () => {
        console.log("WebSocket closed");
        this.clearConnectionTimeout();
        this.stopHeartbeat();
        this.notifyConnectionState(false);

        // Attempt to reconnect if not manually closed
        if (!this.isManualClose && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.scheduleReconnect();
        }
      };
    } catch (error) {
      console.error("Failed to create WebSocket connection:", error);
      this.clearConnectionTimeout();
      this.notifyConnectionState(false);
      this.scheduleReconnect();
    }
  }

  /**
   * Disconnect from the WebSocket server
   */
  disconnect(): void {
    this.isManualClose = true;
    this.stopHeartbeat();
    this.clearReconnectTimeout();
    this.clearConnectionTimeout();

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.notifyConnectionState(false);
  }

  /**
   * Send a message to the server
   */
  sendMessage(message: Message): void {
    const messageStr = JSON.stringify(message);

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(messageStr);
    } else {
      // Queue message for when connection is established
      this.messageQueue.push(messageStr);
    }
  }

  /**
   * Subscribe to incoming messages
   */
  onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.add(handler);
    return () => {
      this.messageHandlers.delete(handler);
    };
  }

  /**
   * Subscribe to connection state changes
   */
  onConnectionStateChange(handler: ConnectionStateHandler): () => void {
    this.connectionStateHandlers.add(handler);
    return () => {
      this.connectionStateHandlers.delete(handler);
    };
  }

  /**
   * Get current connection state
   */
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Get current connection state string
   */
  getConnectionState(): "connecting" | "connected" | "disconnected" {
    if (!this.ws) {
      return "disconnected";
    }

    switch (this.ws.readyState) {
      case WebSocket.CONNECTING:
        return "connecting";
      case WebSocket.OPEN:
        return "connected";
      default:
        return "disconnected";
    }
  }

  private handleMessage(message: Message): void {
    // Handle PONG messages internally
    if (message.type === "PONG") {
      return; // Heartbeat response
    }

    // Notify all handlers
    this.messageHandlers.forEach((handler) => {
      try {
        handler(message);
      } catch (error) {
        console.error("Error in message handler:", error);
      }
    });
  }

  private notifyConnectionState(connected: boolean): void {
    this.connectionStateHandlers.forEach((handler) => {
      try {
        handler(connected);
      } catch (error) {
        console.error("Error in connection state handler:", error);
      }
    });
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatInterval = window.setInterval(() => {
      if (this.isConnected() && this.ws) {
        // Send PING as plain string (server expects "PING" or '{"type":"PING"}')
        // Using plain string for simplicity
        this.ws.send("PING");
      }
    }, this.heartbeatDelay);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval !== null) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private scheduleReconnect(): void {
    this.clearReconnectTimeout();

    this.reconnectAttempts++;
    const delay = Math.min(
      this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
      this.maxReconnectDelay
    );

    console.log(`Scheduling reconnect attempt ${this.reconnectAttempts} in ${delay}ms`);

    this.reconnectTimeout = window.setTimeout(() => {
      this.connectInternal();
    }, delay);
  }

  private clearReconnectTimeout(): void {
    if (this.reconnectTimeout !== null) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }

  private clearConnectionTimeout(): void {
    if (this.connectionTimeout !== null) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = null;
    }
  }

  private flushMessageQueue(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      while (this.messageQueue.length > 0) {
        const message = this.messageQueue.shift();
        if (message) {
          this.ws.send(message);
        }
      }
    }
  }
}

// Singleton instance
export const wsManager = new WebSocketManager();

