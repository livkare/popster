# OAuth Callback Setup Documentation

## Problem Summary

The OAuth callback route `/callback` was returning 404 errors with the message:
```
{"message":"Route GET:/callback?code=... not found","error":"Not Found","statusCode":404}
```

## Root Causes Identified

### 1. Port Conflict
- Another backend API server from a different project was running on port 5173
- This server was intercepting requests and returning API-style JSON errors instead of serving the Vite SPA

### 2. Custom SPA Plugin Interference
- A custom `spaFallback()` plugin was interfering with Vite's built-in SPA routing
- Vite's `appType: 'spa'` already handles SPA routing automatically

### 3. IPv4/IPv6 Binding Issue
- Vite was only listening on IPv6 (`::1`) by default
- OAuth redirects from Spotify use IPv4 (`127.0.0.1`)
- This caused `ERR_CONNECTION_REFUSED` errors

## Solutions Implemented

### 1. Changed Port to 3000
**File:** `vite.config.ts`
```typescript
server: {
    port: 3000,
    strictPort: true
}
```

**File:** `src/spotify-auth.ts`
```typescript
const REDIRECT_URI = import.meta.env.VITE_SPOTIFY_REDIRECT_URI || 'http://127.0.0.1:3000/callback';
```

### 2. Removed Custom SPA Plugin
**File:** `vite.config.ts`
- Removed the custom `spaFallback()` plugin function
- Rely on Vite's built-in `appType: 'spa'` configuration
- This automatically serves `index.html` for all routes that don't match static files

### 3. Added Host Configuration
**File:** `vite.config.ts`
```typescript
server: {
    port: 3000,
    strictPort: true,
    host: true  // Listen on all interfaces (IPv4 and IPv6)
}
```

## Final Configuration

### vite.config.ts
```typescript
import { defineConfig } from 'vite';

export default defineConfig({
    server: {
        port: 3000,
        strictPort: true,
        host: true
    },
    appType: 'spa',
    build: {
        rollupOptions: {
            input: {
                main: './index.html'
            }
        }
    }
});
```

## Spotify App Configuration

**Important:** Update your Spotify app's redirect URI in the Spotify Developer Dashboard:
- **Old:** `http://127.0.0.1:5173/callback`
- **New:** `http://127.0.0.1:3000/callback`

## How It Works

1. **OAuth Flow Initiation:** User clicks to authenticate, app redirects to Spotify
2. **Spotify Redirect:** After authorization, Spotify redirects to `http://127.0.0.1:3000/callback?code=...&state=...`
3. **Vite SPA Routing:** Vite's `appType: 'spa'` serves `index.html` for the `/callback` route
4. **Client-Side Handling:** The `index.ts` file detects callback parameters and calls `handleCallback()`
5. **Token Exchange:** The callback handler exchanges the authorization code for access tokens

## Key Points

- **No backend required:** This setup uses PKCE (Proof Key for Code Exchange) for client-side OAuth
- **SPA routing:** Vite automatically handles all routes and serves `index.html` for non-static paths
- **Port consistency:** Ensure the port in `vite.config.ts` matches the redirect URI in both code and Spotify dashboard
- **Host binding:** `host: true` ensures the server accepts connections from both IPv4 and IPv6 addresses

## Troubleshooting

If you encounter connection issues:
1. Check for port conflicts: `lsof -i :3000`
2. Verify Vite is running: `npm run dev`
3. Test the server: `curl http://127.0.0.1:3000/`
4. Verify redirect URI matches in Spotify dashboard and code
5. Check browser console for JavaScript errors during callback handling

