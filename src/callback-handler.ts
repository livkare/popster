import { exchangeCodeForTokens } from './spotify-auth';

// Handle OAuth callback from Spotify
export async function handleCallback(): Promise<boolean> {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');
    const error = urlParams.get('error');

    if (error) {
        console.error('Spotify authorization error:', error);
        return false;
    }

    if (!code || !state) {
        console.error('Missing authorization code or state');
        return false;
    }

    // Exchange code for tokens
    const success = await exchangeCodeForTokens(code, state);
    if (!success) {
        console.error('Failed to exchange code for tokens');
    }
    return success;
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

    return isHashCallback || hasCallbackParams;
}

