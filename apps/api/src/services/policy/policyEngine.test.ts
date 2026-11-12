import { describe, it, expect } from "vitest";
import { PolicyEngine } from "./policyEngine.js";
import {
  ACTION_TYPES,
  DECISION_OUTCOMES,
  GHOST_MODES,
  REASON_CODES,
  AuthorityPolicy,
  GhostSettings,
} from "@ghost/shared";

describe("PolicyEngine Deterministic Trust Engine", () => {
  const basePolicy: AuthorityPolicy = {
    id: "pol-1",
    version: 1,
    status: "ACTIVE",
    actionPermissions: {
      orderCreation: true,
      orderCapture: true,
      refunds: true,
      discounts: true,
      transfers: false,
    },
    maxPaymentMinor: 50000, // $500.00
    maxRefundMinor: 25000,  // $250.00
    maxDiscountBasisPoints: 1500, // 15.00%
    dailyExposureMinor: 200000,   // $2000.00
    maxCustomerExposureMinor: 100000,
    maxActionsPerMinute: 10,
    riskBudgetUnits: 100,
    riskRules: [],
    createdBy: "owner",
    createdAt: new Date().toISOString(),
  };

  const baseSettings: GhostSettings = {
    id: "set-1",
    mode: GHOST_MODES.AUTOPILOT,
    killSwitchEnabled: false,
    updatedBy: "owner",
    updatedAt: new Date().toISOString(),
    version: 1,
  };

  it("should allow an eligible purchase in Autopilot mode within all caps", () => {
    const decision = PolicyEngine.evaluate({
      proposal: {
        actionType: ACTION_TYPES.PURCHASE_CAPTURE,
        amountMinor: 15000, // $150
        currency: "USD",
        discountBasisPoints: 500, // 5%
        missingFields: [],
      },
      settings: baseSettings,
      policy: basePolicy,
    });

    expect(decision.outcome).toBe(DECISION_OUTCOMES.ALLOW);
    expect(decision.canExecute).toBe(true);
    expect(decision.reasonCodes).toHaveLength(0);
  });

  it("should block when discount exceeds authorized cap (22% vs 15% limit)", () => {
    const decision = PolicyEngine.evaluate({
      proposal: {
        actionType: ACTION_TYPES.DISCOUNT_REQUEST,
        amountMinor: 15000,
        currency: "USD",
        discountBasisPoints: 2200, // 22%
        missingFields: [],
      },
      settings: baseSettings,
      policy: basePolicy,
    });

    expect(decision.outcome).toBe(DECISION_OUTCOMES.BLOCK);
    expect(decision.canExecute).toBe(false);
    expect(decision.reasonCodes).toContain(REASON_CODES.DISCOUNT_EXCEEDS_LIMIT);
  });

  it("should block when amount exceeds per-action cap ($600 vs $500 max)", () => {
    const decision = PolicyEngine.evaluate({
      proposal: {
        actionType: ACTION_TYPES.PURCHASE_CAPTURE,
        amountMinor: 60000,
        currency: "USD",
        missingFields: [],
      },
      settings: baseSettings,
      policy: basePolicy,
    });

    expect(decision.outcome).toBe(DECISION_OUTCOMES.BLOCK);
    expect(decision.canExecute).toBe(false);
    expect(decision.reasonCodes).toContain(REASON_CODES.AMOUNT_EXCEEDS_LIMIT);
  });

  it("should strictly return FROZEN when kill switch is engaged", () => {
    const decision = PolicyEngine.evaluate({
      proposal: {
        actionType: ACTION_TYPES.PURCHASE_CAPTURE,
        amountMinor: 5000,
        currency: "USD",
        missingFields: [],
      },
      settings: {
        ...baseSettings,
        killSwitchEnabled: true,
        killSwitchReason: "Manual emergency freeze",
      },
      policy: basePolicy,
    });

    expect(decision.outcome).toBe(DECISION_OUTCOMES.FROZEN);
    expect(decision.canExecute).toBe(false);
    expect(decision.reasonCodes).toContain(REASON_CODES.KILL_SWITCH_ACTIVE);
  });

  it("should return FROZEN in Lockdown mode", () => {
    const decision = PolicyEngine.evaluate({
      proposal: {
        actionType: ACTION_TYPES.PURCHASE_CAPTURE,
        amountMinor: 5000,
        currency: "USD",
        missingFields: [],
      },
      settings: {
        ...baseSettings,
        mode: GHOST_MODES.LOCKDOWN,
      },
      policy: basePolicy,
    });

    expect(decision.outcome).toBe(DECISION_OUTCOMES.FROZEN);
    expect(decision.canExecute).toBe(false);
    expect(decision.reasonCodes).toContain(REASON_CODES.GHOST_LOCKDOWN);
  });

  it("should strictly block arbitrary money transfer requests", () => {
    const decision = PolicyEngine.evaluate({
      proposal: {
        actionType: ACTION_TYPES.TRANSFER,
        amountMinor: 5000,
        currency: "USD",
        missingFields: [],
      },
      settings: baseSettings,
      policy: basePolicy,
    });

    expect(decision.outcome).toBe(DECISION_OUTCOMES.BLOCK);
    expect(decision.canExecute).toBe(false);
    expect(decision.reasonCodes).toContain(REASON_CODES.ACTION_NOT_ENABLED);
  });

  it("should require approval in Assist mode when no approval is attached", () => {
    const decision = PolicyEngine.evaluate({
      proposal: {
        actionType: ACTION_TYPES.PURCHASE_CAPTURE,
        amountMinor: 10000,
        currency: "USD",
        missingFields: [],
      },
      settings: {
        ...baseSettings,
        mode: GHOST_MODES.ASSIST,
      },
      policy: basePolicy,
    });

    expect(decision.outcome).toBe(DECISION_OUTCOMES.REQUIRE_APPROVAL);
    expect(decision.canExecute).toBe(false);
    expect(decision.reasonCodes).toContain(REASON_CODES.APPROVAL_REQUIRED);
  });
});
