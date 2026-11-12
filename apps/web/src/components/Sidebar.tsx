import React, { useEffect } from "react";
import { X } from "./icons";
import { NAV_ITEMS } from "../lib/nav";
import type { NavView } from "../lib/nav";
import { appHash } from "../lib/route";
import { useSafety } from "../context/SafetyContext";

export type { NavView } from "../lib/nav";

interface SidebarProps {
  currentView: NavView;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

const NavList: React.FC<{ currentView: NavView; onNavigate?: () => void }> = ({ currentView, onNavigate }) => {
  const { pendingApprovals } = useSafety();
  return (
    <nav aria-label="Primary" className="space-y-1 p-3">
      <div className="caption-3 px-3 pb-2 pt-1 uppercase tracking-wider text-fg-subtle">Operations</div>
      {NAV_ITEMS.map((item) => {
        const IconComponent = item.icon;
        const isActive = currentView === item.id;
        const badge = item.id === "approvals" && pendingApprovals ? pendingApprovals : 0;
        return (
          <a
            key={item.id}
            href={appHash(item.id)}
            aria-current={isActive ? "page" : undefined}
            onClick={onNavigate}
            className="nav-link"
          >
            <span className="flex items-center gap-3">
              <IconComponent size={18} weight={isActive ? "fill" : "regular"} aria-hidden="true" />
              <span>{item.label}</span>
            </span>
            {badge > 0 && (
              <span className="badge badge-warn" aria-label={`${badge} pending`}>
                {badge}
              </span>
            )}
          </a>
        );
      })}
    </nav>
  );
};

const SidebarFooter: React.FC = () => (
  <div className="caption-5 space-y-1 border-t border-line p-4 text-fg-subtle">
    <div className="flex items-center justify-between gap-2">
      <span>Engine</span>
      <span className="num text-fg-muted">Deterministic v3.0</span>
    </div>
    <div className="flex items-center justify-between gap-2">
      <span>Provider</span>
      <span className="num text-warn">PayPal Sandbox</span>
    </div>
  </div>
);

export const Sidebar: React.FC<SidebarProps> = ({ currentView, mobileOpen, onCloseMobile }) => {
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseMobile();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen, onCloseMobile]);

  return (
    <>
      <aside className="hidden w-64 shrink-0 flex-col justify-between overflow-y-auto border-r border-line bg-surface lg:flex">
        <NavList currentView={currentView} />
        <SidebarFooter />
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="fade-enter absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onCloseMobile} aria-hidden="true" />
          <aside
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
            className="pop-enter absolute inset-y-0 left-0 flex w-72 max-w-[85%] flex-col justify-between overflow-y-auto border-r border-line bg-surface"
          >
            <div>
              <div className="flex items-center justify-between px-4 pt-4">
                <span className="title-3">Ghost 3.0</span>
                <button type="button" onClick={onCloseMobile} aria-label="Close navigation menu" className="btn btn-ghost p-2">
                  <X size={18} aria-hidden="true" />
                </button>
              </div>
              <NavList currentView={currentView} onNavigate={onCloseMobile} />
            </div>
            <SidebarFooter />
          </aside>
        </div>
      )}
    </>
  );
};
