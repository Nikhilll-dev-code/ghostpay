import { Router, Request, Response } from "express";
import { authorityPolicySchema } from "@ghost/shared";
import { prisma } from "../repositories/prisma.js";
import { authMiddleware, ownerOnlyMiddleware } from "../middleware/auth.js";
import { AuditService } from "../services/audit/auditService.js";

const router = Router();

router.get("/policies", authMiddleware, async (req: Request, res: Response) => {
  const policies = await prisma.authorityPolicy.findMany({
    orderBy: { version: "desc" },
  });

  const parsed = policies.map((p) => ({
    ...p,
    actionPermissions: JSON.parse(p.actionPermissionsJson),
    riskRules: JSON.parse(p.riskRulesJson),
  }));

  res.json({ policies: parsed });
});

router.get("/policies/:version", authMiddleware, async (req: Request, res: Response) => {
  const versionParam = Array.isArray(req.params.version) ? req.params.version[0] : req.params.version;
  const version = parseInt(versionParam, 10);
  const policy = await prisma.authorityPolicy.findUnique({
    where: { version },
  });

  if (!policy) {
    res.status(404).json({
      error: {
        code: "POLICY_NOT_FOUND",
        message: `Policy version ${version} not found.`,
        requestId: req.correlationId,
      },
    });
    return;
  }

  res.json({
    policy: {
      ...policy,
      actionPermissions: JSON.parse(policy.actionPermissionsJson),
      riskRules: JSON.parse(policy.riskRulesJson),
    },
  });
});

router.post("/drafts", authMiddleware, ownerOnlyMiddleware, async (req: Request, res: Response) => {
  const data = authorityPolicySchema.parse(req.body);

  const highest = await prisma.authorityPolicy.findFirst({
    orderBy: { version: "desc" },
  });
  const nextVersion = (highest?.version || 0) + 1;

  const draft = await prisma.authorityPolicy.create({
    data: {
      version: nextVersion,
      status: "DRAFT",
      actionPermissionsJson: JSON.stringify(data.actionPermissions),
      maxPaymentMinor: data.maxPaymentMinor,
      maxRefundMinor: data.maxRefundMinor,
      maxDiscountBasisPoints: data.maxDiscountBasisPoints,
      dailyExposureMinor: data.dailyExposureMinor,
      maxCustomerExposureMinor: data.maxCustomerExposureMinor,
      maxActionsPerMinute: data.maxActionsPerMinute,
      riskBudgetUnits: data.riskBudgetUnits,
      riskRulesJson: JSON.stringify(data.riskRules),
      createdBy: req.user!.userId,
      changeReason: data.changeReason || "Draft policy",
    },
  });

  await AuditService.recordEvent({
    actorType: "USER",
    actorId: req.user!.userId,
    eventType: "POLICY_DRAFT_CREATED",
    entityType: "POLICY",
    entityId: draft.id,
    correlationId: req.correlationId,
    payload: { version: draft.version, changeReason: draft.changeReason },
  });

  res.json({
    draft: {
      ...draft,
      actionPermissions: JSON.parse(draft.actionPermissionsJson),
      riskRules: JSON.parse(draft.riskRulesJson),
    },
  });
});

router.post("/drafts/:id/publish", authMiddleware, ownerOnlyMiddleware, async (req: Request, res: Response) => {
  const draftId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const draft = await prisma.authorityPolicy.findUnique({
    where: { id: draftId },
  });

  if (!draft) {
    res.status(404).json({
      error: {
        code: "DRAFT_NOT_FOUND",
        message: "Policy draft not found.",
        requestId: req.correlationId,
      },
    });
    return;
  }

  // Archive previously active policy
  await prisma.authorityPolicy.updateMany({
    where: { status: "ACTIVE" },
    data: { status: "ARCHIVED" },
  });

  // Activate the draft (immutable once active)
  const published = await prisma.authorityPolicy.update({
    where: { id: draft.id },
    data: {
      status: "ACTIVE",
      publishedAt: new Date(),
    },
  });

  await AuditService.recordEvent({
    actorType: "USER",
    actorId: req.user!.userId,
    eventType: "POLICY_PUBLISHED",
    entityType: "POLICY",
    entityId: published.id,
    correlationId: req.correlationId,
    payload: {
      version: published.version,
      publishedBy: req.user!.email,
      changeReason: published.changeReason,
    },
  });

  res.json({
    policy: {
      ...published,
      actionPermissions: JSON.parse(published.actionPermissionsJson),
      riskRules: JSON.parse(published.riskRulesJson),
    },
  });
});

export default router;
