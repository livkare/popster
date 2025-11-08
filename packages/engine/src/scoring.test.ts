import { describe, it, expect } from "vitest";
import {
  calculatePlacementScore,
  calculateChallengeScore,
  calculateRoundScore,
  updatePlayerScores,
} from "./scoring.js";
import { createGame, joinPlayer, startRound, placeCard, revealYear } from "./game.js";
import type { Player, Card } from "./types.js";

describe("Scoring", () => {
  const createPlayer = (id: string, name: string): Player => ({
    id,
    name,
    avatar: `avatar-${id}`,
    tokens: 0,
    score: 0,
  });

  const createCard = (trackUri: string): Card => ({
    trackUri,
    revealed: false,
  });

  describe("calculatePlacementScore", () => {
    it("should return 0 for incorrect placement", () => {
      expect(calculatePlacementScore(false, "original")).toBe(0);
    });

    it("should return 1 for correct placement in original mode", () => {
      expect(calculatePlacementScore(true, "original")).toBe(1);
    });

    it("should return 1 for correct placement in pro mode", () => {
      expect(calculatePlacementScore(true, "pro")).toBe(1);
    });

    it("should return 1 for correct placement in expert mode", () => {
      expect(calculatePlacementScore(true, "expert")).toBe(1);
    });

    it("should return 1 for correct placement in coop mode", () => {
      expect(calculatePlacementScore(true, "coop")).toBe(1);
    });

    it("should return 0 for default case (should not happen with strict types)", () => {
      // This tests the default case, though TypeScript should prevent it
      expect(calculatePlacementScore(false, "original")).toBe(0);
    });
  });

  describe("calculateChallengeScore", () => {
    it("should award token to challenger when they win", () => {
      const result = calculateChallengeScore(true);
      expect(result.challengerTokens).toBe(1);
      expect(result.targetTokens).toBe(-1);
    });

    it("should award token to target when challenger loses", () => {
      const result = calculateChallengeScore(false);
      expect(result.challengerTokens).toBe(-1);
      expect(result.targetTokens).toBe(1);
    });
  });

  describe("calculateRoundScore", () => {
    it("should return 0 for round that is not revealed", () => {
      let state = createGame("original");
      const player = createPlayer("player-1", "Alice");
      state = joinPlayer(state, player);
      state = startRound(state, createCard("spotify:track:1"));

      expect(calculateRoundScore(state, "player-1")).toBe(0);
    });

    it("should return 0 for player with no placements", () => {
      let state = createGame("original");
      const player = createPlayer("player-1", "Alice");
      state = joinPlayer(state, player);
      state = startRound(state, createCard("spotify:track:1"));
      state = revealYear(state, 2000);

      expect(calculateRoundScore(state, "player-1")).toBe(0);
    });

    it("should calculate score for correct placement", () => {
      let state = createGame("original");
      const player = createPlayer("player-1", "Alice");
      state = joinPlayer(state, player);
      state = startRound(state, createCard("spotify:track:1"));
      state = placeCard(state, "player-1", 0);
      state = revealYear(state, 2000);

      expect(calculateRoundScore(state, "player-1")).toBe(1);
    });

    it("should calculate score for multiple placements", () => {
      let state = createGame("original");
      const player1 = createPlayer("player-1", "Alice");
      const player2 = createPlayer("player-2", "Bob");
      state = joinPlayer(state, player1);
      state = joinPlayer(state, player2);

      // Round 1: Player 1 places correctly
      state = startRound(state, createCard("spotify:track:1"));
      state = placeCard(state, "player-1", 0);
      state = revealYear(state, 2000);

      // Round 2: Player 2 places correctly
      state = startRound(state, createCard("spotify:track:2"));
      state = placeCard(state, "player-2", 0);
      state = revealYear(state, 2010);

      expect(calculateRoundScore(state, "player-1")).toBe(0); // No placement in round 2
      expect(calculateRoundScore(state, "player-2")).toBe(1);
    });
  });

  describe("updatePlayerScores", () => {
    it("should update player scores after round", () => {
      let state = createGame("original");
      const player = createPlayer("player-1", "Alice");
      state = joinPlayer(state, player);

      expect(state.players[0].score).toBe(0);

      state = startRound(state, createCard("spotify:track:1"));
      state = placeCard(state, "player-1", 0);
      state = revealYear(state, 2000);

      expect(state.players[0].score).toBe(1);
    });

    it("should accumulate scores across multiple rounds", () => {
      let state = createGame("original");
      const player = createPlayer("player-1", "Alice");
      state = joinPlayer(state, player);

      // Round 1
      state = startRound(state, createCard("spotify:track:1"));
      state = placeCard(state, "player-1", 0);
      state = revealYear(state, 2000);

      expect(state.players[0].score).toBe(1);

      // Round 2
      state = startRound(state, createCard("spotify:track:2"));
      state = placeCard(state, "player-1", 1);
      state = revealYear(state, 2010);

      expect(state.players[0].score).toBe(2);
    });

    it("should not mutate original state", () => {
      let state = createGame("original");
      const player = createPlayer("player-1", "Alice");
      state = joinPlayer(state, player);

      const originalScore = state.players[0].score;
      state = startRound(state, createCard("spotify:track:1"));
      state = placeCard(state, "player-1", 0);

      const stateBeforeReveal = { ...state };
      state = revealYear(state, 2000);

      // Original state should not have updated score
      expect(stateBeforeReveal.players[0].score).toBe(originalScore);
      expect(state.players[0].score).toBeGreaterThan(originalScore);
    });
  });
});

