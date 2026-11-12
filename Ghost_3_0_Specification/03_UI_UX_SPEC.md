# Ghost 3.0 — UI/UX Design Specification
**Version:** 1.0 | **Design direction:** Premium fintech control room

## 1. Experience principles
1. Make authority visible everywhere.
2. Put action status before decorative analytics.
3. Show evidence next to every decision.
4. Distinguish real Sandbox operations, internal records, and simulated results.
5. Make dangerous actions deliberate and reversible where technically possible.
6. Never use color as the only status signal.
7. Keep the owner in control: mode, freeze, policy, approvals.
8. Use AI as an assistant, not as a mysterious authority.

## 2. Visual direction
- Theme: dark navy/charcoal surfaces, restrained indigo/violet accents, cool neutral text.
- Semantic colors: green = permitted/completed; amber = review/pending; red = blocked/critical; blue/violet = informational/AI.
- Avoid neon overload, glassmorphism everywhere, oversized gradients, and generic “AI magic” visuals.
- Typography: Inter or a similarly legible sans-serif. Use tabular numerals for money/metrics.
- Radius: 10–14px cards, 8px controls.
- Motion: subtle 120–200ms transitions; respect `prefers-reduced-motion`.
- Use Lucide icons paired with labels for important actions.
- The UI must look credible with zero data and with dense transaction histories.

## 3. App shell and navigation
### Left sidebar
- Overview
- Ghost Brain
- Transactions
- Approvals
- Customers
- Authority Passport
- What-If Lab
- Ghostbreaker
- Audit Trail
- Settings

### Global header
- Workspace/account name.
- Environment badge: `PAYPAL SANDBOX`.
- Current mode selector/status.
- Global freeze control visible on every authenticated page.
- User menu and sign out.

### Persistent safety indicators
- Current mode and active policy version.
- Kill-switch state.
- Sandbox environment.
- Pending approvals count.
- Never imply production payments are available in MVP.

## 4. Screen specifications
### 4.1 Login
Purpose: securely enter the owner workspace.
- Email/password fields, validation, loading, invalid-credentials state.
- Clearly label this as a demo workspace if authentication is seeded.
- Do not display credentials in UI or commit default secrets.
- Keyboard accessible; focus visible.

### 4.2 Overview / Control Room
Layout:
- Top row: mode and policy status, freeze control.
- Metric cards: transaction count, amount processed in Sandbox, pending approvals, blocked actions, remaining budget.
- Main area: live decision feed and recent transaction list.
- Side panel: authority summary and latest Ghostbreaker result.
- Each metric has a definition and click-through destination.
- Distinguish `Sandbox captured amount`, `simulated revenue`, and `estimated impact`.
- Empty state includes “Run demo scenario” and “Connect PayPal Sandbox” setup guidance.
- Error state must not replace unknown metrics with zero.

### 4.3 Ghost Brain / conversation
- Left: session list or customer selector.
- Center: conversation and structured action card.
- Right: customer memory, current policy checks, proposed action.
- Each AI message may include intent, confidence, missing information, and evidence references.
- Customer input is visibly treated as a request, not an instruction to the system.
- Action card states: Proposed, Observe-only, Awaiting approval, Blocked, Authorized, Submitted, Pending reconciliation, Completed, Failed.
- Provide clear buttons: “Evaluate request”, “Request approval”, “View decision evidence”.
- Never show “Payment successful” before verified provider status.
- For high-risk actions, show a confirmation dialog with exact amount/currency/customer/action.

### 4.4 Authority Passport
- Passport summary card: enabled actions, per-action caps, daily cap, customer cap, velocity cap, discount/refund limits.
- Show active policy version and publication timestamp.
- Separate “Current active policy” from “Draft changes”.
- Edit controls use validated numeric fields and explicit currency.
- Show a diff preview before publishing.
- Publish requires confirmation and a reason.
- AI recommendation may prefill a draft but cannot publish it.
- Explain unsupported actions such as transfers as “Not available in this MVP”, not as enabled.

### 4.5 Trust Engine / Decision detail
Header: action, amount, customer, decision status, timestamp, correlation ID.
Sections:
1. Final outcome and plain-language explanation.
2. Checklist: authority, mode, amount, discount/refund, customer evidence, risk budget, daily limit, velocity, approval, idempotency, provider preconditions.
3. Each check displays `PASS`, `FAIL`, `REVIEW`, or `NOT APPLICABLE`, plus reason and evidence source.
4. Policy version and snapshot.
5. Execution/provider references if any.
6. Timeline of decision and state changes.
Avoid a single unexplained “AI risk score”. If risk units are shown, explain how rules contributed.

### 4.6 Transactions
- Table columns: internal ID, customer, action, amount/currency, status, decision, PayPal reference, created time.
- Filters: date range, action type, status, customer, outcome.
- Search by internal or PayPal reference.
- Details drawer/page includes payment lifecycle and audit timeline.
- Refund action is shown only if payment is captured, refundable amount is known, and policy allows proposal.
- Unknown status displays “Pending reconciliation”, never “Failed” by assumption.
- Export CSV should redact/minimize personal data and be permission controlled.

### 4.7 Approval queue
- Cards show requester, exact action, amount/currency, reason, expiry, policy version, and risk signals.
- Approve/reject requires explicit confirmation.
- Before execution, backend revalidates the action and approval binding.
- Expired approvals are visibly disabled.
- If policy changes after request, show “Policy changed — re-evaluation required”.
- No one-click approve-all for financial actions.

### 4.8 Customer profile / Memory
Tabs:
- Overview
- Verified transactions
- Negotiation history
- Refunds/issues
- Memory provenance
- Audit references
Show facts with badges: Verified provider record, Internal record, Customer claim, Expired/unknown.
Display typical discount only when enough verified data exists; show sample count.
Do not expose full payment credentials or unnecessary sensitive data.

### 4.9 What-If Lab
- Left: current policy snapshot.
- Middle: editable proposed policy with field-level validation.
- Right: results comparison.
- Controls: choose fixture set, edit limits, run simulation, save scenario, publish policy.
- Results: allowed, blocked, review, approval-required, exposure, budget use, and scenario assumptions.
- Label outputs “Simulation — no PayPal calls made”.
- Use identical fixtures for baseline and proposed policy.
- If the data is synthetic, show “Synthetic test dataset”.
- Revenue/conversion forecasts are optional and must be clearly labeled as estimates with assumptions.

### 4.10 Ghostbreaker
- Header explains that tests run in isolated mode and do not move money.
- Suite summary: passed / failed / not run.
- Test list: attack name, threat, expected result, actual result, status, timestamp.
- Detail view: input payload, expected decision, actual reason codes, evidence, correlation ID.
- Failed test is prominent; do not hide it or show a fake success state.
- Rerun suite and compare runs.
- Initial cases: prompt injection, discount cap, amount cap, forged owner authority, duplicate refund, split-payment budget exhaustion, Lockdown, expired approval, changed approval payload, provider timeout.

### 4.11 Audit Trail
- Searchable append-only event list.
- Filters by event type, actor, entity, decision, date, correlation ID.
- Event detail includes redacted payload, policy version, source reference, and linked transaction/decision.
- Timeline order must use server timestamps.
- Display “Audit record” rather than claiming cryptographic immutability unless tamper-evident storage is actually implemented.

### 4.12 Settings / PayPal connection
- PayPal Sandbox client ID and secret configured only server-side.
- UI may show connected/not connected, last verification, and masked account/environment metadata, never secret values.
- Provide instructions to configure env vars; do not collect secrets in a normal browser form.
- AI provider health and database status show healthy/degraded/unavailable.
- Include “Test connection” server-side and report result without exposing secrets.

## 5. Interaction rules
- Destructive/high-impact actions require confirmation.
- Freeze control is always visible and reachable by keyboard.
- Freeze dialog asks for optional reason; action itself should be fast.
- Lockdown/freeze confirmation must clearly state that in-flight provider actions may not be reversible.
- Do not make color the only signal; pair icon, text, and color.
- All forms have inline validation and server-side error handling.
- Loading states must prevent duplicate submissions.
- Empty states explain the next action.
- Error states include retry guidance and request ID where appropriate.
- Tables support keyboard focus, readable density, and responsive overflow.
- Dialogs trap focus and restore focus on close.
- Target WCAG 2.2 AA contrast where practical.

## 6. Responsive behavior
- Desktop: full sidebar + three-column agent workspace.
- Tablet: collapsible sidebar, two-column layouts.
- Mobile: single-column cards, transaction details in dedicated page/drawer, sticky safety status and accessible freeze control.
- Do not shrink dense tables into unreadable text; use cards or horizontal scrolling.

## 7. Component inventory
- `AppShell`
- `EnvironmentBadge`
- `GhostModeBadge`
- `FreezeControl`
- `MetricCard`
- `DecisionStatusBadge`
- `DecisionChecklist`
- `AuthorityPassportCard`
- `PolicyDiffViewer`
- `ApprovalCard`
- `TransactionTable`
- `TransactionTimeline`
- `CustomerProvenanceBadge`
- `RiskBudgetMeter`
- `AuditEventRow`
- `SimulationComparison`
- `RedTeamCaseRow`
- `ConfirmActionDialog`
- `EmptyState`
- `ErrorState`
- `LoadingSkeleton`

## 8. Content style
Use short, direct language:
- “Blocked: discount exceeds the 15% limit.”
- “Review required: verified customer history is unavailable.”
- “Pending reconciliation: PayPal has not confirmed the final result.”
Avoid:
- “AI thinks this is safe” as the sole rationale.
- “100% fraud-proof.”
- “Payment completed” before provider confirmation.
- Unqualified revenue uplift predictions.

## 9. Demo data and seed states
Seed a clearly labeled demo workspace with:
- A returning customer with verified purchase history.
- A new customer with no verified history.
- A captured Sandbox payment eligible for a partial refund.
- A refund request above the remaining refundable amount.
- A 22% discount request against a 15% cap.
- A pending approval.
- A transaction in pending reconciliation.
All seed records must be labeled appropriately and must not masquerade as real customer data.
