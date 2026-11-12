import React from "react";
import {
  ArrowRight,
  ArrowsClockwise,
  Clock,
  Crosshair,
  Eye,
  Lightning,
  LockKey,
  Receipt,
  Robot,
  ShieldCheck,
  ShieldWarning,
  UserCheck,
  Warning,
} from "../components/icons";
import { useAuth } from "../context/AuthContext";
import { useSafety } from "../context/SafetyContext";
import { useNow } from "../lib/hooks";
import { appHash } from "../lib/route";
import { formatMoney, formatDateTime, getExpiry, shortId } from "../lib/format";
import { api } from "../api/client";
import { useFetch } from "../lib/hooks";
import type { Approval } from "../lib/types";
import {
  Badge,
  CardSkeleton,
  DecisionBadge,
  EmptyState,
  ErrorState,
  LabeledValue,
  ListSkeleton,
  Notice,
  PageHeader,
  TransactionBadge,
} from "../components/ui";

const MODE_COPY: Record<string, { label: string; detail: string }> = {
  OBSERVE: { label: "Observe", detail: "Decisions are computed and logged. Nothing executes." },
  ASSIST: { label: "Assist", detail: "Ghost proposes and a human approves anything that moves money." },
  AUTOPILOT: { label: "Autopilot", detail: "Actions inside policy limits execute on PayPal Sandbox." },
  LOCKDOWN: { label: "Lockdown", detail: "Every financial action is blocked." },
};

export const OverviewView: React.FC = () => {
  const { settings } = useAuth();
  const safety = useSafety();
  const now = useNow(30000);
  const approvals = useFetch(() => api.get<{ approvals: Approval[] }>("/approvals"), []);

  const summary = safety.summary;
  const isFrozen = !!settings?.killSwitchEnabled;
  const mode = settings?.mode ? MODE_COPY[settings.mode] : null;

  if (safety.loading && !summary) {
    return (
      <div className="space-y-6" role="status" aria-label="Loading overview">
        <PageHeader title="Overview" description="Loading the live safety summary." />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <CardSkeleton key={i} lines={1} />
          ))}
        </div>
        <ListSkeleton rows={4} />
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="space-y-6">
        <PageHeader title="Overview" />
        <ErrorState message={safety.summaryError ?? "The dashboard summary is unavailable"} onRetry={() => void safety.refresh()} />
      </div>
    );
  }

  const m = summary.metrics;
  const dailyUsed = m.dailyLimitMinor > 0 ? Math.min(100, Math.round((m.dailySpentMinor / m.dailyLimitMinor) * 100)) : 0;
  const run = summary.latestRedTeamRun;
  const reconciliation = safety.reconciliationItems;
  const pendingApprovals = (approvals.data?.approvals ?? []).filter((a) => a.status === "PENDING");
  const needsAttention = pendingApprovals.length > 0 || (reconciliation?.length ?? 0) > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Overview"
        description="The live safety state of Ghost, taken from the backend. Figures refresh every thirty seconds."
        badge={<Badge tone="warn" icon={LockKey}>Sandbox only</Badge>}
        actions={
          <button type="button" className="btn btn-secondary" onClick={() => void safety.refresh()}>
            <ArrowsClockwise size={16} aria-hidden="true" />
            Refresh
          </button>
        }
      />

      {isFrozen && (
        <Notice tone="bad" icon={ShieldWarning} role="alert">
          <strong className="text-fg">Kill switch engaged.</strong> New financial executions are rejected.
          {settings?.killSwitchReason ? ` Reason on record: ${settings.killSwitchReason}.` : ""}
        </Notice>
      )}
      {safety.summaryError && (
        <Notice tone="warn" icon={Warning} role="status">
          The last refresh failed ({safety.summaryError}). The figures below may be out of date.
        </Notice>
      )}

      <section aria-labelledby="safety-summary" className="card space-y-4 p-6">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 id="safety-summary" className="title-2">Operational safety summary</h2>
            <p className="caption-5 text-fg-subtle">
              Updated {safety.lastUpdated ? formatDateTime(safety.lastUpdated) : "never"}. Values come from the dashboard and
              transaction APIs.
            </p>
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          <LabeledValue label="Environment">
            <Badge tone="warn" icon={LockKey}>{summary.environment === "SANDBOX" ? "PayPal Sandbox" : summary.environment}</Badge>
          </LabeledValue>
          <LabeledValue label="Operating mode">
            <span className="flex items-center gap-2">
              {settings?.mode === "AUTOPILOT" ? <Lightning size={16} className="text-ok" aria-hidden="true" /> : settings?.mode === "OBSERVE" ? <Eye size={16} className="text-info" aria-hidden="true" /> : settings?.mode === "ASSIST" ? <UserCheck size={16} className="text-warn" aria-hidden="true" /> : <Warning size={16} className="text-bad" aria-hidden="true" />}
              {mode?.label ?? summary.mode}
            </span>
          </LabeledValue>
          <LabeledValue label="Active policy">
            <a href={appHash("authority")} className="num inline-flex items-center gap-1 text-info hover:underline">
              Version {summary.policyVersion}
              <ArrowRight size={12} aria-hidden="true" />
            </a>
          </LabeledValue>
          <LabeledValue label="Kill switch">
            <Badge tone={isFrozen ? "bad" : "ok"} icon={isFrozen ? ShieldWarning : ShieldCheck}>
              {isFrozen ? "Engaged" : "Clear"}
            </Badge>
          </LabeledValue>
          <LabeledValue label="Daily budget used">
            <span className="num">{dailyUsed}%</span>
          </LabeledValue>
        </dl>
        {mode && <p className="body-6 text-fg-muted">{mode.detail}</p>}
      </section>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Processed in Sandbox" value={formatMoney(m.processedAmountMinor)} sub={`${m.totalOperationsCount} operations`} />
        <Metric
          label="Pending approvals"
          value={String(m.pendingApprovalsCount)}
          sub={m.pendingApprovalsCount > 0 ? "Waiting for a human" : "Nothing waiting"}
          tone={m.pendingApprovalsCount > 0 ? "warn" : undefined}
          href={appHash("approvals", { status: "PENDING" })}
        />
        <Metric label="Blocked decisions" value={String(m.blockedDecisionsCount)} sub="Stopped by policy" href={appHash("audit")} />
        <Metric
          label="Reconciliation items"
          value={reconciliation === null ? "Unknown" : String(reconciliation.length)}
          sub={reconciliation === null ? "Transactions could not be loaded" : reconciliation.length > 0 ? "Provider result unconfirmed" : "Nothing unconfirmed"}
          tone={reconciliation && reconciliation.length > 0 ? "warn" : undefined}
          href={appHash("transactions", { status: "PENDING_RECONCILIATION" })}
        />
      </div>

      <section aria-labelledby="budget" className="card space-y-3 p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="budget" className="title-2">Daily exposure budget</h2>
          <span className="num body-5">
            {formatMoney(m.dailySpentMinor)} of {formatMoney(m.dailyLimitMinor)}
          </span>
        </div>
        <div
          className="h-2 overflow-hidden rounded-full bg-hover"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={dailyUsed}
          aria-label="Daily exposure used"
        >
          <div className={`h-full origin-left rounded-full ${dailyUsed >= 90 ? "bg-bad" : dailyUsed >= 70 ? "bg-warn" : "bg-ok"}`} style={{ width: `${dailyUsed}%` }} />
        </div>
        <p className="caption-5 text-fg-subtle">{formatMoney(m.dailyRemainingMinor)} remaining under the active Authority Passport.</p>
      </section>

      <section aria-labelledby="attention" className="space-y-3">
        <h2 id="attention" className="title-2">Needs attention</h2>
        {approvals.error && (
          <Notice tone="warn" role="status">
            Pending approvals could not be listed ({approvals.error}).
          </Notice>
        )}
        {!needsAttention && !approvals.error ? (
          <EmptyState icon={ShieldCheck} title="Nothing needs attention" description="No approvals are waiting and no transaction is pending reconciliation." />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="card divide-y divide-line">
              <div className="flex items-center justify-between p-4">
                <span className="body-4">Approvals waiting</span>
                <a href={appHash("approvals", { status: "PENDING" })} className="caption-3 text-info hover:underline">Open queue</a>
              </div>
              {pendingApprovals.length === 0 && <p className="body-6 p-4 text-fg-muted">No pending approvals.</p>}
              {pendingApprovals.slice(0, 4).map((approval) => {
                const expiry = getExpiry(approval.expiresAt, now);
                const stale = approval.decision && approval.decision.policyVersion !== summary.policyVersion;
                return (
                  <div key={approval.id} className="flex flex-wrap items-center justify-between gap-2 p-4">
                    <div className="min-w-0">
                      <div className="num body-5">{shortId(approval.id)}</div>
                      <div className="caption-5 text-fg-subtle">Requested by {approval.requestedBy}</div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {stale && <Badge tone="warn" icon={Warning}>Policy changed</Badge>}
                      <Badge tone={expiry.expired ? "bad" : expiry.soon ? "warn" : "neutral"} icon={Clock}>{expiry.label}</Badge>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="card divide-y divide-line">
              <div className="flex items-center justify-between p-4">
                <span className="body-4">Pending reconciliation</span>
                <a href={appHash("transactions", { status: "PENDING_RECONCILIATION" })} className="caption-3 text-info hover:underline">Open ledger</a>
              </div>
              {(reconciliation ?? []).length === 0 && <p className="body-6 p-4 text-fg-muted">No unconfirmed provider results.</p>}
              {(reconciliation ?? []).slice(0, 4).map((tx) => (
                <a key={tx.id} href={appHash("transactions", { q: tx.id })} className="motion-color flex flex-wrap items-center justify-between gap-2 p-4 hover:bg-raised">
                  <div className="min-w-0">
                    <div className="num body-5">{shortId(tx.id)}</div>
                    <div className="caption-5 text-fg-subtle">{tx.actionType} · {formatDateTime(tx.createdAt)}</div>
                  </div>
                  <span className="num body-5">{formatMoney(tx.amountMinor, tx.currency)}</span>
                </a>
              ))}
            </div>
          </div>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section aria-labelledby="recent-decisions" className="card">
          <div className="flex items-center justify-between border-b border-line p-4">
            <h2 id="recent-decisions" className="title-3">Recent decisions</h2>
            <a href={appHash("brain")} className="caption-3 inline-flex items-center gap-1 text-info hover:underline">
              <Robot size={14} aria-hidden="true" /> Open Ghost Brain
            </a>
          </div>
          {summary.recentDecisions.length === 0 ? (
            <p className="body-6 p-6 text-fg-muted">No decisions yet. Send a customer request in Ghost Brain to create one.</p>
          ) : (
            <ul className="divide-y divide-line">
              {summary.recentDecisions.map((decision) => (
                <li key={decision.id} className="flex flex-wrap items-center justify-between gap-2 p-4">
                  <div className="min-w-0">
                    <div className="num body-5">{shortId(decision.id)}</div>
                    <div className="caption-5 text-fg-subtle">
                      Policy v{decision.policyVersion} · {formatDateTime(decision.createdAt)}
                    </div>
                  </div>
                  <DecisionBadge outcome={decision.outcome} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="recent-tx" className="card">
          <div className="flex items-center justify-between border-b border-line p-4">
            <h2 id="recent-tx" className="title-3">Recent transactions</h2>
            <a href={appHash("transactions")} className="caption-3 inline-flex items-center gap-1 text-info hover:underline">
              <Receipt size={14} aria-hidden="true" /> Open ledger
            </a>
          </div>
          {summary.recentTransactions.length === 0 ? (
            <p className="body-6 p-6 text-fg-muted">No transactions yet. Authorized actions appear here after Sandbox execution.</p>
          ) : (
            <ul className="divide-y divide-line">
              {summary.recentTransactions.map((tx) => (
                <li key={tx.id} className="flex flex-wrap items-center justify-between gap-2 p-4">
                  <div className="min-w-0">
                    <div className="body-5">{tx.actionType}</div>
                    <div className="num caption-5 text-fg-subtle">{shortId(tx.id)} · {formatDateTime(tx.createdAt)}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="num body-5">{formatMoney(tx.amountMinor, tx.currency)}</span>
                    <TransactionBadge status={tx.status} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section aria-labelledby="gb" className="card flex flex-wrap items-center justify-between gap-4 p-6">
        <div className="space-y-1">
          <h2 id="gb" className="title-2 flex items-center gap-2">
            <Crosshair size={18} aria-hidden="true" /> Ghostbreaker
          </h2>
          {run ? (
            <p className="body-6 text-fg-muted">
              Latest run of suite {run.suiteVersion}: {run.passedCount} of {run.totalCases} defenses held.
              {run.failedCount > 0 ? ` ${run.failedCount} failed and need review.` : ""}
            </p>
          ) : (
            <p className="body-6 text-fg-muted">The suite has not been run yet. It replays ten attack cases against the live policy.</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {run && (
            <Badge tone={run.failedCount > 0 ? "bad" : "ok"} icon={run.failedCount > 0 ? Warning : ShieldCheck}>
              {run.failedCount > 0 ? `${run.failedCount} failed` : "All held"}
            </Badge>
          )}
          <a href={appHash("ghostbreaker")} className="btn btn-secondary">
            {run ? "Open results" : "Run the suite"}
            <ArrowRight size={16} aria-hidden="true" />
          </a>
        </div>
      </section>
    </div>
  );
};

const Metric: React.FC<{ label: string; value: string; sub: string; tone?: "warn"; href?: string }> = ({ label, value, sub, tone, href }) => {
  const body = (
    <>
      <div className="caption-4 text-fg-subtle">{label}</div>
      <div className={`heading-5 num mt-1 ${tone === "warn" ? "text-warn" : ""}`}>{value}</div>
      <div className="caption-5 mt-1 text-fg-muted">{sub}</div>
    </>
  );
  return href ? (
    <a href={href} className="card-interactive block p-4">
      {body}
    </a>
  ) : (
    <div className="card p-4">{body}</div>
  );
};
