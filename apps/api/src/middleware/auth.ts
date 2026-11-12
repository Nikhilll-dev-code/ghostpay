import { Request, Response, NextFunction } from "express";
import { verifyJwtToken, JwtUserPayload } from "../utils/crypto.js";
import { prisma } from "../repositories/prisma.js";

declare global {
  namespace Express {
    interface Request {
      user?: JwtUserPayload;
    }
  }
}

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  let token: string | undefined;

  // 1. Authorization Bearer header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.substring(7);
  } else if (req.cookies && req.cookies.ghost_token) {
    // 2. Cookie fallback
    token = req.cookies.ghost_token;
  }

  if (!token) {
    res.status(401).json({
      error: {
        code: "UNAUTHENTICATED",
        message: "Authentication token is required to access this resource.",
        requestId: req.correlationId,
      },
    });
    return;
  }

  try {
    const payload = verifyJwtToken(token);
    // Verify user exists and is active
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, email: true, role: true, status: true },
    });

    if (!user || user.status !== "ACTIVE") {
      res.status(401).json({
        error: {
          code: "ACCOUNT_INACTIVE",
          message: "User account is disabled or does not exist.",
          requestId: req.correlationId,
        },
      });
      return;
    }

    req.user = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };
    next();
  } catch (err) {
    res.status(401).json({
      error: {
        code: "INVALID_TOKEN",
        message: "Authentication token is invalid or expired.",
        requestId: req.correlationId,
      },
    });
  }
}

export function ownerOnlyMiddleware(req: Request, res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== "OWNER") {
    res.status(403).json({
      error: {
        code: "FORBIDDEN",
        message: "This operation requires OWNER privileges.",
        requestId: req.correlationId,
      },
    });
    return;
  }
  next();
}
