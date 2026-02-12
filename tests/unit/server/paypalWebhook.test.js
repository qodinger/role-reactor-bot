import { vi, describe, it, expect, beforeEach } from "vitest";
import { handlePayPalWebhook } from "../../../src/webhooks/paypal.js";

// Mock dependencies
vi.mock("../../../src/utils/logger.js", () => ({
  getLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

const mockStorageData = new Map();
vi.mock("../../../src/utils/storage/storageManager.js", () => ({
  getStorageManager: vi.fn().mockResolvedValue({
    get: vi.fn(key => Promise.resolve(mockStorageData.get(key))),
    set: vi.fn((key, data) => {
      mockStorageData.set(key, data);
      return Promise.resolve();
    }),
    getCoreCredits: vi.fn(userId => {
      const credits = mockStorageData.get("core_credit") || {};
      return Promise.resolve(credits[userId] || null);
    }),
    setCoreCredits: vi.fn((userId, data) => {
      const credits = mockStorageData.get("core_credit") || {};
      credits[userId] = data;
      mockStorageData.set("core_credit", credits);
      return Promise.resolve();
    }),
  }),
}));

vi.mock("../../../src/utils/storage/databaseManager.js", () => ({
  getDatabaseManager: vi.fn().mockResolvedValue({
    payments: {
      create: vi.fn(),
      isProcessed: vi.fn().mockResolvedValue(false),
    },
    users: {
      findByEmail: vi.fn(),
    },
  }),
}));

describe("PayPal Webhook Handler", () => {
  let req, res;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock request and response objects
    req = {
      method: "POST",
      url: "/webhook/paypal",
      headers: {
        "paypal-transmission-id": "test-id",
        "paypal-transmission-time": new Date().toISOString(),
        "paypal-transmission-sig": "test-sig",
        "paypal-cert-url": "test-url",
        "paypal-auth-algo": "test-algo",
      },
      body: {
        id: "WH-TEST",
        event_type: "PAYMENT.CAPTURE.COMPLETED",
        resource: {
          id: "CAP-TEST",
          status: "COMPLETED",
          amount: { value: "10.00", currency_code: "USD" },
          custom_id: "1234567890",
        },
      },
      ip: "127.0.0.1",
    };

    res = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };

    // Set environment variables for testing
    process.env.PAYPAL_MODE = "sandbox";
    process.env.NODE_ENV = "development";
    delete process.env.PAYPAL_WEBHOOK_ID;
  });

  it("should handle GET requests with 200 OK", async () => {
    req.method = "GET";
    await handlePayPalWebhook(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith("OK");
  });

  it("should reject non-POST requests with 405", async () => {
    req.method = "PUT";
    await handlePayPalWebhook(req, res);
    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.send).toHaveBeenCalledWith("Method Not Allowed");
  });

  it("should process successful payment when verification is skipped in dev", async () => {
    await handlePayPalWebhook(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    // Verified by checking if the response contains success info
    const call = res.json.mock.calls[0][0];
    expect(call.received).toBe(true);
    expect(call.processed).toBe(true);
  });

  it("should handle payments without Discord ID by storing as pending", async () => {
    delete req.body.resource.custom_id;

    await handlePayPalWebhook(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const call = res.json.mock.calls[0][0];
    expect(call.type).toBe("Payment Captured");
  });

  it("should reject webhooks in production without WEBHOOK_ID", async () => {
    process.env.NODE_ENV = "production";

    await handlePayPalWebhook(req, res);

    // In handlePayPalWebhook, it returns 200 even on invalid signature to prevent retries
    // but it won't be processed.
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith("OK");
  });
});
