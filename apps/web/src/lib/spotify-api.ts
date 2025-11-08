/**
 * Spotify Web API client
 * All functions interact with Spotify's REST API
 */

const SPOTIFY_API_BASE = "https://api.spotify.com/v1";

/**
 * Transfer playback to host device
 */
export async function transferToHostDevice(
  deviceId: string,
  accessToken: string
): Promise<void> {
  if (!accessToken) {
    throw new Error("Access token is required to transfer playback");
  }
  
  const response = await fetch(`${SPOTIFY_API_BASE}/me/player`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      device_ids: [deviceId],
      play: false, // Don't auto-play, just transfer
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    if (response.status === 401) {
      throw new Error("Spotify authentication expired. Please reconnect to Spotify.");
    }
    throw new Error(`Failed to transfer playback: ${response.status} ${errorText}`);
  }
}

/**
 * Play a track on the host device
 */
export async function playTrack(
  trackUri: string,
  positionMs: number,
  accessToken: string
): Promise<void> {
  if (!accessToken) {
    throw new Error("Access token is required to play track");
  }
  
  // First transfer to device, then play
  const deviceId = await getCurrentDeviceId(accessToken);
  if (deviceId) {
    await transferToHostDevice(deviceId, accessToken);
  }

  const response = await fetch(`${SPOTIFY_API_BASE}/me/player/play`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      uris: [trackUri],
      position_ms: positionMs,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    if (response.status === 401) {
      throw new Error("Spotify authentication expired. Please reconnect to Spotify.");
    }
    throw new Error(`Failed to play track: ${response.status} ${errorText}`);
  }
}

/**
 * Pause playback
 */
export async function pause(accessToken: string): Promise<void> {
  const response = await fetch(`${SPOTIFY_API_BASE}/me/player/pause`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok && response.status !== 404) {
    // 404 means no active playback, which is fine
    const errorText = await response.text();
    throw new Error(`Failed to pause: ${response.status} ${errorText}`);
  }
}

/**
 * Get current playback state
 */
export async function getPlaybackState(accessToken: string): Promise<any> {
  const response = await fetch(`${SPOTIFY_API_BASE}/me/player`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (response.status === 204) {
    return null; // No active playback
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get playback state: ${response.status} ${errorText}`);
  }

  return await response.json();
}

/**
 * Check if user has Spotify Premium
 * Uses multiple methods:
 * 1. Checks product field from /me endpoint (requires user-read-email scope)
 * 2. Falls back to checking if user can access playback devices (premium feature)
 */
export async function checkPremium(accessToken: string): Promise<boolean> {
  if (!accessToken) {
    throw new Error("Access token is required to check premium status");
  }
  
  try {
    // Method 1: Check product field from user profile
    const userResponse = await fetch(`${SPOTIFY_API_BASE}/me`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!userResponse.ok) {
      const errorText = await userResponse.text();
      console.error("[Spotify API] User profile check failed:", {
        status: userResponse.status,
        statusText: userResponse.statusText,
        error: errorText,
      });
      throw new Error(`Failed to check user profile: ${userResponse.status} ${errorText}`);
    }

    const user = await userResponse.json();
    console.log("[Spotify API] User info:", {
      id: user.id,
      product: user.product,
      display_name: user.display_name,
    });
    
    // If product field is available, use it directly
    if (user.product !== undefined) {
      // Spotify product can be: "premium", "free", "open", "unlimited"
      return user.product === "premium";
    }

    // Method 2: Product field is undefined - try to check if user can access playback devices
    // Premium users can access /me/player/devices, free users get 403
    console.log("[Spotify API] Product field undefined, checking playback access...");
    try {
      const devicesResponse = await fetch(`${SPOTIFY_API_BASE}/me/player/devices`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      // 200 = can access devices = likely premium
      // 403 = forbidden = definitely not premium (this is expected for free users)
      // Other errors = unknown
      if (devicesResponse.status === 200) {
        console.log("[Spotify API] User can access playback devices - assuming Premium");
        return true;
      } else if (devicesResponse.status === 403) {
        // 403 is expected for free accounts - don't log as error
        console.log("[Spotify API] User cannot access playback devices (403) - not Premium");
        return false;
      } else {
        // Unknown status - log and return false to be safe
        console.warn("[Spotify API] Unknown status when checking devices:", devicesResponse.status);
        return false;
      }
    } catch (devicesError) {
      console.error("[Spotify API] Error checking playback devices:", devicesError);
      // If we can't check devices, default to false (safer)
      return false;
    }
  } catch (error) {
    console.error("[Spotify API] Error checking premium:", error);
    throw error;
  }
}

/**
 * Get current device ID from available devices
 */
async function getCurrentDeviceId(accessToken: string): Promise<string | null> {
  try {
    const response = await fetch(`${SPOTIFY_API_BASE}/me/player/devices`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const activeDevice = data.devices?.find((device: any) => device.is_active);
    return activeDevice?.id || null;
  } catch {
    return null;
  }
}

