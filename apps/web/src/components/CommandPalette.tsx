import React, { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Clock, Funnel, MagnifyingGlass } from "./icons";
import type { Icon } from "./icons";
import { NAV_ITEMS } from "../lib/nav";
import { appHash, navigateTo } from "../lib/route";

export interface PaletteItem {
  id: string;
  label: string;
  hint: string;
  icon: Icon;
  hash: string;
  group: "Screens" | "Shortcuts" | "Search";
}

export function buildPaletteItems(query: string): PaletteItem[] {
  const q = query.trim();
  const needle = q.toLowerCase();

  const screens: PaletteItem[] = NAV_ITEMS.map((item) => ({
    id: `screen-${item.id}`,
    label: item.label,
    hint: item.description,
    icon: item.icon,
    hash: appHash(item.id),
    group: "Screens",
  }));

  const shortcuts: PaletteItem[] = [
    {
      id: "shortcut-reconcile",
      label: "Transactions pending reconciliation",
      hint: "Opens the ledger filtered to unconfirmed provider results",
      icon: Clock,
      hash: appHash("transactions", { status: "PENDING_RECONCILIATION" }),
      group: "Shortcuts",
    },
    {
      id: "shortcut-pending-approvals",
      label: "Approvals waiting for a decision",
      hint: "Opens the approval queue filtered to pending items",
      icon: Funnel,
      hash: appHash("approvals", { status: "PENDING" }),
      group: "Shortcuts",
    },
  ];

  const matches = (item: PaletteItem) =>
    !needle || `${item.label} ${item.hint}`.toLowerCase().includes(needle);

  const results: PaletteItem[] = [...screens.filter(matches), ...shortcuts.filter(matches)];

  if (q.length >= 2) {
    results.push(
      {
        id: "search-transactions",
        label: `Search transactions for “${q}”`,
        hint: "Read only filter on the ledger",
        icon: MagnifyingGlass,
        hash: appHash("transactions", { q }),
        group: "Search",
      },
      {
        id: "search-audit",
        label: `Search the audit trail for “${q}”`,
        hint: "Read only filter on event type, entity or correlation ID",
        icon: MagnifyingGlass,
        hash: appHash("audit", { q }),
        group: "Search",
      }
    );
  }

  return results;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ open, onClose }) => {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const items = useMemo(() => buildPaletteItems(query), [query]);

  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    setQuery("");
    setActive(0);
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus());
    return () => {
      window.cancelAnimationFrame(frame);
      previouslyFocused.current?.focus?.();
    };
  }, [open]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  if (!open) return null;

  const choose = (item: PaletteItem | undefined) => {
    if (!item) return;
    onClose();
    navigateTo(item.hash);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((index) => (items.length === 0 ? 0 : (index + 1) % items.length));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index) => (items.length === 0 ? 0 : (index - 1 + items.length) % items.length));
    } else if (event.key === "Enter") {
      event.preventDefault();
      choose(items[active]);
    } else if (event.key === "Tab") {
      event.preventDefault();
    }
  };

  let lastGroup = "";

  return (
    <div
      className="fade-enter fixed inset-0 z-50 flex items-start justify-center bg-black/80 p-4 pt-16 backdrop-blur-sm sm:pt-24"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Quick navigation"
        onKeyDown={onKeyDown}
        className="pop-enter card w-full max-w-xl overflow-hidden"
      >
        <div className="flex items-center gap-3 border-b border-line px-4 py-3">
          <MagnifyingGlass size={18} className="shrink-0 text-fg-subtle" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-list"
            aria-activedescendant={items[active] ? `palette-${items[active].id}` : undefined}
            aria-label="Search screens and records"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Go to a screen, or type an ID to search"
            className="body-6 min-w-0 flex-1 bg-transparent text-fg placeholder:text-fg-subtle focus:outline-none"
          />
          <kbd className="caption-4 rounded-lg border border-line px-2 py-0.5 text-fg-subtle">Esc</kbd>
        </div>
        <ul id="palette-list" role="listbox" aria-label="Results" className="max-h-96 overflow-y-auto p-2">
          {items.length === 0 && (
            <li className="body-6 px-3 py-6 text-center text-fg-muted">
              No screens match. Type at least two characters to search records.
            </li>
          )}
          {items.map((item, index) => {
            const showGroup = item.group !== lastGroup;
            lastGroup = item.group;
            const IconComponent = item.icon;
            const selected = index === active;
            return (
              <React.Fragment key={item.id}>
                {showGroup && (
                  <li role="presentation" className="caption-3 px-3 pb-1 pt-3 uppercase tracking-wider text-fg-subtle">
                    {item.group}
                  </li>
                )}
                <li
                  id={`palette-${item.id}`}
                  role="option"
                  aria-selected={selected}
                  onMouseMove={() => setActive(index)}
                  onClick={() => choose(item)}
                  className={`motion-color flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 ${
                    selected ? "bg-hover text-fg" : "text-fg-muted"
                  }`}
                >
                  <IconComponent size={18} className="shrink-0" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <div className="body-5 truncate">{item.label}</div>
                    <div className="caption-5 truncate text-fg-subtle">{item.hint}</div>
                  </div>
                  {selected && <ArrowRight size={14} className="shrink-0" aria-hidden="true" />}
                </li>
              </React.Fragment>
            );
          })}
        </ul>
        <div className="caption-5 flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-2 text-fg-subtle">
          <span>Navigation only. Nothing here changes policy, approvals or payments.</span>
          <span>Up and down to move, Enter to open</span>
        </div>
      </div>
    </div>
  );
};
