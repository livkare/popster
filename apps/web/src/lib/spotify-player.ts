/**
 * Spotify Web Playback SDK manager
 * Dynamically loads and initializes the SDK
 */

// Type definitions for Spotify SDK
declare global {
  interface Window {
    Spotify?: {
      Player: new (options: {
        name: string;
        getOAuthToken: (callback: (token: string) => void) => void;
        volume?: number;
      }) => SpotifyPlayer;
    };
    onSpotifyWebPlaybackSDKReady?: () => void;
  }
}

export interface SpotifyPlayer {
  connect(): Promise<void>;
  disconnect(): void;
  getCurrentState(): Promise<any>;
  setName(name: string): Promise<void>;
  getVolume(): Promise<number>;
  setVolume(volume: number): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  seek(positionMs: number): Promise<void>;
  addListener(event: string, callback: (state: any) => void): void;
  removeListener(event: string, callback: (state: any) => void): void;
  on(event: string, callback: (state: any) => void): void;
  off(event: string, callback: (state: any) => void): void;
}

let sdkLoaded = false;
let sdkLoading = false;

/**
 * Load Spotify Web Playback SDK
 */
export async function loadSpotifySDK(): Promise<void> {
  if (sdkLoaded) {
    return;
  }

  if (sdkLoading) {
    // Wait for existing load to complete
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (sdkLoaded) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);
    });
  }

  sdkLoading = true;

  return new Promise((resolve, reject) => {
    // Check if SDK is already available
    if (window.Spotify) {
      sdkLoaded = true;
      sdkLoading = false;
      resolve();
      return;
    }

    // Set up ready callback
    window.onSpotifyWebPlaybackSDKReady = () => {
      sdkLoaded = true;
      sdkLoading = false;
      resolve();
    };

    // Load SDK script
    const script = document.createElement("script");
    script.src = "https://sdk.scdn.co/spotify-player.js";
    script.async = true;
    script.onerror = () => {
      sdkLoading = false;
      reject(new Error("Failed to load Spotify Web Playback SDK"));
    };
    document.body.appendChild(script);
  });
}

/**
 * Initialize Spotify player
 */
export async function initializePlayer(
  token: string,
  playerName: string = "Hitster Player"
): Promise<{ player: SpotifyPlayer; deviceId: string }> {
  await loadSpotifySDK();

  if (!window.Spotify) {
    throw new Error("Spotify SDK not loaded");
  }

  const player = new window.Spotify.Player({
    name: playerName,
    getOAuthToken: (callback) => {
      callback(token);
    },
    volume: 0.5,
  });

  // Connect player
  await player.connect();

  // Wait for device to be ready
  const deviceId = await new Promise<string>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Timeout waiting for device to be ready"));
    }, 10000); // 10 second timeout

    player.addListener("ready", ({ device_id }: { device_id: string }) => {
      clearTimeout(timeout);
      resolve(device_id);
    });

    player.addListener("not_ready", ({ device_id }: { device_id: string }) => {
      console.warn("Device went offline:", device_id);
    });

    player.addListener("authentication_error", ({ message }: { message: string }) => {
      clearTimeout(timeout);
      reject(new Error(`Authentication error: ${message}`));
    });

    player.addListener("account_error", ({ message }: { message: string }) => {
      clearTimeout(timeout);
      reject(new Error(`Account error: ${message}`));
    });

    player.addListener("playback_error", ({ message }: { message: string }) => {
      console.error("Playback error:", message);
    });
  });

  return { player, deviceId };
}

