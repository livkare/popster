import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Layout } from "../components/Layout.js";
import { useWebSocket } from "../hooks/useWebSocket.js";
import { useRoomStore, usePlayerStore, useConnectionStore } from "../store/index.js";
import { LobbyScreen } from "../components/game/LobbyScreen.js";
import { GameScreen } from "../components/game/GameScreen.js";
import { createMessage } from "@hitster/proto";
import { getPlayerTimeline } from "@hitster/engine";
import { saveRoomState, getRoomState, clearRoomState, updatePlayerId } from "../lib/room-storage.js";
import { isValidRoomKeyFormat } from "../lib/room-validation.js";
import { InvalidRoomKey } from "../components/InvalidRoomKey.js";

export function RoomPage() {
  const { roomKey } = useParams<{ roomKey: string }>();
  const navigate = useNavigate();
  const { sendMessage, isConnected } = useWebSocket();
  // IMPORTANT: All hooks must be called unconditionally at the top
  const { gameState, roundSummary, players } = useRoomStore();
  const { myPlayerId } = usePlayerStore();
  const connectionError = useConnectionStore((state) => state.error);
  const [playerName, setPlayerName] = useState("");
  const [playerAvatar, setPlayerAvatar] = useState("🎵");
  const [hasJoined, setHasJoined] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const autoJoinAttemptedRef = useRef(false);

  // Restore persisted state on mount and clear if room mismatch
  useEffect(() => {
    if (!roomKey) {
      return;
    }

    const persistedState = getRoomState();
    if (persistedState) {
      if (persistedState.roomKey === roomKey && !persistedState.isHost) {
        // Restore player info from localStorage
        setPlayerName(persistedState.playerName);
        setPlayerAvatar(persistedState.playerAvatar);
        // Note: We don't restore playerId here because on reload we get a new WebSocket connection,
        // so we need to rejoin and get a new playerId from the server
      } else {
        // Room mismatch or host/player mismatch - clear persisted state
        clearRoomState();
      }
    }
  }, [roomKey]);

  // Reset hasJoined if myPlayerId becomes null (e.g., after join error)
  useEffect(() => {
    if (!myPlayerId && hasJoined && autoJoinAttemptedRef.current) {
      // PlayerId was cleared (likely due to error) - allow retry
      setHasJoined(false);
      autoJoinAttemptedRef.current = false;
    }
  }, [myPlayerId, hasJoined]);

  // Auto-join room when component mounts or when connected
  // Only auto-join if we have persisted state (user was previously joined)
  useEffect(() => {
    if (!roomKey) {
      return;
    }

    // Check if we've already joined (either via myPlayerId or hasJoined flag)
    if (myPlayerId) {
      setHasJoined(true);
      // Update persisted state with current playerId
      updatePlayerId(myPlayerId);
      autoJoinAttemptedRef.current = false; // Reset on successful join
      return;
    }

    // Check if we have persisted state indicating we were previously joined
    const persistedState = getRoomState();
    const hasPersistedState = persistedState && 
                              persistedState.roomKey === roomKey && 
                              !persistedState.isHost &&
                              persistedState.playerName &&
                              persistedState.playerName.trim();

    // If we have persisted state, set hasJoined to true to prevent showing join form
    // This prevents redirect/flashing of join form while waiting for connection
    if (hasPersistedState && !autoJoinAttemptedRef.current) {
      setHasJoined(true);
    }

    // Only auto-join if we have persisted state and are connected
    if (!isConnected) {
      return; // Wait for connection before attempting to join
    }

    const shouldAutoJoin = hasPersistedState && !autoJoinAttemptedRef.current;

    if (shouldAutoJoin) {
      autoJoinAttemptedRef.current = true; // Mark as attempted
      const message = createMessage("JOIN_ROOM", {
        roomKey,
        name: persistedState!.playerName.trim(),
        avatar: persistedState!.playerAvatar || "🎵",
      });
      sendMessage(message);
      
      // Update persisted state with current values
      saveRoomState({
        roomKey,
        isHost: false,
        playerName: persistedState!.playerName.trim(),
        playerAvatar: persistedState!.playerAvatar || "🎵",
      });
    }
  }, [roomKey, isConnected, myPlayerId, sendMessage]);

  const handleJoin = () => {
    setJoinError(null);

    if (!roomKey || !playerName.trim()) {
      setJoinError("Please enter your name");
      return;
    }

    if (!isConnected) {
      setJoinError("Please wait for the connection to establish");
      return;
    }

    if (playerName.trim().length < 1 || playerName.trim().length > 50) {
      setJoinError("Name must be between 1 and 50 characters");
      return;
    }

    const message = createMessage("JOIN_ROOM", {
      roomKey,
      name: playerName.trim(),
      avatar: playerAvatar,
    });

    sendMessage(message);
    setHasJoined(true);
    autoJoinAttemptedRef.current = true; // Mark as attempted for manual join too
    
    // Persist room state to localStorage
    saveRoomState({
      roomKey,
      isHost: false,
      playerName: playerName.trim(),
      playerAvatar,
    });
  };

  // Listen for join errors from connection store
  // Layout component filters out join errors, but we still need to handle them here
  useEffect(() => {
    if (connectionError && (connectionError.includes("JOIN_ROOM") || connectionError.includes("ROOM_NOT_FOUND"))) {
      setJoinError(connectionError);
      setHasJoined(false);
      autoJoinAttemptedRef.current = false;
      // Clear connection error to prevent it from lingering
      useConnectionStore.getState().setError(null);
    }
  }, [connectionError]);

  // Sync player tokens and timeline from game state
  // IMPORTANT: This hook must be at the top level, before any early returns
  useEffect(() => {
    if (gameState && myPlayerId) {
      const player = gameState.players.find((p) => p.id === myPlayerId);
      if (player) {
        usePlayerStore.getState().updateTokens(player.tokens);
        const timeline = getPlayerTimeline(gameState, myPlayerId);
        usePlayerStore.getState().updateTimeline(timeline);
      }
    }
  }, [gameState, myPlayerId]);

  const handleLeave = () => {
    if (myPlayerId) {
      const message = createMessage("LEAVE", {
        playerId: myPlayerId,
      });
      sendMessage(message);
    }
    // Clear persisted state when explicitly leaving
    clearRoomState();
    navigate("/");
  };

  if (!roomKey) {
    return <InvalidRoomKey />;
  }

  // Validate room key format
  if (!isValidRoomKeyFormat(roomKey)) {
    return (
      <InvalidRoomKey
        title="Invalid Room Key Format"
        message="Room keys must be 6 alphanumeric characters."
      />
    );
  }

  // Show join form only if we haven't joined, don't have a playerId, and aren't in the process of auto-joining
  const showJoinForm = !hasJoined && !myPlayerId && !autoJoinAttemptedRef.current;
  
  if (showJoinForm) {
    return (
      <Layout>
        <div className="max-w-md mx-auto">
          <div className="card">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Join Room</h2>
            <div className="space-y-4">
              <div>
                <label htmlFor="playerName" className="block text-sm font-medium text-gray-700 mb-1">
                  Your Name
                </label>
                <input
                  id="playerName"
                  type="text"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  placeholder="Enter your name"
                  className="input"
                  maxLength={50}
                />
              </div>
              <div>
                <label
                  htmlFor="playerAvatar"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Avatar Emoji
                </label>
                <input
                  id="playerAvatar"
                  type="text"
                  value={playerAvatar}
                  onChange={(e) => {
                    const value = e.target.value;
                    // Handle emoji properly - take first character or grapheme
                    if (value.length > 0) {
                      // Use Array.from to handle multi-byte characters correctly
                      const firstChar = Array.from(value)[0] || "🎵";
                      setPlayerAvatar(firstChar);
                    } else {
                      setPlayerAvatar("🎵");
                    }
                  }}
                  placeholder="🎵"
                  className="input text-2xl text-center"
                  maxLength={2}
                />
              </div>
              {joinError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                  <p className="text-sm text-red-800">{joinError}</p>
                </div>
              )}
              <button
                onClick={handleJoin}
                disabled={!playerName.trim() || !isConnected}
                className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Join Room
              </button>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  const handleContinueRound = () => {
    // Clear round summary and continue to next round
    useRoomStore.getState().setRoundSummary(null);
  };

  // Determine which view to show
  const showLobby = !gameState || gameState.status === "lobby";
  const showGame = gameState && (gameState.status === "playing" || gameState.status === "round_summary" || gameState.status === "finished");

  // Debug info for RoomPage
  const debugInfo = {
    hasJoined,
    myPlayerId,
    isConnected,
    autoJoinAttempted: autoJoinAttemptedRef.current,
    persistedState: getRoomState(),
    roomKey,
    playerName,
    playersCount: players.length,
  };

  return (
    <Layout>
      {/* Debug Info Panel - Always visible in dev */}
      {(import.meta.env.DEV || localStorage.getItem("hitster-debug") === "true") && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-xs font-mono mb-4">
          <div className="font-semibold text-yellow-800 mb-2 flex items-center justify-between">
            <span>🐛 RoomPage Debug</span>
            <span className="text-yellow-600 font-normal">({new Date().toLocaleTimeString()})</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-yellow-700">
            <div>Has Joined: <span className={hasJoined ? "text-green-600 font-bold" : "text-red-600 font-bold"}>{String(hasJoined)}</span></div>
            <div>Player ID: <span className={myPlayerId ? "text-green-600" : "text-red-600"}>{myPlayerId ? `${myPlayerId.substring(0, 8)}...` : "null"}</span></div>
            <div>WS Connected: <span className={isConnected ? "text-green-600 font-bold" : "text-red-600 font-bold"}>{String(isConnected)}</span></div>
            <div>Auto Join Attempted: <span className={autoJoinAttemptedRef.current ? "text-yellow-600" : "text-gray-600"}>{String(autoJoinAttemptedRef.current)}</span></div>
            <div>Players: <span className="text-blue-600 font-bold">{players.length}</span> {players.length > 0 && <span className="text-gray-600">({players.map(p => p.name).join(", ")})</span>}</div>
            <div>Room Key: <span className="text-blue-600">{roomKey}</span></div>
            <div>Player Name: <span className="text-blue-600">{playerName || "empty"}</span></div>
            <div>Game State: <span className="text-blue-600">{gameState?.status || "null"}</span></div>
            {joinError && <div className="col-span-2 text-red-600">Join Error: {joinError}</div>}
          </div>
          <div className="mt-2 pt-2 border-t border-yellow-300 text-yellow-600">
            <div>Persisted State: {getRoomState() ? `Room: ${getRoomState()?.roomKey}, Name: ${getRoomState()?.playerName || "none"}` : "none"}</div>
          </div>
        </div>
      )}
      <div className="max-w-4xl mx-auto space-y-6">
        {showLobby && (
          <LobbyScreen
            roomKey={roomKey}
            canStartGame={false}
            startGameDisabled={true}
          />
        )}

        {showGame && gameState && (
          <GameScreen
            gameState={gameState}
            roundSummary={roundSummary || undefined}
            sendMessage={sendMessage}
            onContinueRound={handleContinueRound}
          />
        )}

        {/* Leave button */}
        <div className="flex justify-center">
          <button onClick={handleLeave} className="btn-secondary">
            Leave Room
          </button>
        </div>
      </div>
    </Layout>
  );
}

