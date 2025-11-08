import type { Card, GameMode, GameState, Player, Round, TimelineEntry } from "./types.js";
import { insertCard, isCorrectPlacement, validatePlacement } from "./timeline.js";
import { spendToken, hasTokens } from "./tokens.js";
import { calculateRoundScore, updatePlayerScores } from "./scoring.js";
import { getStartingTokens, getWinThreshold } from "./modes.js";

/**
 * Create a new game with the specified mode
 */
export function createGame(mode: GameMode): GameState {
  return {
    mode,
    status: "lobby",
    players: [],
    currentRound: 0,
    rounds: [],
    winner: null,
    startingTokens: getStartingTokens(mode),
  };
}

/**
 * Add a player to the game
 */
export function joinPlayer(state: GameState, player: Player): GameState {
  // Check if player already exists
  if (state.players.some((p) => p.id === player.id)) {
    throw new Error(`Player ${player.id} already in game`);
  }

  // Check if game has already started
  if (state.status !== "lobby") {
    throw new Error("Cannot join game that has already started");
  }

  const newPlayer: Player = {
    ...player,
    tokens: state.startingTokens,
    score: 0,
  };

  return {
    ...state,
    players: [...state.players, newPlayer],
  };
}

/**
 * Remove a player from the game
 */
export function removePlayer(state: GameState, playerId: string): GameState {
  if (!state.players.some((p) => p.id === playerId)) {
    throw new Error(`Player ${playerId} not in game`);
  }

  return {
    ...state,
    players: state.players.filter((p) => p.id !== playerId),
  };
}

/**
 * Start a new round with a card
 */
export function startRound(state: GameState, card: Card, playerId?: string): GameState {
  if (state.status === "finished") {
    throw new Error("Cannot start round in finished game");
  }

  if (state.players.length === 0) {
    throw new Error("Cannot start round with no players");
  }

  // Select player if not specified (round-robin or random)
  let activePlayerId = playerId;
  if (!activePlayerId) {
    const lastRound = state.rounds[state.rounds.length - 1];
    if (lastRound?.currentPlayerId) {
      const lastPlayerIndex = state.players.findIndex((p) => p.id === lastRound.currentPlayerId);
      const nextPlayerIndex = (lastPlayerIndex + 1) % state.players.length;
      activePlayerId = state.players[nextPlayerIndex].id;
    } else {
      activePlayerId = state.players[0].id;
    }
  }

  const roundNumber = state.rounds.length + 1;
  const newRound: Round = {
    roundNumber,
    currentCard: { ...card, revealed: false },
    currentPlayerId: activePlayerId,
    placements: [],
    revealed: false,
  };

  return {
    ...state,
    status: "playing",
    currentRound: state.rounds.length, // Index into rounds array (0-based)
    rounds: [...state.rounds, newRound],
  };
}

/**
 * Place a card on a player's timeline
 */
export function placeCard(
  state: GameState,
  playerId: string,
  slotIndex: number
): GameState {
  const currentRound = state.rounds[state.currentRound];
  if (!currentRound) {
    throw new Error("No active round");
  }

  if (state.status !== "playing") {
    throw new Error("Game is not in playing status");
  }

  if (!state.players.some((p) => p.id === playerId)) {
    throw new Error(`Player ${playerId} not in game`);
  }

  // Get player's existing timeline from previous rounds (only revealed rounds)
  const playerTimeline = getAllPlayerPlacements(state, playerId);

  // Validate placement
  if (!validatePlacement(playerTimeline, slotIndex)) {
    throw new Error(`Invalid slot index: ${slotIndex}`);
  }

  // Check if player already placed a card this round
  const existingPlacement = currentRound.placements.find((p) => p.playerId === playerId);
  if (existingPlacement) {
    throw new Error(`Player ${playerId} already placed a card this round`);
  }

  // Insert card into timeline
  const newTimeline = insertCard(playerTimeline, currentRound.currentCard, slotIndex, playerId);

  // Find the newly inserted entry (it will have the current card)
  const newEntry = newTimeline.find(
    (entry) =>
      entry.card.trackUri === currentRound.currentCard.trackUri &&
      entry.playerId === playerId
  );
  if (!newEntry) {
    throw new Error("Failed to create placement entry");
  }

  // Update round with new placement
  const updatedRound: Round = {
    ...currentRound,
    placements: [...currentRound.placements, newEntry],
  };

  return {
    ...state,
    rounds: state.rounds.map((r, i) => (i === state.currentRound ? updatedRound : r)),
  };
}

/**
 * Challenge another player's placement
 */
export function challengePlacement(
  state: GameState,
  challengerId: string,
  targetId: string,
  slotIndex: number
): GameState {
  const currentRound = state.rounds[state.currentRound];
  if (!currentRound) {
    throw new Error("No active round");
  }

  if (state.status !== "playing") {
    throw new Error("Game is not in playing status");
  }

  if (challengerId === targetId) {
    throw new Error("Cannot challenge your own placement");
  }

  if (!state.players.some((p) => p.id === challengerId)) {
    throw new Error(`Challenger ${challengerId} not in game`);
  }

  if (!state.players.some((p) => p.id === targetId)) {
    throw new Error(`Target ${targetId} not in game`);
  }

  // Check if challenger has tokens
  if (!hasTokens(state, challengerId, 1)) {
    throw new Error(`Challenger ${challengerId} has no tokens`);
  }

  // Find the target placement
  const targetPlacement = currentRound.placements.find(
    (p) => p.playerId === targetId && p.slotIndex === slotIndex
  );
  if (!targetPlacement) {
    throw new Error(`No placement found for target ${targetId} at slot ${slotIndex}`);
  }

  // Spend token from challenger
  let updatedState = spendToken(state, challengerId, "challenge");

  // Note: The actual challenge resolution happens after the year is revealed
  // This function just records the challenge and spends the token
  // The challenge outcome will be determined in revealYear

  return updatedState;
}

/**
 * Reveal the actual year and resolve placements/challenges
 */
export function revealYear(state: GameState, year: number): GameState {
  const currentRound = state.rounds[state.currentRound];
  if (!currentRound) {
    throw new Error("No active round");
  }

  if (currentRound.revealed) {
    throw new Error("Year already revealed for this round");
  }

  // Update card with year
  const updatedCard: Card = {
    ...currentRound.currentCard,
    year,
    revealed: true,
  };

  // Update placements with correctness
  const updatedPlacements: TimelineEntry[] = currentRound.placements.map((placement) => {
    const correct = isCorrectPlacement(currentRound.placements, placement.slotIndex, year);
    return {
      ...placement,
      card: updatedCard,
      year,
      placementCorrect: correct,
    };
  });

  // Update round
  const updatedRound: Round = {
    ...currentRound,
    currentCard: updatedCard,
    placements: updatedPlacements,
    revealed: true,
    actualYear: year,
  };

  // Update scores
  let updatedState: GameState = {
    ...state,
    status: "round_summary",
    rounds: state.rounds.map((r, i) => (i === state.currentRound ? updatedRound : r)),
  };

  updatedState = updatePlayerScores(updatedState);

  // Check for winner
  const winner = checkWinCondition(updatedState);
  if (winner) {
    updatedState = {
      ...updatedState,
      status: "finished",
      winner,
    };
  }

  return updatedState;
}

/**
 * Calculate score for a player in the current round
 */
export function calculateRoundScoreForPlayer(state: GameState, playerId: string): number {
  return calculateRoundScore(state, playerId);
}

/**
 * Check if any player has met the win condition
 */
export function checkWinCondition(state: GameState): string | null {
  const threshold = getWinThreshold(state.mode);

  for (const player of state.players) {
    if (player.score >= threshold) {
      return player.id;
    }
  }

  return null;
}

/**
 * Get a player's complete timeline across all rounds
 */
export function getPlayerTimeline(state: GameState, playerId: string): TimelineEntry[] {
  return getAllPlayerPlacements(state, playerId);
}

/**
 * Get all placements for a player across all rounds
 */
function getAllPlayerPlacements(state: GameState, playerId: string): TimelineEntry[] {
  const allPlacements: TimelineEntry[] = [];

  for (const round of state.rounds) {
    if (round.revealed) {
      const playerPlacements = round.placements.filter((p) => p.playerId === playerId);
      allPlacements.push(...playerPlacements);
    }
  }

  // Sort by slot index
  return allPlacements.sort((a, b) => a.slotIndex - b.slotIndex);
}

