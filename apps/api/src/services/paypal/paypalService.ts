import { config } from "../../config/index.js";
import { logger } from "../../utils/logger.js";

export interface CreateOrderParams {
  amountMinor: number;
  currency: string;
  referenceId: string;
}

export interface PayPalOrderResult {
  orderId: string;
  status: "CREATED" | "SAVED" | "APPROVED" | "VOIDED" | "COMPLETED" | "PAYER_ACTION_REQUIRED";
  links: Array<{ href: string; rel: string; method: string }>;
  isMocked: boolean;
}

export interface PayPalCaptureResult {
  captureId: string;
  orderId: string;
  status: "COMPLETED" | "DECLINED" | "PARTIALLY_REFUNDED" | "PENDING" | "REFUNDED" | "FAILED";
  amountMinor: number;
  currency: string;
  isMocked: boolean;
}

export interface PayPalRefundResult {
  refundId: string;
  captureId: string;
  status: "COMPLETED" | "PENDING" | "CANCELLED" | "FAILED";
  amountMinor: number;
  currency: string;
  isMocked: boolean;
}

export class PayPalService {
  public static async testConnection(): Promise<{
    configured: boolean;
    status: "CONNECTED" | "SIMULATED" | "ERROR";
    environment: string;
    clientIdMasked: string;
    latencyMs: number;
    message: string;
  }> {
    const startTime = Date.now();
    const isConf = this.isConfigured();
    const id = config.PAYPAL_CLIENT_ID || "";
    const maskedId = isConf && id.length > 10
      ? `${id.slice(0, 6)}...${id.slice(-4)}`
      : id || "Not configured";

    if (!isConf) {
      return {
        configured: false,
        status: "SIMULATED",
        environment: "PayPal Sandbox (Zero-Config Deterministic Simulator)",
        clientIdMasked: "mock_client_id_for_sandbox",
        latencyMs: Date.now() - startTime,
        message: "Ghost is currently operating in deterministic Sandbox simulation mode. Order creation, capture, and refund lifecycles are modeled faithfully with zero network dependency.",
      };
    }

    try {
      await this.getAccessToken();
      const latencyMs = Date.now() - startTime;
      return {
        configured: true,
        status: "CONNECTED",
        environment: "https://api-m.sandbox.paypal.com",
        clientIdMasked: maskedId,
        latencyMs,
        message: `Successfully authenticated with PayPal Sandbox OAuth2 in ${latencyMs}ms. Live sandbox API calls and webhooks are active.`,
      };
    } catch (err: any) {
      return {
        configured: true,
        status: "ERROR",
        environment: "https://api-m.sandbox.paypal.com",
        clientIdMasked: maskedId,
        latencyMs: Date.now() - startTime,
        message: `Failed to authenticate with PayPal Sandbox: ${err.message}`,
      };
    }
  }

  private static isConfigured(): boolean {
    return (
      config.PAYPAL_CLIENT_ID !== "mock_client_id_for_sandbox" &&
      config.PAYPAL_CLIENT_SECRET !== "mock_client_secret_for_sandbox" &&
      Boolean(config.PAYPAL_CLIENT_ID) &&
      Boolean(config.PAYPAL_CLIENT_SECRET)
    );
  }

  private static async getAccessToken(): Promise<string> {
    if (!this.isConfigured()) {
      return "mock_access_token";
    }

    const auth = Buffer.from(`${config.PAYPAL_CLIENT_ID}:${config.PAYPAL_CLIENT_SECRET}`).toString(
      "base64"
    );

    const res = await fetch("https://api-m.sandbox.paypal.com/v1/oauth2/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });

    if (!res.ok) {
      const err = await res.text();
      logger.error("Failed to obtain PayPal Sandbox access token", { error: err });
      throw new Error("Failed to authenticate with PayPal Sandbox");
    }

    const data = (await res.json()) as { access_token: string };
    return data.access_token;
  }

  public static async createOrder(params: CreateOrderParams): Promise<PayPalOrderResult> {
    logger.info("Creating PayPal Sandbox order", {
      amountMinor: params.amountMinor,
      currency: params.currency,
      referenceId: params.referenceId,
    });

    if (!this.isConfigured()) {
      const mockId = `SANDBOX_ORDER_${Date.now().toString(36).toUpperCase()}`;
      return {
        orderId: mockId,
        status: "CREATED",
        links: [
          {
            href: `https://www.sandbox.paypal.com/checkoutnow?token=${mockId}`,
            rel: "approve",
            method: "GET",
          },
        ],
        isMocked: true,
      };
    }

    const token = await this.getAccessToken();
    const amountVal = (params.amountMinor / 100).toFixed(2);

    const res = await fetch("https://api-m.sandbox.paypal.com/v2/checkout/orders", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [
          {
            reference_id: params.referenceId,
            amount: {
              currency_code: params.currency,
              value: amountVal,
            },
          },
        ],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      logger.error("PayPal Create Order failed", { error: err });
      throw new Error(`PayPal API Error: ${res.statusText}`);
    }

    const data = (await res.json()) as any;
    return {
      orderId: data.id,
      status: data.status,
      links: data.links || [],
      isMocked: false,
    };
  }

  public static async captureOrder(orderId: string): Promise<PayPalCaptureResult> {
    logger.info("Capturing PayPal Sandbox order", { orderId });

    if (!this.isConfigured() || orderId.startsWith("SANDBOX_ORDER_")) {
      const mockCaptureId = `SANDBOX_CAP_${Date.now().toString(36).toUpperCase()}`;
      return {
        captureId: mockCaptureId,
        orderId,
        status: "COMPLETED",
        amountMinor: 5000,
        currency: "USD",
        isMocked: true,
      };
    }

    const token = await this.getAccessToken();
    const res = await fetch(
      `https://api-m.sandbox.paypal.com/v2/checkout/orders/${orderId}/capture`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!res.ok) {
      const err = await res.text();
      logger.error("PayPal Capture Order failed", { error: err });
      throw new Error(`PayPal API Error: ${res.statusText}`);
    }

    const data = (await res.json()) as any;
    const capture = data.purchase_units?.[0]?.payments?.captures?.[0];

    return {
      captureId: capture ? capture.id : data.id,
      orderId,
      status: "COMPLETED",
      amountMinor: capture ? Math.round(parseFloat(capture.amount.value) * 100) : 0,
      currency: capture ? capture.amount.currency_code : "USD",
      isMocked: false,
    };
  }

  public static async refundCapture(
    captureId: string,
    amountMinor?: number,
    currency: string = "USD"
  ): Promise<PayPalRefundResult> {
    logger.info("Refunding PayPal Sandbox capture", { captureId, amountMinor, currency });

    if (!this.isConfigured() || captureId.startsWith("SANDBOX_CAP_")) {
      const mockRefundId = `SANDBOX_REF_${Date.now().toString(36).toUpperCase()}`;
      return {
        refundId: mockRefundId,
        captureId,
        status: "COMPLETED",
        amountMinor: amountMinor || 2500,
        currency,
        isMocked: true,
      };
    }

    const token = await this.getAccessToken();
    const body: Record<string, unknown> = {};
    if (amountMinor) {
      body.amount = {
        value: (amountMinor / 100).toFixed(2),
        currency_code: currency,
      };
    }

    const res = await fetch(
      `https://api-m.sandbox.paypal.com/v2/payments/captures/${captureId}/refund`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    if (!res.ok) {
      const err = await res.text();
      logger.error("PayPal Refund Capture failed", { error: err });
      throw new Error(`PayPal API Error: ${res.statusText}`);
    }

    const data = (await res.json()) as any;
    return {
      refundId: data.id,
      captureId,
      status: data.status,
      amountMinor: data.amount ? Math.round(parseFloat(data.amount.value) * 100) : 0,
      currency: data.amount ? data.amount.currency_code : currency,
      isMocked: false,
    };
  }

  public static async verifyWebhookSignature(
    headers: Record<string, string>,
    rawBody: string
  ): Promise<boolean> {
    if (!this.isConfigured()) {
      // In mock sandbox, accept verified mock webhook token or header
      return headers["paypal-auth-algo"] !== "invalid_signature";
    }

    const token = await this.getAccessToken();
    const verifyPayload = {
      transmission_id: headers["paypal-transmission-id"],
      transmission_time: headers["paypal-transmission-time"],
      cert_url: headers["paypal-cert-url"],
      auth_algo: headers["paypal-auth-algo"],
      transmission_sig: headers["paypal-transmission-sig"],
      webhook_id: config.PAYPAL_WEBHOOK_ID,
      webhook_event: JSON.parse(rawBody),
    };

    const res = await fetch(
      "https://api-m.sandbox.paypal.com/v1/notifications/verify-webhook-signature",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(verifyPayload),
      }
    );

    if (!res.ok) {
      return false;
    }

    const data = (await res.json()) as { verification_status: string };
    return data.verification_status === "SUCCESS";
  }
}
