import { useEffect, useState, useCallback, useRef } from "react";
import { useSpotifyStore } from "../store/spotify-store.js";
import { initializePlayer, type SpotifyPlayer } from "../lib/spotify-player.js";
import { playTrack, pause, transferToHostDevice } from "../lib/spotify-api.js";
import { createMessage } from "@hitster/proto";
import type { Message } from "@hitster/proto";

/**
 * Hook for managing Spotify Web Playback SDK and playback control
 */
export function useSpotifyPlayer() {
  const { isAuthenticated, accessToken, deviceId, setDeviceId, setError } = useSpotifyStore();
  const [isReady, setIsReady] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const playerRef = useRef<SpotifyPlayer | null>(null);

  // Initialize SDK when authenticated
  useEffect(() => {
    if (!isAuthenticated || !accessToken || isInitializing || playerRef.current) {
      return;
    }

    async function initPlayer() {
      setIsInitializing(true);
      setError(null);

      try {
        const { player, deviceId: newDeviceId } = await initializePlayer(
          accessToken,
          "Hitster Player"
        );

        playerRef.current = player;
        setDeviceId(newDeviceId);
        setIsReady(true);

        // Device registration will be handled by the component using sendMessage

        // Set up player event listeners
        player.addListener("ready", ({ device_id }: { device_id: string }) => {
          console.log("Device ready:", device_id);
          setDeviceId(device_id);
          setIsReady(true);
        });

        player.addListener("not_ready", ({ device_id }: { device_id: string }) => {
          console.warn("Device went offline:", device_id);
          setIsReady(false);
        });

        player.addListener("authentication_error", ({ message }: { message: string }) => {
          setError(`Authentication error: ${message}`);
          setIsReady(false);
        });

        player.addListener("account_error", ({ message }: { message: string }) => {
          setError(`Account error: ${message}`);
          setIsReady(false);
        });

        player.addListener("playback_error", ({ message }: { message: string }) => {
          console.error("Playback error:", message);
          setError(`Playback error: ${message}`);
        });
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
          playerRef.current.disconnect();
        } catch (err) {
          console.error("Failed to disconnect player:", err);
        }
        playerRef.current = null;
      }
    };
  }, [isAuthenticated, accessToken, isInitializing, setDeviceId, setError]);

  /**
   * Play a track
   */
  const play = useCallback(
    async (trackUri: string, positionMs: number = 0) => {
      if (!accessToken || !deviceId) {
        throw new Error("Player not ready");
      }

      try {
        // Transfer to device first
        await transferToHostDevice(deviceId, accessToken);
        // Then play
        await playTrack(trackUri, positionMs, accessToken);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to play track";
        setError(errorMessage);
        throw err;
      }
    },
    [accessToken, deviceId, setError]
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

      const { trackUri, positionMs = 0 } = message.payload;

      if (!isReady || !accessToken || !deviceId) {
        console.warn("Player not ready, cannot play track");
        return;
      }

      try {
        await play(trackUri, positionMs);
      } catch (err) {
        console.error("Failed to play track from START_SONG:", err);
      }
    },
    [isReady, accessToken, deviceId, play]
  );

  return {
    deviceId,
    isReady,
    isInitializing,
    play,
    pause: pausePlayback,
    handleStartSong,
  };
}

