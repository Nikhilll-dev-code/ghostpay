export interface PolicySnapshot {
  maxDiscountBasisPoints: number;
  maxPaymentMinor: number;
  maxRefundMinor: number;
  dailyExposureMinor: number;
  maxCustomerExposureMinor?: number;
  actionPermissions?: Record<string, boolean>;
  riskRules?: unknown[];
  publishedAt?: string;
}

export interface DecisionCheck {
  code: string;
  status: "PASS" | "FAIL" | "REVIEW" | "NOT_APPLICABLE" | string;
  message: string;
  evidence?: unknown;
}

export interface Decision {
  id: string;
  outcome: string;
  policyVersion: number;
  createdAt: string;
  checks: DecisionCheck[];
  reasonCodes?: string[];
  proposal?: { actionType?: string; payload?: any } | null;
}

export interface Transaction {
  id: string;
  actionType: string;
  amountMinor: number;
  currency: string;
  status: string;
  idempotencyKey: string;
  paypalOrderId?: string | null;
  paypalCaptureId?: string | null;
  paypalRefundId?: string | null;
  providerStatus?: string | null;
  createdAt: string;
  proposal?: any;
}

export interface DashboardSummary {
  environment: string;
  mode: string;
  killSwitchEnabled: boolean;
  killSwitchReason?: string | null;
  policyVersion: number;
  policy: PolicySnapshot | null;
  metrics: {
    totalOperationsCount: number;
    processedAmountMinor: number;
    pendingApprovalsCount: number;
    blockedDecisionsCount: number;
    dailySpentMinor: number;
    dailyLimitMinor: number;
    dailyRemainingMinor: number;
  };
  recentTransactions: Transaction[];
  recentDecisions: Decision[];
  latestRedTeamRun: {
    id: string;
    suiteVersion: string;
    status: string;
    passedCount: number;
    failedCount: number;
    totalCases: number;
  } | null;
}

export interface Approval {
  id: string;
  decisionId: string;
  payloadHash: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED" | "USED";
  requestedBy: string;
  decidedBy?: string | null;
  expiresAt: string;
  createdAt: string;
  decision?: any;
}

export interface AuditEvent {
  id: string;
  actorType: string;
  actorId?: string;
  eventType: string;
  entityType: string;
  entityId: string;
  correlationId: string;
  payloadRedacted: Record<string, unknown>;
  createdAt: string;
}
