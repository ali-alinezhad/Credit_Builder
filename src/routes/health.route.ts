import { FastifyInstance } from "fastify";
import { healthController } from "../controllers/health.controller";

export async function registerHealthRoutes(app: FastifyInstance): Promise<void> {
  app.get("/health", healthController);
}

