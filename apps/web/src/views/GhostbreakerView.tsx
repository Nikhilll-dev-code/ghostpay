import React, { useState } from "react";
import { ArrowsClockwise, CheckCircle, Crosshair, Hash, Play, ShieldCheck, WarningOctagon, XCircle } from "../components/icons";
import { api } from "../api/client";
import { useSafety } from "../context/SafetyContext";
import { useToast } from "../components/Toast";
import { useFetch } from "../lib/hooks";
import { formatDateTime } from "../lib/format";
import { Badge, CardSkeleton, DecisionBadge, EmptyState, ErrorState, Notice, PageHeader } from "../components/ui";

interface CaseResult {
  caseId: string;
  name: string;
  category: string;
  threat: string;
  expectedOutcome: string;
  actualOutcome: string;
  pass: boolean;
  evidence: {
    expectedReason: string;
    actualReasonCodes: string[];
    checks: any[];
  };
  correlationId: string;
}

interface RunSummary {
  id: string;
  suiteVersion: string;
  startTime: string;
  endTime: string;
  status: "PASSED" | "FAILED";
  totalCases: number;
  passedCount: number;
  failedCount: number;
  results: CaseResult[];
}

function toSummary(run: any): RunSummary {
  const results: CaseResult[] = run.results ?? [];
  return {
    id: run.id,
    suiteVersion: run.suiteVersion,
    startTime: run.startTime,
    endTime: run.endTime,
    status: run.status,
    totalCases: results.length,
    passedCount: results.filter((r) => r.pass).length,
    failedCount: results.filter((r) => !r.pass).length,
    results,
  };
}

export const GhostbreakerView: React.FC = () => {
  const toast = useToast();
  const safety = useSafety();
  const { data, error, loading, reload } = useFetch(() => api.get<{ runs: any[] }>("/red-team/runs"), []);
  const [fresh, setFresh] = useState<RunSummary | null>(null);
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);

  const latest = fresh ?? (data && data.runs.length > 0 ? toSummary(data.runs[0]) : null);

  const run = async () => {
    setRunning(true);
    setRunError(null);
    try {
      const res = await api.post<{ run: any }>("/red-team/runs");
      setFresh(res.run.summary);
      toast.success("Ghostbreaker finished. Every result below comes from the live Trust Engine.");
      await Promise.all([reload(), safety.refresh()]);
    } catch (err: any) {
      setRunError(err.message || "The run could not be completed.");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ghostbreaker"
        description="Ten adversarial cases replayed against the live Trust Engine. Failures are shown in full and never hidden."
        actions={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => void reload()} disabled={loading}>
              <ArrowsClockwise size={16} aria-hidden="true" />
              Refresh
            </button>
            <button type="button" className="btn btn-primary" onClick={() => void run()} disabled={running}>
              <Play size={16} weight="fill" aria-hidden="true" />
              {running ? "Running attacks" : "Run Ghostbreaker"}
            </button>
          </>
        }
      />

      {runError && (
        <Notice tone="bad" icon={WarningOctagon} role="alert">
          {runError}
        </Notice>
      )}
      {loading && !data && !latest && <CardSkeleton lines={4} />}
      {error && !data && !latest && <ErrorState message={error} onRetry={() => void reload()} />}

      {!latest && !loading && !error && (
        <EmptyState
          icon={Crosshair}
          title="No run recorded yet"
          description="Run the suite to try ten attack cases, including prompt injection, replayed approvals and split transactions."
          action={
            <button type="button" className="btn btn-primary" onClick={() => void run()} disabled={running}>
              Run Ghostbreaker
            </button>
          }
        />
      )}

      {latest && (
        <>
          <section className="card flex flex-wrap items-center justify-between gap-4 p-6" aria-labelledby="run-summary">
            <div className="space-y-1">
              <h2 id="run-summary" className="title-2 flex items-center gap-2">
                {latest.failedCount === 0 ? (
                  <ShieldCheck size={20} className="text-ok" aria-hidden="true" />
                ) : (
                  <WarningOctagon size={20} className="text-bad" aria-hidden="true" />
                )}
                {latest.failedCount === 0 ? "All defenses held" : `${latest.failedCount} ${latest.failedCount === 1 ? "defense" : "defenses"} failed`}
              </h2>
              <p className="caption-5 text-fg-muted">
                Suite {latest.suiteVersion}. Finished {formatDateTime(latest.endTime)}. Run ID <span className="num">{latest.id.slice(0, 8)}</span>
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="heading-5 num">{latest.passedCount} of {latest.totalCases}</div>
                <div className="caption-5 text-fg-subtle">cases passed</div>
              </div>
              <Badge tone={latest.status === "PASSED" ? "ok" : "bad"} icon={latest.status === "PASSED" ? CheckCircle : XCircle}>
                {latest.status === "PASSED" ? "Passed" : "Failed"}
              </Badge>
            </div>
          </section>

          <ul className="space-y-3">
            {latest.results.map((c) => (
              <li key={c.caseId} className={`card space-y-3 p-4 ${c.pass ? "" : "border-bad"}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="num caption-3 text-fg-subtle">{c.caseId}</span>
                    <h3 className="title-3">{c.name}</h3>
                    <Badge tone="neutral">{c.category}</Badge>
                  </div>
                  <Badge tone={c.pass ? "ok" : "bad"} icon={c.pass ? CheckCircle : XCircle}>
                    {c.pass ? "Defense held" : "Breach"}
                  </Badge>
                </div>
                <p className="body-6 text-fg-muted">
                  <span className="text-fg-subtle">Threat. </span>
                  {c.threat}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="caption-4 text-fg-subtle">Expected</span>
                  <DecisionBadge outcome={c.expectedOutcome} />
                  <span className="caption-4 text-fg-subtle">Actual</span>
                  <DecisionBadge outcome={c.actualOutcome} />
                  <code className="num caption-5 text-fg-muted">
                    {c.evidence?.actualReasonCodes?.length ? c.evidence.actualReasonCodes.join(", ") : "No reason codes"}
                  </code>
                </div>
                <details>
                  <summary className="caption-3 cursor-pointer rounded-lg text-info">Evidence and checks</summary>
                  <div className="panel mt-2 space-y-2 p-3">
                    <p className="caption-5 text-fg-muted">
                      Expected reason <span className="num">{c.evidence?.expectedReason ?? "Unknown"}</span>
                    </p>
                    <p className="caption-5 inline-flex items-center gap-1 text-fg-subtle">
                      <Hash size={12} aria-hidden="true" /> Correlation <span className="num">{c.correlationId}</span>
                    </p>
                    <pre className="num caption-5 max-h-64 overflow-auto text-fg-muted">{JSON.stringify(c.evidence?.checks ?? [], null, 2)}</pre>
                  </div>
                </details>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
};
