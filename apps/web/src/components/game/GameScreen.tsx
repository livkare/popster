import { useMemo } from "react";
import { Timeline } from "./Timeline.js";
import { TokenDisplay } from "./TokenDisplay.js";
import { CurrentSongInfo } from "./CurrentSongInfo.js";
import { ReactionPicker } from "./ReactionPicker.js";
import { RoundSummary } from "./RoundSummary.js";
import { useRoomStore, usePlayerStore } from "../../store/index.js";
import type { GameState } from "@hitster/engine";
import type { RoundSummary as RoundSummaryType } from "@hitster/proto";
import { createMessage } from "@hitster/proto";

interface GameScreenProps {
  gameState: GameState;
  roundSummary?: RoundSummaryType;
  onPlaceCard?: (slotIndex: number) => void;
  onChallenge?: (targetPlayerId: string, slotIndex: number) => void;
  onSkip?: () => void;
  onReveal?: () => void;
  onContinueRound?: () => void;
  sendMessage?: (message: ReturnType<typeof createMessage>) => void;
  disabled?: boolean;
}

export function GameScreen({
  gameState,
  roundSummary,
  onPlaceCard,
  onChallenge,
  onSkip,
  onReveal,
  onContinueRound,
  sendMessage,
  disabled,
}: GameScreenProps) {
  const { players, isHost } = useRoomStore();
  const { myPlayerId, myTokens } = usePlayerStore();

  const currentRound = gameState.rounds[gameState.currentRound];
  const currentTrack = currentRound?.currentCard.trackUri;

  // Get current player info
  const myPlayer = useMemo(() => {
    return gameState.players.find((p) => p.id === myPlayerId);
  }, [gameState.players, myPlayerId]);

  // Check if it's my turn to place
  const isMyTurn = currentRound?.currentPlayerId === myPlayerId;

  // Check if I can place (haven't placed yet this round)
  const canPlace = useMemo(() => {
    if (!currentRound || currentRound.revealed) return false;
    if (!myPlayerId) return false;
    const hasPlaced = currentRound.placements.some((p) => p.playerId === myPlayerId);
    return !hasPlaced;
  }, [currentRound, myPlayerId]);

  // Get other players' timelines for challenge
  const otherPlayers = useMemo(() => {
    return gameState.players.filter((p) => p.id !== myPlayerId);
  }, [gameState.players, myPlayerId]);

  const handlePlaceCard = (slotIndex: number) => {
    if (canPlace && onPlaceCard && myPlayerId) {
      if (sendMessage) {
        const message = createMessage("PLACE", {
          playerId: myPlayerId,
          slotIndex,
        });
        sendMessage(message);
      }
      onPlaceCard(slotIndex);
    }
  };

  const handleChallenge = (targetPlayerId: string, slotIndex: number) => {
    if (myTokens > 0 && onChallenge && myPlayerId) {
      if (sendMessage) {
        const message = createMessage("CHALLENGE", {
          playerId: myPlayerId,
          targetPlayerId,
          slotIndex,
        });
        sendMessage(message);
      }
      onChallenge(targetPlayerId, slotIndex);
    }
  };

  const handleSkip = () => {
    if (myTokens > 0 && onSkip) {
      // TODO: Implement skip logic (may need server support)
      onSkip();
    }
  };

  const handleReveal = () => {
    // Only host can reveal
    if (isHost && onReveal) {
      // TODO: Get year from Spotify API or server
      // For now, we'll need server to provide year
      onReveal();
    }
  };

  // Show round summary if available
  if (roundSummary && gameState.status === "round_summary") {
    return (
      <div className="space-y-6">
        <RoundSummary summary={roundSummary} onContinue={onContinueRound} />
      </div>
    );
  }

  // Show finished state
  if (gameState.status === "finished") {
    const winner = gameState.players.find((p) => p.id === gameState.winner);
    return (
      <div className="text-center space-y-6">
        <div className="card">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Game Over!</h2>
          {winner && (
            <div className="space-y-4">
              <div className="text-6xl mb-4">{winner.avatar}</div>
              <p className="text-xl font-semibold text-gray-900">
                {winner.name} wins!
              </p>
              <p className="text-lg text-gray-600">Final Score: {winner.score}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Show playing state
  return (
    <div className="space-y-6">
      {/* Current Song Info */}
      {currentTrack && (
        <CurrentSongInfo trackUri={currentTrack} />
      )}

      {/* My Timeline */}
      {myPlayerId && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Your Timeline</h3>
            <TokenDisplay tokens={myTokens} maxTokens={myPlayer?.tokens} />
          </div>
          <Timeline
            gameState={gameState}
            playerId={myPlayerId}
            myPlayerId={myPlayerId}
            onPlaceCard={handlePlaceCard}
            currentRound={gameState.currentRound}
            disabled={disabled || !canPlace}
          />
          {canPlace && (
            <p className="text-sm text-primary-600 mt-2 text-center">
              Place the card on your timeline
            </p>
          )}
        </div>
      )}

      {/* Other Players' Timelines */}
      {otherPlayers.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">Other Players</h3>
          {otherPlayers.map((player) => {
            const playerRound = currentRound?.placements.find(
              (p) => p.playerId === player.id
            );
            const canChallenge =
              playerRound &&
              myTokens > 0 &&
              !currentRound?.revealed &&
              !disabled;

            return (
              <div key={player.id} className="card">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{player.avatar}</span>
                    <span className="font-medium text-gray-900">{player.name}</span>
                  </div>
                  {canChallenge && (
                    <button
                      onClick={() =>
                        playerRound && handleChallenge(player.id, playerRound.slotIndex)
                      }
                      className="btn-secondary text-sm px-3 py-1"
                      disabled={disabled}
                    >
                      Challenge
                    </button>
                  )}
                </div>
                <Timeline
                  gameState={gameState}
                  playerId={player.id}
                  myPlayerId={myPlayerId || ""}
                  currentRound={gameState.currentRound}
                  disabled={disabled}
                />
              </div>
            );
          })}
        </div>
      )}

      {/* Actions */}
      <div className="card">
        <div className="flex flex-wrap gap-4 justify-center">
          {canPlace && (
            <button
              onClick={handleSkip}
              disabled={disabled || myTokens === 0}
              className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Skip (1 token)
            </button>
          )}
          {isHost && currentRound && !currentRound.revealed && (
            <button
              onClick={handleReveal}
              disabled={disabled}
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Reveal Year
            </button>
          )}
          <ReactionPicker disabled={disabled} />
        </div>
      </div>
    </div>
  );
}

