export function formatMoney(minor: number | null | undefined, currency = "USD"): string {
  if (minor === null || minor === undefined || Number.isNaN(minor)) return "Unknown";
  const value = (minor / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return currency === "USD" ? `$${value}` : `${value} ${currency}`;
}

export function formatSignedMoney(minor: number): string {
  const sign = minor > 0 ? "+" : minor < 0 ? "\u2212" : "";
  return `${sign}${formatMoney(Math.abs(minor))}`;
}

export function formatSigned(value: number): string {
  return value > 0 ? `+${value}` : `${value}`;
}

export function formatBasisPoints(bp: number | null | undefined): string {
  if (bp === null || bp === undefined || Number.isNaN(bp)) return "Unknown";
  return `${(bp / 100).toFixed(2)}%`;
}

export function shortId(id: string | null | undefined, length = 8): string {
  if (!id) return "None";
  return id.length > length ? `${id.slice(0, length)}…` : id;
}

export function formatDateTime(value: string | number | Date | null | undefined): string {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export function formatTime(value: string | number | Date | null | undefined): string {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleTimeString(undefined, { timeStyle: "short" });
}

export const EXPIRY_WARNING_MS = 5 * 60 * 1000;

export interface ExpiryInfo {
  expired: boolean;
  soon: boolean;
  remainingMs: number;
  label: string;
}

export function getExpiry(expiresAt: string | number | Date, now: number = Date.now()): ExpiryInfo {
  const target = new Date(expiresAt).getTime();
  if (Number.isNaN(target)) {
    return { expired: true, soon: false, remainingMs: 0, label: "Expiry unknown" };
  }
  const remainingMs = target - now;
  if (remainingMs <= 0) {
    return { expired: true, soon: false, remainingMs: 0, label: "Expired" };
  }
  const totalSeconds = Math.floor(remainingMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  let label: string;
  if (hours > 0) label = `${hours}h ${minutes}m left`;
  else if (minutes > 0) label = `${minutes}m left`;
  else label = `${seconds}s left`;
  return { expired: false, soon: remainingMs <= EXPIRY_WARNING_MS, remainingMs, label };
}

export function isSimulatedProviderId(id: string | null | undefined): boolean {
  return !!id && id.startsWith("SANDBOX_");
}

export function parseMoneyInput(value: string): number | null {
  const trimmed = value.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  const minor = Math.round(parseFloat(trimmed) * 100);
  return Number.isFinite(minor) ? minor : null;
}

export function parsePercentInput(value: string): number | null {
  const trimmed = value.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  const bp = Math.round(parseFloat(trimmed) * 100);
  return Number.isFinite(bp) ? bp : null;
}
