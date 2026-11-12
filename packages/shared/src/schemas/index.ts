import { z } from "zod";
import {
  ACTION_TYPES,
  DECISION_OUTCOMES,
  GHOST_MODES,
  REASON_CODES,
  USER_ROLES,
} from "../constants/index.js";

export const actionProposalSchema = z.object({
  actionType: z.enum([
    ACTION_TYPES.PURCHASE_CAPTURE,
    ACTION_TYPES.DISCOUNT_REQUEST,
    ACTION_TYPES.REFUND_REQUEST,
    ACTION_TYPES.PAYMENT_STATUS,
    ACTION_TYPES.TRANSFER,
  ]),
  customerId: z.string().optional(),
  orderId: z.string().optional(),
  captureId: z.string().optional(),
  amountMinor: z.number().int().nonnegative().optional(),
  currency: z.string().length(3).optional(),
  discountBasisPoints: z.number().int().min(0).max(10000).optional(),
  rationale: z.string().max(1000).optional(),
  missingFields: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(1).optional(),
});

export const actionPermissionsSchema = z.object({
  orderCreation: z.boolean(),
  orderCapture: z.boolean(),
  refunds: z.boolean(),
  discounts: z.boolean(),
  transfers: z.literal(false), // transfers strictly disabled in MVP
});

export const riskRuleSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  condition: z.string(),
  riskUnits: z.number().int().positive(),
  actionOnTrigger: z.enum(["BLOCK", "REVIEW", "REQUIRE_APPROVAL"]),
});

export const authorityPolicySchema = z.object({
  actionPermissions: actionPermissionsSchema,
  maxPaymentMinor: z.number().int().positive(),
  maxRefundMinor: z.number().int().positive(),
  maxDiscountBasisPoints: z.number().int().min(0).max(10000),
  dailyExposureMinor: z.number().int().positive(),
  maxCustomerExposureMinor: z.number().int().positive(),
  maxActionsPerMinute: z.number().int().positive(),
  riskBudgetUnits: z.number().int().positive(),
  riskRules: z.array(riskRuleSchema),
  changeReason: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const updateModeSchema = z.object({
  mode: z.enum([
    GHOST_MODES.OBSERVE,
    GHOST_MODES.ASSIST,
    GHOST_MODES.AUTOPILOT,
    GHOST_MODES.LOCKDOWN,
  ]),
  reason: z.string().optional(),
});

export const freezeGhostSchema = z.object({
  reason: z.string().min(1, "A reason must be provided when freezing Ghost."),
});

export const unfreezeGhostSchema = z.object({
  reason: z.string().min(1, "A reason must be provided when unfreezing Ghost."),
});

export const createAgentMessageSchema = z.object({
  message: z.string().min(1).max(2000),
  customerId: z.string().optional(),
  orderId: z.string().optional(),
});

/**
 * Deterministically sorts object keys deeply to produce identical JSON representations
 * for equivalent payloads regardless of key insertion order.
 */
export function canonicalizeJson(obj: unknown): string {
  if (obj === null || typeof obj !== "object") {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return "[" + obj.map((item) => canonicalizeJson(item)).join(",") + "]";
  }
  const keys = Object.keys(obj as Record<string, unknown>).sort();
  const entries = keys.map((key) => {
    const val = (obj as Record<string, unknown>)[key];
    return JSON.stringify(key) + ":" + canonicalizeJson(val);
  });
  return "{" + entries.join(",") + "}";
}
