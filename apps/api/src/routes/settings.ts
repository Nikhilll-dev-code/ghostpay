import { Router, Request, Response } from "express";
import { updateModeSchema, freezeGhostSchema, unfreezeGhostSchema } from "@ghost/shared";
import { prisma } from "../repositories/prisma.js";
import { authMiddleware, ownerOnlyMiddleware } from "../middleware/auth.js";
import { AuditService } from "../services/audit/auditService.js";
import { PayPalService } from "../services/paypal/paypalService.js";

const router = Router();

router.get("/ghost", authMiddleware, async (req: Request, res: Response) => {
  const settings = await prisma.ghostSettings.findFirst({
    orderBy: { updatedAt: "desc" },
  });
  res.json({ settings });
});

router.patch("/ghost/mode", authMiddleware, ownerOnlyMiddleware, async (req: Request, res: Response) => {
  const { mode, reason } = updateModeSchema.parse(req.body);
  const current = await prisma.ghostSettings.findFirst({ orderBy: { updatedAt: "desc" } });

  const updated = await prisma.ghostSettings.update({
    where: { id: current!.id },
    data: {
      mode,
      updatedBy: req.user!.userId,
      version: { increment: 1 },
    },
  });

  await AuditService.recordEvent({
    actorType: "USER",
    actorId: req.user!.userId,
    eventType: "GHOST_MODE_CHANGED",
    entityType: "SETTINGS",
    entityId: updated.id,
    correlationId: req.correlationId,
    payload: {
      previousMode: current?.mode,
      newMode: mode,
      reason: reason || "User mode update",
    },
  });

  res.json({ settings: updated });
});

router.post("/ghost/freeze", authMiddleware, ownerOnlyMiddleware, async (req: Request, res: Response) => {
  const { reason } = freezeGhostSchema.parse(req.body);
  const current = await prisma.ghostSettings.findFirst({ orderBy: { updatedAt: "desc" } });

  const updated = await prisma.ghostSettings.update({
    where: { id: current!.id },
    data: {
      killSwitchEnabled: true,
      killSwitchReason: reason,
      updatedBy: req.user!.userId,
      version: { increment: 1 },
    },
  });

  await AuditService.recordEvent({
    actorType: "USER",
    actorId: req.user!.userId,
    eventType: "KILL_SWITCH_ENGAGED",
    entityType: "SETTINGS",
    entityId: updated.id,
    correlationId: req.correlationId,
    payload: {
      reason,
      engagedBy: req.user!.email,
    },
  });

  res.json({ settings: updated });
});

router.post("/ghost/unfreeze", authMiddleware, ownerOnlyMiddleware, async (req: Request, res: Response) => {
  const { reason } = unfreezeGhostSchema.parse(req.body);
  const current = await prisma.ghostSettings.findFirst({ orderBy: { updatedAt: "desc" } });

  const updated = await prisma.ghostSettings.update({
    where: { id: current!.id },
    data: {
      killSwitchEnabled: false,
      killSwitchReason: null,
      updatedBy: req.user!.userId,
      version: { increment: 1 },
    },
  });

  await AuditService.recordEvent({
    actorType: "USER",
    actorId: req.user!.userId,
    eventType: "KILL_SWITCH_DISENGAGED",
    entityType: "SETTINGS",
    entityId: updated.id,
    correlationId: req.correlationId,
    payload: {
      reason,
      disengagedBy: req.user!.email,
    },
  });

  res.json({ settings: updated });
});

router.get("/paypal/status", authMiddleware, async (req: Request, res: Response) => {
  const result = await PayPalService.testConnection();
  res.json({ paypal: result });
});

router.post("/paypal/test", authMiddleware, async (req: Request, res: Response) => {
  const result = await PayPalService.testConnection();
  await AuditService.recordEvent({
    actorType: "USER",
    actorId: req.user!.userId,
    eventType: "PAYPAL_CONNECTION_TESTED",
    entityType: "SETTINGS",
    entityId: "paypal",
    correlationId: req.correlationId,
    payload: {
      status: result.status,
      latencyMs: result.latencyMs,
      environment: result.environment,
    },
  });
  res.json({ paypal: result });
});

export default router;
