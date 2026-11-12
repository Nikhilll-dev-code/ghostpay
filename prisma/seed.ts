import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // 1. Clean existing records (for idempotent re-seed)
  await prisma.redTeamCaseResult.deleteMany();
  await prisma.redTeamRun.deleteMany();
  await prisma.simulationRun.deleteMany();
  await prisma.auditEvent.deleteMany();
  await prisma.budgetLedgerEntry.deleteMany();
  await prisma.financialOperation.deleteMany();
  await prisma.approval.deleteMany();
  await prisma.decision.deleteMany();
  await prisma.actionProposal.deleteMany();
  await prisma.agentMessage.deleteMany();
  await prisma.agentSession.deleteMany();
  await prisma.customerFact.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.authorityPolicy.deleteMany();
  await prisma.ghostSettings.deleteMany();
  await prisma.user.deleteMany();

  // 2. Users
  const passwordHash = await bcrypt.hash("ghostpassword123", 10);
  const owner = await prisma.user.create({
    data: {
      email: "owner@ghost.finance",
      passwordHash,
      role: "OWNER",
      status: "ACTIVE",
    },
  });

  const operator = await prisma.user.create({
    data: {
      email: "operator@ghost.finance",
      passwordHash: await bcrypt.hash("operatorpassword123", 10),
      role: "OPERATOR",
      status: "ACTIVE",
    },
  });

  console.log(`Created users: ${owner.email} (Owner), ${operator.email} (Operator)`);

  // 3. Ghost Settings
  const settings = await prisma.ghostSettings.create({
    data: {
      mode: "ASSIST",
      killSwitchEnabled: false,
      killSwitchReason: null,
      updatedBy: owner.id,
      version: 1,
    },
  });

  console.log(`Initialized GhostSettings: Mode=${settings.mode}, KillSwitch=${settings.killSwitchEnabled}`);

  // 4. Initial Authority Policy (Version 1)
  const policy = await prisma.authorityPolicy.create({
    data: {
      version: 1,
      status: "ACTIVE",
      actionPermissionsJson: JSON.stringify({
        orderCreation: true,
        orderCapture: true,
        refunds: true,
        discounts: true,
        transfers: false, // Strictly false
      }),
      maxPaymentMinor: 50000,         // $500.00
      maxRefundMinor: 25000,          // $250.00
      maxDiscountBasisPoints: 1500,    // 15.00% cap
      dailyExposureMinor: 200000,      // $2,000.00 daily limit
      maxCustomerExposureMinor: 100000,// $1,000.00 customer cap
      maxActionsPerMinute: 10,
      riskBudgetUnits: 100,
      riskRulesJson: JSON.stringify([
        {
          id: "RISK_NEW_CUSTOMER_REFUND",
          name: "New Customer Refund",
          description: "Customer has 1 or fewer verified purchases requesting refund",
          condition: "verifiedPurchaseCount <= 1 && actionType == REFUND_REQUEST",
          riskUnits: 30,
          actionOnTrigger: "REQUIRE_APPROVAL",
        },
        {
          id: "RISK_OPEN_DISPUTES",
          name: "Open Disputes Alert",
          description: "Customer has unresolved payment disputes",
          condition: "openDisputesCount > 0",
          riskUnits: 40,
          actionOnTrigger: "REQUIRE_APPROVAL",
        },
        {
          id: "RISK_ANOMALOUS_DISCOUNT",
          name: "Anomalous Discount Request",
          description: "Discount exceeds twice the customer's typical discount history",
          condition: "discountBasisPoints > typicalDiscountBasisPoints * 2",
          riskUnits: 25,
          actionOnTrigger: "REQUIRE_APPROVAL",
        },
        {
          id: "RISK_PROMPT_INJECTION_SIGNAL",
          name: "Untrusted Authority Claim Detected",
          description: "Customer text contains claims of verbal or external policy override",
          condition: "untrusted_bypass_claim",
          riskUnits: 50,
          actionOnTrigger: "BLOCK",
        },
      ]),
      createdBy: owner.id,
      publishedAt: new Date(),
      changeReason: "Initial baseline Authority Passport (Version 1)",
    },
  });

  console.log(`Created baseline AuthorityPolicy v${policy.version}`);

  // 5. Pre-seeded Customers
  const alice = await prisma.customer.create({
    data: {
      displayName: "Alice Smith (Verified VIP)",
      email: "alice@example.com",
      externalReference: "CUST-EXT-001",
    },
  });

  await prisma.customerFact.create({
    data: {
      customerId: alice.id,
      factType: "VERIFIED_SPEND_TIER",
      valueJson: JSON.stringify({ tier: "GOLD", verifiedSpendMinor: 25000, totalPurchases: 5 }),
      sourceType: "VERIFIED_PROVIDER",
      sourceReference: "PAYPAL_SANDBOX_SETTLED_BATCH",
      verified: true,
    },
  });

  const bob = await prisma.customer.create({
    data: {
      displayName: "Bob Miller (Standard Buyer)",
      email: "bob@example.com",
      externalReference: "CUST-EXT-002",
    },
  });

  await prisma.customerFact.create({
    data: {
      customerId: bob.id,
      factType: "AVERAGE_ORDER_VALUE",
      valueJson: JSON.stringify({ aovMinor: 5000, purchaseCount: 2 }),
      sourceType: "INTERNAL_RECORD",
      sourceReference: "ORDER_HISTORY",
      verified: true,
    },
  });

  const charlie = await prisma.customer.create({
    data: {
      displayName: "Charlie Newcomer (New User)",
      email: "charlie@example.com",
      externalReference: "CUST-EXT-003",
    },
  });

  await prisma.customerFact.create({
    data: {
      customerId: charlie.id,
      factType: "CUSTOMER_SELF_CLAIM",
      valueJson: JSON.stringify({ claim: "Requested 30% discount stating executive privilege" }),
      sourceType: "CUSTOMER_CLAIM",
      sourceReference: "CHAT_MESSAGE_01",
      verified: false, // Explicitly marked unverified!
    },
  });

  // 6. Pre-seeded Verified Captured Transaction for Refund Testing
  const seededOp = await prisma.financialOperation.create({
    data: {
      actionType: "PURCHASE_CAPTURE",
      amountMinor: 7500, // $75.00
      currency: "USD",
      status: "COMPLETED",
      idempotencyKey: "DEMO_SEED_CAPTURE_001",
      paypalOrderId: "SANDBOX_ORDER_DEMO1",
      paypalCaptureId: "SANDBOX_CAP_DEMO1",
      providerStatus: "COMPLETED",
      lastProviderCheckAt: new Date(),
    },
  });

  // Budget entry for the seeded operation
  await prisma.budgetLedgerEntry.create({
    data: {
      operationId: seededOp.id,
      customerId: alice.id,
      budgetType: "DAILY_EXPOSURE",
      deltaMinor: 7500,
      currency: "USD",
      reasonCode: "PURCHASE_CAPTURE_SETTLED",
    },
  });

  // 7. Initial Audit Log
  await prisma.auditEvent.create({
    data: {
      actorType: "SYSTEM",
      actorId: owner.id,
      eventType: "SYSTEM_INITIALIZED",
      entityType: "SYSTEM",
      entityId: "ghost-3.0",
      correlationId: "seed-init-001",
      payloadRedactedJson: JSON.stringify({
        message: "Ghost 3.0 initialized with baseline Authority Passport v1 and Assist mode.",
        environment: "PAYPAL_SANDBOX",
      }),
    },
  });

  console.log("Seeding completed successfully!");
}

main()
  .catch((e) => {
    console.error("Seeding error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
