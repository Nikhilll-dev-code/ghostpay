import React from "react";
import type { Icon } from "./icons";
import { ArrowsClockwise, CheckCircle, Clock, Info, Prohibit, ShieldWarning, Warning, WarningOctagon, XCircle } from "./icons";

export type Tone = "ok" | "warn" | "bad" | "info" | "violet" | "cyan" | "neutral";

export const toneBadge: Record<Tone, string> = {
  ok: "badge-ok",
  warn: "badge-warn",
  bad: "badge-bad",
  info: "badge-info",
  violet: "badge-violet",
  cyan: "badge-cyan",
  neutral: "badge-neutral",
};

export const toneText: Record<Tone, string> = {
  ok: "text-ok",
  warn: "text-warn",
  bad: "text-bad",
  info: "text-info",
  violet: "text-violet",
  cyan: "text-cyan",
  neutral: "text-fg-muted",
};

export const toneNotice: Record<Exclude<Tone, "violet" | "cyan" | "neutral">, string> = {
  ok: "notice-ok",
  warn: "notice-warn",
  bad: "notice-bad",
  info: "notice-info",
};

export const Badge: React.FC<{ tone?: Tone; icon?: Icon; children: React.ReactNode; title?: string }> = ({
  tone = "neutral",
  icon: IconComponent,
  children,
  title,
}) => (
  <span className={`badge ${toneBadge[tone]}`} title={title}>
    {IconComponent && <IconComponent size={12} weight="bold" aria-hidden="true" />}
    <span>{children}</span>
  </span>
);

interface StatusMeta {
  tone: Tone;
  icon: Icon;
  label: string;
}

const DECISION_META: Record<string, StatusMeta> = {
  ALLOW: { tone: "ok", icon: CheckCircle, label: "Allowed" },
  REQUIRE_APPROVAL: { tone: "warn", icon: Clock, label: "Approval required" },
  REVIEW: { tone: "warn", icon: Warning, label: "Review required" },
  BLOCK: { tone: "bad", icon: Prohibit, label: "Blocked" },
  FROZEN: { tone: "bad", icon: ShieldWarning, label: "Frozen" },
  OBSERVE_ONLY: { tone: "info", icon: Info, label: "Observe only" },
};

export function decisionMeta(outcome: string): StatusMeta {
  return DECISION_META[outcome] ?? { tone: "neutral", icon: Info, label: outcome };
}

export const DecisionBadge: React.FC<{ outcome: string }> = ({ outcome }) => {
  const meta = decisionMeta(outcome);
  return (
    <Badge tone={meta.tone} icon={meta.icon} title={outcome}>
      {meta.label}
    </Badge>
  );
};

const TX_META: Record<string, StatusMeta> = {
  COMPLETED: { tone: "ok", icon: CheckCircle, label: "Completed" },
  PENDING_RECONCILIATION: { tone: "warn", icon: ArrowsClockwise, label: "Pending reconciliation" },
  FAILED: { tone: "bad", icon: XCircle, label: "Failed" },
  SUBMITTED: { tone: "info", icon: Clock, label: "Submitted" },
  AUTHORIZED: { tone: "info", icon: CheckCircle, label: "Authorized" },
};

export function transactionMeta(status: string): StatusMeta {
  return TX_META[status] ?? { tone: "neutral", icon: Info, label: status.replace(/_/g, " ").toLowerCase() };
}

export const TransactionBadge: React.FC<{ status: string }> = ({ status }) => {
  const meta = transactionMeta(status);
  return (
    <Badge tone={meta.tone} icon={meta.icon} title={status}>
      {meta.label}
    </Badge>
  );
};

export const CheckBadge: React.FC<{ status: string }> = ({ status }) => {
  const tone: Tone = status === "PASS" ? "ok" : status === "FAIL" ? "bad" : status === "REVIEW" ? "warn" : "neutral";
  const IconComponent: Icon = status === "PASS" ? CheckCircle : status === "FAIL" ? XCircle : status === "REVIEW" ? Warning : Info;
  const label = status === "NOT_APPLICABLE" ? "N/A" : status;
  return (
    <Badge tone={tone} icon={IconComponent}>
      {label}
    </Badge>
  );
};

export const PageHeader: React.FC<{
  title: string;
  description?: string;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
}> = ({ title, description, badge, actions }) => (
  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
    <div className="min-w-0 space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="heading-5 gradient-heading">{title}</h1>
        {badge}
      </div>
      {description && <p className="body-6 max-w-2xl text-fg-muted">{description}</p>}
    </div>
    {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
  </div>
);

export const Skeleton: React.FC<{ className?: string }> = ({ className = "h-4 w-full" }) => (
  <div className={`skeleton ${className}`} aria-hidden="true" />
);

export const CardSkeleton: React.FC<{ lines?: number }> = ({ lines = 3 }) => (
  <div className="card space-y-3 p-6" role="status" aria-label="Loading">
    <Skeleton className="h-4 w-1/3" />
    <Skeleton className="h-8 w-1/2" />
    {Array.from({ length: lines }).map((_, i) => (
      <Skeleton key={i} className={`h-3 ${i % 2 === 0 ? "w-full" : "w-4/5"}`} />
    ))}
  </div>
);

export const ListSkeleton: React.FC<{ rows?: number }> = ({ rows = 5 }) => (
  <div className="card divide-y divide-line" role="status" aria-label="Loading">
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="space-y-2 p-4">
        <Skeleton className="h-4 w-1/4" />
        <Skeleton className="h-3 w-3/4" />
      </div>
    ))}
  </div>
);

export const EmptyState: React.FC<{
  icon: Icon;
  title: string;
  description: string;
  action?: React.ReactNode;
}> = ({ icon: IconComponent, title, description, action }) => (
  <div className="card flex flex-col items-center gap-3 px-6 py-12 text-center">
    <div className="rounded-xl border border-line bg-raised p-3 text-fg-muted">
      <IconComponent size={28} aria-hidden="true" />
    </div>
    <h2 className="title-3">{title}</h2>
    <p className="body-6 max-w-md text-fg-muted">{description}</p>
    {action}
  </div>
);

export const ErrorState: React.FC<{
  title?: string;
  message: string;
  onRetry?: () => void;
}> = ({ title = "This data could not be loaded", message, onRetry }) => (
  <div className="notice notice-bad flex-col gap-3 p-6 sm:flex-row sm:items-center" role="alert">
    <WarningOctagon size={24} className="shrink-0 text-bad" aria-hidden="true" />
    <div className="min-w-0 flex-1 space-y-1">
      <div className="body-4 text-fg">{title}</div>
      <p className="body-6 text-fg-muted">{message}. Nothing was changed. Check that the API is running, then try again.</p>
    </div>
    {onRetry && (
      <button type="button" className="btn btn-secondary" onClick={onRetry}>
        <ArrowsClockwise size={16} aria-hidden="true" />
        <span>Try again</span>
      </button>
    )}
  </div>
);

export const Notice: React.FC<{
  tone: "ok" | "warn" | "bad" | "info";
  icon?: Icon;
  children: React.ReactNode;
  role?: "alert" | "status";
}> = ({ tone, icon: IconComponent = Info, children, role }) => (
  <div className={`notice ${toneNotice[tone]}`} role={role}>
    <IconComponent size={18} className={`mt-0.5 shrink-0 ${toneText[tone]}`} aria-hidden="true" />
    <div className="min-w-0 flex-1 text-fg-muted">{children}</div>
  </div>
);

export const Field: React.FC<{
  id: string;
  label: string;
  error?: string | null;
  hint?: string;
  children: (props: { id: string; "aria-invalid": boolean; "aria-describedby"?: string }) => React.ReactNode;
}> = ({ id, label, error, hint, children }) => {
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div>
      <label htmlFor={id} className="label">
        {label}
      </label>
      {children({ id, "aria-invalid": !!error, "aria-describedby": describedBy })}
      {error ? (
        <p id={`${id}-error`} className="caption-5 mt-1 text-bad" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="caption-5 mt-1 text-fg-subtle">
          {hint}
        </p>
      ) : null}
    </div>
  );
};

export const LabeledValue: React.FC<{ label: string; children: React.ReactNode; mono?: boolean }> = ({
  label,
  children,
  mono,
}) => (
  <div className="min-w-0">
    <dt className="caption-4 text-fg-subtle">{label}</dt>
    <dd className={`body-5 mt-0.5 break-words text-fg ${mono ? "num" : ""}`}>{children}</dd>
  </div>
);

export const SimulatedTag: React.FC<{ label?: string }> = ({ label = "Simulated" }) => (
  <Badge tone="violet" icon={Info} title="Generated by the built in Sandbox simulation, not by a live PayPal call">
    {label}
  </Badge>
);
