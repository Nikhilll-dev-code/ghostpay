import React, { useEffect, useMemo, useState } from "react";
import { ArrowRight, ArrowsClockwise, Check, CheckCircle, Prohibit, ShieldCheck } from "../components/icons";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useSafety } from "../context/SafetyContext";
import { Dialog } from "../components/Dialog";
import { useToast } from "../components/Toast";
import { useFetch } from "../lib/hooks";
import { formatBasisPoints, formatDateTime, formatMoney, parseMoneyInput, parsePercentInput } from "../lib/format";
import { Badge, EmptyState, ErrorState, Field, ListSkeleton, Notice, PageHeader } from "../components/ui";

interface Policy {
  id: string;
  version: number;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  actionPermissions: {
    orderCreation: boolean;
    orderCapture: boolean;
    refunds: boolean;
    discounts: boolean;
    transfers: boolean;
  };
  maxPaymentMinor: number;
  maxRefundMinor: number;
  maxDiscountBasisPoints: number;
  dailyExposureMinor: number;
  maxCustomerExposureMinor: number;
  maxActionsPerMinute: number;
  riskBudgetUnits: number;
  riskRules: any[];
  publishedAt?: string;
  changeReason?: string;
}

const PERMISSION_LABELS: Array<[keyof Policy["actionPermissions"], string]> = [
  ["orderCreation", "Order creation"],
  ["orderCapture", "Order capture"],
  ["refunds", "Refunds"],
  ["discounts", "Discounts"],
  ["transfers", "Transfers"],
];

interface Draft {
  maxDiscountBasisPoints: number;
  maxPaymentMinor: number;
  maxRefundMinor: number;
  dailyExposureMinor: number;
}

export const AuthorityView: React.FC = () => {
  const { user } = useAuth();
  const safety = useSafety();
  const toast = useToast();
  const { data, error, loading, reload } = useFetch(() => api.get<{ policies: Policy[] }>("/authority/policies"), []);

  const [maxDiscountPct, setMaxDiscountPct] = useState("");
  const [maxPaymentDollars, setMaxPaymentDollars] = useState("");
  const [maxRefundDollars, setMaxRefundDollars] = useState("");
  const [dailyExposureDollars, setDailyExposureDollars] = useState("");
  const [changeReason, setChangeReason] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState<Draft | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [initialised, setInitialised] = useState(false);

  const policies = data?.policies ?? [];
  const active = useMemo(() => policies.find((p) => p.status === "ACTIVE") ?? null, [policies]);
  const isOwner = user?.role === "OWNER";

  useEffect(() => {
    if (active && !initialised) {
      setMaxDiscountPct((active.maxDiscountBasisPoints / 100).toString());
      setMaxPaymentDollars((active.maxPaymentMinor / 100).toString());
      setMaxRefundDollars((active.maxRefundMinor / 100).toString());
      setDailyExposureDollars((active.dailyExposureMinor / 100).toString());
      setInitialised(true);
    }
  }, [active, initialised]);

  const validate = (): Draft | null => {
    const next: Record<string, string> = {};
    const discount = parsePercentInput(maxDiscountPct);
    const payment = parseMoneyInput(maxPaymentDollars);
    const refund = parseMoneyInput(maxRefundDollars);
    const daily = parseMoneyInput(dailyExposureDollars);
    if (discount === null || discount > 10000) next.discount = "Enter a percentage from 0 to 100 with at most two decimals.";
    if (payment === null || payment <= 0) next.payment = "Enter a dollar amount greater than zero.";
    if (refund === null || refund <= 0) next.refund = "Enter a dollar amount greater than zero.";
    if (daily === null || daily <= 0) next.daily = "Enter a dollar amount greater than zero.";
    if (payment !== null && daily !== null && payment > daily) next.payment = "The payment limit cannot exceed the daily exposure budget.";
    if (!changeReason.trim()) next.reason = "A reason is required. It is stored with the new version.";
    setErrors(next);
    if (Object.keys(next).length > 0) return null;
    return {
      maxDiscountBasisPoints: discount!,
      maxPaymentMinor: payment!,
      maxRefundMinor: refund!,
      dailyExposureMinor: daily!,
    };
  };

  const reviewChange = (event: React.FormEvent) => {
    event.preventDefault();
    const valid = validate();
    if (valid) {
      setPublishError(null);
      setDraft(valid);
    }
  };

  const publish = async () => {
    if (!draft) return;
    setPublishing(true);
    setPublishError(null);
    try {
      const payload = {
        actionPermissions: {
          orderCreation: true,
          orderCapture: true,
          refunds: true,
          discounts: true,
          transfers: false,
        },
        maxDiscountBasisPoints: draft.maxDiscountBasisPoints,
        maxPaymentMinor: draft.maxPaymentMinor,
        maxRefundMinor: draft.maxRefundMinor,
        dailyExposureMinor: draft.dailyExposureMinor,
        maxCustomerExposureMinor: Math.round(draft.dailyExposureMinor / 2),
        maxActionsPerMinute: 10,
        riskBudgetUnits: 100,
        riskRules: active?.riskRules || [],
        changeReason: changeReason.trim(),
      };
      const draftRes = await api.post<{ draft: Policy }>("/authority/policies/drafts", payload);
      await api.post(`/authority/policies/drafts/${draftRes.draft.id}/publish`);
      toast.success(`Authority Passport version ${draftRes.draft.version} is now active. Pending approvals made under the old version may need a new evaluation.`);
      setDraft(null);
      setChangeReason("");
      setInitialised(false);
      await Promise.all([reload(), safety.refresh()]);
    } catch (err: any) {
      setPublishError(err.message || "The server rejected the new policy version. Nothing was published.");
    } finally {
      setPublishing(false);
    }
  };

  const diffRows = active && draft
    ? [
        { label: "Maximum discount", from: formatBasisPoints(active.maxDiscountBasisPoints), to: formatBasisPoints(draft.maxDiscountBasisPoints), changed: active.maxDiscountBasisPoints !== draft.maxDiscountBasisPoints },
        { label: "Maximum payment", from: formatMoney(active.maxPaymentMinor), to: formatMoney(draft.maxPaymentMinor), changed: active.maxPaymentMinor !== draft.maxPaymentMinor },
        { label: "Maximum refund", from: formatMoney(active.maxRefundMinor), to: formatMoney(draft.maxRefundMinor), changed: active.maxRefundMinor !== draft.maxRefundMinor },
        { label: "Daily exposure", from: formatMoney(active.dailyExposureMinor), to: formatMoney(draft.dailyExposureMinor), changed: active.dailyExposureMinor !== draft.dailyExposureMinor },
      ]
    : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Authority Passport"
        description="Immutable policy versions that set the financial boundary. The AI cannot change them. Only an owner can publish."
        actions={
          <button type="button" className="btn btn-secondary" onClick={() => void reload()}>
            <ArrowsClockwise size={16} aria-hidden="true" />
            Refresh
          </button>
        }
      />

      {loading && !data && <ListSkeleton rows={4} />}
      {error && !data && <ErrorState message={error} onRetry={() => void reload()} />}
      {data && !active && (
        <EmptyState icon={ShieldCheck} title="No active policy" description="Without an active Authority Passport every action is denied by default. Seed the demo data or publish a first version." />
      )}

      {active && (
        <div className="grid gap-6 lg:grid-cols-5">
          <section className="card space-y-4 p-6 lg:col-span-3" aria-labelledby="active-policy">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="active-policy" className="title-2 flex items-center gap-2">
                <ShieldCheck size={18} className="text-ok" aria-hidden="true" /> Active version {active.version}
              </h2>
              <Badge tone="ok" icon={CheckCircle}>Active</Badge>
            </div>
            <dl className="grid grid-cols-2 gap-4">
              <Limit label="Maximum discount" value={formatBasisPoints(active.maxDiscountBasisPoints)} />
              <Limit label="Maximum payment" value={formatMoney(active.maxPaymentMinor)} />
              <Limit label="Maximum refund" value={formatMoney(active.maxRefundMinor)} />
              <Limit label="Daily exposure budget" value={formatMoney(active.dailyExposureMinor)} />
              <Limit label="Per customer exposure" value={formatMoney(active.maxCustomerExposureMinor)} />
              <Limit label="Actions per minute" value={String(active.maxActionsPerMinute)} />
            </dl>
            <div className="space-y-2 border-t border-line pt-4">
              <h3 className="caption-3 uppercase tracking-wider text-fg-subtle">Action permissions</h3>
              <ul className="flex flex-wrap gap-2">
                {PERMISSION_LABELS.map(([key, label]) => (
                  <li key={key}>
                    <Badge tone={active.actionPermissions[key] ? "ok" : "bad"} icon={active.actionPermissions[key] ? Check : Prohibit}>
                      {label} {active.actionPermissions[key] ? "enabled" : "disabled"}
                    </Badge>
                  </li>
                ))}
              </ul>
            </div>
            <p className="caption-5 text-fg-subtle">
              {active.riskRules?.length ?? 0} risk rules. {active.publishedAt ? `Published ${formatDateTime(active.publishedAt)}.` : ""}
              {active.changeReason ? ` Reason: ${active.changeReason}` : ""}
            </p>
          </section>

          <section className="card space-y-4 p-6 lg:col-span-2" aria-labelledby="new-version">
            <h2 id="new-version" className="title-2">Publish a new version</h2>
            {!isOwner && (
              <Notice tone="warn" role="status">
                Only an owner can publish a version. The server rejects the request from other roles.
              </Notice>
            )}
            <form onSubmit={reviewChange} noValidate className="space-y-3">
              <Field id="pol-discount" label="Maximum discount, percent" error={errors.discount}>
                {(p) => <input {...p} inputMode="decimal" value={maxDiscountPct} onChange={(e) => setMaxDiscountPct(e.target.value)} className="field num" />}
              </Field>
              <Field id="pol-payment" label="Maximum payment, USD" error={errors.payment}>
                {(p) => <input {...p} inputMode="decimal" value={maxPaymentDollars} onChange={(e) => setMaxPaymentDollars(e.target.value)} className="field num" />}
              </Field>
              <Field id="pol-refund" label="Maximum refund, USD" error={errors.refund}>
                {(p) => <input {...p} inputMode="decimal" value={maxRefundDollars} onChange={(e) => setMaxRefundDollars(e.target.value)} className="field num" />}
              </Field>
              <Field id="pol-daily" label="Daily exposure budget, USD" error={errors.daily} hint="The per customer limit is set to half of this value.">
                {(p) => <input {...p} inputMode="decimal" value={dailyExposureDollars} onChange={(e) => setDailyExposureDollars(e.target.value)} className="field num" />}
              </Field>
              <Field id="pol-reason" label="Reason for the change" error={errors.reason}>
                {(p) => <textarea {...p} rows={2} value={changeReason} onChange={(e) => setChangeReason(e.target.value)} className="field resize-none" />}
              </Field>
              <button type="submit" className="btn btn-primary w-full" disabled={!isOwner}>
                Review the change
                <ArrowRight size={16} aria-hidden="true" />
              </button>
            </form>
          </section>
        </div>
      )}

      {policies.length > 1 && (
        <section aria-labelledby="history" className="card">
          <h2 id="history" className="title-3 border-b border-line p-4">Version history</h2>
          <ul className="divide-y divide-line">
            {policies.map((policy) => (
              <li key={policy.id} className="flex flex-wrap items-center justify-between gap-2 p-4">
                <div>
                  <div className="body-5">Version {policy.version}</div>
                  <div className="caption-5 text-fg-subtle">
                    {policy.publishedAt ? formatDateTime(policy.publishedAt) : "Not published"}
                    {policy.changeReason ? ` · ${policy.changeReason}` : ""}
                  </div>
                </div>
                <Badge tone={policy.status === "ACTIVE" ? "ok" : "neutral"}>{policy.status.charAt(0) + policy.status.slice(1).toLowerCase()}</Badge>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Dialog
        open={!!draft}
        onClose={() => !publishing && setDraft(null)}
        closeDisabled={publishing}
        size="lg"
        title="Review before publishing"
        description="Publishing creates a new immutable version and makes it active immediately. This is recorded in the audit trail."
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setDraft(null)} disabled={publishing}>
              Go back
            </button>
            <button type="button" className="btn btn-primary" onClick={() => void publish()} disabled={publishing} data-autofocus>
              {publishing ? "Publishing" : `Publish version ${active ? active.version + 1 : ""}`}
            </button>
          </>
        }
      >
        <div className="table-wrap">
          <table className="w-full text-left">
            <caption className="sr-only">Changes between the active version and the new version</caption>
            <thead>
              <tr className="table-head">
                <th scope="col" className="px-3 py-2">Limit</th>
                <th scope="col" className="px-3 py-2">Active</th>
                <th scope="col" className="px-3 py-2">New</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {diffRows.map((row) => (
                <tr key={row.label}>
                  <th scope="row" className="body-5 px-3 py-2 font-medium">{row.label}</th>
                  <td className="num body-6 px-3 py-2 text-fg-muted">{row.from}</td>
                  <td className={`num body-5 px-3 py-2 ${row.changed ? "text-info" : "text-fg-muted"}`}>
                    {row.to} {row.changed ? "(changed)" : "(same)"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="caption-5 text-fg-muted">Reason: {changeReason}</p>
        {publishError && (
          <Notice tone="bad" role="alert">
            {publishError}
          </Notice>
        )}
      </Dialog>
    </div>
  );
};

const Limit: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="panel p-3">
    <dt className="caption-4 text-fg-subtle">{label}</dt>
    <dd className="heading-6 num mt-1">{value}</dd>
  </div>
);
