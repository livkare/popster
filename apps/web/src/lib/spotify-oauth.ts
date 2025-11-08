/**
 * Spotify OAuth utilities
 */

export const SPOTIFY_AUTH_URL = "https://accounts.spotify.com/authorize";
export const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token";

export const SPOTIFY_SCOPES = [
  "streaming",
  "user-read-playback-state",
  "user-modify-playback-state",
  "user-read-email", // Required to get product field (premium status)
];

/**
 * Generate Spotify OAuth authorization URL
 */
export function generateAuthUrl(
  clientId: string,
  redirectUri: string,
  scopes: string[] = SPOTIFY_SCOPES,
  state?: string
): string {
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    scope: scopes.join(" "),
    show_dialog: "false",
  });

  // Add state parameter if provided (used to preserve roomKey through OAuth flow)
  if (state) {
    params.set("state", state);
  }

  return `${SPOTIFY_AUTH_URL}?${params.toString()}`;
}

/**
 * Extract authorization code from callback URL
 * Checks both query params and hash fragments
 */
export function extractCodeFromCallback(): string | null {
  const url = new URL(window.location.href);
  
  // Check query params first
  const codeFromQuery = url.searchParams.get("code");
  if (codeFromQuery) {
    return codeFromQuery;
  }

  // Check hash fragments
  const hash = url.hash.substring(1); // Remove #
  const hashParams = new URLSearchParams(hash);
  const codeFromHash = hashParams.get("code");
  if (codeFromHash) {
    return codeFromHash;
  }

  return null;
}

/**
 * Extract error from callback URL
 */
export function extractErrorFromCallback(): string | null {
  const url = new URL(window.location.href);
  
  // Check query params
  const errorFromQuery = url.searchParams.get("error");
  if (errorFromQuery) {
    return errorFromQuery;
  }

  // Check hash fragments
  const hash = url.hash.substring(1);
  const hashParams = new URLSearchParams(hash);
  const errorFromHash = hashParams.get("error");
  if (errorFromHash) {
    return errorFromHash;
  }

  return null;
}

/**
 * Extract state parameter from callback URL
 * Used to preserve roomKey through OAuth flow
 */
export function extractStateFromCallback(): string | null {
  const url = new URL(window.location.href);
  
  // Check query params first
  const stateFromQuery = url.searchParams.get("state");
  if (stateFromQuery) {
    return stateFromQuery;
  }

  // Check hash fragments
  const hash = url.hash.substring(1);
  const hashParams = new URLSearchParams(hash);
  const stateFromHash = hashParams.get("state");
  if (stateFromHash) {
    return stateFromHash;
  }

  return null;
}

