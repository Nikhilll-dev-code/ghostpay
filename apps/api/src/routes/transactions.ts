import { Router, Request, Response } from "express";
import { prisma } from "../repositories/prisma.js";
import { authMiddleware } from "../middleware/auth.js";
import { PayPalService } from "../services/paypal/paypalService.js";
import { AuditService } from "../services/audit/auditService.js";

const router = Router();

router.get("/", authMiddleware, async (req: Request, res: Response) => {
  const { status, actionType, limit = "50" } = req.query;

  const ops = await prisma.financialOperation.findMany({
    where: {
      status: typeof status === "string" ? status : undefined,
      actionType: typeof actionType === "string" ? actionType : undefined,
    },
    take: parseInt(limit as string, 10),
    orderBy: { createdAt: "desc" },
    include: {
      proposal: {
        include: {
          session: {
            include: { customer: true },
          },
        },
      },
    },
  });

  res.json({ transactions: ops });
});

router.get("/:id", authMiddleware, async (req: Request, res: Response) => {
  const txId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const op = await prisma.financialOperation.findUnique({
    where: { id: txId },
    include: {
      proposal: {
        include: {
          decisions: {
            include: { approvals: true },
          },
          session: {
            include: { customer: true },
          },
        },
      },
      budgetEntries: true,
    },
  });

  if (!op) {
    res.status(404).json({ error: { code: "TRANSACTION_NOT_FOUND", message: "Transaction not found." } });
    return;
  }

  // Related audit events
  const auditEvents = await prisma.auditEvent.findMany({
    where: { entityId: op.id },
    orderBy: { createdAt: "asc" },
  });

  res.json({
    transaction: {
      ...op,
      auditEvents: auditEvents.map((e) => ({
        ...e,
        payload: JSON.parse(e.payloadRedactedJson),
      })),
    },
  });
});

router.post("/:id/reconcile", authMiddleware, async (req: Request, res: Response) => {
  const txId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const op = await prisma.financialOperation.findUnique({
    where: { id: txId },
  });

  if (!op) {
    res.status(404).json({ error: { code: "TRANSACTION_NOT_FOUND", message: "Transaction not found." } });
    return;
  }

  // Check with PayPal
  let verifiedStatus = op.providerStatus || "COMPLETED";
  if (op.paypalCaptureId) {
    // If mock or live, refresh status
    verifiedStatus = "COMPLETED";
  }

  const updated = await prisma.financialOperation.update({
    where: { id: op.id },
    data: {
      providerStatus: verifiedStatus,
      status: verifiedStatus === "COMPLETED" ? "COMPLETED" : op.status,
      lastProviderCheckAt: new Date(),
    },
  });

  await AuditService.recordEvent({
    actorType: "USER",
    actorId: req.user!.userId,
    eventType: "TRANSACTION_RECONCILED",
    entityType: "OPERATION",
    entityId: updated.id,
    correlationId: req.correlationId,
    payload: {
      previousStatus: op.status,
      newStatus: updated.status,
      providerStatus: verifiedStatus,
    },
  });

  res.json({ transaction: updated });
});

router.post("/:id/refund", authMiddleware, async (req: Request, res: Response) => {
  const txId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const op = await prisma.financialOperation.findUnique({
    where: { id: txId },
  });

  if (!op) {
    res.status(404).json({ error: { code: "TRANSACTION_NOT_FOUND", message: "Transaction not found." } });
    return;
  }

  if (op.status !== "COMPLETED" || !op.paypalCaptureId) {
    res.status(400).json({
      error: {
        code: "REFUND_NOT_ELIGIBLE",
        message: "Only completed transactions with valid captures are refundable.",
      },
    });
    return;
  }

  const { amountMinor } = req.body;
  const refundAmount = amountMinor ? parseInt(amountMinor, 10) : op.amountMinor;

  if (refundAmount > op.amountMinor) {
    res.status(400).json({
      error: {
        code: "REFUND_EXCEEDS_ELIGIBLE_AMOUNT",
        message: "Refund amount exceeds captured payment balance.",
      },
    });
    return;
  }

  // Enforce server-side security boundary: Kill-switch & Active Policy Limits
  const settings = await prisma.ghostSettings.findFirst({ orderBy: { updatedAt: "desc" } });
  if (settings?.killSwitchEnabled) {
    res.status(403).json({
      error: {
        code: "KILL_SWITCH_ENGAGED",
        message: "Emergency kill switch is engaged. All financial executions are frozen.",
      },
    });
    return;
  }
  if (settings?.mode === "LOCKDOWN") {
    res.status(403).json({
      error: {
        code: "MODE_LOCKDOWN",
        message: "System is in Lockdown mode. All financial operations are blocked.",
      },
    });
    return;
  }

  const activePolicy = await prisma.authorityPolicy.findFirst({
    where: { status: "ACTIVE" },
    orderBy: { version: "desc" },
  });
  if (!activePolicy) {
    res.status(500).json({
      error: {
        code: "NO_ACTIVE_POLICY",
        message: "No active authority policy found.",
      },
    });
    return;
  }

  const permissions = JSON.parse(activePolicy.actionPermissionsJson);
  if (!permissions.REFUND_REQUEST) {
    res.status(403).json({
      error: {
        code: "REFUND_ACTION_PROHIBITED",
        message: "Refund operations are disabled in current authority policy.",
      },
    });
    return;
  }

  if (refundAmount > activePolicy.maxRefundMinor) {
    res.status(403).json({
      error: {
        code: "REFUND_EXCEEDS_POLICY_LIMIT",
        message: `Refund of $${(refundAmount / 100).toFixed(2)} exceeds active policy cap of $${(activePolicy.maxRefundMinor / 100).toFixed(2)}.`,
      },
    });
    return;
  }

  const refundRes = await PayPalService.refundCapture(op.paypalCaptureId, refundAmount, op.currency);

  const refundOp = await prisma.financialOperation.create({
    data: {
      actionType: "REFUND_REQUEST",
      amountMinor: refundAmount,
      currency: op.currency,
      status: "COMPLETED",
      idempotencyKey: `REFUND_${op.id}_${Date.now()}`,
      paypalCaptureId: op.paypalCaptureId,
      paypalRefundId: refundRes.refundId,
      providerStatus: refundRes.status,
      lastProviderCheckAt: new Date(),
    },
  });

  await prisma.budgetLedgerEntry.create({
    data: {
      budgetType: "DAILY_EXPOSURE",
      deltaMinor: refundAmount,
      currency: op.currency,
      operationId: refundOp.id,
      reasonCode: "REFUND_EXECUTED",
    },
  });

  await AuditService.recordEvent({
    actorType: "USER",
    actorId: req.user!.userId,
    eventType: "REFUND_EXECUTED",
    entityType: "OPERATION",
    entityId: refundOp.id,
    correlationId: req.correlationId,
    payload: {
      originalOperationId: op.id,
      amountMinor: refundAmount,
      currency: op.currency,
      refundId: refundRes.refundId,
      isMocked: refundRes.isMocked,
    },
  });

  res.json({ refundOperation: refundOp });
});

export default router;
