import { FastifyInstance } from "fastify";
import { reliabilityController } from "../controllers/reliability.controller";

export async function registerReliabilityRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/users/:userId/reliability", reliabilityController);
}

