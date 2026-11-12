import crypto from "node:crypto";
import { Router, Request, Response } from "express";
import { createAgentMessageSchema, ACTION_TYPES, DECISION_OUTCOMES, OPERATION_STATUSES } from "@ghost/shared";
import { prisma } from "../repositories/prisma.js";
import { authMiddleware } from "../middleware/auth.js";
import { AIAdapter } from "../services/agent/aiAdapter.js";
import { PolicyEngine, hashProposalPayload } from "../services/policy/policyEngine.js";
import { ApprovalService } from "../services/approvals/approvalService.js";
import { PayPalService } from "../services/paypal/paypalService.js";
import { AuditService } from "../services/audit/auditService.js";

const router = Router();

router.post("/sessions", authMiddleware, async (req: Request, res: Response) => {
  const { customerId } = req.body;
  const session = await prisma.agentSession.create({
    data: {
      customerId: customerId || null,
      status: "ACTIVE",
    },
    include: { customer: true },
  });
  res.json({ session });
});

router.get("/sessions/:id", authMiddleware, async (req: Request, res: Response) => {
  const sessionId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const session = await prisma.agentSession.findUnique({
    where: { id: sessionId },
    include: {
      customer: { include: { facts: true } },
      messages: { orderBy: { createdAt: "asc" } },
      proposals: {
        include: {
          decisions: { include: { approvals: true } },
          operations: true,
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!session) {
    res.status(404).json({
      error: { code: "SESSION_NOT_FOUND", message: "Agent session not found.", requestId: req.correlationId },
    });
    return;
  }

  res.json({ session });
});

router.post("/sessions/:id/messages", authMiddleware, async (req: Request, res: Response) => {
  const { message, customerId, orderId } = createAgentMessageSchema.parse(req.body);
  const sessionId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  const session = await prisma.agentSession.findUnique({
    where: { id: sessionId },
    include: { customer: { include: { facts: true } } },
  });

  if (!session) {
    res.status(404).json({
      error: { code: "SESSION_NOT_FOUND", message: "Agent session not found.", requestId: req.correlationId },
    });
    return;
  }

  // 1. Record customer message
  const customerMsg = await prisma.agentMessage.create({
    data: {
      sessionId,
      role: "CUSTOMER",
      contentRedacted: message,
    },
  });

  // 2. Interpret customer intent deterministically through AIAdapter
  let customerCtx;
  if (session.customer) {
    customerCtx = {
      id: session.customer.id,
      displayName: session.customer.displayName,
      email: session.customer.email || undefined,
      facts: session.customer.facts as any,
      verifiedPurchaseCount: session.customer.facts.filter((f: any) => f.verified).length,
      totalSpendMinor: 25000,
      refundCount: 0,
      openDisputesCount: 0,
    };
  }

  const parseResult = await AIAdapter.interpretCustomerRequest(message, customerCtx, orderId);

  // 3. Save structured ActionProposal
  const payloadHash = hashProposalPayload(parseResult.proposal);
  const proposalRecord = await prisma.actionProposal.create({
    data: {
      sessionId,
      actionType: parseResult.proposal.actionType,
      canonicalPayloadJson: JSON.stringify(parseResult.proposal),
      payloadHash,
      modelName: "deterministic-intent-parser",
      confidence: parseResult.confidence,
    },
  });

  // 4. Ghost reply
  const replyContent = `I have analyzed your request (${parseResult.intent}). Ghost Brain has formulated an action proposal for ${
    parseResult.proposal.actionType
  } with an amount of $${((parseResult.proposal.amountMinor || 0) / 100).toFixed(2)}${
    parseResult.proposal.discountBasisPoints
      ? ` and a ${(parseResult.proposal.discountBasisPoints / 100).toFixed(2)}% discount`
      : ""
  }. Deterministic Trust Engine evaluation is ready.`;

  const ghostMsg = await prisma.agentMessage.create({
    data: {
      sessionId,
      role: "GHOST",
      contentRedacted: replyContent,
      intent: parseResult.intent,
    },
  });

  await AuditService.recordEvent({
    actorType: "AI",
    eventType: "PROPOSAL_FORMULATED",
    entityType: "PROPOSAL",
    entityId: proposalRecord.id,
    correlationId: req.correlationId,
    payload: {
      intent: parseResult.intent,
      actionType: parseResult.proposal.actionType,
      amountMinor: parseResult.proposal.amountMinor,
      discountBasisPoints: parseResult.proposal.discountBasisPoints,
    },
  });

  res.json({
    customerMessage: customerMsg,
    ghostMessage: ghostMsg,
    proposal: {
      ...proposalRecord,
      payload: parseResult.proposal,
    },
  });
});

router.post("/evaluate", authMiddleware, async (req: Request, res: Response) => {
  const { proposalId } = req.body;
  if (!proposalId) {
    res.status(400).json({ error: { code: "MISSING_PROPOSAL_ID", message: "proposalId is required." } });
    return;
  }

  const proposalRecord = await prisma.actionProposal.findUnique({
    where: { id: proposalId },
    include: {
      session: { include: { customer: { include: { facts: true } } } },
    },
  });

  if (!proposalRecord) {
    res.status(404).json({ error: { code: "PROPOSAL_NOT_FOUND", message: "Action proposal not found." } });
    return;
  }

  const settings = await prisma.ghostSettings.findFirst({ orderBy: { updatedAt: "desc" } });
  const activePolicy = await prisma.authorityPolicy.findFirst({
    where: { status: "ACTIVE" },
    orderBy: { version: "desc" },
  });

  if (!activePolicy || !settings) {
    res.status(500).json({ error: { code: "SYSTEM_NOT_CONFIGURED", message: "Active policy or settings missing." } });
    return;
  }

  const proposalObj = JSON.parse(proposalRecord.canonicalPayloadJson);

  // Customer Context
  let customerContext;
  if (proposalRecord.session?.customer) {
    const c = proposalRecord.session.customer;
    customerContext = {
      id: c.id,
      displayName: c.displayName,
      email: c.email || undefined,
      facts: c.facts as any,
      verifiedPurchaseCount: c.facts.filter((f: any) => f.verified).length,
      totalSpendMinor: 25000,
      refundCount: 0,
      openDisputesCount: 0,
    };
  }

  // Calculate remaining daily budget
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const todayEntries = await prisma.budgetLedgerEntry.findMany({
    where: { budgetType: "DAILY_EXPOSURE", createdAt: { gte: startOfDay } },
    select: { deltaMinor: true },
  });
  const dailySpent = todayEntries.reduce((sum, e) => sum + e.deltaMinor, 0);

  const budgetSnapshot = {
    dailySpentMinor: dailySpent,
    dailyRemainingMinor: Math.max(0, activePolicy.dailyExposureMinor - dailySpent),
    customerSpentMinor: 0,
    customerRemainingMinor: activePolicy.maxCustomerExposureMinor,
    actionsInLastMinute: 1,
    riskUnitsConsumedToday: 0,
    riskUnitsRemainingToday: activePolicy.riskBudgetUnits,
  };

  const decisionResult = PolicyEngine.evaluate({
    proposal: proposalObj,
    settings: settings as any,
    policy: {
      ...activePolicy,
      status: activePolicy.status as any,
      createdAt: activePolicy.createdAt.toISOString(),
      publishedAt: activePolicy.publishedAt ? activePolicy.publishedAt.toISOString() : null,
      actionPermissions: JSON.parse(activePolicy.actionPermissionsJson),
      riskRules: JSON.parse(activePolicy.riskRulesJson),
    },
    customerContext,
    budgetSnapshot,
    correlationId: req.correlationId,
  });

  // Save decision
  const decisionRecord = await prisma.decision.create({
    data: {
      proposalId: proposalRecord.id,
      policyVersion: decisionResult.policyVersion,
      outcome: decisionResult.outcome,
      reasonCodesJson: JSON.stringify(decisionResult.reasonCodes),
      checksJson: JSON.stringify(decisionResult.checks),
      riskUnits: decisionResult.riskUnits,
      correlationId: req.correlationId,
    },
  });

  let approvalRecord = null;
  if (decisionResult.outcome === DECISION_OUTCOMES.REQUIRE_APPROVAL) {
    approvalRecord = await ApprovalService.createApproval(
      decisionRecord.id,
      proposalObj,
      req.user!.userId,
      60 // 60 min expiration
    );
  }

  await AuditService.recordEvent({
    actorType: "SYSTEM",
    eventType: "DECISION_EVALUATED",
    entityType: "DECISION",
    entityId: decisionRecord.id,
    correlationId: req.correlationId,
    payload: {
      proposalId: proposalRecord.id,
      outcome: decisionResult.outcome,
      reasonCodes: decisionResult.reasonCodes,
      policyVersion: decisionResult.policyVersion,
    },
  });

  res.json({
    decision: {
      ...decisionRecord,
      reasonCodes: decisionResult.reasonCodes,
      checks: decisionResult.checks,
      canExecute: decisionResult.canExecute,
      approval: approvalRecord,
    },
  });
});

router.post("/execute", authMiddleware, async (req: Request, res: Response) => {
  const { proposalId, decisionId, approvalId } = req.body;

  const proposalRecord = await prisma.actionProposal.findUnique({
    where: { id: proposalId },
  });
  const decisionRecord = await prisma.decision.findUnique({
    where: { id: decisionId },
    include: { approvals: true },
  });

  if (!proposalRecord || !decisionRecord) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Proposal or decision record not found." } });
    return;
  }

  const proposalObj = JSON.parse(proposalRecord.canonicalPayloadJson);

  // Revalidate state immediately before calling payment gateway
  const settings = await prisma.ghostSettings.findFirst({ orderBy: { updatedAt: "desc" } });
  const activePolicy = await prisma.authorityPolicy.findFirst({
    where: { status: "ACTIVE" },
    orderBy: { version: "desc" },
  });

  let approvalObj;
  if (approvalId) {
    const app = await prisma.approval.findUnique({ where: { id: approvalId } });
    if (app) {
      approvalObj = {
        ...app,
        status: app.status as any,
        expiresAt: app.expiresAt.toISOString(),
        decidedAt: app.decidedAt ? app.decidedAt.toISOString() : null,
        createdAt: app.createdAt.toISOString(),
      };
    }
  }

  const recheck = PolicyEngine.evaluate({
    proposal: proposalObj,
    settings: settings as any,
    policy: {
      ...activePolicy!,
      status: activePolicy!.status as any,
      createdAt: activePolicy!.createdAt.toISOString(),
      publishedAt: activePolicy!.publishedAt ? activePolicy!.publishedAt.toISOString() : null,
      actionPermissions: JSON.parse(activePolicy!.actionPermissionsJson),
      riskRules: JSON.parse(activePolicy!.riskRulesJson),
    },
    approval: approvalObj,
    correlationId: req.correlationId,
  });

  if (!recheck.canExecute) {
    res.status(403).json({
      error: {
        code: "EXECUTION_DENIED_RECHECK_FAILED",
        message: "Pre-execution policy revalidation failed.",
        outcome: recheck.outcome,
        reasonCodes: recheck.reasonCodes,
        checks: recheck.checks,
      },
    });
    return;
  }

  // Single-use approval: mark used
  if (approvalId) {
    await ApprovalService.markUsed(approvalId);
  }

  const idempotencyKey = `EXEC_${proposalRecord.id}_${Date.now()}`;
  const amountMinor = proposalObj.amountMinor || 0;
  const currency = proposalObj.currency || "USD";

  // Create FinancialOperation record
  const op = await prisma.financialOperation.create({
    data: {
      proposalId: proposalRecord.id,
      actionType: proposalObj.actionType,
      amountMinor,
      currency,
      status: OPERATION_STATUSES.SUBMITTED,
      idempotencyKey,
    },
  });

  // Call PayPal Sandbox
  let providerStatus = "COMPLETED";
  let paypalOrderId: string | null = null;
  let paypalCaptureId: string | null = null;
  let paypalRefundId: string | null = null;

  try {
    if (proposalObj.actionType === ACTION_TYPES.PURCHASE_CAPTURE || proposalObj.actionType === ACTION_TYPES.DISCOUNT_REQUEST) {
      const order = await PayPalService.createOrder({
        amountMinor,
        currency,
        referenceId: op.id,
      });
      paypalOrderId = order.orderId;

      const capture = await PayPalService.captureOrder(order.orderId);
      paypalCaptureId = capture.captureId;
      providerStatus = capture.status;
    } else if (proposalObj.actionType === ACTION_TYPES.REFUND_REQUEST) {
      const refund = await PayPalService.refundCapture(
        proposalObj.captureId || "SANDBOX_CAP_DEMO1",
        amountMinor,
        currency
      );
      paypalRefundId = refund.refundId;
      providerStatus = refund.status;
    }

    const updatedOp = await prisma.financialOperation.update({
      where: { id: op.id },
      data: {
        status: OPERATION_STATUSES.COMPLETED,
        paypalOrderId,
        paypalCaptureId,
        paypalRefundId,
        providerStatus,
        lastProviderCheckAt: new Date(),
      },
    });

    // Record budget deduction
    await prisma.budgetLedgerEntry.create({
      data: {
        operationId: updatedOp.id,
        budgetType: "DAILY_EXPOSURE",
        deltaMinor: amountMinor,
        currency,
        reasonCode: `${proposalObj.actionType}_EXECUTED`,
      },
    });

    await AuditService.recordEvent({
      actorType: "USER",
      actorId: req.user!.userId,
      eventType: "FINANCIAL_OPERATION_COMPLETED",
      entityType: "OPERATION",
      entityId: updatedOp.id,
      correlationId: req.correlationId,
      payload: {
        actionType: proposalObj.actionType,
        amountMinor,
        currency,
        paypalCaptureId,
        paypalRefundId,
        providerStatus,
      },
    });

    res.json({ operation: updatedOp });
  } catch (err: any) {
    // If PayPal timeout or error occurs, mark PENDING_RECONCILIATION
    const updatedOp = await prisma.financialOperation.update({
      where: { id: op.id },
      data: {
        status: OPERATION_STATUSES.PENDING_RECONCILIATION,
        providerStatus: "UNKNOWN_PENDING_RECONCILIATION",
        lastProviderCheckAt: new Date(),
      },
    });

    await AuditService.recordEvent({
      actorType: "SYSTEM",
      eventType: "OPERATION_ENTERED_RECONCILIATION",
      entityType: "OPERATION",
      entityId: updatedOp.id,
      correlationId: req.correlationId,
      payload: { error: err.message, status: "PENDING_RECONCILIATION" },
    });

    res.json({
      operation: updatedOp,
      warning: "Operation outcome unknown. Safe state preserved: Marked PENDING_RECONCILIATION.",
    });
  }
});

export default router;
