// Spotify OAuth 2.0 Configuration
// Using PKCE (Proof Key for Code Exchange) flow - no client secret needed
const CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID;

// Dynamically determine redirect URI based on environment
// Uses hash-based routing (#/callback) to avoid 404 on GitHub Pages
function getRedirectURI(): string {
  // Use environment variable if set
  if (import.meta.env.VITE_SPOTIFY_REDIRECT_URI) {
    return import.meta.env.VITE_SPOTIFY_REDIRECT_URI;
  }

  // Auto-detect based on current URL
  const origin = window.location.origin;
  const pathname = window.location.pathname;

  // For GitHub Pages, use hash-based routing to avoid 404
  if (origin.includes('github.io')) {
    const basePath = pathname.split('/')[1] || '';
    return `${origin}/${basePath}/#/callback`;
  }

  // Local development - also use hash routing for consistency
  return `${origin}/#/callback`;
}

const REDIRECT_URI = getRedirectURI();
const SPOTIFY_AUTH_URL = 'https://accounts.spotify.com/authorize';
const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';

// Validate environment variables
if (!CLIENT_ID) {
    console.error('Missing Spotify Client ID in environment variables. Please check your .env file.');
}

// Storage keys
const STORAGE_KEYS = {
    ACCESS_TOKEN: 'spotify_access_token',
    REFRESH_TOKEN: 'spotify_refresh_token',
    TOKEN_EXPIRY: 'spotify_token_expiry',
    CODE_VERIFIER: 'spotify_code_verifier'
};

// Generate a random string for code verifier
// Spotify requires: 43-128 characters, using unreserved characters (A-Z, a-z, 0-9, -, ., _, ~)
function generateRandomString(length: number): string {
    // Using URL-safe characters as per PKCE spec (RFC 7636)
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
    let text = '';
    for (let i = 0; i < length; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    console.log('[PKCE] Generated code verifier, length:', text.length, '(must be 43-128 chars)');
    return text;
}

// Generate code challenge from verifier (SHA256 hash, base64url encoded)
// Per Spotify PKCE requirements: SHA256 hash, then base64url encode (RFC 4648 Section 5)
async function generateCodeChallenge(verifier: string): Promise<string> {
    console.log('[PKCE] Generating code challenge from verifier...');
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const digest = await crypto.subtle.digest('SHA-256', data);
    // Convert to base64url: replace + with -, / with _, and remove padding =
    const challenge = btoa(String.fromCharCode(...new Uint8Array(digest)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
    console.log('[PKCE] Code challenge generated, length:', challenge.length);
    return challenge;
}

// Get stored access token
export function getAccessToken(): string | null {
    return localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
}

// Get stored refresh token
export function getRefreshToken(): string | null {
    return localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
}

// Check if token is expired or will expire soon (within 5 minutes)
function isTokenExpired(): boolean {
    const expiry = localStorage.getItem(STORAGE_KEYS.TOKEN_EXPIRY);
    if (!expiry) return true;
    const expiryTime = parseInt(expiry, 10);
    const now = Date.now();
    // Refresh if token expires within 5 minutes
    return now >= (expiryTime - 5 * 60 * 1000);
}

// Store tokens
function storeTokens(accessToken: string, refreshToken: string | null, expiresIn: number): void {
    localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, accessToken);
    if (refreshToken) {
        localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
    }
    const expiryTime = Date.now() + (expiresIn * 1000);
    localStorage.setItem(STORAGE_KEYS.TOKEN_EXPIRY, expiryTime.toString());
}

// Clear stored tokens
export function clearTokens(): void {
    localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.TOKEN_EXPIRY);
    localStorage.removeItem(STORAGE_KEYS.CODE_VERIFIER);
}

// Initialize authorization flow
export async function initiateAuth(): Promise<void> {
    console.log('[Auth] Initiating Spotify authorization flow...');
    console.log('[Auth] Client ID:', CLIENT_ID ? CLIENT_ID.substring(0, 10) + '...' : 'MISSING');
    console.log('[Auth] Redirect URI:', REDIRECT_URI);
    
    if (!CLIENT_ID) {
        console.error('[Auth] ERROR: Client ID is missing!');
        throw new Error('Spotify Client ID is not configured');
    }
    
    // Generate code verifier (128 chars, within Spotify's 43-128 requirement)
    const codeVerifier = generateRandomString(128);
    const codeChallenge = await generateCodeChallenge(codeVerifier);
    
    // Store code verifier for later use in token exchange
    localStorage.setItem(STORAGE_KEYS.CODE_VERIFIER, codeVerifier);
    console.log('[Auth] Code verifier stored in localStorage');
    
    // Generate state for CSRF protection
    const state = generateRandomString(16);
    sessionStorage.setItem('spotify_auth_state', state);
    console.log('[Auth] State generated and stored:', state);
    
    // Build authorization URL per Spotify PKCE flow
    const params = new URLSearchParams({
        response_type: 'code',
        client_id: CLIENT_ID,
        scope: 'user-read-private user-read-email user-read-playback-state user-modify-playback-state playlist-read-private',
        redirect_uri: REDIRECT_URI,
        state: state,
        code_challenge_method: 'S256',
        code_challenge: codeChallenge
    });
    
    const authUrl = `${SPOTIFY_AUTH_URL}?${params.toString()}`;
    console.log('[Auth] Redirecting to Spotify authorization URL...');
    console.log('[Auth] Auth URL (truncated):', authUrl.substring(0, 100) + '...');
    
    window.location.href = authUrl;
}

// Exchange authorization code for tokens
export async function exchangeCodeForTokens(code: string, state: string): Promise<boolean> {
    console.log('[Token Exchange] Starting token exchange...');
    console.log('[Token Exchange] Code length:', code.length);
    console.log('[Token Exchange] State:', state);
    
    // Verify state to prevent CSRF attacks
    const storedState = sessionStorage.getItem('spotify_auth_state');
    if (!storedState) {
        console.error('[Token Exchange] ERROR: No stored state found - possible session expired');
        return false;
    }
    if (storedState !== state) {
        console.error('[Token Exchange] ERROR: State mismatch - possible CSRF attack');
        console.error('[Token Exchange] Stored state:', storedState);
        console.error('[Token Exchange] Received state:', state);
        return false;
    }
    console.log('[Token Exchange] State verified successfully');
    sessionStorage.removeItem('spotify_auth_state');
    
    // Retrieve code verifier
    const codeVerifier = localStorage.getItem(STORAGE_KEYS.CODE_VERIFIER);
    if (!codeVerifier) {
        console.error('[Token Exchange] ERROR: Code verifier not found in localStorage');
        return false;
    }
    console.log('[Token Exchange] Code verifier retrieved, length:', codeVerifier.length);
    
    if (!CLIENT_ID) {
        console.error('[Token Exchange] ERROR: Missing client ID');
        return false;
    }

    try {
        console.log('[Token Exchange] Sending token exchange request to Spotify...');
        const response = await fetch(SPOTIFY_TOKEN_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: REDIRECT_URI,
                client_id: CLIENT_ID,
                code_verifier: codeVerifier
            })
        });
        
        console.log('[Token Exchange] Response status:', response.status, response.statusText);
        
        if (!response.ok) {
            const error = await response.json();
            console.error('[Token Exchange] ERROR: Token exchange failed');
            console.error('[Token Exchange] Error details:', error);
            return false;
        }
        
        const data = await response.json();
        console.log('[Token Exchange] Token exchange successful!');
        console.log('[Token Exchange] Access token received, length:', data.access_token?.length || 0);
        console.log('[Token Exchange] Refresh token received:', data.refresh_token ? 'Yes' : 'No');
        console.log('[Token Exchange] Expires in:', data.expires_in, 'seconds');
        
        storeTokens(data.access_token, data.refresh_token, data.expires_in);
        localStorage.removeItem(STORAGE_KEYS.CODE_VERIFIER);
        console.log('[Token Exchange] Tokens stored, code verifier removed');
        
        return true;
    } catch (error) {
        console.error('[Token Exchange] ERROR: Exception during token exchange:', error);
        return false;
    }
}

// Refresh access token
export async function refreshAccessToken(): Promise<boolean> {
    console.log('[Token Refresh] Attempting to refresh access token...');
    const refreshToken = getRefreshToken();
    if (!refreshToken) {
        console.error('[Token Refresh] ERROR: No refresh token available');
        return false;
    }
    
    if (!CLIENT_ID) {
        console.error('[Token Refresh] ERROR: Missing client ID');
        return false;
    }

    try {
        console.log('[Token Refresh] Sending refresh request to Spotify...');
        const response = await fetch(SPOTIFY_TOKEN_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                grant_type: 'refresh_token',
                refresh_token: refreshToken,
                client_id: CLIENT_ID
            })
        });
        
        console.log('[Token Refresh] Response status:', response.status, response.statusText);
        
        if (!response.ok) {
            const error = await response.json();
            console.error('[Token Refresh] ERROR: Token refresh failed');
            console.error('[Token Refresh] Error details:', error);
            clearTokens();
            return false;
        }
        
        const data = await response.json();
        console.log('[Token Refresh] Token refresh successful!');
        console.log('[Token Refresh] New access token received, length:', data.access_token?.length || 0);
        console.log('[Token Refresh] New refresh token:', data.refresh_token ? 'Yes' : 'No (reusing existing)');
        console.log('[Token Refresh] Expires in:', data.expires_in, 'seconds');
        
        storeTokens(
            data.access_token,
            data.refresh_token || refreshToken, // Use existing refresh token if new one not provided
            data.expires_in
        );
        
        return true;
    } catch (error) {
        console.error('[Token Refresh] ERROR: Exception during token refresh:', error);
        clearTokens();
        return false;
    }
}

// Get valid access token (refresh if needed)
export async function getValidAccessToken(): Promise<string | null> {
    let token = getAccessToken();
    
    if (!token || isTokenExpired()) {
        console.log('Token expired or missing, refreshing...');
        const refreshed = await refreshAccessToken();
        if (!refreshed) {
            return null;
        }
        token = getAccessToken();
    }
    
    return token;
}

// Check if user is authenticated
export function isAuthenticated(): boolean {
    return getAccessToken() !== null && !isTokenExpired();
}

// Initialize authentication check and auto-connect
export async function initializeAuth(): Promise<boolean> {
    console.log('[Auth Init] Checking authentication status...');
    
    // Check if we have a valid token
    if (isAuthenticated()) {
        const token = getAccessToken();
        console.log('[Auth Init] Already authenticated with valid token');
        console.log('[Auth Init] Token length:', token?.length || 0);
        return true;
    }
    
    console.log('[Auth Init] No valid token found');
    
    // Try to refresh if we have a refresh token
    const refreshToken = getRefreshToken();
    if (refreshToken) {
        console.log('[Auth Init] Refresh token found, attempting to refresh...');
        const refreshed = await refreshAccessToken();
        if (refreshed) {
            console.log('[Auth Init] Successfully refreshed token');
            return true;
        }
        console.log('[Auth Init] Token refresh failed, will initiate new auth flow');
    } else {
        console.log('[Auth Init] No refresh token found');
    }
    
    // No valid token, initiate auth flow
    console.log('[Auth Init] Initiating new authorization flow...');
    await initiateAuth();
    return false; // Will redirect, so return false
}

