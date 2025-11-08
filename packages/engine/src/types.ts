/**
 * Game mode types
 */
export type GameMode = "original" | "pro" | "expert" | "coop";

/**
 * Game status types
 */
export type GameStatus = "lobby" | "playing" | "round_summary" | "finished";

/**
 * Card represents a song track
 */
export interface Card {
  trackUri: string;
  year?: number;
  revealed: boolean;
}

/**
 * Player in the game
 */
export interface Player {
  id: string;
  name: string;
  avatar: string;
  tokens: number;
  score: number;
}

/**
 * Timeline entry represents a card placed on a player's timeline
 */
export interface TimelineEntry {
  card: Card;
  playerId: string;
  slotIndex: number;
  year?: number;
  placementCorrect?: boolean;
}

/**
 * Round represents a single round of gameplay
 */
export interface Round {
  roundNumber: number;
  currentCard: Card;
  currentPlayerId?: string;
  placements: TimelineEntry[];
  revealed: boolean;
  actualYear?: number;
}

/**
 * Complete game state
 */
export interface GameState {
  mode: GameMode;
  status: GameStatus;
  players: Player[];
  currentRound: number;
  rounds: Round[];
  winner: string | null;
  startingTokens: number;
}

