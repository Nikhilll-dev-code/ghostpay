import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { createApp } from "./app.js";

const app = createApp();

describe("Ghost 3.0 API Endpoints", () => {
  it("GET /health/live returns ok", async () => {
    const res = await request(app).get("/health/live");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });

  it("GET /health/ready returns database connected and PayPal Sandbox", async () => {
    const res = await request(app).get("/health/ready");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ready");
    expect(res.body.environment).toBe("PAYPAL_SANDBOX");
  });

  it("Protected endpoint returns 401 when unauthenticated", async () => {
    const res = await request(app).get("/api/v1/dashboard/summary");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("Owner login returns JWT token and user profile", async () => {
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "owner@ghost.finance", password: "ghostpassword123" });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.role).toBe("OWNER");
  });

  it("Unregistered or wrong password returns 401", async () => {
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "owner@ghost.finance", password: "wrong_password" });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("INVALID_CREDENTIALS");
  });
});
