import { config } from "../config/index.js";

const SENSITIVE_KEYS = new Set([
  "password",
  "passwordhash",
  "secret",
  "clientsecret",
  "token",
  "accesstoken",
  "refreshtoken",
  "sessionsecret",
  "authorization",
  "cookie",
  "cvv",
  "cardnumber",
  "creditcard",
]);

export function redactSensitiveData(obj: unknown): Record<string, unknown> {
  if (obj === null || typeof obj !== "object") {
    return { value: obj };
  }

  if (Array.isArray(obj)) {
    return { items: obj.map(redactSensitiveData) };
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    const lowerKey = key.toLowerCase().replace(/[^a-z]/g, "");
    if (SENSITIVE_KEYS.has(lowerKey)) {
      result[key] = "[REDACTED]";
    } else if (typeof value === "object" && value !== null) {
      result[key] = redactSensitiveData(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

export const logger = {
  debug: (message: string, context: Record<string, unknown> = {}) => {
    if (config.LOG_LEVEL === "debug") {
      console.debug(JSON.stringify({ level: "debug", message, ...redactSensitiveData(context) }));
    }
  },
  info: (message: string, context: Record<string, unknown> = {}) => {
    console.info(JSON.stringify({ level: "info", message, ...redactSensitiveData(context) }));
  },
  warn: (message: string, context: Record<string, unknown> = {}) => {
    console.warn(JSON.stringify({ level: "warn", message, ...redactSensitiveData(context) }));
  },
  error: (message: string, context: Record<string, unknown> = {}) => {
    console.error(JSON.stringify({ level: "error", message, ...redactSensitiveData(context) }));
  },
};
