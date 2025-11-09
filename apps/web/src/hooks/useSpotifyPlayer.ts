import { useEffect, useState, useCallback, useRef } from "react";
import { useSpotifyStore } from "../store/spotify-store.js";
import { initializePlayer, type SpotifyPlayer } from "../lib/spotify-player.js";
import { playTrack, pause, waitForActiveDevice, waitForDeviceInList, transferToHostDevice } from "../lib/spotify-api.js";
import { isStartSongMessage, type Message } from "@hitster/proto";

/**
 * Hook for managing Spotify Web Playback SDK and playback control
 */
export function useSpotifyPlayer() {
  const { isAuthenticated, accessToken, deviceId, setDeviceId, setError } = useSpotifyStore();
  const [isReady, setIsReady] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [isActivated, setIsActivated] = useState(false);
  const [isActivating, setIsActivating] = useState(false);
  const playerRef = useRef<SpotifyPlayer | null>(null);

  // Initialize SDK when authenticated
  useEffect(() => {
    if (!isAuthenticated || !accessToken || isInitializing || playerRef.current) {
      return;
    }

    // Event handlers defined outside async function for cleanup
    const notReadyHandler = ({ device_id }: { device_id: string }) => {
      console.warn("[Spotify Player] Device went offline:", device_id);
      setIsReady(false);
      setIsActivated(false);
    };

    const authErrorHandler = ({ message }: { message: string }) => {
      console.error("[Spotify Player] Authentication error:", message);
      setError(`Authentication error: ${message}`);
      setIsReady(false);
      setIsActivated(false);
    };

    const accountErrorHandler = ({ message }: { message: string }) => {
      console.error("[Spotify Player] Account error:", message);
      setError(`Account error: ${message}`);
      setIsReady(false);
      setIsActivated(false);
    };

    const playbackErrorHandler = ({ message }: { message: string }) => {
      console.error("[Spotify Player] Playback error:", message);
      setError(`Playback error: ${message}`);
    };

    async function initPlayer() {
      setIsInitializing(true);
      setError(null);

      try {
        if (!accessToken) {
          throw new Error("Access token is required");
        }
        const { player, deviceId: newDeviceId } = await initializePlayer(
          accessToken,
          "Hitster Player"
        );

        playerRef.current = player;
        setDeviceId(newDeviceId);
        setIsReady(true);
        setIsActivated(false);

        // Set up player event listeners
        player.addListener("not_ready", notReadyHandler);
        player.addListener("authentication_error", authErrorHandler);
        player.addListener("account_error", accountErrorHandler);
        player.addListener("playback_error", playbackErrorHandler);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to initialize player";
        setError(errorMessage);
        setIsReady(false);
      } finally {
        setIsInitializing(false);
      }
    }

    initPlayer();

    // Cleanup on unmount
    return () => {
      if (playerRef.current) {
        try {
          // Remove all listeners before disconnecting
          playerRef.current.removeListener("not_ready", notReadyHandler);
          playerRef.current.removeListener("authentication_error", authErrorHandler);
          playerRef.current.removeListener("account_error", accountErrorHandler);
          playerRef.current.removeListener("playback_error", playbackErrorHandler);
          playerRef.current.disconnect();
        } catch (err) {
          console.error("Failed to disconnect player:", err);
        }
        playerRef.current = null;
      }
    };
  }, [isAuthenticated, accessToken, isInitializing, setDeviceId, setError]);

  /**
   * Activate device - must be called in response to user interaction
   * Based on Spotify Web Playback SDK documentation flow:
   * 1. Call activateElement() for browser autoplay
   * 2. Wait for device to appear in API device list
   * 3. Transfer playback to device (makes it active)
   * 4. Verify device is active
   */
  const activateDevice = useCallback(async () => {
    if (!playerRef.current || !accessToken || !deviceId) {
      throw new Error("Player not ready. Please wait for initialization.");
    }

    if (isActivated) {
      return;
    }

    setIsActivating(true);
    setError(null);

    try {
      // Step 1: Handle browser autoplay restrictions
      await playerRef.current.activateElement();

      // Step 2: Verify device_id from player state (may differ from ready event)
      let actualDeviceId = deviceId;
      try {
        const state = await playerRef.current.getCurrentState();
        if (state?.device_id && state.device_id !== deviceId) {
          console.log("[Spotify Player] Device ID from state differs from ready event:", {
            readyEvent: deviceId.substring(0, 8),
            currentState: state.device_id.substring(0, 8),
          });
          actualDeviceId = state.device_id;
        }
      } catch (stateErr) {
        console.warn("[Spotify Player] Could not get state, using ready event device_id");
      }

      // Step 3: Wait for device to appear in Spotify's device list
      // Try both the SDK device_id and find by name as fallback
      const foundDeviceId = await waitForDeviceInList(actualDeviceId, accessToken, "Hitster Player", 20, 500);
      if (!foundDeviceId) {
        // Last resort: try transferring anyway - sometimes works even if not in list
        console.warn("[Spotify Player] Device not in list, attempting transfer anyway...");
        try {
          await transferToHostDevice(actualDeviceId, accessToken, false);
          // Give it a moment and check if it became active
          await new Promise(resolve => setTimeout(resolve, 1000));
          const deviceActive = await waitForActiveDevice(actualDeviceId, accessToken, 5, 500);
          if (deviceActive) {
            setIsActivated(true);
            return;
          }
        } catch (transferErr) {
          // Transfer failed, throw original error
        }
        throw new Error("Device did not appear in Spotify's device list. Please try reconnecting.");
      }

      // Use the device ID we found (may differ from SDK device_id)
      const deviceToUse = foundDeviceId;

      // Step 4: Transfer playback to device (this makes it active)
      await transferToHostDevice(deviceToUse, accessToken, false);

      // Step 5: Verify device is now active
      const deviceActive = await waitForActiveDevice(deviceToUse, accessToken, 10, 500);
      if (!deviceActive) {
        throw new Error("Device did not become active after transfer. Please try again.");
      }

      // Update deviceId in store if it changed
      if (deviceToUse !== deviceId) {
        setDeviceId(deviceToUse);
      }

      setIsActivated(true);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to activate device";
      setError(errorMessage);
      setIsActivated(false);
      throw err;
    } finally {
      setIsActivating(false);
    }
  }, [accessToken, deviceId, isActivated, setError]);

  /**
   * Play a track
   */
  const play = useCallback(
    async (trackUri: string, positionMs: number = 0) => {
      // Get current deviceId from store (may have been updated during activation)
      const currentDeviceId = useSpotifyStore.getState().deviceId;
      const currentAccessToken = useSpotifyStore.getState().accessToken;
      
      if (!currentAccessToken || !currentDeviceId) {
        throw new Error("Player not ready");
      }

      if (!isActivated) {
        throw new Error("Device not activated. Please activate the device first.");
      }

      try {
        console.log("[Spotify Player] Starting playback:", { 
          trackUri, 
          positionMs, 
          deviceId: currentDeviceId.substring(0, 8),
          isActivated 
        });
        
        // Verify device is still active before playing
        const deviceActive = await waitForActiveDevice(currentDeviceId, currentAccessToken, 2, 500);
        if (!deviceActive) {
          console.warn("[Spotify Player] Device not active, attempting to reactivate...");
          // Try to transfer again to reactivate
          await transferToHostDevice(currentDeviceId, currentAccessToken, false);
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        // Play track with current device ID
        await playTrack(trackUri, positionMs, currentAccessToken, currentDeviceId);
        console.log("[Spotify Player] Playback started successfully");
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to play track";
        console.error("[Spotify Player] Playback failed:", err);
        setError(errorMessage);
        throw err;
      }
    },
    [isActivated, setError]
  );

  /**
   * Pause playback
   */
  const pausePlayback = useCallback(async () => {
    if (!accessToken) {
      return;
    }

    try {
      await pause(accessToken);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to pause";
      setError(errorMessage);
    }
  }, [accessToken, setError]);

  /**
   * Handle START_SONG message from server
   */
  const handleStartSong = useCallback(
    async (message: Message) => {
      if (!isStartSongMessage(message)) {
        return;
      }

      // TypeScript now knows message is START_SONG type
      const { trackUri, positionMs = 0 } = message.payload;

      if (!isReady || !accessToken || !deviceId) {
        console.warn("[Spotify Player] Player not ready, cannot play track", {
          isReady,
          hasAccessToken: !!accessToken,
          hasDeviceId: !!deviceId,
        });
        return;
      }

      if (!isActivated) {
        console.warn("[Spotify Player] Device not activated, cannot play track");
        setError("Device not activated. Please activate the device first.");
        return;
      }

      // Verify player is actually connected and ready
      if (!playerRef.current) {
        console.error("[Spotify Player] Player reference is null, cannot play");
        setError("Spotify player is not initialized. Please reconnect to Spotify.");
        return;
      }

      try {
        console.log("[Spotify Player] Handling START_SONG:", { trackUri, positionMs, deviceId: deviceId.substring(0, 8) });
        await play(trackUri, positionMs);
        console.log("[Spotify Player] Successfully handled START_SONG");
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to play track";
        console.error("[Spotify Player] Failed to play track from START_SONG:", err);
        setError(errorMessage);
      }
    },
    [isReady, isActivated, accessToken, deviceId, play, setError]
  );

  return {
    deviceId,
    isReady,
    isInitializing,
    isActivated,
    isActivating,
    activateDevice,
    play,
    pause: pausePlayback,
    handleStartSong,
  };
}

