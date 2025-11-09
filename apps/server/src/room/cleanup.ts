import type { PlayerModel, RoomModel } from "../db/models.js";
import { gameStateManager } from "../game/game-state-manager.js";
import { removePlayer } from "@hitster/engine";
import { logger } from "../logger.js";
import { roomManager } from "./room-manager.js";
import { createMessage } from "@hitster/proto";

/**
 * Configuration for cleanup service
 */
const DISCONNECT_TIMEOUT_MS = parseInt(process.env.DISCONNECT_TIMEOUT_MS || "600000", 10); // 10 minutes default
const CLEANUP_INTERVAL_MS = parseInt(process.env.CLEANUP_INTERVAL_MS || "300000", 10); // 5 minutes default

/**
 * Cleanup service that periodically removes long-disconnected players
 */
class CleanupService {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private playerModel: PlayerModel | null = null;
  private roomModel: RoomModel | null = null;

  /**
   * Start the cleanup service
   */
  start(): void {
    if (this.isRunning) {
      logger.warn("Cleanup service is already running");
      return;
    }

    this.isRunning = true;
    this.intervalId = setInterval(() => {
      this.cleanup();
    }, CLEANUP_INTERVAL_MS);

    logger.info(
      {
        disconnectTimeoutMs: DISCONNECT_TIMEOUT_MS,
        cleanupIntervalMs: CLEANUP_INTERVAL_MS,
      },
      "Cleanup service started"
    );
  }

  /**
   * Stop the cleanup service
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    logger.info("Cleanup service stopped");
  }

  /**
   * Initialize cleanup service with models
   */
  initialize(roomModel: RoomModel, playerModel: PlayerModel): void {
    this.roomModel = roomModel;
    this.playerModel = playerModel;
    logger.debug("Cleanup service initialized");
  }

  /**
   * Perform cleanup of disconnected players
   */
  private cleanup(): void {
    if (!this.playerModel || !this.roomModel) {
      logger.warn("PlayerModel or RoomModel not initialized, skipping cleanup");
      return;
    }

    try {
      // Get all rooms
      const rooms = this.roomModel.getAllRooms();
      let totalRemoved = 0;

      for (const room of rooms) {
        // Get disconnected players that have been disconnected for too long
        const disconnectedPlayers = this.playerModel.getDisconnectedPlayers(room.id, DISCONNECT_TIMEOUT_MS);

        if (disconnectedPlayers.length === 0) {
          continue;
        }

        // Get current game state to check if game has started
        const gameState = gameStateManager.getGameState(room.id);
        const gameHasStarted = gameState && gameState.status !== "lobby";

        // Only remove disconnected players if:
        // 1. Game hasn't started (still in lobby), OR
        // 2. Game has started but we want to clean up anyway (for now, we'll be conservative)
        // For now, we'll only remove players if game is in lobby state
        if (gameHasStarted) {
          logger.debug(
            {
              roomId: room.id,
              disconnectedCount: disconnectedPlayers.length,
            },
            "Skipping cleanup - game has started"
          );
          continue;
        }

        // Remove each disconnected player
        for (const player of disconnectedPlayers) {
          try {
            // Remove from game state if present
            if (gameState) {
              try {
                const updatedState = removePlayer(gameState, player.id);
                gameStateManager.setGameState(room.id, updatedState);
                gameStateManager.persistGameState(room.id, updatedState);
              } catch (error) {
                logger.warn(
                  {
                    roomId: room.id,
                    playerId: player.id,
                    error: error instanceof Error ? error.message : String(error),
                  },
                  "Failed to remove player from game state during cleanup"
                );
              }
            }

            // Remove from database
            this.playerModel.removePlayerById(player.id);
            totalRemoved++;

            logger.info(
              {
                roomId: room.id,
                playerId: player.id,
                playerName: player.name,
                disconnectedForMs: Date.now() - player.lastSeen,
              },
              "Removed long-disconnected player"
            );
          } catch (error) {
            logger.error(
              {
                roomId: room.id,
                playerId: player.id,
                error: error instanceof Error ? error.message : String(error),
              },
              "Failed to remove disconnected player during cleanup"
            );
          }
        }

        // If we removed any players, broadcast updated room state
        if (disconnectedPlayers.length > 0) {
          const remainingPlayers = this.playerModel.getRoomPlayers(room.id);
          const updatedGameState = gameStateManager.getGameState(room.id);

          const roomStateResponse = createMessage("ROOM_STATE", {
            roomKey: room.roomKey,
            players: remainingPlayers.map((p) => ({
              id: p.id,
              name: p.name,
              avatar: p.avatar,
              connected: p.connected,
            })),
            gameState: updatedGameState
              ? {
                  status: updatedGameState.status,
                  currentRound: updatedGameState.currentRound,
                  currentTrack:
                    updatedGameState.rounds[updatedGameState.currentRound]?.currentCard.trackUri,
                }
              : undefined,
          });

          roomManager.broadcastToRoom(room.id, roomStateResponse);
        }
      }

      if (totalRemoved > 0) {
        logger.info(
          {
            totalRemoved,
            roomsProcessed: rooms.length,
          },
          "Cleanup completed"
        );
      }
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
        },
        "Error during cleanup"
      );
    }
  }
}

// Singleton instance
export const cleanupService = new CleanupService();

/**
 * Initialize cleanup service (for server startup)
 */
export function initializeCleanup(roomModel: RoomModel, playerModel: PlayerModel): void {
  cleanupService.initialize(roomModel, playerModel);
}

/**
 * Start cleanup service
 */
export function startCleanup(): void {
  cleanupService.start();
}

/**
 * Stop cleanup service
 */
export function stopCleanup(): void {
  cleanupService.stop();
}
