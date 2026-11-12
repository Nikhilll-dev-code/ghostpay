import crypto from "node:crypto";
import {
  ActionProposal,
  GhostSettings,
  AuthorityPolicy,
  CustomerContext,
  BudgetSnapshot,
  Approval,
  Decision,
  DecisionOutcome,
  CheckResult,
  ReasonCode,
  ACTION_TYPES,
  DECISION_OUTCOMES,
  GHOST_MODES,
  REASON_CODES,
  canonicalizeJson,
} from "@ghost/shared";
import { evaluateRisk } from "../risk/riskEngine.js";

export interface OrderContext {
  captured: boolean;
  amountCapturedMinor?: number;
  alreadyRefundedMinor?: number;
}

export interface EvaluationInput {
  proposal: ActionProposal;
  settings: GhostSettings;
  policy: AuthorityPolicy;
  customerContext?: CustomerContext;
  budgetSnapshot?: BudgetSnapshot;
  approval?: Approval;
  orderContext?: OrderContext;
  correlationId?: string;
}

export function hashProposalPayload(proposal: ActionProposal): string {
  const canonical = canonicalizeJson({
    actionType: proposal.actionType,
    customerId: proposal.customerId,
    orderId: proposal.orderId,
    captureId: proposal.captureId,
    amountMinor: proposal.amountMinor,
    currency: proposal.currency,
    discountBasisPoints: proposal.discountBasisPoints,
  });
  return crypto.createHash("sha256").update(canonical).digest("hex");
}

export class PolicyEngine {
  public static evaluate(input: EvaluationInput): Decision {
    const {
      proposal,
      settings,
      policy,
      customerContext,
      budgetSnapshot,
      approval,
      orderContext,
      correlationId = crypto.randomUUID(),
    } = input;

    const checks: CheckResult[] = [];
    const reasonCodes: ReasonCode[] = [];
    const proposalHash = hashProposalPayload(proposal);

    // 1. Kill Switch Enforcement (Highest Priority)
    if (settings.killSwitchEnabled) {
      checks.push({
        code: REASON_CODES.KILL_SWITCH_ACTIVE,
        status: "FAIL",
        message: `Kill switch is actively engaged: ${settings.killSwitchReason || "Emergency freeze invoked"}`,
      });
      reasonCodes.push(REASON_CODES.KILL_SWITCH_ACTIVE);

      return {
        id: crypto.randomUUID(),
        outcome: DECISION_OUTCOMES.FROZEN,
        reasonCodes,
        checks,
        policyVersion: policy.version,
        riskUnits: 0,
        canExecute: false,
        correlationId,
        createdAt: new Date().toISOString(),
      };
    }

    // 2. Lockdown Mode Enforcement
    if (settings.mode === GHOST_MODES.LOCKDOWN) {
      checks.push({
        code: REASON_CODES.GHOST_LOCKDOWN,
        status: "FAIL",
        message: "Ghost is in LOCKDOWN mode. All financial execution attempts are denied.",
      });
      reasonCodes.push(REASON_CODES.GHOST_LOCKDOWN);

      return {
        id: crypto.randomUUID(),
        outcome: DECISION_OUTCOMES.FROZEN,
        reasonCodes,
        checks,
        policyVersion: policy.version,
        riskUnits: 0,
        canExecute: false,
        correlationId,
        createdAt: new Date().toISOString(),
      };
    }

    // 3. Action Permission Checks
    if (proposal.actionType === ACTION_TYPES.TRANSFER) {
      checks.push({
        code: REASON_CODES.ACTION_NOT_ENABLED,
        status: "FAIL",
        message: "Direct money transfers are strictly disabled in this MVP release.",
      });
      reasonCodes.push(REASON_CODES.ACTION_NOT_ENABLED);
    } else if (
      proposal.actionType === ACTION_TYPES.PURCHASE_CAPTURE &&
      !policy.actionPermissions.orderCapture
    ) {
      checks.push({
        code: REASON_CODES.ACTION_NOT_ENABLED,
        status: "FAIL",
        message: "Order capture action is disabled in the active Authority Passport.",
      });
      reasonCodes.push(REASON_CODES.ACTION_NOT_ENABLED);
    } else if (
      proposal.actionType === ACTION_TYPES.DISCOUNT_REQUEST &&
      !policy.actionPermissions.discounts
    ) {
      checks.push({
        code: REASON_CODES.ACTION_NOT_ENABLED,
        status: "FAIL",
        message: "Discounts are disabled in the active Authority Passport.",
      });
      reasonCodes.push(REASON_CODES.ACTION_NOT_ENABLED);
    } else if (
      proposal.actionType === ACTION_TYPES.REFUND_REQUEST &&
      !policy.actionPermissions.refunds
    ) {
      checks.push({
        code: REASON_CODES.ACTION_NOT_ENABLED,
        status: "FAIL",
        message: "Refunds are disabled in the active Authority Passport.",
      });
      reasonCodes.push(REASON_CODES.ACTION_NOT_ENABLED);
    } else {
      checks.push({
        code: "ACTION_PERMISSION_CHECK",
        status: "PASS",
        message: `Action ${proposal.actionType} is authorized under current policy.`,
      });
    }

    // 4. Per-Action Amount & Discount Limits
    if (proposal.amountMinor !== undefined) {
      if (proposal.actionType === ACTION_TYPES.REFUND_REQUEST) {
        if (proposal.amountMinor > policy.maxRefundMinor) {
          checks.push({
            code: REASON_CODES.AMOUNT_EXCEEDS_LIMIT,
            status: "FAIL",
            message: `Requested refund of ${proposal.amountMinor} minor units exceeds per-action refund cap of ${policy.maxRefundMinor}.`,
            details: { requested: proposal.amountMinor, max: policy.maxRefundMinor },
          });
          reasonCodes.push(REASON_CODES.AMOUNT_EXCEEDS_LIMIT);
        } else {
          checks.push({
            code: "REFUND_LIMIT_CHECK",
            status: "PASS",
            message: `Refund amount ${proposal.amountMinor} is within per-action cap of ${policy.maxRefundMinor}.`,
          });
        }
      } else {
        if (proposal.amountMinor > policy.maxPaymentMinor) {
          checks.push({
            code: REASON_CODES.AMOUNT_EXCEEDS_LIMIT,
            status: "FAIL",
            message: `Requested payment of ${proposal.amountMinor} minor units exceeds per-action payment cap of ${policy.maxPaymentMinor}.`,
            details: { requested: proposal.amountMinor, max: policy.maxPaymentMinor },
          });
          reasonCodes.push(REASON_CODES.AMOUNT_EXCEEDS_LIMIT);
        } else {
          checks.push({
            code: "PAYMENT_LIMIT_CHECK",
            status: "PASS",
            message: `Payment amount ${proposal.amountMinor} is within per-action cap of ${policy.maxPaymentMinor}.`,
          });
        }
      }
    }

    // Discount percentage limit (in basis points)
    if (proposal.discountBasisPoints !== undefined && proposal.discountBasisPoints !== null) {
      if (proposal.discountBasisPoints > policy.maxDiscountBasisPoints) {
        checks.push({
          code: REASON_CODES.DISCOUNT_EXCEEDS_LIMIT,
          status: "FAIL",
          message: `Requested discount of ${(proposal.discountBasisPoints / 100).toFixed(
            2
          )}% exceeds configured cap of ${(policy.maxDiscountBasisPoints / 100).toFixed(2)}%.`,
          details: {
            requestedBasisPoints: proposal.discountBasisPoints,
            maxBasisPoints: policy.maxDiscountBasisPoints,
          },
        });
        reasonCodes.push(REASON_CODES.DISCOUNT_EXCEEDS_LIMIT);
      } else {
        checks.push({
          code: "DISCOUNT_LIMIT_CHECK",
          status: "PASS",
          message: `Discount of ${(proposal.discountBasisPoints / 100).toFixed(
            2
          )}% is within authorized threshold.`,
        });
      }
    }

    // 5. Refund Preconditions and Capture Eligibility
    if (proposal.actionType === ACTION_TYPES.REFUND_REQUEST) {
      if (orderContext) {
        if (!orderContext.captured) {
          checks.push({
            code: REASON_CODES.PAYMENT_NOT_CAPTURED,
            status: "FAIL",
            message: "Cannot issue refund: referenced order has not been captured.",
          });
          reasonCodes.push(REASON_CODES.PAYMENT_NOT_CAPTURED);
        } else if (orderContext.amountCapturedMinor !== undefined) {
          const remainingRefundable =
            orderContext.amountCapturedMinor - (orderContext.alreadyRefundedMinor || 0);
          if ((proposal.amountMinor || 0) > remainingRefundable) {
            checks.push({
              code: REASON_CODES.REFUND_EXCEEDS_ELIGIBLE_AMOUNT,
              status: "FAIL",
              message: `Requested refund (${proposal.amountMinor}) exceeds remaining refundable amount (${remainingRefundable}).`,
              details: { requested: proposal.amountMinor, remainingRefundable },
            });
            reasonCodes.push(REASON_CODES.REFUND_EXCEEDS_ELIGIBLE_AMOUNT);
          } else {
            checks.push({
              code: "REFUND_ELIGIBILITY_CHECK",
              status: "PASS",
              message: `Refund amount is verified against captured balance. Remaining refundable: ${remainingRefundable}.`,
            });
          }
        }
      } else if (!proposal.captureId && !proposal.orderId) {
        checks.push({
          code: REASON_CODES.CUSTOMER_CONTEXT_UNVERIFIED,
          status: "REVIEW",
          message: "Refund request lacks referenced orderId or captureId context.",
        });
        reasonCodes.push(REASON_CODES.CUSTOMER_CONTEXT_UNVERIFIED);
      }
    }

    // 6. Aggregate Budget & Velocity Constraints
    if (budgetSnapshot && proposal.amountMinor) {
      if (proposal.amountMinor > budgetSnapshot.dailyRemainingMinor) {
        checks.push({
          code: REASON_CODES.DAILY_BUDGET_EXCEEDED,
          status: "FAIL",
          message: `Amount ${proposal.amountMinor} exceeds remaining daily aggregate exposure budget of ${budgetSnapshot.dailyRemainingMinor}.`,
        });
        reasonCodes.push(REASON_CODES.DAILY_BUDGET_EXCEEDED);
      }

      if (proposal.amountMinor > budgetSnapshot.customerRemainingMinor) {
        checks.push({
          code: REASON_CODES.CUSTOMER_EXPOSURE_EXCEEDED,
          status: "FAIL",
          message: `Amount ${proposal.amountMinor} exceeds remaining customer exposure cap of ${budgetSnapshot.customerRemainingMinor}.`,
        });
        reasonCodes.push(REASON_CODES.CUSTOMER_EXPOSURE_EXCEEDED);
      }

      if (budgetSnapshot.actionsInLastMinute >= policy.maxActionsPerMinute) {
        checks.push({
          code: REASON_CODES.VELOCITY_LIMIT_EXCEEDED,
          status: "FAIL",
          message: `Velocity threshold exceeded: ${budgetSnapshot.actionsInLastMinute} actions in the last minute (max ${policy.maxActionsPerMinute}).`,
        });
        reasonCodes.push(REASON_CODES.VELOCITY_LIMIT_EXCEEDED);
      }
    }

    // 7. Contextual Risk Rule Evaluation
    const riskEval = evaluateRisk(proposal, customerContext, policy.riskRules);
    checks.push(...riskEval.checks);
    if (riskEval.requiresReview && !reasonCodes.includes(REASON_CODES.RISK_REVIEW_REQUIRED)) {
      reasonCodes.push(REASON_CODES.RISK_REVIEW_REQUIRED);
    }

    // 8. Human Approval Verification (if provided)
    let approvalVerified = false;
    if (approval) {
      if (approval.status !== "APPROVED") {
        checks.push({
          code: REASON_CODES.APPROVAL_REQUIRED,
          status: "FAIL",
          message: `Approval status is ${approval.status}. Must be APPROVED to permit execution.`,
        });
        reasonCodes.push(REASON_CODES.APPROVAL_REQUIRED);
      } else if (new Date(approval.expiresAt).getTime() < Date.now()) {
        checks.push({
          code: REASON_CODES.APPROVAL_EXPIRED,
          status: "FAIL",
          message: `Human approval expired at ${approval.expiresAt}.`,
        });
        reasonCodes.push(REASON_CODES.APPROVAL_EXPIRED);
      } else if (approval.payloadHash !== proposalHash) {
        checks.push({
          code: REASON_CODES.APPROVAL_PAYLOAD_MISMATCH,
          status: "FAIL",
          message:
            "Action payload has changed since approval was granted. Cryptographic hash mismatch.",
          details: { expectedHash: approval.payloadHash, actualHash: proposalHash },
        });
        reasonCodes.push(REASON_CODES.APPROVAL_PAYLOAD_MISMATCH);
      } else {
        approvalVerified = true;
        checks.push({
          code: "HUMAN_APPROVAL_VERIFIED",
          status: "PASS",
          message: `Verified valid approval ${approval.id} authorized by ${approval.decidedBy || "owner"}.`,
        });
      }
    }

    // 9. Synthesize Outcome
    const hasFail = checks.some((c) => c.status === "FAIL");
    const hasReview = checks.some((c) => c.status === "REVIEW");

    // In Observe Mode, suppress all execution
    if (settings.mode === GHOST_MODES.OBSERVE) {
      checks.push({
        code: REASON_CODES.MODE_OBSERVE_ONLY,
        status: "NOT_APPLICABLE",
        message: "Observe mode active. Action recorded for hypothetical observation only.",
      });
      if (!reasonCodes.includes(REASON_CODES.MODE_OBSERVE_ONLY)) {
        reasonCodes.push(REASON_CODES.MODE_OBSERVE_ONLY);
      }
      return {
        id: crypto.randomUUID(),
        outcome: DECISION_OUTCOMES.OBSERVE_ONLY,
        reasonCodes,
        checks,
        policyVersion: policy.version,
        riskUnits: riskEval.riskUnits,
        canExecute: false,
        correlationId,
        createdAt: new Date().toISOString(),
      };
    }

    if (hasFail) {
      return {
        id: crypto.randomUUID(),
        outcome: DECISION_OUTCOMES.BLOCK,
        reasonCodes,
        checks,
        policyVersion: policy.version,
        riskUnits: riskEval.riskUnits,
        canExecute: false,
        correlationId,
        createdAt: new Date().toISOString(),
      };
    }

    if (hasReview) {
      return {
        id: crypto.randomUUID(),
        outcome: DECISION_OUTCOMES.REVIEW,
        reasonCodes,
        checks,
        policyVersion: policy.version,
        riskUnits: riskEval.riskUnits,
        canExecute: false,
        correlationId,
        createdAt: new Date().toISOString(),
      };
    }

    // In Assist Mode: requires human approval
    if (settings.mode === GHOST_MODES.ASSIST) {
      if (approvalVerified) {
        return {
          id: crypto.randomUUID(),
          outcome: DECISION_OUTCOMES.ALLOW,
          reasonCodes: [],
          checks,
          policyVersion: policy.version,
          riskUnits: riskEval.riskUnits,
          canExecute: true,
          correlationId,
          createdAt: new Date().toISOString(),
        };
      }

      checks.push({
        code: REASON_CODES.APPROVAL_REQUIRED,
        status: "REVIEW",
        message: "Ghost is in Assist mode. Explicit owner approval required before execution.",
      });
      reasonCodes.push(REASON_CODES.APPROVAL_REQUIRED);

      return {
        id: crypto.randomUUID(),
        outcome: DECISION_OUTCOMES.REQUIRE_APPROVAL,
        reasonCodes,
        checks,
        policyVersion: policy.version,
        riskUnits: riskEval.riskUnits,
        canExecute: false,
        correlationId,
        createdAt: new Date().toISOString(),
      };
    }

    // In Autopilot Mode: allows execution if all checks passed
    if (settings.mode === GHOST_MODES.AUTOPILOT) {
      if (riskEval.requiresApproval && !approvalVerified) {
        checks.push({
          code: REASON_CODES.APPROVAL_REQUIRED,
          status: "REVIEW",
          message: "Risk rules require human approval before Autopilot execution.",
        });
        reasonCodes.push(REASON_CODES.APPROVAL_REQUIRED);
        return {
          id: crypto.randomUUID(),
          outcome: DECISION_OUTCOMES.REQUIRE_APPROVAL,
          reasonCodes,
          checks,
          policyVersion: policy.version,
          riskUnits: riskEval.riskUnits,
          canExecute: false,
          correlationId,
          createdAt: new Date().toISOString(),
        };
      }

      return {
        id: crypto.randomUUID(),
        outcome: DECISION_OUTCOMES.ALLOW,
        reasonCodes: [],
        checks,
        policyVersion: policy.version,
        riskUnits: riskEval.riskUnits,
        canExecute: true,
        correlationId,
        createdAt: new Date().toISOString(),
      };
    }

    // Fallback safe default: REVIEW
    return {
      id: crypto.randomUUID(),
      outcome: DECISION_OUTCOMES.REVIEW,
      reasonCodes: [REASON_CODES.RISK_REVIEW_REQUIRED],
      checks,
      policyVersion: policy.version,
      riskUnits: riskEval.riskUnits,
      canExecute: false,
      correlationId,
      createdAt: new Date().toISOString(),
    };
  }
}
