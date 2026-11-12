import React, { useMemo, useRef, useState } from "react";
import { ArrowCounterClockwise, ArrowDownLeft, ArrowsClockwise, Receipt } from "../components/icons";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useSafety } from "../context/SafetyContext";
import { Dialog } from "../components/Dialog";
import { useToast } from "../components/Toast";
import { formatDateTime, formatMoney, parseMoneyInput, shortId, isSimulatedProviderId } from "../lib/format";
import { appHash } from "../lib/route";
import type { Transaction } from "../lib/types";
import {
  EmptyState,
  ErrorState,
  Field,
  ListSkeleton,
  Notice,
  PageHeader,
  SimulatedTag,
  TransactionBadge,
} from "../components/ui";

const STATUS_FILTERS = [
  { id: "", label: "All statuses" },
  { id: "COMPLETED", label: "Completed" },
  { id: "PENDING_RECONCILIATION", label: "Pending reconciliation" },
  { id: "FAILED", label: "Failed" },
];

export const TransactionsView: React.FC<{ initialQuery?: string; initialStatus?: string }> = ({
  initialQuery = "",
  initialStatus = "",
}) => {
  const safety = useSafety();
  const { user } = useAuth();
  const toast = useToast();
  const [search, setSearch] = useState(initialQuery);
  const [status, setStatus] = useState(initialStatus);
  const [reconcilingId, setReconcilingId] = useState<string | null>(null);
  const [refundTx, setRefundTx] = useState<Transaction | null>(null);
  const [refundAmount, setRefundAmount] = useState("");
  const [refundError, setRefundError] = useState<string | null>(null);
  const [refunding, setRefunding] = useState(false);
  const refundRef = useRef<HTMLInputElement>(null);

  const transactions = safety.transactions;
  const isOwner = user?.role === "OWNER";

  const filtered = useMemo(() => {
    if (!transactions) return [];
    const term = search.trim().toLowerCase();
    return transactions.filter((tx) => {
      if (status && tx.status !== status) return false;
      if (!term) return true;
      return [tx.id, tx.actionType, tx.status, tx.paypalOrderId, tx.paypalCaptureId, tx.paypalRefundId, tx.idempotencyKey]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    });
  }, [transactions, search, status]);

  const handleReconcile = async (id: string) => {
    setReconcilingId(id);
    try {
      await api.post(`/transactions/${id}/reconcile`);
      toast.success("Reconciliation finished. The ledger shows the server result.");
    } catch (err: any) {
      toast.error(`Reconciliation failed: ${err.message}. The transaction was left as it was.`);
    } finally {
      setReconcilingId(null);
      await safety.refresh();
    }
  };

  const openRefund = (tx: Transaction) => {
    setRefundTx(tx);
    setRefundAmount((tx.amountMinor / 100).toFixed(2));
    setRefundError(null);
  };

  const closeRefund = () => {
    if (refunding) return;
    setRefundTx(null);
  };

  const submitRefund = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!refundTx) return;
    const minor = parseMoneyInput(refundAmount);
    if (minor === null || minor <= 0) {
      setRefundError("Enter an amount greater than zero with at most two decimals.");
      return;
    }
    if (minor > refundTx.amountMinor) {
      setRefundError(`The refund cannot exceed the captured amount of ${formatMoney(refundTx.amountMinor, refundTx.currency)}.`);
      return;
    }
    setRefunding(true);
    setRefundError(null);
    try {
      await api.post(`/transactions/${refundTx.id}/refund`, { amountMinor: minor });
      toast.success("Refund request sent to the server. The ledger now shows its result.");
      setRefundTx(null);
      await safety.refresh();
    } catch (err: any) {
      setRefundError(err.message || "The refund was rejected by the server.");
    } finally {
      setRefunding(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Transactions"
        description="Sandbox ledger with provider references. Uncertain provider results stay in pending reconciliation until the server confirms them."
        actions={
          <button type="button" className="btn btn-secondary" onClick={() => void safety.refresh()}>
            <ArrowsClockwise size={16} aria-hidden="true" />
            Refresh
          </button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-[1fr_220px]">
        <div>
          <label htmlFor="tx-search" className="sr-only">
            Search transactions
          </label>
          <input
            id="tx-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by ID, action, provider reference or idempotency key"
            className="field"
          />
        </div>
        <div>
          <label htmlFor="tx-status" className="sr-only">
            Filter by status
          </label>
          <select id="tx-status" value={status} onChange={(event) => setStatus(event.target.value)} className="field">
            {STATUS_FILTERS.map((filter) => (
              <option key={filter.id} value={filter.id}>
                {filter.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {safety.transactionsError && transactions && (
        <Notice tone="warn" role="status">
          The last refresh failed ({safety.transactionsError}). You are seeing the previous results.
        </Notice>
      )}

      {!transactions && safety.loading && <ListSkeleton rows={5} />}
      {!transactions && !safety.loading && (
        <ErrorState message={safety.transactionsError ?? "The ledger is unavailable"} onRetry={() => void safety.refresh()} />
      )}

      {transactions && transactions.length === 0 && (
        <EmptyState
          icon={Receipt}
          title="No transactions yet"
          description="Authorized actions appear here after Sandbox execution. Send a purchase request in Ghost Brain to create one."
          action={
            <a href={appHash("brain")} className="btn btn-primary">
              Open Ghost Brain
            </a>
          }
        />
      )}

      {transactions && transactions.length > 0 && filtered.length === 0 && (
        <EmptyState
          icon={Receipt}
          title="No transactions match these filters"
          description="Clear the search or choose another status to see the full ledger."
          action={
            <button type="button" className="btn btn-secondary" onClick={() => { setSearch(""); setStatus(""); }}>
              Clear filters
            </button>
          }
        />
      )}

      {filtered.length > 0 && (
        <div className="table-wrap">
          <table className="w-full min-w-[820px] text-left">
            <caption className="sr-only">Sandbox transactions</caption>
            <thead>
              <tr className="table-head">
                <th scope="col" className="px-4 py-3">Transaction</th>
                <th scope="col" className="px-4 py-3">Amount</th>
                <th scope="col" className="px-4 py-3">Status</th>
                <th scope="col" className="px-4 py-3">Provider references</th>
                <th scope="col" className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filtered.map((tx) => {
                const isReconciling = tx.status === "PENDING_RECONCILIATION";
                const refundable = tx.status === "COMPLETED" && !!tx.paypalCaptureId && tx.actionType !== "REFUND_REQUEST";
                const simulated = [tx.paypalOrderId, tx.paypalCaptureId, tx.paypalRefundId].some(isSimulatedProviderId);
                return (
                  <tr key={tx.id} className="align-top motion-color hover:bg-raised">
                    <td className="px-4 py-3">
                      <div className="body-5">{tx.actionType}</div>
                      <div className="num caption-5 text-fg-subtle" title={tx.id}>{shortId(tx.id, 12)}</div>
                      <div className="caption-5 text-fg-subtle">{formatDateTime(tx.createdAt)}</div>
                    </td>
                    <td className="num body-5 px-4 py-3">{formatMoney(tx.amountMinor, tx.currency)}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        <TransactionBadge status={tx.status} />
                        {simulated && <SimulatedTag />}
                      </div>
                      {isReconciling && (
                        <p className="caption-5 mt-1 max-w-48 text-warn">The provider result is unconfirmed. Reconcile before treating this as paid.</p>
                      )}
                    </td>
                    <td className="num caption-5 space-y-0.5 px-4 py-3 text-fg-muted">
                      {tx.paypalOrderId && <div>Order {tx.paypalOrderId}</div>}
                      {tx.paypalCaptureId && <div>Capture {tx.paypalCaptureId}</div>}
                      {tx.paypalRefundId && <div className="text-info">Refund {tx.paypalRefundId}</div>}
                      {!tx.paypalOrderId && !tx.paypalCaptureId && !tx.paypalRefundId && <div className="text-fg-subtle">No provider reference</div>}
                      <div className="text-fg-subtle" title={tx.idempotencyKey}>Key {shortId(tx.idempotencyKey, 10)}</div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        {refundable && (
                          <button type="button" className="btn btn-secondary" onClick={() => openRefund(tx)} disabled={!isOwner} title={isOwner ? undefined : "Only an owner can request refunds"}>
                            <ArrowDownLeft size={14} aria-hidden="true" />
                            Refund
                          </button>
                        )}
                        {isReconciling && (
                          <button type="button" className="btn btn-secondary" onClick={() => void handleReconcile(tx.id)} disabled={reconcilingId === tx.id}>
                            <ArrowCounterClockwise size={14} aria-hidden="true" />
                            {reconcilingId === tx.id ? "Reconciling" : "Reconcile"}
                          </button>
                        )}
                        <a href={appHash("audit", { q: tx.id })} className="btn btn-ghost">
                          Evidence
                        </a>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Dialog
        open={!!refundTx}
        onClose={closeRefund}
        closeDisabled={refunding}
        initialFocusRef={refundRef}
        title="Request a Sandbox refund"
        description="The server validates the amount against the capture, your role and the active policy. It can still reject this request."
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={closeRefund} disabled={refunding}>
              Cancel
            </button>
            <button type="submit" form="refund-form" className="btn btn-primary" disabled={refunding}>
              {refunding ? "Sending" : "Send refund request"}
            </button>
          </>
        }
      >
        {refundTx && (
          <form id="refund-form" onSubmit={submitRefund} noValidate className="space-y-4">
            <dl className="panel grid grid-cols-2 gap-3 p-3">
              <div>
                <dt className="caption-4 text-fg-subtle">Capture</dt>
                <dd className="num caption-5 break-all">{refundTx.paypalCaptureId}</dd>
              </div>
              <div>
                <dt className="caption-4 text-fg-subtle">Captured amount</dt>
                <dd className="num body-5">{formatMoney(refundTx.amountMinor, refundTx.currency)}</dd>
              </div>
            </dl>
            <Field id="refund-amount" label={`Refund amount in ${refundTx.currency}`} error={refundError} hint="Up to two decimals. Partial refunds are allowed.">
              {(props) => (
                <input
                  {...props}
                  ref={refundRef}
                  inputMode="decimal"
                  value={refundAmount}
                  onChange={(event) => setRefundAmount(event.target.value)}
                  className="field num"
                />
              )}
            </Field>
          </form>
        )}
      </Dialog>
    </div>
  );
};
