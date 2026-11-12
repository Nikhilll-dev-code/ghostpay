import crypto from "node:crypto";
import { Request, Response, NextFunction } from "express";

declare global {
  namespace Express {
    interface Request {
      correlationId: string;
    }
  }
}

export function correlationMiddleware(req: Request, res: Response, next: NextFunction) {
  const incoming = req.headers["x-request-id"] || req.headers["x-correlation-id"];
  const correlationId = typeof incoming === "string" ? incoming : crypto.randomUUID();
  req.correlationId = correlationId;
  res.setHeader("X-Correlation-ID", correlationId);
  next();
}
