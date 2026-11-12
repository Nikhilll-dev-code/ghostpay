import { Router, Request, Response } from "express";
import { prisma } from "../repositories/prisma.js";
import { authMiddleware } from "../middleware/auth.js";
import { RedTeamService } from "../services/red-team/redTeamService.js";
import { AuditService } from "../services/audit/auditService.js";

const router = Router();

router.post("/runs", authMiddleware, async (req: Request, res: Response) => {
  const settings = await prisma.ghostSettings.findFirst({ orderBy: { updatedAt: "desc" } });
  const activePolicy = await prisma.authorityPolicy.findFirst({
    where: { status: "ACTIVE" },
    orderBy: { version: "desc" },
  });

  if (!activePolicy || !settings) {
    res.status(500).json({ error: { code: "SYSTEM_NOT_CONFIGURED", message: "Policy or settings missing." } });
    return;
  }

  const policy = {
    ...activePolicy,
    actionPermissions: JSON.parse(activePolicy.actionPermissionsJson),
    riskRules: JSON.parse(activePolicy.riskRulesJson),
  };

  // Run the 10-case Ghostbreaker suite
  const summary = await RedTeamService.executeSuite(policy as any, settings as any);

  // Persist run and case results
  const runRecord = await prisma.redTeamRun.create({
    data: {
      suiteVersion: summary.suiteVersion,
      status: summary.status,
      initiatedBy: req.user!.userId,
      startTime: new Date(summary.startTime),
      endTime: new Date(summary.endTime),
      results: {
        create: summary.results.map((r) => ({
          caseId: r.caseId,
          name: r.name,
          expectedOutcome: r.expectedOutcome,
          actualOutcome: r.actualOutcome,
          pass: r.pass,
          evidenceJson: JSON.stringify(r.evidence),
          correlationId: r.correlationId,
        })),
      },
    },
    include: { results: true },
  });

  await AuditService.recordEvent({
    actorType: "USER",
    actorId: req.user!.userId,
    eventType: "RED_TEAM_SUITE_EXECUTED",
    entityType: "RED_TEAM_RUN",
    entityId: runRecord.id,
    correlationId: req.correlationId,
    payload: {
      status: summary.status,
      passedCount: summary.passedCount,
      failedCount: summary.failedCount,
      totalCases: summary.totalCases,
    },
  });

  res.json({
    run: {
      ...runRecord,
      summary,
    },
  });
});

router.get("/runs", authMiddleware, async (req: Request, res: Response) => {
  const runs = await prisma.redTeamRun.findMany({
    orderBy: { createdAt: "desc" },
    include: { results: true },
    take: 10,
  });

  const parsed = runs.map((r) => ({
    ...r,
    results: r.results.map((res) => ({
      ...res,
      evidence: JSON.parse(res.evidenceJson),
    })),
  }));

  res.json({ runs: parsed });
});

export default router;
