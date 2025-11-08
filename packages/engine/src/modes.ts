import type { GameMode, GameState } from "./types.js";

/**
 * Get the starting number of tokens for a game mode
 */
export function getStartingTokens(mode: GameMode): number {
  switch (mode) {
    case "original":
      return 3;
    case "pro":
      return 3;
    case "expert":
      return 3;
    case "coop":
      return 5; // More tokens in coop mode
    default:
      return 3;
  }
}

/**
 * Get the win condition threshold for a game mode
 */
export function getWinThreshold(mode: GameMode): number {
  switch (mode) {
    case "original":
      return 10; // First to 10 correct cards
    case "pro":
      return 10; // Placeholder
    case "expert":
      return 10; // Placeholder
    case "coop":
      return 20; // Higher threshold for coop
    default:
      return 10;
  }
}

/**
 * Check if a game mode requires additional inputs (e.g., song name, artist)
 */
export function requiresAdditionalInput(mode: GameMode): boolean {
  switch (mode) {
    case "original":
      return false;
    case "pro":
      return true; // Requires song + artist
    case "expert":
      return true; // Requires song + artist + year guess
    case "coop":
      return false;
    default:
      return false;
  }
}

/**
 * Validate if a game action is allowed for the current game mode
 */
export function isActionAllowed(_state: GameState, _action: string): boolean {
  // All basic actions are allowed in all modes for now
  // Mode-specific restrictions will be added as modes are fully implemented
  return true;
}

