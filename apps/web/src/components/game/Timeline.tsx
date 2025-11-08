import { useMemo } from "react";
import { motion } from "framer-motion";
import { Card } from "./Card.js";
import type { GameState } from "@hitster/engine";
import { getPlayerTimeline } from "@hitster/engine";

interface TimelineProps {
  gameState: GameState;
  playerId: string;
  myPlayerId: string;
  onPlaceCard?: (slotIndex: number) => void;
  currentRound?: number;
  disabled?: boolean;
}

export function Timeline({
  gameState,
  playerId,
  myPlayerId,
  onPlaceCard,
  currentRound,
  disabled,
}: TimelineProps) {
  const isMyTimeline = playerId === myPlayerId;
  const currentRoundData = currentRound !== undefined ? gameState.rounds[currentRound] : null;

  // Get player's timeline from revealed rounds
  const playerTimeline = useMemo(() => {
    return getPlayerTimeline(gameState, playerId);
  }, [gameState, playerId]);

  // Calculate the maximum slot index needed
  const maxSlotIndex = useMemo(() => {
    if (playerTimeline.length === 0) return 0;
    return Math.max(...playerTimeline.map((entry) => entry.slotIndex));
  }, [playerTimeline]);

  // Create slots array (0 to maxSlotIndex + 2 for placement zones)
  const slots = useMemo(() => {
    const slotCount = Math.max(maxSlotIndex + 1, isMyTimeline ? 3 : 1);
    return Array.from({ length: slotCount }, (_, i) => i);
  }, [maxSlotIndex, isMyTimeline]);

  // Check if there's a current card to place
  const hasCurrentCard = currentRoundData && !currentRoundData.revealed;
  const canPlace = isMyTimeline && hasCurrentCard && onPlaceCard && !disabled;

  const handlePlaceCard = (slotIndex: number) => {
    if (canPlace && onPlaceCard) {
      onPlaceCard(slotIndex);
    }
  };

  return (
    <div className="w-full">
      <div className="overflow-x-auto pb-4">
        <div className="flex gap-4 min-w-max px-4">
          {slots.map((slotIndex) => {
            const existingEntry = playerTimeline.find((entry) => entry.slotIndex === slotIndex);
            const isPlacementZone = canPlace && !existingEntry;

            return (
              <div key={slotIndex} className="flex flex-col items-center gap-2">
                {/* Year label (if revealed) */}
                {existingEntry?.year !== undefined && (
                  <span className="text-xs font-medium text-gray-600">
                    {existingEntry.year}
                  </span>
                )}

                {/* Card or placement zone */}
                {existingEntry ? (
                  <Card
                    card={existingEntry.card}
                    slotIndex={slotIndex}
                    isRevealed={existingEntry.card.revealed}
                    isCorrect={existingEntry.placementCorrect}
                    year={existingEntry.year}
                    disabled={disabled}
                  />
                ) : isPlacementZone ? (
                  <motion.div
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handlePlaceCard(slotIndex)}
                    className="w-24 h-32 rounded-lg border-2 border-dashed border-primary-300 bg-primary-50 flex items-center justify-center cursor-pointer hover:border-primary-400 hover:bg-primary-100 transition-colors"
                    role="button"
                    aria-label={`Place card at position ${slotIndex}`}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handlePlaceCard(slotIndex);
                      }
                    }}
                  >
                    <span className="text-primary-600 text-sm font-medium">Place</span>
                  </motion.div>
                ) : (
                  <div className="w-24 h-32 rounded-lg border-2 border-transparent" />
                )}

                {/* Slot index indicator */}
                {isMyTimeline && (
                  <span className="text-xs text-gray-400">{slotIndex}</span>
                )}
              </div>
            );
          })}

          {/* Add placement zone at the end if needed */}
          {canPlace && (
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => handlePlaceCard(maxSlotIndex + 1)}
              className="w-24 h-32 rounded-lg border-2 border-dashed border-primary-300 bg-primary-50 flex items-center justify-center cursor-pointer hover:border-primary-400 hover:bg-primary-100 transition-colors"
              role="button"
              aria-label={`Place card at end`}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handlePlaceCard(maxSlotIndex + 1);
                }
              }}
            >
              <span className="text-primary-600 text-sm font-medium">+</span>
            </motion.div>
          )}
        </div>
      </div>

      {/* Timeline direction indicator */}
      <div className="flex items-center justify-between px-4 mt-2 text-xs text-gray-500">
        <span>Earlier</span>
        <span>→</span>
        <span>Later</span>
      </div>
    </div>
  );
}

