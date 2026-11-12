import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api/client";
import { useAuth } from "./AuthContext";
import type { DashboardSummary, Transaction } from "../lib/types";

export interface SafetyState {
  summary: DashboardSummary | null;
  transactions: Transaction[] | null;
  summaryError: string | null;
  transactionsError: string | null;
  loading: boolean;
  lastUpdated: number | null;
  pendingApprovals: number | null;
  reconciliationItems: Transaction[] | null;
  policyVersion: number | null;
  refresh: () => Promise<void>;
}

const SafetyContext = createContext<SafetyState | null>(null);

const POLL_MS = 30000;

export const SafetyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, settings, refreshSettings } = useAuth();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [transactions, setTransactions] = useState<Transaction[] | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [transactionsError, setTransactionsError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    const [summaryResult, txResult] = await Promise.allSettled([
      api.get<{ summary: DashboardSummary }>("/dashboard/summary"),
      api.get<{ transactions: Transaction[] }>("/transactions"),
    ]);
    if (!mounted.current) return;
    if (summaryResult.status === "fulfilled") {
      setSummary(summaryResult.value.summary);
      setSummaryError(null);
    } else {
      setSummaryError(summaryResult.reason?.message || "Request failed");
    }
    if (txResult.status === "fulfilled") {
      setTransactions(txResult.value.transactions);
      setTransactionsError(null);
    } else {
      setTransactionsError(txResult.reason?.message || "Request failed");
    }
    setLastUpdated(Date.now());
    setLoading(false);
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    void refresh();
    const id = window.setInterval(() => {
      void refresh();
      void refreshSettings();
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [user, refresh]);

  useEffect(() => {
    if (user && settings) void refresh();
  }, [settings?.version, settings?.mode, settings?.killSwitchEnabled]);

  const value = useMemo<SafetyState>(() => {
    const reconciliationItems = transactions
      ? transactions.filter((tx) => tx.status === "PENDING_RECONCILIATION")
      : null;
    return {
      summary,
      transactions,
      summaryError,
      transactionsError,
      loading,
      lastUpdated,
      pendingApprovals: summary ? summary.metrics.pendingApprovalsCount : null,
      reconciliationItems,
      policyVersion: summary ? summary.policyVersion : null,
      refresh,
    };
  }, [summary, transactions, summaryError, transactionsError, loading, lastUpdated, refresh]);

  return <SafetyContext.Provider value={value}>{children}</SafetyContext.Provider>;
};

export function useSafety(): SafetyState {
  const ctx = useContext(SafetyContext);
  if (!ctx) throw new Error("useSafety must be used inside SafetyProvider");
  return ctx;
}
