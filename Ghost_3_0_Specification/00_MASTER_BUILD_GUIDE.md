# Ghost 3.0 — Master Build Guide
**Version:** 1.0  
**Purpose:** Single entry point for any AI coding agent implementing Ghost 3.0.

## 1. Product in one sentence
Ghost is a policy-governed AI financial operations agent that can interpret customer requests, recommend or execute explicitly authorized actions through PayPal Sandbox, and produce verifiable evidence for every decision.

## 2. Non-negotiable product principles
1. **AI proposes; deterministic policy code disposes.** An LLM must never decide its own permissions or directly call PayPal.
2. **Default deny.** Any missing, malformed, stale, contradictory, or unavailable authorization/risk input must result in block or human review, never silent approval.
3. **Sandbox first.** The default environment is PayPal Sandbox. No production-money support is part of the MVP.
4. **Evidence over generated explanations.** Decision explanations must be generated from recorded policy checks and source facts, not invented by the LLM.
5. **Server-side enforcement.** UI controls are not security boundaries. All execution gates live on the backend.
6. **Human approval is explicit.** Approval must be authenticated, bound to a specific action payload, expire, and be single-use.
7. **Idempotent execution.** Retries must not create duplicate captures/refunds.
8. **Safe failure.** If PayPal status is uncertain, mark the operation `PENDING_RECONCILIATION`; never assume success or automatically issue a second payment.
9. **Auditable changes.** Authority, mode, kill-switch, approvals, policy changes, and transaction state transitions are audit logged.
10. **No fabricated metrics.** Forecasts and demo data must be labeled as estimates or synthetic data.

## 3. Read these documents in order
1. `01_PRD.md` — product goals, personas, scope, workflows, acceptance criteria.
2. `02_SRS.md` — detailed functional and non-functional requirements, domain model, state machines, API contracts, security requirements.
3. `03_UI_UX_SPEC.md` — design system, navigation, screens, interaction details, responsive behavior, accessibility.
4. `04_IMPLEMENTATION_PLAN.md` — architecture, repository layout, implementation phases, test plan, local setup, deployment, agent instructions.

## 4. Recommended stack
Use this stack unless the project repository already has a working stack that should be preserved:
- Frontend: React + TypeScript + Vite.
- UI: Tailwind CSS, shadcn/ui or equivalent accessible primitives, Lucide icons.
- Backend: Node.js LTS + TypeScript + Express.
- Database: PostgreSQL for persistent transactional records; Prisma ORM.
- Background jobs: database-backed job table/worker for MVP. Avoid introducing Redis unless required.
- Validation: Zod at all API boundaries.
- Authentication: secure server sessions or short-lived JWT plus rotating refresh tokens; prefer secure, HttpOnly, SameSite cookies for browser sessions.
- Testing: Vitest, React Testing Library, Supertest, Playwright.
- PayPal: official Checkout/Orders API and Payments API through server-side SDK/REST calls; Sandbox credentials only.
- AI: provider-agnostic adapter. The model returns structured proposals only. The policy engine remains deterministic.
- Logging: structured JSON logs with correlation IDs; redact credentials, payment details, and personal data.

## 5. Suggested repository layout
```text
ghost/
  apps/
    web/
      src/
        app/
        components/
        features/
          dashboard/
          agent/
          authority/
          transactions/
          approvals/
          customers/
          simulator/
          red-team/
          audit/
          settings/
        lib/
        styles/
    api/
      src/
        config/
        middleware/
        routes/
        services/
          agent/
          policy/
          risk/
          paypal/
          approvals/
          audit/
          simulation/
          red-team/
        repositories/
        jobs/
        schemas/
        utils/
  packages/
    shared/
      src/
        types/
        schemas/
        constants/
  prisma/
    schema.prisma
    migrations/
  tests/
    e2e/
    fixtures/
  docs/
  .env.example
  README.md
```

## 6. MVP boundaries
### Must ship
- Sign-in and one owner/admin role.
- Dashboard and transaction feed.
- Authority Passport and immutable policy versioning.
- Ghost modes: Observe, Assist, Autopilot, Lockdown.
- Kill switch enforced server-side.
- Structured AI request interpretation.
- Deterministic policy checks and explainable decision cards.
- PayPal Sandbox order/capture and eligible refund flow.
- Customer history with provenance.
- Human approval queue.
- Audit trail.
- What-If simulation using historical/synthetic fixtures without external execution.
- Ghostbreaker red-team tests.
- Tests for policy enforcement, idempotency, approval binding, kill switch, and webhook verification.

### Defer until the core is reliable
- Multiple organizations/complex multi-tenancy.
- Real-money/production PayPal transactions.
- Autonomous modification of authority.
- ML-trained fraud scoring.
- Complex multi-agent orchestration.
- Native mobile apps.
- Real-time collaborative editing.
- Claims of regulatory certification or fraud prevention.

## 7. Agent execution protocol
The coding agent must:
1. Inspect the repository before changing it. Preserve existing working code where sensible.
2. Read all four specification documents.
3. Create a task checklist and identify assumptions before implementation.
4. Build a vertical slice first: authenticated owner → customer request → structured proposal → policy decision → approval or Sandbox action → verified status → audit event.
5. Implement and test backend authorization before building visual polish.
6. Use migrations and seed data. Never rely on in-memory state for security controls or transaction records.
7. Keep provider secrets server-side and add `.env.example` with placeholders only.
8. Add automated tests alongside every feature.
9. Run lint, typecheck, unit tests, integration tests, and available E2E tests after each milestone.
10. Never claim an integration works unless tested against PayPal Sandbox or clearly label it as mocked.
11. Document commands, env variables, test results, and remaining limitations.
12. Do not silently remove requirements. If a requirement cannot be completed, document why and provide a safe fallback.

## 8. Definition of done
A feature is done only when:
- The UI supports the intended workflow and has loading, empty, error, success, and permission-denied states.
- The backend enforces the requirement independent of UI.
- Input is validated and errors are safe and actionable.
- Important state transitions create audit records.
- Tests cover normal, boundary, adversarial, and failure cases.
- The README documents setup and verification.
- No secrets or personal payment data are committed.
- Demo data is clearly marked as synthetic.
