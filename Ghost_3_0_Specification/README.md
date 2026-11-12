# Ghost 3.0 Specification Pack

This folder contains implementation-oriented requirements for building Ghost 3.0.

## Files
- `00_MASTER_BUILD_GUIDE.md` — overall vision, architecture, guardrails, build-agent protocol.
- `01_PRD.md` — product scope, user journeys, module requirements, success criteria.
- `02_SRS.md` — functional/non-functional requirements, data model, state machines, APIs, security, acceptance tests.
- `03_UI_UX_SPEC.md` — navigation, visual system, screen-level behaviors, responsive/accessibility rules.
- `04_IMPLEMENTATION_PLAN.md` — architecture, milestones, integration, test plan, deployment, demo runbook.

## Recommended use with an AI coding agent
1. Give the agent the complete folder or ZIP.
2. Ask it to read all documents before editing code.
3. Ask it to inspect the existing repository and produce a gap analysis plus phased task checklist.
4. Instruct it to implement one milestone at a time and run tests after each milestone.
5. Require evidence for PayPal Sandbox claims. Mocked activity must always be labeled as mocked.
6. Do not allow the agent to skip server-side policy checks, idempotency, webhook verification, or kill-switch enforcement for the sake of visual polish.

## Important implementation assumptions
- PayPal Sandbox only; production transactions are out of scope.
- React + TypeScript + Vite frontend, Node/Express + TypeScript backend, PostgreSQL + Prisma.
- One owner role is sufficient for the initial MVP; operator role can be added later.
- AI provider is abstracted behind an adapter; policy enforcement is deterministic.
- Transfers are not assumed supported. Enable only if the exact PayPal product/API and use case are separately verified.
- All demo/synthetic data must be labeled.
