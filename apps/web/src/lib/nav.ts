import type { Icon } from "../components/icons";
import {
  Crosshair,
  Flask,
  GearSix,
  Receipt,
  Robot,
  Scroll,
  ShieldCheck,
  SquaresFour,
  UserCheck,
  Users,
} from "../components/icons";

export type NavView =
  | "overview"
  | "brain"
  | "transactions"
  | "approvals"
  | "customers"
  | "authority"
  | "whatif"
  | "ghostbreaker"
  | "audit"
  | "settings";

export interface NavItem {
  id: NavView;
  label: string;
  description: string;
  icon: Icon;
}

export const NAV_ITEMS: NavItem[] = [
  { id: "overview", label: "Overview", description: "Safety summary, metrics and the decision feed", icon: SquaresFour },
  { id: "brain", label: "Ghost Brain", description: "Send a customer request and watch the Trust Engine decide", icon: Robot },
  { id: "transactions", label: "Transactions", description: "Sandbox ledger, refunds and reconciliation", icon: Receipt },
  { id: "approvals", label: "Approval Queue", description: "Human approvals bound to exact payloads", icon: UserCheck },
  { id: "customers", label: "Customer Memory", description: "Facts with provenance for each customer", icon: Users },
  { id: "authority", label: "Authority Passport", description: "Active policy limits and new versions", icon: ShieldCheck },
  { id: "whatif", label: "What-If Lab", description: "Replay fixtures against a proposed policy", icon: Flask },
  { id: "ghostbreaker", label: "Ghostbreaker", description: "Ten adversarial attack cases", icon: Crosshair },
  { id: "audit", label: "Audit Trail", description: "Append only record of every important event", icon: Scroll },
  { id: "settings", label: "Settings", description: "Backend health and PayPal Sandbox setup", icon: GearSix },
];

export const NAV_IDS = NAV_ITEMS.map((item) => item.id);

export function isNavView(value: string | undefined): value is NavView {
  return !!value && (NAV_IDS as string[]).includes(value);
}
