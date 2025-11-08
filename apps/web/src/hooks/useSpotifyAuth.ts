import { useEffect, useState, useCallback } from "react";
import { useSpotifyStore } from "../store/spotify-store.js";
import { generateAuthUrl, extractCodeFromCallback, extractErrorFromCallback } from "../lib/spotify-oauth.js";
import { saveTokens, getTokens, clearTokens } from "../lib/spotify-storage.js";
import { checkPremium } from "../lib/spotify-api.js";
import { API_URL } from "../config.js";

const SPOTIFY_CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID || "";
const SPOTIFY_REDIRECT_URL = import.meta.env.VITE_SPOTIFY_REDIRECT_URL || `${window.location.origin}/callback`;

// Debug logging in development
if (import.meta.env.DEV) {
  console.log("[Spotify Auth] Environment check:", {
    hasClientId: !!SPOTIFY_CLIENT_ID,
    clientIdLength: SPOTIFY_CLIENT_ID.length,
    redirectUrl: SPOTIFY_REDIRECT_URL,
    allEnvKeys: Object.keys(import.meta.env).filter(key => key.startsWith('VITE_')),
  });
}

/**
 * Hook for managing Spotify OAuth authentication
 */
export function useSpotifyAuth() {
  const {
    isAuthenticated,
    isPremium,
    accessToken,
    refreshToken,
    error,
    setAuth,
    setPremium,
    setError,
    reset,
  } = useSpotifyStore();

  const [isChecking, setIsChecking] = useState(false);

  // Check for existing tokens on mount
  useEffect(() => {
    async function checkExistingTokens() {
      setIsChecking(true);
      try {
        const tokens = await getTokens();
        if (tokens) {
          setAuth(tokens.accessToken, tokens.refreshToken);

          // Check premium status
          try {
            const premium = await checkPremium(tokens.accessToken);
            console.log("[Spotify Auth] Premium check result:", premium);
            setPremium(premium);
          } catch (err) {
            console.error("[Spotify Auth] Failed to check premium status:", err);
            // Don't set to false on error - keep as null (unknown) so user can retry
            // Only set to false if we get a successful response that says not premium
          }
        }
      } catch (err) {
        console.error("Failed to check tokens:", err);
      } finally {
        setIsChecking(false);
      }
    }

    checkExistingTokens();
  }, [setAuth, setPremium]);

  /**
   * Start OAuth flow - redirect to Spotify
   * @param state Optional state parameter to preserve through OAuth flow (e.g., roomKey)
   */
  const authenticate = useCallback((state?: string) => {
    if (!SPOTIFY_CLIENT_ID) {
      console.error("[Spotify Auth] Missing VITE_SPOTIFY_CLIENT_ID. Check .env file in apps/web directory.");
      setError("Spotify Client ID not configured. Please check your .env file and restart the dev server.");
      return;
    }

    const authUrl = generateAuthUrl(SPOTIFY_CLIENT_ID, SPOTIFY_REDIRECT_URL, undefined, state);
    console.log("[Spotify Auth] Redirecting to:", authUrl, state ? `with state: ${state}` : "");
    window.location.href = authUrl;
  }, [setError]);

  /**
   * Handle OAuth callback - exchange code for tokens
   */
  const handleCallback = useCallback(async (code: string): Promise<boolean> => {
    try {
      setError(null);

      // Exchange code for tokens
      console.log("[Spotify Auth] Exchanging code, redirectUri:", SPOTIFY_REDIRECT_URL);
      const response = await fetch(`${API_URL}/api/spotify/token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          code,
          redirectUri: SPOTIFY_REDIRECT_URL,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("[Spotify Auth] Token exchange failed:", {
          status: response.status,
          error: errorData,
          redirectUri: SPOTIFY_REDIRECT_URL,
          apiUrl: API_URL,
        });
        throw new Error(errorData.error?.message || "Failed to exchange authorization code");
      }

      const { accessToken, refreshToken, expiresIn } = await response.json();

      // Save tokens to IndexedDB
      await saveTokens(accessToken, refreshToken, expiresIn);
      setAuth(accessToken, refreshToken);

      // Check premium status
      try {
        const premium = await checkPremium(accessToken);
        console.log("[Spotify Auth] Premium check result after auth:", premium);
        setPremium(premium);
      } catch (err) {
        console.error("[Spotify Auth] Failed to check premium status after auth:", err);
        // Set to null (unknown) instead of false on error
        // This allows the UI to show "checking" state and user can retry
        setPremium(null);
      }

      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Authentication failed";
      setError(errorMessage);
      return false;
    }
  }, [setAuth, setPremium, setError]);

  /**
   * Logout - clear tokens and reset state
   */
  const logout = useCallback(async () => {
    try {
      await clearTokens();
      reset();
    } catch (err) {
      console.error("Failed to logout:", err);
    }
  }, [reset]);

  return {
    isAuthenticated,
    isPremium,
    accessToken,
    refreshToken,
    error,
    isChecking,
    authenticate,
    handleCallback,
    logout,
    extractCodeFromCallback,
    extractErrorFromCallback,
  };
}

