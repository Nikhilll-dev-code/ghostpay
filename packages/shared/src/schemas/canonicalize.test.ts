import { describe, it, expect } from "vitest";
import { canonicalizeJson, actionProposalSchema } from "./index.js";
import { ACTION_TYPES } from "../constants/index.js";

describe("canonicalizeJson", () => {
  it("should output identical JSON strings regardless of key order", () => {
    const objA = { z: 1, a: "foo", m: { b: 2, a: 1 } };
    const objB = { a: "foo", m: { a: 1, b: 2 }, z: 1 };

    expect(canonicalizeJson(objA)).toBe(canonicalizeJson(objB));
    expect(canonicalizeJson(objA)).toBe('{"a":"foo","m":{"a":1,"b":2},"z":1}');
  });
});

describe("actionProposalSchema", () => {
  it("should validate a valid purchase proposal", () => {
    const proposal = {
      actionType: ACTION_TYPES.PURCHASE_CAPTURE,
      amountMinor: 5000,
      currency: "USD",
      discountBasisPoints: 500,
      missingFields: [],
    };
    const res = actionProposalSchema.safeParse(proposal);
    expect(res.success).toBe(true);
  });

  it("should reject negative amount", () => {
    const proposal = {
      actionType: ACTION_TYPES.PURCHASE_CAPTURE,
      amountMinor: -100,
      missingFields: [],
    };
    const res = actionProposalSchema.safeParse(proposal);
    expect(res.success).toBe(false);
  });
});
