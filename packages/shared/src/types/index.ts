import {
  ActionType,
  DecisionOutcome,
  GhostMode,
  OperationStatus,
  ApprovalStatus,
  ReasonCode,
  SourceType,
  UserRole,
} from "../constants/index.js";

export interface ActionProposal {
  actionType: ActionType;
  customerId?: string;
  orderId?: string;
  captureId?: string;
  amountMinor?: number; // Integer minor units (cents / paise)
  currency?: string;    // e.g. 'USD', 'INR'
  discountBasisPoints?: number; // 1% = 100 bps
  rationale?: string;
  missingFields: string[];
  confidence?: number;
}

export type CheckStatus = "PASS" | "FAIL" | "REVIEW" | "NOT_APPLICABLE";

export interface CheckResult {
  code: ReasonCode | string;
  status: CheckStatus;
  message: string;
  evidenceRefs?: string[];
  details?: Record<string, unknown>;
}

export interface Decision {
  id: string;
  outcome: DecisionOutcome;
  reasonCodes: ReasonCode[];
  checks: CheckResult[];
  policyVersion: number;
  riskUnits: number;
  canExecute: boolean;
  correlationId: string;
  customerContextSnapshot?: Record<string, unknown>;
  createdAt: string;
}

export interface ActionPermissions {
  orderCreation: boolean;
  orderCapture: boolean;
  refunds: boolean;
  discounts: boolean;
  transfers: boolean; // Always false in MVP
}

export interface RiskRule {
  id: string;
  name: string;
  description: string;
  condition: string;
  riskUnits: number;
  actionOnTrigger: "BLOCK" | "REVIEW" | "REQUIRE_APPROVAL";
}

export interface AuthorityPolicy {
  id: string;
  version: number;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  actionPermissions: ActionPermissions;
  maxPaymentMinor: number;
  maxRefundMinor: number;
  maxDiscountBasisPoints: number;
  dailyExposureMinor: number;
  maxCustomerExposureMinor: number;
  maxActionsPerMinute: number;
  riskBudgetUnits: number;
  riskRules: RiskRule[];
  createdBy: string;
  createdAt: string;
  publishedAt?: string | null;
  changeReason?: string | null;
}

export interface GhostSettings {
  id: string;
  mode: GhostMode;
  killSwitchEnabled: boolean;
  killSwitchReason?: string | null;
  updatedBy: string;
  updatedAt: string;
  version: number;
}

export interface CustomerFact {
  id: string;
  customerId: string;
  factType: string;
  valueJson: Record<string, unknown>;
  sourceType: SourceType;
  sourceReference?: string | null;
  verified: boolean;
  observedAt: string;
  expiresAt?: string | null;
  createdAt: string;
}

export interface CustomerContext {
  id: string;
  externalReference?: string | null;
  displayName: string;
  email?: string;
  facts: CustomerFact[];
  verifiedPurchaseCount: number;
  totalSpendMinor: number;
  refundCount: number;
  openDisputesCount: number;
  typicalDiscountBasisPoints?: number | null;
}

export interface BudgetSnapshot {
  dailySpentMinor: number;
  dailyRemainingMinor: number;
  customerSpentMinor: number;
  customerRemainingMinor: number;
  actionsInLastMinute: number;
  riskUnitsConsumedToday: number;
  riskUnitsRemainingToday: number;
}

export interface Approval {
  id: string;
  decisionId: string;
  payloadHash: string;
  status: ApprovalStatus;
  requestedBy: string;
  decidedBy?: string | null;
  expiresAt: string;
  decidedAt?: string | null;
  createdAt: string;
}

export interface FinancialOperation {
  id: string;
  proposalId?: string | null;
  actionType: ActionType;
  amountMinor: number;
  currency: string;
  status: OperationStatus;
  idempotencyKey: string;
  paypalOrderId?: string | null;
  paypalCaptureId?: string | null;
  paypalRefundId?: string | null;
  providerStatus?: string | null;
  lastProviderCheckAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuditEvent {
  id: string;
  actorType: "USER" | "SYSTEM" | "AI" | "PAYPAL_WEBHOOK";
  actorId?: string | null;
  eventType: string;
  entityType: string;
  entityId: string;
  correlationId: string;
  payloadRedacted: Record<string, unknown>;
  createdAt: string;
}

export interface RedTeamCase {
  id: string;
  name: string;
  category: string;
  threat: string;
  inputMessage: string;
  candidateProposal: ActionProposal;
  expectedOutcome: DecisionOutcome;
  expectedReasonCode: ReasonCode;
}

export interface RedTeamCaseResult {
  caseId: string;
  name: string;
  category: string;
  threat: string;
  expectedOutcome: DecisionOutcome;
  actualOutcome: DecisionOutcome;
  pass: boolean;
  evidence: {
    expectedReason: string;
    actualReasonCodes: string[];
    checks: CheckResult[];
  };
  correlationId: string;
}

export interface RedTeamRunSummary {
  id: string;
  suiteVersion: string;
  startTime: string;
  endTime: string;
  status: "PASSED" | "FAILED";
  totalCases: number;
  passedCount: number;
  failedCount: number;
  results: RedTeamCaseResult[];
}
