import { WebSocketServer, WebSocket } from 'ws';
import { 
  createGame, 
  getGame, 
  addPlayer, 
  getPlayers, 
  updatePlayerConnection, 
  updateHostConnection, 
  getPlayer,
  savePlaylist,
  getPlaylist,
  initializeGameState,
  startGame,
  getGameState,
  dealCardToPlayer,
  getPlayerTimeline,
  updateTimelinePositions,
  addMysteryPlaceholder,
  markTrackUsed,
  getAvailableTracks,
  setMysteryTrackPlaying,
  revealMysteryCard,
  getMysteryCardByTrackId,
  removeMysteryCard,
  convertMysteryCardToRegular,
  updateCardAlbumImage,
  updateMysteryTrack,
  PlaylistData,
  PlaylistTrack
} from './db.js';
import os from 'os';

const PORT = 3001;
const wss = new WebSocketServer({ port: PORT });

// Store active connections
const hostConnections = new Map<string, WebSocket>(); // gameId -> WebSocket
const playerConnections = new Map<string, WebSocket>(); // playerId -> WebSocket
const playerToGame = new Map<string, string>(); // playerId -> gameId

// Get local IP address
function getLocalIP(): string {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    const iface = interfaces[name];
    if (!iface) continue;
    for (const addr of iface) {
      if (addr.family === 'IPv4' && !addr.internal) {
        return addr.address;
      }
    }
  }
  return 'localhost';
}

const localIP = getLocalIP();
console.log(`WebSocket server running on ws://${localIP}:${PORT}`);
console.log(`Local IP: ${localIP}`);

// Broadcast player list to host
function broadcastPlayerListToHost(gameId: string): void {
  const hostWs = hostConnections.get(gameId);
  if (!hostWs || hostWs.readyState !== WebSocket.OPEN) return;

  const players = getPlayers(gameId);
  hostWs.send(JSON.stringify({
    type: 'PLAYER_LIST',
    players: players.map(p => ({
      id: p.id,
      name: p.name,
      connected: p.connected
    }))
  }));
}


wss.on('connection', (ws: WebSocket) => {
  console.log('New WebSocket connection');

  ws.on('message', (data: Buffer) => {
    try {
      const message = JSON.parse(data.toString());
      console.log('Received message:', message.type);

      switch (message.type) {
        case 'HOST_JOIN': {
          const { gameId } = message;
          if (!gameId) {
            ws.send(JSON.stringify({ type: 'ERROR', message: 'Missing gameId' }));
            return;
          }

          // Check if game exists, create if not
          let game = getGame(gameId);
          if (!game) {
            createGame(gameId);
            game = getGame(gameId);
          }

          // Update host connection
          updateHostConnection(gameId, true);
          hostConnections.set(gameId, ws);

          // Send confirmation and current player list
          ws.send(JSON.stringify({
            type: 'HOST_CONNECTED',
            gameId,
            localIP
          }));

          // Send current player list
          broadcastPlayerListToHost(gameId);
          break;
        }

        case 'PLAYER_JOIN': {
          const { gameId, playerId, name } = message;
          if (!gameId || !playerId || !name) {
            ws.send(JSON.stringify({ type: 'ERROR', message: 'Missing required fields' }));
            return;
          }

          // Check if game exists
          const game = getGame(gameId);
          if (!game) {
            ws.send(JSON.stringify({ type: 'ERROR', message: 'Game not found' }));
            return;
          }

          // Check if player already exists
          const existingPlayer = getPlayer(playerId);
          if (existingPlayer) {
            // Reconnection
            updatePlayerConnection(playerId, true);
            playerConnections.set(playerId, ws);
            playerToGame.set(playerId, gameId);

            ws.send(JSON.stringify({
              type: 'PLAYER_CONNECTED',
              gameId,
              playerId,
              name: existingPlayer.name
            }));

            // Broadcast updated list to host
            broadcastPlayerListToHost(gameId);
          } else {
            // New player
            addPlayer(gameId, playerId, name);
            playerConnections.set(playerId, ws);
            playerToGame.set(playerId, gameId);

            ws.send(JSON.stringify({
              type: 'PLAYER_CONNECTED',
              gameId,
              playerId,
              name
            }));

            // Broadcast updated list to host
            broadcastPlayerListToHost(gameId);
          }
          break;
        }

        case 'PING': {
          ws.send(JSON.stringify({ type: 'PONG' }));
          break;
        }

        case 'START_GAME': {
          const { gameId, playlist } = message;
          if (!gameId) {
            ws.send(JSON.stringify({ type: 'ERROR', message: 'Missing gameId' }));
            return;
          }

          // Verify this is the host
          if (hostConnections.get(gameId) !== ws) {
            ws.send(JSON.stringify({ type: 'ERROR', message: 'Only host can start game' }));
            return;
          }

          // Check if game exists
          const game = getGame(gameId);
          if (!game) {
            ws.send(JSON.stringify({ type: 'ERROR', message: 'Game not found' }));
            return;
          }

          // Get players
          const players = getPlayers(gameId);
          if (players.length === 0) {
            ws.send(JSON.stringify({ type: 'ERROR', message: 'No players in game' }));
            return;
          }

          // Save playlist if provided
          if (playlist) {
            savePlaylist(gameId, playlist);
          } else {
            const existingPlaylist = getPlaylist(gameId);
            if (!existingPlaylist) {
              ws.send(JSON.stringify({ type: 'ERROR', message: 'No playlist selected' }));
              return;
            }
          }

          // Initialize game state
          initializeGameState(gameId);
          const playlistData = playlist || getPlaylist(gameId)!;
          const availableTracks = getAvailableTracks(gameId);

          if (availableTracks.length < players.length + 1) {
            ws.send(JSON.stringify({ type: 'ERROR', message: 'Not enough tracks in playlist' }));
            return;
          }

          // Deal one card to each player
          const usedTracks: string[] = [];
          players.forEach((player, index) => {
            const randomIndex = Math.floor(Math.random() * availableTracks.length);
            const track = availableTracks[randomIndex];
            availableTracks.splice(randomIndex, 1);
            usedTracks.push(track.id);
            
            const timelineId = dealCardToPlayer(player.id, gameId, track, index);
            markTrackUsed(gameId, track.id, 'dealt', player.id);

            // Send card to player
            const playerWs = playerConnections.get(player.id);
            if (playerWs && playerWs.readyState === WebSocket.OPEN) {
              playerWs.send(JSON.stringify({
                type: 'PLAYER_CARD_DEALT',
                card: {
                  id: timelineId,
                  track_id: track.id,
                  track_name: track.name,
                  artist: track.artist,
                  year: track.year
                }
              }));
            }
          });

          // Select mystery track
          const mysteryIndex = Math.floor(Math.random() * availableTracks.length);
          const mysteryTrack = availableTracks[mysteryIndex];
          markTrackUsed(gameId, mysteryTrack.id, 'mystery');
          startGame(gameId, mysteryTrack.id);

          // Send mystery card to host
          ws.send(JSON.stringify({
            type: 'MYSTERY_CARD_SET',
            mysteryTrack: {
              track_id: mysteryTrack.id,
              track_name: mysteryTrack.name,
              artist: mysteryTrack.artist,
              year: mysteryTrack.year
            }
          }));

          // Broadcast game started to all players
          players.forEach(player => {
            const playerWs = playerConnections.get(player.id);
            if (playerWs && playerWs.readyState === WebSocket.OPEN) {
              playerWs.send(JSON.stringify({
                type: 'GAME_STARTED'
              }));
            }
          });

          break;
        }

        case 'PLAY_MYSTERY_SONG': {
          const { gameId } = message;
          if (!gameId) {
            ws.send(JSON.stringify({ type: 'ERROR', message: 'Missing gameId' }));
            return;
          }

          // Verify this is the host
          if (hostConnections.get(gameId) !== ws) {
            ws.send(JSON.stringify({ type: 'ERROR', message: 'Only host can play mystery song' }));
            return;
          }

          const gameState = getGameState(gameId);
          if (!gameState || !gameState.started || !gameState.current_mystery_track_id) {
            ws.send(JSON.stringify({ type: 'ERROR', message: 'Game not started or no mystery track' }));
            return;
          }

          setMysteryTrackPlaying(gameId, true);

          // Add mystery placeholder to all players' timelines
          const players = getPlayers(gameId);
          players.forEach(player => {
            const timeline = getPlayerTimeline(player.id);
            const maxPosition = timeline.length > 0 
              ? Math.max(...timeline.map(t => t.position)) 
              : -1;
            const mysteryId = addMysteryPlaceholder(player.id, gameId, gameState.current_mystery_track_id!, maxPosition + 1);

            const playerWs = playerConnections.get(player.id);
            if (playerWs && playerWs.readyState === WebSocket.OPEN) {
              playerWs.send(JSON.stringify({
                type: 'MYSTERY_SONG_PLAYING',
                mysteryTrackId: gameState.current_mystery_track_id,
                cardId: mysteryId
              }));
            }
          });

          break;
        }

        case 'STOP_MYSTERY_SONG': {
          const { gameId } = message;
          if (!gameId) {
            ws.send(JSON.stringify({ type: 'ERROR', message: 'Missing gameId' }));
            return;
          }

          // Verify this is the host
          if (hostConnections.get(gameId) !== ws) {
            ws.send(JSON.stringify({ type: 'ERROR', message: 'Only host can stop mystery song' }));
            return;
          }

          setMysteryTrackPlaying(gameId, false);

          // Notify host that playback stopped
          ws.send(JSON.stringify({
            type: 'MYSTERY_SONG_STOPPED'
          }));

          break;
        }

        case 'REVEAL_MYSTERY_CARD': {
          const { gameId, albumImageUrl } = message;
          if (!gameId) {
            ws.send(JSON.stringify({ type: 'ERROR', message: 'Missing gameId' }));
            return;
          }

          // Verify this is the host
          if (hostConnections.get(gameId) !== ws) {
            ws.send(JSON.stringify({ type: 'ERROR', message: 'Only host can reveal mystery card' }));
            return;
          }

          const gameState = getGameState(gameId);
          if (!gameState || !gameState.started || !gameState.current_mystery_track_id) {
            ws.send(JSON.stringify({ type: 'ERROR', message: 'Game not started or no mystery track' }));
            return;
          }

          const playlist = getPlaylist(gameId);
          if (!playlist) {
            ws.send(JSON.stringify({ type: 'ERROR', message: 'Playlist not found' }));
            return;
          }

          // Find mystery track details
          const mysteryTrack = playlist.tracks.find(t => t.id === gameState.current_mystery_track_id);
          if (!mysteryTrack) {
            ws.send(JSON.stringify({ type: 'ERROR', message: 'Mystery track not found' }));
            return;
          }

          // Reveal mystery card for all players and check correctness
          const players = getPlayers(gameId);
          const revealResults: Array<{ playerId: string; isCorrect: boolean }> = [];

          players.forEach(player => {
            const mysteryCard = getMysteryCardByTrackId(player.id, gameState.current_mystery_track_id!);
            if (mysteryCard) {
              const isCorrect = revealMysteryCard(
                player.id, 
                mysteryCard.id, 
                mysteryTrack.year, 
                albumImageUrl,
                mysteryTrack.id,
                mysteryTrack.name,
                mysteryTrack.artist
              );
              revealResults.push({ playerId: player.id, isCorrect });

              // Send reveal to player
              const playerWs = playerConnections.get(player.id);
              if (playerWs && playerWs.readyState === WebSocket.OPEN) {
                playerWs.send(JSON.stringify({
                  type: 'MYSTERY_CARD_REVEALED',
                  mysteryTrackId: gameState.current_mystery_track_id,
                  cardId: mysteryCard.id,
                  isCorrect,
                  trackName: mysteryTrack.name,
                  artist: mysteryTrack.artist,
                  year: mysteryTrack.year,
                  albumImageUrl: albumImageUrl || null
                }));
              }
            }
          });

          // Send reveal confirmation to host with track details
          ws.send(JSON.stringify({
            type: 'MYSTERY_CARD_REVEALED',
            mysteryTrack: {
              track_id: mysteryTrack.id,
              track_name: mysteryTrack.name,
              artist: mysteryTrack.artist,
              year: mysteryTrack.year,
              album_image_url: albumImageUrl || null
            },
            revealResults
          }));

          break;
        }

        case 'NEXT_CARD': {
          const { gameId } = message;
          if (!gameId) {
            ws.send(JSON.stringify({ type: 'ERROR', message: 'Missing gameId' }));
            return;
          }

          // Verify this is the host
          if (hostConnections.get(gameId) !== ws) {
            ws.send(JSON.stringify({ type: 'ERROR', message: 'Only host can move to next card' }));
            return;
          }

          const gameState = getGameState(gameId);
          if (!gameState || !gameState.started) {
            ws.send(JSON.stringify({ type: 'ERROR', message: 'Game not started' }));
            return;
          }

          // Handle mystery cards: convert correct ones to regular cards, remove incorrect ones
          const players = getPlayers(gameId);
          const currentMysteryTrackId = gameState.current_mystery_track_id;
          const playlist = getPlaylist(gameId);

          players.forEach(player => {
            if (currentMysteryTrackId) {
              const mysteryCard = getMysteryCardByTrackId(player.id, currentMysteryTrackId);
              if (mysteryCard && mysteryCard.is_revealed) {
                if (mysteryCard.is_correct && playlist) {
                  // Convert correct mystery card to regular card
                  const mysteryTrack = playlist.tracks.find(t => t.id === currentMysteryTrackId);
                  if (mysteryTrack) {
                    convertMysteryCardToRegular(
                      player.id,
                      mysteryCard.id,
                      mysteryTrack.id,
                      mysteryTrack.name,
                      mysteryTrack.artist,
                      mysteryTrack.year,
                      mysteryCard.album_image_url
                    );

                    // Notify player to convert card
                    const playerWs = playerConnections.get(player.id);
                    if (playerWs && playerWs.readyState === WebSocket.OPEN) {
                      playerWs.send(JSON.stringify({
                        type: 'MYSTERY_CARD_CONVERTED',
                        cardId: mysteryCard.id,
                        track_id: mysteryTrack.id,
                        track_name: mysteryTrack.name,
                        artist: mysteryTrack.artist,
                        year: mysteryTrack.year,
                        album_image_url: mysteryCard.album_image_url
                      }));
                    }
                  }
                } else {
                  // Remove incorrect mystery card
                  removeMysteryCard(player.id, mysteryCard.id);

                  // Notify player to remove card
                  const playerWs = playerConnections.get(player.id);
                  if (playerWs && playerWs.readyState === WebSocket.OPEN) {
                    playerWs.send(JSON.stringify({
                      type: 'MYSTERY_CARD_REMOVED',
                      cardId: mysteryCard.id
                    }));
                  }
                }
              } else if (mysteryCard && !mysteryCard.is_revealed) {
                // Remove unrevealed mystery cards (shouldn't happen, but handle it)
                removeMysteryCard(player.id, mysteryCard.id);
                const playerWs = playerConnections.get(player.id);
                if (playerWs && playerWs.readyState === WebSocket.OPEN) {
                  playerWs.send(JSON.stringify({
                    type: 'MYSTERY_CARD_REMOVED',
                    cardId: mysteryCard.id
                  }));
                }
              }
            }
          });

          // Select next mystery track
          const availableTracks = getAvailableTracks(gameId);
          if (availableTracks.length === 0) {
            ws.send(JSON.stringify({
              type: 'NEXT_CARD_SET',
              mysteryTrack: null,
              message: 'No more tracks available'
            }));
            break;
          }

          const nextMysteryIndex = Math.floor(Math.random() * availableTracks.length);
          const nextMysteryTrack = availableTracks[nextMysteryIndex];
          markTrackUsed(gameId, nextMysteryTrack.id, 'mystery');

          // Update game state with new mystery track
          updateMysteryTrack(gameId, nextMysteryTrack.id);

          // Send new mystery card to host
          ws.send(JSON.stringify({
            type: 'NEXT_CARD_SET',
            mysteryTrack: {
              track_id: nextMysteryTrack.id,
              track_name: nextMysteryTrack.name,
              artist: nextMysteryTrack.artist,
              year: nextMysteryTrack.year
            }
          }));

          break;
        }

        case 'UPDATE_TIMELINE': {
          const { playerId, timelineUpdates } = message;
          if (!playerId || !timelineUpdates) {
            ws.send(JSON.stringify({ type: 'ERROR', message: 'Missing required fields' }));
            return;
          }

          // Verify this is the correct player
          if (playerConnections.get(playerId) !== ws) {
            ws.send(JSON.stringify({ type: 'ERROR', message: 'Unauthorized' }));
            return;
          }

          updateTimelinePositions(playerId, timelineUpdates);
          
          ws.send(JSON.stringify({
            type: 'TIMELINE_UPDATED',
            success: true
          }));

          break;
        }

        case 'REQUEST_STATE': {
          const { gameId, playerId } = message;
          if (!gameId) {
            ws.send(JSON.stringify({ type: 'ERROR', message: 'Missing gameId' }));
            return;
          }

          const gameState = getGameState(gameId);
          if (!gameState || !gameState.started) {
            ws.send(JSON.stringify({ type: 'STATE_SYNC', gameStarted: false }));
            return;
          }

          // If player, send their timeline
          if (playerId) {
            const timeline = getPlayerTimeline(playerId);
            ws.send(JSON.stringify({
              type: 'STATE_SYNC',
              gameStarted: true,
              timeline: timeline
            }));
          } else {
            // If host, send game state and mystery card
            const playlist = getPlaylist(gameId);
            ws.send(JSON.stringify({
              type: 'STATE_SYNC',
              gameStarted: true,
              gameState: gameState,
              playlist: playlist
            }));
          }

          break;
        }
      }
    } catch (error) {
      console.error('Error handling message:', error);
      ws.send(JSON.stringify({ type: 'ERROR', message: 'Invalid message format' }));
    }
  });

  ws.on('close', () => {
    console.log('WebSocket connection closed');

    // Find and remove host connection
    for (const [gameId, hostWs] of hostConnections.entries()) {
      if (hostWs === ws) {
        hostConnections.delete(gameId);
        updateHostConnection(gameId, false);
        console.log(`Host disconnected from game ${gameId}`);
        break;
      }
    }

    // Find and remove player connection
    for (const [playerId, playerWs] of playerConnections.entries()) {
      if (playerWs === ws) {
        playerConnections.delete(playerId);
        const gameId = playerToGame.get(playerId);
        playerToGame.delete(playerId);
        
        if (gameId) {
          updatePlayerConnection(playerId, false);
          console.log(`Player ${playerId} disconnected from game ${gameId}`);
          
          // Broadcast updated list to host
          broadcastPlayerListToHost(gameId);
        }
        break;
      }
    }
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

// Keep server running
process.on('SIGINT', () => {
  console.log('Shutting down WebSocket server...');
  wss.close();
  process.exit(0);
});

