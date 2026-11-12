import React, { useMemo, useState } from "react";
import { ArrowsClockwise, Check, Clock, Hash, UserCheck, Warning, X } from "../components/icons";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useSafety } from "../context/SafetyContext";
import { Dialog } from "../components/Dialog";
import { useToast } from "../components/Toast";
import { useFetch, useNow } from "../lib/hooks";
import { formatDateTime, formatMoney, getExpiry, shortId } from "../lib/format";
import { appHash } from "../lib/route";
import type { Approval } from "../lib/types";
import { Badge, EmptyState, ErrorState, LabeledValue, ListSkeleton, Notice, PageHeader } from "../components/ui";
import type { Tone } from "../components/ui";

const FILTERS = [
  { id: "", label: "All" },
  { id: "PENDING", label: "Pending" },
  { id: "APPROVED", label: "Approved" },
  { id: "REJECTED", label: "Rejected" },
  { id: "USED", label: "Used" },
  { id: "EXPIRED", label: "Expired" },
];

const STATUS_TONE: Record<string, Tone> = {
  PENDING: "warn",
  APPROVED: "ok",
  USED: "info",
  REJECTED: "bad",
  EXPIRED: "neutral",
};

type PendingAction = { kind: "approve" | "reject"; approval: Approval } | null;

export const ApprovalsView: React.FC<{ initialStatus?: string }> = ({ initialStatus = "" }) => {
  const { user } = useAuth();
  const safety = useSafety();
  const toast = useToast();
  const now = useNow(15000);
  const { data, error, loading, reload } = useFetch(() => api.get<{ approvals: Approval[] }>("/approvals"), []);
  const [filter, setFilter] = useState(initialStatus);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const isOwner = user?.role === "OWNER";
  const activeVersion = safety.policyVersion;

  const approvals = data?.approvals ?? [];
  const visible = useMemo(() => approvals.filter((a) => !filter || a.status === filter), [approvals, filter]);

  const submitDecision = async () => {
    if (!pendingAction) return;
    setBusy(true);
    setActionError(null);
    try {
      await api.post(`/approvals/${pendingAction.approval.id}/${pendingAction.kind}`);
      toast.success(
        pendingAction.kind === "approve"
          ? "Approved. The server rechecks the policy, the payload hash and the expiry before it executes."
          : "Rejected. The decision is recorded and the action will not run."
      );
      setPendingAction(null);
      await Promise.all([reload(), safety.refresh()]);
    } catch (err: any) {
      setActionError(err.message || "The server rejected this request.");
    } finally {
      setBusy(false);
    }
  };

  const pendingApproval = pendingAction?.approval;
  const pendingStale = pendingApproval?.decision && activeVersion !== null && pendingApproval.decision.policyVersion !== activeVersion;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Approval Queue"
        description="Each approval is bound to the exact action payload, expires, and can be used once. The backend checks it again at execution."
        actions={
          <button type="button" className="btn btn-secondary" onClick={() => void reload()}>
            <ArrowsClockwise size={16} aria-hidden="true" />
            Refresh
          </button>
        }
      />

      {!isOwner && (
        <Notice tone="info" icon={UserCheck}>
          You are signed in as an operator. Only an owner can approve or reject items. You can still review them here.
        </Notice>
      )}

      <div role="group" aria-label="Filter by status" className="flex flex-wrap gap-2">
        {FILTERS.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={filter === item.id}
            onClick={() => setFilter(item.id)}
            className={`btn ${filter === item.id ? "btn-secondary border-fg-subtle text-fg" : "btn-ghost"}`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {loading && !data && <ListSkeleton rows={3} />}
      {error && !data && <ErrorState message={error} onRetry={() => void reload()} />}

      {data && visible.length === 0 && (
        <EmptyState
          icon={UserCheck}
          title={filter ? "No approvals with this status" : "The queue is empty"}
          description={filter ? "Choose another status to see more." : "Requests that need a human decision appear here. In Ghost Brain, try a purchase of $350 or more to create one."}
          action={
            !filter ? (
              <a href={appHash("brain")} className="btn btn-primary">
                Open Ghost Brain
              </a>
            ) : undefined
          }
        />
      )}

      <ul className="space-y-4">
        {visible.map((approval) => {
          const expiry = getExpiry(approval.expiresAt, now);
          const isPending = approval.status === "PENDING";
          const stale = approval.decision && activeVersion !== null && approval.decision.policyVersion !== activeVersion;
          const payload = approval.decision?.proposal?.payload ?? approval.decision?.payload;
          const amount = payload?.amountMinor;
          return (
            <li key={approval.id} className="card space-y-4 p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={STATUS_TONE[approval.status] ?? "neutral"}>{approval.status.charAt(0) + approval.status.slice(1).toLowerCase()}</Badge>
                    {isPending && (
                      <Badge tone={expiry.expired ? "bad" : expiry.soon ? "warn" : "neutral"} icon={Clock}>
                        {expiry.label}
                      </Badge>
                    )}
                    {stale && (
                      <Badge tone="warn" icon={Warning} title="Policy changed since this decision was made">
                        Policy changed, v{approval.decision.policyVersion} to v{activeVersion}
                      </Badge>
                    )}
                  </div>
                  <div className="num body-5">{shortId(approval.id, 14)}</div>
                </div>
                {isPending && (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="btn btn-danger"
                      disabled={!isOwner}
                      title={isOwner ? undefined : "Only an owner can reject"}
                      onClick={() => { setActionError(null); setPendingAction({ kind: "reject", approval }); }}
                    >
                      <X size={14} aria-hidden="true" />
                      Reject
                    </button>
                    <button
                      type="button"
                      className="btn btn-ok"
                      disabled={!isOwner || expiry.expired}
                      title={!isOwner ? "Only an owner can approve" : expiry.expired ? "This approval has expired" : undefined}
                      onClick={() => { setActionError(null); setPendingAction({ kind: "approve", approval }); }}
                    >
                      <Check size={14} aria-hidden="true" />
                      Approve
                    </button>
                  </div>
                )}
              </div>

              {isPending && expiry.expired && (
                <Notice tone="bad" icon={Clock} role="status">
                  This approval has expired. The server will refuse it, and a new request is needed.
                </Notice>
              )}
              {isPending && !expiry.expired && expiry.soon && (
                <Notice tone="warn" icon={Clock} role="status">
                  Expires in under five minutes. Decide now or the request has to be raised again.
                </Notice>
              )}

              <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <LabeledValue label="Requested by">{approval.requestedBy}</LabeledValue>
                <LabeledValue label="Created">{formatDateTime(approval.createdAt)}</LabeledValue>
                <LabeledValue label="Expires">{formatDateTime(approval.expiresAt)}</LabeledValue>
                {amount !== undefined && <LabeledValue label="Amount" mono>{formatMoney(amount)}</LabeledValue>}
              </dl>

              <div className="panel flex flex-wrap items-center justify-between gap-2 p-3">
                <span className="caption-4 inline-flex items-center gap-1 text-fg-subtle">
                  <Hash size={12} aria-hidden="true" /> Payload hash
                </span>
                <code className="num caption-5 break-all text-fg-muted">{approval.payloadHash}</code>
              </div>

              <div className="flex flex-wrap gap-4">
                <a href={appHash("audit", { q: approval.decisionId })} className="caption-3 text-info hover:underline">
                  View decision evidence
                </a>
                {approval.decidedBy && <span className="caption-5 text-fg-subtle">Decided by {approval.decidedBy}</span>}
              </div>
            </li>
          );
        })}
      </ul>

      <Dialog
        open={!!pendingAction}
        onClose={() => !busy && setPendingAction(null)}
        closeDisabled={busy}
        title={pendingAction?.kind === "approve" ? "Approve this action" : "Reject this action"}
        description={
          pendingAction?.kind === "approve"
            ? "Approval authorizes exactly the payload shown by this hash, once."
            : "The action will not run. This is recorded in the audit trail."
        }
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setPendingAction(null)} disabled={busy}>
              Cancel
            </button>
            <button
              type="button"
              className={`btn ${pendingAction?.kind === "approve" ? "btn-ok-solid" : "btn-danger-solid"}`}
              onClick={() => void submitDecision()}
              disabled={busy}
              data-autofocus
            >
              {busy ? "Sending" : pendingAction?.kind === "approve" ? "Confirm approval" : "Confirm rejection"}
            </button>
          </>
        }
      >
        {pendingApproval && (
          <div className="space-y-3">
            <dl className="panel grid grid-cols-2 gap-3 p-3">
              <LabeledValue label="Approval" mono>{shortId(pendingApproval.id, 14)}</LabeledValue>
              <LabeledValue label="Hash" mono>{shortId(pendingApproval.payloadHash, 16)}</LabeledValue>
            </dl>
            {pendingStale && pendingAction?.kind === "approve" && (
              <Notice tone="warn" icon={Warning} role="alert">
                The policy changed after this decision was made. The server may refuse the approval and ask for a new evaluation.
              </Notice>
            )}
            {actionError && (
              <Notice tone="bad" role="alert">
                {actionError}
              </Notice>
            )}
          </div>
        )}
      </Dialog>
    </div>
  );
};
