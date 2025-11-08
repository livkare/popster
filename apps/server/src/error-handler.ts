import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import { logger } from "./logger.js";

/**
 * Register error handler plugin for Fastify.
 * Handles HTTP errors and formats them consistently.
 */
export async function registerErrorHandler(fastify: any): Promise<void> {
  fastify.setErrorHandler((error: FastifyError, request: FastifyRequest, reply: FastifyReply) => {
    // Log the error
    logger.error(
      {
        error: error.message,
        stack: error.stack,
        statusCode: error.statusCode,
        code: error.code,
        method: request.method,
        url: request.url,
      },
      "HTTP error occurred"
    );

    // Determine status code
    const statusCode = error.statusCode || 500;

    // Don't expose internal error details in production
    const message =
      statusCode === 500 && process.env.NODE_ENV === "production"
        ? "Internal Server Error"
        : error.message;

    // Send error response
    reply.status(statusCode).send({
      error: {
        code: error.code || "INTERNAL_ERROR",
        message,
        ...(process.env.NODE_ENV !== "production" && { stack: error.stack }),
      },
    });
  });
}

