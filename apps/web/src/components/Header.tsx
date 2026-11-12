import React, { useState } from "react";
import {
  Command,
  Eye,
  Ghost,
  Lightning,
  List,
  LockKey,
  MagnifyingGlass,
  Power,
  ShieldCheck,
  ShieldWarning,
  SignOut,
  Sparkle,
  UserCheck,
  Warning,
  ArrowsClockwise,
  Clock,
} from "./icons";
import type { Icon } from "./icons";
import { useAuth } from "../context/AuthContext";
import type { GhostSettings } from "../context/AuthContext";
import { useSafety } from "../context/SafetyContext";
import { FreezeModal } from "./FreezeModal";
import { JudgeTourModal } from "./JudgeTourModal";
import { useToast } from "./Toast";
import { appHash } from "../lib/route";
import { Badge } from "./ui";
import type { Tone } from "./ui";

interface HeaderProps {
  onOpenMenu: () => void;
  onOpenPalette: () => void;
}

const MODES: Array<{ id: GhostSettings["mode"]; label: string; icon: Icon; tone: string }> = [
  { id: "OBSERVE", label: "Observe", icon: Eye, tone: "text-info" },
  { id: "ASSIST", label: "Assist", icon: UserCheck, tone: "text-warn" },
  { id: "AUTOPILOT", label: "Autopilot", icon: Lightning, tone: "text-ok" },
  { id: "LOCKDOWN", label: "Lockdown", icon: Warning, tone: "text-bad" },
];

export const Header: React.FC<HeaderProps> = ({ onOpenMenu, onOpenPalette }) => {
  const { user, settings, updateMode, logout } = useAuth();
  const safety = useSafety();
  const toast = useToast();
  const [freezeOpen, setFreezeOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const [modeBusy, setModeBusy] = useState(false);

  const isFrozen = !!settings?.killSwitchEnabled;
  const currentMode = settings?.mode;
  const isOwner = user?.role === "OWNER";

  const handleMode = async (mode: GhostSettings["mode"]) => {
    if (mode === currentMode || modeBusy) return;
    setModeBusy(true);
    try {
      await updateMode(mode);
      toast.success(`Mode changed to ${mode.toLowerCase()}. The change is recorded in the audit trail.`);
    } catch (err: any) {
      toast.error(err.message || "The mode could not be changed. Nothing was updated.");
    } finally {
      setModeBusy(false);
    }
  };

  const pending = safety.pendingApprovals;
  const reconcile = safety.reconciliationItems ? safety.reconciliationItems.length : null;

  const pendingTone: Tone = pending === null ? "neutral" : pending > 0 ? "warn" : "ok";
  const reconcileTone: Tone = reconcile === null ? "neutral" : reconcile > 0 ? "warn" : "ok";

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-line bg-surface">
        <div className="flex h-16 items-center justify-between gap-3 px-4 lg:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={onOpenMenu}
              aria-label="Open navigation menu"
              className="btn btn-ghost p-2 lg:hidden"
            >
              <List size={20} aria-hidden="true" />
            </button>
            <a
              href={appHash("overview")}
              className="flex min-w-0 items-center gap-3 rounded-lg"
              aria-label="Ghost 3.0 overview"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-line bg-raised text-fg">
                <Ghost size={22} weight="fill" aria-hidden="true" />
              </span>
              <span className="hidden min-w-0 sm:block">
                <span className="title-3 block leading-tight">Ghost 3.0</span>
                <span className="caption-5 block truncate text-fg-subtle">Policy governed financial operations</span>
              </span>
            </a>
            <span className="hidden md:inline-flex">
              <Badge tone="warn" icon={LockKey} title="Ghost never moves real money. All execution targets PayPal Sandbox.">
                PayPal Sandbox
              </Badge>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setTourOpen(true)}
              className="btn btn-secondary"
              title="Open the Judge Fast Track walkthrough guide"
            >
              <Sparkle size={16} className="text-violet" aria-hidden="true" />
              <span className="hidden sm:inline">Judge Guide</span>
            </button>

            <button
              type="button"
              onClick={onOpenPalette}
              className="btn btn-secondary"
              aria-label="Open quick navigation"
              aria-keyshortcuts="Control+K Meta+K"
            >
              <MagnifyingGlass size={16} aria-hidden="true" />
              <span className="hidden md:inline">Search</span>
              <kbd className="caption-4 hidden items-center gap-0.5 rounded-lg border border-line px-1 text-fg-subtle md:inline-flex">
                <Command size={10} aria-hidden="true" />K
              </kbd>
            </button>

            <button
              type="button"
              onClick={() => setFreezeOpen(true)}
              className={`btn ${isFrozen ? "btn-danger-solid" : "btn-danger"}`}
              aria-label={isFrozen ? "Ghost is frozen. Open the unfreeze dialog" : "Freeze Ghost. Open the kill switch dialog"}
            >
              {isFrozen ? <ShieldWarning size={16} weight="fill" aria-hidden="true" /> : <Power size={16} aria-hidden="true" />}
              <span>{isFrozen ? "Ghost frozen" : "Freeze Ghost"}</span>
            </button>

            <div className="hidden items-center gap-2 border-l border-line pl-3 xl:flex">
              <div className="text-right">
                <div className="caption-4 max-w-40 truncate text-fg">{user?.email}</div>
                <div className="caption-5 uppercase tracking-wider text-fg-subtle">{user?.role}</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void logout()}
              aria-label={`Sign out ${user?.email ?? ""}`}
              className="btn btn-ghost p-2"
            >
              <SignOut size={18} aria-hidden="true" />
            </button>
          </div>
        </div>

        <div
          className="flex items-center gap-3 overflow-x-auto border-t border-line px-4 py-2 lg:px-6"
          role="region"
          aria-label="Safety status"
        >
          <div
            role="group"
            aria-label="Operating mode"
            className="flex shrink-0 items-center gap-1 rounded-lg border border-line bg-canvas p-1"
          >
            {MODES.map((mode) => {
              const selected = currentMode === mode.id;
              const IconComponent = mode.icon;
              return (
                <button
                  key={mode.id}
                  type="button"
                  aria-pressed={selected}
                  disabled={!isOwner || modeBusy}
                  title={isOwner ? `Switch to ${mode.label}` : "Only an owner can change the operating mode"}
                  onClick={() => void handleMode(mode.id)}
                  className={`button-xsm motion-color inline-flex items-center gap-1 rounded-lg px-2 py-1 disabled:cursor-not-allowed ${
                    selected ? `bg-hover ${mode.tone}` : "text-fg-subtle hover:text-fg disabled:hover:text-fg-subtle"
                  }`}
                >
                  <IconComponent size={12} weight={selected ? "fill" : "regular"} aria-hidden="true" />
                  <span>{mode.label}</span>
                </button>
              );
            })}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Badge tone="info" icon={ShieldCheck} title="Active Authority Passport version">
              Policy {safety.policyVersion === null ? "unknown" : `v${safety.policyVersion}`}
            </Badge>
            <Badge
              tone={isFrozen ? "bad" : "ok"}
              icon={isFrozen ? ShieldWarning : ShieldCheck}
              title={isFrozen ? settings?.killSwitchReason ?? "Kill switch engaged" : "Kill switch is not engaged"}
            >
              Kill switch {isFrozen ? "engaged" : "clear"}
            </Badge>
            <a href={appHash("approvals", { status: "PENDING" })} className="rounded-full" aria-label={`Pending approvals: ${pending === null ? "unknown" : pending}`}>
              <Badge tone={pendingTone} icon={Clock}>
                Approvals {pending === null ? "unknown" : pending}
              </Badge>
            </a>
            <a
              href={appHash("transactions", { status: "PENDING_RECONCILIATION" })}
              className="rounded-full"
              aria-label={`Items pending reconciliation: ${reconcile === null ? "unknown" : reconcile}`}
            >
              <Badge tone={reconcileTone} icon={ArrowsClockwise}>
                Reconciliation {reconcile === null ? "unknown" : reconcile}
              </Badge>
            </a>
          </div>
        </div>
      </header>

      <FreezeModal isOpen={freezeOpen} onClose={() => setFreezeOpen(false)} isUnfreeze={isFrozen} />
      <JudgeTourModal open={tourOpen} onClose={() => setTourOpen(false)} />
    </>
  );
};
