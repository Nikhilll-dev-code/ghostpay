import crypto from "node:crypto";
import {
  ActionProposal,
  AuthorityPolicy,
  GhostSettings,
  GHOST_MODES,
  ACTION_TYPES,
  Decision,
} from "@ghost/shared";
import { PolicyEngine } from "../policy/policyEngine.js";

export interface SimulationFixture {
  id: string;
  description: string;
  proposal: ActionProposal;
  customerContext?: {
    id: string;
    displayName: string;
    verifiedPurchaseCount: number;
    totalSpendMinor: number;
    refundCount: number;
    openDisputesCount: number;
    facts: any[];
  };
}

export const DEFAULT_SIMULATION_FIXTURES: SimulationFixture[] = [
  {
    id: "FIX-001",
    description: "Standard purchase $45 with 10% discount request",
    proposal: {
      actionType: ACTION_TYPES.PURCHASE_CAPTURE,
      amountMinor: 4500,
      currency: "USD",
      discountBasisPoints: 1000,
      missingFields: [],
    },
    customerContext: {
      id: "cust-1",
      displayName: "Alice Smith",
      verifiedPurchaseCount: 5,
      totalSpendMinor: 25000,
      refundCount: 0,
      openDisputesCount: 0,
      facts: [],
    },
  },
  {
    id: "FIX-002",
    description: "High discount purchase $120 with 22% discount request",
    proposal: {
      actionType: ACTION_TYPES.PURCHASE_CAPTURE,
      amountMinor: 12000,
      currency: "USD",
      discountBasisPoints: 2200,
      missingFields: [],
    },
    customerContext: {
      id: "cust-2",
      displayName: "Bob Jones",
      verifiedPurchaseCount: 2,
      totalSpendMinor: 10000,
      refundCount: 0,
      openDisputesCount: 0,
      facts: [],
    },
  },
  {
    id: "FIX-003",
    description: "New customer requesting $80 refund with 0 previous purchases",
    proposal: {
      actionType: ACTION_TYPES.REFUND_REQUEST,
      amountMinor: 8000,
      currency: "USD",
      missingFields: [],
    },
    customerContext: {
      id: "cust-3",
      displayName: "Charlie New",
      verifiedPurchaseCount: 0,
      totalSpendMinor: 0,
      refundCount: 1,
      openDisputesCount: 0,
      facts: [],
    },
  },
  {
    id: "FIX-004",
    description: "Large ticket purchase $450 with 5% discount",
    proposal: {
      actionType: ACTION_TYPES.PURCHASE_CAPTURE,
      amountMinor: 45000,
      currency: "USD",
      discountBasisPoints: 500,
      missingFields: [],
    },
    customerContext: {
      id: "cust-4",
      displayName: "Dana Enterprise",
      verifiedPurchaseCount: 12,
      totalSpendMinor: 120000,
      refundCount: 0,
      openDisputesCount: 0,
      facts: [],
    },
  },
  {
    id: "FIX-005",
    description: "Direct money transfer attempt ($100)",
    proposal: {
      actionType: ACTION_TYPES.TRANSFER,
      amountMinor: 10000,
      currency: "USD",
      missingFields: [],
    },
  },
];

export interface SimulationResultStats {
  totalCount: number;
  allowedCount: number;
  blockedCount: number;
  approvalRequiredCount: number;
  reviewCount: number;
  totalPermittedExposureMinor: number;
  totalBlockedExposureMinor: number;
}

export interface SimulationComparison {
  id: string;
  baselinePolicyVersion: number;
  proposedPolicyVersion: number;
  fixtureCount: number;
  baselineStats: SimulationResultStats;
  proposedStats: SimulationResultStats;
  delta: {
    allowedDelta: number;
    blockedDelta: number;
    approvalRequiredDelta: number;
    exposureDeltaMinor: number;
  };
  details: Array<{
    fixtureId: string;
    description: string;
    baselineDecision: Decision;
    proposedDecision: Decision;
    changed: boolean;
  }>;
  syntheticLabel: string;
}

export class SimulationService {
  public static runComparison(
    baselinePolicy: AuthorityPolicy,
    proposedPolicy: AuthorityPolicy,
    fixtures: SimulationFixture[] = DEFAULT_SIMULATION_FIXTURES
  ): SimulationComparison {
    const simSettings: GhostSettings = {
      id: "sim-settings",
      mode: GHOST_MODES.AUTOPILOT,
      killSwitchEnabled: false,
      updatedBy: "simulation",
      updatedAt: new Date().toISOString(),
      version: 1,
    };

    const runFixtures = (policy: AuthorityPolicy) => {
      let allowedCount = 0;
      let blockedCount = 0;
      let approvalRequiredCount = 0;
      let reviewCount = 0;
      let totalPermittedExposureMinor = 0;
      let totalBlockedExposureMinor = 0;

      const decisions = fixtures.map((fix) => {
        const dec = PolicyEngine.evaluate({
          proposal: fix.proposal,
          settings: simSettings,
          policy,
          customerContext: fix.customerContext as any,
          budgetSnapshot: {
            dailySpentMinor: 0,
            dailyRemainingMinor: policy.dailyExposureMinor,
            customerSpentMinor: 0,
            customerRemainingMinor: policy.maxCustomerExposureMinor,
            actionsInLastMinute: 0,
            riskUnitsConsumedToday: 0,
            riskUnitsRemainingToday: policy.riskBudgetUnits,
          },
        });

        if (dec.outcome === "ALLOW") {
          allowedCount++;
          totalPermittedExposureMinor += fix.proposal.amountMinor || 0;
        } else if (dec.outcome === "BLOCK" || dec.outcome === "FROZEN") {
          blockedCount++;
          totalBlockedExposureMinor += fix.proposal.amountMinor || 0;
        } else if (dec.outcome === "REQUIRE_APPROVAL") {
          approvalRequiredCount++;
        } else if (dec.outcome === "REVIEW") {
          reviewCount++;
        }

        return dec;
      });

      return {
        stats: {
          totalCount: fixtures.length,
          allowedCount,
          blockedCount,
          approvalRequiredCount,
          reviewCount,
          totalPermittedExposureMinor,
          totalBlockedExposureMinor,
        },
        decisions,
      };
    };

    const baseRun = runFixtures(baselinePolicy);
    const propRun = runFixtures(proposedPolicy);

    const details = fixtures.map((fix, idx) => {
      const bDec = baseRun.decisions[idx];
      const pDec = propRun.decisions[idx];
      return {
        fixtureId: fix.id,
        description: fix.description,
        baselineDecision: bDec,
        proposedDecision: pDec,
        changed: bDec.outcome !== pDec.outcome,
      };
    });

    return {
      id: crypto.randomUUID(),
      baselinePolicyVersion: baselinePolicy.version,
      proposedPolicyVersion: proposedPolicy.version || 0,
      fixtureCount: fixtures.length,
      baselineStats: baseRun.stats,
      proposedStats: propRun.stats,
      delta: {
        allowedDelta: propRun.stats.allowedCount - baseRun.stats.allowedCount,
        blockedDelta: propRun.stats.blockedCount - baseRun.stats.blockedCount,
        approvalRequiredDelta:
          propRun.stats.approvalRequiredCount - baseRun.stats.approvalRequiredCount,
        exposureDeltaMinor:
          propRun.stats.totalPermittedExposureMinor - baseRun.stats.totalPermittedExposureMinor,
      },
      details,
      syntheticLabel: "SYNTHETIC_DATASET_NO_EXTERNAL_CALLS",
    };
  }
}
