import type { FastifyReply, FastifyRequest } from "fastify";

/**
 * Register health check endpoint.
 * GET /health
 */
export async function registerHealthRoute(fastify: any): Promise<void> {
  fastify.get("/health", async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({ status: "ok" });
  });
}

