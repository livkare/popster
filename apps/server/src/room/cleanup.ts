import { RoomModel, PlayerModel } from "../db/models.js";
import { logger } from "../logger.js";

/**
 * Database models (will be initialized by server).
 */
let roomModel: RoomModel;
let playerModel: PlayerModel;

/**
 * Cleanup interval timer.
 */
let cleanupInterval: NodeJS.Timeout | null = null;

/**
 * Initialize cleanup service with database models.
 */
export function initializeCleanup(rm: RoomModel, pm: PlayerModel): void {
  roomModel = rm;
  playerModel = pm;
}

/**
 * Start periodic room cleanup task.
 */
export function startCleanup(): void {
  const timeoutMs = Number.parseInt(process.env.ROOM_CLEANUP_TIMEOUT_MS || "1800000", 10); // 30 minutes default
  const intervalMs = 5 * 60 * 1000; // Run every 5 minutes

  cleanupInterval = setInterval(() => {
    cleanupEmptyRooms(timeoutMs);
  }, intervalMs);

  logger.info(
    {
      timeoutMs,
      intervalMs,
    },
    "Room cleanup task started"
  );

  // Run cleanup immediately on startup
  cleanupEmptyRooms(timeoutMs);
}

/**
 * Stop room cleanup task.
 */
export function stopCleanup(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
    logger.info("Room cleanup task stopped");
  }
}

/**
 * Clean up empty rooms older than the timeout.
 */
function cleanupEmptyRooms(timeoutMs: number): void {
  try {
    const now = Date.now();
    const rooms = roomModel.getAllRooms();
    let cleanedCount = 0;

    for (const room of rooms) {
      // Check if room is empty
      if (!playerModel.hasPlayers(room.id)) {
        // Check if room is older than timeout
        const age = now - room.createdAt;
        if (age >= timeoutMs) {
          roomModel.deleteRoom(room.id);
          cleanedCount++;
          logger.debug(
            {
              roomId: room.id,
              roomKey: room.roomKey,
              age,
            },
            "Cleaned up empty room"
          );
        }
      }
    }

    if (cleanedCount > 0) {
      logger.info({ cleanedCount }, "Room cleanup completed");
    }
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
      },
      "Error during room cleanup"
    );
  }
}

