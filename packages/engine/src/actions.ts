import type { Card, Player } from "./types.js";

/**
 * Action to join a player to the game
 */
export interface JoinPlayerAction {
  type: "JOIN_PLAYER";
  player: Player;
}

/**
 * Action to start a new round
 */
export interface StartRoundAction {
  type: "START_ROUND";
  card: Card;
  playerId?: string;
}

/**
 * Action to place a card on a timeline
 */
export interface PlaceCardAction {
  type: "PLACE_CARD";
  playerId: string;
  slotIndex: number;
}

/**
 * Action to challenge another player's placement
 */
export interface ChallengeAction {
  type: "CHALLENGE";
  challengerId: string;
  targetId: string;
  slotIndex: number;
}

/**
 * Action to reveal the actual year of a card
 */
export interface RevealYearAction {
  type: "REVEAL_YEAR";
  year: number;
}

/**
 * Union type of all game actions
 */
export type GameAction =
  | JoinPlayerAction
  | StartRoundAction
  | PlaceCardAction
  | ChallengeAction
  | RevealYearAction;

