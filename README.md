# Ghost 3.0 — Policy-Governed AI Financial Operations Agent

Ghost 3.0 is an enterprise-grade financial operations agent designed for small businesses and merchants. It interprets customer requests (purchases, discounts, and refunds), checks context against an immutable, business-defined **Authority Passport**, and uses a **deterministic Trust Engine** to either recommend, escalate, block, or execute explicitly authorized actions in **PayPal Sandbox**.

---

## 🛡️ Core Principles: Bounded Autonomy

1. **AI Proposes; Deterministic Policy Disposes:** An LLM or intent parser generates structured action proposals only. It cannot alter policy, grant itself authority, or directly initiate PayPal transactions.
2. **Default Deny:** Stale, conflicting, unverified, or out-of-bounds requests result in immediate block or human review.
3. **Server-Side Security Boundary:** Authority limits, operating modes, and the emergency kill-switch are strictly enforced in backend services and database transactions.
4. **Cryptographically-Bound Approvals:** Human approvals bind to a SHA-256 canonical payload hash, are single-use, and expire.
5. **Safe Failure & Idempotency:** Uncertain provider network outcomes enter `PENDING_RECONCILIATION`; duplicate requests never duplicate money movement.
6. **Zero Fabricated Claims:** All synthetic demo data and simulations are explicitly labeled.

---

## 🏛️ Architecture & Repository Structure

```text
ghost-monorepo/
├── apps/
│   ├── api/                     # Node.js + Express + TypeScript Backend
│   │   ├── src/
│   │   │   ├── config/          # Zod-validated environment config
│   │   │   ├── middleware/      # Auth, correlation, owner check, error handler
│   │   │   ├── repositories/    # Prisma client singleton
│   │   │   ├── routes/          # Express route controllers
│   │   │   ├── services/
│   │   │   │   ├── agent/       # AI intent parser & ActionProposal generator
│   │   │   │   ├── approvals/   # Hash-bound approval lifecycle service
│   │   │   │   ├── audit/       # Append-only audit logger with redaction
│   │   │   │   ├── paypal/      # PayPal Sandbox REST client & verification
│   │   │   │   ├── policy/      # Pure deterministic Trust Engine
│   │   │   │   ├── red-team/    # Ghostbreaker 10-vector attack suite
│   │   │   │   ├── risk/        # Contextual risk rule engine
│   │   │   │   └── simulation/  # What-If deterministic fixture replay
│   │   │   └── utils/           # Crypto, hashing, structured logger
│   └── web/                     # React 18 + Vite + TypeScript + Tailwind CSS Frontend
│       ├── src/
│       │   ├── api/             # Typed API client with JWT handling
│       │   ├── components/      # Global Header, Sidebar, FreezeModal
│       │   ├── context/         # AuthContext & Ghost state
│       │   └── views/           # 10 Control Room views
├── packages/
│   └── shared/                  # Shared TypeScript types, Zod schemas, constants
├── prisma/
│   ├── schema.prisma            # Relational database schema
│   ├── seed.ts                  # Deterministic database seeding script
│   └── dev.db                   # SQLite database (zero-configuration local storage)
├── .env.example                 # Example configuration placeholders
└── package.json                 # Monorepo root workspace configuration
```

---

## ⚙️ Quickstart & Local Setup

### 1. Prerequisites
- **Node.js**: v18+ (tested on Node v22)
- **npm**: v9+ (tested on npm 10.9)

### 2. Install Dependencies
```bash
npm install
```

### 3. Initialize & Seed Database
```bash
npm run db:push
npm run db:seed
```
This initializes the SQLite database with:
- **Owner Account**: `owner@ghost.finance` / `ghostpassword123`
- **Operator Account**: `operator@ghost.finance` / `operatorpassword123`
- **Authority Passport (v1)**: 15% max discount, $500 payment cap, $250 refund cap, $2000 daily exposure
- **3 Demo Customers**: Alice Smith (VIP), Bob Miller (Standard), Charlie Newcomer (Unverified)
- **Pre-seeded Captured Transaction**: Ready for refund testing (`SANDBOX_CAP_DEMO1`)

### 4. Build Monorepo
```bash
npm run build
```

### 5. Start Development Servers
Run the API (port 4000) and Web Frontend (port 5173) concurrently:
```bash
npm run dev:api    # Starts API on http://localhost:4000
npm run dev:web    # Starts Web Frontend on http://localhost:5173
```

---

## 🧪 Testing & Verification

Run all unit and integration test suites:
```bash
npm test
```

### Test Suites Included:
- **`packages/shared`**: Canonical JSON serialization stability and Zod schema validations.
- **`apps/api (PolicyEngine)`**:
  - Discount boundary verification (15% passes, 22% blocked).
  - Per-action payment cap enforcement ($150 passes, $600 blocked).
  - Kill-switch priority check (`KILL_SWITCH_ACTIVE` -> `FROZEN`).
  - Lockdown mode check (`GHOST_LOCKDOWN` -> `FROZEN`).
  - Strict prohibition of arbitrary money transfers (`ACTION_NOT_ENABLED`).
  - Assist mode approval gate (`APPROVAL_REQUIRED`).
- **`apps/api (Integration)`**:
  - Health checks (`/health/live`, `/health/ready`).
  - Protected endpoint authentication verification (401 on missing token).
  - Role-based login and JWT issuance.

---

## 🎯 10 Ghostbreaker Red-Team Attack Vectors

Ghost 3.0 includes an automated, evidence-backed red-team test suite accessible directly from the UI or API:
1. **Out-of-Authority Discount**: 22% requested against 15% cap → `BLOCK` (`DISCOUNT_EXCEEDS_LIMIT`)
2. **Amount Cap Breach**: $1,000 requested against $500 cap → `BLOCK` (`AMOUNT_EXCEEDS_LIMIT`)
3. **Social Engineering Bypass**: "Owner verbally approved this" in customer text → `BLOCK` (`RISK_REVIEW_REQUIRED`)
4. **Phantom / Uncaptured Refund**: Refund requested without valid capture → `BLOCK` (`PAYMENT_NOT_CAPTURED`)
5. **Split-Transaction Exhaustion**: Rapid transactions exceeding daily limit → `BLOCK` (`DAILY_BUDGET_EXCEEDED`)
6. **Execution Under Lockdown**: Operation triggered while Ghost is in Lockdown → `FROZEN` (`GHOST_LOCKDOWN`)
7. **Stale / Expired Approval Replay**: Execution attempted with expired approval → `BLOCK` (`APPROVAL_EXPIRED`)
8. **Tampered Payload Substitution**: Approved for $30, sent for $300 → `BLOCK` (`APPROVAL_PAYLOAD_MISMATCH`)
9. **Direct Prompt Injection**: Untrusted system override commands in text → `BLOCK` (`DISCOUNT_EXCEEDS_LIMIT`)
10. **Prohibited Money Transfer**: Direct transfer execution attempt → `BLOCK` (`ACTION_NOT_ENABLED`)

---

## 💳 PayPal Sandbox Integration Details

Ghost operates in **PayPal Sandbox** mode:
- **Client Configuration**: Set `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET` in `.env` to connect live Sandbox test accounts.
- **Mock Fallback**: If Sandbox credentials are not provided or remain placeholders, Ghost runs in deterministic sandbox simulation mode with explicit `[SANDBOX_MOCK]` labels, generating verifiable order, capture, and refund lifecycle records.
- **Webhook Verification**: Validates incoming PayPal webhooks cryptographically and deduplicates events idempotently.

---

## 🎥 2-Minute Demo Video & Screenshots

- **Full HD 1080p MP4 Screen Recording**: [docs/demo_video.mp4](file:///C:/Users/Srinivas/Desktop/ppl/docs/demo_video.mp4) (2.31 MB, ~2 minutes duration, universal H.264 playback)
- **13 High-Resolution Screenshots**: [docs/demo_screenshots/](file:///C:/Users/Srinivas/Desktop/ppl/docs/demo_screenshots)

---

## 📋 Evaluation Demo Runbook (5-Minute Tour)

Judges can also click the **Judge Guide** button in the top navigation bar at any time to open the interactive in-app demo guide.

1. **Sign In**: Log in as `owner@ghost.finance` (`ghostpassword123`) using 1-click prefilled demo buttons on `#/signin`.
2. **Review Authority Passport**: Observe baseline Authority Passport v1 with 15% discount cap.
3. **Execute Eligible Purchase**: Open **Ghost Brain**, select Alice Smith, click Preset 1 (10% discount on $45), evaluate in Trust Engine, and execute in PayPal Sandbox. Observe verified capture ID and order receipt.
4. **Attempt Out-of-Authority Request**: In Ghost Brain, click Preset 2 (22% discount on $120). Observe Trust Engine immediately blocks the request with `DISCOUNT_EXCEEDS_LIMIT`. No provider call is made.
5. **Emergency Freeze**: Click the red **FREEZE GHOST** button in the header, enter an incident reason, and engage the kill-switch. Attempt any action to verify server-side rejection with `KILL_SWITCH_ACTIVE`. Disengage when ready.
6. **Execute Ghostbreaker Suite**: Open the **Ghostbreaker** tab and click *Execute Ghostbreaker Suite*. Observe all 10 adversarial attacks executed with verifiable evidence.
7. **What-If Lab**: Open **What-If Lab**, adjust proposed discount cap to 25%, and run simulation replay. Compare allowed/blocked deltas across synthetic fixtures with zero live money movement.
8. **Inspect & Export Audit Trail**: Open **Audit Trail** to inspect the append-only log with correlation IDs and redacted payloads. Click **Export evidence bundle** to download a verifiable JSON compliance manifest.
9. **Test PayPal Sandbox & Webhooks**: In **Settings**, test live PayPal Sandbox OAuth2 connectivity or trigger simulated PayPal Webhook events (`PAYMENT.CAPTURE.COMPLETED`, `PAYMENT.CAPTURE.REFUNDED`) to verify automated ledger reconciliation.


## Interface refresh (design system and new screens)

The web app follows the visual rules in the supplied SKILL.md. Nothing in the API, the shared schemas, the Prisma schema or the policy engine changed, so every security rule above still holds as before.

What is new in the interface:

- A public landing page at `#/`, a sign in page at `#/signin`, privacy and terms pages, and a 404 page. Signed in users go straight to `#/app/overview`.
- Every app screen now has a deep link, for example `#/app/transactions?status=PENDING_RECONCILIATION` or `#/app/audit?q=<decision id>`.
- A persistent safety bar under the header: operating mode, active policy version, kill switch state, pending approvals and reconciliation items. The Freeze Ghost button is always visible, including on phones.
- Overview now has an operational safety summary and a Needs attention panel (approvals about to expire, stale policy warnings, transactions pending reconciliation) with links to the evidence.
- Quick navigation with `Ctrl+K` or `Cmd+K`. It only navigates and filters. It cannot approve, execute or change anything.
- Dialogs replace every browser `alert` and `prompt`: refund amount, approve or reject, policy publishing (with a before and after table) and the kill switch.
- Ghostbreaker failures, blocked actions, pending reconciliation and degraded backend states are always shown, never hidden.

Design rules in code: tokens live in `apps/web/tailwind.config.js`, named text styles and components in `apps/web/src/index.css`. Run `npm run lint:design` to check the spacing scale, icon library, gradient and copy rules. It also runs as part of `npm run build:web`.

Tests: `npm run test:web` runs the interface tests (routing, formatting, expiry logic, dialog focus trap, toast, command palette, landing page). `npm test` runs shared, API and web tests.

Demo credentials are still prefilled on the sign in page for the hackathon. Remove them before any shared deployment.
