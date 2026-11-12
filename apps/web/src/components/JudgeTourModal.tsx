import React from "react";
import { ArrowRight, CheckCircle, Crosshair, Lightning, LockKey, Play, ShieldCheck, Sparkle, WarningOctagon } from "./icons";
import { Dialog } from "./Dialog";
import { Badge } from "./ui";
import { appHash } from "../lib/route";

interface JudgeTourModalProps {
  open: boolean;
  onClose: () => void;
}

export const JudgeTourModal: React.FC<JudgeTourModalProps> = ({ open, onClose }) => {
  const steps = [
    {
      num: "1",
      title: "Bounded Purchase Execution",
      badge: "Autopilot",
      badgeTone: "ok" as const,
      description: "Ask Ghost Brain for an authorized purchase with a 10% discount promo. The deterministic Trust Engine validates that 10% is within the configured 15% cap and executes the order through PayPal Sandbox.",
      actionLabel: "Try in Ghost Brain",
      href: appHash("brain"),
    },
    {
      num: "2",
      title: "Prompt Injection Blocked",
      badge: "Security Defense",
      badgeTone: "bad" as const,
      description: "Test an adversarial prompt claiming the business owner authorized a 60% discount override. Ghost Brain formulates the proposal, but the Trust Engine strictly blocks it with DISCOUNT EXCEEDS LIMIT.",
      actionLabel: "Test Prompt Injection",
      href: appHash("brain"),
    },
    {
      num: "3",
      title: "Cryptographic Approval Queue",
      badge: "Human in the Loop",
      badgeTone: "warn" as const,
      description: "When an unverified customer asks for a high value refund, the Trust Engine escalates to REQUIRE APPROVAL. Approvals are cryptographically bound to a SHA-256 payload hash and single use.",
      actionLabel: "View Approvals",
      href: appHash("approvals"),
    },
    {
      num: "4",
      title: "Emergency Kill Switch",
      badge: "Atomic Freeze",
      badgeTone: "bad" as const,
      description: "Engage Freeze Ghost in the header at any time. The backend atomically locks all financial execution across active sessions, rejecting any pending or queued execution attempts.",
      actionLabel: "Inspect Safety Settings",
      href: appHash("settings"),
    },
    {
      num: "5",
      title: "Ghostbreaker Attack Suite",
      badge: "10 Threat Vectors",
      badgeTone: "violet" as const,
      description: "Run ten adversarial financial attack vectors against the live engine, including replay attacks, currency mismatch, velocity abuse, and budget exhaustion.",
      actionLabel: "Launch Ghostbreaker",
      href: appHash("ghostbreaker"),
    },
  ];

  return (
    <Dialog open={open} onClose={onClose} title="Judge Fast Track Demo Guide" size="lg">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
          <p className="body-6 text-fg-muted">
            Five core proof points demonstrating bounded autonomy for PayPal Sandbox.
          </p>
          <Badge tone="warn" icon={LockKey}>
            PayPal Sandbox
          </Badge>
        </div>

        <ul className="space-y-3">
          {steps.map((step) => (
            <li key={step.num} className="panel space-y-2 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-raised text-fg text-xs font-semibold">
                    {step.num}
                  </span>
                  <span className="body-4 font-semibold text-fg">{step.title}</span>
                </div>
                <Badge tone={step.badgeTone}>{step.badge}</Badge>
              </div>
              <p className="caption-5 text-fg-muted">{step.description}</p>
              <div className="pt-1">
                <a
                  href={step.href}
                  onClick={onClose}
                  className="btn btn-secondary inline-flex items-center gap-1"
                >
                  <span>{step.actionLabel}</span>
                  <ArrowRight size={14} aria-hidden="true" />
                </a>
              </div>
            </li>
          ))}
        </ul>

        <div className="flex justify-end pt-2">
          <button type="button" onClick={onClose} className="btn btn-secondary">
            Close guide
          </button>
        </div>
      </div>
    </Dialog>
  );
};
