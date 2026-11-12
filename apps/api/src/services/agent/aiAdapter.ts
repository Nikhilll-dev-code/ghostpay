import {
  ActionProposal,
  ACTION_TYPES,
  CustomerContext,
  actionProposalSchema,
} from "@ghost/shared";
import { config } from "../../config/index.js";
import { logger } from "../../utils/logger.js";

export interface IntentParseResult {
  intent: string;
  proposal: ActionProposal;
  customerRationale: string;
  missingInformation: string[];
  confidence: number;
}

export class AIAdapter {
  /**
   * Interprets untrusted customer request text and constructs a schema-validated ActionProposal.
   * If an external AI provider (Gemini / OpenAI) is configured, it calls the LLM with structured output;
   * otherwise, or on any error/timeout, it seamlessly uses the deterministic intent parser.
   */
  public static async interpretCustomerRequest(
    message: string,
    customerContext?: CustomerContext,
    orderId?: string
  ): Promise<IntentParseResult> {
    logger.info("Interpreting customer request", { messageLength: message.length, provider: config.AI_PROVIDER });

    // Attempt real LLM if configured and key is present
    if (config.AI_PROVIDER !== "mock" && config.AI_API_KEY) {
      try {
        const llmResult = await this.tryLLMInterpretation(message, customerContext, orderId);
        if (llmResult) return llmResult;
      } catch (err: any) {
        logger.warn("External LLM provider failed, falling back to deterministic parser", { error: err.message });
      }
    }

    return this.parseDeterministic(message, customerContext, orderId);
  }

  private static async tryLLMInterpretation(
    message: string,
    customerContext?: CustomerContext,
    orderId?: string
  ): Promise<IntentParseResult | null> {
    const systemPrompt = `You are Ghost Brain, an AI financial operations agent for a PayPal merchant.
Extract the customer's intent into a structured JSON action proposal.
Valid actionTypes: "PURCHASE_CAPTURE", "DISCOUNT_REQUEST", "REFUND_REQUEST", "PAYMENT_STATUS", "GENERAL_QUERY".
Output JSON matching:
{
  "intent": string,
  "actionType": "PURCHASE_CAPTURE" | "DISCOUNT_REQUEST" | "REFUND_REQUEST" | "PAYMENT_STATUS",
  "amountMinor": number (e.g. 5000 for $50.00),
  "currency": "USD",
  "discountBasisPoints": number (optional, e.g. 1500 for 15%),
  "orderId": string (optional),
  "captureId": string (optional),
  "confidence": number (between 0 and 1)
}`;

    if (config.AI_PROVIDER === "gemini") {
      const model = config.AI_MODEL || "gemini-1.5-flash";
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${config.AI_API_KEY}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${systemPrompt}\n\nCustomer Request: "${message}"` }] }],
          generationConfig: { responseMimeType: "application/json" },
        }),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as any;
      const jsonText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!jsonText) return null;
      const parsedJSON = JSON.parse(jsonText);
      const validatedProposal = actionProposalSchema.parse({
        actionType: parsedJSON.actionType || ACTION_TYPES.PURCHASE_CAPTURE,
        customerId: customerContext?.id,
        orderId: parsedJSON.orderId || orderId,
        captureId: parsedJSON.captureId,
        amountMinor: parsedJSON.amountMinor,
        currency: parsedJSON.currency || "USD",
        discountBasisPoints: parsedJSON.discountBasisPoints,
        rationale: message,
        missingFields: [],
        confidence: parsedJSON.confidence || 0.9,
      });
      return {
        intent: parsedJSON.intent || validatedProposal.actionType,
        proposal: validatedProposal,
        customerRationale: message,
        missingInformation: [],
        confidence: validatedProposal.confidence || 0.9,
      };
    }

    if (config.AI_PROVIDER === "openai") {
      const url = "https://api.openai.com/v1/chat/completions";
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.AI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: config.AI_MODEL || "gpt-4o-mini",
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `Customer Request: "${message}"` },
          ],
        }),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as any;
      const jsonText = data.choices?.[0]?.message?.content;
      if (!jsonText) return null;
      const parsedJSON = JSON.parse(jsonText);
      const validatedProposal = actionProposalSchema.parse({
        actionType: parsedJSON.actionType || ACTION_TYPES.PURCHASE_CAPTURE,
        customerId: customerContext?.id,
        orderId: parsedJSON.orderId || orderId,
        captureId: parsedJSON.captureId,
        amountMinor: parsedJSON.amountMinor,
        currency: parsedJSON.currency || "USD",
        discountBasisPoints: parsedJSON.discountBasisPoints,
        rationale: message,
        missingFields: [],
        confidence: parsedJSON.confidence || 0.9,
      });
      return {
        intent: parsedJSON.intent || validatedProposal.actionType,
        proposal: validatedProposal,
        customerRationale: message,
        missingInformation: [],
        confidence: validatedProposal.confidence || 0.9,
      };
    }

    return null;
  }

  private static parseDeterministic(
    message: string,
    customerContext?: CustomerContext,
    orderId?: string
  ): IntentParseResult {
    const trimmed = message.trim();
    const lower = trimmed.toLowerCase();

    // Check for Refund Request
    if (/refund|money back|return item|cancel order/i.test(lower)) {
      const amountMatch = lower.match(/\$?\s*(\d+(?:\.\d{1,2})?)/);
      const amountMinor = amountMatch ? Math.round(parseFloat(amountMatch[1]) * 100) : 2500;
      const captureMatch = lower.match(/(?:capture|order|payment)\s*#?\s*([a-zA-Z0-9_-]+)/i);

      const candidateProposal: ActionProposal = {
        actionType: ACTION_TYPES.REFUND_REQUEST,
        customerId: customerContext?.id,
        orderId: orderId || (captureMatch ? captureMatch[1] : undefined),
        captureId: captureMatch ? captureMatch[1] : undefined,
        amountMinor,
        currency: "USD",
        rationale: trimmed,
        missingFields: !orderId && !captureMatch ? ["captureId"] : [],
        confidence: 0.92,
      };

      const parsed = actionProposalSchema.parse(candidateProposal);
      return {
        intent: "REFUND_REQUEST",
        proposal: parsed,
        customerRationale: trimmed,
        missingInformation: parsed.missingFields,
        confidence: 0.92,
      };
    }

    // Check for Discount Request
    if (/discount|coupon|promo|off|deal|cheaper|reduction/i.test(lower)) {
      const pctMatch = lower.match(/(\d+(?:\.\d+)?)\s*%/);
      const discountBps = pctMatch ? Math.round(parseFloat(pctMatch[1]) * 100) : 1000;
      const amountMatch = lower.match(/\$?\s*(\d+(?:\.\d{1,2})?)/);
      const amountMinor = amountMatch ? Math.round(parseFloat(amountMatch[1]) * 100) : 5000;

      const candidateProposal: ActionProposal = {
        actionType: ACTION_TYPES.DISCOUNT_REQUEST,
        customerId: customerContext?.id,
        orderId,
        amountMinor,
        currency: "USD",
        discountBasisPoints: discountBps,
        rationale: trimmed,
        missingFields: [],
        confidence: 0.95,
      };

      const parsed = actionProposalSchema.parse(candidateProposal);
      return {
        intent: "DISCOUNT_REQUEST",
        proposal: parsed,
        customerRationale: trimmed,
        missingInformation: [],
        confidence: 0.95,
      };
    }

    // Check for Purchase / Order
    if (/buy|purchase|order|checkout|pay/i.test(lower)) {
      const amountMatch = lower.match(/\$?\s*(\d+(?:\.\d{1,2})?)/);
      const amountMinor = amountMatch ? Math.round(parseFloat(amountMatch[1]) * 100) : 4500;

      const candidateProposal: ActionProposal = {
        actionType: ACTION_TYPES.PURCHASE_CAPTURE,
        customerId: customerContext?.id,
        orderId,
        amountMinor,
        currency: "USD",
        discountBasisPoints: 0,
        rationale: trimmed,
        missingFields: [],
        confidence: 0.9,
      };

      const parsed = actionProposalSchema.parse(candidateProposal);
      return {
        intent: "PURCHASE",
        proposal: parsed,
        customerRationale: trimmed,
        missingInformation: [],
        confidence: 0.9,
      };
    }

    // Check for Payment Status query
    if (/status|where is my order|receipt|check payment/i.test(lower)) {
      const candidateProposal: ActionProposal = {
        actionType: ACTION_TYPES.PAYMENT_STATUS,
        customerId: customerContext?.id,
        orderId,
        rationale: trimmed,
        missingFields: [],
        confidence: 0.98,
      };

      const parsed = actionProposalSchema.parse(candidateProposal);
      return {
        intent: "PAYMENT_STATUS",
        proposal: parsed,
        customerRationale: trimmed,
        missingInformation: [],
        confidence: 0.98,
      };
    }

    // Default Fallback
    const candidateProposal: ActionProposal = {
      actionType: ACTION_TYPES.PURCHASE_CAPTURE,
      customerId: customerContext?.id,
      amountMinor: 1000,
      currency: "USD",
      rationale: trimmed,
      missingFields: ["actionType", "amount"],
      confidence: 0.4,
    };

    const parsed = actionProposalSchema.parse(candidateProposal);
    return {
      intent: "GENERAL_QUERY",
      proposal: parsed,
      customerRationale: trimmed,
      missingInformation: ["intent_unclear"],
      confidence: 0.4,
    };
  }
}
