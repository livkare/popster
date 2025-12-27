import { initializeAuth, isAuthenticated, getValidAccessToken } from './spotify-auth';
import { handleCallback, isCallbackPage } from './callback-handler';
import { PeerHostManager } from './peer-host';
import { gameState } from './game-state';
import { generateQRCode } from './qr-code';
import { randomUUID } from './utils';
import { initializePlayerJoin, isPlayerJoinPage } from './player-join';
import { fetchUserPlaylists, fetchPlaylistTracks, extractReleaseYear, startPlayback, pausePlayback, fetchTrackDetails, ensureDeviceActive } from './spotify-api';

const playButton = document.getElementById('playButton');
const homepage = document.getElementById('homepage');
const timemusicPage = document.getElementById('timemusic-page');
const connectionStatus = document.getElementById('connection-status');
const connectionText = document.getElementById('connection-text');
const qrCodeContainer = document.getElementById('qr-code-container');
const hostPlayerListContainer = document.getElementById('host-player-list-container');
const selectPlaylistButton = document.getElementById('select-playlist-button');
const playlistModal = document.getElementById('playlist-modal');
const modalBackdrop = playlistModal?.querySelector('.modal-backdrop');
const modalCloseButton = document.getElementById('modal-close-button');
const playlistLoading = document.getElementById('playlist-loading');
const playlistError = document.getElementById('playlist-error');
const playlistErrorText = document.getElementById('playlist-error-text');
const playlistList = document.getElementById('playlist-list');
const playlistStatus = document.getElementById('playlist-status');
const startGameButton = document.getElementById('start-game-button') as HTMLButtonElement | null;
const gamePage = document.getElementById('game-page');
const mysteryCard = document.getElementById('mystery-card');
const playMysteryButton = document.getElementById('play-mystery-button') as HTMLButtonElement | null;

// Button state type
type ButtonState = 'play' | 'stop' | 'reveal' | 'next';

// Current button state
let currentButtonState: ButtonState = 'play';
let currentMysteryTrack: { track_id: string; track_name: string; artist: string; year: number | null } | null = null;

let peerHost: PeerHostManager | null = null;
let gameId: string | null = null;

// Playlist data structures
interface PlaylistTrack {
    id: string;
    name: string;
    artist: string;
    year: number | null;
    used: boolean;
}

interface SelectedPlaylist {
    id: string;
    name: string;
    tracks: PlaylistTrack[];
}

// Store selected playlist in memory (client-side only)
let selectedPlaylist: SelectedPlaylist | null = null;

// LocalStorage key for playlist persistence
const STORAGE_KEY_PLAYLIST = 'selectedPlaylist';

// Function to update connection status UI
function updateConnectionStatus(connected: boolean, message: string) {
    if (connectionStatus && connectionText) {
        connectionStatus.className = connected ? 'status-connected' : 'status-connecting';
        connectionText.textContent = message;
    }
}

// Initialize PeerJS connection as host
async function initializeHostPeer(): Promise<void> {
    if (!gameId) {
        console.error('gameId not set before initializing Peer');
        return;
    }

    try {
        peerHost = new PeerHostManager();
        const peerId = await peerHost.initialize(gameId);

        // Create game in state
        gameState.createGame(gameId);

        console.log('Host peer initialized with ID:', peerId);
        updateQRCode();

        // Handle player join requests
        peerHost.on('PLAYER_JOIN', (message, conn) => {
            const { playerId, name } = message;
            if (!playerId || !name) {
                peerHost!.sendToPlayer(playerId, { type: 'ERROR', message: 'Missing required fields' });
                return;
            }

            // Check if player already exists
            const existingPlayer = gameState.getPlayer(playerId);
            if (existingPlayer) {
                // Reconnection
                gameState.updatePlayerConnection(playerId, true);
                peerHost!.sendToPlayer(playerId, {
                    type: 'PLAYER_CONNECTED',
                    gameId,
                    playerId,
                    name: existingPlayer.name
                });
            } else {
                // New player
                gameState.addPlayer(gameId!, playerId, name);
                peerHost!.sendToPlayer(playerId, {
                    type: 'PLAYER_CONNECTED',
                    gameId,
                    playerId,
                    name
                });
            }

            // Broadcast updated player list
            broadcastPlayerList();
        });

        // Handle player disconnection
        peerHost.on('connection_closed', (message) => {
            const { peerId: playerId } = message;
            if (playerId) {
                gameState.updatePlayerConnection(playerId, false);
                broadcastPlayerList();
            }
        });

        // Handle timeline updates from players
        peerHost.on('UPDATE_TIMELINE', (message, conn) => {
            const { playerId, timelineUpdates } = message;
            if (!playerId || !timelineUpdates) {
                peerHost!.sendToPlayer(playerId, { type: 'ERROR', message: 'Missing required fields' });
                return;
            }

            gameState.updateTimelinePositions(playerId, timelineUpdates);
            peerHost!.sendToPlayer(playerId, {
                type: 'TIMELINE_UPDATED',
                success: true
            });
        });

        // Handle state requests
        peerHost.on('REQUEST_STATE', (message, conn) => {
            const { playerId } = message;
            const currentGameState = gameState.getGameState(gameId!);

            if (!currentGameState || !currentGameState.started) {
                peerHost!.sendToPlayer(playerId, { type: 'STATE_SYNC', gameStarted: false });
                return;
            }

            const timeline = gameState.getPlayerTimeline(playerId);
            peerHost!.sendToPlayer(playerId, {
                type: 'STATE_SYNC',
                gameStarted: true,
                timeline: timeline
            });
        });

    } catch (error) {
        console.error('Failed to initialize peer:', error);
    }
}

// Broadcast player list to all connected peers
function broadcastPlayerList(): void {
    if (!gameId || !peerHost) return;

    const players = gameState.getPlayers(gameId);
    updateHostPlayerList(players);
    updateStartGameButtonState();
}

// Update QR code display
function updateQRCode(): void {
    if (!qrCodeContainer || !gameId) return;

    // Generate join URL with host peer ID (same as gameId)
    const baseUrl = window.location.origin + window.location.pathname;
    const joinUrl = `${baseUrl}#/join/${gameId}`;

    generateQRCode(joinUrl, qrCodeContainer);
}

// Update host player list
function updateHostPlayerList(players: Array<{ id: string; name: string; connected: boolean }>): void {
    if (!hostPlayerListContainer) return;

    if (players.length === 0) {
        hostPlayerListContainer.innerHTML = '<p class="no-players">Waiting for players to join...</p>';
        return;
    }

    const listHTML = players.map(player => {
        const statusClass = player.connected ? 'player-connected' : 'player-disconnected';
        const statusText = player.connected ? '●' : '○';
        return `
            <div class="player-item ${statusClass}">
                <span class="player-status">${statusText}</span>
                <span class="player-name">${player.name}</span>
            </div>
        `;
    }).join('');

    hostPlayerListContainer.innerHTML = listHTML;
}

// Function to show TimeMusic page and initialize auth
async function showTimeMusicPage(createNewGame: boolean = false) {
    if (homepage && timemusicPage) {
        homepage.style.display = 'none';
        timemusicPage.style.display = 'flex';
        
        // Store that we're in TimeMusic mode
        localStorage.setItem('inTimeMusic', 'true');

        // Disconnect existing Peer connection if any
        if (peerHost) {
            peerHost.disconnect();
            peerHost = null;
        }
        
        // Generate new game ID only when explicitly creating a new game (button click)
        // On page reload, restore the existing gameId to maintain player connections
        if (createNewGame) {
            gameId = randomUUID();
            localStorage.setItem('hostGameId', gameId);
        } else {
            // Restore gameId from localStorage if it exists
            const storedGameId = localStorage.getItem('hostGameId');
            if (storedGameId) {
                gameId = storedGameId;
            } else {
                // If no stored gameId, create a new one
                gameId = randomUUID();
                localStorage.setItem('hostGameId', gameId);
            }
        }
        
        // Reset UI state
        if (hostPlayerListContainer) {
            hostPlayerListContainer.innerHTML = '<p class="no-players">Waiting for players to join...</p>';
        }
        
        // Restore playlist from localStorage if it exists (persist across page reloads and new games)
        const savedPlaylist = loadPlaylistFromStorage();
        if (savedPlaylist) {
            selectedPlaylist = savedPlaylist;
            updatePlaylistStatus(true);
            console.log(`Restored playlist from storage: ${savedPlaylist.name} with ${savedPlaylist.tracks.length} tracks`);
        } else {
            selectedPlaylist = null;
            updatePlaylistStatus(false);
        }
        
        // Hide game page if visible, ensure TimeMusic page is shown
        if (gamePage) {
            gamePage.style.display = 'none';
        }
        if (timemusicPage) {
            timemusicPage.style.display = 'flex';
        }
        
        // Reset button states
        if (startGameButton) {
            startGameButton.disabled = true;
        }
        currentButtonState = 'play';
        updateButtonState('play');
        
        // Initialize Spotify authentication
        updateConnectionStatus(false, 'Connecting to Spotify...');
        
        try {
            const authenticated = await initializeAuth();
            if (authenticated) {
                const token = await getValidAccessToken();
                if (token) {
                    updateConnectionStatus(true, 'Connected to Spotify');
                    
                    // Automatically activate a device when entering TimeMusic
                    console.log('Activating Spotify device...');
                    ensureDeviceActive(token).then(success => {
                        if (success) {
                            console.log('Device activated successfully');
                        } else {
                            console.warn('Could not activate device. User may need to open Spotify on a device.');
                            updateConnectionStatus(false, 'No active device - please open Spotify');
                        }
                    }).catch(error => {
                        console.error('Error activating device:', error);
                    });
                } else {
                    updateConnectionStatus(false, 'Failed to get access token');
                }
            } else {
                // Auth flow initiated, will redirect
                updateConnectionStatus(false, 'Redirecting to Spotify...');
            }
        } catch (error) {
            console.error('Error initializing auth:', error);
            updateConnectionStatus(false, 'Connection error');
        }

        // Initialize PeerJS connection for multiplayer
        await initializeHostPeer();
    }
}

// Initialize application
async function initializeApp() {
    console.log('Initializing app, current pathname:', window.location.pathname);
    console.log('Current search:', window.location.search);
    
    // Check if we're on the player join page
    if (isPlayerJoinPage()) {
        initializePlayerJoin();
        return;
    }
    
    // Handle callback if we're on the callback page
    if (isCallbackPage()) {
        console.log('Callback page detected, handling OAuth callback...');
        const success = await handleCallback();
        if (success) {
            console.log('Callback handled successfully');
            // Clear URL parameters and show TimeMusic page
            window.history.replaceState({}, document.title, '/');
            // Device activation will happen in showTimeMusicPage after auth check
            await showTimeMusicPage();
        } else {
            console.error('Callback handling failed');
            // Show error and redirect to homepage
            window.history.replaceState({}, document.title, '/');
            if (homepage && timemusicPage) {
                homepage.style.display = 'flex';
                timemusicPage.style.display = 'none';
            }
        }
        return;
    }
    
    // Check if we should show TimeMusic page on load
    // Check localStorage first (persistent state), then hash
    const inTimeMusic = localStorage.getItem('inTimeMusic') === 'true';
    const hash = window.location.hash;
    
    if (inTimeMusic || hash === '#timemusic' || hash.includes('timemusic')) {
        showTimeMusicPage();
    }
}

// Initialize on page load
initializeApp();

// Handle button click
playButton?.addEventListener('click', () => {
    showTimeMusicPage(true); // true = create new game instance
});

// Show playlist selection modal
function showPlaylistModal(): void {
    if (playlistModal) {
        playlistModal.style.display = 'flex';
        loadPlaylists();
    }
}

// Hide playlist selection modal
function hidePlaylistModal(): void {
    if (playlistModal) {
        playlistModal.style.display = 'none';
    }
}

// Load and display user playlists
async function loadPlaylists(): Promise<void> {
    if (!playlistLoading || !playlistError || !playlistErrorText || !playlistList) return;

    // Show loading state
    playlistLoading.style.display = 'block';
    playlistError.style.display = 'none';
    playlistList.innerHTML = '';

    try {
        const token = await getValidAccessToken();
        if (!token) {
            throw new Error('Not authenticated with Spotify');
        }

        const playlists = await fetchUserPlaylists(token);

        // Hide loading state
        playlistLoading.style.display = 'none';

        if (playlists.length === 0) {
            playlistList.innerHTML = '<p style="text-align: center; color: rgba(0, 0, 0, 0.6); padding: 2rem;">No playlists found</p>';
            return;
        }

        // Display playlists
        playlistList.innerHTML = playlists.map(playlist => `
            <div class="playlist-item" data-playlist-id="${playlist.id}" data-playlist-name="${playlist.name}">
                <div class="playlist-item-name">${playlist.name}</div>
                <div class="playlist-item-info">${playlist.tracks.total} tracks</div>
            </div>
        `).join('');

        // Add click handlers to playlist items
        playlistList.querySelectorAll('.playlist-item').forEach(item => {
            item.addEventListener('click', async () => {
                const playlistId = item.getAttribute('data-playlist-id');
                const playlistName = item.getAttribute('data-playlist-name');
                if (playlistId && playlistName) {
                    await selectPlaylist(playlistId, playlistName);
                }
            });
        });
    } catch (error) {
        console.error('Error loading playlists:', error);
        playlistLoading.style.display = 'none';
        playlistError.style.display = 'block';
        playlistErrorText.textContent = error instanceof Error ? error.message : 'Failed to load playlists';
    }
}

// Select a playlist and load its tracks
async function selectPlaylist(playlistId: string, playlistName: string): Promise<void> {
    if (!playlistLoading || !playlistError || !playlistErrorText || !playlistList) return;

    // Show loading state
    playlistLoading.style.display = 'block';
    playlistError.style.display = 'none';
    playlistList.innerHTML = '';

    try {
        const token = await getValidAccessToken();
        if (!token) {
            throw new Error('Not authenticated with Spotify');
        }

        // Fetch all tracks from the playlist
        const trackItems = await fetchPlaylistTracks(token, playlistId);

        // Parse tracks and extract metadata
        const tracks: PlaylistTrack[] = trackItems
            .filter(item => item.track !== null && item.track.id) // Filter out null tracks and tracks without ID
            .map(item => {
                const track = item.track!;
                const artist = track.artists && track.artists.length > 0 ? track.artists[0].name : 'Unknown Artist';
                const year = extractReleaseYear(track.album?.release_date);

                return {
                    id: track.id,
                    name: track.name || 'Unknown Track',
                    artist: artist,
                    year: year,
                    used: false
                };
            });

        // Store selected playlist in memory
        selectedPlaylist = {
            id: playlistId,
            name: playlistName,
            tracks: tracks
        };

        // Save playlist to localStorage for persistence
        savePlaylistToStorage(selectedPlaylist);

        console.log(`Selected playlist: ${playlistName} with ${tracks.length} tracks`);

        // Hide modal and update UI
        hidePlaylistModal();
        updatePlaylistStatus(true);
    } catch (error) {
        console.error('Error selecting playlist:', error);
        playlistLoading.style.display = 'none';
        playlistError.style.display = 'block';
        playlistErrorText.textContent = error instanceof Error ? error.message : 'Failed to load playlist tracks';
    }
}

// Save playlist to localStorage
function savePlaylistToStorage(playlist: SelectedPlaylist): void {
    try {
        localStorage.setItem(STORAGE_KEY_PLAYLIST, JSON.stringify(playlist));
    } catch (error) {
        console.error('Failed to save playlist to localStorage:', error);
    }
}

// Get the currently selected playlist
export function getSelectedPlaylist(): SelectedPlaylist | null {
    return selectedPlaylist;
}

// Update playlist state and persist to localStorage
// Use this function whenever the playlist state changes (e.g., marking tracks as used)
export function updatePlaylistState(updater: (playlist: SelectedPlaylist) => SelectedPlaylist): void {
    if (selectedPlaylist) {
        selectedPlaylist = updater(selectedPlaylist);
        savePlaylistToStorage(selectedPlaylist);
    }
}

// Load playlist from localStorage
function loadPlaylistFromStorage(): SelectedPlaylist | null {
    try {
        const stored = localStorage.getItem(STORAGE_KEY_PLAYLIST);
        if (stored) {
            return JSON.parse(stored) as SelectedPlaylist;
        }
    } catch (error) {
        console.error('Failed to load playlist from localStorage:', error);
    }
    return null;
}

// Clear playlist from storage
function clearPlaylistFromStorage(): void {
    try {
        localStorage.removeItem(STORAGE_KEY_PLAYLIST);
    } catch (error) {
        console.error('Failed to clear playlist from localStorage:', error);
    }
}

// Update playlist status indicator
function updatePlaylistStatus(selected: boolean): void {
    if (playlistStatus) {
        playlistStatus.style.display = selected ? 'block' : 'none';
    }
    updateStartGameButtonState();
}

// Update Start Game button state
function updateStartGameButtonState(): void {
    if (!startGameButton) return;
    
    const hasPlaylist = selectedPlaylist !== null;
    const hasPlayers = hostPlayerListContainer && 
        hostPlayerListContainer.querySelectorAll('.player-item').length > 0;
    
    startGameButton.disabled = !(hasPlaylist && hasPlayers);
}

// Start the game
function handleStartGame(): void {
    if (!peerHost || !gameId || !selectedPlaylist) {
        alert('Cannot start game: missing requirements');
        return;
    }

    if (startGameButton) {
        startGameButton.disabled = true;
    }

    // Save playlist
    gameState.savePlaylist(gameId, selectedPlaylist);

    // Initialize game state
    gameState.initializeGameState(gameId);

    const players = gameState.getPlayers(gameId);
    if (players.length === 0) {
        alert('No players in game');
        if (startGameButton) startGameButton.disabled = false;
        return;
    }

    let availableTracks = gameState.getAvailableTracks(gameId);
    if (availableTracks.length < players.length + 1) {
        alert('Not enough tracks in playlist');
        if (startGameButton) startGameButton.disabled = false;
        return;
    }

    // Deal one card to each player
    players.forEach((player, index) => {
        const randomIndex = Math.floor(Math.random() * availableTracks.length);
        const track = availableTracks[randomIndex];

        // Remove track and update available list
        availableTracks = availableTracks.filter((_, i) => i !== randomIndex);

        const timelineId = gameState.dealCardToPlayer(player.id, gameId!, track, index);
        gameState.markTrackUsed(gameId!, track.id, 'dealt');

        // Send card to player
        peerHost!.sendToPlayer(player.id, {
            type: 'PLAYER_CARD_DEALT',
            card: {
                id: timelineId,
                track_id: track.id,
                track_name: track.name,
                artist: track.artist,
                year: track.year
            }
        });
    });

    // Select mystery track from remaining available tracks
    const mysteryIndex = Math.floor(Math.random() * availableTracks.length);
    const mysteryTrack = availableTracks[mysteryIndex];
    gameState.markTrackUsed(gameId!, mysteryTrack.id, 'mystery');
    gameState.startGame(gameId!, mysteryTrack.id);

    // Set current mystery track
    currentMysteryTrack = {
        track_id: mysteryTrack.id,
        track_name: mysteryTrack.name,
        artist: mysteryTrack.artist,
        year: mysteryTrack.year
    };

    // Switch to game page
    if (timemusicPage && gamePage) {
        timemusicPage.style.display = 'none';
        gamePage.style.display = 'flex';
    }

    // Update mystery card display
    if (mysteryCard) {
        mysteryCard.setAttribute('data-track-id', mysteryTrack.id);
        resetMysteryCard();
    }

    updateButtonState('play');

    // Broadcast game started to all players
    peerHost!.broadcast({
        type: 'GAME_STARTED'
    });
}

// Update button state and text
function updateButtonState(state: ButtonState): void {
    currentButtonState = state;
    if (!playMysteryButton) return;

    switch (state) {
        case 'play':
            playMysteryButton.textContent = 'Play';
            playMysteryButton.disabled = false;
            break;
        case 'stop':
            playMysteryButton.textContent = 'Stop';
            playMysteryButton.disabled = false;
            break;
        case 'reveal':
            playMysteryButton.textContent = 'Reveal';
            playMysteryButton.disabled = false;
            break;
        case 'next':
            playMysteryButton.textContent = 'Next Card';
            playMysteryButton.disabled = false;
            break;
    }
}

// Reset mystery card to initial state
function resetMysteryCard(): void {
    if (!mysteryCard) return;
    mysteryCard.className = 'mystery-card';
    mysteryCard.innerHTML = `
        <div class="mystery-card-content">
            <div class="mystery-question-mark">?</div>
            <div class="mystery-card-info">Mystery Song</div>
        </div>
    `;
}

// Reveal mystery card with track details
async function revealMysteryCard(trackInfo: { track_id: string; track_name: string; artist: string; year: number | null; album_image_url?: string | null }): Promise<void> {
    if (!mysteryCard) return;

    try {
        // Fetch track details if we don't have album image
        let albumImageUrl = trackInfo.album_image_url;
        if (!albumImageUrl) {
            const token = await getValidAccessToken();
            if (token) {
                const trackDetails = await fetchTrackDetails(token, trackInfo.track_id);
                albumImageUrl = trackDetails.album.images[0]?.url || null;
            }
        }

        // Update card with revealed content
        mysteryCard.className = 'mystery-card revealed';
        const imageHtml = albumImageUrl 
            ? `<img src="${albumImageUrl}" alt="Album cover" class="mystery-card-image" />`
            : '<div class="mystery-card-image-placeholder">No Image</div>';
        
        mysteryCard.innerHTML = `
            <div class="mystery-card-content revealed-content">
                ${imageHtml}
                <div class="mystery-card-details">
                    <div class="mystery-card-title">${trackInfo.track_name}</div>
                    <div class="mystery-card-artist">${trackInfo.artist}</div>
                    ${trackInfo.year ? `<div class="mystery-card-year">${trackInfo.year}</div>` : ''}
                </div>
            </div>
        `;
    } catch (error) {
        console.error('Error revealing card:', error);
        // Still show basic info even if image fetch fails
        mysteryCard.className = 'mystery-card revealed';
        mysteryCard.innerHTML = `
            <div class="mystery-card-content revealed-content">
                <div class="mystery-card-details">
                    <div class="mystery-card-title">${trackInfo.track_name}</div>
                    <div class="mystery-card-artist">${trackInfo.artist}</div>
                    ${trackInfo.year ? `<div class="mystery-card-year">${trackInfo.year}</div>` : ''}
                </div>
            </div>
        `;
    }
}

// Handle mystery button click (state machine)
async function handleMysteryButtonClick(): Promise<void> {
    if (!peerHost || !gameId) return;

    switch (currentButtonState) {
        case 'play':
            await handlePlayMysterySong();
            break;
        case 'stop':
            await handleStopMysterySong();
            break;
        case 'reveal':
            await handleRevealMysteryCard();
            break;
        case 'next':
            await handleNextCard();
            break;
    }
}

// Handle play mystery song
async function handlePlayMysterySong(): Promise<void> {
    if (!peerHost || !gameId) return;

    const trackId = mysteryCard?.getAttribute('data-track-id');
    if (!trackId) return;

    if (playMysteryButton) {
        playMysteryButton.disabled = true;
    }

    try {
        // Get access token
        const token = await getValidAccessToken();
        if (!token) {
            throw new Error('Not authenticated with Spotify');
        }

        // Start playback using Spotify API
        await startPlayback(token, trackId);
        console.log('Started playback for track:', trackId);

        // Update game state
        gameState.setMysteryTrackPlaying(gameId, true);

        // Add mystery placeholder to all players' timelines
        const players = gameState.getPlayers(gameId);
        const currentGameState = gameState.getGameState(gameId);

        if (currentGameState && currentGameState.current_mystery_track_id) {
            players.forEach(player => {
                const timeline = gameState.getPlayerTimeline(player.id);
                const maxPosition = timeline.length > 0
                    ? Math.max(...timeline.map(t => t.position))
                    : -1;
                const mysteryId = gameState.addMysteryPlaceholder(player.id, gameId, currentGameState.current_mystery_track_id!, maxPosition + 1);

                peerHost!.sendToPlayer(player.id, {
                    type: 'MYSTERY_SONG_PLAYING',
                    mysteryTrackId: currentGameState.current_mystery_track_id,
                    cardId: mysteryId
                });
            });
        }

        // Update button to Stop
        updateButtonState('stop');
    } catch (error) {
        console.error('Error starting playback:', error);
        alert(`Failed to play song: ${error instanceof Error ? error.message : 'Unknown error'}`);
        updateButtonState('play');
    }
}

// Handle stop mystery song
async function handleStopMysterySong(): Promise<void> {
    if (!peerHost || !gameId) return;

    if (playMysteryButton) {
        playMysteryButton.disabled = true;
    }

    try {
        // Get access token
        const token = await getValidAccessToken();
        if (!token) {
            throw new Error('Not authenticated with Spotify');
        }

        // Pause playback using Spotify API
        await pausePlayback(token);
        console.log('Stopped playback');

        // Update game state
        gameState.setMysteryTrackPlaying(gameId, false);

        // Update button to Reveal
        updateButtonState('reveal');
    } catch (error) {
        console.error('Error stopping playback:', error);
        alert(`Failed to stop song: ${error instanceof Error ? error.message : 'Unknown error'}`);
        updateButtonState('stop');
    }
}

// Handle reveal mystery card
async function handleRevealMysteryCard(): Promise<void> {
    if (!peerHost || !gameId || !currentMysteryTrack) return;

    if (playMysteryButton) {
        playMysteryButton.disabled = true;
    }

    try {
        // Fetch track details to get album image
        const token = await getValidAccessToken();
        let albumImageUrl: string | null = null;

        if (token) {
            try {
                const trackDetails = await fetchTrackDetails(token, currentMysteryTrack.track_id);
                albumImageUrl = trackDetails.album.images[0]?.url || null;
            } catch (error) {
                console.warn('Failed to fetch track details, proceeding without image:', error);
            }
        }

        // Reveal mystery card for all players and check correctness
        const players = gameState.getPlayers(gameId);
        const currentGameState = gameState.getGameState(gameId);

        if (!currentGameState || !currentGameState.current_mystery_track_id) {
            alert('Game not started or no mystery track');
            updateButtonState('reveal');
            return;
        }

        const revealResults: Array<{ playerId: string; isCorrect: boolean }> = [];

        players.forEach(player => {
            const mysteryCard = gameState.getMysteryCardByTrackId(player.id, currentGameState.current_mystery_track_id!);
            if (mysteryCard) {
                const isCorrect = gameState.revealMysteryCard(
                    player.id,
                    mysteryCard.id,
                    currentMysteryTrack.year,
                    albumImageUrl,
                    currentMysteryTrack.track_id,
                    currentMysteryTrack.track_name,
                    currentMysteryTrack.artist
                );
                revealResults.push({ playerId: player.id, isCorrect });

                // Send reveal to player
                peerHost!.sendToPlayer(player.id, {
                    type: 'MYSTERY_CARD_REVEALED',
                    mysteryTrackId: currentGameState.current_mystery_track_id,
                    cardId: mysteryCard.id,
                    isCorrect,
                    trackName: currentMysteryTrack.track_name,
                    artist: currentMysteryTrack.artist,
                    year: currentMysteryTrack.year,
                    albumImageUrl: albumImageUrl || null
                });
            }
        });

        // Reveal host's mystery card
        await revealMysteryCard({
            track_id: currentMysteryTrack.track_id,
            track_name: currentMysteryTrack.track_name,
            artist: currentMysteryTrack.artist,
            year: currentMysteryTrack.year,
            album_image_url: albumImageUrl
        });

        updateButtonState('next');
    } catch (error) {
        console.error('Error revealing card:', error);
        alert(`Failed to reveal card: ${error instanceof Error ? error.message : 'Unknown error'}`);
        updateButtonState('reveal');
    }
}

// Handle next card
async function handleNextCard(): Promise<void> {
    if (!peerHost || !gameId) return;

    if (playMysteryButton) {
        playMysteryButton.disabled = true;
    }

    // Handle mystery cards: convert correct ones to regular cards, remove incorrect ones
    const players = gameState.getPlayers(gameId);
    const currentGameState = gameState.getGameState(gameId);
    const currentMysteryTrackId = currentGameState?.current_mystery_track_id;

    players.forEach(player => {
        if (currentMysteryTrackId) {
            const mysteryCard = gameState.getMysteryCardByTrackId(player.id, currentMysteryTrackId);
            if (mysteryCard && mysteryCard.is_revealed) {
                if (mysteryCard.is_correct && currentMysteryTrack) {
                    // Convert correct mystery card to regular card
                    gameState.convertMysteryCardToRegular(
                        player.id,
                        mysteryCard.id,
                        currentMysteryTrack.track_id,
                        currentMysteryTrack.track_name,
                        currentMysteryTrack.artist,
                        currentMysteryTrack.year,
                        mysteryCard.album_image_url
                    );

                    // Notify player to convert card
                    peerHost!.sendToPlayer(player.id, {
                        type: 'MYSTERY_CARD_CONVERTED',
                        cardId: mysteryCard.id,
                        track_id: currentMysteryTrack.track_id,
                        track_name: currentMysteryTrack.track_name,
                        artist: currentMysteryTrack.artist,
                        year: currentMysteryTrack.year,
                        album_image_url: mysteryCard.album_image_url
                    });
                } else {
                    // Remove incorrect mystery card
                    gameState.removeMysteryCard(player.id, mysteryCard.id);

                    // Notify player to remove card
                    peerHost!.sendToPlayer(player.id, {
                        type: 'MYSTERY_CARD_REMOVED',
                        cardId: mysteryCard.id
                    });
                }
            } else if (mysteryCard && !mysteryCard.is_revealed) {
                // Remove unrevealed mystery cards
                gameState.removeMysteryCard(player.id, mysteryCard.id);
                peerHost!.sendToPlayer(player.id, {
                    type: 'MYSTERY_CARD_REMOVED',
                    cardId: mysteryCard.id
                });
            }
        }
    });

    // Select next mystery track
    const availableTracks = gameState.getAvailableTracks(gameId);
    if (availableTracks.length === 0) {
        if (playMysteryButton) {
            playMysteryButton.textContent = 'Game Complete';
            playMysteryButton.disabled = true;
        }
        return;
    }

    const nextMysteryIndex = Math.floor(Math.random() * availableTracks.length);
    const nextMysteryTrack = availableTracks[nextMysteryIndex];
    gameState.markTrackUsed(gameId, nextMysteryTrack.id, 'mystery');
    gameState.updateMysteryTrack(gameId, nextMysteryTrack.id);

    // Set current mystery track
    currentMysteryTrack = {
        track_id: nextMysteryTrack.id,
        track_name: nextMysteryTrack.name,
        artist: nextMysteryTrack.artist,
        year: nextMysteryTrack.year
    };

    // Update mystery card display
    if (mysteryCard) {
        mysteryCard.setAttribute('data-track-id', nextMysteryTrack.id);
        resetMysteryCard();
    }

    updateButtonState('play');
}

// Initialize playlist selection handlers
function initializePlaylistSelection(): void {
    // Open modal when button is clicked
    selectPlaylistButton?.addEventListener('click', () => {
        showPlaylistModal();
    });

    // Close modal when close button is clicked
    modalCloseButton?.addEventListener('click', () => {
        hidePlaylistModal();
    });

    // Close modal when backdrop is clicked
    modalBackdrop?.addEventListener('click', (e) => {
        if (e.target === modalBackdrop) {
            hidePlaylistModal();
        }
    });
}

// Initialize playlist selection on page load
initializePlaylistSelection();

// Initialize start game button
startGameButton?.addEventListener('click', handleStartGame);
playMysteryButton?.addEventListener('click', handleMysteryButtonClick);

// Periodically check token validity and refresh if needed
setInterval(async () => {
    if (timemusicPage && timemusicPage.style.display !== 'none') {
        if (isAuthenticated()) {
            const token = await getValidAccessToken();
            if (token) {
                updateConnectionStatus(true, 'Connected to Spotify');
            } else {
                updateConnectionStatus(false, 'Reconnecting...');
                await initializeAuth();
            }
        }
    }
}, 60000); // Check every minute

