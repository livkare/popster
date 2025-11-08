Awesome — here’s a complete, professional **full-stack web** tech-stack + architecture that makes **the host the only Spotify connection & the only device that plays audio**, while every other phone is a lightweight controller on the same LAN.

---

# Hitster (Web, Local-Only) — Host-Only Spotify Playback

## 0) Core Principle

- **One audio source**: the **host browser tab** is a Spotify Connect device created by the **Web Playback SDK**; it is the **only** place where sound plays. ([developer.spotify.com][1])
- **Control only**: the app uses the **Web API player endpoints** to transfer playback to the host device and issue play/pause/seek for the **host’s Premium account**. **No audio is redistributed** to other clients. ([developer.spotify.com][2])
- **Policy guardrails**: keep Spotify audio local to the host; do not re-stream or alter it. (Per Dev Terms/Policy & SDK reference.) ([developer.spotify.com][3])

---

## 1) High-Level Architecture

```
[ Player Phones (PWA) ]  <--WS-->  [ Node.js Host Server ]  <--local page control-->  [ Host Browser Tab ]
       UI, input                       Fastify + WS              React/TS + Web Playback SDK
       no audio                        room state, auth          the ONLY Spotify stream
                                       mDNS discovery            plugs into speakers/TV
```

- **Transport:** WebSockets (simple, robust on LAN).
- **Authority:** Host server owns the canonical game state, turn order, and validation.
- **Playback:** Host **browser tab** runs Spotify Web Playback SDK (creates a Connect device) and is controlled via the Web API. ([developer.spotify.com][1])

---

## 2) Frontend (Players & Host Tab)

**Framework**

- **React + TypeScript** (bundled by Vite)
- **State:** **Zustand** (lean) or **Redux Toolkit**
- **Networking:** **tRPC** (type-safe RPC) over **WebSockets** (or Socket.IO)
- **UI:** **Tailwind CSS** + **Radix UI** (primitives) + **Framer Motion** (timeline & feedback)
- **PWA:** Workbox (installable on iOS/Android; offline shell for lobby & UI)
- **Accessibility:** ARIA-correct controls, focus management, color-contrast tokens

**Host-Tab extras (only on the host machine):**

- **Spotify Web Playback SDK** (creates local Connect device; plays audio in the tab). ([developer.spotify.com][1])
- Device picker & “soundcheck” flow (choose speakers/TV, confirm volume).
- Minimal “stage” overlay to cast/airplay the browser tab to a TV if desired.

**Player UI (all other phones):**

- Timeline view, guess/placement controls, token buttons.
- Reactions (emoji), leaderboards, round summaries.
- **No audio elements at all.** (Avoids autoplay prompts and policy issues.)

---

## 3) Backend (Local Host Server)

**Runtime**

- **Node.js 20+**, **Fastify** (HTTP), **ws** (or **uWebSockets.js**) for low-latency WS
- **tRPC** server + **Zod** validation across all boundaries
- **Logging:** Pino

**LAN Discovery**

- **mDNS/Bonjour** to advertise `_hitster._tcp.local` and IP/port; QR code fallback with `http://<host-ip>:<port>`.

**Data & Storage**

- **SQLite** with **Prisma** (or `better-sqlite3` if you prefer zero-ORM)
- Tables: `players`, `games`, `rounds`, `timeline_cards`, `tokens`, `decks`, `tracks` (if you also support non-Spotify content later)
- All data **local**; no external DB or cloud.

**Authority & Rules**

- Deterministic game engine module (pure TypeScript) → reducers + event log
- Server validates placements, awards tokens, resolves challenges, emits updates

---

## 4) Spotify Integration (Host-Only)

**What you’ll use**

- **Web Playback SDK** in the **host tab** → creates a Spotify Connect device inside the browser and **plays locally**. (Premium required.) ([developer.spotify.com][1])
- **Web API — Player endpoints** from the **host tab** (or proxied via server):
  - **Transfer playback** to the host’s device (`PUT /me/player`)
  - **Start/Resume/Pause/Seek** (`/me/player/play`, `/pause`, `/seek`)
  - **Read playback state/devices** (`/me/player`, `/me/player/devices`) ([developer.spotify.com][2])

- **Scopes:** `streaming`, `user-read-playback-state`, `user-modify-playback-state`, plus `user-read-email`/`user-read-private` for identity as needed. ([developer.spotify.com][4])

**OAuth flow (once per host session)**

1. Host clicks “Connect Spotify” in the **host tab** → Authorization Code flow; obtain access & refresh tokens.
2. Initialize Web Playback SDK → get `device_id` for the host tab. ([developer.spotify.com][1])
3. Call **Transfer Playback** to that `device_id`, with `play=true` when starting a round. ([developer.spotify.com][2])

**Policy guardrails**

- **Do not** capture, proxy, or restream audio to other clients.
- **Do not** alter Spotify content.
- Streaming apps **must not be commercial** unless you have separate permissions. (See Dev Terms/Policy & SDK reference.) ([developer.spotify.com][3])

---

## 5) Real-Time Game Sync (No Audio Sync Needed)

- Since **only the host plays audio**, you don’t need multi-device audio synchronization.
- Use regular **WebSocket broadcasts** for game events: `SONG_STARTED`, `PLACE`, `CHALLENGE`, `REVEAL`, `SCORE_UPDATE`.
- Round latency targets: **< 80 ms RTT** on typical 5 GHz Wi-Fi (plenty for responsive UI & countdowns).

**Message contracts (examples)**

```ts
type Join = { t: "JOIN"; name: string; avatar: string };
type Seat = { t: "SEAT"; playerId: string };
type StartSong = { t: "START_SONG"; trackUri: string; positionMs?: number };
type Reveal = { t: "REVEAL"; year: number };
type Place = { t: "PLACE"; playerId: string; slotIndex: number };
type Challenge = {
  t: "CHALLENGE";
  playerId: string;
  targetPlayerId: string;
  slotIndex: number;
};
type RoundSummary = { t: "ROUND_SUMMARY"; timeline: Card[]; scores: Score[] };
```

Server broadcasts `StartSong` → host tab immediately calls Spotify Web API:

- `PUT /me/player` (transfer to host device) → `PUT /me/player/play` (URI + start position). ([developer.spotify.com][2])

---

## 6) Security & Privacy (LAN scope)

- **Room key** (6–8 digits) shown as a **QR code**; every WS join must present it.
- All tokens & game state live in host memory/SQLite; nothing leaves the LAN.
- Optional: per-message **HMAC(roomKey, payload)** to prevent spoofing on noisy LANs.
- HTTPS on LAN is usually cumbersome; keep it **HTTP on LAN** but isolate to the party network.
- Enforce **Premium** for the host if using SDK/Player endpoints. (SDK & many Player endpoints require it.) ([developer.spotify.com][2])

---

## 7) Developer Experience & Tooling

- **Monorepo:** Turborepo (or Nx)
- **apps/**
  - `server/` (Fastify + ws + tRPC)
  - `web/` (React PWA)

- **packages/**
  - `engine/` (pure rules)
  - `proto/` (Zod schemas & types)
  - `ui-kit/` (shared components)

- **Build:** Vite (web), `tsup` (server)
- **Tests:** Vitest/Jest (unit), Playwright (E2E: two browser contexts + one host tab)
- **Lint/format:** ESLint + Prettier
- **Logs:** Pino pretty transport in dev; rotating logs in prod

---

## 8) MVP Backlog (4–5 sprints)

1. **LAN Host + Discovery:** Fastify, WS, mDNS, lobby + QR join; auth wall for host’s Spotify connect.
2. **Rules + Timelines:** deterministic engine; placement/challenge flows; optimistic UI.
3. **Host-Only Playback:** Web Playback SDK init; get `device_id`; transfer & play; soundcheck; error recovery. ([developer.spotify.com][1])
4. **PWA Polish:** install banner, offline shell, avatar picker, reactions, end-of-round recap.
5. **QA & Edge Cases:** reconnect handling, lost host tab, Premium missing, device change, autoplay unlock UX.

---

## 9) Failure Modes & Recovery

- **Autoplay blocked (browser policy):** show a “Tap to enable sound” gate in the host tab, then keep a warm audio context.
- **Premium missing/expired:** block “Start Game” with actionable notice (open Spotify account). (Player endpoints & SDK require Premium.) ([developer.spotify.com][2])
- **Host tab crashes/closes:** server pauses the round; when a new host tab reconnects and initializes SDK, server re-issues the current track URI + position.
- **Device transfer race:** if another device is active, **Transfer Playback** explicitly to the host tab’s `device_id` right before play. (Common best practice.) ([developer.spotify.com][2])

---

## 10) Concrete Library List

**Frontend**

- `react`, `react-dom`, `typescript`, `vite`
- `zustand` _or_ `@reduxjs/toolkit`
- `@trpc/client`, `zod`, `socket.io-client` _or_ `ws`
- `tailwindcss`, `@radix-ui/react-*`, `framer-motion`
- `workbox-window`
- **Spotify SDK loader** (tiny custom util to load `https://sdk.scdn.co/spotify-player.js`) ([developer.spotify.com][1])

**Backend**

- `fastify`, `@fastify/websocket` (or `uWebSockets.js`)
- `@trpc/server`, `zod`
- `bonjour-service` (mDNS)
- `prisma` + `@prisma/client` (SQLite) or `better-sqlite3`
- `qrcode`, `uuid`, `pino`

---

## 11) Minimal Host Playback Flow (wire-level)

1. **Host tab** logs into Spotify (Authorization Code) → stores tokens in host tab (IndexedDB) or server (in-memory, ephemeral).
2. Host initializes SDK → receives `device_id`. ([developer.spotify.com][1])
3. Server sends `START_SONG { trackUri, positionMs }` → host tab:
   - `PUT /v1/me/player` with `{ device_ids: [device_id], play: true }` (transfer to host device)
   - `PUT /v1/me/player/play` with `{ uris: [trackUri], position_ms: positionMs ?? 0 }`

4. On `REVEAL`, host tab pauses or lowers volume; server broadcasts results; continue.

---

## 12) Why this is compliant & simple

- **Single authenticated Premium user**, **single playback device**, **no redistribution** — the audio remains inside the host’s browser as intended by the Web Playback SDK & Player API.

---

### TL;DR

- **Frontend (PWA):** React/TS + Tailwind/Radix + Framer, WS via tRPC; **players have no audio**.
- **Backend (LAN):** Node 20 + Fastify + WS + SQLite; mDNS discovery.
- **Spotify:** **Web Playback SDK** in the **host tab** (Premium), **Player API** to transfer & control playback; **never re-stream**.
