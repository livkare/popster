import type { GameMode, GameState, TimelineEntry } from "./types.js";
import { isCorrectPlacement } from "./timeline.js";

/**
 * Calculate score for a placement based on correctness and game mode
 */
export function calculatePlacementScore(correct: boolean, mode: GameMode): number {
  if (!correct) {
    return 0;
  }

  switch (mode) {
    case "original":
      return 1;
    case "pro":
      return 1; // Placeholder - will be enhanced when Pro mode is fully implemented
    case "expert":
      return 1; // Placeholder - partial credit logic will be added
    case "coop":
      return 1; // Placeholder - coop scoring will be different
    default:
      return 0;
  }
}

/**
 * Calculate score adjustment for a challenge outcome
 * Returns token adjustments for challenger and target
 */
export function calculateChallengeScore(challengerWon: boolean): {
  challengerTokens: number;
  targetTokens: number;
} {
  if (challengerWon) {
    return {
      challengerTokens: 1, // Challenger gains a token
      targetTokens: -1, // Target loses a token
    };
  } else {
    return {
      challengerTokens: -1, // Challenger loses a token
      targetTokens: 1, // Target gains a token
    };
  }
}

/**
 * Calculate round score for a specific player based on their placements
 */
export function calculateRoundScore(state: GameState, playerId: string): number {
  const currentRound = state.rounds[state.currentRound];
  if (!currentRound || !currentRound.revealed || !currentRound.actualYear) {
    return 0;
  }

  const playerPlacement = currentRound.placements.find((p) => p.playerId === playerId);
  if (!playerPlacement) {
    return 0;
  }

  // Get player's timeline from previous rounds (before this round)
  const previousRounds = state.rounds.slice(0, state.currentRound);
  const playerTimeline: TimelineEntry[] = [];
  for (const round of previousRounds) {
    if (round.revealed) {
      const playerPlacements = round.placements.filter((p) => p.playerId === playerId);
      playerTimeline.push(...playerPlacements);
    }
  }

  // Check if placement is correct relative to player's existing timeline
  const correct = isCorrectPlacement(
    playerTimeline,
    playerPlacement.slotIndex,
    currentRound.actualYear
  );

  return calculatePlacementScore(correct, state.mode);
}

/**
 * Update player scores based on round results
 */
export function updatePlayerScores(state: GameState): GameState {
  const updatedPlayers = state.players.map((player) => {
    const roundScore = calculateRoundScore(state, player.id);
    return {
      ...player,
      score: player.score + roundScore,
    };
  });

  return {
    ...state,
    players: updatedPlayers,
  };
}

