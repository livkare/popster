import { useState, useEffect } from "react";
import { useSpotifyStore } from "../store/spotify-store.js";
import { useConnectionStore } from "../store/connection-store.js";
import { useRoomStore } from "../store/room-store.js";
import { usePlayerStore } from "../store/player-store.js";
import { getRoomState } from "../lib/room-storage.js";
import { wsManager } from "../lib/websocket.js";

export function DebugPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  
  // Get all store states (these will auto-update when stores change)
  const spotifyState = useSpotifyStore();
  const connectionState = useConnectionStore();
  const roomState = useRoomStore();
  const playerState = usePlayerStore();
  
  // Force refresh every second to show real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      setRefreshKey(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);
  
  // Get persisted state (refresh on key change)
  const persistedState = getRoomState();
  
  // Get WebSocket state
  const wsConnected = wsManager.isConnected();
  const wsState = wsManager.getConnectionState();
  
  // Only show in development or if explicitly enabled
  const showDebug = import.meta.env.DEV || localStorage.getItem("hitster-debug") === "true";
  
  if (!showDebug) {
    return null;
  }
  
  return (
    <div className="fixed bottom-0 right-0 z-50 max-w-md">
      {!isOpen ? (
        <button
          onClick={() => setIsOpen(true)}
          className="bg-blue-600 text-white px-3 py-2 rounded-tl-lg text-xs font-mono shadow-lg hover:bg-blue-700"
          title="Open Debug Panel"
        >
          🐛 Debug
        </button>
      ) : (
        <div className="bg-gray-900 text-gray-100 text-xs font-mono border-t border-l border-gray-700 shadow-2xl max-h-[80vh] overflow-y-auto">
          {/* Header */}
          <div className="bg-gray-800 px-3 py-2 flex items-center justify-between border-b border-gray-700 sticky top-0">
            <div className="flex items-center gap-2">
              <span>🐛</span>
              <span className="font-semibold">Debug Panel</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="text-gray-400 hover:text-gray-200"
                title={isExpanded ? "Collapse" : "Expand"}
              >
                {isExpanded ? "−" : "+"}
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-gray-200"
                title="Close"
              >
                ✕
              </button>
            </div>
          </div>
          
          {/* Content */}
          <div className="p-3 space-y-3">
            {/* Spotify State */}
            <div className="border-b border-gray-700 pb-2">
              <div className="font-semibold text-blue-400 mb-1">Spotify</div>
              <div className="space-y-1 pl-2">
                <div className="flex items-center gap-2">
                  <span className={spotifyState.isAuthenticated ? "text-green-400" : "text-red-400"}>
                    {spotifyState.isAuthenticated ? "✓" : "✗"}
                  </span>
                  <span>Authenticated: {String(spotifyState.isAuthenticated)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={spotifyState.accessToken ? "text-green-400" : "text-red-400"}>
                    {spotifyState.accessToken ? "✓" : "✗"}
                  </span>
                  <span>Token: {spotifyState.accessToken ? `${spotifyState.accessToken.substring(0, 20)}...` : "null"}</span>
                </div>
                <div>
                  <span>Premium: {spotifyState.isPremium === null ? "?" : String(spotifyState.isPremium)}</span>
                </div>
                <div>
                  <span>Device ID: {spotifyState.deviceId || "null"}</span>
                </div>
                {spotifyState.error && (
                  <div className="text-red-400">
                    <span>Error: {spotifyState.error}</span>
                  </div>
                )}
              </div>
            </div>
            
            {/* WebSocket State */}
            <div className="border-b border-gray-700 pb-2">
              <div className="font-semibold text-purple-400 mb-1">WebSocket</div>
              <div className="space-y-1 pl-2">
                <div className="flex items-center gap-2">
                  <span className={wsConnected ? "text-green-400" : "text-red-400"}>
                    {wsConnected ? "✓" : "✗"}
                  </span>
                  <span>Connected: {String(wsConnected)}</span>
                </div>
                <div>
                  <span>State: {wsState}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={connectionState.connected ? "text-green-400" : "text-red-400"}>
                    {connectionState.connected ? "✓" : "✗"}
                  </span>
                  <span>Store Connected: {String(connectionState.connected)}</span>
                </div>
                <div>
                  <span>Connecting: {String(connectionState.connecting)}</span>
                </div>
                {connectionState.error && (
                  <div className="text-red-400">
                    <span>Error: {connectionState.error}</span>
                  </div>
                )}
              </div>
            </div>
            
            {/* Room State */}
            <div className="border-b border-gray-700 pb-2">
              <div className="font-semibold text-yellow-400 mb-1">Room</div>
              <div className="space-y-1 pl-2">
                <div>
                  <span>Room Key: {roomState.roomKey || "null"}</span>
                </div>
                <div>
                  <span>Room ID: {roomState.roomId || "null"}</span>
                </div>
                <div>
                  <span>Game Mode: {roomState.gameMode || "null"}</span>
                </div>
                <div>
                  <span>Is Host: {String(roomState.isHost)}</span>
                </div>
                <div>
                  <span>Players Count: {roomState.players.length}</span>
                </div>
                {isExpanded && (
                  <div className="mt-1">
                    <span className="text-gray-400">Players:</span>
                    <ul className="pl-4 mt-1 space-y-0.5">
                      {roomState.players.map((p) => (
                        <li key={p.id} className="text-gray-300">
                          {p.name} ({p.id.substring(0, 8)}...)
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <div>
                  <span>Game State: {roomState.gameState?.status || "null"}</span>
                </div>
              </div>
            </div>
            
            {/* Player State */}
            <div className="border-b border-gray-700 pb-2">
              <div className="font-semibold text-green-400 mb-1">Player</div>
              <div className="space-y-1 pl-2">
                <div>
                  <span>Player ID: {playerState.myPlayerId || "null"}</span>
                </div>
                <div>
                  <span>Tokens: {playerState.myTokens}</span>
                </div>
                <div>
                  <span>Timeline Length: {playerState.myTimeline?.length || 0}</span>
                </div>
              </div>
            </div>
            
            {/* Persisted State */}
            <div className="border-b border-gray-700 pb-2">
              <div className="font-semibold text-cyan-400 mb-1">Persisted State</div>
              <div className="space-y-1 pl-2">
                {persistedState ? (
                  <>
                    <div>
                      <span>Room Key: {persistedState.roomKey || "null"}</span>
                    </div>
                    <div>
                      <span>Is Host: {String(persistedState.isHost)}</span>
                    </div>
                    <div>
                      <span>Player Name: {persistedState.playerName || "null"}</span>
                    </div>
                    <div>
                      <span>Player ID: {persistedState.playerId || "null"}</span>
                    </div>
                  </>
                ) : (
                  <div className="text-gray-500">No persisted state</div>
                )}
              </div>
            </div>
            
            {/* URL State */}
            <div className="border-b border-gray-700 pb-2">
              <div className="font-semibold text-pink-400 mb-1">URL</div>
              <div className="space-y-1 pl-2">
                <div className="break-all">
                  <span>{window.location.href}</span>
                </div>
                <div>
                  <span>Path: {window.location.pathname}</span>
                </div>
                <div>
                  <span>Search: {window.location.search || "none"}</span>
                </div>
              </div>
            </div>
            
            {/* Recent Console Messages (if available) */}
            {isExpanded && (
              <div className="border-t border-gray-700 pt-2 mt-2">
                <div className="font-semibold text-orange-400 mb-1">Recent Activity</div>
                <div className="space-y-1 pl-2 text-xs text-gray-400">
                  <div>Check browser console for detailed logs</div>
                  <div>Look for: [useWebSocket], [HostPage], [Spotify Auth]</div>
                </div>
              </div>
            )}
            
            {/* Timestamp */}
            <div className="text-gray-500 text-xs mt-2 pt-2 border-t border-gray-700">
              Updated: {new Date().toLocaleTimeString()} ({refreshKey})
            </div>
            
            {/* Toggle Debug Mode */}
            <div className="mt-2 pt-2 border-t border-gray-700">
              <button
                onClick={() => {
                  const current = localStorage.getItem("hitster-debug");
                  if (current === "true") {
                    localStorage.removeItem("hitster-debug");
                    window.location.reload();
                  } else {
                    localStorage.setItem("hitster-debug", "true");
                    window.location.reload();
                  }
                }}
                className="text-xs text-cyan-400 hover:text-cyan-300 underline"
              >
                {localStorage.getItem("hitster-debug") === "true" ? "Disable" : "Enable"} Debug Mode
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

