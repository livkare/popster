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
    const pathname = window.location.pathname;
    const hasCallbackParams = window.location.search.includes('code=') || window.location.search.includes('error=');
    
    // Check if pathname is /callback OR if we have OAuth callback parameters (for SPA routing)
    const isCallback = pathname === '/callback' || pathname.includes('/callback') || hasCallbackParams;
    
    if (isCallback) {
        console.log('[Callback Handler] Callback page detected');
    }
    
    return isCallback;
}

