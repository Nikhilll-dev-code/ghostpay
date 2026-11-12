import { Router, Request, Response } from "express";
import { prisma } from "../repositories/prisma.js";
import { authMiddleware, ownerOnlyMiddleware } from "../middleware/auth.js";
import { ApprovalService } from "../services/approvals/approvalService.js";
import { AuditService } from "../services/audit/auditService.js";

const router = Router();

router.get("/", authMiddleware, async (req: Request, res: Response) => {
  const status = req.query.status as string | undefined;

  const approvals = await prisma.approval.findMany({
    where: {
      status: status || undefined,
    },
    include: {
      decision: {
        include: {
          proposal: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const parsed = approvals.map((a) => ({
    ...a,
    decision: {
      ...a.decision,
      checks: JSON.parse(a.decision.checksJson),
      reasonCodes: JSON.parse(a.decision.reasonCodesJson),
      proposal: {
        ...a.decision.proposal,
        payload: JSON.parse(a.decision.proposal.canonicalPayloadJson),
      },
    },
  }));

  res.json({ approvals: parsed });
});

router.post("/:id/approve", authMiddleware, ownerOnlyMiddleware, async (req: Request, res: Response) => {
  const approvalId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const approval = await ApprovalService.approveApproval(approvalId, req.user!.userId);

  await AuditService.recordEvent({
    actorType: "USER",
    actorId: req.user!.userId,
    eventType: "APPROVAL_GRANTED",
    entityType: "APPROVAL",
    entityId: approval.id,
    correlationId: req.correlationId,
    payload: {
      approvalId: approval.id,
      decisionId: approval.decisionId,
      payloadHash: approval.payloadHash,
    },
  });

  res.json({ approval });
});

router.post("/:id/reject", authMiddleware, ownerOnlyMiddleware, async (req: Request, res: Response) => {
  const approvalId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const approval = await ApprovalService.rejectApproval(approvalId, req.user!.userId);

  await AuditService.recordEvent({
    actorType: "USER",
    actorId: req.user!.userId,
    eventType: "APPROVAL_REJECTED",
    entityType: "APPROVAL",
    entityId: approval.id,
    correlationId: req.correlationId,
    payload: {
      approvalId: approval.id,
      decisionId: approval.decisionId,
    },
  });

  res.json({ approval });
});

export default router;
