import Fastify, { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import { logger } from "./config/logger";
import { NotFoundError, UpstreamApiError, ValidationError } from "./domain/errors";
import { registerHealthRoutes } from "./routes/health.route";
import { registerReliabilityRoutes } from "./routes/reliability.route";
import { registerSyncRoutes } from "./routes/sync.route";

export function buildApp(): FastifyInstance {
  const app = Fastify({ logger: false });

  app.addHook("onRequest", async (request, reply) => {
    const headerValue = request.headers["x-correlation-id"];
    const correlationId = typeof headerValue === "string" && headerValue.length > 0 ? headerValue : randomUUID();

    reply.header("x-correlation-id", correlationId);
  });

  app.addHook("onResponse", async (request, reply) => {
    const correlationId = String(reply.getHeader("x-correlation-id") ?? request.id);
    logger.info("Request completed", {
      correlation_id: correlationId,
      method: request.method,
      path: request.url,
      status_code: reply.statusCode
    });
  });

  app.setErrorHandler((error, request, reply) => {
    const correlationId = String(reply.getHeader("x-correlation-id") ?? request.id);
    logger.error("Request failed", {
      correlation_id: correlationId,
      method: request.method,
      path: request.url,
      error: error.message
    });

    if (error instanceof ValidationError) {
      return reply.status(400).send({ error: error.message });
    }

    if (error instanceof NotFoundError) {
      return reply.status(404).send({ error: error.message });
    }

    if (error instanceof UpstreamApiError) {
      return reply.status(502).send({ error: "Upstream Banking API Error" });
    }

    return reply.status(500).send({ error: "Internal Server Error" });
  });

  registerHealthRoutes(app);
  registerSyncRoutes(app);
  registerReliabilityRoutes(app);

  return app;
}

