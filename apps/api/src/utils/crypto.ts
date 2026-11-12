import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { canonicalizeJson } from "@ghost/shared";
import { config } from "../config/index.js";

export function hashPayload(payload: unknown): string {
  const canonical = canonicalizeJson(payload);
  return crypto.createHash("sha256").update(canonical).digest("hex");
}

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export interface JwtUserPayload {
  userId: string;
  email: string;
  role: string;
}

export function createJwtToken(payload: JwtUserPayload, expiresIn: string = "8h"): string {
  return jwt.sign(payload, config.SESSION_SECRET, { expiresIn } as jwt.SignOptions);
}

export function verifyJwtToken(token: string): JwtUserPayload {
  return jwt.verify(token, config.SESSION_SECRET) as JwtUserPayload;
}
