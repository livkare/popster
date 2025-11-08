import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "../components/Layout.js";
import { createMessage } from "@hitster/proto";
import { useWebSocket } from "../hooks/useWebSocket.js";
import { useRoomStore } from "../store/index.js";
import { isValidRoomKeyFormat, normalizeRoomKey } from "../lib/room-validation.js";

export function LandingPage() {
  const navigate = useNavigate();
  const { sendMessage, isConnected, onRoomCreated } = useWebSocket();
  const { setIsHost } = useRoomStore();
  const [roomKey, setRoomKey] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const createTimeoutRef = useRef<number | null>(null);

  // Set up callback for room creation
  useEffect(() => {
    onRoomCreated((roomKey) => {
      // Clear timeout if room was created
      if (createTimeoutRef.current) {
        clearTimeout(createTimeoutRef.current);
        createTimeoutRef.current = null;
      }
      setIsCreating(false);
      setError(null);
      setIsHost(true);
      // Navigate to host page
      navigate(`/host/${roomKey}`);
    });

    // Cleanup timeout on unmount
    return () => {
      if (createTimeoutRef.current) {
        clearTimeout(createTimeoutRef.current);
      }
    };
  }, [onRoomCreated, navigate, setIsHost]);

  const handleCreateRoom = async () => {
    if (!isConnected) {
      setError("Please wait for the connection to establish before creating a room.");
      return;
    }

    // Prevent multiple simultaneous clicks
    if (isCreating) {
      return;
    }

    setError(null);
    setIsCreating(true);
    setIsHost(true);

    // Set timeout for room creation (10 seconds)
    createTimeoutRef.current = window.setTimeout(() => {
      setIsCreating(false);
      setError("Room creation timed out. Please check your connection and try again.");
      createTimeoutRef.current = null;
    }, 10000);

    try {
      const message = createMessage("CREATE_ROOM", {
        gameMode: "original", // Default mode
      });

      sendMessage(message);
      // Navigation will happen via onRoomCreated callback
    } catch (error) {
      setIsCreating(false);
      setError("Failed to create room. Please try again.");
      if (createTimeoutRef.current) {
        clearTimeout(createTimeoutRef.current);
        createTimeoutRef.current = null;
      }
    }
  };

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();

    if (!roomKey || roomKey.length !== 6) {
      setError("Please enter a valid 6-digit room key");
      return;
    }

    // Validate room key format (should be alphanumeric)
    if (!isValidRoomKeyFormat(roomKey)) {
      setError("Room key must be 6 alphanumeric characters");
      return;
    }

    setError(null);
    setIsJoining(true);
    setIsHost(false);

    // Navigate to room page - it will handle joining
    navigate(`/room/${normalizeRoomKey(roomKey)}`);
  };

  return (
    <Layout>
      <div className="max-w-md mx-auto">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Hitster</h2>
          <p className="text-gray-600">Turn your phone into a music time machine</p>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center gap-2">
              <span className="text-red-600">⚠️</span>
              <p className="text-sm text-red-800">{error}</p>
            </div>
            <button
              onClick={() => setError(null)}
              className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
            >
              Dismiss
            </button>
          </div>
        )}

        <div className="space-y-6">
          {/* Create Game Section */}
          <div className="card">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">Create Game</h3>
            <p className="text-sm text-gray-600 mb-4">
              Start a new game room and invite friends to join
            </p>
            <button
              onClick={handleCreateRoom}
              disabled={isCreating || !isConnected}
              className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCreating ? "Creating..." : isConnected ? "Create Game" : "Connecting..."}
            </button>
          </div>

          {/* Join Game Section */}
          <div className="card">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">Join Game</h3>
            <p className="text-sm text-gray-600 mb-4">
              Enter a room key to join an existing game
            </p>
            <form onSubmit={handleJoinRoom}>
              <div className="mb-4">
                <input
                  type="text"
                  value={roomKey}
                  onChange={(e) => setRoomKey(normalizeRoomKey(e.target.value))}
                  placeholder="Enter 6-digit code"
                  maxLength={6}
                  className="input text-center text-2xl font-mono uppercase tracking-widest"
                  aria-label="Room key"
                />
              </div>
              <button
                type="submit"
                disabled={isJoining || roomKey.length !== 6}
                className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isJoining ? "Joining..." : "Join Game"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </Layout>
  );
}

