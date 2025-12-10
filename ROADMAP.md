# Hitster Implementation Roadmap

**Project:** Hitster (Local-Only, Web) — Host-only Spotify playback  
**Architecture:** Monorepo with TypeScript, React PWA frontend, Node.js Fastify backend  
**Core Constraint:** Only the host browser tab plays audio via Spotify Web Playback SDK

---

## Overview

This roadmap is structured in 10 phases, each building upon the previous. Every phase includes:

- **Deliverables**: What will be built
- **Acceptance Criteria**: How to verify it works
- **Testing Strategy**: Unit, integration, or E2E tests
- **Dependencies**: What must be completed first

**Estimated Timeline**: 8-10 weeks (assuming 1 engineer, full-time)

## **always adhere to /Users/livkareborn/hitster-app/.cursorrules**

## Phase 0: Foundation & Monorepo Setup

**Goal**: Establish project structure, tooling, and development environment

**Deliverables**:

1. Monorepo structure (Turborepo or Nx)
2. TypeScript configuration (strict mode) for all packages
3. ESLint + Prettier setup with shared configs
4. Package.json structure with workspaces
5. Basic build scripts (Vite for web, tsup for server)
6. Git repository with `.gitignore` and initial commit

**Directory Structure**:

```
/
├── apps/
│   ├── server/          # Fastify + WebSocket server
│   └── web/              # React PWA frontend
├── packages/
│   ├── engine/           # Pure game logic (deterministic)
│   ├── proto/            # Zod schemas & message contracts
│   └── ui-kit/           # Shared UI components
├── package.json          # Root workspace config
├── turbo.json            # Turborepo config (or nx.json)
├── tsconfig.json         # Base TypeScript config
└── .eslintrc.js          # Shared ESLint config
```

**Testing Strategy**:

- ✅ Verify monorepo builds: `npm run build` succeeds for all packages
- ✅ Verify TypeScript compiles with strict mode
- ✅ Verify linting passes: `npm run lint`
- ✅ Verify formatting: `npm run format:check`

**Acceptance Criteria**:

- [ ] All packages compile with `tsc --noEmit`
- [ ] ESLint runs without errors
- [ ] Prettier formats code consistently
- [ ] `npm install` installs all dependencies correctly
- [ ] Workspace links resolve correctly

**Dependencies**: None (starting point)

---

## Phase 1: Shared Packages - Proto & Types

**Goal**: Define message contracts and shared types used across server and client

**Deliverables**:

1. `packages/proto` package with Zod schemas for all WebSocket messages
2. TypeScript types exported from Zod schemas
3. Message validation utilities
4. Unit tests for schema validation

**Core Messages** (from `.cursorrules`):

- `JOIN{name, avatar}`
- `SEAT{playerId}`
- `START_SONG{trackUri, positionMs?}`
- `PLACE{playerId, slotIndex}`
- `CHALLENGE{playerId, targetPlayerId, slotIndex}`
- `REVEAL{year}`
- `ROUND_SUMMARY{timeline, scores}`

**Additional Messages Needed**:

- `CREATE_ROOM{gameMode}` → `ROOM_CREATED{roomKey, roomId}`
- `JOIN_ROOM{roomKey, name, avatar}` → `JOINED{playerId, ...}`
- `LEAVE{playerId}`
- `ROOM_STATE{players, gameState, ...}`
- `ERROR{code, message}`
- `PONG` (for heartbeat)

**Testing Strategy**:

- ✅ Unit tests: Valid messages pass validation
- ✅ Unit tests: Invalid messages are rejected with clear errors
- ✅ Unit tests: Type inference works correctly (`z.infer<typeof JoinSchema>`)

**Acceptance Criteria**:

- [ ] All message schemas defined and exported
- [ ] 100% test coverage on schema validation
- [ ] Types can be imported in both server and web apps
- [ ] Invalid payloads are caught at runtime

**Dependencies**: Phase 0

---

## Phase 2: Game Engine (Pure Logic)

**Goal**: Implement deterministic game rules with zero side effects

**Deliverables**:

1. `packages/engine` package with pure TypeScript functions
2. Game state types (Game, Player, Card, Timeline, Round, etc.)
3. Reducer functions for game actions:
   - `joinPlayer(state, action)` → new state
   - `startRound(state, card)` → new state
   - `placeCard(state, playerId, slotIndex)` → new state
   - `challenge(state, challengerId, targetId, slotIndex)` → new state
   - `revealYear(state, year)` → new state
   - `calculateScore(state, playerId)` → number
   - `checkWinCondition(state)` → winner | null
4. Game mode logic (Original, Pro, Expert, Coop)
5. Token system logic
6. Comprehensive unit tests (target: 100% coverage)

**Key Functions**:

```typescript
// Pure functions, no I/O, no side effects
export function createGame(mode: GameMode): GameState;
export function joinPlayer(state: GameState, player: Player): GameState;
export function placeCard(state: GameState, action: PlaceAction): GameState;
export function challengePlacement(
  state: GameState,
  action: ChallengeAction
): GameState;
export function revealYear(state: GameState, year: number): GameState;
export function calculateRoundScore(state: GameState, playerId: string): number;
```

**Testing Strategy**:

- ✅ Unit tests: Reducers are pure (same input → same output)
- ✅ Unit tests: Game state transitions are correct
- ✅ Unit tests: Scoring logic matches rules
- ✅ Unit tests: Win conditions are detected
- ✅ Property-based tests (optional, using fast-check): Test invariants

**Acceptance Criteria**:

- [ ] All game rules implemented correctly
- [ ] 100% test coverage on engine package
- [ ] No browser or Node.js APIs imported (pure TypeScript only)
- [ ] Engine can be imported in both server and tests
- [ ] Game state is immutable (no mutations)

**Dependencies**: Phase 1 (for types)

---

## Phase 3: Server Foundation - HTTP & WebSocket

**Goal**: Set up Fastify server with WebSocket support and basic routing

**Deliverables**:

1. `apps/server` package with Fastify + `@fastify/websocket`
2. Basic HTTP server on configurable port (default: 5173)
3. WebSocket endpoint `/ws` with connection handling
4. Health check endpoint `GET /health`
5. Server info endpoint `GET /api/info` (returns server version, room count)
6. Connection/disconnection logging (Pino)
7. WebSocket message parsing and validation using `packages/proto`
8. Basic error handling middleware

**Architecture**:

- Fastify HTTP server
- WebSocket upgrade handler
- Connection manager (tracks active connections)
- Message router (validates with Zod, routes to handlers)

**Testing Strategy**:

- ✅ Integration tests: Server starts and listens on port
- ✅ Integration tests: WebSocket connection establishes
- ✅ Integration tests: Invalid messages are rejected
- ✅ Integration tests: Connection/disconnection events fire correctly

**Acceptance Criteria**:

- [ ] Server starts with `npm run dev` in `apps/server`
- [ ] WebSocket connection succeeds from a test client
- [ ] Invalid messages are rejected with error response
- [ ] Server logs connection events (Pino)
- [ ] Health endpoint returns 200 OK

**Dependencies**: Phase 1 (proto schemas)

---

## Phase 4: Room Management & Discovery

**Goal**: Implement room creation, joining, and LAN discovery

**Deliverables**:

1. Room model and storage (SQLite with Prisma or better-sqlite3)
2. Room creation: Generate 6-digit room key, store in DB
3. Room joining: Validate room key, add player to room
4. Room state broadcasting: When players join/leave, broadcast to all clients
5. mDNS/Bonjour discovery: Advertise `_hitster._tcp.local` service
6. QR code generation: Show QR with `http://<host-ip>:<port>?room=<key>`
7. Room key validation middleware for WebSocket messages
8. Room cleanup: Remove empty rooms after timeout

**Database Schema** (if using Prisma):

```prisma
model Room {
  id        String   @id @default(uuid())
  roomKey   String   @unique
  gameMode  String
  createdAt DateTime @default(now())
  players   Player[]
  gameState String?  // JSON serialized game state
}

model Player {
  id        String   @id @default(uuid())
  name      String
  avatar    String
  roomId    String
  socketId  String   @unique
  room      Room     @relation(fields: [roomId], references: [id])
}
```

**Testing Strategy**:

- ✅ Integration tests: Room creation returns valid room key
- ✅ Integration tests: Room joining with valid key succeeds
- ✅ Integration tests: Room joining with invalid key fails
- ✅ Integration tests: mDNS service advertises correctly (or mocks)
- ✅ Integration tests: QR code contains correct URL
- ✅ E2E tests: Two clients can join the same room

**Acceptance Criteria**:

- [ ] Host can create a room and receive a 6-digit key
- [ ] Players can join with valid room key
- [ ] Players cannot join with invalid key
- [ ] mDNS service is discoverable (or manual IP works)
- [ ] QR code scans correctly on mobile
- [ ] Room state is broadcast to all connected clients

**Dependencies**: Phase 3 (server foundation)

---

## Phase 5: Game State Management & Message Handlers

**Goal**: Connect game engine to server, handle game actions via WebSocket

**Deliverables**:

1. Server-side game state storage (in-memory or SQLite)
2. Message handlers for all game actions:
   - `CREATE_ROOM` → create room, initialize game state
   - `JOIN` → add player using engine reducer
   - `START_ROUND` → select random card, broadcast `START_SONG`
   - `PLACE` → validate, call engine reducer, broadcast update
   - `CHALLENGE` → validate tokens, call engine reducer, broadcast
   - `REVEAL` → call engine reducer, calculate scores, broadcast summary
3. Authoritative state: Server is source of truth
4. State persistence: Save game state to SQLite on key events
5. Reconnection handling: Clients can rejoin and receive current state

**Server Flow**:

```
Client sends message → Validate with Zod → Call engine reducer →
Update server state → Broadcast to all clients → Persist to DB
```

**Testing Strategy**:

- ✅ Integration tests: Game actions update server state correctly
- ✅ Integration tests: State changes are broadcast to all clients
- ✅ Integration tests: Invalid actions are rejected
- ✅ Integration tests: Reconnecting client receives current state
- ✅ E2E tests: Full round flow (join → start → place → reveal)

**Acceptance Criteria**:

- [ ] Server maintains authoritative game state
- [ ] All game actions are validated before processing
- [ ] State changes are broadcast to all room participants
- [ ] Reconnecting clients receive current game state
- [ ] Game state persists across server restarts (SQLite)

**Dependencies**: Phase 2 (engine), Phase 4 (rooms)

---

## Phase 6: Frontend Foundation - React App Setup

**Goal**: Create React PWA shell with routing and state management

**Deliverables**:

1. `apps/web` Vite + React + TypeScript setup
2. Tailwind CSS configuration
3. Basic routing (React Router or similar):
   - `/` → Landing page (Create/Join)
   - `/room/:roomKey` → Lobby/Game view
   - `/host/:roomKey` → Host-specific view (Spotify setup)
4. Zustand store for:
   - Connection state (connected/disconnected)
   - Room state (roomKey, players, gameState)
   - Player state (myPlayerId, myTokens, myTimeline)
5. WebSocket client connection manager
6. Basic UI shell with navigation
7. Responsive layout (mobile-first)

**Testing Strategy**:

- ✅ Unit tests: Zustand store updates correctly
- ✅ Integration tests: WebSocket connection establishes
- ✅ Integration tests: Routing works correctly
- ✅ Visual regression: Basic UI renders correctly

**Acceptance Criteria**:

- [ ] React app builds and runs with `npm run dev`
- [ ] WebSocket connects to server
- [ ] Routing navigates between pages
- [ ] Zustand store updates on WebSocket messages
- [ ] UI is responsive on mobile viewport

**Dependencies**: Phase 1 (proto), Phase 5 (message handlers)

---

## Phase 7: Spotify Integration (Host-Only)

**Goal**: Implement Spotify Web Playback SDK in host tab only
**api and redirect** setup can be found in .env with 
spotify-client-id='my-spotify-client-id'
spotify-client-secret='my-spotify-client-secret'
spotify-redirect-url='http://127.0.0.1:5173/callback'

**Deliverables**:

1. Host detection: Route `/host/:roomKey` loads Spotify SDK
2. Spotify OAuth flow (Authorization Code):
   - Redirect to Spotify auth
   - Receive callback with code
   - Exchange for access/refresh tokens
   - Store tokens in IndexedDB (host tab only)
3. Web Playback SDK initialization:
   - Load `https://sdk.scdn.co/spotify-player.js`
   - Initialize player with token
   - Get `device_id` on ready
   - Send `device_id` to server (server stores for room)
4. Spotify Web API client:
   - `transferToHostDevice(deviceId)` → `PUT /me/player`
   - `playTrack(trackUri, positionMs)` → `PUT /me/player/play`
   - `pause()` → `PUT /me/player/pause`
   - `getPlaybackState()` → `GET /me/player`
5. Handle `START_SONG` message: Play track on host device
6. Premium check: Verify host has Premium before allowing game start
7. Error handling: Device unavailable, Premium missing, autoplay blocked

**Host Tab Flow**:

```
Load → OAuth → Get tokens → Init SDK → Get device_id →
Send to server → Ready to play → On START_SONG → Play on Spotify
```

**Testing Strategy**:

- ✅ Integration tests: OAuth flow completes (mock Spotify API)
- ✅ Integration tests: SDK initializes and returns device_id
- ✅ Integration tests: `START_SONG` triggers playback (mock Web API)
- ✅ Integration tests: Premium check works correctly
- ✅ E2E tests: Host tab plays music when server sends START_SONG

**Acceptance Criteria**:

- [ ] Host tab can authenticate with Spotify
- [ ] Host tab initializes Web Playback SDK
- [ ] Host tab receives `device_id` and sends to server
- [ ] Host tab plays music when server broadcasts `START_SONG`
- [ ] Non-host clients never load Spotify SDK or create audio elements
- [ ] Premium check blocks game start if not Premium

**Dependencies**: Phase 6 (frontend), Phase 5 (START_SONG message)

---

## Phase 8: Game UI - Lobby & Timeline

**Goal**: Build interactive game interface for players

**Deliverables**:

1. **Lobby Screen**:
   - Player list with avatars
   - Game mode display
   - "Start Game" button (host only, requires Spotify)
   - Room key display with QR code
2. **Timeline UI**:
   - Horizontal scrollable timeline (left = earlier, right = later)
   - Card slots with drop zones
   - Drag-and-drop placement (or tap zones: Left/Middle/Right)
   - Card reveal animation
   - Color feedback (green = correct, red = wrong)
3. **Player Dashboard**:
   - Token count display
   - Challenge button (spend token)
   - Skip button (spend token)
   - Current song info (when playing)
4. **Round Summary**:
   - Score updates
   - Timeline with revealed years
   - Winner announcement
5. **Reactions**:
   - Emoji picker during song playback
   - Animated reactions from other players

**UI Components** (using Radix UI + Tailwind):

- `Timeline` component (Framer Motion for animations)
- `Card` component (with cover art once revealed)
- `TokenDisplay` component
- `PlayerList` component
- `ReactionPicker` component

**Testing Strategy**:

- ✅ Unit tests: UI components render correctly
- ✅ Integration tests: Timeline updates on game state changes
- ✅ Integration tests: Placement actions send correct messages
- ✅ E2E tests: Full game flow (create → join → play → place → reveal)
- ✅ Accessibility tests: Keyboard navigation, screen reader support

**Acceptance Criteria**:

- [ ] Lobby shows all players correctly
- [ ] Timeline displays cards in correct order
- [ ] Players can place cards via drag or tap
- [ ] Challenges are sent and processed
- [ ] Round summary shows scores and winners
- [ ] UI is accessible (keyboard nav, ARIA labels)
- [ ] Animations respect `prefers-reduced-motion`

**Dependencies**: Phase 6 (frontend), Phase 7 (Spotify), Phase 5 (game state)

---

## Phase 9: PWA Features & Offline Support

**Goal**: Make app installable and work offline for lobby/UI

**Deliverables**:

1. **Service Worker** (Workbox):
   - Precaching: Shell HTML, CSS, JS bundles
   - Runtime caching: Static assets (images, fonts)
   - **NO caching of Spotify audio or API responses**
   - Offline fallback: Show offline message for game, lobby works offline
2. **PWA Manifest**:
   - App name, icons (multiple sizes)
   - Display mode: `standalone`
   - Theme colors
   - Start URL
3. **Install Prompt**:
   - Custom install button (for supported browsers)
   - Show install banner on mobile
4. **Offline Detection**:
   - Show connection status indicator
   - Queue messages when offline, send when reconnected
5. **Performance Optimization**:
   - Code splitting (route-based)
   - Lazy loading for non-critical components
   - Image optimization (WebP with fallbacks)
   - Bundle size monitoring (target: ≤ 2.0 MB gzipped)

**Testing Strategy**:

- ✅ Integration tests: Service worker registers correctly
- ✅ Integration tests: Assets are precached
- ✅ E2E tests: App installs on mobile device
- ✅ E2E tests: Offline mode works for lobby
- ✅ Performance tests: Bundle size is under budget
- ✅ Lighthouse: PWA score > 90

**Acceptance Criteria**:

- [ ] App installs on iOS and Android
- [ ] Service worker caches shell and static assets
- [ ] Lobby works offline (can view players, but can't play)
- [ ] Bundle size is ≤ 2.0 MB gzipped
- [ ] Lighthouse PWA score > 90
- [ ] Install prompt appears on supported browsers

**Dependencies**: Phase 8 (game UI)

---

## Phase 10: Polish, Edge Cases & QA

**Goal**: Handle edge cases, improve UX, and ensure production readiness

**Deliverables**:

1. **Error Handling**:
   - Connection lost: Show reconnection UI, auto-reconnect
   - Host tab closed: Pause game, show message to players
   - Premium expired: Block game start, show upgrade notice
   - Device unavailable: Show device picker, retry transfer
   - Autoplay blocked: "Tap to enable sound" overlay
2. **Soundcheck Flow** (Host):
   - Device picker (select output device)
   - Volume test (play test tone)
   - Autoplay unlock (user gesture required)
3. **Cast View** (Optional):
   - Read-only big-screen view
   - Timeline and now-playing (no audio unless it IS the host tab)
4. **Accessibility**:
   - Full keyboard navigation
   - Screen reader announcements
   - Color contrast ≥ 4.5:1
   - Focus management
5. **Performance**:
   - WebSocket RTT monitoring (< 80ms target)
   - Bundle size optimization
   - Lazy load Framer Motion only when needed
6. **Logging**:
   - Pino on server with log levels
   - Redact secrets (tokens, room keys in logs)
   - Error tracking (local only, no external services)

**Testing Strategy**:

- ✅ E2E tests: Host tab disconnect/reconnect
- ✅ E2E tests: Player disconnect/reconnect
- ✅ E2E tests: Premium check blocks game
- ✅ E2E tests: Autoplay unlock flow
- ✅ Accessibility tests: WCAG 2.1 AA compliance
- ✅ Performance tests: RTT under 80ms, TTI under 2.5s
- ✅ Load tests: Multiple concurrent rooms

**Acceptance Criteria**:

- [ ] All edge cases handled gracefully
- [ ] Reconnection works for both host and players
- [ ] Error messages are clear and actionable
- [ ] Accessibility passes WCAG 2.1 AA
- [ ] Performance meets targets (RTT < 80ms, TTI < 2.5s)
- [ ] Logging is comprehensive but secure (no secrets)

**Dependencies**: All previous phases

---

## Testing Strategy Summary

### Unit Tests

- **packages/engine**: 100% coverage (Vitest)
- **packages/proto**: 100% coverage on schema validation
- **packages/ui-kit**: Component rendering and props

### Integration Tests

- **apps/server**: Message handlers, room management, game state
- **apps/web**: WebSocket connection, state updates, Spotify SDK (mocked)

### E2E Tests (Playwright)

- **Full game flow**: Create room → Join → Play → Place → Reveal → Win
- **Reconnection**: Host/player disconnect and reconnect
- **Spotify integration**: Host tab plays music (with test account)
- **Multi-client**: 3+ browser contexts (host + 2 players)

### Performance Tests

- Bundle size: ≤ 2.0 MB gzipped
- TTI: ≤ 2.5s on mid-range mobile
- WebSocket RTT: < 80ms on 5GHz Wi-Fi
- Lighthouse: PWA score > 90

---

## Dependencies & Critical Path

```
Phase 0 (Foundation)
    ↓
Phase 1 (Proto) ────┐
    ↓                │
Phase 2 (Engine) ←───┘
    ↓
Phase 3 (Server HTTP/WS)
    ↓
Phase 4 (Rooms) ────┐
    ↓               │
Phase 5 (Game State)│
    ↓               │
Phase 6 (Frontend) ←┘
    ↓
Phase 7 (Spotify) ────┐
    ↓                 │
Phase 8 (Game UI) ←───┘
    ↓
Phase 9 (PWA)
    ↓
Phase 10 (Polish)
```

**Parallel Work Opportunities**:

- Phase 2 (Engine) can be developed in parallel with Phase 3 (Server)
- Phase 6 (Frontend) can start basic UI while Phase 7 (Spotify) is in progress
- Phase 9 (PWA) can be done in parallel with Phase 10 (Polish)

---

## Risk Mitigation

| Risk                                 | Impact | Mitigation                                            |
| ------------------------------------ | ------ | ----------------------------------------------------- |
| Spotify Web Playback SDK limitations | High   | Early prototype in Phase 7, test autoplay policies    |
| WebSocket latency on mobile          | Medium | Test early on real devices, optimize message size     |
| PWA install friction                 | Medium | Test on iOS/Android early, provide clear instructions |
| mDNS not working on all networks     | Low    | Fallback to manual IP entry + QR code                 |
| Bundle size too large                | Medium | Monitor from Phase 6, code split aggressively         |

---

## Success Metrics

### Technical

- ✅ All tests passing (unit, integration, E2E)
- ✅ Bundle size ≤ 2.0 MB gzipped
- ✅ WebSocket RTT < 80ms
- ✅ Lighthouse PWA score > 90
- ✅ Zero critical accessibility issues

### Functional

- ✅ Host can create room and connect Spotify
- ✅ Players can join via QR code
- ✅ Full game round completes successfully
- ✅ Reconnection works for all clients
- ✅ App installs on iOS and Android

---

## Next Steps After Completion

1. **User Testing**: Gather feedback from real gameplay sessions
2. **Analytics** (local only): Track game completion rates, common errors
3. **Additional Game Modes**: Pro, Expert, Coop (from PRD)
4. **Custom Playlists**: Allow host to select specific playlists
5. **Remix Mode**: Themed games (decades, genres)

---

**Document Version**: 1.0  
**Last Updated**: 2024  
**Maintained By**: Development Team
