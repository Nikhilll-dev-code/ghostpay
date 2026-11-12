import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { logger } from "../utils/logger.js";

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
) {
  const correlationId = req.correlationId || "unknown";

  if (err instanceof ZodError) {
    logger.warn("Validation error", { correlationId, errors: err.errors });
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid request payload schema.",
        requestId: correlationId,
        details: err.flatten(),
      },
    });
    return;
  }

  logger.error("Unhandled server exception", {
    correlationId,
    message: err.message,
    name: err.name,
  });

  res.status(500).json({
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "An internal server error occurred.",
      requestId: correlationId,
    },
  });
}
