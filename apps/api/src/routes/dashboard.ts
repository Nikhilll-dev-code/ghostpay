import { Router, Request, Response } from "express";
import { prisma } from "../repositories/prisma.js";
import { authMiddleware } from "../middleware/auth.js";

const router = Router();

router.get("/summary", authMiddleware, async (req: Request, res: Response) => {
  const settings = await prisma.ghostSettings.findFirst({
    orderBy: { updatedAt: "desc" },
  });

  const activePolicy = await prisma.authorityPolicy.findFirst({
    where: { status: "ACTIVE" },
    orderBy: { version: "desc" },
  });

  const totalOps = await prisma.financialOperation.count();
  const completedOps = await prisma.financialOperation.findMany({
    where: { status: "COMPLETED" },
    select: { amountMinor: true },
  });
  const processedAmountMinor = completedOps.reduce((sum, op) => sum + op.amountMinor, 0);

  const pendingApprovalsCount = await prisma.approval.count({
    where: { status: "PENDING" },
  });

  const blockedDecisionsCount = await prisma.decision.count({
    where: { outcome: "BLOCK" },
  });

  // Calculate daily budget spent from ledger today
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const todayLedger = await prisma.budgetLedgerEntry.findMany({
    where: {
      budgetType: "DAILY_EXPOSURE",
      createdAt: { gte: startOfDay },
    },
    select: { deltaMinor: true },
  });
  const dailySpentMinor = todayLedger.reduce((sum, item) => sum + item.deltaMinor, 0);
  const dailyLimitMinor = activePolicy?.dailyExposureMinor || 200000;
  const dailyRemainingMinor = Math.max(0, dailyLimitMinor - dailySpentMinor);

  // Recent transactions
  const recentTransactions = await prisma.financialOperation.findMany({
    take: 6,
    orderBy: { createdAt: "desc" },
  });

  // Recent decisions
  const recentDecisions = await prisma.decision.findMany({
    take: 6,
    orderBy: { createdAt: "desc" },
    include: { proposal: true },
  });

  // Latest red team run
  const latestRedTeamRun = await prisma.redTeamRun.findFirst({
    orderBy: { createdAt: "desc" },
    include: { results: true },
  });

  res.json({
    summary: {
      environment: "PAYPAL_SANDBOX",
      mode: settings?.mode || "ASSIST",
      killSwitchEnabled: settings?.killSwitchEnabled || false,
      killSwitchReason: settings?.killSwitchReason || null,
      policyVersion: activePolicy?.version || 1,
      policy: activePolicy
        ? {
            ...activePolicy,
            actionPermissions: JSON.parse(activePolicy.actionPermissionsJson),
            riskRules: JSON.parse(activePolicy.riskRulesJson),
          }
        : null,
      metrics: {
        totalOperationsCount: totalOps,
        processedAmountMinor,
        pendingApprovalsCount,
        blockedDecisionsCount,
        dailySpentMinor,
        dailyLimitMinor,
        dailyRemainingMinor,
      },
      recentTransactions,
      recentDecisions: recentDecisions.map((d) => ({
        ...d,
        checks: JSON.parse(d.checksJson),
        reasonCodes: JSON.parse(d.reasonCodesJson),
      })),
      latestRedTeamRun: latestRedTeamRun
        ? {
            id: latestRedTeamRun.id,
            suiteVersion: latestRedTeamRun.suiteVersion,
            status: latestRedTeamRun.status,
            passedCount: latestRedTeamRun.results.filter((r) => r.pass).length,
            failedCount: latestRedTeamRun.results.filter((r) => !r.pass).length,
            totalCases: latestRedTeamRun.results.length,
          }
        : null,
    },
  });
});

export default router;
