import React, { useState } from "react";
import { ArrowRight, Flask, Play, Warning } from "../components/icons";
import { api } from "../api/client";
import { formatSigned, formatSignedMoney, parseMoneyInput, parsePercentInput } from "../lib/format";
import { Badge, DecisionBadge, EmptyState, Field, Notice, PageHeader } from "../components/ui";

export const WhatIfView: React.FC = () => {
  const [maxDiscountPct, setMaxDiscountPct] = useState("25");
  const [maxPaymentDollars, setMaxPaymentDollars] = useState("750");
  const [maxRefundDollars, setMaxRefundDollars] = useState("350");
  const [dailyExposureDollars, setDailyExposureDollars] = useState("3000");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [comparison, setComparison] = useState<any | null>(null);

  const run = async (event: React.FormEvent) => {
    event.preventDefault();
    const discount = parsePercentInput(maxDiscountPct);
    const payment = parseMoneyInput(maxPaymentDollars);
    const refund = parseMoneyInput(maxRefundDollars);
    const daily = parseMoneyInput(dailyExposureDollars);
    const next: Record<string, string> = {};
    if (discount === null || discount > 10000) next.discount = "Enter a percentage from 0 to 100.";
    if (payment === null || payment <= 0) next.payment = "Enter a dollar amount greater than zero.";
    if (refund === null || refund <= 0) next.refund = "Enter a dollar amount greater than zero.";
    if (daily === null || daily <= 0) next.daily = "Enter a dollar amount greater than zero.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setLoading(true);
    setRequestError(null);
    try {
      const res = await api.post<{ comparison: any }>("/simulations", {
        actionPermissions: { orderCreation: true, orderCapture: true, refunds: true, discounts: true, transfers: false },
        maxDiscountBasisPoints: discount,
        maxPaymentMinor: payment,
        maxRefundMinor: refund,
        dailyExposureMinor: daily,
        maxCustomerExposureMinor: Math.round(daily! / 2),
        maxActionsPerMinute: 10,
        riskBudgetUnits: 100,
        riskRules: [],
        changeReason: "What-If Simulation Replay",
      });
      setComparison(res.comparison);
    } catch (err: any) {
      setRequestError(err.message || "The simulation failed. Nothing was published or executed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="What-If Lab"
        description="Replay historical and synthetic fixtures against alternative limits before you publish them."
        badge={<Badge tone="violet">Simulation only</Badge>}
      />
      <Notice tone="info" icon={Flask}>
        Simulations run the deterministic policy engine on synthetic fixtures. They never call PayPal, never change the active
        policy and never write a transaction. The proposed risk rules are empty, so risk rule outcomes are not part of the replay.
      </Notice>

      <form onSubmit={run} noValidate className="card grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-5 lg:items-start">
        <Field id="wi-discount" label="Maximum discount, percent" error={errors.discount}>
          {(p) => <input {...p} inputMode="decimal" value={maxDiscountPct} onChange={(e) => setMaxDiscountPct(e.target.value)} className="field num" />}
        </Field>
        <Field id="wi-payment" label="Maximum payment, USD" error={errors.payment}>
          {(p) => <input {...p} inputMode="decimal" value={maxPaymentDollars} onChange={(e) => setMaxPaymentDollars(e.target.value)} className="field num" />}
        </Field>
        <Field id="wi-refund" label="Maximum refund, USD" error={errors.refund}>
          {(p) => <input {...p} inputMode="decimal" value={maxRefundDollars} onChange={(e) => setMaxRefundDollars(e.target.value)} className="field num" />}
        </Field>
        <Field id="wi-daily" label="Daily exposure, USD" error={errors.daily}>
          {(p) => <input {...p} inputMode="decimal" value={dailyExposureDollars} onChange={(e) => setDailyExposureDollars(e.target.value)} className="field num" />}
        </Field>
        <div className="flex sm:col-span-2 lg:col-span-1 lg:pt-6">
          <button type="submit" disabled={loading} className="btn btn-primary w-full">
            <Play size={16} weight="fill" aria-hidden="true" />
            {loading ? "Replaying fixtures" : "Run policy replay"}
          </button>
        </div>
      </form>

      {requestError && (
        <Notice tone="bad" icon={Warning} role="alert">
          {requestError}
        </Notice>
      )}

      {!comparison && !requestError && (
        <EmptyState icon={Flask} title="No replay yet" description="Adjust the limits above and run a replay to see which fixture decisions would shift." />
      )}

      {comparison && (
        <div className="space-y-4" aria-live="polite">
          <div className="grid gap-4 md:grid-cols-4">
            <Delta label="Allowed decisions" value={formatSigned(comparison.delta.allowedDelta)} sub={`Baseline ${comparison.baselineStats.allowedCount} to proposed ${comparison.proposedStats.allowedCount}`} />
            <Delta label="Blocked decisions" value={formatSigned(comparison.delta.blockedDelta)} sub={`Baseline ${comparison.baselineStats.blockedCount} to proposed ${comparison.proposedStats.blockedCount}`} />
            <Delta label="Exposure change" value={formatSignedMoney(comparison.delta.exposureDeltaMinor)} sub="Extra amount authorized by the proposed limits" />
            <Delta label="Fixtures replayed" value={String(comparison.fixtureCount)} sub="Synthetic and historical cases" />
          </div>

          <section className="card" aria-labelledby="fixtures">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line p-4">
              <h2 id="fixtures" className="title-3">Fixture breakdown</h2>
              <span className="num caption-5 text-fg-subtle">Baseline v{comparison.baselinePolicyVersion} against proposed</span>
            </div>
            <ul className="divide-y divide-line">
              {comparison.details?.map((item: any) => (
                <li key={item.fixtureId} className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <div className="num caption-4 text-fg-subtle">{item.fixtureId}</div>
                    <div className="body-5">{item.description}</div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <DecisionBadge outcome={item.baselineDecision.outcome} />
                    <ArrowRight size={14} className="text-fg-subtle" aria-label="becomes" />
                    <DecisionBadge outcome={item.proposedDecision.outcome} />
                    {item.changed && <Badge tone="warn" icon={Warning}>Shifted</Badge>}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </div>
  );
};

const Delta: React.FC<{ label: string; value: string; sub: string }> = ({ label, value, sub }) => (
  <div className="card p-4">
    <div className="caption-4 text-fg-subtle">{label}</div>
    <div className="heading-5 num mt-1">{value}</div>
    <div className="caption-5 mt-1 text-fg-muted">{sub}</div>
  </div>
);
