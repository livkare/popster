import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { Layout } from "../components/Layout.js";
import { useWebSocket } from "../hooks/useWebSocket.js";
import { useSpotifyAuth } from "../hooks/useSpotifyAuth.js";
import { useSpotifyPlayer } from "../hooks/useSpotifyPlayer.js";
import { useRoomStore, usePlayerStore, useSpotifyStore, useConnectionStore } from "../store/index.js";
import { LobbyScreen } from "../components/game/LobbyScreen.js";
import { GameScreen } from "../components/game/GameScreen.js";
import { createMessage } from "@hitster/proto";
import type { Message } from "@hitster/proto";
import { getPlayerTimeline } from "@hitster/engine";
import type { GameState } from "@hitster/engine";
import { checkPremium } from "../lib/spotify-api.js";
import { saveRoomState, getRoomState, clearRoomState, updatePlayerId } from "../lib/room-storage.js";
import { isValidRoomKeyFormat } from "../lib/room-validation.js";
import { InvalidRoomKey } from "../components/InvalidRoomKey.js";

interface GameContentProps {
  roomKey: string;
  gameState: GameState | null;
  roundSummary: any;
  players: any[];
  isAuthenticated: boolean;
  isPremium: boolean | null;
  isReady: boolean;
  onStartGame: () => void;
  sendMessage: (message: ReturnType<typeof createMessage>) => void;
}

function GameContent({
  roomKey,
  gameState,
  roundSummary,
  players,
  isAuthenticated,
  isPremium,
  isReady,
  onStartGame,
  sendMessage,
}: GameContentProps) {
  const showLobby = !gameState || gameState.status === "lobby";
  const showGame = gameState && (gameState.status === "playing" || gameState.status === "round_summary" || gameState.status === "finished");

  if (showLobby) {
    return (
      <LobbyScreen
        roomKey={roomKey}
        onStartGame={onStartGame}
        canStartGame={isAuthenticated && isPremium === true && isReady}
        startGameDisabled={!isAuthenticated || !isPremium || !isReady || players.length < 2}
      />
    );
  }

  if (showGame && gameState) {
    const handleReveal = () => {
      // TODO: Get year from Spotify API track info
      // The year should be fetched from Spotify track metadata or provided by the server
      // For now, this is a placeholder - the server should handle year retrieval
      console.warn("[HostPage] Reveal called but year retrieval not yet implemented");
      // Server should provide year in REVEAL handler or fetch from Spotify API
      const year = new Date().getFullYear(); // Temporary fallback
      const message = createMessage("REVEAL", { year });
      sendMessage(message);
    };

    const handleContinueRound = () => {
      useRoomStore.getState().setRoundSummary(null);
    };

    return (
      <GameScreen
        gameState={gameState}
        roundSummary={roundSummary || undefined}
        sendMessage={sendMessage}
        onReveal={handleReveal}
        onContinueRound={handleContinueRound}
      />
    );
  }

  return null;
}

export function HostPage() {
  const { roomKey } = useParams<{ roomKey: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { players, gameMode, gameState, roundSummary } = useRoomStore();
  const { myPlayerId } = usePlayerStore();
  
  // Initialize state from persisted storage if available (for redirect scenarios)
  const getInitialState = () => {
    if (!roomKey) {
      return { playerName: "", playerAvatar: "🎵", hasJoined: false };
    }
    const persistedState = getRoomState();
    if (persistedState && persistedState.roomKey === roomKey && persistedState.isHost) {
      // If we have persisted state with a playerName, we were previously joined
      // Even without playerId, we should attempt to rejoin
      return {
        playerName: persistedState.playerName || "",
        playerAvatar: persistedState.playerAvatar || "🎵",
        hasJoined: !!(persistedState.playerName && persistedState.playerName.trim()), // Set hasJoined if we have a name to rejoin with
      };
    }
    
    // Check if this is a post-auth redirect (even if localStorage was cleared due to origin mismatch)
    const isPostAuth = searchParams.get("auth") === "success";
    if (isPostAuth) {
      // User was redirected after Spotify auth - they were previously joined
      // We'll attempt to rejoin, but set hasJoined to show the lobby view
      return { playerName: "", playerAvatar: "🎵", hasJoined: true };
    }
    
    return { playerName: "", playerAvatar: "🎵", hasJoined: false };
  };
  
  const initialState = getInitialState();
  const [playerName, setPlayerName] = useState(initialState.playerName);
  const [playerAvatar, setPlayerAvatar] = useState(initialState.playerAvatar);
  const [hasJoined, setHasJoined] = useState(initialState.hasJoined);
  const [startGameError, setStartGameError] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);
  const rejoinAttemptedRef = useRef(false);
  const isPostAuthRef = useRef(searchParams.get("auth") === "success"); // Store post-auth state in ref

  // Spotify hooks
  const {
    isAuthenticated,
    isPremium,
    accessToken,
    error: authError,
    isChecking,
    authenticate,
    logout,
  } = useSpotifyAuth();

  const { deviceId, isReady, isInitializing, handleStartSong } = useSpotifyPlayer();

  // Handle START_SONG messages
  const onStartSong = useCallback(
    (message: Message) => {
      handleStartSong(message);
    },
    [handleStartSong]
  );

  const { sendMessage, isConnected } = useWebSocket(onStartSong);
  
  // Update player hook with sendMessage for device registration
  // Only register device AFTER user has joined the room (has playerId)
  useEffect(() => {
    if (deviceId && sendMessage && myPlayerId) {
      // Only register device if user is in the room
      const registerMessage = createMessage("REGISTER_DEVICE", {
        deviceId,
      });
      sendMessage(registerMessage);
    }
  }, [deviceId, sendMessage, myPlayerId]);

  // Set host flag
  useEffect(() => {
    useRoomStore.getState().setIsHost(true);
  }, []);

  // Restore persisted state on mount and clear if room mismatch
  useEffect(() => {
    if (!roomKey) {
      return;
    }

    const persistedState = getRoomState();
    if (persistedState) {
      if (persistedState.roomKey === roomKey && persistedState.isHost) {
        // Restore player info from localStorage
        setPlayerName(persistedState.playerName);
        setPlayerAvatar(persistedState.playerAvatar);
        
        // If we have a persisted playerId, we were previously joined
        // Set hasJoined to true so we show the host view while waiting for WebSocket to reconnect
        if (persistedState.playerId) {
          setHasJoined(true);
        }
        // Note: We don't restore playerId here because on reload we get a new WebSocket connection,
        // so we need to rejoin and get a new playerId from the server
      } else {
        // Room mismatch or host/player mismatch - clear persisted state
        clearRoomState();
      }
    }
  }, [roomKey]);

  // Sync player tokens and timeline from game state
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

  // Reset hasJoined if myPlayerId becomes null (e.g., after join error or disconnect)
  // But only if we don't have persisted state indicating we were joined OR if this is a post-auth redirect
  useEffect(() => {
    if (!myPlayerId && hasJoined) {
      const persistedState = getRoomState();
      
      // Don't reset hasJoined if:
      // 1. We have valid persisted state, OR
      // 2. This is a post-auth redirect (user was previously joined, localStorage may be empty due to origin mismatch)
      if (!isPostAuthRef.current && (!persistedState || persistedState.roomKey !== roomKey || !persistedState.isHost)) {
        setHasJoined(false);
      }
      // Otherwise, keep hasJoined true and wait for reconnection
    }
  }, [myPlayerId, hasJoined, roomKey]);

  // Update hasJoined when myPlayerId is received from WebSocket
  useEffect(() => {
    if (myPlayerId) {
      // We have a playerId from WebSocket, so we're already joined
      setHasJoined(true);
      // Update persisted state with current playerId
      updatePlayerId(myPlayerId);
    }
  }, [myPlayerId]);

  // Remove auth query parameter after processing (delay to ensure state is set)
  useEffect(() => {
    if (searchParams.get("auth") === "success") {
      // Store in ref immediately
      isPostAuthRef.current = true;
      
      // Remove the query parameter from URL after a short delay to ensure all useEffects have run
      const timeoutId = setTimeout(() => {
        const newSearchParams = new URLSearchParams(searchParams);
        newSearchParams.delete("auth");
        const newSearch = newSearchParams.toString();
        navigate(`/host/${roomKey}${newSearch ? `?${newSearch}` : ""}`, { replace: true });
      }, 100);
      
      return () => clearTimeout(timeoutId);
    }
    return undefined;
  }, [searchParams, roomKey, navigate]);

  // Rejoin room if we have persisted state but no active playerId (e.g., after redirect)
  // This should only run once when the component mounts and we're connected
  useEffect(() => {
    // Only attempt rejoin once when conditions are met
    if (!roomKey || !isConnected || myPlayerId || rejoinAttemptedRef.current) {
      return undefined; // Already joined or not ready or already attempted
    }

    const persistedState = getRoomState();
    
    // Try to rejoin if we have persisted state OR if this is a post-auth redirect
    // We need either persisted state with a playerName, or the post-auth flag
    const shouldRejoin = (persistedState && persistedState.roomKey === roomKey && persistedState.isHost && persistedState.playerName?.trim()) || isPostAuthRef.current;
    
    if (shouldRejoin) {
      // We have persisted state indicating we were joined, OR this is a post-auth redirect
      // This can happen after redirect (e.g., from Spotify callback) or page refresh
      // Rejoin with the same name - server will match by name/avatar and update socket_id
      if (hasJoined && !rejoinAttemptedRef.current) {
        // Check if we have a player name to rejoin with
        const playerNameToUse = persistedState?.playerName?.trim() || playerName.trim();
        if (playerNameToUse) {
          // Only rejoin if we're showing as joined (hasJoined is true from persisted state or post-auth)
          // and we haven't already attempted, and we have a valid player name
          rejoinAttemptedRef.current = true;
          
          // Small delay to ensure WebSocket is fully ready
          const timeoutId = setTimeout(() => {
            // Double-check we still need to rejoin (in case myPlayerId was set in the meantime)
            const currentPlayerId = usePlayerStore.getState().myPlayerId;
            if (!currentPlayerId && isConnected) {
              const message = createMessage("JOIN_ROOM", {
                roomKey,
                name: playerNameToUse,
                avatar: persistedState?.playerAvatar || playerAvatar || "🎵",
              });
              sendMessage(message);
            } else {
              rejoinAttemptedRef.current = false; // Reset if we don't need to rejoin
            }
          }, 300); // Slightly longer delay to ensure connection is stable
          
          return () => clearTimeout(timeoutId);
        } else {
          // We don't have a player name, so we can't rejoin - reset hasJoined
          setHasJoined(false);
        }
      }
    }
    return undefined;
  }, [roomKey, isConnected, myPlayerId, hasJoined, sendMessage, playerName, playerAvatar]);

  // Reset rejoin attempt flag when we successfully get a playerId
  // Also clear the post-auth ref once we're successfully joined
  useEffect(() => {
    if (myPlayerId) {
      rejoinAttemptedRef.current = false;
      isPostAuthRef.current = false; // Clear post-auth flag once we're successfully joined
    }
  }, [myPlayerId]);

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

    rejoinAttemptedRef.current = false; // Reset in case we're manually joining
    const message = createMessage("JOIN_ROOM", {
      roomKey,
      name: playerName.trim(),
      avatar: playerAvatar,
    });

    sendMessage(message);
    setHasJoined(true);
    
    // Persist room state to localStorage
    saveRoomState({
      roomKey,
      isHost: true,
      playerName: playerName.trim(),
      playerAvatar,
    });
  };

  // Listen for join errors from connection store
  // Layout component filters out join errors, but we still need to handle them here
  const connectionError = useConnectionStore((state) => state.error);
  useEffect(() => {
    if (connectionError && (connectionError.includes("JOIN_ROOM") || connectionError.includes("ROOM_NOT_FOUND"))) {
      setJoinError(connectionError);
      setHasJoined(false);
      // Clear connection error to prevent it from lingering
      useConnectionStore.getState().setError(null);
    }
  }, [connectionError]);

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

  const handleStartGame = async () => {
    setStartGameError(null);

    if (!isPremium) {
      setStartGameError("Spotify Premium is required to start the game. Please connect your Premium account.");
      return;
    }

    if (!isReady) {
      setStartGameError("Spotify player is not ready. Please wait for device initialization.");
      return;
    }

    if (players.length < 2) {
      setStartGameError("Need at least 2 players to start the game.");
      return;
    }

    // TODO: In a full implementation, this would come from a playlist or track selection
    // For now, we need a track URI to start the round - this should be selected by the host
    // or come from a predefined playlist
    setStartGameError("Track selection not yet implemented. Please select a track to start the game.");
    return;
  };

  const handleConnectSpotify = () => {
    // Store room key for redirect after auth (fallback to localStorage)
    if (roomKey) {
      localStorage.setItem("spotify_redirect_room", roomKey);
      
      // Only persist room state if we're actually joined (have a playerId)
      // This prevents creating state with empty/invalid data that could trigger false rejoins
      if (myPlayerId) {
        const currentState = getRoomState();
        if (!currentState || currentState.roomKey !== roomKey) {
          // Update persisted state with current player info
          saveRoomState({
            roomKey,
            isHost: true,
            playerName: playerName || currentState?.playerName || "",
            playerAvatar: playerAvatar || currentState?.playerAvatar || "🎵",
            playerId: myPlayerId,
          });
        } else {
          // Just update the existing state with current playerId
          updatePlayerId(myPlayerId);
        }
      }
    }
    // Pass roomKey as state parameter to preserve it through OAuth flow
    authenticate(roomKey || undefined);
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

  // Only show join form if we truly haven't joined and don't have persisted state to rejoin with
  const persistedState = getRoomState();
  const hasPersistedState = persistedState && persistedState.roomKey === roomKey && persistedState.isHost && persistedState.playerName?.trim();
  const shouldShowJoinForm = !hasJoined && !myPlayerId && !hasPersistedState && !isPostAuthRef.current;
  
  if (shouldShowJoinForm) {
    return (
      <Layout>
        <div className="max-w-md mx-auto">
          <div className="card">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Host Room</h2>
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
                Join as Host
              </button>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Host Badge */}
        <div className="bg-primary-100 border border-primary-300 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <span className="text-primary-700 font-semibold">🎮 Host Mode</span>
            <span className="text-sm text-primary-600">
              You are the host. Connect Spotify to start playing.
            </span>
          </div>
        </div>

        {/* Spotify Connection Status */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Spotify Connection</h3>
          
          {isChecking && (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-2"></div>
              <p className="text-sm text-gray-600">Checking authentication...</p>
            </div>
          )}

          {!isChecking && !isAuthenticated && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Connect your Spotify Premium account to play music in the game.
              </p>
              {authError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-sm text-red-800">{authError}</p>
                </div>
              )}
              <button onClick={handleConnectSpotify} className="btn-primary w-full">
                Connect Spotify
              </button>
            </div>
          )}

          {!isChecking && isAuthenticated && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Status:</span>
                <span className="text-sm text-green-600">✓ Connected</span>
              </div>

              {isPremium === null && (
                <div className="text-center py-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600 mx-auto mb-2"></div>
                  <p className="text-xs text-gray-600">Checking Premium status...</p>
                </div>
              )}

              {isPremium === false && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <p className="text-sm text-yellow-800 font-medium mb-1">Premium Required</p>
                  <p className="text-xs text-yellow-700 mb-2">
                    Spotify Premium is required to play music. Please upgrade your account.
                  </p>
                  <button
                    onClick={async () => {
                      if (accessToken) {
                        try {
                          const premium = await checkPremium(accessToken);
                          useSpotifyStore.getState().setPremium(premium);
                        } catch (err) {
                          console.error("Failed to recheck premium:", err);
                        }
                      }
                    }}
                    className="text-xs text-yellow-800 underline hover:no-underline"
                  >
                    Recheck Premium Status
                  </button>
                </div>
              )}

              {isPremium === true && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <p className="text-sm text-green-800 font-medium mb-1">✓ Premium Account</p>
                  <p className="text-xs text-green-700">Your account has Premium access.</p>
                </div>
              )}

              {isInitializing && (
                <div className="text-center py-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600 mx-auto mb-2"></div>
                  <p className="text-xs text-gray-600">Initializing player...</p>
                </div>
              )}

              {!isInitializing && isReady && deviceId && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <p className="text-sm text-green-800 font-medium mb-1">✓ Player Ready</p>
                  <p className="text-xs text-green-700">Device ID: {deviceId.substring(0, 8)}...</p>
                </div>
              )}

              {!isInitializing && !isReady && isPremium === true && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <p className="text-sm text-yellow-800">Waiting for player to initialize...</p>
                </div>
              )}

              <button onClick={logout} className="btn-secondary w-full">
                Disconnect Spotify
              </button>
            </div>
          )}
        </div>

        {/* Room Header - shown for all states */}
        <div className="card">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Room: {roomKey}</h2>
              {gameMode && (
                <p className="text-sm text-gray-600 capitalize">Mode: {gameMode}</p>
              )}
            </div>
            <button onClick={handleLeave} className="btn-secondary">
              Leave Room
            </button>
          </div>
        </div>

        {/* Start Game Error */}
        {startGameError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-red-600">⚠️</span>
                <p className="text-sm text-red-800">{startGameError}</p>
              </div>
              <button
                onClick={() => setStartGameError(null)}
                className="text-red-600 hover:text-red-800 text-sm"
                aria-label="Dismiss error"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* Game UI */}
        <GameContent
          roomKey={roomKey}
          gameState={gameState}
          roundSummary={roundSummary}
          players={players}
          isAuthenticated={isAuthenticated}
          isPremium={isPremium}
          isReady={isReady}
          onStartGame={handleStartGame}
          sendMessage={sendMessage}
        />
      </div>
    </Layout>
  );
}
