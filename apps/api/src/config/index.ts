import dotenv from "dotenv";
import { z } from "zod";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Load root .env or local .env
dotenv.config({ path: path.resolve(__dirname, "../../../../.env") });
dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.string().transform(Number).default("4000"),
  WEB_ORIGIN: z.string().default("http://localhost:5173"),
  DATABASE_URL: z.string().default("file:./dev.db"),
  SESSION_SECRET: z.string().min(16).default("ghost-super-secret-dev-key-must-be-changed-in-prod-32chars"),
  PAYPAL_ENV: z.enum(["sandbox", "live"]).default("sandbox"),
  PAYPAL_CLIENT_ID: z.string().default("mock_client_id_for_sandbox"),
  PAYPAL_CLIENT_SECRET: z.string().default("mock_client_secret_for_sandbox"),
  PAYPAL_WEBHOOK_ID: z.string().default("mock_webhook_id_sandbox"),
  AI_PROVIDER: z.enum(["mock", "openai", "gemini", "anthropic"]).default("mock"),
  AI_API_KEY: z.string().optional().default(""),
  AI_MODEL: z.string().default("mock-policy-agent-v1"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid environment configuration:", parsed.error.format());
  throw new Error("Invalid environment configuration");
}

export const config = parsed.data;
