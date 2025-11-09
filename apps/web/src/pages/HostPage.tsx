import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { Layout } from "../components/Layout.js";
import { useWebSocket } from "../hooks/useWebSocket.js";
import { useSpotifyAuth } from "../hooks/useSpotifyAuth.js";
import { useSpotifyPlayer } from "../hooks/useSpotifyPlayer.js";
import { useRoomStore, useSpotifyStore } from "../store/index.js";
import { LobbyScreen } from "../components/game/LobbyScreen.js";
import { HostGameView } from "../components/game/HostGameView.js";
import { PlaylistSelector } from "../components/PlaylistSelector.js";
import { PlaylistTracksPreview } from "../components/PlaylistTracksPreview.js";
import { createMessage } from "@hitster/proto";
import type { Message } from "@hitster/proto";
import type { GameState } from "@hitster/engine";
import { checkPremium, getPlaylistTracks, processPlaylistTracks } from "../lib/spotify-api.js";
import { saveRoomState, getRoomState, clearRoomState } from "../lib/room-storage.js";
import { isValidRoomKeyFormat } from "../lib/room-validation.js";
import { InvalidRoomKey } from "../components/InvalidRoomKey.js";

interface GameContentProps {
  roomKey: string;
  gameState: GameState | null;
  players: any[];
  isAuthenticated: boolean;
  isPremium: boolean | null;
  isReady: boolean;
  isActivated: boolean;
  onStartGame: () => void;
  sendMessage: (message: ReturnType<typeof createMessage>) => void;
}

function GameContent({
  roomKey,
  gameState,
  players,
  isAuthenticated,
  isPremium,
  isReady,
  isActivated,
  onStartGame,
  sendMessage,
}: GameContentProps) {
  const showLobby = !gameState || gameState.status === "lobby";
  const showGame = gameState && (gameState.status === "playing" || gameState.status === "round_summary" || gameState.status === "finished");

  if (showLobby) {
    const devMode = import.meta.env.DEV;
    return (
        <LobbyScreen
          roomKey={roomKey}
          onStartGame={onStartGame}
          canStartGame={isAuthenticated && isPremium === true && isReady && isActivated}
          startGameDisabled={!isAuthenticated || !isPremium || !isReady || !isActivated || (!devMode && players.length < 1)}
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

    // Use HostGameView for host
    return (
      <HostGameView
        gameState={gameState}
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
  const { players, gameMode, gameState, selectedPlaylist, setPlaylistTracks } = useRoomStore();
  
  // Host does NOT join as a player - they only create/host the room
  // They receive ROOM_STATE broadcasts to see players
  const [startGameError, setStartGameError] = useState<string | null>(null);
  const [playlistSelectionState, setPlaylistSelectionState] = useState<{
    step: "select" | "preview" | null;
    selectedPlaylistId: string | null;
    selectedPlaylistName: string | null;
    tracks: any[] | null;
    loading: boolean;
  }>({
    step: null,
    selectedPlaylistId: null,
    selectedPlaylistName: null,
    tracks: null,
    loading: false,
  });

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

  const { deviceId, isReady, isInitializing, isActivated, isActivating, activateDevice, handleStartSong } = useSpotifyPlayer();

  // Handle START_SONG messages
  const onStartSong = useCallback(
    (message: Message) => {
      handleStartSong(message);
    },
    [handleStartSong]
  );

  const { sendMessage, isConnected } = useWebSocket(onStartSong);
  
  // Register device when Spotify is ready (host doesn't need playerId)
  useEffect(() => {
    if (deviceId && sendMessage && isConnected && roomKey) {
      // Host registers device for Spotify playback control
      const registerMessage = createMessage("REGISTER_DEVICE", {
        deviceId,
      });
      sendMessage(registerMessage);
      console.log("[HostPage] Registered device for host:", deviceId.substring(0, 8));
    }
  }, [deviceId, sendMessage, isConnected, roomKey]);

  // Set host flag and ensure room is set in store
  useEffect(() => {
    useRoomStore.getState().setIsHost(true);
    
    // Ensure room is set in store if not already set (e.g., on page refresh)
    if (roomKey) {
      const currentRoom = useRoomStore.getState().roomKey;
      if (!currentRoom || currentRoom !== roomKey) {
        const currentGameMode = useRoomStore.getState().gameMode || "original";
        useRoomStore.getState().setRoom(roomKey, "", currentGameMode);
      }
    }
  }, [roomKey]);

  // Request room state when connected (re-associates connection with room)
  useEffect(() => {
    if (roomKey && isConnected && sendMessage) {
      // Request current room state to re-associate connection and get players
      const requestMessage = createMessage("REQUEST_ROOM_STATE", {
        roomKey,
      });
      sendMessage(requestMessage);
      console.log("[HostPage] Requested room state for re-association");
    }
  }, [roomKey, isConnected, sendMessage]);

  // Save room state for OAuth redirect scenarios
  useEffect(() => {
    if (roomKey) {
      const persistedState = getRoomState();
      if (!persistedState || persistedState.roomKey !== roomKey || !persistedState.isHost) {
        // Save host state (without playerId - host is not a player)
        saveRoomState({
          roomKey,
          isHost: true,
          playerName: "",
          playerAvatar: "",
        });
      }
    }
  }, [roomKey]);

  // Remove auth query parameter after processing
  useEffect(() => {
    if (searchParams.get("auth") === "success") {
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

  const handleLeave = () => {
    // Host doesn't need to send LEAVE - they just disconnect
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

    if (!isActivated) {
      setStartGameError("Spotify player is not activated. Please activate the player first.");
      return;
    }

    const devMode = import.meta.env.DEV;
    if (!devMode && players.length < 1) {
      setStartGameError("Need at least 1 player to start the game.");
      return;
    }

    if (!selectedPlaylist) {
      setStartGameError("Please select a playlist before starting the game.");
      return;
    }

    if (!sendMessage) {
      setStartGameError("WebSocket not connected");
      return;
    }

    // Start the first round - server will use next track from playlist
    try {
      const message = createMessage("START_ROUND", {
        // No trackUri - server will use next track from playlist
      });
      sendMessage(message);
      // Error will be set by server response if something goes wrong
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to start game";
      setStartGameError(errorMessage);
    }
  };

  const handlePlaylistPreview = useCallback(async (playlistId: string, playlistName: string) => {
    if (!accessToken) {
      setStartGameError("Access token not available");
      return;
    }

    // Set loading state
    setPlaylistSelectionState({
      step: "preview",
      selectedPlaylistId: playlistId,
      selectedPlaylistName: playlistName,
      tracks: null,
      loading: true,
    });

    try {
      const rawTracks = await getPlaylistTracks(accessToken, playlistId);
      const processedTracks = processPlaylistTracks(rawTracks);

      setPlaylistSelectionState({
        step: "preview",
        selectedPlaylistId: playlistId,
        selectedPlaylistName: playlistName,
        tracks: processedTracks,
        loading: false,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to load playlist tracks";
      setStartGameError(errorMessage);
      setPlaylistSelectionState({
        step: "select",
        selectedPlaylistId: null,
        selectedPlaylistName: null,
        tracks: null,
        loading: false,
      });
    }
  }, [accessToken]);

  const handlePlaylistSelect = useCallback((playlistId: string, playlistName: string) => {
    // Immediately start loading the preview
    handlePlaylistPreview(playlistId, playlistName);
  }, [handlePlaylistPreview]);

  const handlePlaylistConfirm = async () => {
    if (!playlistSelectionState.selectedPlaylistId || !playlistSelectionState.selectedPlaylistName || !playlistSelectionState.tracks) {
      return;
    }

    const tracksWithYear = playlistSelectionState.tracks.filter(t => t.releaseYear !== null);
    if (tracksWithYear.length < 10) {
      setStartGameError("Playlist must have at least 10 tracks with release year information");
      return;
    }

    if (!sendMessage) {
      setStartGameError("WebSocket not connected");
      return;
    }

    try {
      const message = createMessage("SELECT_PLAYLIST", {
        playlistId: playlistSelectionState.selectedPlaylistId,
        playlistName: playlistSelectionState.selectedPlaylistName,
        tracks: playlistSelectionState.tracks,
      });
      sendMessage(message);

      // Store tracks in store for HostGameView
      setPlaylistTracks(playlistSelectionState.tracks);

      // Reset selection state
      setPlaylistSelectionState({
        step: null,
        selectedPlaylistId: null,
        selectedPlaylistName: null,
        tracks: null,
        loading: false,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to select playlist";
      setStartGameError(errorMessage);
    }
  };

  const handlePlaylistCancel = () => {
    setPlaylistSelectionState({
      step: "select",
      selectedPlaylistId: null,
      selectedPlaylistName: null,
      tracks: null,
      loading: false,
    });
  };

  const handleChangePlaylist = () => {
    setPlaylistSelectionState({
      step: "select",
      selectedPlaylistId: null,
      selectedPlaylistName: null,
      tracks: null,
      loading: false,
    });
  };

  const handleConnectSpotify = () => {
    // Store room key for redirect after auth
    if (roomKey) {
      localStorage.setItem("spotify_redirect_room", roomKey);
      // Save room state before OAuth redirect
      saveRoomState({
        roomKey,
        isHost: true,
        playerName: "",
        playerAvatar: "",
      });
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

  // Host doesn't join as a player - they just host the room
  // No join form needed

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Debug Info Panel - Always visible in dev */}
        {import.meta.env.DEV && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-xs font-mono">
            <div className="font-semibold text-yellow-800 mb-2">🐛 HostPage Debug</div>
            <div className="grid grid-cols-2 gap-2 text-yellow-700">
              <div>WS Connected: <span className={isConnected ? "text-green-600" : "text-red-600"}>{String(isConnected)}</span></div>
              <div>Players: <span className="text-blue-600">{players.length}</span></div>
              <div>Room Key: <span className="text-blue-600">{roomKey}</span></div>
              <div>Game State: <span className="text-blue-600">{gameState?.status || "null"}</span></div>
              <div>Is Authenticated: <span className={isAuthenticated ? "text-green-600" : "text-red-600"}>{String(isAuthenticated)}</span></div>
              <div>Is Premium: <span className={isPremium === true ? "text-green-600" : isPremium === false ? "text-red-600" : "text-yellow-600"}>{isPremium === null ? "?" : String(isPremium)}</span></div>
              <div>Player Ready: <span className={isReady ? "text-green-600" : "text-red-600"}>{String(isReady)}</span></div>
              <div>Player Activated: <span className={isActivated ? "text-green-600" : "text-red-600"}>{String(isActivated)}</span></div>
              <div>Device ID: <span className={deviceId ? "text-green-600" : "text-red-600"}>{deviceId ? `${deviceId.substring(0, 8)}...` : "null"}</span></div>
            </div>
          </div>
        )}
        
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

              {!isInitializing && isReady && deviceId && !isActivated && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 space-y-3">
                  <div>
                    <p className="text-sm text-yellow-800 font-medium mb-1">⚠️ Player Ready - Activation Required</p>
                    <p className="text-xs text-yellow-700 mb-2">
                      Click the button below to activate the player. This is required for audio playback.
                    </p>
                    <p className="text-xs text-yellow-600">Device ID: {deviceId.substring(0, 8)}...</p>
                  </div>
                  <button
                    onClick={async () => {
                      try {
                        await activateDevice();
                      } catch (err) {
                        console.error("Activation failed:", err);
                        // Error is already set by activateDevice
                      }
                    }}
                    disabled={isActivating}
                    className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isActivating ? (
                      <>
                        <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white inline-block mr-2"></span>
                        Activating...
                      </>
                    ) : (
                      "Activate Player"
                    )}
                  </button>
                </div>
              )}

              {!isInitializing && isReady && deviceId && isActivated && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <p className="text-sm text-green-800 font-medium mb-1">✓ Player Activated</p>
                  <p className="text-xs text-green-700">Device ID: {deviceId.substring(0, 8)}...</p>
                  <p className="text-xs text-green-600 mt-1">Ready for playback</p>
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

        {/* Playlist Selection */}
        {!isChecking && isAuthenticated && isPremium === true && isReady && isActivated && (
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Playing Deck</h3>
            
            {selectedPlaylist && playlistSelectionState.step === null && (
              <div className="space-y-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-green-800">{selectedPlaylist.name}</p>
                      <p className="text-xs text-green-700">{selectedPlaylist.trackCount} tracks</p>
                    </div>
                    <button
                      onClick={handleChangePlaylist}
                      className="btn-secondary text-sm"
                    >
                      Change Playlist
                    </button>
                  </div>
                </div>
              </div>
            )}

            {!selectedPlaylist && playlistSelectionState.step === null && (
              <div className="space-y-4">
                <p className="text-sm text-gray-600">
                  Select a Spotify playlist to use as the playing deck. Songs from this playlist will be used during the game.
                </p>
                <button
                  onClick={() => setPlaylistSelectionState({ step: "select", selectedPlaylistId: null, selectedPlaylistName: null, tracks: null, loading: false })}
                  className="btn-primary w-full"
                >
                  Select Playlist
                </button>
              </div>
            )}

            {playlistSelectionState.step === "select" && accessToken && (
              <div className="space-y-4">
                <PlaylistSelector
                  accessToken={accessToken}
                  onSelect={handlePlaylistSelect}
                  selectedPlaylistId={selectedPlaylist?.id}
                />
              </div>
            )}

            {playlistSelectionState.step === "preview" && (
              <div className="space-y-4">
                {playlistSelectionState.loading || !playlistSelectionState.tracks ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-2"></div>
                    <p className="text-sm text-gray-600">Loading playlist tracks...</p>
                  </div>
                ) : playlistSelectionState.selectedPlaylistName ? (
                  <PlaylistTracksPreview
                    tracks={playlistSelectionState.tracks}
                    playlistName={playlistSelectionState.selectedPlaylistName}
                    onConfirm={handlePlaylistConfirm}
                    onCancel={handlePlaylistCancel}
                    loading={playlistSelectionState.loading}
                  />
                ) : null}
              </div>
            )}
          </div>
        )}

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
          players={players}
          isAuthenticated={isAuthenticated}
          isPremium={isPremium}
          isReady={isReady}
          isActivated={isActivated}
          onStartGame={handleStartGame}
          sendMessage={sendMessage}
        />
      </div>
    </Layout>
  );
}
