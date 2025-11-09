import { useMemo, useEffect, useRef } from "react";
import { useRoomStore } from "../../store/index.js";
import { useSpotifyPlayer } from "../../hooks/useSpotifyPlayer.js";
import { RoundSummary } from "./RoundSummary.js";
import { createMessage } from "@hitster/proto";
import type { GameState } from "@hitster/engine";

interface HostGameViewProps {
  gameState: GameState;
  sendMessage: (message: ReturnType<typeof createMessage>) => void;
  onReveal?: () => void;
  onContinueRound?: () => void;
}

export function HostGameView({
  gameState,
  sendMessage,
  onReveal,
  onContinueRound,
}: HostGameViewProps) {
  const { playlistTracks, roundSummary } = useRoomStore();
  const { isPlaying, play, pause } = useSpotifyPlayer();
  const previousPlacementsCountRef = useRef<number>(0);

  const currentRound = gameState.rounds[gameState.currentRound];
  const currentTrackUri = currentRound?.currentCard.trackUri;

  // Find current track in playlist
  const currentTrack = useMemo(() => {
    if (!currentTrackUri || !playlistTracks.length) {
      return null;
    }
    return playlistTracks.find((t) => t.trackUri === currentTrackUri);
  }, [currentTrackUri, playlistTracks]);

  // Reset placement count when round changes
  useEffect(() => {
    if (currentRound) {
      previousPlacementsCountRef.current = currentRound.placements.length;
    }
  }, [gameState.currentRound]);

  // Auto-pause when any player places a card
  useEffect(() => {
    if (!currentRound) return;

    const currentPlacementsCount = currentRound.placements.length;
    const previousPlacementsCount = previousPlacementsCountRef.current;

    // If a new placement was added and we're playing, pause
    if (
      currentPlacementsCount > previousPlacementsCount &&
      isPlaying &&
      !currentRound.revealed
    ) {
      console.log("[HostGameView] Player placed card, auto-pausing playback");
      pause();
    }

    previousPlacementsCountRef.current = currentPlacementsCount;
  }, [currentRound?.placements.length, isPlaying, pause]);

  const handleNextCard = () => {
    const message = createMessage("START_ROUND", {});
    sendMessage(message);
  };

  const handlePlayPause = async () => {
    if (!currentTrackUri) return;

    try {
      if (isPlaying) {
        await pause();
        // State will be updated by useSpotifyPlayer
      } else {
        // Play/resume - if same track, will resume from saved position
        // If different track or first time, will start from beginning
        await play(currentTrackUri);
        // State will be updated by useSpotifyPlayer (optimistic update + verification)
      }
    } catch (err) {
      console.error("[HostGameView] Error in play/pause:", err);
      // Error is already set by useSpotifyPlayer
    }
  };

  const handleReveal = () => {
    if (onReveal) {
      onReveal();
    }
  };

  // Show round summary if available
  if (roundSummary && gameState.status === "round_summary") {
    return <RoundSummary summary={roundSummary} onContinue={onContinueRound} />;
  }

  return (
    <div className="space-y-6">
      {/* Current Track Controls */}
      {currentTrack && (
        <div className="card">
          <div className="flex items-center gap-4 mb-4">
            {currentTrack.albumArt ? (
              <img
                src={currentTrack.albumArt}
                alt={currentTrack.name}
                className="w-20 h-20 rounded-lg object-cover"
              />
            ) : (
              <div className="w-20 h-20 rounded-lg bg-primary-200 flex items-center justify-center">
                <span className="text-3xl">🎵</span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-semibold text-gray-900 truncate">
                {currentTrack.name}
              </h3>
              <p className="text-sm text-gray-600 truncate">{currentTrack.artist}</p>
              {currentTrack.releaseYear && (
                <p className="text-xs text-gray-500">{currentTrack.releaseYear}</p>
              )}
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handlePlayPause}
              disabled={!currentTrackUri}
              className="flex-1 btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPlaying ? (
                <>
                  <span className="mr-2">⏸️</span>
                  Pause
                </>
              ) : (
                <>
                  <span className="mr-2">▶️</span>
                  Play
                </>
              )}
            </button>
            <button
              onClick={handleNextCard}
              disabled={currentRound?.revealed}
              className="flex-1 btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next Card
            </button>
            {currentRound && !currentRound.revealed && (
              <button onClick={handleReveal} className="btn-primary">
                Reveal Year
              </button>
            )}
          </div>
        </div>
      )}

      {/* Playlist Display */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Playlist ({playlistTracks.length} tracks)
        </h3>
        <div className="max-h-96 overflow-y-auto space-y-2">
          {playlistTracks.map((track, index) => {
            const isCurrentTrack = track.trackUri === currentTrackUri;
            const isPlayed = gameState.rounds.some((round) =>
              round.currentCard.trackUri === track.trackUri
            );

            return (
              <div
                key={track.trackUri}
                className={`flex items-center gap-3 p-3 rounded-lg border ${
                  isCurrentTrack
                    ? "bg-primary-50 border-primary-300"
                    : isPlayed
                      ? "bg-gray-50 border-gray-200 opacity-60"
                      : "bg-white border-gray-200"
                }`}
              >
                <div className="flex-shrink-0 w-8 text-center">
                  {isCurrentTrack && isPlaying ? (
                    <span className="text-primary-600 animate-pulse">▶</span>
                  ) : isCurrentTrack ? (
                    <span className="text-primary-600">●</span>
                  ) : isPlayed ? (
                    <span className="text-gray-400">✓</span>
                  ) : (
                    <span className="text-gray-400">{index + 1}</span>
                  )}
                </div>
                {track.albumArt ? (
                  <img
                    src={track.albumArt}
                    alt={track.name}
                    className="w-12 h-12 rounded object-cover flex-shrink-0"
                  />
                ) : (
                  <div className="w-12 h-12 rounded bg-gray-200 flex items-center justify-center flex-shrink-0">
                    <span className="text-lg">🎵</span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p
                    className={`font-medium truncate ${
                      isCurrentTrack ? "text-primary-900" : "text-gray-900"
                    }`}
                  >
                    {track.name}
                  </p>
                  <p className="text-sm text-gray-600 truncate">{track.artist}</p>
                  {track.releaseYear && (
                    <p className="text-xs text-gray-500">{track.releaseYear}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Game Info */}
      <div className="card">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-600">Round:</span>{" "}
            <span className="font-semibold">{gameState.currentRound + 1}</span>
          </div>
          <div>
            <span className="text-gray-600">Players:</span>{" "}
            <span className="font-semibold">{gameState.players.length}</span>
          </div>
          {currentRound && (
            <>
              <div>
                <span className="text-gray-600">Placements:</span>{" "}
                <span className="font-semibold">
                  {currentRound.placements.length} / {gameState.players.length}
                </span>
              </div>
              <div>
                <span className="text-gray-600">Status:</span>{" "}
                <span className="font-semibold">
                  {currentRound.revealed ? "Revealed" : "Playing"}
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

