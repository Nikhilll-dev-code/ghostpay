import React from "react";
import { ArrowsClockwise, CheckCircle, Users, Warning } from "../components/icons";
import { api } from "../api/client";
import { useFetch } from "../lib/hooks";
import { Badge, CardSkeleton, EmptyState, ErrorState, PageHeader } from "../components/ui";
import type { Tone } from "../components/ui";

interface Customer {
  id: string;
  displayName: string;
  email?: string;
  externalReference?: string;
  createdAt: string;
  facts: Array<{
    id: string;
    factType: string;
    sourceType: "VERIFIED_PROVIDER" | "INTERNAL_RECORD" | "CUSTOMER_CLAIM";
    verified: boolean;
    value: any;
  }>;
}

const SOURCE: Record<string, { tone: Tone; label: string }> = {
  VERIFIED_PROVIDER: { tone: "ok", label: "Verified provider" },
  INTERNAL_RECORD: { tone: "info", label: "Internal record" },
  CUSTOMER_CLAIM: { tone: "warn", label: "Customer claim" },
};

export const CustomersView: React.FC = () => {
  const { data, error, loading, reload } = useFetch(() => api.get<{ customers: Customer[] }>("/customers"), []);
  const customers = data?.customers ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customer Memory"
        description="Verified provider facts are kept apart from facts a customer only claims. Synthetic demo customers."
        badge={<Badge tone="violet">Synthetic data</Badge>}
        actions={
          <button type="button" className="btn btn-secondary" onClick={() => void reload()}>
            <ArrowsClockwise size={16} aria-hidden="true" />
            Refresh
          </button>
        }
      />

      {loading && !data && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      )}
      {error && !data && <ErrorState message={error} onRetry={() => void reload()} />}
      {data && customers.length === 0 && (
        <EmptyState icon={Users} title="No customers yet" description="Seed the demo data with the db seed script to load synthetic customers and their facts." />
      )}

      <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {customers.map((customer) => (
          <li key={customer.id} className="card space-y-4 p-6">
            <div className="flex items-center justify-between gap-2">
              <span className="num caption-5 text-fg-subtle">{customer.externalReference || customer.id.slice(0, 8)}</span>
              <Badge tone="neutral">{customer.facts.length} facts</Badge>
            </div>
            <div>
              <h2 className="title-2">{customer.displayName}</h2>
              <p className="caption-5 text-fg-muted">{customer.email || "No email on file"}</p>
            </div>
            <div className="space-y-2 border-t border-line pt-4">
              <h3 className="caption-3 uppercase tracking-wider text-fg-subtle">Facts and provenance</h3>
              {customer.facts.length === 0 && <p className="body-6 text-fg-muted">No facts recorded.</p>}
              {customer.facts.map((fact) => {
                const source = SOURCE[fact.sourceType] ?? { tone: "neutral" as Tone, label: fact.sourceType };
                return (
                  <div key={fact.id} className="panel space-y-2 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="num caption-3">{fact.factType}</span>
                      <Badge tone={source.tone}>{source.label}</Badge>
                    </div>
                    <pre className="num caption-5 overflow-x-auto rounded-lg bg-canvas p-2 text-fg-muted">{JSON.stringify(fact.value, null, 2)}</pre>
                    {fact.verified ? (
                      <Badge tone="ok" icon={CheckCircle}>Verified with provider</Badge>
                    ) : (
                      <Badge tone="warn" icon={Warning}>Unverified claim</Badge>
                    )}
                  </div>
                );
              })}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};
