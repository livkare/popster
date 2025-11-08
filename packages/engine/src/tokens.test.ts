import { describe, it, expect } from "vitest";
import { getTokenCount, spendToken, awardToken, hasTokens } from "./tokens.js";
import { createGame, joinPlayer } from "./game.js";
import type { Player } from "./types.js";

describe("Tokens", () => {
  const createPlayer = (id: string, name: string): Player => ({
    id,
    name,
    avatar: `avatar-${id}`,
    tokens: 0, // Will be set by joinPlayer
    score: 0,
  });

  describe("getTokenCount", () => {
    it("should return token count for a player", () => {
      let state = createGame("original");
      const player = createPlayer("player-1", "Alice");
      state = joinPlayer(state, player);

      expect(getTokenCount(state, "player-1")).toBe(3);
    });

    it("should throw error for non-existent player", () => {
      const state = createGame("original");

      expect(() => getTokenCount(state, "non-existent")).toThrow();
    });
  });

  describe("spendToken", () => {
    it("should spend a token from a player", () => {
      let state = createGame("original");
      const player = createPlayer("player-1", "Alice");
      state = joinPlayer(state, player);

      expect(getTokenCount(state, "player-1")).toBe(3);
      state = spendToken(state, "player-1", "challenge");
      expect(getTokenCount(state, "player-1")).toBe(2);
    });

    it("should spend token for skip action", () => {
      let state = createGame("original");
      const player = createPlayer("player-1", "Alice");
      state = joinPlayer(state, player);

      state = spendToken(state, "player-1", "skip");
      expect(getTokenCount(state, "player-1")).toBe(2);
    });

    it("should throw error when player has no tokens", () => {
      let state = createGame("original");
      const player = createPlayer("player-1", "Alice");
      state = joinPlayer(state, player);

      // Spend all tokens
      state = spendToken(state, "player-1", "challenge");
      state = spendToken(state, "player-1", "challenge");
      state = spendToken(state, "player-1", "challenge");

      expect(() => spendToken(state, "player-1", "challenge")).toThrow();
    });

    it("should not mutate original state", () => {
      let state = createGame("original");
      const player = createPlayer("player-1", "Alice");
      state = joinPlayer(state, player);

      const originalTokens = getTokenCount(state, "player-1");
      const newState = spendToken(state, "player-1", "challenge");

      expect(getTokenCount(state, "player-1")).toBe(originalTokens);
      expect(getTokenCount(newState, "player-1")).toBe(originalTokens - 1);
    });
  });

  describe("awardToken", () => {
    it("should award a token to a player", () => {
      let state = createGame("original");
      const player = createPlayer("player-1", "Alice");
      state = joinPlayer(state, player);

      expect(getTokenCount(state, "player-1")).toBe(3);
      state = awardToken(state, "player-1");
      expect(getTokenCount(state, "player-1")).toBe(4);
    });

    it("should not mutate original state", () => {
      let state = createGame("original");
      const player = createPlayer("player-1", "Alice");
      state = joinPlayer(state, player);

      const originalTokens = getTokenCount(state, "player-1");
      const newState = awardToken(state, "player-1");

      expect(getTokenCount(state, "player-1")).toBe(originalTokens);
      expect(getTokenCount(newState, "player-1")).toBe(originalTokens + 1);
    });

    it("should throw error for non-existent player", () => {
      const state = createGame("original");

      expect(() => awardToken(state, "non-existent")).toThrow();
    });
  });

  describe("hasTokens", () => {
    it("should return true when player has enough tokens", () => {
      let state = createGame("original");
      const player = createPlayer("player-1", "Alice");
      state = joinPlayer(state, player);

      expect(hasTokens(state, "player-1", 1)).toBe(true);
      expect(hasTokens(state, "player-1", 3)).toBe(true);
    });

    it("should return false when player has insufficient tokens", () => {
      let state = createGame("original");
      const player = createPlayer("player-1", "Alice");
      state = joinPlayer(state, player);

      expect(hasTokens(state, "player-1", 4)).toBe(false);
    });

    it("should return false for non-existent player", () => {
      const state = createGame("original");

      expect(hasTokens(state, "non-existent", 1)).toBe(false);
    });

    it("should default to requiring 1 token", () => {
      let state = createGame("original");
      const player = createPlayer("player-1", "Alice");
      state = joinPlayer(state, player);

      expect(hasTokens(state, "player-1")).toBe(true);
    });

    it("should throw error when spending token for non-existent player", () => {
      const state = createGame("original");
      expect(() => spendToken(state, "non-existent", "challenge")).toThrow("Player not found");
    });

    it("should throw error when awarding token for non-existent player", () => {
      const state = createGame("original");
      expect(() => awardToken(state, "non-existent")).toThrow("Player not found");
    });

    it("should handle different required token amounts", () => {
      let state = createGame("original");
      const player = createPlayer("player-1", "Alice");
      state = joinPlayer(state, player);

      expect(hasTokens(state, "player-1", 1)).toBe(true);
      expect(hasTokens(state, "player-1", 2)).toBe(true);
      expect(hasTokens(state, "player-1", 3)).toBe(true);
      expect(hasTokens(state, "player-1", 4)).toBe(false);
    });
  });
});

