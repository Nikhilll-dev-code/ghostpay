# Ghost 3.0 — Implementation and Operations Guide
**Version:** 1.0 | **Audience:** AI coding agents, developers, demo operator

## 1. Implementation strategy
Build a safe vertical slice before building all screens. Do not start with elaborate dashboard animations. The first milestone is one request flowing through structured AI proposal, deterministic evaluation, authorization, PayPal Sandbox, verified status, and audit.

## 2. Architecture
### Frontend
React + TypeScript + Vite. Feature-based folders. Shared API client, typed response schemas, route guards, accessible components, and explicit loading/error/empty states.

### Backend
Express + TypeScript. Route handlers should be thin. Business logic lives in services. All inputs are Zod-validated. Policy and PayPal services are separate modules.

### Database
PostgreSQL + Prisma. Use migrations. Financial amounts are integer minor units plus currency. Use transactions/locking for budget reservations and idempotency. Avoid relying on process memory for mode, kill switch, approval, or financial state.

### AI adapter
Provider-agnostic interface:
- `interpretCustomerRequest(input, context) -> ActionProposal`
- Validate output against a strict schema.
- Never expose PayPal credentials or secrets to model prompts.
- The model cannot call execution tools directly.
- If parsing/validation fails, ask for clarification or route to review.
- Store provider/model metadata and safe request correlation ID.

### Policy service
Pure deterministic functions where possible:
- `evaluateAction(proposal, context, policy, settings) -> Decision`
- `calculateRiskUnits(signals, rules) -> RiskEvaluation`
- `canonicalizePayload(payload) -> canonical JSON`
- `hashPayload(payload) -> SHA-256`
- `checkBudgetAndReserve(...)` implemented transactionally.
No LLM call inside the final authorization gate.

### PayPal service
- Server-only client credentials.
- Create order, capture order, refund capture, fetch order/capture/refund status, verify webhook.
- Use PayPal Sandbox base URL and credentials in development.
- Wrap provider-specific payloads in typed internal models.
- Use provider idempotency support where available and an internal unique operation key.
- Treat network timeout as unknown outcome requiring reconciliation.

### Background worker
- Process pending reconciliation and webhook events.
- Use database-backed job/outbox rows for MVP.
- Retry safe reads with bounded backoff.
- Never blindly retry uncertain money-moving requests.
- Make each job idempotent.

## 3. Environment variables
Create `.env.example` with placeholders only:
```bash
NODE_ENV=development
PORT=4000
WEB_ORIGIN=http://localhost:5173
DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/ghost
SESSION_SECRET=replace-with-long-random-secret
PAYPAL_ENV=sandbox
PAYPAL_CLIENT_ID=replace-me
PAYPAL_CLIENT_SECRET=replace-me
PAYPAL_WEBHOOK_ID=replace-me
AI_PROVIDER=mock
AI_API_KEY=
AI_MODEL=
LOG_LEVEL=info
```
Never commit `.env`. Validate required variables on startup. If PayPal credentials are absent, app can start in `DEMO_MOCK` mode only if the UI clearly labels all activity as mocked and no screen claims it is a real Sandbox operation.

## 4. Development milestones
### M0 — Repository and foundations
- Inspect existing repo and preserve viable code.
- Establish TypeScript strict mode, lint, format, env validation, database, migrations, shared types, structured logging.
- Add health endpoint and README.
**Exit:** clean typecheck/lint; app boots; database migration works.

### M1 — Authentication and app shell
- Owner login/session.
- App shell, navigation, Sandbox banner, mode indicator, freeze control.
- Authorization middleware.
**Exit:** protected API tests pass; unauthenticated requests denied.

### M2 — Policy engine
- Authority policy schema and immutable versioning.
- Decision outcomes and reason codes.
- Unit tests for all limits, modes, missing data, and edge cases.
**Exit:** no LLM or UI path can bypass policy evaluation.

### M3 — Agent proposal workflow
- Conversation UI and provider adapter.
- Structured intent schema and proposal creation.
- Customer context lookup with provenance.
- Evaluate and display decision card.
**Exit:** invalid/uncertain proposals never execute.

### M4 — Approvals and operation state machine
- Approval creation, expiration, payload hash, single-use semantics.
- Transaction records and idempotency.
- Atomic budget reservation.
**Exit:** stale/modified/expired approvals and duplicate requests rejected.

### M5 — PayPal Sandbox
- Connection check.
- Create order/capture flow.
- Refund eligible capture.
- Webhook signature verification and event deduplication.
- Reconciliation worker.
**Exit:** test capture and refund status can be verified; uncertain outcome does not duplicate transaction.

### M6 — Audit and customer memory
- Append-only application audit events.
- Decision timeline and reason evidence.
- Customer facts with source/verification status.
**Exit:** transaction detail traces from request to provider state.

### M7 — Modes and Kill Switch
- Observe, Assist, Autopilot, Lockdown.
- Server-side freeze.
- Race-condition tests around mode/freeze changes.
**Exit:** direct API execution is denied in Observe/Lockdown/frozen states.

### M8 — What-If Lab
- Fixture set and deterministic replay.
- Baseline/proposed policy comparison.
- Publish new policy version with diff and audit.
**Exit:** simulation cannot call PayPal; same input/policy produces same outcomes.

### M9 — Ghostbreaker
- Attack fixtures and evaluator.
- Evidence-backed pass/fail.
- Run history and compare.
**Exit:** all ten required cases run; failures are visible; test output is not hard-coded.

### M10 — Polish and release
- Responsive/accessibility pass.
- Error/empty/loading states.
- E2E demo test.
- README, architecture diagram, setup, troubleshooting, known limitations.
**Exit:** clean setup from documented steps and successful demo rehearsal.

## 5. Backend service interfaces
Suggested interfaces (names can vary if behavior is preserved):
```ts
type DecisionOutcome =
  | "ALLOW" | "REQUIRE_APPROVAL" | "BLOCK" | "REVIEW"
  | "OBSERVE_ONLY" | "FROZEN";

interface ActionProposal {
  actionType: "PURCHASE_CAPTURE" | "DISCOUNT_REQUEST" | "REFUND_REQUEST" | "PAYMENT_STATUS";
  customerId?: string;
  orderId?: string;
  captureId?: string;
  amountMinor?: number;
  currency?: string;
  discountBasisPoints?: number;
  rationale?: string;
  missingFields: string[];
  confidence?: number;
}

interface CheckResult {
  code: string;
  status: "PASS" | "FAIL" | "REVIEW" | "NOT_APPLICABLE";
  message: string;
  evidenceRefs?: string[];
}

interface Decision {
  id: string;
  outcome: DecisionOutcome;
  reasonCodes: string[];
  checks: CheckResult[];
  policyVersion: number;
  riskUnits: number;
  canExecute: boolean;
}

interface PolicyEngine {
  evaluate(input: {
    proposal: ActionProposal;
    settings: GhostSettings;
    policy: AuthorityPolicy;
    customerContext: CustomerContext;
    budgetSnapshot: BudgetSnapshot;
    approval?: Approval;
  }): Promise<Decision>;
}
```
`canExecute` is derived by the server and must not be trusted from client input.

## 6. Financial correctness rules
- Represent amounts as integer minor units and currency separately.
- Never calculate with JS floating-point amounts; use integer arithmetic or a decimal library where conversion is required.
- Validate currency and currency precision against the supported currency configuration.
- Refund eligibility comes from verified capture/payment records, not model statements.
- Never accept a client-provided “payment completed” field.
- Store provider request and response metadata only after redaction.
- A timeout after sending a capture/refund request is not proof of failure.
- Use internal operation IDs and idempotency keys.
- Handle concurrency in budget reservations and refunds; two simultaneous refunds must not exceed the remaining refundable amount.
- State changes should be transactional and validated against allowed transitions.

## 7. PayPal integration checklist
1. Create a PayPal developer Sandbox app and test buyer/seller accounts.
2. Configure client ID, secret, and webhook ID in server environment.
3. Verify server obtains OAuth access token from Sandbox.
4. Create order with server-side amount/currency.
5. Store internal order record and PayPal order ID.
6. Capture only after Trust Engine authorization and, if required, valid approval.
7. Verify capture status using API and/or verified webhook.
8. Implement eligible refund against capture ID.
9. Verify refund status and remaining refundable amount.
10. Deduplicate webhook event IDs.
11. Test network timeout and reconciliation path.
12. Confirm the UI never calls PayPal with secret credentials.
13. Display “PayPal Sandbox” persistently.
14. Do not claim a successful integration until the flow is tested in Sandbox.

## 8. Test plan
### Unit tests
- Every reason code and boundary condition.
- 15% discount passes; 15.01% fails when cap is 15%.
- Exact amount cap passes; one minor unit above fails.
- Missing policy/customer/payment evidence produces review/block.
- Observe/Lockdown/freeze outcomes.
- Currency mismatch.
- Daily/customer exposure cap.
- Velocity limit.
- Risk budget calculation determinism.
- Canonical payload hash stable for equivalent canonical data.

### Integration tests
- Login/session/authorization.
- Policy draft/publish and audit.
- Approval creation, expiry, payload mutation, one-time use.
- Atomic budget reservation under concurrency.
- Idempotency duplicate request.
- PayPal adapter mocked for predictable tests.
- Webhook signature invalid/valid/duplicate handling.
- Reconciliation status transitions.
- Simulation zero-provider-call assertion.

### E2E tests
1. Login → set Assist mode → customer request → decision → approve → Sandbox capture → verified completed state → audit.
2. Request discount above cap → blocked → no PayPal call.
3. Freeze Ghost → attempt direct execution → rejected.
4. Run Ghostbreaker → show real pass/fail results.
5. Run simulation → compare policies → no provider calls.
6. Mobile viewport can reach mode status and freeze control.

### Security tests
- IDOR attempts across customer/transaction IDs.
- Operator privilege escalation.
- CSRF where cookie sessions are used.
- Prompt injection.
- Duplicate/replay webhook.
- Request flooding/rate limit.
- Secret and sensitive-data log scan.
- Direct API call bypassing UI restrictions.

## 9. Observability
Each request gets a correlation ID. Log:
- request ID, actor ID, route, status, duration
- decision ID, policy version, reason codes
- operation ID and provider reference
- webhook event ID and reconciliation attempts
Never log:
- PayPal client secret/access token
- card number/CVV
- session cookie or password
- full sensitive customer content unless explicitly required and protected

Provide health endpoints:
- `GET /health/live`
- `GET /health/ready`
Readiness checks database connectivity and required config without exposing secrets.

## 10. Deployment checklist
- Use a managed PostgreSQL instance with TLS and backups.
- Configure server secrets through deployment secret settings.
- Set exact frontend origin and secure cookies.
- Use HTTPS.
- Configure PayPal Sandbox webhook URL.
- Run migrations as a release step.
- Seed demo data only through an explicit seed command.
- Ensure frontend has no server secrets in build-time variables.
- Set rate limits and request body limits.
- Confirm logs redact secrets.
- Run smoke tests after deployment.
- Verify PayPal Sandbox transaction end to end.
- Document rollback procedure for app release and policy version.
- Keep production-money execution disabled.

## 11. Demo runbook
Pre-demo:
- Confirm environment badge says PayPal Sandbox.
- Verify API, database, AI adapter, and PayPal Sandbox credentials.
- Seed clearly labeled demo customers and a captured payment for refund testing.
- Run test suite and retain results.
- Ensure no stale pending operation could confuse the demo.

Live sequence:
1. Show Authority Passport and 15% discount cap.
2. Process an eligible Sandbox purchase through Trust Engine.
3. Show provider-confirmed capture and audit trail.
4. Submit 22% discount request; show block and no provider call.
5. Run Ghostbreaker and show attack outcomes.
6. Run What-If replay with a higher cap.
7. Freeze Ghost and attempt an execution via the app/API test harness; show server rejection.
8. Finish on the decision evidence and provider reference.

If PayPal Sandbox or the network fails during demo:
- Do not fake a successful provider result.
- Switch to a clearly labeled recorded walkthrough or mocked mode.
- State that the live provider call was unavailable.
- Show logs/test evidence from a prior verified Sandbox run if available.

## 12. Final release checklist
- [ ] All required docs read and reflected in task plan.
- [ ] Strict typecheck passes.
- [ ] Lint and unit tests pass.
- [ ] Integration tests pass.
- [ ] Core E2E flow passes.
- [ ] Policy enforcement and kill-switch tests pass.
- [ ] Duplicate operation and stale approval tests pass.
- [ ] Webhook verification tests pass.
- [ ] Simulation cannot call PayPal.
- [ ] Red-team results are real and reproducible.
- [ ] No secrets committed or logged.
- [ ] Sandbox label visible on all financial screens.
- [ ] No unsupported money-transfer claims.
- [ ] Setup and troubleshooting documented.
- [ ] Known limitations clearly listed.
