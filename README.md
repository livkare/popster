# Hitster App

**Local-Only Web Multiplayer Music Timeline Game**

Host-only Spotify playback with controller-only player phones on the same LAN.

## Architecture

- **Monorepo**: Turborepo with npm workspaces
- **Frontend**: React + TypeScript + Vite (PWA)
- **Backend**: Node.js + Fastify + WebSocket
- **Shared**: Pure game engine, Zod schemas, UI components

## Project Structure

```
/
├── apps/
│   ├── server/          # Fastify + WebSocket server
│   └── web/              # React PWA frontend
├── packages/
│   ├── engine/          # Pure game logic (deterministic)
│   ├── proto/            # Zod schemas & message contracts
│   └── ui-kit/           # Shared UI components
```

## Getting Started

### Prerequisites

- Node.js >= 20.0.0
- npm >= 10.0.0

### Installation

```bash
npm install
```

### Development

```bash
# Build all packages
npm run build

# Run all apps in dev mode
npm run dev

# Type check all packages
npm run type-check

# Lint all packages
npm run lint

# Format all files
npm run format

# Check formatting
npm run format:check
```

## Workspace Scripts

Each workspace has its own scripts. Run them from the workspace directory:

```bash
# Server
cd apps/server
npm run dev
npm run build

# Web
cd apps/web
npm run dev
npm run build
```

## Tech Stack

- **Monorepo**: Turborepo
- **Language**: TypeScript (strict mode)
- **Linting**: ESLint + Prettier
- **Frontend**: React, Vite, Tailwind CSS
- **Backend**: Fastify, WebSocket (ws)
- **Validation**: Zod
- **State**: Zustand

## Development Guidelines

- All code must pass TypeScript strict mode
- ESLint and Prettier must pass before committing
- Follow the architecture rules in `.cursorrules`
- Only the host browser tab plays Spotify audio
- All other devices are controllers only

## License

Private project - not for distribution
