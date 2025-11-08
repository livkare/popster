/**
 * Environment configuration for the web app
 */

// Get WebSocket URL from environment or use default
const getWebSocketURL = (): string => {
  if (import.meta.env.VITE_WS_URL) {
    return import.meta.env.VITE_WS_URL;
  }

  // Check if we're accessing via localhost or network IP
  const isLocalhost = window.location.hostname === 'localhost' || 
                     window.location.hostname === '127.0.0.1' ||
                     window.location.hostname === '';

  // If accessing from network IP (not localhost), use the same host for WebSocket
  // This allows phones/other devices on the network to connect
  if (!isLocalhost) {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // Use the same hostname but with server port (5173)
    const serverPort = import.meta.env.VITE_SERVER_PORT || '5173';
    return `${protocol}//${window.location.hostname}:${serverPort}/ws`;
  }

  // Default to localhost:5173 when accessing from localhost
  if (import.meta.env.DEV) {
    return 'ws://localhost:5173/ws';
  }

  // In production, use the same host as the page
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host;
  return `${protocol}//${host}/ws`;
};

// Get API URL from environment or use default
const getAPIURL = (): string => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }

  // Check if we're accessing via localhost or network IP
  const isLocalhost = window.location.hostname === 'localhost' || 
                     window.location.hostname === '127.0.0.1' ||
                     window.location.hostname === '';

  // If accessing from network IP (not localhost), use the same hostname with server port
  // This allows phones/other devices on the network to connect
  if (!isLocalhost) {
    const serverPort = import.meta.env.VITE_SERVER_PORT || '5173';
    return `http://${window.location.hostname}:${serverPort}`;
  }

  // Default to localhost:5173 when accessing from localhost
  if (import.meta.env.DEV) {
    return 'http://localhost:5173';
  }

  // In production, use the same host as the page
  return window.location.origin;
};

export const WS_URL = getWebSocketURL();
export const API_URL = getAPIURL();

/**
 * Check if we're in development mode
 */
export const isDev = import.meta.env.DEV;

/**
 * Check if we're in production mode
 */
export const isProd = import.meta.env.PROD;

