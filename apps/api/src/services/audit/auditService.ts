import crypto from "node:crypto";
import { AuditEvent } from "@ghost/shared";
import { prisma } from "../../repositories/prisma.js";
import { redactSensitiveData, logger } from "../../utils/logger.js";

export interface LogAuditParams {
  actorType: "USER" | "SYSTEM" | "AI" | "PAYPAL_WEBHOOK";
  actorId?: string;
  eventType: string;
  entityType: string;
  entityId: string;
  correlationId?: string;
  payload: Record<string, unknown>;
}

export class AuditService {
  public static async recordEvent(params: LogAuditParams): Promise<AuditEvent> {
    const correlationId = params.correlationId || crypto.randomUUID();
    const redacted = redactSensitiveData(params.payload) as Record<string, unknown>;

    logger.info(`[AUDIT] ${params.eventType} on ${params.entityType}:${params.entityId}`, {
      actorType: params.actorType,
      correlationId,
    });

    const event = await prisma.auditEvent.create({
      data: {
        actorType: params.actorType,
        actorId: params.actorId,
        eventType: params.eventType,
        entityType: params.entityType,
        entityId: params.entityId,
        correlationId,
        payloadRedactedJson: JSON.stringify(redacted),
      },
    });

    return {
      id: event.id,
      actorType: event.actorType as any,
      actorId: event.actorId,
      eventType: event.eventType,
      entityType: event.entityType,
      entityId: event.entityId,
      correlationId: event.correlationId,
      payloadRedacted: redacted,
      createdAt: event.createdAt.toISOString(),
    };
  }

  public static async queryEvents(filter: {
    eventType?: string;
    entityType?: string;
    correlationId?: string;
    limit?: number;
  }): Promise<AuditEvent[]> {
    const { eventType, entityType, correlationId, limit = 50 } = filter;

    const events = await prisma.auditEvent.findMany({
      where: {
        eventType: eventType || undefined,
        entityType: entityType || undefined,
        correlationId: correlationId || undefined,
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return events.map((e) => ({
      id: e.id,
      actorType: e.actorType as any,
      actorId: e.actorId,
      eventType: e.eventType,
      entityType: e.entityType,
      entityId: e.entityId,
      correlationId: e.correlationId,
      payloadRedacted: JSON.parse(e.payloadRedactedJson),
      createdAt: e.createdAt.toISOString(),
    }));
  }
}
