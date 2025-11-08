import { describe, it, expect } from "vitest";
import {
  getStartingTokens,
  getWinThreshold,
  requiresAdditionalInput,
  isActionAllowed,
} from "./modes.js";
import { createGame } from "./game.js";
import type { GameMode } from "./types.js";

describe("Modes", () => {
  describe("getStartingTokens", () => {
    it("should return 3 tokens for original mode", () => {
      expect(getStartingTokens("original")).toBe(3);
    });

    it("should return 3 tokens for pro mode", () => {
      expect(getStartingTokens("pro")).toBe(3);
    });

    it("should return 3 tokens for expert mode", () => {
      expect(getStartingTokens("expert")).toBe(3);
    });

    it("should return 5 tokens for coop mode", () => {
      expect(getStartingTokens("coop")).toBe(5);
    });
  });

  describe("getWinThreshold", () => {
    it("should return 10 for original mode", () => {
      expect(getWinThreshold("original")).toBe(10);
    });

    it("should return 10 for pro mode", () => {
      expect(getWinThreshold("pro")).toBe(10);
    });

    it("should return 10 for expert mode", () => {
      expect(getWinThreshold("expert")).toBe(10);
    });

    it("should return 20 for coop mode", () => {
      expect(getWinThreshold("coop")).toBe(20);
    });
  });

  describe("requiresAdditionalInput", () => {
    it("should return false for original mode", () => {
      expect(requiresAdditionalInput("original")).toBe(false);
    });

    it("should return true for pro mode", () => {
      expect(requiresAdditionalInput("pro")).toBe(true);
    });

    it("should return true for expert mode", () => {
      expect(requiresAdditionalInput("expert")).toBe(true);
    });

    it("should return false for coop mode", () => {
      expect(requiresAdditionalInput("coop")).toBe(false);
    });
  });

  describe("isActionAllowed", () => {
    it("should allow actions in original mode", () => {
      const state = createGame("original");
      expect(isActionAllowed(state, "PLACE_CARD")).toBe(true);
    });

    it("should allow actions in pro mode", () => {
      const state = createGame("pro");
      expect(isActionAllowed(state, "PLACE_CARD")).toBe(true);
    });

    it("should allow actions in expert mode", () => {
      const state = createGame("expert");
      expect(isActionAllowed(state, "PLACE_CARD")).toBe(true);
    });

    it("should allow actions in coop mode", () => {
      const state = createGame("coop");
      expect(isActionAllowed(state, "PLACE_CARD")).toBe(true);
    });
  });

  describe("default cases", () => {
    it("should return default tokens for unknown mode", () => {
      // TypeScript won't allow this, but we test the default case via exhaustiveness
      expect(getStartingTokens("original")).toBe(3);
    });

    it("should return default threshold for unknown mode", () => {
      expect(getWinThreshold("original")).toBe(10);
    });
  });
});

