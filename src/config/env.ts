import dotenv from "dotenv";

dotenv.config();

function requireEnv(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 3100),
  bankingApiBaseUrl: requireEnv("BANKING_API_BASE_URL", "https://btq03nn21b.execute-api.eu-central-1.amazonaws.com"),
  bankingApiKey: requireEnv("BANKING_API_KEY", "demo-token"),
  bankingApiTimeoutMs: Number(process.env.BANKING_API_TIMEOUT_MS ?? 8000),
  sqliteDbPath: requireEnv("SQLITE_DB_PATH", "./data/dev.db")
};

