import { describe, expect, it } from "vitest";
import { appHash, getQueryParam, parseRoute } from "../lib/route";

describe("parseRoute", () => {
  it("treats an empty hash as the landing page", () => {
    expect(parseRoute("")).toEqual({ name: "landing" });
    expect(parseRoute("#/")).toEqual({ name: "landing" });
  });

  it("maps landing sections", () => {
    expect(parseRoute("#/faq")).toEqual({ name: "landing", section: "faq" });
    expect(parseRoute("#/how-it-works")).toEqual({ name: "landing", section: "how-it-works" });
  });

  it("maps public pages", () => {
    expect(parseRoute("#/signin")).toEqual({ name: "signin" });
    expect(parseRoute("#/privacy")).toEqual({ name: "privacy" });
    expect(parseRoute("#/terms")).toEqual({ name: "terms" });
  });

  it("maps every app view and keeps the query", () => {
    expect(parseRoute("#/app")).toEqual({ name: "app", view: "overview", query: "" });
    expect(parseRoute("#/app/transactions?status=PENDING_RECONCILIATION")).toEqual({
      name: "app",
      view: "transactions",
      query: "status=PENDING_RECONCILIATION",
    });
  });

  it("returns notfound for unknown or malformed paths", () => {
    expect(parseRoute("#/nope")).toEqual({ name: "notfound" });
    expect(parseRoute("#/app/unknown")).toEqual({ name: "notfound" });
    expect(parseRoute("#/app/audit/extra")).toEqual({ name: "notfound" });
    expect(parseRoute("#/faq/extra")).toEqual({ name: "notfound" });
  });
});

describe("appHash", () => {
  it("builds hashes with encoded params and skips empty ones", () => {
    expect(appHash("audit")).toBe("#/app/audit");
    expect(appHash("audit", { q: "a b", empty: "" })).toBe("#/app/audit?q=a+b");
    expect(getQueryParam("q=abc&status=X", "status")).toBe("X");
    expect(getQueryParam("", "q")).toBe("");
  });
});
