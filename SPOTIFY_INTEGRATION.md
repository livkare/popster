# Spotify Integration - Complete Flow Documentation

This document explains the complete flow of how Spotify Web Playback SDK integration works in this application, from authentication to playing a song.

## Overview

The application uses Spotify's Web Playback SDK to play music on the host's computer. The host tab is the ONLY device that plays audio - all other devices (phones) are controllers only. This follows Spotify's terms of service and ensures we never restream or proxy audio.

## Architecture

- **Host Tab**: Loads Spotify SDK, authenticates, initializes player, plays audio
- **Server**: Manages game state, selects tracks from playlist, sends playback commands
- **Player Devices**: Controllers only - no audio playback, no Spotify auth

## Complete Flow: From Zero to Playing Music

### Step 1: User Authentication (OAuth Flow)

**File**: `apps/web/src/hooks/useSpotifyAuth.ts`

1. User clicks "Connect Spotify" button
2. Application generates OAuth URL with required scopes:
   - `streaming` - Required for Web Playback SDK
   - `user-read-playback-state` - Read current playback state
   - `user-modify-playback-state` - Control playback (play/pause/seek)
   - `user-read-email` - Check Premium status
3. User is redirected to Spotify authorization page
4. User authorizes the application
5. Spotify redirects back to `/callback` with authorization code
6. Frontend sends code to server (`POST /api/spotify/token`)
7. Server exchanges code for access/refresh tokens
8. Tokens are stored in IndexedDB (host tab only)

**Key Point**: Only the host tab performs OAuth. Player devices never authenticate with Spotify.

---

### Step 2: SDK Loading and Player Initialization

**File**: `apps/web/src/lib/spotify-player.ts`

When the host is authenticated:

1. **Load SDK Script**:
   ```javascript
   // Dynamically loads https://sdk.scdn.co/spotify-player.js
   await loadSpotifySDK();
   ```

2. **Create Player Instance**:
   ```javascript
   const player = new window.Spotify.Player({
     name: "Hitster Player (timestamp)", // Unique name to avoid conflicts
     getOAuthToken: (callback) => {
       callback(accessToken); // Provides token when SDK needs it
     },
     volume: 0.5,
   });
   ```

3. **Connect Player**:
   ```javascript
   await player.connect();
   ```
   This registers the player with Spotify's backend but doesn't make it active yet.

4. **Wait for Ready Event**:
   ```javascript
   player.addListener("ready", ({ device_id }) => {
     // SDK provides device_id
     // This device_id may not immediately appear in REST API device list
   });
   ```

**Key Point**: At this stage, the device is registered with Spotify SDK but:
- Not yet active in Spotify's REST API device list
- Not ready for playback commands
- Needs user interaction to activate (browser autoplay restrictions)

---

### Step 3: Device Activation (User Interaction Required)

**File**: `apps/web/src/hooks/useSpotifyPlayer.ts` → `activateDevice()`

**Why Activation is Needed**:
- Browser autoplay restrictions require user interaction
- Device must appear in Spotify's REST API device list
- Device must become "active" to receive playback commands

**Activation Flow**:

1. **User Clicks "Activate Player" Button**:
   - This is a user interaction event (required for autoplay)

2. **Call `activateElement()`**:
   ```javascript
   await player.activateElement();
   ```
   - Handles browser autoplay restrictions
   - Makes the device available for playback
   - Does NOT make it active in REST API yet

3. **Wait for Device in API List**:
   ```javascript
   const foundDeviceId = await waitForDeviceInList(deviceId, accessToken);
   ```
   - Polls `/me/player/devices` endpoint
   - Looks for device by exact ID match
   - Falls back to finding by name ("Hitster Player") if ID doesn't match
   - **Critical**: SDK device_id from "ready" event may differ from API device_id
   - Returns the actual API device_id (may be different from SDK device_id)

4. **Transfer Playback to Device**:
   ```javascript
   await transferToHostDevice(foundDeviceId, accessToken, false);
   ```
   - Makes PUT request to `/me/player` with `device_ids: [foundDeviceId]`
   - This makes the device "active" in Spotify's system
   - Now the device can receive playback commands

5. **Verify Device is Active**:
   ```javascript
   const deviceActive = await waitForActiveDevice(foundDeviceId, accessToken);
   ```
   - Polls `/me/player/devices` until device has `is_active: true`
   - Confirms device is ready for playback

6. **Update Store**:
   - If device_id changed (SDK vs API mismatch), update store with correct ID
   - Set `isActivated = true`

**Key Point**: Activation is a multi-step process:
- SDK activation (browser autoplay) → API device appears → Transfer → Device active

---

### Step 4: Game Starts - Track Selection

**File**: `apps/server/src/game/handlers.ts` → `handleStartRound()`

1. Host clicks "Start Game"
2. Client sends `START_ROUND` message (no trackUri)
3. Server:
   - Gets playlist tracks from database
   - Initializes shuffled playlist in memory
   - Calls `gameStateManager.getNextTrack(roomId)`
   - Gets first track from shuffled playlist
   - Creates new round with that track
   - Broadcasts `START_SONG` message to all clients

**File**: `apps/server/src/game/game-state-manager.ts`

- Tracks remaining tracks per room
- Returns next track and removes it from queue
- Handles track shuffling

---

### Step 5: Playback Command Received

**File**: `apps/web/src/hooks/useSpotifyPlayer.ts` → `handleStartSong()`

1. **WebSocket Receives START_SONG**:
   ```javascript
   {
     type: "START_SONG",
     payload: {
       trackUri: "spotify:track:...",
       positionMs: 0
     }
   }
   ```

2. **Verify Prerequisites**:
   - Check `isReady` (player initialized)
   - Check `isActivated` (device activated)
   - Check `accessToken` exists
   - Check `deviceId` exists

3. **Call Play Function**:
   ```javascript
   await play(trackUri, positionMs);
   ```

---

### Step 6: Playback Execution

**File**: `apps/web/src/hooks/useSpotifyPlayer.ts` → `play()`

1. **Get Current Device ID**:
   ```javascript
   const currentDeviceId = useSpotifyStore.getState().deviceId;
   ```
   - Gets latest deviceId from store (may have changed during activation)
   - Ensures we use the correct device ID

2. **Verify Device Still Active**:
   ```javascript
   const deviceActive = await waitForActiveDevice(currentDeviceId, accessToken, 2, 500);
   ```
   - Quick check (2 attempts) to verify device is still active
   - Device may have gone inactive between activation and playback

3. **Reactivate if Needed**:
   ```javascript
   if (!deviceActive) {
     await transferToHostDevice(currentDeviceId, accessToken, false);
   }
   ```
   - If device went inactive, transfer again to reactivate

4. **Call API Play Function**:
   ```javascript
   await playTrack(trackUri, positionMs, accessToken, currentDeviceId);
   ```

---

### Step 7: Spotify API Playback

**File**: `apps/web/src/lib/spotify-api.ts` → `playTrack()`

1. **Final Device Check**:
   ```javascript
   let deviceActive = await waitForActiveDevice(deviceId, accessToken, 2, 500);
   ```
   - Verify device is active one more time
   - If not active, attempt transfer again

2. **Transfer if Needed**:
   ```javascript
   if (!deviceActive) {
     await transferToHostDevice(deviceId, accessToken, false);
     await new Promise(resolve => setTimeout(resolve, 500));
     deviceActive = await waitForActiveDevice(deviceId, accessToken, 3, 500);
   }
   ```
   - Last chance to activate device before playback

3. **Play Track via REST API**:
   ```javascript
   const response = await fetch(
     `https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`,
     {
       method: "PUT",
       headers: {
         Authorization: `Bearer ${accessToken}`,
         "Content-Type": "application/json",
       },
       body: JSON.stringify({
         uris: [trackUri],
         position_ms: positionMs,
       }),
     }
   );
   ```

4. **Handle Response**:
   - 200 OK: Playback started successfully
   - 401: Token expired - need to refresh
   - 403: Premium required or forbidden
   - 404: No active device - device not found or not active

**Key Point**: We use REST API (`/me/player/play`) not SDK methods because:
- REST API gives us more control
- Can specify exact device
- Better error handling
- SDK methods are for local control, REST API is for remote control

---

## Device ID Mismatch Issue (Why We Need Fallbacks)

**The Problem**:
- SDK's "ready" event provides a `device_id`
- This device_id may NOT immediately appear in `/me/player/devices` API response
- Or the API may return a different device_id for the same device
- This is a known quirk of Spotify's Web Playback SDK

**Our Solution**:
1. Try exact match first (SDK device_id)
2. If not found, try finding by name ("Hitster Player")
3. Use whichever device_id we find in the API
4. Update store with correct device_id
5. Use that device_id for all subsequent operations

**Why This Works**:
- The device name is consistent
- The most recent "Hitster Player" device is usually the one we just created
- Once we find it, we use that ID going forward

---

## State Management

**Spotify Store** (`apps/web/src/store/spotify-store.ts`):
- `isAuthenticated`: OAuth completed
- `isPremium`: User has Premium (required for playback)
- `deviceId`: Current device ID (may change during activation)
- `accessToken`: OAuth access token
- `refreshToken`: OAuth refresh token (for token renewal)
- `error`: Current error message

**Player State** (`apps/web/src/hooks/useSpotifyPlayer.ts`):
- `isReady`: SDK initialized and connected
- `isActivated`: Device activated and active in API
- `isInitializing`: Currently initializing SDK
- `isActivating`: Currently activating device

**Flow**:
```
Not Authenticated → Authenticated → Ready → Activated → Playing
     (OAuth)         (SDK Init)    (User Click)   (START_SONG)
```

---

## Error Handling

**Common Errors and Solutions**:

1. **"Device not active"**:
   - Device went inactive between activation and playback
   - Solution: Automatically reactivate before playing

2. **"Device not found"**:
   - Device ID mismatch between SDK and API
   - Solution: Find device by name as fallback

3. **"No active device" (404)**:
   - Device not in API device list yet
   - Solution: Wait longer, or transfer anyway (sometimes works)

4. **"Authentication expired" (401)**:
   - Access token expired
   - Solution: Refresh token (not yet implemented, but structure is there)

5. **"Forbidden" (403)**:
   - Not Premium, or missing scopes
   - Solution: Check Premium status, verify scopes

---

## Key Design Decisions

1. **Why User-Triggered Activation?**
   - Browser autoplay policies require user interaction
   - `activateElement()` must be called in response to user click
   - Cannot be called during initialization

2. **Why Transfer Playback?**
   - `activateElement()` only handles browser restrictions
   - To make device "active" in Spotify's system, we must transfer playback
   - Transfer makes device the active target for REST API commands

3. **Why Check Device State Multiple Times?**
   - Device can go inactive between operations
   - Network delays can cause timing issues
   - Multiple checks ensure robustness

4. **Why Use REST API Instead of SDK Methods?**
   - REST API gives better control and error messages
   - Can specify exact device
   - SDK methods are more for local UI control

5. **Why Store Device ID in Zustand?**
   - Device ID may change during activation
   - Need to update it and have all callbacks use latest value
   - Zustand provides reactive state management

---

## Complete Sequence Diagram

```
User → Click "Connect Spotify"
  → OAuth Flow
  → Tokens Stored
  → SDK Loads
  → Player Connects
  → Ready Event (device_id received)
  → UI Shows "Activate Player" Button

User → Click "Activate Player"
  → activateElement() (browser autoplay)
  → Wait for device in API list
  → Transfer playback to device
  → Verify device is active
  → UI Shows "Player Activated"

User → Click "Start Game"
  → Server selects track from playlist
  → Server broadcasts START_SONG
  → Host receives START_SONG
  → Verify device still active
  → Call playTrack()
  → PUT /me/player/play
  → Music plays! 🎵
```

---

## Files Involved

**Authentication**:
- `apps/web/src/hooks/useSpotifyAuth.ts` - OAuth flow
- `apps/web/src/lib/spotify-oauth.ts` - OAuth utilities
- `apps/server/src/routes/spotify.ts` - Token exchange

**SDK Management**:
- `apps/web/src/lib/spotify-player.ts` - SDK loading and initialization
- `apps/web/src/hooks/useSpotifyPlayer.ts` - Player state and playback control

**API Communication**:
- `apps/web/src/lib/spotify-api.ts` - REST API calls (play, pause, transfer, etc.)

**UI**:
- `apps/web/src/pages/HostPage.tsx` - Host interface with activation button
- `apps/web/src/components/game/GameScreen.tsx` - Game UI with playback controls

**State**:
- `apps/web/src/store/spotify-store.ts` - Spotify authentication and device state

**Server**:
- `apps/server/src/game/handlers.ts` - Game logic, track selection
- `apps/server/src/game/game-state-manager.ts` - Playlist management

---

## Testing the Flow

1. **Connect Spotify**: Should see OAuth redirect, return with tokens
2. **Player Initializes**: Should see "Player Ready - Activation Required"
3. **Activate Player**: Click button, should see "Player Activated"
4. **Start Game**: Select playlist, start game
5. **Music Plays**: Should hear audio from computer speakers

**Debug Checklist**:
- [ ] OAuth completes successfully
- [ ] Tokens stored in IndexedDB
- [ ] SDK loads without errors
- [ ] Player connects and receives device_id
- [ ] Device appears in API device list
- [ ] Transfer succeeds
- [ ] Device shows as active
- [ ] START_SONG message received
- [ ] Play API call succeeds (200 OK)
- [ ] Audio plays from speakers

---

## Troubleshooting

**No Sound After Activation**:
- Check browser console for errors
- Verify device is actually active: `is_active: true` in device list
- Try clicking "Next Card" to trigger playback again
- Check browser volume and system volume

**Device Not Appearing in List**:
- Wait longer (can take 10-20 seconds)
- Check if device appears with different ID (check by name)
- Try disconnecting and reconnecting

**Playback Fails with 404**:
- Device not active - try reactivating
- Device ID mismatch - check console for actual device IDs
- Token expired - may need to reconnect

**403 Forbidden**:
- Not Premium - check Premium status
- Missing scopes - verify OAuth scopes include all required ones

---

## Play/Pause and Resume Functionality

**File**: `apps/web/src/hooks/useSpotifyPlayer.ts` → `play()` and `pausePlayback()`

The application implements robust play/pause functionality with automatic resume from the last paused position. This is critical for game flow where players may pause to place cards.

### How Resume Works

**Key Principle**: When resuming the same track that was paused, we use Spotify's resume API (calling `/me/player/play` without `uris`) which automatically resumes from the paused position. This is more reliable than manually tracking and setting position.

### Position Tracking

The application maintains position state in multiple ways for reliability:

1. **`currentTrackRef` (Primary Source)**:
   - Stores `{ uri: string, position: number }` for the current track
   - Updated continuously via `player_state_changed` events
   - Persists even when SDK state is unavailable
   - Never cleared when paused (kept for resume)

2. **SDK State (`getCurrentState()`)**:
   - Most accurate position when available
   - Can return `null` when paused (this is expected)
   - Used as primary source when available

3. **State Changed Handler**:
   - Continuously updates `currentTrackRef` as track plays
   - Saves position even when paused
   - Logs position saves for debugging

### Pause Flow

**File**: `apps/web/src/hooks/useSpotifyPlayer.ts` → `pausePlayback()`

1. **Prevent Rapid Toggling**:
   ```javascript
   if (isTogglingRef.current) {
     return; // Ignore if already toggling
   }
   isTogglingRef.current = true;
   ```

2. **Save Position (Multiple Attempts)**:
   - **Attempt 1**: Try `getCurrentState()` before pausing
     - If successful, save position immediately
   - **Fallback**: If `getCurrentState()` returns `null`, use saved state from `currentTrackRef`
     - This handles cases where SDK state is unavailable
   - **Retry**: After calling pause API, wait 100ms and retry `getCurrentState()`
     - Sometimes state becomes available after pause completes

3. **Call Pause API**:
   ```javascript
   await pause(accessToken); // PUT /me/player/pause
   ```

4. **Log State**:
   - Logs whether position was saved
   - Shows saved state for debugging

5. **Reset Toggle Lock**:
   - After 300ms delay, allow toggling again

**Key Point**: Position is saved through multiple mechanisms to ensure it's always available for resume, even if SDK state is temporarily unavailable.

### Play/Resume Flow

**File**: `apps/web/src/hooks/useSpotifyPlayer.ts` → `play()`

1. **Prevent Rapid Toggling**:
   ```javascript
   if (isTogglingRef.current) {
     return; // Ignore if already toggling
   }
   isTogglingRef.current = true;
   ```

2. **Check for Saved State**:
   ```javascript
   const hasSavedState = currentTrackRef.current?.uri === trackUri && 
                        currentTrackRef.current.position !== undefined;
   ```

3. **Determine Resume Strategy**:
   - **If SDK state available**:
     - Check if same track is currently paused
     - If yes → use resume API (`isResume = true`)
     - If no → play with `uris` and saved position
   - **If SDK state unavailable (`null`)**:
     - Check if we have saved state for same track
     - If yes → use resume API (`isResume = true`)
     - If no → start from beginning

4. **Handle Explicit Position**:
   ```javascript
   if (positionMs !== undefined) {
     // Explicit position provided (e.g., from START_SONG message)
     positionToUse = positionMs;
     shouldResume = false; // Don't use resume API
   }
   ```

5. **Initialize Track Ref**:
   ```javascript
   // After playing, ensure track ref is initialized
   if (!currentTrackRef.current || currentTrackRef.current.uri !== trackUri) {
     currentTrackRef.current = {
       uri: trackUri,
       position: positionToUse || 0,
     };
   }
   ```

6. **Call Play API**:
   ```javascript
   await playTrack(trackUri, positionToUse, accessToken, deviceId, shouldResume);
   ```

### Resume API Implementation

**File**: `apps/web/src/lib/spotify-api.ts` → `playTrack()`

When `isResume = true`:

1. **Call Resume API** (no `uris`):
   ```javascript
   const response = await fetch(
     `${SPOTIFY_API_BASE}/me/player/play?device_id=${deviceId}`,
     {
       method: "PUT",
       headers: {
         Authorization: `Bearer ${accessToken}`,
       },
       // No body - this tells Spotify to resume current track
     }
   );
   ```

2. **Handle Response**:
   - **200 OK**: Successfully resumed from paused position
   - **404**: No active playback to resume → fall through to play with `uris`
   - **Other errors**: Log and fall through to play with `uris`

3. **Fallback to Play with URIs**:
   ```javascript
   // If resume failed, play with uris and saved position
   const body = {
     uris: [trackUri],
     position_ms: positionMs, // Use saved position
   };
   ```

**Key Point**: According to Spotify API docs, calling `/me/player/play` without `uris` resumes the currently paused track from its paused position. This is more reliable than manually setting `position_ms`.

### State Changed Handler

**File**: `apps/web/src/hooks/useSpotifyPlayer.ts` → `stateChangedHandler`

The handler continuously updates position:

```javascript
player.addListener("player_state_changed", (state) => {
  if (state) {
    const currentTrack = state.track_window?.current_track;
    if (currentTrack) {
      currentTrackRef.current = {
        uri: currentTrack.uri,
        position: state.position || 0,
      };
      // Log when paused for debugging
      if (state.paused) {
        console.log("[Spotify Player] Position saved from state_changed (paused)");
      }
    }
  }
  // Never clear currentTrackRef when state is null - keep it for resume
});
```

**Key Point**: The handler always updates position, even when paused, ensuring we have the most recent position for resume.

### Edge Cases Handled

1. **SDK State Returns `null`**:
   - Use saved state from `currentTrackRef`
   - Still attempt resume if same track

2. **Position is 0**:
   - Still save it (might be start of track)
   - Resume will work correctly

3. **Rapid Toggle**:
   - 300ms cooldown prevents race conditions
   - Ignores rapid clicks

4. **State Not Available Before Pause**:
   - Retry after pause completes
   - Use state_changed handler's last known state

5. **Resume API Fails**:
   - Fall back to playing with `uris` and saved position
   - Ensures playback always works

### Logging for Debugging

The implementation includes comprehensive logging:

- `[Spotify Player] Saved position from getCurrentState() before pause:` - Position saved successfully
- `[Spotify Player] Using saved state from state_changed handler:` - Using fallback state
- `[Spotify Player] Saved position after pause (retry):` - Position saved on retry
- `[Spotify Player] Position saved from state_changed (paused):` - Handler saved position
- `[Spotify Player] Same track is paused, will resume from position:` - Resume detected
- `[Spotify Player] SDK state unavailable, but have saved state:` - Using saved state
- `[Spotify API] Attempting to resume playback (no uris)` - Resume API called
- `[Spotify API] Successfully resumed playback from paused position` - Resume succeeded

### Complete Resume Flow Example

```
User clicks Pause:
  → pausePlayback() called
  → Try getCurrentState() → returns { position: 45000, paused: false }
  → Save to currentTrackRef: { uri: "spotify:track:...", position: 45000 }
  → Call pause API
  → Retry getCurrentState() after 100ms (backup)
  → State changed handler fires with paused: true, position: 45000
  → Update currentTrackRef again (redundant but safe)

User clicks Play:
  → play() called
  → Check currentTrackRef: { uri: "spotify:track:...", position: 45000 }
  → Try getCurrentState() → returns null (paused)
  → Detect: same track, have saved state → shouldResume = true
  → Call playTrack(..., isResume: true)
  → Resume API called (no uris)
  → Spotify resumes from position 45000
  → Music continues from where it was paused! 🎵
```

### Key Design Decisions

1. **Why Multiple Position Save Attempts?**
   - `getCurrentState()` can return `null` when paused
   - State_changed handler might not fire immediately
   - Multiple attempts ensure position is always saved

2. **Why Use Resume API Instead of position_ms?**
   - More reliable (Spotify handles position internally)
   - Works even if position tracking has small errors
   - Follows Spotify's recommended approach

3. **Why Keep Track Ref When State is Null?**
   - State can be temporarily unavailable
   - We need position for resume even if SDK state is null
   - Never clear ref when paused

4. **Why 300ms Toggle Cooldown?**
   - Prevents race conditions from rapid clicks
   - Gives API calls time to complete
   - Improves stability

---

## Summary

The complete flow requires:
1. **OAuth Authentication** - Get access token
2. **SDK Initialization** - Load SDK, connect player, get device_id
3. **User Activation** - User clicks button → activateElement() → wait for device → transfer → verify active
4. **Track Selection** - Server picks next track from playlist
5. **Playback Command** - Server sends START_SONG message
6. **Playback Execution** - Verify device active → transfer if needed → call REST API play
7. **Audio Plays** - Spotify streams audio to host's computer
8. **Pause/Resume** - Position tracked continuously → pause saves position → resume uses Spotify's resume API

Each step has error handling and fallbacks to ensure robustness. The key insight is that activation is a multi-step process that requires both SDK-level activation (browser autoplay) and API-level activation (transfer playback to make device active). For resume, we use Spotify's native resume API which is more reliable than manually tracking position.

