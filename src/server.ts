import { env } from "./config/env";
import { logger } from "./config/logger";
import { getDb } from "./infrastructure/db";
import { buildApp } from "./app";

async function start(): Promise<void> {
  getDb();

  const app = buildApp();
  try {
    await app.listen({ port: env.port, host: "0.0.0.0" });
    logger.info("Server started", { port: env.port });
  } catch (error) {
    logger.error("Server startup failed", {
      error: error instanceof Error ? error.message : String(error)
    });
    process.exit(1);
  }
}

start();

