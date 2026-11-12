import { Router, Request, Response } from "express";
import { loginSchema } from "@ghost/shared";
import { prisma } from "../repositories/prisma.js";
import { verifyPassword, createJwtToken } from "../utils/crypto.js";
import { authMiddleware } from "../middleware/auth.js";
import { AuditService } from "../services/audit/auditService.js";

const router = Router();

router.post("/login", async (req: Request, res: Response) => {
  const { email, password } = loginSchema.parse(req.body);

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.status !== "ACTIVE") {
    await AuditService.recordEvent({
      actorType: "SYSTEM",
      eventType: "AUTH_LOGIN_FAILED",
      entityType: "USER",
      entityId: email,
      correlationId: req.correlationId,
      payload: { reason: "USER_NOT_FOUND_OR_INACTIVE", email },
    });

    res.status(401).json({
      error: {
        code: "INVALID_CREDENTIALS",
        message: "Invalid email or password.",
        requestId: req.correlationId,
      },
    });
    return;
  }

  const isValid = await verifyPassword(password, user.passwordHash);
  if (!isValid) {
    await AuditService.recordEvent({
      actorType: "SYSTEM",
      eventType: "AUTH_LOGIN_FAILED",
      entityType: "USER",
      entityId: user.id,
      correlationId: req.correlationId,
      payload: { reason: "PASSWORD_MISMATCH", email },
    });

    res.status(401).json({
      error: {
        code: "INVALID_CREDENTIALS",
        message: "Invalid email or password.",
        requestId: req.correlationId,
      },
    });
    return;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  const token = createJwtToken({
    userId: user.id,
    email: user.email,
    role: user.role,
  });

  res.cookie("ghost_token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 8 * 3600 * 1000,
  });

  await AuditService.recordEvent({
    actorType: "USER",
    actorId: user.id,
    eventType: "AUTH_LOGIN_SUCCESS",
    entityType: "USER",
    entityId: user.id,
    correlationId: req.correlationId,
    payload: { role: user.role, email: user.email },
  });

  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
    },
  });
});

router.post("/logout", authMiddleware, async (req: Request, res: Response) => {
  res.clearCookie("ghost_token");
  if (req.user) {
    await AuditService.recordEvent({
      actorType: "USER",
      actorId: req.user.userId,
      eventType: "AUTH_LOGOUT",
      entityType: "USER",
      entityId: req.user.userId,
      correlationId: req.correlationId,
      payload: { email: req.user.email },
    });
  }
  res.json({ success: true, message: "Logged out successfully" });
});

router.get("/me", authMiddleware, async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.userId },
    select: { id: true, email: true, role: true, createdAt: true, lastLoginAt: true },
  });
  res.json({ user });
});

export default router;
