import { Router, Request, Response } from "express";
import { prisma } from "../repositories/prisma.js";
import { authMiddleware } from "../middleware/auth.js";

const router = Router();

router.get("/", authMiddleware, async (req: Request, res: Response) => {
  const customers = await prisma.customer.findMany({
    include: {
      facts: true,
      sessions: {
        take: 3,
        orderBy: { createdAt: "desc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const parsed = customers.map((c) => ({
    ...c,
    facts: c.facts.map((f: any) => ({
      ...f,
      value: JSON.parse(f.valueJson),
    })),
  }));

  res.json({ customers: parsed });
});

router.get("/:id", authMiddleware, async (req: Request, res: Response) => {
  const customerId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    include: {
      facts: true,
      sessions: {
        include: {
          messages: { orderBy: { createdAt: "asc" } },
          proposals: {
            include: {
              decisions: true,
              operations: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!customer) {
    res.status(404).json({ error: { code: "CUSTOMER_NOT_FOUND", message: "Customer not found." } });
    return;
  }

  res.json({
    customer: {
      ...customer,
      facts: customer.facts.map((f: any) => ({
        ...f,
        value: JSON.parse(f.valueJson),
      })),
    },
  });
});

export default router;
