import type { GameState } from "./types.js";

/**
 * Get the current token count for a player
 */
export function getTokenCount(state: GameState, playerId: string): number {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) {
    throw new Error(`Player not found: ${playerId}`);
  }
  return player.tokens;
}

/**
 * Spend a token from a player (immutable)
 */
export function spendToken(
  state: GameState,
  playerId: string,
  _action: "challenge" | "skip"
): GameState {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) {
    throw new Error(`Player not found: ${playerId}`);
  }

  if (player.tokens <= 0) {
    throw new Error(`Player ${playerId} has no tokens to spend`);
  }

  return {
    ...state,
    players: state.players.map((p) =>
      p.id === playerId ? { ...p, tokens: p.tokens - 1 } : p
    ),
  };
}

/**
 * Award a token to a player (immutable)
 */
export function awardToken(state: GameState, playerId: string): GameState {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) {
    throw new Error(`Player not found: ${playerId}`);
  }

  return {
    ...state,
    players: state.players.map((p) =>
      p.id === playerId ? { ...p, tokens: p.tokens + 1 } : p
    ),
  };
}

/**
 * Check if a player has enough tokens to perform an action
 */
export function hasTokens(state: GameState, playerId: string, required: number = 1): boolean {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) {
    return false;
  }
  return player.tokens >= required;
}

