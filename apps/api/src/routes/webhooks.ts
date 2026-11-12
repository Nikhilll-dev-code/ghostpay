import { Router, Request, Response } from "express";
import { prisma } from "../repositories/prisma.js";
import { PayPalService } from "../services/paypal/paypalService.js";
import { AuditService } from "../services/audit/auditService.js";
import { logger } from "../utils/logger.js";

const router = Router();

router.post("/paypal", async (req: Request, res: Response) => {
  const headers = req.headers as Record<string, string>;
  const rawBody = JSON.stringify(req.body);

  logger.info("Received PayPal webhook event", { eventType: req.body?.event_type });

  const isVerified = await PayPalService.verifyWebhookSignature(headers, rawBody);
  if (!isVerified) {
    logger.warn("PayPal webhook signature verification failed");
    await AuditService.recordEvent({
      actorType: "PAYPAL_WEBHOOK",
      eventType: "WEBHOOK_VERIFICATION_FAILED",
      entityType: "WEBHOOK",
      entityId: req.body?.id || "unknown",
      correlationId: req.correlationId,
      payload: { reason: "INVALID_SIGNATURE" },
    });

    res.status(400).json({ error: { code: "PAYPAL_WEBHOOK_UNVERIFIED", message: "Signature verification failed" } });
    return;
  }

  const eventId = req.body?.id;
  const eventType = req.body?.event_type;
  const resource = req.body?.resource;

  // Deduplicate webhook event by checking audit records
  const existingEvent = await prisma.auditEvent.findFirst({
    where: { entityId: eventId, eventType: "WEBHOOK_EVENT_PROCESSED" },
  });

  if (existingEvent) {
    logger.info("Duplicate webhook event ignored", { eventId });
    res.status(200).json({ received: true, note: "DUPLICATE_EVENT_ALREADY_PROCESSED" });
    return;
  }

  // Handle specific webhook event types
  if (eventType === "PAYMENT.CAPTURE.COMPLETED" && resource?.id) {
    await prisma.financialOperation.updateMany({
      where: { paypalCaptureId: resource.id },
      data: {
        status: "COMPLETED",
        providerStatus: "COMPLETED",
        lastProviderCheckAt: new Date(),
      },
    });
  } else if (eventType === "PAYMENT.CAPTURE.REFUNDED" && resource?.id) {
    await prisma.financialOperation.updateMany({
      where: { paypalCaptureId: resource.id },
      data: {
        status: "COMPLETED",
        providerStatus: "REFUNDED",
        lastProviderCheckAt: new Date(),
      },
    });
  }

  await AuditService.recordEvent({
    actorType: "PAYPAL_WEBHOOK",
    eventType: "WEBHOOK_EVENT_PROCESSED",
    entityType: "WEBHOOK",
    entityId: eventId,
    correlationId: req.correlationId,
    payload: { eventType, resourceId: resource?.id },
  });

  res.status(200).json({ received: true });
});

router.post("/simulate", async (req: Request, res: Response) => {
  const { eventType = "PAYMENT.CAPTURE.COMPLETED", captureId } = req.body;
  const eventId = `WH-SIM-${Date.now()}`;

  let targetCaptureId = captureId;
  if (!targetCaptureId) {
    const recent = await prisma.financialOperation.findFirst({
      where: { paypalCaptureId: { not: null } },
      orderBy: { createdAt: "desc" },
    });
    targetCaptureId = recent?.paypalCaptureId || "SANDBOX_CAP_DEMO1";
  }

  if (eventType === "PAYMENT.CAPTURE.COMPLETED") {
    await prisma.financialOperation.updateMany({
      where: { paypalCaptureId: targetCaptureId },
      data: {
        status: "COMPLETED",
        providerStatus: "COMPLETED",
        lastProviderCheckAt: new Date(),
      },
    });
  } else if (eventType === "PAYMENT.CAPTURE.REFUNDED") {
    await prisma.financialOperation.updateMany({
      where: { paypalCaptureId: targetCaptureId },
      data: {
        status: "COMPLETED",
        providerStatus: "REFUNDED",
        lastProviderCheckAt: new Date(),
      },
    });
  }

  await AuditService.recordEvent({
    actorType: "PAYPAL_WEBHOOK",
    eventType: "WEBHOOK_EVENT_PROCESSED",
    entityType: "WEBHOOK",
    entityId: eventId,
    correlationId: req.correlationId,
    payload: {
      eventType,
      resourceId: targetCaptureId,
      simulated: true,
      description: `Simulated PayPal Webhook delivery: ${eventType}`,
    },
  });

  res.json({
    success: true,
    eventId,
    eventType,
    captureId: targetCaptureId,
    message: `Dispatched PayPal Webhook event '${eventType}' for capture '${targetCaptureId}'.`,
  });
});

export default router;
