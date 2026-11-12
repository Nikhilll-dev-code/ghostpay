import {
  ActionProposal,
  CustomerContext,
  RiskRule,
  CheckResult,
  ACTION_TYPES,
  REASON_CODES,
} from "@ghost/shared";

export interface RiskEvaluationResult {
  riskUnits: number;
  triggeredRules: RiskRule[];
  checks: CheckResult[];
  requiresApproval: boolean;
  requiresReview: boolean;
}

export function evaluateRisk(
  proposal: ActionProposal,
  customerContext?: CustomerContext,
  rules: RiskRule[] = []
): RiskEvaluationResult {
  let totalRiskUnits = 0;
  const triggeredRules: RiskRule[] = [];
  const checks: CheckResult[] = [];
  let requiresApproval = false;
  let requiresReview = false;

  // Rule 1: New customer requesting refund
  if (
    proposal.actionType === ACTION_TYPES.REFUND_REQUEST &&
    customerContext &&
    customerContext.verifiedPurchaseCount <= 1
  ) {
    const matchedRule = rules.find((r) => r.id === "RISK_NEW_CUSTOMER_REFUND") || {
      id: "RISK_NEW_CUSTOMER_REFUND",
      name: "New Customer Refund",
      description: "Customer has 1 or fewer verified purchases requesting refund",
      condition: "verifiedPurchaseCount <= 1 && actionType == REFUND_REQUEST",
      riskUnits: 30,
      actionOnTrigger: "REQUIRE_APPROVAL" as const,
    };
    totalRiskUnits += matchedRule.riskUnits;
    triggeredRules.push(matchedRule);
    requiresApproval = true;
    checks.push({
      code: REASON_CODES.RISK_REVIEW_REQUIRED,
      status: "REVIEW",
      message: `Risk rule triggered: ${matchedRule.name} (+${matchedRule.riskUnits} risk units)`,
      details: { ruleId: matchedRule.id, riskUnits: matchedRule.riskUnits },
    });
  }

  // Rule 2: Multiple open disputes
  if (customerContext && customerContext.openDisputesCount > 0) {
    const matchedRule = rules.find((r) => r.id === "RISK_OPEN_DISPUTES") || {
      id: "RISK_OPEN_DISPUTES",
      name: "Customer Has Open Disputes",
      description: "Customer has active disputes pending resolution",
      condition: "openDisputesCount > 0",
      riskUnits: 40,
      actionOnTrigger: "REQUIRE_APPROVAL" as const,
    };
    totalRiskUnits += matchedRule.riskUnits;
    triggeredRules.push(matchedRule);
    requiresApproval = true;
    checks.push({
      code: REASON_CODES.RISK_REVIEW_REQUIRED,
      status: "REVIEW",
      message: `Risk rule triggered: ${matchedRule.name} (+${matchedRule.riskUnits} risk units)`,
      details: { ruleId: matchedRule.id, riskUnits: matchedRule.riskUnits },
    });
  }

  // Rule 3: High discount request relative to typical history
  if (
    proposal.discountBasisPoints &&
    proposal.discountBasisPoints > 1000 &&
    customerContext &&
    customerContext.typicalDiscountBasisPoints !== undefined &&
    customerContext.typicalDiscountBasisPoints !== null &&
    proposal.discountBasisPoints > customerContext.typicalDiscountBasisPoints * 2
  ) {
    const matchedRule = rules.find((r) => r.id === "RISK_ANOMALOUS_DISCOUNT") || {
      id: "RISK_ANOMALOUS_DISCOUNT",
      name: "Anomalous Discount Request",
      description: "Discount exceeds twice the customer's typical discount history",
      condition: "discountBasisPoints > typicalDiscountBasisPoints * 2",
      riskUnits: 25,
      actionOnTrigger: "REQUIRE_APPROVAL" as const,
    };
    totalRiskUnits += matchedRule.riskUnits;
    triggeredRules.push(matchedRule);
    requiresApproval = true;
    checks.push({
      code: REASON_CODES.RISK_REVIEW_REQUIRED,
      status: "REVIEW",
      message: `Risk rule triggered: ${matchedRule.name} (+${matchedRule.riskUnits} risk units)`,
      details: { ruleId: matchedRule.id, riskUnits: matchedRule.riskUnits },
    });
  }

  // Rule 4: Untrusted claim in rationale
  if (
    proposal.rationale &&
    /bypass|ignore (policy|limits)|override|owner approved|manager authorized/i.test(
      proposal.rationale
    )
  ) {
    const matchedRule = rules.find((r) => r.id === "RISK_PROMPT_INJECTION_SIGNAL") || {
      id: "RISK_PROMPT_INJECTION_SIGNAL",
      name: "Untrusted Authority Claim Detected",
      description: "Customer text contains claims of external/verbal policy bypass",
      condition: "untrusted_bypass_claim",
      riskUnits: 50,
      actionOnTrigger: "BLOCK" as const,
    };
    totalRiskUnits += matchedRule.riskUnits;
    triggeredRules.push(matchedRule);
    requiresReview = true;
    checks.push({
      code: REASON_CODES.RISK_REVIEW_REQUIRED,
      status: "FAIL",
      message: `Untrusted authority claim detected in customer input: "${proposal.rationale}"`,
      details: { ruleId: matchedRule.id, riskUnits: matchedRule.riskUnits },
    });
  }

  return {
    riskUnits: totalRiskUnits,
    triggeredRules,
    checks,
    requiresApproval,
    requiresReview,
  };
}
