import React, { useEffect, useState } from "react";
import { ArrowsClockwise, CheckCircle, HardDrives, Key, Lightning, Lock, WarningOctagon } from "../components/icons";
import { Badge, LabeledValue, Notice, PageHeader } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import { useToast } from "../components/Toast";

type Health = { status: string; error?: string; [key: string]: unknown } | null;

interface PayPalStatus {
  configured: boolean;
  status: "CONNECTED" | "SIMULATED" | "ERROR";
  environment: string;
  clientIdMasked: string;
  latencyMs: number;
  message: string;
}

export const SettingsView: React.FC = () => {
  const { user, settings } = useAuth();
  const toast = useToast();
  const [health, setHealth] = useState<Health>(null);
  const [checking, setChecking] = useState(false);
  const [paypal, setPaypal] = useState<PayPalStatus | null>(null);
  const [testingPaypal, setTestingPaypal] = useState(false);
  const [simulatingWebhook, setSimulatingWebhook] = useState(false);

  const checkHealth = async () => {
    setChecking(true);
    try {
      const res = await fetch("/health/ready");
      const data = await res.json();
      setHealth(res.ok ? data : { ...data, status: data?.status ?? "degraded" });
    } catch (err: any) {
      setHealth({ status: "unavailable", error: err.message });
    } finally {
      setChecking(false);
    }
  };

  const loadPayPalStatus = async () => {
    try {
      const res = await api.get<{ paypal: PayPalStatus }>("/settings/paypal/status");
      setPaypal(res.paypal);
    } catch {
      // Ignore background status failure
    }
  };

  const testPayPal = async () => {
    setTestingPaypal(true);
    try {
      const res = await api.post<{ paypal: PayPalStatus }>("/settings/paypal/test");
      setPaypal(res.paypal);
      if (res.paypal.status === "CONNECTED") {
        toast.success(`PayPal Sandbox verified in ${res.paypal.latencyMs}ms`);
      } else {
        toast.info("Active in built in deterministic simulation mode");
      }
    } catch (err: any) {
      toast.error(`PayPal check failed: ${err.message}`);
    } finally {
      setTestingPaypal(false);
    }
  };

  const simulateWebhook = async (eventType: string) => {
    setSimulatingWebhook(true);
    try {
      const res = await api.post<{ message: string }>("/webhooks/simulate", { eventType });
      toast.success(res.message || "Webhook event processed");
    } catch (err: any) {
      toast.error(`Webhook simulation failed: ${err.message}`);
    } finally {
      setSimulatingWebhook(false);
    }
  };

  useEffect(() => {
    void checkHealth();
    void loadPayPalStatus();
  }, []);

  const ready = health?.status === "ready";
  const tone = health === null ? "neutral" : ready ? "ok" : "bad";
  const label = health === null ? "Checking" : ready ? "Ready and online" : health.status === "unavailable" ? "Unavailable" : "Degraded";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Backend status, the signed in account and the PayPal Sandbox credentials guide."
        actions={
          <button type="button" className="btn btn-secondary" onClick={() => { void checkHealth(); void loadPayPalStatus(); }} disabled={checking}>
            <ArrowsClockwise size={16} aria-hidden="true" />
            {checking ? "Checking" : "Check again"}
          </button>
        }
      />

      {health && !ready && (
        <Notice tone="bad" icon={WarningOctagon} role="alert">
          The backend did not report ready{health.error ? `: ${health.error}` : ""}. Decisions and executions depend on it, so treat
          every screen as possibly out of date.
        </Notice>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card space-y-4 p-6" aria-labelledby="backend">
          <h2 id="backend" className="title-2 flex items-center gap-2">
            <HardDrives size={18} aria-hidden="true" /> Backend status
          </h2>
          <dl className="grid grid-cols-2 gap-4">
            <LabeledValue label="Readiness">
              <Badge tone={tone} icon={ready ? CheckCircle : WarningOctagon}>{label}</Badge>
            </LabeledValue>
            <LabeledValue label="Enforcement">Server side policy gate</LabeledValue>
            <LabeledValue label="Signed in as">{user?.email}</LabeledValue>
            <LabeledValue label="Role">{user?.role}</LabeledValue>
            <LabeledValue label="Operating mode">{settings?.mode ?? "Unknown"}</LabeledValue>
            <LabeledValue label="Settings version" mono>{settings?.version ?? "Unknown"}</LabeledValue>
          </dl>
        </section>

        <section className="card space-y-4 p-6" aria-labelledby="paypal-status">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="paypal-status" className="title-2 flex items-center gap-2">
              <Key size={18} className="text-warn" aria-hidden="true" /> PayPal Sandbox status
            </h2>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => void testPayPal()}
              disabled={testingPaypal}
            >
              <Lightning size={14} aria-hidden="true" />
              {testingPaypal ? "Testing" : "Test connectivity"}
            </button>
          </div>

          {paypal && (
            <dl className="grid grid-cols-2 gap-4">
              <LabeledValue label="Environment">
                <Badge tone={paypal.status === "CONNECTED" ? "ok" : "violet"}>
                  {paypal.status === "CONNECTED" ? "Live Sandbox" : "Deterministic Simulator"}
                </Badge>
              </LabeledValue>
              <LabeledValue label="Latency" mono>{paypal.latencyMs}ms</LabeledValue>
              <LabeledValue label="Client ID" mono>{paypal.clientIdMasked}</LabeledValue>
              <LabeledValue label="OAuth endpoint" mono>api.sandbox.paypal.com</LabeledValue>
            </dl>
          )}

          {paypal && (
            <p className="caption-5 text-fg-muted">{paypal.message}</p>
          )}

          <div className="panel space-y-3 p-4">
            <div className="caption-3 uppercase tracking-wider text-fg-subtle">Simulate PayPal Webhook event</div>
            <p className="caption-5 text-fg-muted">
              Trigger an asynchronous webhook event to test provider reconciliation and the audit log.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn btn-secondary"
                disabled={simulatingWebhook}
                onClick={() => void simulateWebhook("PAYMENT.CAPTURE.COMPLETED")}
              >
                Simulate Capture Completed
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={simulatingWebhook}
                onClick={() => void simulateWebhook("PAYMENT.CAPTURE.REFUNDED")}
              >
                Simulate Capture Refunded
              </button>
            </div>
          </div>
        </section>

        <section className="card space-y-4 p-6 lg:col-span-2" aria-labelledby="paypal">
          <h2 id="paypal" className="title-2 flex items-center gap-2">
            <Key size={18} className="text-warn" aria-hidden="true" /> PayPal Sandbox credentials guide
          </h2>
          <p className="body-6 text-fg-muted">
            To connect a PayPal Developer Sandbox account, set these variables in the server environment file at the repository
            root, then restart the API. The browser never sees them.
          </p>
          <pre className="num caption-5 panel overflow-x-auto p-3 text-fg-muted">{`PAYPAL_ENV=sandbox
PAYPAL_CLIENT_ID=your_sandbox_client_id
PAYPAL_CLIENT_SECRET=your_sandbox_client_secret
PAYPAL_WEBHOOK_ID=your_sandbox_webhook_id`}</pre>
          <Notice tone="info" icon={Lock}>
            <strong className="text-fg">Security guardrail.</strong> Payment credentials never reach the browser or the logs. Without
            Sandbox credentials, Ghost runs a built in simulation, and records it creates are marked as simulated.
          </Notice>
        </section>
      </div>
    </div>
  );
};
