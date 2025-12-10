// Spotify API utility functions

const SPOTIFY_API_BASE = 'https://api.spotify.com/v1';

// Spotify API response types
interface SpotifyPlaylist {
  id: string;
  name: string;
  owner: {
    display_name: string;
  };
  tracks: {
    total: number;
  };
}

interface SpotifyPlaylistResponse {
  items: SpotifyPlaylist[];
  next: string | null;
}

interface SpotifyTrackItem {
  track: {
    id: string;
    name: string;
    artists: Array<{ name: string }>;
    album: {
      release_date: string | null;
      release_date_precision?: string;
    };
  } | null;
}

interface SpotifyTracksResponse {
  items: SpotifyTrackItem[];
  next: string | null;
}

// Fetch all user playlists with pagination
export async function fetchUserPlaylists(token: string): Promise<SpotifyPlaylist[]> {
  const playlists: SpotifyPlaylist[] = [];
  let url = `${SPOTIFY_API_BASE}/me/playlists?limit=50`;

  while (url) {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to fetch playlists: ${error.error?.message || response.statusText}`);
    }

    const data: SpotifyPlaylistResponse = await response.json();
    playlists.push(...data.items);
    url = data.next || '';
  }

  return playlists;
}

// Fetch all tracks from a playlist with pagination
export async function fetchPlaylistTracks(token: string, playlistId: string): Promise<SpotifyTrackItem[]> {
  const tracks: SpotifyTrackItem[] = [];
  let url = `${SPOTIFY_API_BASE}/playlists/${playlistId}/tracks?limit=50`;

  while (url) {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to fetch playlist tracks: ${error.error?.message || response.statusText}`);
    }

    const data: SpotifyTracksResponse = await response.json();
    tracks.push(...data.items);
    url = data.next || '';
  }

  return tracks;
}

// Extract release year from release_date string (format: YYYY-MM-DD or YYYY)
export function extractReleaseYear(releaseDate: string | null | undefined): number | null {
  if (!releaseDate) return null;
  
  const yearMatch = releaseDate.match(/^(\d{4})/);
  if (yearMatch) {
    return parseInt(yearMatch[1], 10);
  }
  
  return null;
}

// Spotify device interface
export interface SpotifyDevice {
  id: string;
  is_active: boolean;
  is_private_session: boolean;
  is_restricted: boolean;
  name: string;
  type: string;
  volume_percent: number;
}

interface SpotifyDevicesResponse {
  devices: SpotifyDevice[];
}

// Get available devices
export async function getAvailableDevices(token: string): Promise<SpotifyDevice[]> {
  const response = await fetch(`${SPOTIFY_API_BASE}/me/player/devices`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
    throw new Error(`Failed to get devices: ${error.error?.message || response.statusText}`);
  }

  const data: SpotifyDevicesResponse = await response.json();
  return data.devices;
}

// Transfer playback to a device
export async function transferPlayback(token: string, deviceId: string): Promise<void> {
  const response = await fetch(`${SPOTIFY_API_BASE}/me/player`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      device_ids: [deviceId],
      play: false
    })
  });

  if (!response.ok && response.status !== 204) {
    const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
    throw new Error(`Failed to transfer playback: ${error.error?.message || response.statusText}`);
  }
}

// Ensure a device is active (get devices and transfer to first available)
export async function ensureDeviceActive(token: string): Promise<boolean> {
  try {
    const devices = await getAvailableDevices(token);
    
    if (devices.length === 0) {
      console.warn('No devices available. User needs to have Spotify open on a device.');
      return false;
    }

    // Find active device first, otherwise use first available device
    const activeDevice = devices.find(d => d.is_active);
    const targetDevice = activeDevice || devices[0];

    if (targetDevice && !targetDevice.is_active) {
      console.log(`Transferring playback to device: ${targetDevice.name} (${targetDevice.id})`);
      await transferPlayback(token, targetDevice.id);
      // Wait a bit for the transfer to complete
      await new Promise(resolve => setTimeout(resolve, 500));
    } else if (targetDevice && targetDevice.is_active) {
      console.log(`Device already active: ${targetDevice.name}`);
    }

    return true;
  } catch (error) {
    console.error('Error ensuring device is active:', error);
    return false;
  }
}

// Start playback of a track
export async function startPlayback(token: string, trackId: string): Promise<void> {
  // Ensure device is active before starting playback
  await ensureDeviceActive(token);

  const trackUri = `spotify:track:${trackId}`;
  
  const response = await fetch(`${SPOTIFY_API_BASE}/me/player/play`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      uris: [trackUri]
    })
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
    throw new Error(`Failed to start playback: ${error.error?.message || response.statusText}`);
  }
}

// Pause playback
export async function pausePlayback(token: string): Promise<void> {
  const response = await fetch(`${SPOTIFY_API_BASE}/me/player/pause`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (!response.ok && response.status !== 204) {
    const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
    throw new Error(`Failed to pause playback: ${error.error?.message || response.statusText}`);
  }
}

// Track details interface
export interface TrackDetails {
  id: string;
  name: string;
  artists: Array<{ name: string }>;
  album: {
    name: string;
    images: Array<{ url: string; height: number; width: number }>;
    release_date: string | null;
  };
}

interface TrackDetailsResponse {
  id: string;
  name: string;
  artists: Array<{ name: string }>;
  album: {
    name: string;
    images: Array<{ url: string; height: number; width: number }>;
    release_date: string | null;
  };
}

// Fetch track details including album images
export async function fetchTrackDetails(token: string, trackId: string): Promise<TrackDetails> {
  const response = await fetch(`${SPOTIFY_API_BASE}/tracks/${trackId}`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
    throw new Error(`Failed to fetch track details: ${error.error?.message || response.statusText}`);
  }

  const data: TrackDetailsResponse = await response.json();
  return {
    id: data.id,
    name: data.name,
    artists: data.artists,
    album: {
      name: data.album.name,
      images: data.album.images,
      release_date: data.album.release_date
    }
  };
}

