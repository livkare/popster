// Client-side game state management using localStorage and in-memory storage
// Replaces server/db.ts for frontend-only architecture

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

export interface PlaylistTrack {
  id: string;
  name: string;
  artist: string;
  year: number | null;
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

// In-memory storage for current game (host device)
class GameStateManager {
  private currentGame: Game | null = null;
  private players: Map<string, Player> = new Map();
  private gameState: GameState | null = null;
  private playerTimelines: Map<string, TimelineCard[]> = new Map(); // playerId -> cards
  private usedTracks: Map<string, Set<string>> = new Map(); // gameId -> Set<trackId>

  // Create a new game
  createGame(gameId: string): void {
    this.currentGame = {
      id: gameId,
      created_at: Date.now(),
      host_connected: true
    };
    this.players.clear();
    this.gameState = null;
    this.playerTimelines.clear();
    this.usedTracks.set(gameId, new Set());
  }

  // Add a player to a game
  addPlayer(gameId: string, playerId: string, name: string): void {
    this.players.set(playerId, {
      id: playerId,
      game_id: gameId,
      name,
      joined_at: Date.now(),
      connected: true
    });
    this.playerTimelines.set(playerId, []);
  }

  // Get all players for a game
  getPlayers(gameId: string): Player[] {
    return Array.from(this.players.values())
      .filter(p => p.game_id === gameId)
      .sort((a, b) => a.joined_at - b.joined_at);
  }

  // Update player connection status
  updatePlayerConnection(playerId: string, connected: boolean): void {
    const player = this.players.get(playerId);
    if (player) {
      player.connected = connected;
    }
  }

  // Get player by ID
  getPlayer(playerId: string): Player | undefined {
    return this.players.get(playerId);
  }

  // Save playlist for a game
  savePlaylist(gameId: string, playlistData: PlaylistData): void {
    const key = `game_playlist_${gameId}`;
    localStorage.setItem(key, JSON.stringify(playlistData));
  }

  // Get playlist for a game
  getPlaylist(gameId: string): PlaylistData | undefined {
    const key = `game_playlist_${gameId}`;
    const stored = localStorage.getItem(key);
    if (!stored) return undefined;
    try {
      return JSON.parse(stored);
    } catch {
      return undefined;
    }
  }

  // Initialize game state
  initializeGameState(gameId: string): void {
    this.gameState = {
      game_id: gameId,
      started: false,
      current_mystery_track_id: null,
      mystery_track_playing: false
    };
  }

  // Start game
  startGame(gameId: string, mysteryTrackId: string): void {
    if (this.gameState && this.gameState.game_id === gameId) {
      this.gameState.started = true;
      this.gameState.current_mystery_track_id = mysteryTrackId;
    }
  }

  // Update mystery track
  updateMysteryTrack(gameId: string, mysteryTrackId: string): void {
    if (this.gameState && this.gameState.game_id === gameId) {
      this.gameState.current_mystery_track_id = mysteryTrackId;
      this.gameState.mystery_track_playing = false;
    }
  }

  // Get game state
  getGameState(gameId: string): GameState | undefined {
    return this.gameState?.game_id === gameId ? this.gameState : undefined;
  }

  // Deal card to player
  dealCardToPlayer(playerId: string, gameId: string, track: PlaylistTrack, position: number): string {
    const timelineId = `${playerId}-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    const card: TimelineCard = {
      id: timelineId,
      player_id: playerId,
      game_id: gameId,
      track_id: track.id,
      track_name: track.name,
      artist: track.artist,
      year: track.year,
      position,
      is_mystery: false,
      mystery_track_id: null,
      is_revealed: false,
      is_correct: null,
      album_image_url: null
    };

    const timeline = this.playerTimelines.get(playerId) || [];
    timeline.push(card);
    this.playerTimelines.set(playerId, timeline);

    return timelineId;
  }

  // Get player timeline
  getPlayerTimeline(playerId: string): TimelineCard[] {
    const timeline = this.playerTimelines.get(playerId) || [];
    return timeline.sort((a, b) => a.position - b.position);
  }

  // Add mystery placeholder
  addMysteryPlaceholder(playerId: string, gameId: string, mysteryTrackId: string, position: number): string {
    const timelineId = `${playerId}-mystery-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    const card: TimelineCard = {
      id: timelineId,
      player_id: playerId,
      game_id: gameId,
      track_id: '',
      track_name: '?',
      artist: '?',
      year: null,
      position,
      is_mystery: true,
      mystery_track_id: mysteryTrackId,
      is_revealed: false,
      is_correct: null,
      album_image_url: null
    };

    const timeline = this.playerTimelines.get(playerId) || [];
    timeline.push(card);
    this.playerTimelines.set(playerId, timeline);

    return timelineId;
  }

  // Mark track as used
  markTrackUsed(gameId: string, trackId: string, usedFor: 'dealt' | 'mystery'): void {
    const used = this.usedTracks.get(gameId) || new Set();
    used.add(trackId);
    this.usedTracks.set(gameId, used);
  }

  // Get available tracks (unused tracks from playlist)
  getAvailableTracks(gameId: string): PlaylistTrack[] {
    const playlist = this.getPlaylist(gameId);
    if (!playlist) return [];

    const used = this.usedTracks.get(gameId) || new Set();
    return playlist.tracks.filter(track => !used.has(track.id));
  }

  // Update mystery track playing status
  setMysteryTrackPlaying(gameId: string, playing: boolean): void {
    if (this.gameState && this.gameState.game_id === gameId) {
      this.gameState.mystery_track_playing = playing;
    }
  }

  // Update timeline card positions (for reordering)
  updateTimelinePositions(playerId: string, updates: Array<{ id: string; position: number }>): void {
    const timeline = this.playerTimelines.get(playerId);
    if (!timeline) return;

    for (const update of updates) {
      const card = timeline.find(c => c.id === update.id);
      if (card) {
        card.position = update.position;
      }
    }
  }

  // Check if mystery card placement is correct (chronological order)
  checkMysteryCardCorrectness(playerId: string, mysteryCardId: string, mysteryYear: number | null): boolean {
    if (mysteryYear === null) return false;

    const timeline = this.getPlayerTimeline(playerId);
    const mysteryCard = timeline.find(card => card.id === mysteryCardId);
    if (!mysteryCard || !mysteryCard.is_mystery) return false;

    const regularCards = timeline
      .filter(card => !card.is_mystery && card.year !== null)
      .sort((a, b) => a.position - b.position);

    const hasMatchingYear = regularCards.some(card => card.year === mysteryYear);
    if (hasMatchingYear) return true;

    const mysteryPosition = mysteryCard.position;
    const cardBefore = regularCards.filter(card => card.position < mysteryPosition).pop();
    const cardAfter = regularCards.find(card => card.position > mysteryPosition);

    if (cardBefore && cardAfter) {
      return mysteryYear > cardBefore.year! && mysteryYear < cardAfter.year!;
    } else if (cardBefore) {
      return mysteryYear > cardBefore.year!;
    } else if (cardAfter) {
      return mysteryYear < cardAfter.year!;
    } else {
      return true;
    }
  }

  // Reveal mystery card and update correctness
  revealMysteryCard(playerId: string, mysteryCardId: string, mysteryYear: number | null, albumImageUrl: string | null, trackId?: string, trackName?: string, artist?: string): boolean {
    const isCorrect = this.checkMysteryCardCorrectness(playerId, mysteryCardId, mysteryYear);
    const timeline = this.playerTimelines.get(playerId);
    if (!timeline) return false;

    const card = timeline.find(c => c.id === mysteryCardId);
    if (!card) return false;

    card.is_revealed = true;
    card.is_correct = isCorrect;
    card.album_image_url = albumImageUrl;

    if (isCorrect && trackId && trackName && artist) {
      card.track_id = trackId;
      card.track_name = trackName;
      card.artist = artist;
      card.year = mysteryYear;
    }

    return isCorrect;
  }

  // Get mystery card for a player by mystery_track_id
  getMysteryCardByTrackId(playerId: string, mysteryTrackId: string): TimelineCard | undefined {
    const timeline = this.playerTimelines.get(playerId);
    if (!timeline) return undefined;

    return timeline.find(card => card.is_mystery && card.mystery_track_id === mysteryTrackId);
  }

  // Remove mystery card from player timeline
  removeMysteryCard(playerId: string, mysteryCardId: string): void {
    const timeline = this.playerTimelines.get(playerId);
    if (!timeline) return;

    const index = timeline.findIndex(c => c.id === mysteryCardId && c.is_mystery);
    if (index !== -1) {
      timeline.splice(index, 1);
    }
  }

  // Convert correct mystery card to regular card (keep it in timeline)
  convertMysteryCardToRegular(playerId: string, mysteryCardId: string, trackId: string, trackName: string, artist: string, year: number | null, albumImageUrl: string | null): void {
    const timeline = this.playerTimelines.get(playerId);
    if (!timeline) return;

    const card = timeline.find(c => c.id === mysteryCardId && c.is_mystery);
    if (!card) return;

    card.track_id = trackId;
    card.track_name = trackName;
    card.artist = artist;
    card.year = year;
    card.is_mystery = false;
    card.mystery_track_id = null;
    card.album_image_url = albumImageUrl;
  }
}

// Export singleton instance
export const gameState = new GameStateManager();
