import { useEffect, useCallback, useRef } from "react";
import { wsManager } from "../lib/websocket.js";
import { useConnectionStore, useRoomStore, usePlayerStore } from "../store/index.js";
import type { Message } from "@hitster/proto";
import {
  isRoomStateMessage,
  isJoinedMessage,
  isErrorMessage,
  isRoomCreatedMessage,
  isStartSongMessage,
  isStartRoundMessage,
  isRoundSummaryMessage,
  isDeviceRegisteredMessage,
} from "@hitster/proto";
import type { GameState, GameMode, Round } from "@hitster/engine";
import { createGame } from "@hitster/engine";
import { updatePlayerId } from "../lib/room-storage.js";

/**
 * Custom hook to manage WebSocket connection and message handling
 */
export function useWebSocket(onStartSong?: (message: Message) => void) {
  const { setConnected, setConnecting, setError } = useConnectionStore();
  const { setRoom, updatePlayers, updateGameState, gameMode, isHost } = useRoomStore();
  const { setPlayerId } = usePlayerStore();
  
  // Callback refs for navigation and room creation handlers
  const roomCreatedCallbackRef = useRef<((roomKey: string) => void) | null>(null);

  // Define handleMessage before useEffect to avoid initialization order issues
  const handleMessage = useCallback(
    (message: Message) => {
      // Handle ROOM_CREATED messages
      if (isRoomCreatedMessage(message)) {
        const { roomKey, roomId } = message.payload;
        setRoom(roomKey, roomId, gameMode || "original");
        // Trigger callback if set (for navigation)
        if (roomCreatedCallbackRef.current) {
          roomCreatedCallbackRef.current(roomKey);
          roomCreatedCallbackRef.current = null;
        }
      }

      // Handle ROOM_STATE messages
      if (isRoomStateMessage(message)) {
        const { players, gameState: serverGameState, roomKey } = message.payload;
        console.log("[useWebSocket] Received ROOM_STATE message:", {
          roomKey,
          playersCount: players?.length || 0,
          playerIds: players?.map(p => p.id) || [],
          playerNames: players?.map(p => p.name) || [],
        });
        // Always update players list when ROOM_STATE is received
        // This ensures all clients see the latest player list
        // Update even if players array is empty (to clear stale data)
        if (Array.isArray(players)) {
          console.log("[useWebSocket] Updating players list:", players.map(p => ({ id: p.id, name: p.name })));
          updatePlayers(players);
        } else {
          console.warn("[useWebSocket] ROOM_STATE message has invalid players array:", players);
        }
        
        // Get current game state from store
        const currentGameState = useRoomStore.getState().gameState;
        const currentGameMode = useRoomStore.getState().gameMode || "original";
        
        // Update game state from server
        if (serverGameState) {
          if (currentGameState) {
            // Update existing game state with server updates
            const updatedState: Partial<GameState> = {
              ...currentGameState,
              status: serverGameState.status as GameState["status"],
              currentRound: serverGameState.currentRound ?? currentGameState.currentRound,
            };
            
            // If we have a currentTrack and the status is "playing", ensure we have a round
            if (serverGameState.status === "playing" && serverGameState.currentTrack) {
              const roundIndex = updatedState.currentRound ?? 0;
              // Ensure we have a round at this index
              if (!updatedState.rounds || !updatedState.rounds[roundIndex]) {
                // Create a minimal round if it doesn't exist
                const newRound: Round = {
                  roundNumber: roundIndex + 1,
                  currentCard: {
                    trackUri: serverGameState.currentTrack,
                    revealed: false,
                  },
                  placements: [],
                  revealed: false,
                };
                updatedState.rounds = [...(updatedState.rounds || []), newRound];
              } else if (updatedState.rounds[roundIndex].currentCard.trackUri !== serverGameState.currentTrack) {
                // Update the current card if track changed
                updatedState.rounds[roundIndex] = {
                  ...updatedState.rounds[roundIndex],
                  currentCard: {
                    ...updatedState.rounds[roundIndex].currentCard,
                    trackUri: serverGameState.currentTrack,
                  },
                };
              }
            }
            
            updateGameState(updatedState as GameState);
          } else {
            // No current game state - initialize it from server info
            // This happens when joining a room or when game state hasn't been synced yet
            const minimalGameState = createGame(currentGameMode as GameMode);
            
            // Update with server info
            const updatedState: GameState = {
              ...minimalGameState,
              status: serverGameState.status as GameState["status"],
              currentRound: serverGameState.currentRound ?? 0,
              players: players.map((p) => ({
                id: p.id,
                name: p.name,
                avatar: p.avatar,
                tokens: minimalGameState.startingTokens, // Use starting tokens from game mode
                score: 0,
              })),
              rounds: serverGameState.currentTrack
                ? [
                    {
                      roundNumber: (serverGameState.currentRound ?? 0) + 1,
                      currentCard: {
                        trackUri: serverGameState.currentTrack,
                        revealed: false,
                      },
                      placements: [],
                      revealed: false,
                    },
                  ]
                : [],
            };
            
            updateGameState(updatedState);
          }
        } else if (!currentGameState) {
          // No server game state and no current game state - initialize empty lobby state
          const lobbyGameState = createGame(currentGameMode as GameMode);
          const updatedState: GameState = {
            ...lobbyGameState,
            players: players.map((p) => ({
              id: p.id,
              name: p.name,
              avatar: p.avatar,
              tokens: lobbyGameState.startingTokens,
              score: 0,
            })),
          };
          updateGameState(updatedState);
        }
        
        if (roomKey) {
          // Ensure room is set if we have roomKey
          const currentRoom = useRoomStore.getState().roomKey;
          if (!currentRoom) {
            // Set room with roomKey (roomId might not be available from ROOM_STATE)
            const currentGameMode = useRoomStore.getState().gameMode || "original";
            setRoom(roomKey, "", currentGameMode);
          }
        }
      }

      // Handle JOINED messages
      if (isJoinedMessage(message)) {
        const { playerId, players, roomKey } = message.payload;
        console.log("[useWebSocket] Received JOINED message:", {
          playerId,
          roomKey,
          playersCount: players.length,
        });
        setPlayerId(playerId);
        // Persist playerId to localStorage
        updatePlayerId(playerId);
        updatePlayers(players);
        
        // Clear any previous errors when user successfully joins
        setError(null);
        
        // Ensure room is set if not already
        const currentRoom = useRoomStore.getState().roomKey;
        if (!currentRoom && roomKey) {
          // Set room with roomKey (roomId might not be available from JOINED)
          const currentGameMode = useRoomStore.getState().gameMode || "original";
          setRoom(roomKey, "", currentGameMode);
        }
      }

      // Handle START_ROUND messages
      if (isStartRoundMessage(message)) {
        // Round started - game state will be updated via ROOM_STATE
        // This is just a notification
      }

      // Handle ROUND_SUMMARY messages
      if (isRoundSummaryMessage(message)) {
        // Round summary received - update round summary state
        useRoomStore.getState().setRoundSummary(message.payload);
      }

      // Handle ERROR messages
      if (isErrorMessage(message)) {
        const { code, message: errorMessage } = message.payload;
        
        // Filter out validation errors - these are technical and shouldn't be shown to users
        // They're likely caused by message type mismatches or protocol issues
        if (code === "INVALID_MESSAGE" && errorMessage.includes("Invalid discriminator value")) {
          // Don't show validation errors to users - log them instead
          return;
        }
        
        // Filter out NOT_IN_ROOM errors if user doesn't have a playerId yet
        // These are expected during reconnection/redirect scenarios
        const currentPlayerId = usePlayerStore.getState().myPlayerId;
        if (code === "NOT_IN_ROOM" && !currentPlayerId) {
          // Don't show this error - user is in the process of rejoining
          return;
        }
        
        // Set error in connection store - RoomPage/HostPage will handle join errors locally
        // and clear them from connection store to prevent duplicate display in Layout
        const isJoinError = code === "ROOM_NOT_FOUND" || code === "JOIN_ROOM_FAILED";
        setError(`${code}: ${errorMessage}`);
        
        // If join failed, reset player state to allow retry
        if (isJoinError) {
          usePlayerStore.getState().setPlayerId(null);
        }
      }

      // Handle DEVICE_REGISTERED messages (for host)
      if (isDeviceRegisteredMessage(message)) {
        // Device registration confirmed - no action needed
      }

      // Handle START_SONG messages (only for host)
      if (isStartSongMessage(message) && isHost && onStartSong) {
        onStartSong(message);
      }
    },
    [updatePlayers, updateGameState, setPlayerId, setError, setRoom, gameMode, isHost, onStartSong]
  );

  // Connect on mount
  useEffect(() => {
    // First, check the actual WebSocket state and sync it with the store
    // This ensures we have the correct state even if the WebSocket is already connected
    const currentState = wsManager.getConnectionState();
    if (currentState === "connected") {
      setConnected(true);
      setConnecting(false);
    } else if (currentState === "connecting") {
      setConnecting(true);
      setConnected(false);
    } else {
      setConnecting(false);
      setConnected(false);
    }
    
    setError(null);
    wsManager.connect();

    // Track if we've ever successfully connected (to distinguish initial failure from reconnection)
    let hasEverConnected = wsManager.isConnected();

    // Subscribe to connection state changes
    const unsubscribeConnectionState = wsManager.onConnectionStateChange((connected) => {
      setConnected(connected);
      // setConnected already sets connecting: false, so no need to call setConnecting separately
      if (!connected) {
        if (hasEverConnected) {
          // We were connected before, so this is a reconnection scenario
          setError("Connection lost. Attempting to reconnect...");
        } else {
          // Never connected - likely server not running
          setError("Unable to connect to server. Please make sure the server is running.");
        }
      } else {
        hasEverConnected = true;
        setError(null);
      }
    });

    // Subscribe to messages - use handleMessage directly to ensure we always use the latest callback
    const unsubscribeMessages = wsManager.onMessage((message: Message) => {
      handleMessage(message);
    });

    return () => {
      unsubscribeConnectionState();
      unsubscribeMessages();
    };
  }, [setConnected, setConnecting, setError, handleMessage]);

  // Function to send messages
  const sendMessage = useCallback((message: Message) => {
    wsManager.sendMessage(message);
  }, []);

  // Function to set callback for room creation (for navigation)
  const onRoomCreated = useCallback((callback: (roomKey: string) => void) => {
    roomCreatedCallbackRef.current = callback;
  }, []);

  return {
    sendMessage,
    isConnected: wsManager.isConnected(),
    connectionState: wsManager.getConnectionState(),
    onRoomCreated,
  };
}

