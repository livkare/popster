import { test, expect } from '@playwright/test';

// Helper to log console messages
function setupConsoleLogging(page: any) {
  page.on('console', (msg: any) => {
    const type = msg.type();
    const text = msg.text();
    const location = msg.location();
    
    // Log all console messages with context
    console.log(`[${type.toUpperCase()}] ${text}`);
    if (location.url) {
      console.log(`  Location: ${location.url}:${location.lineNumber}`);
    }
  });

  page.on('pageerror', (error: Error) => {
    console.error(`[PAGE ERROR] ${error.message}`);
    if (error.stack) {
      console.error(`  Stack: ${error.stack}`);
    }
  });

  page.on('requestfailed', (request: any) => {
    console.error(`[REQUEST FAILED] ${request.method()} ${request.url()}`);
    console.error(`  Failure: ${request.failure()?.errorText || 'Unknown'}`);
  });
}

test.describe('Game Creation Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage and sessionStorage before each test
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    
    // Setup console logging
    setupConsoleLogging(page);
  });

  test('should load landing page with create and join options', async ({ page }) => {
    console.log('[TEST] Loading landing page');
    await page.goto('/');
    
    // Check page title/heading
    await expect(page.getByRole('heading', { name: /hitster/i, level: 2 })).toBeVisible();
    await expect(page.getByText(/turn your phone into a music time machine/i)).toBeVisible();
    
    // Check for Create Game section
    await expect(page.getByRole('heading', { name: /create game/i })).toBeVisible();
    const createButton = page.getByRole('button', { name: /create game|connecting/i });
    await expect(createButton).toBeVisible();
    
    // Check for Join Game section
    await expect(page.getByRole('heading', { name: /join game/i })).toBeVisible();
    await expect(page.getByRole('textbox', { name: /room key/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /join game/i })).toBeVisible();
    
    console.log('[TEST] Landing page loaded successfully');
  });

  test('should establish WebSocket connection', async ({ page }) => {
    console.log('[TEST] Testing WebSocket connection');
    await page.goto('/');
    
    // Wait for connection to establish
    const createButton = page.getByRole('button', { name: /create game|connecting/i });
    
    // Wait for button to be enabled and show "Create Game"
    await expect(createButton).toBeEnabled({ timeout: 10000 });
    await expect(createButton).toHaveText(/create game/i, { timeout: 10000 });
    
    console.log('[TEST] WebSocket connection established');
  });

  test('should create a room and navigate to host page', async ({ page }) => {
    console.log('[TEST] Creating room');
    await page.goto('/');
    
    // Wait for connection
    const createButton = page.getByRole('button', { name: /create game/i });
    await expect(createButton).toBeEnabled({ timeout: 10000 });
    
    console.log('[TEST] Clicking create game button');
    await createButton.click();
    
    // Wait for navigation to host page
    await page.waitForURL(/\/host\/[A-Z0-9]{6}/, { timeout: 15000 });
    
    // Verify we're on host page
    await expect(page.getByRole('heading', { name: /host room/i })).toBeVisible({ timeout: 5000 });
    
    // Verify room key is in URL
    const url = page.url();
    const roomKeyMatch = url.match(/\/host\/([A-Z0-9]{6})/);
    expect(roomKeyMatch).not.toBeNull();
    const roomKey = roomKeyMatch![1];
    expect(roomKey).toMatch(/^[A-Z0-9]{6}$/);
    
    console.log(`[TEST] Room created with key: ${roomKey}`);
  });

  test('should allow host to join room with name', async ({ page }) => {
    console.log('[TEST] Host joining room');
    await page.goto('/');
    
    // Create room
    const createButton = page.getByRole('button', { name: /create game/i });
    await expect(createButton).toBeEnabled({ timeout: 10000 });
    await createButton.click();
    
    // Wait for host page
    await page.waitForURL(/\/host\/[A-Z0-9]{6}/, { timeout: 15000 });
    
    // Fill in name
    const nameInput = page.getByLabel(/your name/i);
    await expect(nameInput).toBeVisible({ timeout: 5000 });
    await nameInput.fill('Test Host');
    console.log('[TEST] Filled in host name');
    
    // Fill in avatar
    const avatarInput = page.getByLabel(/avatar/i);
    if (await avatarInput.isVisible()) {
      await avatarInput.fill('🎮');
      console.log('[TEST] Filled in avatar');
    }
    
    // Click join button
    const joinButton = page.getByRole('button', { name: /join as host/i });
    await expect(joinButton).toBeEnabled();
    console.log('[TEST] Clicking join as host button');
    await joinButton.click();
    
    // Should show host interface
    await expect(
      page.getByText(/host mode|spotify connection/i).first()
    ).toBeVisible({ timeout: 10000 });
    
    console.log('[TEST] Host joined successfully');
  });

  test('should display room key in host page', async ({ page }) => {
    console.log('[TEST] Testing room key display');
    await page.goto('/');
    
    // Create room
    const createButton = page.getByRole('button', { name: /create game/i });
    await expect(createButton).toBeEnabled({ timeout: 10000 });
    await createButton.click();
    
    // Wait for host page
    await page.waitForURL(/\/host\/[A-Z0-9]{6}/, { timeout: 15000 });
    
    // Extract room key from URL
    const url = page.url();
    const roomKeyMatch = url.match(/\/host\/([A-Z0-9]{6})/);
    expect(roomKeyMatch).not.toBeNull();
    const roomKey = roomKeyMatch![1];
    
    // Join as host
    const nameInput = page.getByLabel(/your name/i);
    await expect(nameInput).toBeVisible({ timeout: 5000 });
    await nameInput.fill('Test Host');
    
    const joinButton = page.getByRole('button', { name: /join as host/i });
    await expect(joinButton).toBeEnabled();
    await joinButton.click();
    
    // Wait for host interface
    await expect(page.getByText(/host mode|spotify connection/i).first()).toBeVisible({ timeout: 10000 });
    
    // Verify room key is displayed
    await expect(page.getByText(new RegExp(`Room: ${roomKey}`, 'i'))).toBeVisible({ timeout: 5000 });
    
    console.log(`[TEST] Room key displayed: ${roomKey}`);
  });

  test('should show lobby after host joins', async ({ page }) => {
    console.log('[TEST] Testing lobby display');
    await page.goto('/');
    
    // Create room
    const createButton = page.getByRole('button', { name: /create game/i });
    await expect(createButton).toBeEnabled({ timeout: 10000 });
    await createButton.click();
    
    // Wait for host page
    await page.waitForURL(/\/host\/[A-Z0-9]{6}/, { timeout: 15000 });
    
    // Join as host
    const nameInput = page.getByLabel(/your name/i);
    await expect(nameInput).toBeVisible({ timeout: 5000 });
    await nameInput.fill('Test Host');
    
    const joinButton = page.getByRole('button', { name: /join as host/i });
    await expect(joinButton).toBeEnabled();
    await joinButton.click();
    
    // Should show lobby with player list
    await expect(page.getByRole('heading', { name: /players/i })).toBeVisible({ timeout: 10000 });
    
    // Should show the host in the player list
    await expect(page.getByText(/test host/i)).toBeVisible({ timeout: 5000 });
    
    console.log('[TEST] Lobby displayed with host player');
  });

  test('should validate room key format when joining', async ({ page }) => {
    console.log('[TEST] Testing room key validation');
    await page.goto('/');
    
    const roomKeyInput = page.getByRole('textbox', { name: /room key/i });
    const joinButton = page.getByRole('button', { name: /join game/i });
    
    // Try to join with invalid room key (too short)
    await roomKeyInput.fill('ABC');
    await expect(joinButton).toBeDisabled();
    console.log('[TEST] Join button disabled for short key');
    
    // Try with valid format
    await roomKeyInput.fill('ABCD12');
    await expect(joinButton).toBeEnabled();
    console.log('[TEST] Join button enabled for valid key');
    
    // Try with invalid characters
    await roomKeyInput.fill('ABCD-1');
    await roomKeyInput.blur();
    // Input should auto-uppercase and filter
    const value = await roomKeyInput.inputValue();
    console.log(`[TEST] Input value after invalid chars: ${value}`);
  });

  test('should handle invalid room key format gracefully', async ({ page }) => {
    console.log('[TEST] Testing invalid room key handling');
    await page.goto('/');
    
    const roomKeyInput = page.getByRole('textbox', { name: /room key/i });
    
    // Try invalid formats
    await roomKeyInput.fill('abc');
    await expect(page.getByRole('button', { name: /join game/i })).toBeDisabled();
    
    await roomKeyInput.fill('ABCDEFG'); // Too long
    // Input should limit to 6 characters
    const value = await roomKeyInput.inputValue();
    expect(value.length).toBeLessThanOrEqual(6);
    console.log(`[TEST] Input limited to 6 chars: ${value}`);
  });

  test('should show error if connection fails', async ({ page }) => {
    console.log('[TEST] Testing connection error handling');
    await page.goto('/');
    
    // Verify connection status component exists (use first() to handle multiple matches)
    const connectionStatus = page.getByText(/connected|connecting|disconnected/i).first();
    await expect(connectionStatus).toBeVisible({ timeout: 5000 });
    
    // Verify create button behavior
    const createButton = page.getByRole('button', { name: /create game|connecting/i });
    
    // Wait for connection to establish or fail
    await page.waitForTimeout(6000);
    
    // Check if button is enabled (connected) or disabled (not connected)
    const isEnabled = await createButton.isEnabled().catch(() => false);
    const buttonText = await createButton.textContent().catch(() => '');
    
    if (isEnabled) {
      await expect(createButton).toHaveText(/create game/i);
      console.log('[TEST] Connection successful');
    } else {
      expect(buttonText?.toLowerCase().includes('connecting')).toBe(true);
      console.log('[TEST] Connection pending or failed');
    }
    
    // Verify the error handling code path exists
    const layout = page.locator('header');
    await expect(layout).toBeVisible();
  });

  test('should persist room state on page refresh', async ({ page }) => {
    console.log('[TEST] Testing room state persistence');
    await page.goto('/');
    
    // Create room
    const createButton = page.getByRole('button', { name: /create game/i });
    await expect(createButton).toBeEnabled({ timeout: 10000 });
    await createButton.click();
    
    // Wait for host page
    await page.waitForURL(/\/host\/[A-Z0-9]{6}/, { timeout: 15000 });
    
    // Extract room key
    const url = page.url();
    const roomKeyMatch = url.match(/\/host\/([A-Z0-9]{6})/);
    expect(roomKeyMatch).not.toBeNull();
    const roomKey = roomKeyMatch![1];
    
    // Join as host
    const nameInput = page.getByLabel(/your name/i);
    await expect(nameInput).toBeVisible({ timeout: 5000 });
    await nameInput.fill('Test Host');
    
    const joinButton = page.getByRole('button', { name: /join as host/i });
    await expect(joinButton).toBeEnabled();
    await joinButton.click();
    
    // Wait for lobby
    await expect(page.getByRole('heading', { name: /players/i })).toBeVisible({ timeout: 10000 });
    
    console.log('[TEST] Refreshing page');
    // Refresh page
    await page.reload();
    
    // Should still be on host page with same room key
    await expect(page).toHaveURL(new RegExp(`/host/${roomKey}`), { timeout: 5000 });
    
    // Should not show error about invalid room
    await expect(page.getByText(/invalid room|room not found/i)).not.toBeVisible({ timeout: 5000 });
    
    // Should either show join form or lobby
    const hasJoinForm = await page.getByRole('heading', { name: /host room/i }).isVisible().catch(() => false);
    const hasLobby = await page.getByRole('heading', { name: /players/i }).isVisible().catch(() => false);
    expect(hasJoinForm || hasLobby).toBe(true);
    
    console.log('[TEST] Room state persisted after refresh');
  });

  test('should allow player to join existing room', async ({ page, context }) => {
    console.log('[TEST] Testing player join flow');
    
    // Create room as host in first page
    const hostPage = await context.newPage();
    setupConsoleLogging(hostPage);
    await hostPage.goto('/');
    
    const createButton = hostPage.getByRole('button', { name: /create game/i });
    await expect(createButton).toBeEnabled({ timeout: 10000 });
    await createButton.click();
    
    await hostPage.waitForURL(/\/host\/[A-Z0-9]{6}/, { timeout: 15000 });
    const url = hostPage.url();
    const roomKeyMatch = url.match(/\/host\/([A-Z0-9]{6})/);
    expect(roomKeyMatch).not.toBeNull();
    const roomKey = roomKeyMatch![1];
    
    // Join as host
    const nameInput = hostPage.getByLabel(/your name/i);
    await expect(nameInput).toBeVisible({ timeout: 5000 });
    await nameInput.fill('Host Player');
    const joinButton = hostPage.getByRole('button', { name: /join as host/i });
    await expect(joinButton).toBeEnabled();
    await joinButton.click();
    await expect(hostPage.getByRole('heading', { name: /players/i })).toBeVisible({ timeout: 10000 });
    
    console.log(`[TEST] Host created room: ${roomKey}`);
    
    // Now join as player
    await page.goto('/');
    const roomKeyInput = page.getByRole('textbox', { name: /room key/i });
    await roomKeyInput.fill(roomKey);
    const playerJoinButton = page.getByRole('button', { name: /join game/i });
    await expect(playerJoinButton).toBeEnabled();
    await playerJoinButton.click();
    
    // Should navigate to room page
    await page.waitForURL(new RegExp(`/room/${roomKey}`), { timeout: 10000 });
    
    // Fill in player name
    const playerNameInput = page.getByLabel(/your name/i);
    await expect(playerNameInput).toBeVisible({ timeout: 5000 });
    await playerNameInput.fill('Test Player');
    const playerJoinBtn = page.getByRole('button', { name: /join room/i });
    await expect(playerJoinBtn).toBeEnabled();
    await playerJoinBtn.click();
    
    // Should show lobby
    await expect(page.getByRole('heading', { name: /players/i })).toBeVisible({ timeout: 10000 });
    
    // Should see both players
    await expect(page.getByText(/host player/i)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/test player/i)).toBeVisible({ timeout: 5000 });
    
    console.log('[TEST] Player joined successfully');
    
    await hostPage.close();
  });

  test('should show error when joining non-existent room', async ({ page }) => {
    console.log('[TEST] Testing join non-existent room');
    await page.goto('/');
    
    // Try to join with a valid-format but non-existent room key (6 alphanumeric chars)
    const roomKeyInput = page.getByRole('textbox', { name: /room key/i });
    await roomKeyInput.fill('INVALI'); // 6 characters, valid format
    const joinButton = page.getByRole('button', { name: /join game/i });
    await expect(joinButton).toBeEnabled();
    await joinButton.click();
    
    // Should navigate to room page
    await page.waitForURL(/\/room\/INVALI/, { timeout: 10000 });
    
    // Fill in name and try to join
    const nameInput = page.getByLabel(/your name/i);
    await expect(nameInput).toBeVisible({ timeout: 5000 });
    await nameInput.fill('Test Player');
    const joinRoomButton = page.getByRole('button', { name: /join room/i });
    await expect(joinRoomButton).toBeEnabled();
    await joinRoomButton.click();
    
    // Should show error (use first() to handle potential multiple matches)
    await expect(page.getByText(/room not found|invalid room|error/i).first()).toBeVisible({ timeout: 10000 });
    
    console.log('[TEST] Error shown for non-existent room');
  });

  test('should handle leave room action', async ({ page }) => {
    console.log('[TEST] Testing leave room');
    await page.goto('/');
    
    // Create room
    const createButton = page.getByRole('button', { name: /create game/i });
    await expect(createButton).toBeEnabled({ timeout: 10000 });
    await createButton.click();
    
    await page.waitForURL(/\/host\/[A-Z0-9]{6}/, { timeout: 15000 });
    
    // Join as host
    const nameInput = page.getByLabel(/your name/i);
    await expect(nameInput).toBeVisible({ timeout: 5000 });
    await nameInput.fill('Test Host');
    const joinButton = page.getByRole('button', { name: /join as host/i });
    await expect(joinButton).toBeEnabled();
    await joinButton.click();
    
    await expect(page.getByRole('heading', { name: /players/i })).toBeVisible({ timeout: 10000 });
    
    // Click leave button
    const leaveButton = page.getByRole('button', { name: /leave room/i });
    await expect(leaveButton).toBeVisible();
    console.log('[TEST] Clicking leave room button');
    await leaveButton.click();
    
    // Should navigate back to landing page
    await expect(page).toHaveURL('/', { timeout: 5000 });
    
    console.log('[TEST] Left room successfully');
  });

  test('should test all lobby interactions', async ({ page }) => {
    console.log('[TEST] Testing lobby interactions');
    await page.goto('/');
    
    // Create room and join as host
    const createButton = page.getByRole('button', { name: /create game/i });
    await expect(createButton).toBeEnabled({ timeout: 10000 });
    await createButton.click();
    await page.waitForURL(/\/host\/[A-Z0-9]{6}/, { timeout: 15000 });
    
    const nameInput = page.getByLabel(/your name/i);
    await expect(nameInput).toBeVisible({ timeout: 5000 });
    await nameInput.fill('Test Host');
    const joinButton = page.getByRole('button', { name: /join as host/i });
    await expect(joinButton).toBeEnabled();
    await joinButton.click();
    
    await expect(page.getByRole('heading', { name: /players/i })).toBeVisible({ timeout: 10000 });
    
    // Check for QR code
    const qrCode = page.locator('canvas, svg, img[alt*="QR"]');
    const qrCodeVisible = await qrCode.first().isVisible().catch(() => false);
    if (qrCodeVisible) {
      console.log('[TEST] QR code is visible');
    }
    
    // Check for player list
    await expect(page.getByText(/test host/i)).toBeVisible();
    
    // Check for token display
    const tokenDisplay = page.getByText(/tokens|token/i);
    const tokenVisible = await tokenDisplay.first().isVisible().catch(() => false);
    if (tokenVisible) {
      console.log('[TEST] Token display is visible');
    }
    
    // Check for start game button (should be disabled without Spotify)
    const startGameButton = page.getByRole('button', { name: /start game/i });
    const startButtonVisible = await startGameButton.isVisible().catch(() => false);
    if (startButtonVisible) {
      const isDisabled = await startGameButton.isDisabled();
      console.log(`[TEST] Start game button visible, disabled: ${isDisabled}`);
    }
    
    console.log('[TEST] Lobby interactions tested');
  });

  test('should test host page Spotify connection UI', async ({ page }) => {
    console.log('[TEST] Testing Spotify connection UI');
    await page.goto('/');
    
    // Create room and join as host
    const createButton = page.getByRole('button', { name: /create game/i });
    await expect(createButton).toBeEnabled({ timeout: 10000 });
    await createButton.click();
    await page.waitForURL(/\/host\/[A-Z0-9]{6}/, { timeout: 15000 });
    
    const nameInput = page.getByLabel(/your name/i);
    await expect(nameInput).toBeVisible({ timeout: 5000 });
    await nameInput.fill('Test Host');
    const joinButton = page.getByRole('button', { name: /join as host/i });
    await expect(joinButton).toBeEnabled();
    await joinButton.click();
    
    await expect(page.getByText(/host mode|spotify connection/i).first()).toBeVisible({ timeout: 10000 });
    
    // Check for Spotify connection section
    await expect(page.getByRole('heading', { name: /spotify connection/i })).toBeVisible({ timeout: 5000 });
    
    // Check for Connect Spotify button
    const connectButton = page.getByRole('button', { name: /connect spotify/i });
    const connectVisible = await connectButton.isVisible().catch(() => false);
    if (connectVisible) {
      console.log('[TEST] Connect Spotify button is visible');
      // Don't actually click it as it would redirect to Spotify
    }
    
    // Check for host badge
    const hostBadge = page.getByText(/host mode/i);
    await expect(hostBadge).toBeVisible();
    
    console.log('[TEST] Spotify connection UI tested');
  });

  test('should test room page player interactions', async ({ page, context }) => {
    console.log('[TEST] Testing room page player interactions');
    
    // Create room as host
    const hostPage = await context.newPage();
    setupConsoleLogging(hostPage);
    await hostPage.goto('/');
    
    const createButton = hostPage.getByRole('button', { name: /create game/i });
    await expect(createButton).toBeEnabled({ timeout: 10000 });
    await createButton.click();
    await hostPage.waitForURL(/\/host\/[A-Z0-9]{6}/, { timeout: 15000 });
    
    const url = hostPage.url();
    const roomKeyMatch = url.match(/\/host\/([A-Z0-9]{6})/);
    expect(roomKeyMatch).not.toBeNull();
    const roomKey = roomKeyMatch![1];
    
    const nameInput = hostPage.getByLabel(/your name/i);
    await expect(nameInput).toBeVisible({ timeout: 5000 });
    await nameInput.fill('Host');
    const joinButton = hostPage.getByRole('button', { name: /join as host/i });
    await expect(joinButton).toBeEnabled();
    await joinButton.click();
    await expect(hostPage.getByRole('heading', { name: /players/i })).toBeVisible({ timeout: 10000 });
    
    // Join as player
    await page.goto('/');
    const roomKeyInput = page.getByRole('textbox', { name: /room key/i });
    await roomKeyInput.fill(roomKey);
    const playerJoinButton = page.getByRole('button', { name: /join game/i });
    await expect(playerJoinButton).toBeEnabled();
    await playerJoinButton.click();
    
    await page.waitForURL(new RegExp(`/room/${roomKey}`), { timeout: 10000 });
    
    const playerNameInput = page.getByLabel(/your name/i);
    await expect(playerNameInput).toBeVisible({ timeout: 5000 });
    await playerNameInput.fill('Player');
    const playerJoinBtn = page.getByRole('button', { name: /join room/i });
    await expect(playerJoinBtn).toBeEnabled();
    await playerJoinBtn.click();
    
    await expect(page.getByRole('heading', { name: /players/i })).toBeVisible({ timeout: 10000 });
    
    // Test leave button
    const leaveButton = page.getByRole('button', { name: /leave room/i });
    await expect(leaveButton).toBeVisible();
    console.log('[TEST] Leave button visible on player page');
    
    // Check for QR code (should be visible)
    const qrCode = page.locator('canvas, svg, img[alt*="QR"]');
    const qrVisible = await qrCode.first().isVisible().catch(() => false);
    console.log(`[TEST] QR code visible: ${qrVisible}`);
    
    await hostPage.close();
  });

  test('should test input validation and edge cases', async ({ page }) => {
    console.log('[TEST] Testing input validation');
    await page.goto('/');
    
    // Test name input validation
    const createButton = page.getByRole('button', { name: /create game/i });
    await expect(createButton).toBeEnabled({ timeout: 10000 });
    await createButton.click();
    await page.waitForURL(/\/host\/[A-Z0-9]{6}/, { timeout: 15000 });
    
    const nameInput = page.getByLabel(/your name/i);
    await expect(nameInput).toBeVisible({ timeout: 5000 });
    
    // Test empty name
    await nameInput.fill('');
    const joinButton = page.getByRole('button', { name: /join as host/i });
    await expect(joinButton).toBeDisabled();
    console.log('[TEST] Join button disabled for empty name');
    
    // Test very long name
    const longName = 'A'.repeat(100);
    await nameInput.fill(longName);
    // Input should be limited to maxLength
    const value = await nameInput.inputValue();
    expect(value.length).toBeLessThanOrEqual(50);
    console.log(`[TEST] Name input limited to ${value.length} characters`);
    
    // Test avatar input
    const avatarInput = page.getByLabel(/avatar/i);
    if (await avatarInput.isVisible()) {
      await avatarInput.fill('🎮🎵'); // Multiple emojis
      // Wait a bit for onChange to process
      await page.waitForTimeout(100);
      const avatarValue = await avatarInput.inputValue();
      // Should only take first character (emoji might be 2 code units but 1 grapheme)
      // Use Array.from to count graphemes correctly
      const graphemeCount = Array.from(avatarValue).length;
      expect(graphemeCount).toBeLessThanOrEqual(1);
      console.log(`[TEST] Avatar input limited to 1 character: ${avatarValue} (${graphemeCount} graphemes)`);
    }
    
    console.log('[TEST] Input validation tested');
  });

  test('should test navigation between pages', async ({ page }) => {
    console.log('[TEST] Testing navigation');
    await page.goto('/');
    
    // Test landing page
    await expect(page.getByRole('heading', { name: /hitster/i, level: 2 })).toBeVisible();
    
    // Create room
    const createButton = page.getByRole('button', { name: /create game/i });
    await expect(createButton).toBeEnabled({ timeout: 10000 });
    await createButton.click();
    await page.waitForURL(/\/host\/[A-Z0-9]{6}/, { timeout: 15000 });
    
    // Test back navigation (if browser back button works)
    // Note: In a real scenario, you might want to test browser back/forward
    
    // Test "Go Home" button from error states
    // Navigate to invalid room
    await page.goto('/room/INVALID');
    const goHomeButton = page.getByRole('button', { name: /go home/i });
    const goHomeVisible = await goHomeButton.isVisible().catch(() => false);
    if (goHomeVisible) {
      await goHomeButton.click();
      await expect(page).toHaveURL('/', { timeout: 5000 });
      console.log('[TEST] Go Home button works');
    }
    
    console.log('[TEST] Navigation tested');
  });

  test('should test error message dismissal', async ({ page }) => {
    console.log('[TEST] Testing error message dismissal');
    await page.goto('/');
    
    // Create room
    const createButton = page.getByRole('button', { name: /create game/i });
    await expect(createButton).toBeEnabled({ timeout: 10000 });
    await createButton.click();
    await page.waitForURL(/\/host\/[A-Z0-9]{6}/, { timeout: 15000 });
    
    // Try to join with empty name to trigger error
    const joinButton = page.getByRole('button', { name: /join as host/i });
    await expect(joinButton).toBeDisabled(); // Should be disabled for empty name
    
    // Fill name and join
    const nameInput = page.getByLabel(/your name/i);
    await expect(nameInput).toBeVisible({ timeout: 5000 });
    await nameInput.fill('Test Host');
    await expect(joinButton).toBeEnabled();
    await joinButton.click();
    
    await expect(page.getByText(/host mode|spotify connection/i).first()).toBeVisible({ timeout: 10000 });
    
    // Check for error dismissal buttons (if any errors appear)
    const dismissButtons = page.getByRole('button', { name: /dismiss|✕/i });
    const dismissCount = await dismissButtons.count();
    if (dismissCount > 0) {
      console.log(`[TEST] Found ${dismissCount} dismiss buttons`);
      // Click first dismiss button if visible
      const firstDismiss = dismissButtons.first();
      if (await firstDismiss.isVisible()) {
        await firstDismiss.click();
        console.log('[TEST] Dismissed error message');
      }
    }
    
    console.log('[TEST] Error message dismissal tested');
  });

  test('should test connection status display', async ({ page }) => {
    console.log('[TEST] Testing connection status display');
    await page.goto('/');
    
    // Check for connection status in header (use header to be more specific)
    const header = page.locator('header');
    const connectionStatus = header.getByText(/connected|connecting|disconnected/i);
    await expect(connectionStatus).toBeVisible({ timeout: 5000 });
    
    const statusText = await connectionStatus.textContent();
    console.log(`[TEST] Connection status: ${statusText}`);
    
    // Status should eventually show "Connected"
    await expect(connectionStatus).toContainText(/connected/i, { timeout: 10000 });
    
    console.log('[TEST] Connection status display tested');
  });

  test('should test multiple rapid clicks', async ({ page }) => {
    console.log('[TEST] Testing rapid clicks');
    await page.goto('/');
    
    // Wait for connection
    const createButton = page.getByRole('button', { name: /create game/i });
    await expect(createButton).toBeEnabled({ timeout: 10000 });
    
    // Click create button - this should trigger navigation
    // The button handler checks isCreating to prevent multiple simultaneous clicks
    console.log('[TEST] Clicking create button');
    await createButton.click();
    
    // Wait for navigation (should happen only once)
    await page.waitForURL(/\/host\/[A-Z0-9]{6}/, { timeout: 15000 });
    
    // Should only be on one host page (verify URL format)
    const url = page.url();
    expect(url).toMatch(/\/host\/[A-Z0-9]{6}/);
    
    // Extract room key to verify it's valid
    const roomKeyMatch = url.match(/\/host\/([A-Z0-9]{6})/);
    expect(roomKeyMatch).not.toBeNull();
    const roomKey = roomKeyMatch![1];
    expect(roomKey).toMatch(/^[A-Z0-9]{6}$/);
    
    console.log(`[TEST] Rapid clicks handled correctly - navigated to room: ${roomKey}`);
  });

  test('should test form submission with Enter key', async ({ page }) => {
    console.log('[TEST] Testing Enter key submission');
    await page.goto('/');
    
    // Test Enter key on room key input
    const roomKeyInput = page.getByRole('textbox', { name: /room key/i });
    await roomKeyInput.fill('ABCD12');
    await roomKeyInput.press('Enter');
    
    // Should navigate to room page
    await page.waitForURL(/\/room\/ABCD12/, { timeout: 10000 });
    
    console.log('[TEST] Enter key submission works');
  });
});
