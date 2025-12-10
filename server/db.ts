import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize database
const dbPath = path.join(__dirname, 'games.db');
const db = new Database(dbPath);

// Create tables if they don't exist
db.exec(`
  CREATE TABLE IF NOT EXISTS games (
    id TEXT PRIMARY KEY,
    created_at INTEGER NOT NULL,
    host_connected INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS players (
    id TEXT PRIMARY KEY,
    game_id TEXT NOT NULL,
    name TEXT NOT NULL,
    joined_at INTEGER NOT NULL,
    connected INTEGER NOT NULL DEFAULT 1,
    FOREIGN KEY (game_id) REFERENCES games(id)
  );

  CREATE TABLE IF NOT EXISTS playlists (
    game_id TEXT PRIMARY KEY,
    playlist_id TEXT NOT NULL,
    playlist_name TEXT NOT NULL,
    tracks TEXT NOT NULL,
    FOREIGN KEY (game_id) REFERENCES games(id)
  );

  CREATE TABLE IF NOT EXISTS game_state (
    game_id TEXT PRIMARY KEY,
    started INTEGER NOT NULL DEFAULT 0,
    current_mystery_track_id TEXT,
    mystery_track_playing INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (game_id) REFERENCES games(id)
  );

  CREATE TABLE IF NOT EXISTS player_timelines (
    id TEXT PRIMARY KEY,
    player_id TEXT NOT NULL,
    game_id TEXT NOT NULL,
    track_id TEXT NOT NULL,
    track_name TEXT NOT NULL,
    artist TEXT NOT NULL,
    year INTEGER,
    position INTEGER NOT NULL,
    is_mystery INTEGER NOT NULL DEFAULT 0,
    mystery_track_id TEXT,
    FOREIGN KEY (player_id) REFERENCES players(id),
    FOREIGN KEY (game_id) REFERENCES games(id)
  );

  CREATE TABLE IF NOT EXISTS used_tracks (
    game_id TEXT NOT NULL,
    track_id TEXT NOT NULL,
    used_for TEXT NOT NULL,
    player_id TEXT,
    PRIMARY KEY (game_id, track_id, used_for),
    FOREIGN KEY (game_id) REFERENCES games(id),
    FOREIGN KEY (player_id) REFERENCES players(id)
  );

  CREATE INDEX IF NOT EXISTS idx_players_game_id ON players(game_id);
  CREATE INDEX IF NOT EXISTS idx_timelines_player_id ON player_timelines(player_id);
  CREATE INDEX IF NOT EXISTS idx_timelines_game_id ON player_timelines(game_id);
  CREATE INDEX IF NOT EXISTS idx_used_tracks_game_id ON used_tracks(game_id);
`);

// Add new columns to player_timelines if they don't exist (migration)
try {
  db.exec(`
    ALTER TABLE player_timelines ADD COLUMN is_revealed INTEGER NOT NULL DEFAULT 0;
  `);
} catch (e: any) {
  // Column might already exist, ignore error
  if (!e.message.includes('duplicate column')) {
    console.warn('Migration warning:', e.message);
  }
}

try {
  db.exec(`
    ALTER TABLE player_timelines ADD COLUMN is_correct INTEGER;
  `);
} catch (e: any) {
  if (!e.message.includes('duplicate column')) {
    console.warn('Migration warning:', e.message);
  }
}

try {
  db.exec(`
    ALTER TABLE player_timelines ADD COLUMN album_image_url TEXT;
  `);
} catch (e: any) {
  if (!e.message.includes('duplicate column')) {
    console.warn('Migration warning:', e.message);
  }
}

export interface Game {
  id: string;
  created_at: number;
  host_connected: boolean;
}

export interface Player {
  id: string;
  game_id: string;
  name: string;
  joined_at: number;
  connected: boolean;
}

// Create a new game
export function createGame(gameId: string): void {
  const stmt = db.prepare('INSERT INTO games (id, created_at, host_connected) VALUES (?, ?, ?)');
  stmt.run(gameId, Date.now(), 1);
}

// Get game info
export function getGame(gameId: string): Game | undefined {
  const stmt = db.prepare('SELECT * FROM games WHERE id = ?');
  const row = stmt.get(gameId) as any;
  if (!row) return undefined;
  return {
    id: row.id,
    created_at: row.created_at,
    host_connected: row.host_connected === 1
  };
}

// Add a player to a game
export function addPlayer(gameId: string, playerId: string, name: string): void {
  const stmt = db.prepare('INSERT INTO players (id, game_id, name, joined_at, connected) VALUES (?, ?, ?, ?, ?)');
  stmt.run(playerId, gameId, name, Date.now(), 1);
}

// Get all players for a game
export function getPlayers(gameId: string): Player[] {
  const stmt = db.prepare('SELECT * FROM players WHERE game_id = ? ORDER BY joined_at');
  const rows = stmt.all(gameId) as any[];
  return rows.map(row => ({
    id: row.id,
    game_id: row.game_id,
    name: row.name,
    joined_at: row.joined_at,
    connected: row.connected === 1
  }));
}

// Update player connection status
export function updatePlayerConnection(playerId: string, connected: boolean): void {
  const stmt = db.prepare('UPDATE players SET connected = ? WHERE id = ?');
  stmt.run(connected ? 1 : 0, playerId);
}

// Update host connection status
export function updateHostConnection(gameId: string, connected: boolean): void {
  const stmt = db.prepare('UPDATE games SET host_connected = ? WHERE id = ?');
  stmt.run(connected ? 1 : 0, gameId);
}

// Get player by ID
export function getPlayer(playerId: string): Player | undefined {
  const stmt = db.prepare('SELECT * FROM players WHERE id = ?');
  const row = stmt.get(playerId) as any;
  if (!row) return undefined;
  return {
    id: row.id,
    game_id: row.game_id,
    name: row.name,
    joined_at: row.joined_at,
    connected: row.connected === 1
  };
}

// Playlist interfaces
export interface PlaylistTrack {
  id: string;
  name: string;
  artist: string;
  year: number | null;
  used: boolean;
}

export interface PlaylistData {
  id: string;
  name: string;
  tracks: PlaylistTrack[];
}

export interface GameState {
  game_id: string;
  started: boolean;
  current_mystery_track_id: string | null;
  mystery_track_playing: boolean;
}

export interface TimelineCard {
  id: string;
  player_id: string;
  game_id: string;
  track_id: string;
  track_name: string;
  artist: string;
  year: number | null;
  position: number;
  is_mystery: boolean;
  mystery_track_id: string | null;
  is_revealed: boolean;
  is_correct: boolean | null;
  album_image_url: string | null;
}

// Save playlist for a game
export function savePlaylist(gameId: string, playlistData: PlaylistData): void {
  const stmt = db.prepare('INSERT OR REPLACE INTO playlists (game_id, playlist_id, playlist_name, tracks) VALUES (?, ?, ?, ?)');
  stmt.run(gameId, playlistData.id, playlistData.name, JSON.stringify(playlistData.tracks));
}

// Get playlist for a game
export function getPlaylist(gameId: string): PlaylistData | undefined {
  const stmt = db.prepare('SELECT * FROM playlists WHERE game_id = ?');
  const row = stmt.get(gameId) as any;
  if (!row) return undefined;
  return {
    id: row.playlist_id,
    name: row.playlist_name,
    tracks: JSON.parse(row.tracks)
  };
}

// Initialize game state
export function initializeGameState(gameId: string): void {
  const stmt = db.prepare('INSERT OR IGNORE INTO game_state (game_id, started, mystery_track_playing) VALUES (?, 0, 0)');
  stmt.run(gameId);
}

// Start game
export function startGame(gameId: string, mysteryTrackId: string): void {
  const stmt = db.prepare('UPDATE game_state SET started = 1, current_mystery_track_id = ? WHERE game_id = ?');
  stmt.run(mysteryTrackId, gameId);
}

// Update mystery track
export function updateMysteryTrack(gameId: string, mysteryTrackId: string): void {
  const stmt = db.prepare('UPDATE game_state SET current_mystery_track_id = ?, mystery_track_playing = 0 WHERE game_id = ?');
  stmt.run(mysteryTrackId, gameId);
}

// Get game state
export function getGameState(gameId: string): GameState | undefined {
  const stmt = db.prepare('SELECT * FROM game_state WHERE game_id = ?');
  const row = stmt.get(gameId) as any;
  if (!row) return undefined;
  return {
    game_id: row.game_id,
    started: row.started === 1,
    current_mystery_track_id: row.current_mystery_track_id,
    mystery_track_playing: row.mystery_track_playing === 1
  };
}

// Deal card to player
export function dealCardToPlayer(playerId: string, gameId: string, track: PlaylistTrack, position: number): string {
  const timelineId = `${playerId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const stmt = db.prepare(`
    INSERT INTO player_timelines 
    (id, player_id, game_id, track_id, track_name, artist, year, position, is_mystery, mystery_track_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, NULL)
  `);
  stmt.run(
    timelineId,
    playerId,
    gameId,
    track.id,
    track.name,
    track.artist,
    track.year,
    position
  );
  return timelineId;
}

// Get player timeline
export function getPlayerTimeline(playerId: string): TimelineCard[] {
  const stmt = db.prepare('SELECT * FROM player_timelines WHERE player_id = ? ORDER BY position');
  const rows = stmt.all(playerId) as any[];
  return rows.map(row => ({
    id: row.id,
    player_id: row.player_id,
    game_id: row.game_id,
    track_id: row.track_id,
    track_name: row.track_name,
    artist: row.artist,
    year: row.year,
    position: row.position,
    is_mystery: row.is_mystery === 1,
    mystery_track_id: row.mystery_track_id,
    is_revealed: (row.is_revealed ?? 0) === 1,
    is_correct: row.is_correct === null ? null : row.is_correct === 1,
    album_image_url: row.album_image_url || null
  }));
}

// Update timeline position
export function updateTimelinePosition(timelineId: string, newPosition: number): void {
  const stmt = db.prepare('UPDATE player_timelines SET position = ? WHERE id = ?');
  stmt.run(newPosition, timelineId);
}

// Add mystery placeholder
export function addMysteryPlaceholder(playerId: string, gameId: string, mysteryTrackId: string, position: number): string {
  const timelineId = `${playerId}-mystery-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const stmt = db.prepare(`
    INSERT INTO player_timelines 
    (id, player_id, game_id, track_id, track_name, artist, year, position, is_mystery, mystery_track_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
  `);
  stmt.run(
    timelineId,
    playerId,
    gameId,
    '', // Empty track_id for mystery
    '?',
    '?',
    null,
    position,
    mysteryTrackId
  );
  return timelineId;
}

// Mark track as used
export function markTrackUsed(gameId: string, trackId: string, usedFor: 'dealt' | 'mystery', playerId?: string): void {
  const stmt = db.prepare('INSERT OR REPLACE INTO used_tracks (game_id, track_id, used_for, player_id) VALUES (?, ?, ?, ?)');
  stmt.run(gameId, trackId, usedFor, playerId || null);
}

// Get used tracks
export function getUsedTracks(gameId: string): Array<{ track_id: string; used_for: string; player_id: string | null }> {
  const stmt = db.prepare('SELECT track_id, used_for, player_id FROM used_tracks WHERE game_id = ?');
  const rows = stmt.all(gameId) as any[];
  return rows.map(row => ({
    track_id: row.track_id,
    used_for: row.used_for,
    player_id: row.player_id
  }));
}

// Get available tracks (unused tracks from playlist)
export function getAvailableTracks(gameId: string): PlaylistTrack[] {
  const playlist = getPlaylist(gameId);
  if (!playlist) return [];
  
  const usedTracks = new Set(getUsedTracks(gameId).map(u => u.track_id));
  return playlist.tracks.filter(track => !usedTracks.has(track.id));
}

// Update mystery track playing status
export function setMysteryTrackPlaying(gameId: string, playing: boolean): void {
  const stmt = db.prepare('UPDATE game_state SET mystery_track_playing = ? WHERE game_id = ?');
  stmt.run(playing ? 1 : 0, gameId);
}

// Update timeline card positions (for reordering)
export function updateTimelinePositions(playerId: string, updates: Array<{ id: string; position: number }>): void {
  const stmt = db.prepare('UPDATE player_timelines SET position = ? WHERE id = ?');
  const updateMany = db.transaction((updates: Array<{ id: string; position: number }>) => {
    for (const update of updates) {
      stmt.run(update.position, update.id);
    }
  });
  updateMany(updates);
}

// Check if mystery card placement is correct (chronological order)
export function checkMysteryCardCorrectness(playerId: string, mysteryCardId: string, mysteryYear: number | null): boolean {
  if (mysteryYear === null) return false; // Can't check correctness without year
  
  const timeline = getPlayerTimeline(playerId);
  const mysteryCard = timeline.find(card => card.id === mysteryCardId);
  if (!mysteryCard || !mysteryCard.is_mystery) return false;
  
  // Get all non-mystery cards sorted by position
  const regularCards = timeline
    .filter(card => !card.is_mystery && card.year !== null)
    .sort((a, b) => a.position - b.position);
  
  // First check: if mystery year matches any regular card year, it's correct
  const hasMatchingYear = regularCards.some(card => card.year === mysteryYear);
  if (hasMatchingYear) {
    return true;
  }
  
  // Get mystery card position
  const mysteryPosition = mysteryCard.position;
  
  // Find cards before and after mystery card
  const cardBefore = regularCards.filter(card => card.position < mysteryPosition).pop();
  const cardAfter = regularCards.find(card => card.position > mysteryPosition);
  
  // Check if mystery year is between the years of adjacent cards
  if (cardBefore && cardAfter) {
    // Mystery should be between cardBefore.year and cardAfter.year
    return mysteryYear > cardBefore.year! && mysteryYear < cardAfter.year!;
  } else if (cardBefore) {
    // Mystery is at the end, should be after cardBefore
    return mysteryYear > cardBefore.year!;
  } else if (cardAfter) {
    // Mystery is at the start, should be before cardAfter
    return mysteryYear < cardAfter.year!;
  } else {
    // Only mystery card, always correct
    return true;
  }
}

// Reveal mystery card and update correctness
export function revealMysteryCard(playerId: string, mysteryCardId: string, mysteryYear: number | null, albumImageUrl: string | null, trackId?: string, trackName?: string, artist?: string): boolean {
  const isCorrect = checkMysteryCardCorrectness(playerId, mysteryCardId, mysteryYear);
  
  // If correct, also update track information so it can be converted to regular card later
  if (isCorrect && trackId && trackName && artist) {
    const stmt = db.prepare(`
      UPDATE player_timelines 
      SET is_revealed = 1, is_correct = 1, album_image_url = ?, track_id = ?, track_name = ?, artist = ?, year = ?
      WHERE id = ? AND player_id = ?
    `);
    stmt.run(albumImageUrl, trackId, trackName, artist, mysteryYear, mysteryCardId, playerId);
  } else {
    const stmt = db.prepare(`
      UPDATE player_timelines 
      SET is_revealed = 1, is_correct = ?, album_image_url = ?
      WHERE id = ? AND player_id = ?
    `);
    stmt.run(isCorrect ? 1 : 0, albumImageUrl, mysteryCardId, playerId);
  }
  
  return isCorrect;
}

// Update album image URL for a card
export function updateCardAlbumImage(cardId: string, albumImageUrl: string): void {
  const stmt = db.prepare('UPDATE player_timelines SET album_image_url = ? WHERE id = ?');
  stmt.run(albumImageUrl, cardId);
}

// Get mystery card for a player by mystery_track_id
export function getMysteryCardByTrackId(playerId: string, mysteryTrackId: string): TimelineCard | undefined {
  const stmt = db.prepare('SELECT * FROM player_timelines WHERE player_id = ? AND mystery_track_id = ? AND is_mystery = 1');
  const row = stmt.get(playerId, mysteryTrackId) as any;
  if (!row) return undefined;
  
  return {
    id: row.id,
    player_id: row.player_id,
    game_id: row.game_id,
    track_id: row.track_id,
    track_name: row.track_name,
    artist: row.artist,
    year: row.year,
    position: row.position,
    is_mystery: row.is_mystery === 1,
    mystery_track_id: row.mystery_track_id,
    is_revealed: (row.is_revealed ?? 0) === 1,
    is_correct: row.is_correct === null ? null : row.is_correct === 1,
    album_image_url: row.album_image_url || null
  };
}

// Remove mystery card from player timeline
export function removeMysteryCard(playerId: string, mysteryCardId: string): void {
  const stmt = db.prepare('DELETE FROM player_timelines WHERE id = ? AND player_id = ? AND is_mystery = 1');
  stmt.run(mysteryCardId, playerId);
}

// Convert correct mystery card to regular card (keep it in timeline)
export function convertMysteryCardToRegular(playerId: string, mysteryCardId: string, trackId: string, trackName: string, artist: string, year: number | null, albumImageUrl: string | null): void {
  const stmt = db.prepare(`
    UPDATE player_timelines 
    SET track_id = ?, track_name = ?, artist = ?, year = ?, is_mystery = 0, mystery_track_id = NULL, album_image_url = ?
    WHERE id = ? AND player_id = ? AND is_mystery = 1
  `);
  stmt.run(trackId, trackName, artist, year, albumImageUrl, mysteryCardId, playerId);
}

// Close database connection (for cleanup)
export function closeDb(): void {
  db.close();
}

