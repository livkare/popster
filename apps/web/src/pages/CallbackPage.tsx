import { useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Layout } from "../components/Layout.js";
import { useSpotifyAuth } from "../hooks/useSpotifyAuth.js";
import { getRoomState, saveRoomState } from "../lib/room-storage.js";
import { extractStateFromCallback } from "../lib/spotify-oauth.js";
import { useSpotifyStore } from "../store/spotify-store.js";

export function CallbackPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { handleCallback, extractCodeFromCallback, extractErrorFromCallback } = useSpotifyAuth();
  const { setError: clearStoreError } = useSpotifyStore();
  const [status, setStatus] = useState<"processing" | "success" | "error">("processing");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const hasProcessed = useRef(false);

  useEffect(() => {
    // Prevent multiple executions
    if (hasProcessed.current) {
      return;
    }

    async function processCallback() {
      hasProcessed.current = true;
      
      // Clear any previous error state from the store immediately
      clearStoreError(null);
      
      // Extract code first - if we have a code, authentication was successful
      // even if there's also an error parameter (which could be stale)
      const code = extractCodeFromCallback();
      
      if (code) {
        // We have a code, so proceed with token exchange
        // (even if there's also an error param - code takes precedence)
        // Keep status as "processing" - don't show error
        setStatus("processing");
        setErrorMessage(null);
      } else {
        // No code found, check for error parameter
        const error = extractErrorFromCallback();
        if (error) {
          setStatus("error");
          setErrorMessage(`Authentication failed: ${error}`);
          return;
        }
        
        // No code and no error - invalid callback
        setStatus("error");
        setErrorMessage("No authorization code found in callback");
        return;
      }

      // Exchange code for tokens
      const success = await handleCallback(code);
      if (success) {
        setStatus("success");
        
        // Small delay to ensure tokens are fully saved to IndexedDB and store is updated
        // This prevents race conditions where HostPage tries to use tokens before they're available
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Get roomKey from multiple sources (in order of preference):
        // 1. OAuth state parameter (most reliable - preserved through redirect)
        // 2. URL state parameter (fallback)
        // 3. localStorage spotify_redirect_room
        // 4. Persisted room state (last resort)
        let roomKey = extractStateFromCallback() || searchParams.get("state") || localStorage.getItem("spotify_redirect_room");
        
        // If still no room key, check persisted room state
        if (!roomKey) {
          const persistedState = getRoomState();
          if (persistedState && persistedState.isHost) {
            roomKey = persistedState.roomKey;
            console.log("[CallbackPage] Found roomKey from persisted state:", roomKey);
          }
        }
        
        console.log("[CallbackPage] Redirecting to room:", roomKey);
        if (roomKey) {
          localStorage.removeItem("spotify_redirect_room");
          
          // Get persisted state and ensure it's properly saved after OAuth callback
          // This is critical because localStorage might have been cleared due to origin mismatch
          const persistedState = getRoomState();
          if (persistedState && persistedState.roomKey === roomKey && persistedState.isHost) {
            // State exists and matches - ensure it's saved (may have been lost due to origin mismatch)
            // This ensures playerName and other state is available for rejoin
            saveRoomState(persistedState);
            console.log("[CallbackPage] Restored persisted state:", {
              roomKey: persistedState.roomKey,
              playerName: persistedState.playerName,
              hasPlayerId: !!persistedState.playerId,
            });
          } else {
            // If we don't have persisted state but have roomKey, create minimal state
            // This helps with rejoin even if state was lost
            console.log("[CallbackPage] No persisted state found, creating minimal state for rejoin");
            saveRoomState({
              roomKey,
              isHost: true,
              playerName: "", // Will need to be filled in or use fallback
              playerAvatar: "🎵",
            });
          }
          
          // Navigate with a query parameter to indicate this is a post-auth redirect
          // This helps HostPage know the user was previously joined even if localStorage is empty
          navigate(`/host/${roomKey}?auth=success`, { replace: true });
        } else {
          console.warn("[CallbackPage] No roomKey found, redirecting to home");
          setErrorMessage("No room found. Redirecting to home page.");
          // Fallback to home after showing error
          setTimeout(() => {
            navigate("/", { replace: true });
          }, 3000);
        }
      } else {
        setStatus("error");
        setErrorMessage("Failed to exchange authorization code");
      }
    }

    processCallback();
  }, [handleCallback, extractCodeFromCallback, extractErrorFromCallback, navigate, searchParams, clearStoreError]);

  return (
    <Layout>
      {/* Debug Info Panel - Always visible in dev */}
      {import.meta.env.DEV && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-xs font-mono mb-4 max-w-md mx-auto">
          <div className="font-semibold text-yellow-800 mb-2">🐛 CallbackPage Debug</div>
          <div className="grid grid-cols-2 gap-2 text-yellow-700">
            <div>Status: <span className="text-blue-600">{status}</span></div>
            <div>Has Processed: <span className={hasProcessed.current ? "text-green-600" : "text-red-600"}>{String(hasProcessed.current)}</span></div>
            {errorMessage && (
              <div className="col-span-2 text-red-600">Error: {errorMessage}</div>
            )}
          </div>
        </div>
      )}
      <div className="max-w-md mx-auto">
        <div className="card text-center">
          {status === "processing" && (
            <>
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Connecting to Spotify...</h2>
              <p className="text-gray-600">Please wait while we complete authentication.</p>
            </>
          )}

          {status === "success" && (
            <>
              <div className="text-green-600 text-5xl mb-4">✓</div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Successfully Connected!</h2>
              <p className="text-gray-600">Redirecting to your room...</p>
            </>
          )}

          {status === "error" && (
            <>
              <div className="text-red-600 text-5xl mb-4">✗</div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Authentication Failed</h2>
              <p className="text-gray-600 mb-4">{errorMessage || "An error occurred during authentication."}</p>
              <button
                onClick={() => navigate("/")}
                className="btn-primary"
              >
                Go Home
              </button>
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}

