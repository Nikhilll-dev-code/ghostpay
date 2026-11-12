import React, { useMemo, useState } from "react";
import { ArrowsClockwise, Scroll } from "../components/icons";
import { api } from "../api/client";
import { useFetch } from "../lib/hooks";
import { formatDateTime } from "../lib/format";
import type { AuditEvent } from "../lib/types";
import { Badge, EmptyState, ErrorState, ListSkeleton, PageHeader } from "../components/ui";
import type { Tone } from "../components/ui";

function eventTone(eventType: string): Tone {
  if (/BLOCK|FROZEN|FAIL|REJECT|KILL|EXPIRED|MISMATCH/.test(eventType)) return "bad";
  if (/PENDING|RECONCIL|REVIEW|REQUIRED/.test(eventType)) return "warn";
  if (/ALLOW|COMPLETED|APPROVED|VERIFIED|SUCCESS/.test(eventType)) return "ok";
  return "info";
}

export const AuditView: React.FC<{ initialQuery?: string }> = ({ initialQuery = "" }) => {
  const { data, error, loading, reload } = useFetch(() => api.get<{ events: AuditEvent[] }>("/audit/events"), []);
  const [search, setSearch] = useState(initialQuery);
  const [entityType, setEntityType] = useState("");

  const events = data?.events ?? [];
  const entityTypes = useMemo(() => Array.from(new Set(events.map((e) => e.entityType))).sort(), [events]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return events.filter((e) => {
      if (entityType && e.entityType !== entityType) return false;
      if (!term) return true;
      return (
        e.eventType.toLowerCase().includes(term) ||
        e.correlationId.toLowerCase().includes(term) ||
        e.entityId.toLowerCase().includes(term) ||
        e.entityType.toLowerCase().includes(term)
      );
    });
  }, [events, search, entityType]);

  const exportBundle = () => {
    const bundle = {
      exportTimestamp: new Date().toISOString(),
      environment: "PAYPAL_SANDBOX",
      totalEvents: events.length,
      filteredEvents: filtered.length,
      events: filtered,
    };
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ghost-audit-evidence-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Trail"
        description="Append only record of decisions, approvals, executions and configuration changes. Sensitive fields are redacted before storage."
        actions={
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-secondary" onClick={() => void reload()}>
              <ArrowsClockwise size={16} aria-hidden="true" />
              Refresh
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={exportBundle}
              disabled={filtered.length === 0}
            >
              <Scroll size={16} aria-hidden="true" />
              Export evidence bundle
            </button>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-[1fr_220px]">
        <div>
          <label htmlFor="audit-search" className="sr-only">
            Search audit events
          </label>
          <input
            id="audit-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by event type, entity, entity ID or correlation ID"
            className="field"
          />
        </div>
        <div>
          <label htmlFor="audit-entity" className="sr-only">
            Filter by entity type
          </label>
          <select id="audit-entity" value={entityType} onChange={(event) => setEntityType(event.target.value)} className="field">
            <option value="">All entity types</option>
            {entityTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading && !data && <ListSkeleton rows={6} />}
      {error && !data && <ErrorState message={error} onRetry={() => void reload()} />}

      {data && events.length === 0 && (
        <EmptyState icon={Scroll} title="No audit events yet" description="Events are written when decisions, approvals, executions or settings changes happen." />
      )}
      {data && events.length > 0 && filtered.length === 0 && (
        <EmptyState
          icon={Scroll}
          title="No events match these filters"
          description="Clear the search or choose another entity type."
          action={
            <button type="button" className="btn btn-secondary" onClick={() => { setSearch(""); setEntityType(""); }}>
              Clear filters
            </button>
          }
        />
      )}

      {filtered.length > 0 && (
        <>
          <p className="caption-5 text-fg-subtle" aria-live="polite">
            Showing {filtered.length} of {events.length} events
          </p>
          <ul className="space-y-3">
            {filtered.map((event) => (
              <li key={event.id} className="card space-y-3 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={eventTone(event.eventType)}>{event.eventType}</Badge>
                    <span className="caption-5 text-fg-muted">
                      {event.entityType} <span className="num text-fg-subtle">{event.entityId}</span>
                    </span>
                  </div>
                  <span className="caption-5 text-fg-subtle">{formatDateTime(event.createdAt)}</span>
                </div>
                <div className="caption-5 flex flex-wrap gap-x-4 gap-y-1 text-fg-subtle">
                  <span>Actor {event.actorType}{event.actorId ? ` ${event.actorId}` : ""}</span>
                  <span className="num">Correlation {event.correlationId}</span>
                </div>
                <details>
                  <summary className="caption-3 cursor-pointer rounded-lg text-info">Redacted payload</summary>
                  <pre className="num caption-5 panel mt-2 max-h-64 overflow-auto p-3 text-fg-muted">
                    {JSON.stringify(event.payloadRedacted, null, 2)}
                  </pre>
                </details>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
};
