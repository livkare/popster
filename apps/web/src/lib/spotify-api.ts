/**
 * Spotify Web API client
 * All functions interact with Spotify's REST API
 */

const SPOTIFY_API_BASE = "https://api.spotify.com/v1";

/**
 * Wait for device to appear in Spotify's device list
 * Also tries to find by matching the most recent "Hitster Player" device if exact ID doesn't match
 * Returns the actual device ID found (may differ from SDK device_id)
 */
export async function waitForDeviceInList(
  deviceId: string,
  accessToken: string,
  playerName: string = "Hitster Player",
  maxAttempts: number = 20,
  delayMs: number = 500
): Promise<string | null> {
  console.log("[Spotify API] Waiting for device to appear in device list:", deviceId.substring(0, 8));
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const response = await fetch(`${SPOTIFY_API_BASE}/me/player/devices`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (response.ok) {
        const data = await response.json();
        
        // First, try exact match
        const exactMatch = data.devices?.find((d: any) => d.id === deviceId);
        if (exactMatch) {
          console.log("[Spotify API] Device found (exact match):", {
            id: exactMatch.id.substring(0, 8),
            name: exactMatch.name,
            is_active: exactMatch.is_active,
            type: exactMatch.type,
          });
          return exactMatch.id;
        }
        
        // If no exact match, try to find by name (most recent "Hitster Player" device)
        // This handles cases where SDK device_id doesn't match API device_id
        const nameMatches = data.devices?.filter((d: any) => 
          d.name?.includes(playerName) || d.name?.startsWith("Hitster Player")
        ) || [];
        
        if (nameMatches.length > 0) {
          // Sort by most recent (devices are typically ordered by most recent first)
          const mostRecent = nameMatches[0];
          console.log("[Spotify API] Device found by name (SDK device_id may differ):", {
            sdkDeviceId: deviceId.substring(0, 8),
            apiDeviceId: mostRecent.id.substring(0, 8),
            name: mostRecent.name,
            is_active: mostRecent.is_active,
            type: mostRecent.type,
          });
          return mostRecent.id;
        }
        
        if (attempt % 10 === 0) {
          console.log(`[Spotify API] Device not found yet (attempt ${attempt + 1}/${maxAttempts}). Available devices:`, 
            data.devices?.map((d: any) => ({ id: d.id.substring(0, 8), name: d.name })) || []);
        }
      }
    } catch (err) {
      console.warn("[Spotify API] Error checking devices:", err);
    }

    if (attempt < maxAttempts - 1) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  console.error("[Spotify API] Device never appeared in device list");
  return null;
}

/**
 * Wait for device to be available AND active in Spotify's device list
 * This is needed because Web Playback SDK devices may take a moment to appear and become active
 */
export async function waitForActiveDevice(
  deviceId: string,
  accessToken: string,
  maxAttempts: number = 10,
  delayMs: number = 500
): Promise<boolean> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const response = await fetch(`${SPOTIFY_API_BASE}/me/player/devices`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (response.ok) {
        const data = await response.json();
        const device = data.devices?.find((d: any) => d.id === deviceId);
        if (device?.is_active) {
          console.log("[Spotify API] Device is active");
          return true;
        }
      }
    } catch (err) {
      console.warn("[Spotify API] Error checking device:", err);
    }

    if (attempt < maxAttempts - 1) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  return false;
}

/**
 * Transfer playback to host device
 * This makes the device active so it can receive playback commands
 * The device must exist in the device list (but doesn't need to be active yet)
 */
export async function transferToHostDevice(
  deviceId: string,
  accessToken: string,
  requireActive: boolean = false
): Promise<void> {
  if (requireActive) {
    const deviceActive = await waitForActiveDevice(deviceId, accessToken, 5, 500);
    if (!deviceActive) {
      throw new Error("Device is not active");
    }
  }

  const response = await fetch(`${SPOTIFY_API_BASE}/me/player`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      device_ids: [deviceId],
      play: false,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorData;
    try {
      errorData = JSON.parse(errorText);
    } catch {
      errorData = { error: { message: errorText } };
    }

    if (response.status === 401) {
      throw new Error("Spotify authentication expired");
    }
    if (response.status === 404) {
      throw new Error(`Device not found: ${errorData.error?.message || errorText}`);
    }
    throw new Error(`Transfer failed: ${response.status} ${errorData.error?.message || errorText}`);
  }
}

/**
 * Play a track on the host device
 * @param trackUri - The track URI to play (spotify:track:...)
 * @param positionMs - Position in milliseconds. If undefined, will resume current track if it matches, otherwise starts from beginning
 * @param accessToken - Spotify access token
 * @param deviceId - Device ID to play on
 * @param isResume - If true and track matches current track, calls play without uris to resume. If resume fails, will use positionMs if provided.
 */
export async function playTrack(
  trackUri: string,
  positionMs: number | undefined,
  accessToken: string,
  deviceId: string,
  isResume: boolean = false
): Promise<void> {
  if (!accessToken) {
    throw new Error("Access token is required to play track");
  }
  
  if (!deviceId) {
    throw new Error("Device ID is required to play track");
  }

  // Device should already be active from activation step
  // Verify device is active, but if not, try to transfer first (device may have gone inactive)
  let deviceActive = await waitForActiveDevice(deviceId, accessToken, 2, 500);
  if (!deviceActive) {
    // Device might have gone inactive - try transferring again
    console.log("[Spotify API] Device not active, attempting transfer before playback...");
    try {
      await transferToHostDevice(deviceId, accessToken, false);
      // Wait a moment for transfer to complete
      await new Promise(resolve => setTimeout(resolve, 500));
      deviceActive = await waitForActiveDevice(deviceId, accessToken, 3, 500);
    } catch (transferErr) {
      console.warn("[Spotify API] Transfer before playback failed:", transferErr);
    }
    
    if (!deviceActive) {
      throw new Error("Device is not active. Please activate the device first.");
    }
  }

  // If resuming the same track, call play without uris (Spotify API will resume from paused position)
  // According to Spotify API docs: "Resume playback on the user's active device" when no body is sent
  if (isResume) {
    console.log("[Spotify API] Attempting to resume playback (no uris)");
    const response = await fetch(`${SPOTIFY_API_BASE}/me/player/play?device_id=${deviceId}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      // 404 means no active playback - this is expected if track was unloaded
      // Other errors might be recoverable, but we'll fall through to play with uris
      if (response.status === 404) {
        console.log("[Spotify API] No active playback to resume (404), will play with uris");
      } else {
        console.warn("[Spotify API] Resume failed, falling back to play with uris:", {
          status: response.status,
          error: errorText
        });
      }
      // Fall through to play with uris
    } else {
      console.log("[Spotify API] Successfully resumed playback from paused position");
      return;
    }
  }

  // Play track with device_id in query parameter
  // If we were trying to resume but it failed, use positionMs if provided
  // Otherwise, if positionMs is undefined, default to 0 (start from beginning)
  const body: { uris: string[]; position_ms?: number } = {
    uris: [trackUri],
  };
  
  // Always include position_ms if provided (even if 0, as it's an explicit position)
  // If isResume was true but resume failed, positionMs should contain the saved position
  if (positionMs !== undefined) {
    body.position_ms = positionMs;
  }

  const response = await fetch(`${SPOTIFY_API_BASE}/me/player/play?device_id=${deviceId}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[Spotify API] Play failed:", {
      status: response.status,
      statusText: response.statusText,
      error: errorText,
    });
    if (response.status === 401) {
      throw new Error("Spotify authentication expired. Please reconnect to Spotify.");
    }
    if (response.status === 403) {
      throw new Error("Spotify playback forbidden. Make sure you have Premium and the device is active.");
    }
    if (response.status === 404) {
      throw new Error("No active device found. Make sure the Spotify player is ready and connected.");
    }
    throw new Error(`Failed to play track: ${response.status} ${errorText}`);
  }

  console.log("[Spotify API] Successfully started playback");
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
 * Get user's playlists
 */
export async function getUserPlaylists(
  accessToken: string,
  limit: number = 50,
  offset: number = 0
): Promise<{
  items: Array<{
    id: string;
    name: string;
    owner: { display_name: string };
    tracks: { total: number };
    images: Array<{ url: string }>;
  }>;
  total: number;
  next: string | null;
}> {
  if (!accessToken) {
    throw new Error("Access token is required");
  }

  const response = await fetch(
    `${SPOTIFY_API_BASE}/me/playlists?limit=${limit}&offset=${offset}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    if (response.status === 401) {
      throw new Error("Spotify authentication expired. Please reconnect to Spotify.");
    }
    throw new Error(`Failed to fetch playlists: ${response.status} ${errorText}`);
  }

  return await response.json();
}

/**
 * Get all tracks from a playlist (handles pagination)
 */
export async function getPlaylistTracks(
  accessToken: string,
  playlistId: string
): Promise<Array<{
  track: {
    id: string;
    uri: string;
    name: string;
    artists: Array<{ name: string }>;
    album: {
      name: string;
      release_date: string;
      images: Array<{ url: string }>;
    };
  } | null;
}>> {
  if (!accessToken) {
    throw new Error("Access token is required");
  }

  const allTracks: Array<{
    track: {
      id: string;
      uri: string;
      name: string;
      artists: Array<{ name: string }>;
      album: {
        name: string;
        release_date: string;
        images: Array<{ url: string }>;
      };
    } | null;
  }> = [];

  let url = `${SPOTIFY_API_BASE}/playlists/${playlistId}/tracks?limit=50`;
  let hasMore = true;

  while (hasMore) {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      if (response.status === 401) {
        throw new Error("Spotify authentication expired. Please reconnect to Spotify.");
      }
      throw new Error(`Failed to fetch playlist tracks: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    allTracks.push(...data.items);

    if (data.next) {
      url = data.next;
    } else {
      hasMore = false;
    }
  }

  // Filter out null tracks (removed tracks)
  return allTracks.filter((item) => item.track !== null);
}

/**
 * Extract release year from Spotify release_date field
 * Handles formats: "YYYY", "YYYY-MM", "YYYY-MM-DD"
 */
export function extractReleaseYear(releaseDate: string | null | undefined): number | null {
  if (!releaseDate) {
    return null;
  }

  // Extract year from various formats
  const yearMatch = releaseDate.match(/^(\d{4})/);
  if (yearMatch) {
    const year = parseInt(yearMatch[1], 10);
    // Validate year is reasonable
    if (year >= 1900 && year <= 2100) {
      return year;
    }
  }

  return null;
}

/**
 * Get track metadata including release year
 * This processes playlist tracks and extracts metadata
 */
export interface TrackMetadata {
  trackUri: string;
  name: string;
  artist: string;
  releaseYear: number | null;
  albumArt?: string;
}

export function processPlaylistTracks(
  playlistTracks: Array<{
    track: {
      id: string;
      uri: string;
      name: string;
      artists: Array<{ name: string }>;
      album: {
        name: string;
        release_date: string;
        images: Array<{ url: string }>;
      };
    } | null;
  }>
): TrackMetadata[] {
  return playlistTracks
    .filter((item) => item.track !== null)
    .map((item) => {
      const track = item.track!;
      const artist = track.artists.map((a) => a.name).join(", ");
      const releaseYear = extractReleaseYear(track.album.release_date);
      const albumArt = track.album.images?.[0]?.url;

      return {
        trackUri: track.uri,
        name: track.name,
        artist,
        releaseYear,
        albumArt,
      };
    });
}

