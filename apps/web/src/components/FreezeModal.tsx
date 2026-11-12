import React, { useRef, useState } from "react";
import { WarningOctagon, ShieldCheck } from "./icons";
import { useAuth } from "../context/AuthContext";
import { Dialog } from "./Dialog";
import { Notice } from "./ui";
import { useToast } from "./Toast";

interface FreezeModalProps {
  isOpen: boolean;
  onClose: () => void;
  isUnfreeze?: boolean;
}

export const FreezeModal: React.FC<FreezeModalProps> = ({ isOpen, onClose, isUnfreeze = false }) => {
  const { freezeGhost, unfreezeGhost, user, settings } = useAuth();
  const toast = useToast();
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reasonRef = useRef<HTMLTextAreaElement>(null);
  const isOwner = user?.role === "OWNER";

  const close = () => {
    if (loading) return;
    setReason("");
    setError(null);
    onClose();
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!isOwner) return;
    if (!reason.trim()) {
      setError("Enter a reason. It is written to the audit trail.");
      reasonRef.current?.focus();
      return;
    }
    setLoading(true);
    setError(null);
    try {
      if (isUnfreeze) {
        await unfreezeGhost(reason.trim());
        toast.success("Kill switch disengaged. Policy governed operations can resume.");
      } else {
        await freezeGhost(reason.trim());
        toast.success("Kill switch engaged. New financial executions are now rejected by the server.");
      }
      setReason("");
      onClose();
    } catch (err: any) {
      setError(err.message || "The kill switch state could not be updated. Nothing was changed.");
    } finally {
      setLoading(false);
    }
  };

  const formId = "freeze-form";

  return (
    <Dialog
      open={isOpen}
      onClose={close}
      closeDisabled={loading}
      initialFocusRef={reasonRef}
      title={isUnfreeze ? "Disengage the kill switch" : "Freeze Ghost"}
      description={
        isUnfreeze
          ? "Restore normal policy governed operations. Actions that were rejected while frozen are not replayed."
          : "Stops every new financial execution on the backend until an owner disengages the switch."
      }
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={close} disabled={loading}>
            Cancel
          </button>
          <button
            type="submit"
            form={formId}
            disabled={loading || !isOwner}
            className={`btn ${isUnfreeze ? "btn-ok-solid" : "btn-danger-solid"}`}
          >
            {isUnfreeze ? (
              <ShieldCheck size={16} aria-hidden="true" />
            ) : (
              <WarningOctagon size={16} aria-hidden="true" />
            )}
            <span>{loading ? "Recording" : isUnfreeze ? "Disengage kill switch" : "Engage kill switch"}</span>
          </button>
        </>
      }
    >
      {!isOwner && (
        <Notice tone="warn" icon={WarningOctagon} role="alert">
          Only an owner can change the kill switch. You are signed in as {user?.role?.toLowerCase() ?? "a different role"}.
        </Notice>
      )}
      {!isUnfreeze && (
        <Notice tone="bad" icon={WarningOctagon}>
          Queued or new actions are rejected with <code className="num text-fg">KILL_SWITCH_ACTIVE</code>. Requests that
          PayPal Sandbox already accepted cannot be recalled.
        </Notice>
      )}
      {isUnfreeze && settings?.killSwitchReason && (
        <p className="caption-5 text-fg-subtle">Current reason on record: {settings.killSwitchReason}</p>
      )}
      <form id={formId} onSubmit={handleSubmit} className="space-y-1">
        <label htmlFor="freeze-reason" className="label">
          Reason for the audit trail
        </label>
        <textarea
          id="freeze-reason"
          ref={reasonRef}
          rows={3}
          value={reason}
          disabled={!isOwner}
          aria-invalid={!!error}
          aria-describedby={error ? "freeze-error" : undefined}
          onChange={(event) => setReason(event.target.value)}
          placeholder={isUnfreeze ? "Why operations can resume" : "Why Ghost is being frozen, for example suspicious activity"}
          className="field resize-none"
        />
        {error && (
          <p id="freeze-error" className="caption-5 text-bad" role="alert">
            {error}
          </p>
        )}
      </form>
    </Dialog>
  );
};
