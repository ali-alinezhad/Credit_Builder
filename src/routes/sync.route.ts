import { FastifyInstance } from "fastify";
import { syncController } from "../controllers/sync.controller";

export async function registerSyncRoutes(app: FastifyInstance): Promise<void> {
  app.post("/api/users/:userId/sync", syncController);
}

