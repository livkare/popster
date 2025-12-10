import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useConnectionStore } from "../store/index.js";
import { wsManager } from "../lib/websocket.js";

export function ConnectionStatus() {
  const { connected, connecting, setConnected, setConnecting } = useConnectionStore();
  const location = useLocation();
  const isCallbackPage = location.pathname === "/callback";

  // Always sync with actual WebSocket state on mount and periodically
  // This ensures the status is always accurate, especially after redirects
  useEffect(() => {
    // Check initial state
    const syncState = () => {
      const actualState = wsManager.getConnectionState();
      const isActuallyConnected = wsManager.isConnected();
      
      // Get current store state to avoid unnecessary updates
      const currentConnected = useConnectionStore.getState().connected;
      const currentConnecting = useConnectionStore.getState().connecting;
      
      if (actualState === "connected" && isActuallyConnected) {
        if (!currentConnected) {
          setConnected(true);
          setConnecting(false);
        }
      } else if (actualState === "connecting") {
        if (!currentConnecting) {
          setConnecting(true);
          setConnected(false);
        }
      } else {
        if (currentConnected || currentConnecting) {
          setConnected(false);
          setConnecting(false);
        }
      }
    };

    // Sync immediately
    syncState();

    // Subscribe to connection state changes
    const unsubscribe = wsManager.onConnectionStateChange((isConnected) => {
      setConnected(isConnected);
      setConnecting(false);
    });

    // Also poll periodically to catch any state mismatches (every 2 seconds)
    const pollInterval = setInterval(syncState, 2000);

    return () => {
      unsubscribe();
      clearInterval(pollInterval);
    };
  }, [setConnected, setConnecting]);

  // On callback page, show processing state instead of disconnected
  // This prevents the red cross from appearing before green check
  if (isCallbackPage && !connected && !connecting) {
    return (
      <div className="flex items-center gap-2 text-sm text-yellow-600">
        <div className="h-2 w-2 rounded-full bg-yellow-500 animate-pulse" aria-hidden="true" />
        <span>Processing...</span>
      </div>
    );
  }

  if (connected) {
    return (
      <div className="flex items-center gap-2 text-sm text-green-600">
        <div className="h-2 w-2 rounded-full bg-green-500" aria-hidden="true" />
        <span>Connected</span>
      </div>
    );
  }

  if (connecting) {
    return (
      <div className="flex items-center gap-2 text-sm text-yellow-600">
        <div className="h-2 w-2 rounded-full bg-yellow-500 animate-pulse" aria-hidden="true" />
        <span>Connecting...</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-sm text-red-600">
      <div className="h-2 w-2 rounded-full bg-red-500" aria-hidden="true" />
      <span>Disconnected</span>
    </div>
  );
}

