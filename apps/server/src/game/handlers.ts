import type { WebSocket } from "ws";
import {
  createMessage,
  type StartRound,
  type Place,
  type Challenge,
  type Reveal,
} from "@hitster/proto";
import { startRound, placeCard, challengePlacement, revealYear } from "@hitster/engine";
import { roomManager } from "../room/room-manager.js";
import { gameStateManager } from "./game-state-manager.js";
import { logger } from "../logger.js";
import type { RoomModel } from "../db/models.js";

/**
 * Room model (will be initialized by server).
 */
let roomModel: RoomModel | null = null;

/**
 * Initialize game handlers with database models.
 */
export function initializeGameHandlers(rm: RoomModel): void {
  roomModel = rm;
}

/**
 * Handle START_ROUND message.
 * Starts a new round with the specified track.
 */
export async function handleStartRound(
  connectionId: string,
  socket: WebSocket,
  payload: StartRound
): Promise<void> {
  try {
    const { trackUri } = payload;

    // Get room for connection
    const roomId = roomManager.getRoomForConnection(connectionId);
    if (!roomId) {
      roomManager.sendError(connectionId, "NOT_IN_ROOM", "You must be in a room to start a round");
      return;
    }

    // Get game state
    const gameState = gameStateManager.getGameState(roomId);
    if (!gameState) {
      roomManager.sendError(connectionId, "NO_GAME_STATE", "Game state not found");
      return;
    }

    // Validate game status
    if (gameState.status !== "lobby" && gameState.status !== "round_summary") {
      roomManager.sendError(
        connectionId,
        "INVALID_GAME_STATUS",
        `Cannot start round when game is in ${gameState.status} status`
      );
      return;
    }

    // Validate players exist
    if (gameState.players.length === 0) {
      roomManager.sendError(connectionId, "NO_PLAYERS", "Cannot start round with no players");
      return;
    }

    // Start round using engine
    const card = { trackUri, revealed: false };
    const updatedState = startRound(gameState, card);

    // Update game state
    gameStateManager.setGameState(roomId, updatedState);
    gameStateManager.persistGameState(roomId, updatedState);

    // Broadcast START_SONG to all room participants
    const startSongMessage = createMessage("START_SONG", {
      trackUri,
      positionMs: 0,
    });
    roomManager.broadcastToRoom(roomId, startSongMessage);

    // Get room key for ROOM_STATE message
    const room = roomModel?.getRoomById(roomId);
    const roomKey = room?.roomKey || "";

    // Broadcast updated ROOM_STATE
    const roomStateMessage = createMessage("ROOM_STATE", {
      roomKey,
      players: updatedState.players.map((p) => ({
        id: p.id,
        name: p.name,
        avatar: p.avatar,
      })),
      gameState: {
        status: updatedState.status,
        currentRound: updatedState.currentRound,
        currentTrack: updatedState.rounds[updatedState.currentRound]?.currentCard.trackUri,
      },
    });
    roomManager.broadcastToRoom(roomId, roomStateMessage);

    logger.info(
      {
        connectionId,
        roomId,
        trackUri,
        roundNumber: updatedState.rounds.length,
      },
      "Round started"
    );
  } catch (error) {
    logger.error(
      {
        connectionId,
        error: error instanceof Error ? error.message : String(error),
      },
      "Failed to start round"
    );
    roomManager.sendError(connectionId, "START_ROUND_FAILED", "Failed to start round");
  }
}

/**
 * Handle PLACE message.
 * Places a card on a player's timeline.
 */
export async function handlePlace(
  connectionId: string,
  socket: WebSocket,
  payload: Place
): Promise<void> {
  try {
    const { playerId, slotIndex } = payload;

    // Get room for connection
    const roomId = roomManager.getRoomForConnection(connectionId);
    if (!roomId) {
      roomManager.sendError(connectionId, "NOT_IN_ROOM", "You must be in a room to place a card");
      return;
    }

    // Get game state
    const gameState = gameStateManager.getGameState(roomId);
    if (!gameState) {
      roomManager.sendError(connectionId, "NO_GAME_STATE", "Game state not found");
      return;
    }

    // Validate player exists
    if (!gameState.players.some((p) => p.id === playerId)) {
      roomManager.sendError(connectionId, "PLAYER_NOT_FOUND", "Player not found in game");
      return;
    }

    // Place card using engine
    const updatedState = placeCard(gameState, playerId, slotIndex);

    // Update game state
    gameStateManager.setGameState(roomId, updatedState);
    gameStateManager.persistGameState(roomId, updatedState);

    // Get room key for ROOM_STATE message
    const room = roomModel?.getRoomById(roomId);
    const roomKey = room?.roomKey || "";

    // Broadcast updated ROOM_STATE
    const roomStateMessage = createMessage("ROOM_STATE", {
      roomKey,
      players: updatedState.players.map((p) => ({
        id: p.id,
        name: p.name,
        avatar: p.avatar,
      })),
      gameState: {
        status: updatedState.status,
        currentRound: updatedState.currentRound,
        currentTrack: updatedState.rounds[updatedState.currentRound]?.currentCard.trackUri,
      },
    });
    roomManager.broadcastToRoom(roomId, roomStateMessage);

    logger.info(
      {
        connectionId,
        roomId,
        playerId,
        slotIndex,
      },
      "Card placed"
    );
  } catch (error) {
    logger.error(
      {
        connectionId,
        error: error instanceof Error ? error.message : String(error),
      },
      "Failed to place card"
    );
    const errorMessage =
      error instanceof Error ? error.message : "Failed to place card";
    roomManager.sendError(connectionId, "PLACE_FAILED", errorMessage);
  }
}

/**
 * Handle CHALLENGE message.
 * Challenges another player's placement.
 */
export async function handleChallenge(
  connectionId: string,
  socket: WebSocket,
  payload: Challenge
): Promise<void> {
  try {
    const { playerId: challengerId, targetPlayerId, slotIndex } = payload;

    // Get room for connection
    const roomId = roomManager.getRoomForConnection(connectionId);
    if (!roomId) {
      roomManager.sendError(
        connectionId,
        "NOT_IN_ROOM",
        "You must be in a room to challenge a placement"
      );
      return;
    }

    // Get game state
    const gameState = gameStateManager.getGameState(roomId);
    if (!gameState) {
      roomManager.sendError(connectionId, "NO_GAME_STATE", "Game state not found");
      return;
    }

    // Validate challenger exists
    if (!gameState.players.some((p) => p.id === challengerId)) {
      roomManager.sendError(connectionId, "CHALLENGER_NOT_FOUND", "Challenger not found in game");
      return;
    }

    // Challenge placement using engine
    const updatedState = challengePlacement(gameState, challengerId, targetPlayerId, slotIndex);

    // Update game state
    gameStateManager.setGameState(roomId, updatedState);
    gameStateManager.persistGameState(roomId, updatedState);

    // Get room key for ROOM_STATE message
    const room = roomModel?.getRoomById(roomId);
    const roomKey = room?.roomKey || "";

    // Broadcast updated ROOM_STATE
    const roomStateMessage = createMessage("ROOM_STATE", {
      roomKey,
      players: updatedState.players.map((p) => ({
        id: p.id,
        name: p.name,
        avatar: p.avatar,
      })),
      gameState: {
        status: updatedState.status,
        currentRound: updatedState.currentRound,
        currentTrack: updatedState.rounds[updatedState.currentRound]?.currentCard.trackUri,
      },
    });
    roomManager.broadcastToRoom(roomId, roomStateMessage);

    logger.info(
      {
        connectionId,
        roomId,
        challengerId,
        targetPlayerId,
        slotIndex,
      },
      "Challenge placed"
    );
  } catch (error) {
    logger.error(
      {
        connectionId,
        error: error instanceof Error ? error.message : String(error),
      },
      "Failed to challenge placement"
    );
    const errorMessage =
      error instanceof Error ? error.message : "Failed to challenge placement";
    roomManager.sendError(connectionId, "CHALLENGE_FAILED", errorMessage);
  }
}

/**
 * Handle REVEAL message.
 * Reveals the actual year and resolves placements/challenges.
 */
export async function handleReveal(
  connectionId: string,
  socket: WebSocket,
  payload: Reveal
): Promise<void> {
  try {
    const { year } = payload;

    // Get room for connection
    const roomId = roomManager.getRoomForConnection(connectionId);
    if (!roomId) {
      roomManager.sendError(connectionId, "NOT_IN_ROOM", "You must be in a room to reveal year");
      return;
    }

    // Get game state
    const gameState = gameStateManager.getGameState(roomId);
    if (!gameState) {
      roomManager.sendError(connectionId, "NO_GAME_STATE", "Game state not found");
      return;
    }

    // Reveal year using engine (this also calculates scores)
    const updatedState = revealYear(gameState, year);

    // Update game state
    gameStateManager.setGameState(roomId, updatedState);
    gameStateManager.persistGameState(roomId, updatedState);

    // Build ROUND_SUMMARY message
    const currentRound = updatedState.rounds[updatedState.currentRound];
    if (!currentRound) {
      throw new Error("Current round not found after reveal");
    }

    // Build timeline from placements
    const timeline = currentRound.placements.map((placement) => ({
      year: placement.year || year,
      trackUri: placement.card.trackUri,
      playerId: placement.playerId,
    }));

    // Build scores object
    const scores: Record<string, number> = {};
    for (const player of updatedState.players) {
      scores[player.id] = player.score;
    }

    // Broadcast ROUND_SUMMARY
    const roundSummaryMessage = createMessage("ROUND_SUMMARY", {
      timeline,
      scores,
    });
    roomManager.broadcastToRoom(roomId, roundSummaryMessage);

    // Get room key for ROOM_STATE message
    const room = roomModel?.getRoomById(roomId);
    const roomKey = room?.roomKey || "";

    // Broadcast updated ROOM_STATE
    const roomStateMessage = createMessage("ROOM_STATE", {
      roomKey,
      players: updatedState.players.map((p) => ({
        id: p.id,
        name: p.name,
        avatar: p.avatar,
      })),
      gameState: {
        status: updatedState.status,
        currentRound: updatedState.currentRound,
        currentTrack: currentRound.currentCard.trackUri,
      },
    });
    roomManager.broadcastToRoom(roomId, roomStateMessage);

    // If game finished, log winner
    if (updatedState.status === "finished" && updatedState.winner) {
      const winner = updatedState.players.find((p) => p.id === updatedState.winner);
      logger.info(
        {
          connectionId,
          roomId,
          winnerId: updatedState.winner,
          winnerName: winner?.name,
        },
        "Game finished"
      );
    }

    logger.info(
      {
        connectionId,
        roomId,
        year,
        status: updatedState.status,
      },
      "Year revealed"
    );
  } catch (error) {
    logger.error(
      {
        connectionId,
        error: error instanceof Error ? error.message : String(error),
      },
      "Failed to reveal year"
    );
    const errorMessage =
      error instanceof Error ? error.message : "Failed to reveal year";
    roomManager.sendError(connectionId, "REVEAL_FAILED", errorMessage);
  }
}

