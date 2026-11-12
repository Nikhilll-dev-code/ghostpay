import { Router, Request, Response } from "express";
import { authorityPolicySchema } from "@ghost/shared";
import { prisma } from "../repositories/prisma.js";
import { authMiddleware } from "../middleware/auth.js";
import { SimulationService } from "../services/simulation/simulationService.js";
import { AuditService } from "../services/audit/auditService.js";

const router = Router();

router.post("/", authMiddleware, async (req: Request, res: Response) => {
  const proposedPolicyInput = authorityPolicySchema.parse(req.body);

  const activePolicy = await prisma.authorityPolicy.findFirst({
    where: { status: "ACTIVE" },
    orderBy: { version: "desc" },
  });

  if (!activePolicy) {
    res.status(500).json({ error: { code: "NO_ACTIVE_POLICY", message: "No active baseline policy found." } });
    return;
  }

  const baselinePolicy = {
    ...activePolicy,
    actionPermissions: JSON.parse(activePolicy.actionPermissionsJson),
    riskRules: JSON.parse(activePolicy.riskRulesJson),
  };

  const proposedPolicy = {
    id: "sim-proposed",
    version: baselinePolicy.version + 1,
    status: "DRAFT" as const,
    actionPermissions: proposedPolicyInput.actionPermissions,
    maxPaymentMinor: proposedPolicyInput.maxPaymentMinor,
    maxRefundMinor: proposedPolicyInput.maxRefundMinor,
    maxDiscountBasisPoints: proposedPolicyInput.maxDiscountBasisPoints,
    dailyExposureMinor: proposedPolicyInput.dailyExposureMinor,
    maxCustomerExposureMinor: proposedPolicyInput.maxCustomerExposureMinor,
    maxActionsPerMinute: proposedPolicyInput.maxActionsPerMinute,
    riskBudgetUnits: proposedPolicyInput.riskBudgetUnits,
    riskRules: proposedPolicyInput.riskRules,
    createdBy: req.user!.userId,
    createdAt: new Date().toISOString(),
  };

  // Replay simulation without calling PayPal
  const comparison = SimulationService.runComparison(baselinePolicy as any, proposedPolicy as any);

  // Record simulation run
  const runRecord = await prisma.simulationRun.create({
    data: {
      createdBy: req.user!.userId,
      baselinePolicyVersion: baselinePolicy.version,
      proposedPolicyJson: JSON.stringify(proposedPolicy),
      fixtureSetVersion: "v1.0-standard",
      resultsJson: JSON.stringify(comparison),
      status: "COMPLETED",
    },
  });

  await AuditService.recordEvent({
    actorType: "USER",
    actorId: req.user!.userId,
    eventType: "SIMULATION_REPLAY_COMPLETED",
    entityType: "SIMULATION",
    entityId: runRecord.id,
    correlationId: req.correlationId,
    payload: {
      baselinePolicyVersion: baselinePolicy.version,
      fixturesCount: comparison.fixtureCount,
      allowedDelta: comparison.delta.allowedDelta,
      blockedDelta: comparison.delta.blockedDelta,
      synthetic: true,
    },
  });

  res.json({
    simulationRunId: runRecord.id,
    comparison,
  });
});

export default router;
