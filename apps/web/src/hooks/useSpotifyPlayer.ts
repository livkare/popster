import { useEffect, useState, useCallback, useRef } from "react";
import { useSpotifyStore } from "../store/spotify-store.js";
import { initializePlayer, type SpotifyPlayer } from "../lib/spotify-player.js";
import { playTrack, pause, waitForActiveDevice, waitForDeviceInList, transferToHostDevice, getPlaybackState } from "../lib/spotify-api.js";
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
  const [isPlaying, setIsPlaying] = useState(false);
  const playerRef = useRef<SpotifyPlayer | null>(null);
  const playbackStateIntervalRef = useRef<number | null>(null);
  const stateChangedHandlerRef = useRef<((state: any) => void) | null>(null);
  // Track current track and position for resume functionality
  const currentTrackRef = useRef<{ uri: string; position: number } | null>(null);
  // Prevent rapid toggling
  const isTogglingRef = useRef<boolean>(false);

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
        
        // Listen to player state changes for playback status
        // The state is provided directly as a parameter to the event handler
        const stateChangedHandler = (state: any) => {
          try {
            if (state) {
              // State is provided directly - use it immediately
              setIsPlaying(!state.paused);
              
              // Track current track and position for resume functionality
              // Always update position, even when paused, so we have accurate resume position
              const currentTrack = state.track_window?.current_track;
              if (currentTrack) {
                const position = state.position || 0;
                // Always update the ref - this is our source of truth for resume
                currentTrackRef.current = {
                  uri: currentTrack.uri,
                  position: position, // Ensure position is always a number
                };
                // Log when position is saved (especially when paused)
                if (state.paused) {
                  console.log("[Spotify Player] Position saved from state_changed (paused):", {
                    track: currentTrack.name,
                    uri: currentTrack.uri,
                    position: position
                  });
                }
              } else {
                // No current track in state - but don't clear the ref if we're paused
                // (we want to keep it for resume)
                if (!state.paused) {
                  // Only clear if not paused (might be between tracks)
                  console.log("[Spotify Player] No current track in state, but keeping ref for resume");
                }
              }
              
              console.log("[Spotify Player] State changed:", { 
                paused: state.paused, 
                isPlaying: !state.paused,
                track: currentTrack?.name,
                position: state.position
              });
            } else {
              // No state means no active playback
              setIsPlaying(false);
              // Don't clear currentTrackRef here - we want to keep it for resume
              // Only clear when a new track starts (handled in handleStartSong)
            }
          } catch (err) {
            console.warn("[Spotify Player] Error handling state change:", err);
          }
        };
        
        stateChangedHandlerRef.current = stateChangedHandler;
        player.addListener("player_state_changed", stateChangedHandler);
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
          if (stateChangedHandlerRef.current) {
            playerRef.current.removeListener("player_state_changed", stateChangedHandlerRef.current);
            stateChangedHandlerRef.current = null;
          }
          if (playbackStateIntervalRef.current) {
            clearInterval(playbackStateIntervalRef.current);
            playbackStateIntervalRef.current = null;
          }
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

    // Check if device is already active before attempting activation
    // This handles cases where state is out of sync
    try {
      const deviceActive = await waitForActiveDevice(deviceId, accessToken, 2, 500);
      if (deviceActive) {
        console.log("[Spotify Player] Device is already active - syncing state");
        setIsActivated(true);
        return;
      }
    } catch (checkErr) {
      // If check fails, proceed with activation attempt
      console.warn("[Spotify Player] Could not verify device state, proceeding with activation");
    }

    if (isActivated) {
      // State says activated but device check didn't confirm - proceed anyway to be safe
      console.warn("[Spotify Player] State says activated but device check didn't confirm - proceeding");
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
   * If positionMs is not provided, checks if we're resuming the same track
   * and uses the saved position from when it was paused
   */
  const play = useCallback(
    async (trackUri: string, positionMs?: number) => {
      // Prevent rapid toggling
      if (isTogglingRef.current) {
        console.log("[Spotify Player] Already toggling, ignoring play request");
        return;
      }
      
      // Get current deviceId from store (may have been updated during activation)
      const currentDeviceId = useSpotifyStore.getState().deviceId;
      const currentAccessToken = useSpotifyStore.getState().accessToken;
      
      if (!currentAccessToken || !currentDeviceId) {
        throw new Error("Player not ready");
      }
      
      isTogglingRef.current = true;

      // Check actual playback state from SDK to determine if we should resume
      let actualPlaybackState: any = null;
      let shouldResume = false;
      let positionToUse: number | undefined;
      
      // First, check if we have saved state for this track (even if SDK state is unavailable)
      const hasSavedState = currentTrackRef.current?.uri === trackUri && 
                           currentTrackRef.current.position !== undefined;
      
      if (playerRef.current) {
        try {
          actualPlaybackState = await playerRef.current.getCurrentState();
          if (actualPlaybackState) {
            const currentTrack = actualPlaybackState.track_window?.current_track;
            const isPaused = actualPlaybackState.paused;
            const currentPosition = actualPlaybackState.position;
            
            // If the same track is currently loaded and paused, we should resume
            if (currentTrack?.uri === trackUri && isPaused) {
              shouldResume = true;
              // Update our ref with the current position (use it as fallback if resume API fails)
              const savedPos = currentPosition || 0;
              currentTrackRef.current = {
                uri: currentTrack.uri,
                position: savedPos,
              };
              // Store position for fallback if resume API fails
              positionToUse = savedPos;
              console.log("[Spotify Player] Same track is paused (from SDK state), will resume from position:", savedPos);
            } else if (currentTrack?.uri === trackUri && !isPaused) {
              // Track is already playing - do nothing or handle as needed
              console.log("[Spotify Player] Track is already playing");
              isTogglingRef.current = false;
              return;
            }
          } else {
            // SDK state is null - check if we have saved state for this track
            if (hasSavedState) {
              shouldResume = true;
              positionToUse = currentTrackRef.current!.position;
              console.log("[Spotify Player] SDK state unavailable, but have saved state for same track. Will resume from position:", positionToUse);
            }
          }
        } catch (stateErr) {
          console.warn("[Spotify Player] Could not get current state:", stateErr);
          // If SDK call failed but we have saved state, use it
          if (hasSavedState) {
            shouldResume = true;
            positionToUse = currentTrackRef.current!.position;
            console.log("[Spotify Player] SDK state error, but have saved state. Will resume from position:", positionToUse);
          }
        }
      } else if (hasSavedState) {
        // No player ref but we have saved state - use it
        shouldResume = true;
        positionToUse = currentTrackRef.current!.position;
        console.log("[Spotify Player] No player ref, but have saved state. Will resume from position:", positionToUse);
      }
      
      // If position is explicitly provided, use it (don't resume)
      if (positionMs !== undefined) {
        positionToUse = positionMs;
        shouldResume = false;
      } else if (!shouldResume && !hasSavedState) {
        // No saved state and not resuming - start from beginning
        positionToUse = 0;
        console.log("[Spotify Player] No saved state, starting from beginning");
      }

      try {
        const finalHasSavedState = currentTrackRef.current?.uri === trackUri && 
                                   currentTrackRef.current.position !== undefined;
        console.log("[Spotify Player] Starting playback:", { 
          trackUri, 
          positionMs: positionToUse, 
          deviceId: currentDeviceId.substring(0, 8),
          isActivated,
          isResume: shouldResume,
          hasSavedState: finalHasSavedState,
          savedTrackUri: currentTrackRef.current?.uri,
          savedPosition: currentTrackRef.current?.position,
          actualState: actualPlaybackState ? {
            paused: actualPlaybackState.paused,
            currentTrack: actualPlaybackState.track_window?.current_track?.uri,
            position: actualPlaybackState.position
          } : null
        });
        
        // Check if device is actually active (regardless of isActivated state)
        // This handles cases where state is out of sync
        // Note: waitForActiveDevice may return false due to 403 errors, so we use it as a hint only
        const deviceActive = await waitForActiveDevice(currentDeviceId, currentAccessToken, 2, 500);
        
        if (deviceActive) {
          // Device is active - sync state if needed
          if (!isActivated) {
            console.log("[Spotify Player] Device is active but state says not activated - syncing state");
            setIsActivated(true);
          }
        } else {
          // Device check says not active (or check failed due to API issues)
          // Try to ensure device is ready, but don't block playback if these fail
          if (!isActivated) {
            console.warn("[Spotify Player] Device check suggests not active, attempting to ensure readiness...");
            // Try a simple transfer first (faster than full activation)
            try {
              await transferToHostDevice(currentDeviceId, currentAccessToken, false);
              await new Promise(resolve => setTimeout(resolve, 300));
              // If transfer worked, update state
              setIsActivated(true);
            } catch (transferErr) {
              // Transfer failed - try full activation as fallback
              try {
                await activateDevice();
              } catch (activateErr) {
                // Both failed - but proceed with play attempt anyway
                // The playTrack call will fail if device truly isn't ready
                console.warn("[Spotify Player] Could not ensure device readiness, proceeding with play attempt");
              }
            }
          } else {
            // State says activated but check says not active - try quick reactivation
            console.warn("[Spotify Player] State says activated but device check suggests not active, attempting quick reactivation...");
            try {
              await transferToHostDevice(currentDeviceId, currentAccessToken, false);
              await new Promise(resolve => setTimeout(resolve, 300));
            } catch (transferErr) {
              // Reactivation failed - proceed anyway, play call will fail if needed
              console.warn("[Spotify Player] Quick reactivation failed, proceeding with play attempt");
            }
          }
        }
        
        // Play track with current device ID
        await playTrack(trackUri, positionToUse, currentAccessToken, currentDeviceId, shouldResume);
        
        // If we don't have saved state yet, initialize it with the track URI
        // The position will be updated by the state_changed handler
        if (!currentTrackRef.current || currentTrackRef.current.uri !== trackUri) {
          currentTrackRef.current = {
            uri: trackUri,
            position: positionToUse || 0, // Use the position we're playing from
          };
          console.log("[Spotify Player] Initialized track ref for resume:", {
            uri: trackUri,
            position: positionToUse || 0
          });
        }
        
        // Set playing state immediately (optimistic update)
        // The SDK player_state_changed event will confirm the actual state
        setIsPlaying(true);
        console.log("[Spotify Player] Playback started successfully - waiting for SDK state confirmation");
        
        // Note: We rely on the SDK's player_state_changed event for state updates
        // The API verification is unreliable due to scope issues (403 errors)
        // The optimistic update will be confirmed/corrected by the SDK event
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to play track";
        console.error("[Spotify Player] Playback failed:", err);
        // Reset playing state on error
        setIsPlaying(false);
        setError(errorMessage);
        throw err;
      } finally {
        // Allow toggling again after a short delay
        setTimeout(() => {
          isTogglingRef.current = false;
        }, 300);
      }
    },
    [isActivated, activateDevice, setError]
  );

  /**
   * Pause playback
   * Saves the current track and position for resume functionality
   * The position is also tracked continuously via player_state_changed events,
   * but we refresh it here to ensure we have the most accurate position at pause time
   */
  const pausePlayback = useCallback(async () => {
    if (!accessToken) {
      return;
    }
    
    // Prevent rapid toggling
    if (isTogglingRef.current) {
      console.log("[Spotify Player] Already toggling, ignoring pause request");
      return;
    }
    
    isTogglingRef.current = true;

    try {
      // Try to get current state before pausing to save position
      // If getCurrentState() returns null, we'll rely on the last known state from state_changed handler
      let positionSaved = false;
      if (playerRef.current) {
        try {
          const state = await playerRef.current.getCurrentState();
          if (state) {
            const currentTrack = state.track_window?.current_track;
            if (currentTrack) {
              // Save position even if 0 - we still want to track it
              const position = state.position || 0;
              currentTrackRef.current = {
                uri: currentTrack.uri,
                position: position,
              };
              positionSaved = true;
              console.log("[Spotify Player] Saved position from getCurrentState() before pause:", {
                track: currentTrack.name,
                position: position,
                uri: currentTrack.uri
              });
            }
          }
        } catch (stateErr) {
          console.warn("[Spotify Player] Could not get current state before pause:", stateErr);
        }
      }
      
      // If getCurrentState() didn't work, check if we have a saved state from state_changed handler
      if (!positionSaved && currentTrackRef.current) {
        console.log("[Spotify Player] Using saved state from state_changed handler:", {
          uri: currentTrackRef.current.uri,
          position: currentTrackRef.current.position
        });
        positionSaved = true;
      }
      
      // If we still don't have a position, log a warning
      if (!positionSaved) {
        console.warn("[Spotify Player] WARNING: No position saved before pause! Resume may not work correctly.");
      }

      await pause(accessToken);
      
      // After pausing, try one more time to get the state (sometimes it's available after pause)
      if (!positionSaved && playerRef.current) {
        try {
          // Small delay to let pause complete
          await new Promise(resolve => setTimeout(resolve, 100));
          const state = await playerRef.current.getCurrentState();
          if (state) {
            const currentTrack = state.track_window?.current_track;
            if (currentTrack) {
              const position = state.position || 0;
              currentTrackRef.current = {
                uri: currentTrack.uri,
                position: position,
              };
              console.log("[Spotify Player] Saved position after pause (retry):", {
                track: currentTrack.name,
                position: position,
                uri: currentTrack.uri
              });
              positionSaved = true;
            }
          }
        } catch (retryErr) {
          console.warn("[Spotify Player] Retry getCurrentState() after pause also failed:", retryErr);
        }
      }
      
      // Set playing state immediately (optimistic update)
      // The SDK player_state_changed event will confirm the actual state
      setIsPlaying(false);
      console.log("[Spotify Player] Playback paused - waiting for SDK state confirmation", {
        positionSaved,
        savedState: currentTrackRef.current ? {
          uri: currentTrackRef.current.uri,
          position: currentTrackRef.current.position
        } : null
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to pause";
      setError(errorMessage);
      // On error, don't update state - let SDK event handle it
    } finally {
      // Allow toggling again after a short delay
      setTimeout(() => {
        isTogglingRef.current = false;
      }, 300);
    }
  }, [accessToken, setError]);

  /**
   * Get current playback state from Spotify API
   * This is a fallback - primary source of truth is SDK player_state_changed event
   */
  const checkPlaybackState = useCallback(async () => {
    if (!accessToken || !isActivated) {
      return null;
    }

    try {
      const state = await getPlaybackState(accessToken);
      if (state) {
        // Only update if we got valid state - don't override on API errors
        setIsPlaying(state.is_playing);
        return state;
      } else {
        // No state from API - but don't override SDK state unnecessarily
        // Only set to false if we're confident there's no playback
        return null;
      }
    } catch (err) {
      // API call failed (e.g., 403 Forbidden) - don't update state
      // The SDK player_state_changed event is the source of truth
      // Silently fail - don't log as warning to avoid noise from scope issues
      return null;
    }
  }, [accessToken, isActivated]);

  // Poll playback state when activated (fallback only - SDK events are primary)
  // Note: API polling may fail with 403 errors due to scope issues, but SDK events work
  useEffect(() => {
    if (!isActivated || !accessToken) {
      if (playbackStateIntervalRef.current) {
        clearInterval(playbackStateIntervalRef.current);
        playbackStateIntervalRef.current = null;
      }
      // Only reset if we're sure device is deactivated
      // Don't reset on temporary connection issues
      if (!isActivated) {
        setIsPlaying(false);
      }
      return;
    }

    // Initial check (but don't rely on it - SDK events are primary)
    checkPlaybackState();

    // Poll every 5 seconds (less frequent since SDK events are primary)
    // This is just a fallback in case SDK events are missed
    playbackStateIntervalRef.current = window.setInterval(() => {
      checkPlaybackState();
    }, 5000);

    return () => {
      if (playbackStateIntervalRef.current) {
        clearInterval(playbackStateIntervalRef.current);
        playbackStateIntervalRef.current = null;
      }
    };
  }, [isActivated, accessToken, checkPlaybackState]);

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
        // Clear saved position for new track (will be set by stateChangedHandler when track starts)
        if (currentTrackRef.current?.uri !== trackUri) {
          currentTrackRef.current = null;
        }
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
    isPlaying,
    activateDevice,
    play,
    pause: pausePlayback,
    handleStartSong,
  };
}

