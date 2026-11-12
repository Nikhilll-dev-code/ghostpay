import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import { config } from "./config/index.js";
import { correlationMiddleware } from "./middleware/correlation.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { prisma } from "./repositories/prisma.js";

import authRouter from "./routes/auth.js";
import settingsRouter from "./routes/settings.js";
import authorityRouter from "./routes/authority.js";
import dashboardRouter from "./routes/dashboard.js";
import agentRouter from "./routes/agent.js";
import approvalsRouter from "./routes/approvals.js";
import transactionsRouter from "./routes/transactions.js";
import customersRouter from "./routes/customers.js";
import simulationRouter from "./routes/simulation.js";
import redTeamRouter from "./routes/redTeam.js";
import auditRouter from "./routes/audit.js";
import webhooksRouter from "./routes/webhooks.js";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: [config.WEB_ORIGIN, "http://localhost:5173", "http://127.0.0.1:5173"],
      credentials: true,
    })
  );
  app.use(express.json());
  app.use(cookieParser());
  app.use(correlationMiddleware);

  // Health check endpoints
  app.get("/health/live", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  app.get("/health/ready", async (req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({
        status: "ready",
        database: "connected",
        environment: "PAYPAL_SANDBOX",
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      res.status(503).json({
        status: "unavailable",
        database: "disconnected",
        error: err.message,
      });
    }
  });

  // API v1 routes
  app.use("/api/v1/auth", authRouter);
  app.use("/api/v1/settings", settingsRouter);
  app.use("/api/v1/authority", authorityRouter);
  app.use("/api/v1/dashboard", dashboardRouter);
  app.use("/api/v1/agent", agentRouter);
  app.use("/api/v1/approvals", approvalsRouter);
  app.use("/api/v1/transactions", transactionsRouter);
  app.use("/api/v1/customers", customersRouter);
  app.use("/api/v1/simulations", simulationRouter);
  app.use("/api/v1/red-team", redTeamRouter);
  app.use("/api/v1/audit", auditRouter);
  app.use("/api/v1/webhooks", webhooksRouter);

  app.use(errorHandler);

  return app;
}
