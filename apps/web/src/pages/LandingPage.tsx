import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "../components/Layout.js";
import { Logo } from "../components/Logo.js";
import { createMessage } from "@hitster/proto";
import { useWebSocket } from "../hooks/useWebSocket.js";
import { useRoomStore } from "../store/index.js";
import { isValidRoomKeyFormat, normalizeRoomKey } from "../lib/room-validation.js";

// Confetti and musical note decorations component
function BackgroundDecorations() {
  const confettiColors = [
    "bg-red-500",
    "bg-orange-500",
    "bg-yellow-500",
    "bg-green-500",
    "bg-blue-500",
    "bg-purple-500",
    "bg-pink-500",
  ];

  // Generate stable confetti positions using useMemo
  const confetti = useMemo(() => {
    return Array.from({ length: 30 }, (_, i) => {
      const seed = i * 0.1; // Use index-based seed for stability
      return {
        id: i,
        color: confettiColors[i % confettiColors.length],
        left: `${(Math.sin(seed) * 0.5 + 0.5) * 100}%`,
        top: `${(Math.cos(seed * 2) * 0.5 + 0.5) * 100}%`,
        delay: `${(seed % 3)}s`,
        duration: `${3 + (seed % 4)}s`,
        size: `${4 + (seed % 8)}px`,
      };
    });
  }, []);

  // Generate stable musical note positions
  const musicalNotes = useMemo(() => {
    return Array.from({ length: 8 }, (_, i) => {
      const seed = i * 0.3;
      return {
        id: i,
        left: `${10 + (Math.sin(seed) * 0.5 + 0.5) * 80}%`,
        top: `${10 + (Math.cos(seed * 1.5) * 0.5 + 0.5) * 80}%`,
        delay: `${(seed % 2)}s`,
        duration: `${4 + (seed % 3)}s`,
        symbol: i % 2 === 0 ? "♪" : "♫",
      };
    });
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Spotlight beams */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-0 left-1/4 w-1/3 h-full bg-gradient-to-b from-white/10 to-transparent transform -skew-x-12" />
        <div className="absolute top-0 left-1/2 w-1/4 h-full bg-gradient-to-b from-white/10 to-transparent transform -skew-x-12" />
        <div className="absolute top-0 right-1/4 w-1/3 h-full bg-gradient-to-b from-white/10 to-transparent transform skew-x-12" />
      </div>

      {/* Confetti */}
      {confetti.map((item) => (
        <div
          key={item.id}
          className={`absolute ${item.color} rounded-sm animate-float`}
          style={{
            left: item.left,
            top: item.top,
            width: item.size,
            height: item.size,
            animationDelay: item.delay,
            animationDuration: item.duration,
          }}
        />
      ))}

      {/* Musical notes */}
      {musicalNotes.map((note) => (
        <div
          key={`note-${note.id}`}
          className="absolute text-white/20 text-2xl animate-float"
          style={{
            left: note.left,
            top: note.top,
            animationDelay: note.delay,
            animationDuration: note.duration,
          }}
        >
          {note.symbol}
        </div>
      ))}
    </div>
  );
}

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
    <div className="min-h-screen relative bg-gradient-to-br from-purple-900 via-indigo-900 to-purple-950 overflow-hidden">
      <BackgroundDecorations />
      
      <Layout>
        <div className="relative z-10 max-w-md mx-auto">
          {/* Hero Section */}
          <div className="text-center mb-12 mt-8">
            <div className="flex justify-center mb-6">
              <Logo size="xl" />
            </div>
            <h1 className="text-5xl md:text-6xl text-bubbly-white mb-4">
              Hitster
            </h1>
            <p className="text-lg text-white/90 drop-shadow-md font-medium">
              Turn your phone into a music time machine
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 bg-red-500/20 backdrop-blur-sm border border-red-400/50 rounded-xl p-4 shadow-lg">
              <div className="flex items-center gap-2">
                <span className="text-red-300 text-xl">⚠️</span>
                <p className="text-sm text-red-100 flex-1">{error}</p>
                <button
                  onClick={() => setError(null)}
                  className="text-red-300 hover:text-red-100 text-lg font-bold"
                  aria-label="Dismiss error"
                >
                  ×
                </button>
              </div>
            </div>
          )}

          <div className="space-y-6">
            {/* Create Game Section */}
            <div className="relative group">
              {/* Glowing border */}
              <div className="absolute -inset-0.5 bg-gradient-to-r from-pink-500 via-purple-500 to-pink-500 rounded-2xl blur opacity-75 group-hover:opacity-100 transition-opacity duration-300" />
              
              <div className="relative bg-gray-900/90 backdrop-blur-sm rounded-2xl p-6 border border-gray-800 shadow-2xl">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-2xl font-bold text-white mb-2 font-display">Create Game</h3>
                    <p className="text-sm text-white/70">
                      Start a new game room and invite friends to join
                    </p>
                  </div>
                  <div className="text-4xl opacity-50">🎮</div>
                </div>
                <button
                  onClick={handleCreateRoom}
                  disabled={isCreating || !isConnected}
                  className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-semibold py-4 px-6 rounded-xl transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] shadow-lg disabled:shadow-none"
                >
                  {isCreating ? "Creating..." : isConnected ? "Create Game" : "Connecting..."}
                </button>
              </div>
            </div>

            {/* Join Game Section */}
            <div className="relative group">
              {/* Glowing border */}
              <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-500 via-blue-500 to-cyan-500 rounded-2xl blur opacity-75 group-hover:opacity-100 transition-opacity duration-300" />
              
              <div className="relative bg-gray-900/90 backdrop-blur-sm rounded-2xl p-6 border border-gray-800 shadow-2xl">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-2xl font-bold text-white mb-2 font-display">Join Game</h3>
                    <p className="text-sm text-white/70">
                      Enter a room key to join an existing game
                    </p>
                  </div>
                  <div className="text-4xl opacity-50">🔑</div>
                </div>
                <form onSubmit={handleJoinRoom}>
                  <div className="mb-4">
                    <input
                      type="text"
                      value={roomKey}
                      onChange={(e) => setRoomKey(normalizeRoomKey(e.target.value))}
                      placeholder="ENTER 6-DIGIT CODE"
                      maxLength={6}
                      className="w-full bg-gray-800/50 border-2 border-gray-700 text-white text-center text-2xl font-bold uppercase tracking-widest py-4 px-4 rounded-xl focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/50 transition-all placeholder:text-gray-600"
                      aria-label="Room key"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isJoining || roomKey.length !== 6}
                    className="w-full bg-cyan-500 hover:bg-cyan-600 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-semibold py-4 px-6 rounded-xl transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] shadow-lg disabled:shadow-none"
                  >
                    {isJoining ? "Joining..." : "Join Game"}
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </Layout>
    </div>
  );
}

