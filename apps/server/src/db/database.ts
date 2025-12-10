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
      game_state TEXT
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

