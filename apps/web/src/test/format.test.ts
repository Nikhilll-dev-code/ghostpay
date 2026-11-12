import { describe, expect, it } from "vitest";
import {
  EXPIRY_WARNING_MS,
  formatBasisPoints,
  formatMoney,
  formatSignedMoney,
  getExpiry,
  isSimulatedProviderId,
  parseMoneyInput,
  parsePercentInput,
} from "../lib/format";

describe("money and percent", () => {
  it("formats minor units and never invents a value for unknowns", () => {
    expect(formatMoney(12345)).toBe("$123.45");
    expect(formatMoney(0)).toBe("$0.00");
    expect(formatMoney(null)).toBe("Unknown");
    expect(formatMoney(undefined)).toBe("Unknown");
    expect(formatBasisPoints(1500)).toBe("15.00%");
    expect(formatBasisPoints(null)).toBe("Unknown");
  });

  it("signs exposure deltas in both directions", () => {
    expect(formatSignedMoney(5000)).toBe("+$50.00");
    expect(formatSignedMoney(-5000)).toBe("\u2212$50.00");
    expect(formatSignedMoney(0)).toBe("$0.00");
  });

  it("parses only well formed amounts", () => {
    expect(parseMoneyInput("12.5")).toBe(1250);
    expect(parseMoneyInput("0")).toBe(0);
    expect(parseMoneyInput("-5")).toBeNull();
    expect(parseMoneyInput("abc")).toBeNull();
    expect(parseMoneyInput("1.234")).toBeNull();
    expect(parseMoneyInput("")).toBeNull();
    expect(parsePercentInput("22")).toBe(2200);
    expect(parsePercentInput("22.5")).toBe(2250);
    expect(parsePercentInput("x")).toBeNull();
  });
});

describe("getExpiry", () => {
  const now = new Date("2026-11-11T10:00:00Z").getTime();

  it("flags expired, soon and comfortable approvals", () => {
    expect(getExpiry(new Date(now - 1000), now)).toMatchObject({ expired: true, label: "Expired" });
    const soon = getExpiry(new Date(now + EXPIRY_WARNING_MS - 1000), now);
    expect(soon).toMatchObject({ expired: false, soon: true });
    const later = getExpiry(new Date(now + 2 * 60 * 60 * 1000 + 5 * 60 * 1000), now);
    expect(later).toMatchObject({ expired: false, soon: false, label: "2h 5m left" });
  });

  it("treats an unreadable expiry as expired so nothing looks approvable", () => {
    expect(getExpiry("not a date", now)).toMatchObject({ expired: true, label: "Expiry unknown" });
  });
});

describe("provider ids", () => {
  it("recognises simulated sandbox ids", () => {
    expect(isSimulatedProviderId("SANDBOX_ORDER_1")).toBe(true);
    expect(isSimulatedProviderId("5O190127TN364715T")).toBe(false);
    expect(isSimulatedProviderId(null)).toBe(false);
  });
});
