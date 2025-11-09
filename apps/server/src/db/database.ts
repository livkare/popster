import Database from "better-sqlite3";
import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { logger } from "../logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Initialize the SQLite database and create schema if needed.
 */
export function initializeDatabase(): Database.Database {
  // Create data directory if it doesn't exist
  const dataDir = join(__dirname, "../../data");
  const dbPath = join(dataDir, "hitster.db");

  // Ensure data directory exists
  mkdir(dataDir, { recursive: true }).catch((error) => {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
      },
      "Failed to create data directory"
    );
  });

  // Open database
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL"); // Enable Write-Ahead Logging for better concurrency
  db.pragma("foreign_keys = ON"); // Enable foreign key constraints

  // Create schema
  createSchema(db);

  // Run migrations
  runMigrations(db);

  logger.info({ dbPath }, "Database initialized");

  return db;
}

/**
 * Create database schema.
 */
function createSchema(db: Database.Database): void {
  // Rooms table
  db.exec(`
    CREATE TABLE IF NOT EXISTS rooms (
      id TEXT PRIMARY KEY,
      room_key TEXT UNIQUE NOT NULL,
      game_mode TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      game_state TEXT,
      playlist_id TEXT,
      playlist_data TEXT
    )
  `);

  // Players table
  db.exec(`
    CREATE TABLE IF NOT EXISTS players (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      avatar TEXT NOT NULL,
      room_id TEXT NOT NULL,
      socket_id TEXT UNIQUE NOT NULL,
      created_at INTEGER NOT NULL,
      connected INTEGER NOT NULL DEFAULT 1,
      last_seen INTEGER NOT NULL,
      FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
    )
  `);

  // Create indexes for better query performance
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_rooms_room_key ON rooms(room_key);
    CREATE INDEX IF NOT EXISTS idx_players_room_id ON players(room_id);
    CREATE INDEX IF NOT EXISTS idx_players_socket_id ON players(socket_id);
  `);

  logger.debug("Database schema created");
}

/**
 * Run database migrations to add new columns to existing tables.
 */
function runMigrations(db: Database.Database): void {
  try {
    // Check if playlist_id column exists in rooms table
    const roomsTableInfo = db.prepare("PRAGMA table_info(rooms)").all() as Array<{
      cid: number;
      name: string;
      type: string;
      notnull: number;
      dflt_value: unknown;
      pk: number;
    }>;

    const hasPlaylistId = roomsTableInfo.some((col) => col.name === "playlist_id");
    const hasPlaylistData = roomsTableInfo.some((col) => col.name === "playlist_data");

    // Add playlist_id column if it doesn't exist
    if (!hasPlaylistId) {
      db.exec(`ALTER TABLE rooms ADD COLUMN playlist_id TEXT`);
      logger.info("Added playlist_id column to rooms table");
    }

    // Add playlist_data column if it doesn't exist
    if (!hasPlaylistData) {
      db.exec(`ALTER TABLE rooms ADD COLUMN playlist_data TEXT`);
      logger.info("Added playlist_data column to rooms table");
    }

    // Check if connected and last_seen columns exist in players table
    const playersTableInfo = db.prepare("PRAGMA table_info(players)").all() as Array<{
      cid: number;
      name: string;
      type: string;
      notnull: number;
      dflt_value: unknown;
      pk: number;
    }>;

    const hasConnected = playersTableInfo.some((col) => col.name === "connected");
    const hasLastSeen = playersTableInfo.some((col) => col.name === "last_seen");

    // Add connected column if it doesn't exist
    if (!hasConnected) {
      db.exec(`ALTER TABLE players ADD COLUMN connected INTEGER NOT NULL DEFAULT 1`);
      // Set all existing players as connected
      db.exec(`UPDATE players SET connected = 1 WHERE connected IS NULL`);
      logger.info("Added connected column to players table");
    }

    // Add last_seen column if it doesn't exist
    if (!hasLastSeen) {
      db.exec(`ALTER TABLE players ADD COLUMN last_seen INTEGER NOT NULL DEFAULT 0`);
      // Set last_seen to created_at for existing players
      db.exec(`UPDATE players SET last_seen = created_at WHERE last_seen IS NULL OR last_seen = 0`);
      logger.info("Added last_seen column to players table");
    }

    if (hasPlaylistId && hasPlaylistData && hasConnected && hasLastSeen) {
      logger.debug("Database migrations: all columns up to date");
    }
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
      },
      "Failed to run database migrations"
    );
    // Don't throw - allow the app to continue even if migrations fail
    // The CREATE TABLE IF NOT EXISTS will handle new databases
  }
}

