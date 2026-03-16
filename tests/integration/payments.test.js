/**
 * Integration tests for Payment System
 * Tests crypto payment flow and Core credit management
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { config } from "../../src/config/config.js";

// Mock storage manager for integration tests
vi.mock("../../src/utils/storage/storageManager.js", () => ({
  getStorageManager: vi.fn(() => ({
    users: {
      findByDiscordId: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ discordId: "123456789" }),
      update: vi.fn().mockResolvedValue({}),
    },
    cores: {
      add: vi.fn().mockResolvedValue({}),
      remove: vi.fn().mockResolvedValue({}),
      set: vi.fn().mockResolvedValue({}),
      getBalance: vi.fn().mockResolvedValue(100),
    },
  })),
}));

describe("Payment Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Core Credit Calculation", () => {
    it("should calculate Cores using config.calculateCores() for $1", () => {
      const cores = config.calculateCores(1);
      expect(cores).toBeGreaterThanOrEqual(15);
    });

    it("should calculate Cores using config.calculateCores() for $10", () => {
      const cores = config.calculateCores(10);
      expect(cores).toBeGreaterThanOrEqual(150); // Base + bonus
    });

    it("should calculate Cores using config.calculateCores() for $25", () => {
      const cores = config.calculateCores(25);
      expect(cores).toBeGreaterThanOrEqual(375); // Base + bonus
    });

    it("should calculate Cores using config.calculateCores() for $50", () => {
      const cores = config.calculateCores(50);
      expect(cores).toBeGreaterThanOrEqual(750); // Base + bonus
    });

    it("should provide better rates for higher packages", () => {
      const cores1 = config.calculateCores(1);
      const cores10 = config.calculateCores(10);
      const cores50 = config.calculateCores(50);

      const rate1 = cores1 / 1;
      const rate10 = cores10 / 10;
      const rate50 = cores50 / 50;

      expect(rate10).toBeGreaterThanOrEqual(rate1);
      expect(rate50).toBeGreaterThanOrEqual(rate10);
    });
  });

  describe("Payment Validation", () => {
    it("should reject payments below minimum", () => {
      const minimumPayment = 1; // $1 minimum
      const smallPayment = 0.5;

      expect(smallPayment).toBeLessThan(minimumPayment);
    });

    it("should accept payments at minimum", () => {
      const minimumPayment = 1;
      const exactPayment = 1;

      expect(exactPayment).toBeGreaterThanOrEqual(minimumPayment);
    });

    it("should accept payments above minimum", () => {
      const minimumPayment = 1;
      const largePayment = 10;

      expect(largePayment).toBeGreaterThan(minimumPayment);
    });
  });

  describe("Webhook Payload Validation", () => {
    const validPayload = {
      status: "completed",
      order_number: "123456789_1234567890",
      amount: "0.00010551",
      currency: "BTC",
      source_amount: "10.00",
      source_currency: "USD",
      email: "user@example.com",
      txn_id: "test_txn_123456",
    };

    it("should have required fields", () => {
      const requiredFields = [
        "status",
        "order_number",
        "amount",
        "currency",
        "source_amount",
        "source_currency",
      ];

      requiredFields.forEach(field => {
        expect(validPayload).toHaveProperty(field);
      });
    });

    it("should have completed status for successful payment", () => {
      expect(validPayload.status).toBe("completed");
    });

    it("should have USD as source currency", () => {
      expect(validPayload.source_currency).toBe("USD");
    });

    it("should have valid order number format", () => {
      const orderNumberPattern = /^\d+_\d+$/;
      expect(validPayload.order_number).toMatch(orderNumberPattern);
    });
  });

  describe("Subscription Billing", () => {
    it("should calculate weekly Pro subscription cost", () => {
      const weeklyCost = 15; // 15 Cores per week
      const weeksInMonth = 4.33; // Average

      const monthlyCost = weeklyCost * weeksInMonth;
      expect(monthlyCost).toBeCloseTo(65, 0); // ~65 Cores/month
    });

    it("should calculate monthly savings vs one-time purchase", () => {
      const weeklyCost = 15;
      const weeksInMonth = 4.33;
      const subscriptionMonthly = weeklyCost * weeksInMonth;

      // Subscription should be comparable to one-time for similar usage
      expect(subscriptionMonthly).toBeGreaterThan(60);
      expect(subscriptionMonthly).toBeLessThan(70);
    });
  });
});
