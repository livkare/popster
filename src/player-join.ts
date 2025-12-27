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

  // Separate mystery card from regular cards
  // Regular cards include: initial card and all converted mystery cards (is_mystery = false)
  const regularCards = timelineCards.filter(c => !c.is_mystery).sort((a, b) => a.position - b.position);
  const mysteryCard = timelineCards.find(c => c.is_mystery);
  const mysteryCardRevealed = mysteryCard?.is_revealed || false;

  // Build timeline with slots
  let html = '';
  
  // Helper to check if mystery card is in a slot (only used when mystery card exists and is not revealed)
  const isMysteryInSlot = (slotPos: number): boolean => {
    if (!mysteryCard || mysteryCardRevealed) return false;
    const regularPositions = regularCards.map(c => c.position).sort((a, b) => a - b);
    
    // Calculate expected position for this slot
    let expectedPosition: number;
    if (slotPos === -1) {
      // Before first card
      expectedPosition = regularPositions.length > 0 ? regularPositions[0] - 1 : 0;
    } else if (slotPos >= regularCards.length) {
      // After last card
      expectedPosition = regularPositions.length > 0 
        ? regularPositions[regularPositions.length - 1] + 1 
        : 0;
    } else {
      // Between cards: after card at slotPos
      if (slotPos === 0) {
        expectedPosition = regularPositions[0] + 0.5;
      } else if (slotPos < regularPositions.length) {
        expectedPosition = (regularPositions[slotPos - 1] + regularPositions[slotPos]) / 2;
      } else {
        expectedPosition = regularPositions[regularPositions.length - 1] + 1;
      }
    }
    
    // Check if mystery card position is close to expected position (within 0.1)
    return Math.abs(mysteryCard.position - expectedPosition) < 0.1;
  };
  
  // If mystery card exists and is revealed, show it in chronological order with other cards
  if (mysteryCard && mysteryCardRevealed) {
    // Mystery card is revealed - show all cards in chronological order without slots
    const allCards = [...regularCards, mysteryCard].sort((a, b) => a.position - b.position);
    allCards.forEach((card, index) => {
      if (card.is_mystery) {
        html += renderMysteryCard(card, index);
      } else {
        html += renderRegularCard(card, index);
      }
    });
  } else if (mysteryCard) {
    // Mystery card exists but is not revealed - show all regular cards with slots between them
    // Slot before first card (position -1)
    html += `
      <div class="timeline-slot ${isMysteryInSlot(-1) ? 'selected' : ''}" 
           data-slot-position="-1"
           data-is-mystery-slot="true">
        ${isMysteryInSlot(-1) ? renderMysteryCard(mysteryCard) : '<div class="slot-placeholder">+</div>'}
      </div>
    `;

    // Render all regular cards with slots between them
    regularCards.forEach((card, index) => {
      // Render the regular card (always show all regular cards including converted ones)
      html += renderRegularCard(card, index);
      
      // Only add slot between cards if not the last card
      if (index < regularCards.length - 1) {
        // Slot after this card (position = index)
        html += `
          <div class="timeline-slot ${isMysteryInSlot(index) ? 'selected' : ''}" 
               data-slot-position="${index}"
               data-is-mystery-slot="true">
            ${isMysteryInSlot(index) ? renderMysteryCard(mysteryCard) : '<div class="slot-placeholder">+</div>'}
          </div>
        `;
      }
    });

    // Slot at the end (after last card) - only one slot at the end
    html += `
      <div class="timeline-slot ${isMysteryInSlot(regularCards.length) ? 'selected' : ''}" 
           data-slot-position="${regularCards.length}"
           data-is-mystery-slot="true">
        ${isMysteryInSlot(regularCards.length) ? renderMysteryCard(mysteryCard) : '<div class="slot-placeholder">+</div>'}
      </div>
    `;
  } else {
    // No mystery card - just show all regular cards in chronological order (no slots)
    regularCards.forEach((card, index) => {
      html += renderRegularCard(card, index);
    });
  }

  playerTimeline.innerHTML = html;

  // Add click handlers for mystery card slots
  if (!isRevealed) {
    const slots = playerTimeline.querySelectorAll('.timeline-slot[data-is-mystery-slot="true"]');
    slots.forEach((slot) => {
      slot.addEventListener('click', () => {
        const slotPosition = parseInt(slot.getAttribute('data-slot-position') || '0', 10);
        moveMysteryCardToSlot(slotPosition);
      });
    });
  }

  // Add drag and drop event listeners to regular cards only
  const regularCardElements = playerTimeline.querySelectorAll('.timeline-card:not(.mystery-placeholder)');
  regularCardElements.forEach((card) => {
    const cardElement = card as HTMLElement;
    
    // Only allow dragging if not revealed
    if (isRevealed) {
      cardElement.setAttribute('draggable', 'false');
      return;
    }
    
    cardElement.addEventListener('dragstart', (e) => {
      const dragEvent = e as DragEvent;
      draggedCard = cardElement;
      draggedCard.classList.add('dragging');
      if (dragEvent.dataTransfer) {
        dragEvent.dataTransfer.effectAllowed = 'move';
      }
    });

    cardElement.addEventListener('dragend', () => {
      if (draggedCard) {
        draggedCard.classList.remove('dragging');
      }
      draggedCard = null;
    });

    cardElement.addEventListener('dragover', (e) => {
      const dragEvent = e as DragEvent;
      dragEvent.preventDefault();
      if (dragEvent.dataTransfer) {
        dragEvent.dataTransfer.dropEffect = 'move';
      }
      
      if (!draggedCard || draggedCard === cardElement) return;
      
      const afterElement = getDragAfterElement(playerTimeline!, dragEvent.clientY);
      
      if (afterElement == null) {
        playerTimeline!.appendChild(draggedCard);
      } else {
        playerTimeline!.insertBefore(draggedCard, afterElement);
      }
    });

    cardElement.addEventListener('drop', (e) => {
      e.preventDefault();
      updateTimelinePositions();
    });
  });

  // Handle drop on the timeline container itself (for empty spaces)
  if (playerTimeline && !isRevealed) {
    playerTimeline.addEventListener('dragover', (e) => {
      const dragEvent = e as DragEvent;
      dragEvent.preventDefault();
      if (dragEvent.dataTransfer) {
        dragEvent.dataTransfer.dropEffect = 'move';
      }
    });

    playerTimeline.addEventListener('drop', (e) => {
      e.preventDefault();
      if (draggedCard && playerTimeline) {
        // If dropped on empty space, append to end
        playerTimeline.appendChild(draggedCard);
        updateTimelinePositions();
      }
    });
  }
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

// Move mystery card to a slot
function moveMysteryCardToSlot(slotPosition: number): void {
  if (!wsClient || !gameId || !playerId || isRevealed) return;

  const mysteryCard = timelineCards.find(c => c.is_mystery);
  if (!mysteryCard) return;

  // Calculate new position based on slot
  // Slot positions: -1 (before first), 0-N (after each card), N+1 (after last)
  const regularCards = timelineCards.filter(c => !c.is_mystery).sort((a, b) => a.position - b.position);
  
  let newPosition: number;
  if (slotPosition === -1) {
    // Before all cards
    newPosition = regularCards.length > 0 ? regularCards[0].position - 1 : 0;
  } else if (slotPosition >= regularCards.length) {
    // After all cards
    newPosition = regularCards.length > 0 
      ? Math.max(...regularCards.map(c => c.position)) + 1 
      : 0;
  } else {
    // Between cards: after card at slotPosition
    if (slotPosition === 0) {
      // After first card
      newPosition = regularCards[0].position + 0.5;
    } else if (slotPosition < regularCards.length) {
      // Between two cards
      const cardBefore = regularCards[slotPosition - 1];
      const cardAfter = regularCards[slotPosition];
      newPosition = (cardBefore.position + cardAfter.position) / 2;
    } else {
      // Shouldn't happen, but fallback
      newPosition = regularCards[regularCards.length - 1].position + 1;
    }
  }

  // Update mystery card position
  mysteryCard.position = newPosition;

  // Send update to host
  if (peerPlayer) {
    peerPlayer.send({
      type: 'UPDATE_TIMELINE',
      playerId,
      timelineUpdates: [{ id: mysteryCard.id, position: newPosition }]
    });
  }

  // Re-render timeline
  renderTimeline();
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

  // Get only regular cards (not mystery cards) and exclude cards inside slots
  const cards = Array.from(playerTimeline.querySelectorAll('.timeline-card:not(.mystery-placeholder)'))
    .filter(card => {
      // Exclude cards that are inside slots (mystery cards in slots)
      return !card.closest('.timeline-slot');
    });

  const updates: Array<{ id: string; position: number }> = [];
  let positionIndex = 0;

  cards.forEach((card) => {
    const cardId = card.getAttribute('data-card-id');
    if (cardId) {
      const cardData = timelineCards.find(c => c.id === cardId);
      // Only update regular cards (not mystery cards) that aren't revealed
      if (cardData && !cardData.is_mystery && !cardData.is_revealed) {
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

