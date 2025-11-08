import type { FastifyReply, FastifyRequest } from "fastify";
import { logger } from "../logger.js";

const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token";

interface TokenExchangeBody {
  code: string;
  redirectUri: string;
}

/**
 * Exchange authorization code for access/refresh tokens
 * POST /api/spotify/token
 */
export async function registerSpotifyRoute(fastify: any): Promise<void> {
  fastify.post(
    "/api/spotify/token",
    async (request: FastifyRequest<{ Body: TokenExchangeBody }>, reply: FastifyReply) => {
      try {
        const { code, redirectUri } = request.body;

        if (!code || !redirectUri) {
          logger.warn({ 
            hasCode: !!code, 
            hasRedirectUri: !!redirectUri 
          }, "Token exchange missing required parameters");
          return reply.status(400).send({
            error: {
              code: "MISSING_PARAMS",
              message: "code and redirectUri are required",
            },
          });
        }

        const clientId = process.env.SPOTIFY_CLIENT_ID;
        const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

        if (!clientId || !clientSecret) {
          logger.error({ 
            hasClientId: !!clientId, 
            hasClientSecret: !!clientSecret,
            envKeys: Object.keys(process.env).filter(key => key.includes('SPOTIFY'))
          }, "Spotify credentials not configured");
          return reply.status(500).send({
            error: {
              code: "SERVER_ERROR",
              message: "Spotify integration not configured. Check server .env file.",
            },
          });
        }

        // Log request details (without exposing sensitive data)
        logger.info({ 
          codeLength: code.length,
          redirectUri,
          clientIdLength: clientId.length,
          hasClientSecret: !!clientSecret
        }, "Processing token exchange request");

        // Exchange code for tokens
        const tokenResponse = await fetch(SPOTIFY_TOKEN_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
          },
          body: new URLSearchParams({
            grant_type: "authorization_code",
            code,
            redirect_uri: redirectUri,
          }),
        });

        if (!tokenResponse.ok) {
          const errorText = await tokenResponse.text();
          
          // Parse error details for better logging
          let errorDetails: any = {};
          let errorMessage = "Failed to exchange authorization code";
          
          try {
            const errorData = JSON.parse(errorText);
            errorDetails = errorData;
            if (errorData.error_description) {
              errorMessage = errorData.error_description;
            } else if (errorData.error) {
              errorMessage = errorData.error;
            }
          } catch {
            // If parsing fails, use the raw text if it's short enough
            if (errorText.length < 200) {
              errorMessage = errorText;
            }
          }
          
          // Enhanced error logging with context
          logger.error({ 
            status: tokenResponse.status,
            statusText: tokenResponse.statusText,
            error: errorDetails,
            errorText: errorText.length > 500 ? errorText.substring(0, 500) + '...' : errorText,
            redirectUri,
            codePrefix: code.substring(0, 10) + '...',
            // Check for common issues
            possibleIssues: {
              redirectUriMismatch: errorMessage.toLowerCase().includes('redirect_uri') || errorMessage.toLowerCase().includes('redirect'),
              invalidCode: errorMessage.toLowerCase().includes('code') || errorMessage.toLowerCase().includes('invalid'),
              expiredCode: errorMessage.toLowerCase().includes('expired'),
            }
          }, "Token exchange failed with Spotify API");
          
          // Provide more helpful error messages based on common issues
          if (errorMessage.toLowerCase().includes('redirect_uri') || errorMessage.toLowerCase().includes('redirect')) {
            errorMessage = `Redirect URI mismatch. Expected: ${redirectUri}. Make sure the redirect URI in your Spotify app settings matches exactly.`;
          } else if (errorMessage.toLowerCase().includes('code') || errorMessage.toLowerCase().includes('invalid')) {
            errorMessage = `Invalid authorization code. This may happen if the code was already used or expired. Please try connecting again.`;
          }
          
          return reply.status(tokenResponse.status).send({
            error: {
              code: "TOKEN_EXCHANGE_FAILED",
              message: errorMessage,
            },
          });
        }

        const tokenData = await tokenResponse.json();

        // Log success but never expose tokens
        logger.info("Token exchange successful");

        // Return tokens (client will store in IndexedDB)
        return reply.send({
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token,
          expiresIn: tokenData.expires_in,
        });
      } catch (error) {
        logger.error(
          {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
          },
          "Error in token exchange"
        );
        return reply.status(500).send({
          error: {
            code: "INTERNAL_ERROR",
            message: "An error occurred during token exchange",
          },
        });
      }
    }
  );
}

