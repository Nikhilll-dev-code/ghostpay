import { Router, Request, Response } from "express";
import { AuditService } from "../services/audit/auditService.js";
import { authMiddleware } from "../middleware/auth.js";

const router = Router();

router.get("/events", authMiddleware, async (req: Request, res: Response) => {
  const { eventType, entityType, correlationId, limit } = req.query;

  const events = await AuditService.queryEvents({
    eventType: typeof eventType === "string" ? eventType : undefined,
    entityType: typeof entityType === "string" ? entityType : undefined,
    correlationId: typeof correlationId === "string" ? correlationId : undefined,
    limit: limit ? parseInt(limit as string, 10) : 50,
  });

  res.json({ events });
});

export default router;
