import React, { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Dialog } from "../components/Dialog";
import { ToastProvider, useToast } from "../components/Toast";
import { CommandPalette, buildPaletteItems } from "../components/CommandPalette";
import { DecisionBadge, TransactionBadge } from "../components/ui";
import { LandingPage, FAQ_ITEMS } from "../views/public/LandingPage";
import { NAV_ITEMS } from "../lib/nav";

const DialogHarness = () => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Open dialog</button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Confirm" footer={<button>Last action</button>}>
        <input aria-label="First field" />
      </Dialog>
    </>
  );
};

describe("Dialog", () => {
  it("moves focus in, traps Tab, closes on Escape and restores focus", async () => {
    const user = userEvent.setup();
    render(<DialogHarness />);
    const trigger = screen.getByRole("button", { name: "Open dialog" });
    await user.click(trigger);

    const dialog = await screen.findByRole("dialog", { name: "Confirm" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    await vi.waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));

    for (let i = 0; i < 6; i++) {
      await user.tab();
      expect(dialog.contains(document.activeElement)).toBe(true);
    }

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(trigger).toHaveFocus();
  });

  it("does not close on Escape while a request is in flight", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Dialog open onClose={onClose} title="Busy" closeDisabled>
        <p>Working</p>
      </Dialog>
    );
    await user.keyboard("{Escape}");
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe("Toast", () => {
  const Trigger = () => {
    const toast = useToast();
    return <button onClick={() => toast.error("Server said no")}>Fire</button>;
  };

  it("announces errors with the alert role", async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>
    );
    await user.click(screen.getByText("Fire"));
    expect(await screen.findByRole("alert")).toHaveTextContent("Server said no");
  });
});

describe("Command palette", () => {
  it("lists every navigation screen and never offers a privileged action", () => {
    const items = buildPaletteItems("");
    NAV_ITEMS.forEach((nav) => expect(items.some((item) => item.label === nav.label)).toBe(true));
    items.forEach((item) => expect(item.hash.startsWith("#/app/")).toBe(true));
  });

  it("offers record searches only after two characters", () => {
    expect(buildPaletteItems("a").some((i) => i.group === "Search")).toBe(false);
    const items = buildPaletteItems("tx_123");
    expect(items.filter((i) => i.group === "Search").map((i) => i.hash)).toEqual([
      "#/app/transactions?q=tx_123",
      "#/app/audit?q=tx_123",
    ]);
  });

  it("filters screens by text and supports keyboard selection", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    window.location.hash = "#/app/overview";
    render(<CommandPalette open onClose={onClose} />);
    const input = screen.getByRole("combobox");
    await user.type(input, "audit");
    const options = screen.getAllByRole("option");
    expect(options[0]).toHaveTextContent("Audit Trail");
    await user.keyboard("{Enter}");
    expect(onClose).toHaveBeenCalled();
    expect(window.location.hash).toBe("#/app/audit");
  });

  it("closes on Escape", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<CommandPalette open onClose={onClose} />);
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });
});

describe("status badges", () => {
  it("always pair colour with a text label", () => {
    const { container } = render(
      <>
        <DecisionBadge outcome="BLOCK" />
        <DecisionBadge outcome="REQUIRE_APPROVAL" />
        <TransactionBadge status="PENDING_RECONCILIATION" />
      </>
    );
    expect(within(container).getByText("Blocked")).toBeInTheDocument();
    expect(within(container).getByText("Approval required")).toBeInTheDocument();
    expect(within(container).getByText("Pending reconciliation")).toBeInTheDocument();
  });
});

describe("Landing page", () => {
  it("renders one h1, a single primary call to action target and a full FAQ", () => {
    const { container } = render(<LandingPage />);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    const ctas = screen.getAllByRole("link", { name: /open the control room/i });
    ctas.forEach((cta) => expect(cta).toHaveAttribute("href", "#/signin"));
    expect(container.querySelectorAll("details")).toHaveLength(FAQ_ITEMS.length);
    expect(document.head.querySelector('script[type="application/ld+json"]')).not.toBeNull();
  });

  it("states that it is sandbox only and makes no testimonial claims", () => {
    render(<LandingPage />);
    expect(screen.getAllByText(/sandbox only/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/trusted by/i)).toBeNull();
  });

  it("has no dead in page links", () => {
    const { container } = render(<LandingPage />);
    container.querySelectorAll("a").forEach((a) => {
      const href = a.getAttribute("href") ?? "";
      expect(href.startsWith("#/") || href === "#main").toBe(true);
    });
  });
});
