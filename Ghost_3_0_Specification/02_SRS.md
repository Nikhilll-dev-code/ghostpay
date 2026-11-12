# Ghost 3.0 — Software Requirements Specification (SRS)
**Version:** 1.0 | **Audience:** Engineering and AI coding agents

## 1. System context
Ghost consists of a web client, authenticated API, policy/decision services, database, background worker, AI provider adapter, and PayPal Sandbox integration. The AI is an untrusted proposal generator. The backend is the enforcement authority.

## 2. Terms
- **Action proposal:** Structured candidate operation produced by Ghost Brain.
- **Authority Passport:** Versioned policy defining what actions may be taken and under which limits.
- **Trust Engine:** Deterministic service that evaluates proposals.
- **Risk budget:** Configured exposure allowance, not a probability of fraud.
- **Approval:** Human authorization bound to a specific immutable action payload.
- **Freeze/Kill switch:** Server-side execution-disable flag.
- **Provider status:** State reported by PayPal API/webhook and verified by the backend.
- **Simulation:** Local policy replay with no external payment call.

## 3. Functional requirements
### FR-AUTH
- FR-AUTH-001: Unauthenticated requests to protected endpoints return 401.
- FR-AUTH-002: Only an authorized owner may change mode, freeze state, authority policy, and publish simulation policy.
- FR-AUTH-003: Sensitive state changes require CSRF protection when cookie-based authentication is used.
- FR-AUTH-004: Sessions can be revoked and expire.
- FR-AUTH-005: Authentication and authorization failures are audit logged without leaking secrets.

### FR-AGENT
- FR-AGENT-001: Accept a customer message and optional verified context.
- FR-AGENT-002: Return schema-validated structured intent and proposal.
- FR-AGENT-003: Unknown or low-confidence intent must request clarification or human review.
- FR-AGENT-004: Model output must not directly execute financial operations.
- FR-AGENT-005: All customer-provided text is untrusted data.
- FR-AGENT-006: Model/provider outage must fail safely; no execution from stale or partial proposals.
- FR-AGENT-007: Model output is stored with model/version metadata and redacted input reference as permitted by privacy settings.

### FR-POLICY
- FR-POLICY-001: Evaluate every financial action server-side.
- FR-POLICY-002: Missing or invalid policy means deny/review.
- FR-POLICY-003: Enforce action permission, amount cap, discount cap, refund eligibility, daily cap, velocity, customer exposure, mode, freeze flag, and approval requirements.
- FR-POLICY-004: Policy evaluation returns machine-readable check results and reason codes.
- FR-POLICY-005: Policy evaluation is deterministic for the same policy and same input snapshot.
- FR-POLICY-006: Policy changes create immutable versions and audit events.
- FR-POLICY-007: AI cannot edit or publish policies.
- FR-POLICY-008: Budget reservation and decision must be atomic against concurrent requests.

### FR-EXEC
- FR-EXEC-001: Only `ALLOW` in `AUTOPILOT`, or a valid approved action in `ASSIST`, may proceed to execution.
- FR-EXEC-002: `OBSERVE`, `LOCKDOWN`, and active kill switch cannot execute financial actions.
- FR-EXEC-003: Revalidate policy, mode, freeze, approval, budget, payload hash, and provider preconditions immediately before execution.
- FR-EXEC-004: Every execution uses an idempotency key and unique internal operation ID.
- FR-EXEC-005: Timeout or unknown provider result enters reconciliation; never blindly retry a non-idempotent operation.
- FR-EXEC-006: All provider calls occur server-side.
- FR-EXEC-007: Provider credentials never reach the client.
- FR-EXEC-008: Execution status reflects verified provider status, not optimistic UI state.

### FR-PAYPAL
- FR-PAYPAL-001: Create Sandbox orders for eligible purchases.
- FR-PAYPAL-002: Capture an order only after required policy/approval checks.
- FR-PAYPAL-003: Refund only an eligible captured payment and no more than the remaining refundable amount.
- FR-PAYPAL-004: Verify webhook authenticity before processing events.
- FR-PAYPAL-005: Duplicate webhooks and duplicate user requests are idempotent.
- FR-PAYPAL-006: Store provider IDs, currency, amount, provider status, timestamps, and correlation ID.
- FR-PAYPAL-007: Support reconciliation for pending/unknown results.
- FR-PAYPAL-008: Sandbox environment is visibly marked in UI and logs.
- FR-PAYPAL-009: Transfer functionality remains disabled unless a separately specified and verified PayPal product/API supports the exact use case.

### FR-APPROVAL
- FR-APPROVAL-001: Approval records bind to canonical action payload hash.
- FR-APPROVAL-002: Approval has expiration and one-time use.
- FR-APPROVAL-003: Approver identity and timestamp are recorded.
- FR-APPROVAL-004: Any payload mutation invalidates approval.
- FR-APPROVAL-005: Expired, revoked, used, or mismatched approval is rejected.
- FR-APPROVAL-006: Approver cannot approve own restricted request when separation-of-duties rule applies.

### FR-MODE
- FR-MODE-001: Supported modes are `OBSERVE`, `ASSIST`, `AUTOPILOT`, and `LOCKDOWN`.
- FR-MODE-002: Mode changes are owner-authorized and audited.
- FR-MODE-003: Kill switch takes precedence over all modes.
- FR-MODE-004: Lockdown blocks new execution attempts regardless of frontend state.
- FR-MODE-005: Unlock does not automatically execute queued actions.

### FR-CUSTOMER
- FR-CUSTOMER-001: Store customer profile and transaction summaries with source/provenance.
- FR-CUSTOMER-002: Separate verified facts from customer-supplied claims.
- FR-CUSTOMER-003: Do not store card data, CVV, credentials, or access tokens.
- FR-CUSTOMER-004: Customer memory is used only as a contextual signal, not as authority.
- FR-CUSTOMER-005: Unknown history is represented explicitly.

### FR-AUDIT
- FR-AUDIT-001: Record decision inputs, policy version, check outcomes, decision, actor, and correlation ID.
- FR-AUDIT-002: Record all mode, freeze, policy, approval, execution, webhook, and reconciliation transitions.
- FR-AUDIT-003: Audit events are append-only through application interfaces.
- FR-AUDIT-004: Explanations are generated from structured check results.
- FR-AUDIT-005: Sensitive secrets and payment instrument data are redacted.
- FR-AUDIT-006: Filter audit events by time, event type, action, status, customer, and correlation ID.

### FR-SIM
- FR-SIM-001: Clone current policy into a draft scenario.
- FR-SIM-002: Replay a fixed dataset against current and proposed policy.
- FR-SIM-003: Simulation cannot call PayPal.
- FR-SIM-004: Show outcome deltas, exposure estimates, approval count, and assumptions.
- FR-SIM-005: Publishing a scenario creates a new immutable policy version and requires owner confirmation.

### FR-REDTEAM
- FR-REDTEAM-001: Provide predefined attack cases with expected outcome.
- FR-REDTEAM-002: Run tests in isolated simulation/test context.
- FR-REDTEAM-003: Display pass/fail with evidence and run metadata.
- FR-REDTEAM-004: Never label an unexecuted test as passed.
- FR-REDTEAM-005: Test suite includes discount cap, payment cap, forged authority, duplicate refund, aggregate cap, lockdown, expired approval, changed payload, prompt injection, and provider timeout.

## 4. Non-functional requirements
- NFR-SEC-001: Secrets are stored in environment/secret manager, never in source control or browser bundles.
- NFR-SEC-002: Use TLS in deployment, secure cookies, CSRF defense where applicable, input validation, output encoding, rate limits, and least privilege.
- NFR-SEC-003: Authorization checks are performed on every protected API operation.
- NFR-SEC-004: Webhook signature verification and replay-safe processing are mandatory.
- NFR-SEC-005: Use safe error responses; do not expose stack traces or credentials.
- NFR-REL-001: Unknown provider outcomes enter reconciliation.
- NFR-REL-002: Financial operations are idempotent and state transitions are transactionally persisted.
- NFR-REL-003: Database failure results in no execution.
- NFR-PERF-001: Typical non-provider dashboard API responses should target p95 under 500 ms in local/demo conditions.
- NFR-PERF-002: AI response time may vary; show progress and allow cancellation before execution.
- NFR-UX-001: Core demo flow must be completable in five minutes.
- NFR-UX-002: Keyboard navigation, focus indicators, labels, contrast, and reduced-motion preferences are supported.
- NFR-MAINT-001: TypeScript strict mode and shared schemas are used.
- NFR-MAINT-002: Unit, integration, and E2E tests are included.
- NFR-PRIV-001: Collect only required demo data; provide delete/export behavior where applicable.
- NFR-OBS-001: Use structured logs and correlation IDs; redact sensitive fields.

## 5. Domain model / data dictionary
All money values must use integer minor units (e.g. cents/paise) plus ISO currency code. Never use floating-point arithmetic for financial values.

### User
- id UUID
- email unique
- password_hash or external auth subject
- role `OWNER` | `OPERATOR`
- status `ACTIVE` | `DISABLED`
- created_at, updated_at, last_login_at

### GhostSettings
- id UUID
- mode enum
- kill_switch_enabled boolean
- kill_switch_reason nullable
- updated_by, updated_at
- version integer

### AuthorityPolicy
- id UUID
- version integer
- status `DRAFT` | `ACTIVE` | `ARCHIVED`
- action_permissions JSON/schema-validated
- max_payment_minor, max_refund_minor
- max_discount_basis_points
- daily_exposure_minor
- max_customer_exposure_minor
- max_actions_per_minute
- risk_budget_units and risk rules
- created_by, created_at, published_at, change_reason
- Policy versions are immutable after publication.

### Customer
- id UUID
- external_reference nullable
- display_name
- email_hash or minimized contact identifier where possible
- created_at, updated_at

### CustomerFact
- id UUID
- customer_id
- fact_type
- value_json
- source_type `VERIFIED_PROVIDER` | `INTERNAL_RECORD` | `CUSTOMER_CLAIM`
- source_reference nullable
- verified boolean
- observed_at
- expires_at nullable
- created_at

### AgentSession
- id UUID
- customer_id nullable
- status
- created_at, updated_at

### AgentMessage
- id UUID
- session_id
- role `CUSTOMER` | `GHOST` | `SYSTEM`
- content_redacted
- intent nullable
- created_at

### ActionProposal
- id UUID
- session_id
- action_type
- canonical_payload_json
- payload_hash
- model_name nullable
- model_version nullable
- confidence nullable
- created_at

### Decision
- id UUID
- proposal_id
- policy_version
- outcome enum
- reason_codes string array
- checks_json
- risk_units
- customer_context_snapshot_json
- created_at
- correlation_id

### Approval
- id UUID
- decision_id
- payload_hash
- status `PENDING` | `APPROVED` | `REJECTED` | `EXPIRED` | `USED` | `REVOKED`
- requested_by
- decided_by nullable
- expires_at
- decided_at nullable
- created_at

### FinancialOperation
- id UUID
- proposal_id
- action_type
- amount_minor
- currency
- status `CREATED` | `AWAITING_APPROVAL` | `AUTHORIZED` | `SUBMITTED` | `PENDING_PROVIDER` | `COMPLETED` | `FAILED` | `BLOCKED` | `PENDING_RECONCILIATION` | `CANCELLED`
- idempotency_key unique
- paypal_order_id nullable
- paypal_capture_id nullable
- paypal_refund_id nullable
- provider_status nullable
- last_provider_check_at nullable
- created_at, updated_at

### BudgetLedgerEntry
- id UUID
- operation_id nullable
- customer_id nullable
- budget_type
- delta_minor or delta_units
- currency nullable
- reason_code
- created_at
- Immutable append-only ledger; aggregate from entries.

### AuditEvent
- id UUID
- actor_type `USER` | `SYSTEM` | `AI` | `PAYPAL_WEBHOOK`
- actor_id nullable
- event_type
- entity_type
- entity_id
- correlation_id
- payload_redacted_json
- created_at

### SimulationRun
- id UUID
- created_by
- baseline_policy_version
- proposed_policy_json
- fixture_set_version
- results_json
- status
- created_at

### RedTeamRun / RedTeamCaseResult
- run id, suite version, start/end time, status, initiated_by
- case id, expected outcome, actual outcome, pass boolean, evidence JSON, correlation ID

## 6. State machines
### Decision
`PROPOSED → EVALUATED → {BLOCKED, REVIEW, AWAITING_APPROVAL, AUTHORIZED, OBSERVE_ONLY, FROZEN}`

### Financial operation
`CREATED → AWAITING_APPROVAL → AUTHORIZED → SUBMITTED → {PENDING_PROVIDER, COMPLETED, FAILED, PENDING_RECONCILIATION}`

`BLOCKED` and `CANCELLED` are terminal for that operation. Do not change a terminal operation silently; create a new operation linked to the prior one if a new attempt is justified.

### Approval
`PENDING → {APPROVED, REJECTED, EXPIRED, REVOKED}`  
`APPROVED → USED` only after the approved action begins execution. Revalidation failure prevents execution and marks approval invalid/revoked with a reason.

## 7. Decision algorithm
Pseudo-flow:
1. Authenticate actor and resolve owner/account scope.
2. Validate request schema and canonicalize payload.
3. Load current active policy and settings from database.
4. If kill switch or Lockdown: return `FROZEN`.
5. If mode is Observe: evaluate and return `OBSERVE_ONLY`; do not call PayPal.
6. Validate action type is supported and explicitly enabled.
7. Validate currency, amount, product/order, customer identity, payment state, and required provider references.
8. Check per-action caps, discount cap, refund eligibility, daily aggregate budget, customer exposure, velocity, duplicate operation, and risk rules.
9. If missing/contradictory evidence: return `REVIEW`.
10. If a required approval is absent/invalid: create approval request and return `REQUIRE_APPROVAL`.
11. In Assist mode, require explicit approval even if policy checks pass.
12. In Autopilot mode, allow only if all checks pass and action is explicitly eligible for autonomous execution.
13. Reserve budget atomically and create operation with unique idempotency key.
14. Immediately before provider call, re-read freeze/mode/policy/approval and operation state.
15. Call PayPal server-side.
16. Persist provider reference/status; if ambiguous, set `PENDING_RECONCILIATION`.
17. Verify webhook/API result and update status idempotently.
18. Append audit events for all material transitions.

## 8. API contract
All routes are versioned under `/api/v1`. JSON requests/responses. Include `requestId`/correlation ID. Validate every body/query/path parameter. Return consistent errors:
```json
{
  "error": {
    "code": "DISCOUNT_EXCEEDS_LIMIT",
    "message": "Requested discount exceeds the current authorized limit.",
    "requestId": "uuid",
    "details": {"requestedBasisPoints": 2200, "maximumBasisPoints": 1500}
  }
}
```
Do not return secrets, stack traces, raw provider credentials, or unnecessary personal data.

### Authentication
- `POST /auth/login`
- `POST /auth/logout`
- `GET /auth/me`

### Dashboard and settings
- `GET /dashboard/summary`
- `GET /settings/ghost`
- `PATCH /settings/ghost/mode`
- `POST /settings/ghost/freeze`
- `POST /settings/ghost/unfreeze`
- `GET /authority/policies`
- `GET /authority/policies/:version`
- `POST /authority/policies/drafts`
- `PATCH /authority/policies/drafts/:id`
- `POST /authority/policies/drafts/:id/publish`

### Agent and decisions
- `POST /agent/sessions`
- `GET /agent/sessions/:id`
- `POST /agent/sessions/:id/messages`
- `GET /decisions/:id`

### Approvals
- `GET /approvals?status=pending`
- `POST /approvals/:id/approve`
- `POST /approvals/:id/reject`

### Transactions
- `GET /transactions`
- `GET /transactions/:id`
- `POST /transactions/:id/reconcile`
- `POST /transactions/:id/refund-proposal`

### Customers
- `GET /customers`
- `GET /customers/:id`
- `GET /customers/:id/history`

### Simulation and red team
- `POST /simulations`
- `GET /simulations/:id`
- `POST /simulations/:id/publish`
- `GET /red-team/suites`
- `POST /red-team/runs`
- `GET /red-team/runs/:id`

### PayPal webhooks
- `POST /webhooks/paypal` (no browser session auth; provider signature verification is mandatory)

## 9. Example action proposal schema
```json
{
  "actionType": "PURCHASE_CAPTURE",
  "customerId": "uuid",
  "orderId": "internal-order-uuid",
  "amountMinor": 4250000,
  "currency": "INR",
  "discountBasisPoints": 1000,
  "customerRationale": "Customer requested a discount",
  "missingFields": [],
  "confidence": 0.93
}
```
The server must verify all fields against internal/provider records. Values from the model are proposals, not truth.

## 10. Reason code catalogue
- `ACTION_NOT_ENABLED`
- `MODE_OBSERVE_ONLY`
- `GHOST_LOCKDOWN`
- `KILL_SWITCH_ACTIVE`
- `AMOUNT_EXCEEDS_LIMIT`
- `DISCOUNT_EXCEEDS_LIMIT`
- `REFUND_EXCEEDS_ELIGIBLE_AMOUNT`
- `PAYMENT_NOT_CAPTURED`
- `DAILY_BUDGET_EXCEEDED`
- `CUSTOMER_EXPOSURE_EXCEEDED`
- `VELOCITY_LIMIT_EXCEEDED`
- `DUPLICATE_OPERATION`
- `CUSTOMER_CONTEXT_UNVERIFIED`
- `RISK_REVIEW_REQUIRED`
- `APPROVAL_REQUIRED`
- `APPROVAL_EXPIRED`
- `APPROVAL_PAYLOAD_MISMATCH`
- `POLICY_CHANGED`
- `PROVIDER_STATUS_UNKNOWN`
- `PAYPAL_API_ERROR`
- `PAYPAL_WEBHOOK_UNVERIFIED`
- `IDEMPOTENCY_CONFLICT`

## 11. Security and threat model
Assets: payment execution authority, PayPal credentials, owner account, customer records, policy versions, audit integrity.

Threats and controls:
- Prompt injection → customer text treated as untrusted; deterministic policy gate.
- Forged owner approval → authenticated owner action only; customer messages never alter authority.
- IDOR → authorization and account scope checked on every resource.
- Duplicate requests → idempotency keys, uniqueness constraints, operation state machine.
- Concurrent budget overspend → transactional reservation/locking.
- Webhook spoofing/replay → signature verification, event ID deduplication, timestamp checks where supported.
- Stale approval → canonical payload hash and revalidation at execution.
- Secret leakage → server-only env vars, redacted logs, no secret in prompts.
- Audit tampering → append-only application behavior and restricted DB access.
- Denial of service → rate limits, request size caps, bounded AI calls.
- Provider outage → circuit breaker/backoff for safe reads; no blind financial retries.

## 12. Acceptance tests
1. Unauthenticated owner endpoint returns 401.
2. Operator cannot publish policy.
3. Discount 22% with max 15% never executes.
4. Payment above cap never calls PayPal.
5. Observe mode creates no provider call.
6. Assist mode does not execute before approval.
7. Expired approval cannot execute.
8. Modified approved payload cannot execute.
9. Kill switch blocks direct API execution.
10. Two concurrent actions cannot exceed daily aggregate budget.
11. Repeated identical request produces one financial operation.
12. Provider timeout sets reconciliation state and does not duplicate operation.
13. Invalid PayPal webhook signature is rejected and has no transaction effect.
14. Duplicate valid webhook does not duplicate state transition.
15. Simulation makes zero PayPal calls.
16. Red-team test result is based on actual evaluator output, not hard-coded pass.
17. Audit record includes policy version and reason codes.
18. Sensitive fields do not appear in logs or API errors.
19. Refund amount cannot exceed remaining refundable captured amount.
20. Currency mismatch is rejected.
