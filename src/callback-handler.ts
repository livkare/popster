import { exchangeCodeForTokens } from './spotify-auth';

// Handle OAuth callback from Spotify
export async function handleCallback(): Promise<boolean> {
    console.log('[Callback Handler] Processing OAuth callback...');
    console.log('[Callback Handler] Current URL:', window.location.href);
    console.log('[Callback Handler] Pathname:', window.location.pathname);
    console.log('[Callback Handler] Search:', window.location.search);
    
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');
    const error = urlParams.get('error');
    
    if (error) {
        console.error('[Callback Handler] Spotify authorization error:', error);
        return false;
    }
    
    if (!code) {
        console.error('[Callback Handler] Missing authorization code in callback');
        return false;
    }
    
    if (!state) {
        console.error('[Callback Handler] Missing state parameter in callback');
        return false;
    }
    
    console.log('[Callback Handler] Code received:', code.substring(0, 20) + '...');
    console.log('[Callback Handler] State received:', state);
    
    // Exchange code for tokens
    console.log('[Callback Handler] Exchanging code for tokens...');
    const success = await exchangeCodeForTokens(code, state);
    if (success) {
        console.log('[Callback Handler] Successfully authenticated with Spotify');
        return true;
    } else {
        console.error('[Callback Handler] Failed to exchange code for tokens');
        return false;
    }
}

// Check if we're on the callback page
export function isCallbackPage(): boolean {
    const hash = window.location.hash;
    const search = window.location.search;

    // Check for hash-based callback route (#/callback)
    // OAuth params can be in either search (old) or after hash (new)
    const isHashCallback = hash.startsWith('#/callback');
    const hasCallbackParams = search.includes('code=') || search.includes('error=') ||
                              hash.includes('code=') || hash.includes('error=');

    const isCallback = isHashCallback || hasCallbackParams;

    if (isCallback) {
        console.log('[Callback Handler] Callback page detected');
        console.log('[Callback Handler] Hash:', hash);
        console.log('[Callback Handler] Search:', search);
    }

    return isCallback;
}

