import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle, Info, WarningOctagon, X } from "./icons";

type ToastTone = "ok" | "bad" | "info";

interface ToastItem {
  id: number;
  tone: ToastTone;
  message: string;
}

interface ToastApi {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const counter = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    (tone: ToastTone, message: string) => {
      counter.current += 1;
      const id = counter.current;
      setToasts((current) => [...current.slice(-3), { id, tone, message }]);
      window.setTimeout(() => dismiss(id), tone === "bad" ? 9000 : 5000);
    },
    [dismiss]
  );

  const api = useMemo<ToastApi>(
    () => ({
      success: (message) => push("ok", message),
      error: (message) => push("bad", message),
      info: (message) => push("info", message),
    }),
    [push]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[calc(100%-32px)] max-w-sm flex-col gap-2"
        aria-live="polite"
        aria-atomic="false"
      >
        {toasts.map((toast) => (
          <ToastCard key={toast.id} toast={toast} onDismiss={() => dismiss(toast.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
};

const ToastCard: React.FC<{ toast: ToastItem; onDismiss: () => void }> = ({ toast, onDismiss }) => {
  const border = toast.tone === "ok" ? "border-ok" : toast.tone === "bad" ? "border-bad" : "border-info";
  const color = toast.tone === "ok" ? "text-ok" : toast.tone === "bad" ? "text-bad" : "text-info";
  const IconComponent = toast.tone === "ok" ? CheckCircle : toast.tone === "bad" ? WarningOctagon : Info;
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.classList.add("pop-enter");
  }, []);
  return (
    <div
      ref={ref}
      role={toast.tone === "bad" ? "alert" : "status"}
      className={`pointer-events-auto flex items-start gap-3 rounded-xl border bg-raised p-3 ${border}`}
    >
      <IconComponent size={18} className={`mt-0.5 shrink-0 ${color}`} aria-hidden="true" />
      <p className="body-6 min-w-0 flex-1 break-words text-fg">{toast.message}</p>
      <button type="button" onClick={onDismiss} aria-label="Dismiss notification" className="btn btn-ghost p-1">
        <X size={14} aria-hidden="true" />
      </button>
    </div>
  );
};

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
}
