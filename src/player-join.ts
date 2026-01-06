import { PeerPlayerManager } from './peer-player';
import { randomUUID } from './utils';

const playerJoinPage = document.getElementById('player-join-page');
const nameInput = document.getElementById('player-name-input') as HTMLInputElement;
const joinButton = document.getElementById('player-join-button') as HTMLButtonElement;
const playerStatusText = document.getElementById('player-status-text');
const playerGamePage = document.getElementById('player-game-page');
const playerTimeline = document.getElementById('player-timeline');

let peerPlayer: PeerPlayerManager | null = null;
let gameId: string | null = null; // This is the host peer ID
let playerId: string | null = null;
let playerName: string | null = null;
let timelineCards: Array<{ id: string; track_id: string; track_name: string; artist: string; year: number | null; is_mystery: boolean; mystery_track_id: string | null; position: number; is_revealed: boolean; is_correct: boolean | null; album_image_url: string | null }> = [];
let draggedCard: HTMLElement | null = null;
let isRevealed: boolean = false;

// Get game ID (host peer ID) from URL hash
function getGameIdFromURL(): string | null {
  // Check hash first (for GitHub Pages compatibility)
  const hash = window.location.hash;
  const hashMatch = hash.match(/#\/join\/([^/]+)/);
  if (hashMatch) return hashMatch[1];

  // Fallback to pathname
  const path = window.location.pathname;
  const match = path.match(/\/join\/([^/]+)/);
  if (match) return match[1];

  // Fallback to query params
  const params = new URLSearchParams(window.location.search);
  return params.get('gameId');
}

// Initialize player join page
export function initializePlayerJoin(): void {
  // Show player join page
  const homepage = document.getElementById('homepage');
  const timemusicPage = document.getElementById('timemusic-page');
  if (playerJoinPage) {
    playerJoinPage.style.display = 'flex';
  }
  if (homepage) {
    homepage.style.display = 'none';
  }
  if (timemusicPage) {
    timemusicPage.style.display = 'none';
  }

  gameId = getGameIdFromURL();

  if (!gameId) {
    if (playerStatusText) {
      playerStatusText.textContent = 'Invalid game link';
    }
    return;
  }

  // Check if we have stored player info (reconnection)
  const storedPlayerId = localStorage.getItem('playerId');
  const storedGameId = localStorage.getItem('playerGameId');
  const storedPlayerName = localStorage.getItem('playerName');

  if (storedPlayerId && storedGameId === gameId && storedPlayerName) {
    playerId = storedPlayerId;
    playerName = storedPlayerName;
    if (nameInput) {
      nameInput.value = storedPlayerName;
      nameInput.disabled = true;
    }
    connectAsPlayer();
  }

  if (joinButton) {
    joinButton.addEventListener('click', handleJoin);
  }

  if (nameInput) {
    nameInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        handleJoin();
      }
    });
  }
}

function handleJoin(): void {
  if (!nameInput || !gameId) return;

  const name = nameInput.value.trim();
  if (!name) {
    alert('Please enter your name');
    return;
  }

  playerName = name;
  if (!playerId) {
    playerId = randomUUID();
  }

  // Store player info
  localStorage.setItem('playerId', playerId);
  localStorage.setItem('playerGameId', gameId);
  localStorage.setItem('playerName', playerName);

  connectAsPlayer();
}

async function connectAsPlayer(): Promise<void> {
  if (!gameId || !playerId || !playerName) return;

  try {
    peerPlayer = new PeerPlayerManager();

    // Set up message handlers before connecting
    peerPlayer.on('PLAYER_CONNECTED', (message) => {
      console.log('Player connected:', message);
      if (playerStatusText) {
        playerStatusText.textContent = `Connected to game!`;
      }
      if (nameInput) {
        nameInput.disabled = true;
      }
      if (joinButton) {
        joinButton.textContent = 'Connected';
        joinButton.disabled = true;
      }

      // Request state to restore timeline if game already started
      setTimeout(() => {
        if (peerPlayer && gameId && playerId) {
          peerPlayer.send({
            type: 'REQUEST_STATE',
            gameId,
            playerId
          });
        }
      }, 500);
    });

    peerPlayer.on('GAME_STARTED', () => {
      if (playerJoinPage && playerGamePage) {
        playerJoinPage.style.display = 'none';
        playerGamePage.style.display = 'flex';
      }
    });

    peerPlayer.on('PLAYER_CARD_DEALT', (message) => {
      const card = {
        id: message.card.id || `card-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
        track_id: message.card.track_id,
        track_name: message.card.track_name,
        artist: message.card.artist,
        year: message.card.year,
        is_mystery: false,
        mystery_track_id: null,
        position: timelineCards.length,
        is_revealed: false,
        is_correct: null,
        album_image_url: null
      };
      timelineCards.push(card);
      renderTimeline();
    });

    peerPlayer.on('MYSTERY_SONG_PLAYING', (message) => {
      // Add mystery placeholder to timeline
      isRevealed = false;
      const mysteryCard = {
        id: message.cardId || `mystery-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
        track_id: '',
        track_name: '?',
        artist: '?',
        year: null,
        is_mystery: true,
        mystery_track_id: message.mysteryTrackId,
        position: timelineCards.length,
        is_revealed: false,
        is_correct: null,
        album_image_url: null
      };
      timelineCards.push(mysteryCard);
      renderTimeline();
    });

    peerPlayer.on('MYSTERY_CARD_REVEALED', (message) => {
      isRevealed = true;
      const card = timelineCards.find(c => c.id === message.cardId);
      if (card) {
        card.is_revealed = true;
        card.is_correct = message.isCorrect;
        card.track_name = message.trackName;
        card.artist = message.artist;
        card.year = message.year;
        card.album_image_url = message.albumImageUrl;
      }
      renderTimeline();
    });

    peerPlayer.on('MYSTERY_CARD_REMOVED', (message) => {
      timelineCards = timelineCards.filter(c => c.id !== message.cardId);
      isRevealed = false;
      renderTimeline();
    });

    peerPlayer.on('MYSTERY_CARD_CONVERTED', (message) => {
      // Convert mystery card to regular card
      const card = timelineCards.find(c => c.id === message.cardId);
      if (card) {
        card.is_mystery = false;
        card.track_id = message.track_id;
        card.track_name = message.track_name;
        card.artist = message.artist;
        card.year = message.year;
        card.album_image_url = message.album_image_url;
        card.mystery_track_id = null;
      }
      isRevealed = false;
      renderTimeline();
    });

    peerPlayer.on('STATE_SYNC', (message) => {
      if (message.gameStarted && message.timeline) {
        timelineCards = message.timeline.map((card: any) => ({
          id: card.id,
          track_id: card.track_id || '',
          track_name: card.track_name,
          artist: card.artist,
          year: card.year,
          is_mystery: Boolean(card.is_mystery),
          mystery_track_id: card.mystery_track_id,
          position: card.position,
          is_revealed: Boolean(card.is_revealed),
          is_correct: card.is_correct === null ? null : Boolean(card.is_correct),
          album_image_url: card.album_image_url || null
        }));
        isRevealed = timelineCards.some(c => c.is_revealed);
        renderTimeline();

        if (playerJoinPage && playerGamePage) {
          playerJoinPage.style.display = 'none';
          playerGamePage.style.display = 'flex';
        }
      }
    });

    peerPlayer.on('TIMELINE_UPDATED', () => {
      // Timeline was successfully updated
      console.log('Timeline updated');
    });

    peerPlayer.on('ERROR', (message) => {
      console.error('Peer error:', message.message);
      if (playerStatusText) {
        playerStatusText.textContent = `Error: ${message.message}`;
      }
    });

    peerPlayer.on('connection_closed', () => {
      if (playerStatusText) {
        playerStatusText.textContent = 'Connection lost';
      }
    });

    // Connect to host peer (gameId is the host's peer ID)
    await peerPlayer.connect(gameId, playerId);

    // Send join message
    peerPlayer.send({
      type: 'PLAYER_JOIN',
      gameId,
      playerId,
      name: playerName
    });

  } catch (error) {
    console.error('Failed to connect:', error);
    if (playerStatusText) {
      playerStatusText.textContent = 'Failed to connect to game';
    }
  }
}

// Render timeline
function renderTimeline(): void {
  if (!playerTimeline) return;

  // Sort cards by position
  timelineCards.sort((a, b) => a.position - b.position);

  // Build timeline - show all cards in chronological order
  let html = '';

  timelineCards.forEach((card, index) => {
    if (card.is_mystery) {
      html += renderMysteryCard(card, index);
    } else {
      html += renderRegularCard(card, index);
    }
  });

  playerTimeline.innerHTML = html;

  // Add drag and drop event listeners to all cards (regular and mystery)
  const allCardElements = playerTimeline.querySelectorAll('.timeline-card');
  allCardElements.forEach((card) => {
    const cardElement = card as HTMLElement;

    // Only allow dragging if not revealed
    if (isRevealed) {
      cardElement.setAttribute('draggable', 'false');
      return;
    }

    cardElement.addEventListener('dragstart', handleDragStart);
    cardElement.addEventListener('dragend', handleDragEnd);
    cardElement.addEventListener('dragover', handleDragOver);
    cardElement.addEventListener('drop', handleDrop);
  });
}

// Drag and drop event handlers (defined outside renderTimeline to avoid recreating)
function handleDragStart(e: Event): void {
  const dragEvent = e as DragEvent;
  const cardElement = dragEvent.target as HTMLElement;
  draggedCard = cardElement;
  draggedCard.classList.add('dragging');
  if (dragEvent.dataTransfer) {
    dragEvent.dataTransfer.effectAllowed = 'move';
  }
}

function handleDragEnd(): void {
  if (draggedCard) {
    draggedCard.classList.remove('dragging');
  }
  draggedCard = null;
}

function handleDragOver(e: Event): void {
  const dragEvent = e as DragEvent;
  const cardElement = dragEvent.currentTarget as HTMLElement;
  dragEvent.preventDefault();
  if (dragEvent.dataTransfer) {
    dragEvent.dataTransfer.dropEffect = 'move';
  }

  if (!draggedCard || !playerTimeline || draggedCard === cardElement) return;

  const afterElement = getDragAfterElement(playerTimeline, dragEvent.clientY);

  if (afterElement == null) {
    playerTimeline.appendChild(draggedCard);
  } else {
    playerTimeline.insertBefore(draggedCard, afterElement);
  }
}

function handleDrop(e: Event): void {
  e.preventDefault();
  updateTimelinePositions();
}

// Render a regular card
function renderRegularCard(card: typeof timelineCards[0], index: number): string {
  return `
    <div class="timeline-card" 
         draggable="${!isRevealed}" 
         data-card-id="${card.id}"
         data-position="${index}">
      <div class="card-content">
        <div class="card-title">${card.track_name}</div>
        <div class="card-artist">${card.artist}</div>
        ${card.year ? `<div class="card-year">${card.year}</div>` : ''}
      </div>
    </div>
  `;
}

// Render mystery card
function renderMysteryCard(card: typeof timelineCards[0], index?: number): string {
  const isRevealedCard = card.is_revealed;
  const isCorrect = card.is_correct;

  let cardClasses = 'timeline-card mystery-placeholder';
  if (isRevealedCard) {
    cardClasses += isCorrect ? ' revealed-correct' : ' revealed-incorrect';
  }

  return `
    <div class="${cardClasses}"
         draggable="${!isRevealedCard && !isRevealed}"
         data-card-id="${card.id}"
         ${index !== undefined ? `data-position="${index}"` : ''}>
      <div class="card-content">
        ${!isRevealedCard ? `
          <div class="mystery-question-mark">?</div>
          <div class="card-info">Mystery Song</div>
        ` : `
          ${card.album_image_url && isCorrect ? `
            <img src="${card.album_image_url}" alt="Album cover" class="card-image" />
          ` : ''}
          <div class="card-title">${card.track_name}</div>
          <div class="card-artist">${card.artist}</div>
          ${card.year ? `<div class="card-year">${card.year}</div>` : ''}
        `}
      </div>
    </div>
  `;
}

// Get element after which to insert dragged card (for vertical layout)
function getDragAfterElement(container: HTMLElement, y: number): HTMLElement | null {
  const draggableElements = Array.from(container.querySelectorAll('.timeline-card:not(.dragging)')) as HTMLElement[];

  return draggableElements.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;

    if (offset < 0 && offset > closest.offset) {
      return { offset: offset, element: child };
    } else {
      return closest;
    }
  }, { offset: Number.NEGATIVE_INFINITY, element: null as HTMLElement | null }).element;
}

// Update timeline positions after drag
function updateTimelinePositions(): void {
  if (!playerTimeline || !peerPlayer || !gameId || !playerId) return;

  // Don't allow updates if revealed
  if (isRevealed) return;

  // Get all cards (regular and mystery) and exclude cards inside slots
  const cards = Array.from(playerTimeline.querySelectorAll('.timeline-card'))
    .filter(card => {
      // Exclude cards that are inside slots
      return !card.closest('.timeline-slot');
    });

  const updates: Array<{ id: string; position: number }> = [];
  let positionIndex = 0;

  cards.forEach((card) => {
    const cardId = card.getAttribute('data-card-id');
    if (cardId) {
      const cardData = timelineCards.find(c => c.id === cardId);
      // Update all cards (regular and mystery) that aren't revealed
      if (cardData && !cardData.is_revealed) {
        cardData.position = positionIndex;
        updates.push({ id: cardId, position: positionIndex });
        positionIndex++;
      }
    }
  });

  // Send update to host
  if (updates.length > 0) {
    peerPlayer.send({
      type: 'UPDATE_TIMELINE',
      playerId,
      timelineUpdates: updates
    });
  }
}

// Check if we're on the player join page
export function isPlayerJoinPage(): boolean {
  // Check hash (for GitHub Pages)
  if (window.location.hash.includes('/join')) return true;
  // Check pathname
  if (window.location.pathname.includes('/join')) return true;
  // Check query params
  if (window.location.search.includes('gameId=')) return true;
  return false;
}

