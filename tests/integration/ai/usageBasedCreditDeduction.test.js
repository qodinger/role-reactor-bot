/**
 * Usage-Based Credit Deduction Integration Tests
 * Tests the complete flow of usage-based credit deduction for AI services
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  checkAndDeductAICredits,
  deductCreditsFromUsage,
  checkAIImageCredits,
  checkAndDeductAIImageCredits,
  refundAICredits,
  refundAIImageCredits,
} from "../../../src/utils/ai/aiCreditManager.js";
import { deductCreditsIfNeeded } from "../../../src/utils/ai/chat/responseProcessor.js";
import { getAIFeatureCosts } from "../../../src/config/ai.js";

// Mock external dependencies
vi.mock("../../../src/utils/logger.js", () => ({
  getLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// Mock storage manager with in-memory implementation
const mockStorage = new Map();
vi.mock("../../../src/utils/storage/storageManager.js", () => ({
  getStorageManager: vi.fn(() => ({
    get: vi.fn(key => Promise.resolve(mockStorage.get(key) || {})),
    set: vi.fn((key, data) => {
      mockStorage.set(key, data);
      return Promise.resolve();
    }),
  })),
}));

describe("Usage-Based Credit Deduction System", () => {
  const testUserId = "123456789012345678"; // Valid Discord snowflake
  const testUserId2 = "987654321098765432";

  beforeEach(() => {
    // Clear mock storage
    mockStorage.clear();

    // Set up initial credit data
    mockStorage.set("core_credit", {
      [testUserId]: {
        credits: 10.0,
        totalGenerated: 0,
        lastUpdated: new Date().toISOString(),
      },
      [testUserId2]: {
        credits: 0.04, // Insufficient credits for any operation (less than 0.05 minimum)
        totalGenerated: 0,
        lastUpdated: new Date().toISOString(),
      },
    });
  });

  afterEach(() => {
    mockStorage.clear();
  });

  describe("Configuration and Pricing", () => {
    it("should load correct feature costs with standardized conversion rate", () => {
      const costs = getAIFeatureCosts();

      expect(costs.aiChat).toBe(0.05); // Standardized minimum charge
      expect(costs.aiImage).toBe(1.2); // Default image cost

      // Provider-specific costs
      expect(costs.providerCosts.stability["sd3.5-large-turbo"]).toBe(2.1);
      expect(costs.providerCosts.stability["sd3.5-large"]).toBe(3.41);
      expect(costs.providerCosts.openrouter["openai/gpt-4o-mini"]).toBe(0.08);
      expect(costs.providerCosts.comfyui.default).toBe(0.08);

      // Token-based pricing configuration
      expect(costs.tokenPricing).toBeDefined();
      expect(costs.tokenPricing.openrouter).toBeDefined();
      expect(costs.tokenPricing.openrouter.conversionRate).toBe(50); // Standardized conversion rate
      expect(costs.tokenPricing.openrouter.minimumCharge).toBe(0.05); // Standardized minimum
    });

    it("should enforce minimum deduction of 0.05 Core", () => {
      const costs = getAIFeatureCosts();

      // All costs should be at least 0.05 (new minimum)
      expect(costs.aiChat).toBeGreaterThanOrEqual(0.05);
      expect(costs.aiImage).toBeGreaterThanOrEqual(0.05);

      Object.values(costs.providerCosts).forEach(providerCosts => {
        Object.values(providerCosts).forEach(cost => {
          expect(cost).toBeGreaterThanOrEqual(0.05);
        });
      });

      // Token pricing minimums
      Object.values(costs.tokenPricing).forEach(providerPricing => {
        expect(providerPricing.minimumCharge).toBeGreaterThanOrEqual(0.05);
      });
    });
  });

  describe("Traditional Fixed Credit Deduction", () => {
    it("should deduct fixed credits for AI chat", async () => {
      const result = await checkAndDeductAICredits(testUserId);

      expect(result.success).toBe(true);
      expect(result.creditsDeducted).toBe(0.05); // Fixed chat cost (updated)
      expect(result.creditsRemaining).toBe(9.95); // 10.0 - 0.05
    });

    it("should handle insufficient credits for chat", async () => {
      const result = await checkAndDeductAICredits(testUserId2);

      expect(result.success).toBe(false);
      expect(result.creditsDeducted).toBe(0);
      expect(result.error).toBe("Insufficient credits");
    });

    it("should deduct provider-specific credits for images", async () => {
      const result = await checkAndDeductAIImageCredits(
        testUserId,
        "stability",
        "sd3.5-large-turbo",
      );

      expect(result.success).toBe(true);
      expect(result.creditsDeducted).toBe(2.1); // SD 3.5 Large Turbo cost from updated config
      expect(result.creditsRemaining).toBe(7.9); // 10.0 - 2.1
    });

    it("should use simplified credit deduction system", async () => {
      const result = await checkAndDeductAIImageCredits(
        testUserId,
        "stability",
        "sd3.5-large",
      );

      expect(result.success).toBe(true);
      expect(result.creditsDeducted).toBe(3.41); // SD 3.5 Large cost from updated config
      expect(result.creditsRemaining).toBe(6.59); // 10.0 - 3.41
    });
  });

  describe("Usage-Based Credit Deduction", () => {
    it("should deduct credits based on actual OpenRouter usage", async () => {
      const mockUsage = {
        total_tokens: 150,
        prompt_tokens: 100,
        completion_tokens: 50,
        cost: 0.025, // OpenRouter credits
      };

      const result = await deductCreditsFromUsage(
        testUserId,
        mockUsage,
        "openrouter",
        "openai/gpt-4o-mini",
        50, // Updated conversion rate (standardized)
      );

      expect(result.success).toBe(true);
      expect(result.creditsDeducted).toBe(1.25); // 0.025 × 50 = 1.25
      expect(result.creditsRemaining).toBe(8.75); // 10.0 - 1.25
      expect(result.deductionBreakdown.actualApiCost).toBe(0.025);
      expect(result.deductionBreakdown.conversionRate).toBe(50);
    });

    it("should enforce minimum deduction of 0.05 Core even for tiny usage", async () => {
      const mockUsage = {
        total_tokens: 10,
        prompt_tokens: 8,
        completion_tokens: 2,
        cost: 0.001, // Very small cost
      };

      const result = await deductCreditsFromUsage(
        testUserId,
        mockUsage,
        "openrouter",
        "openai/gpt-4o-mini",
        1.0,
      );

      expect(result.success).toBe(true);
      expect(result.creditsDeducted).toBe(0.05); // Minimum deduction enforced (updated)
      expect(result.creditsRemaining).toBe(9.95);
      expect(result.deductionBreakdown.actualApiCost).toBe(0.001);
    });

    it("should use provider-specific conversion rates", async () => {
      const mockUsage = {
        total_tokens: 200,
        prompt_tokens: 150,
        completion_tokens: 50,
        cost: 0.05, // OpenRouter credits
      };

      // Test with OpenRouter's 50x conversion rate (standardized)
      const result = await deductCreditsFromUsage(
        testUserId,
        mockUsage,
        "openrouter",
        "openai/gpt-4o-mini",
        50, // Updated conversion rate
      );

      expect(result.success).toBe(true);
      expect(result.creditsDeducted).toBe(2.5); // 0.05 * 50 = 2.5
      expect(result.creditsRemaining).toBe(7.5); // 10.0 - 2.5
      expect(result.deductionBreakdown.actualApiCost).toBe(0.05);
      expect(result.deductionBreakdown.conversionRate).toBe(50);
    });

    it("should handle insufficient credits for usage-based deduction", async () => {
      const mockUsage = {
        total_tokens: 1000,
        prompt_tokens: 800,
        completion_tokens: 200,
        cost: 0.1, // More than user has
      };

      const result = await deductCreditsFromUsage(
        testUserId2, // User with only 0.04 credits
        mockUsage,
        "openrouter",
        "openai/gpt-4o-mini",
        1.0,
      );

      expect(result.success).toBe(false);
      expect(result.creditsDeducted).toBe(0);
      expect(result.error).toBe("Insufficient credits");
      expect(result.deductionBreakdown.actualApiCost).toBe(0.1);
    });

    it("should validate usage data format", async () => {
      // Test with invalid usage data
      const invalidUsage = {
        total_tokens: 100,
        // Missing cost field
      };

      const result = await deductCreditsFromUsage(
        testUserId,
        invalidUsage,
        "openrouter",
        "openai/gpt-4o-mini",
        1.0,
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid usage data");
    });
  });

  describe("Token-Based Pricing for Chat", () => {
    it("should calculate costs based on actual token usage", async () => {
      // Simulate a typical GPT-4o-mini chat request
      const mockUsage = {
        total_tokens: 500, // 400 input + 100 output
        prompt_tokens: 400,
        completion_tokens: 100,
        cost: 0.0012, // OpenRouter cost: (400 * $0.15 + 100 * $0.60) / 1M = $0.0012
      };

      const result = await deductCreditsFromUsage(
        testUserId,
        mockUsage,
        "openrouter",
        "openai/gpt-4o-mini",
        50, // Updated conversion rate (standardized)
      );

      expect(result.success).toBe(true);
      expect(result.creditsDeducted).toBe(0.06); // 0.0012 * 50 = 0.06 (above minimum)
      expect(result.creditsRemaining).toBe(9.94);
      expect(result.deductionBreakdown.actualApiCost).toBe(0.0012);
    });

    it("should handle larger conversations that exceed minimum charge", async () => {
      // Simulate a longer conversation
      const mockUsage = {
        total_tokens: 5000, // 4000 input + 1000 output
        prompt_tokens: 4000,
        completion_tokens: 1000,
        cost: 0.012, // OpenRouter cost: (4000 * $0.15 + 1000 * $0.60) / 1M = $0.012
      };

      const result = await deductCreditsFromUsage(
        testUserId,
        mockUsage,
        "openrouter",
        "openai/gpt-4o-mini",
        50, // Updated conversion rate
      );

      expect(result.success).toBe(true);
      expect(result.creditsDeducted).toBe(0.6); // 0.012 * 50 = 0.6 (above minimum)
      expect(result.creditsRemaining).toBe(9.4); // 10.0 - 0.6
      expect(result.deductionBreakdown.actualApiCost).toBe(0.012);
    });

    it("should handle different models with different pricing", async () => {
      // Simulate Claude 3.5 Sonnet (more expensive)
      const mockUsage = {
        total_tokens: 1000,
        prompt_tokens: 800,
        completion_tokens: 200,
        cost: 0.008, // Higher cost per token
      };

      const result = await deductCreditsFromUsage(
        testUserId,
        mockUsage,
        "openrouter",
        "anthropic/claude-3.5-sonnet",
        50, // Updated conversion rate
      );

      expect(result.success).toBe(true);
      expect(result.creditsDeducted).toBe(0.4); // 0.008 * 50 = 0.4
      expect(result.creditsRemaining).toBe(9.6); // 10.0 - 0.4
    });

    it("should apply minimum charge for very small requests", async () => {
      // Simulate a very short request
      const mockUsage = {
        total_tokens: 50, // 40 input + 10 output
        prompt_tokens: 40,
        completion_tokens: 10,
        cost: 0.00012, // Very small cost
      };

      const result = await deductCreditsFromUsage(
        testUserId,
        mockUsage,
        "openrouter",
        "openai/gpt-4o-mini",
        50, // Updated conversion rate
      );

      expect(result.success).toBe(true);
      expect(result.creditsDeducted).toBe(0.05); // Minimum charge enforced (updated)
      expect(result.creditsRemaining).toBe(9.95);
      expect(result.deductionBreakdown.actualApiCost).toBe(0.00012);
    });
  });

  describe("Response Processor Integration", () => {
    it("should use usage-based deduction when usage data is available", async () => {
      const mockResult = {
        text: "AI generated response",
        provider: "openrouter",
        model: "openai/gpt-4o-mini",
        usage: {
          total_tokens: 120,
          prompt_tokens: 80,
          completion_tokens: 40,
          cost: 0.03,
        },
      };

      await deductCreditsIfNeeded(testUserId, mockResult, "initial");

      // deductCreditsIfNeeded uses actual usage-based deduction when usage data is available
      // 0.03 USD * 50 conversion rate = 1.5 Core credits
      const creditData = mockStorage.get("core_credit")[testUserId];
      expect(creditData.credits).toBe(8.5); // 10.0 - 1.5 (usage-based deduction)
    });

    it("should use provider-specific conversion rates from config", async () => {
      const mockResult = {
        text: "AI generated response",
        provider: "openrouter",
        model: "openai/gpt-4o-mini",
        usage: {
          total_tokens: 100,
          prompt_tokens: 70,
          completion_tokens: 30,
          cost: 0.025, // OpenRouter credits
        },
      };

      await deductCreditsIfNeeded(testUserId, mockResult, "initial");

      // Uses actual usage-based deduction: 0.025 USD * 50 conversion rate = 1.25 Core credits
      const creditData = mockStorage.get("core_credit")[testUserId];
      expect(creditData.credits).toBe(8.75); // 10.0 - 1.25 (usage-based deduction)
    });

    it("should fall back to fixed deduction when no usage data", async () => {
      const mockResult = {
        text: "AI generated response",
        provider: "stability",
        model: "sd3.5-large-turbo",
        // No usage data
      };

      await deductCreditsIfNeeded(testUserId, mockResult, "initial");

      // Should use fixed deduction (0.05 for chat)
      const creditData = mockStorage.get("core_credit")[testUserId];
      expect(creditData.credits).toBe(9.95); // 10.0 - 0.05
    });

    it("should skip deduction for empty responses", async () => {
      const mockResult = {
        text: "", // Empty response
        provider: "openrouter",
        model: "openai/gpt-4o-mini",
        usage: {
          total_tokens: 0,
          cost: 0,
        },
      };

      await deductCreditsIfNeeded(testUserId, mockResult, "initial");

      // No deduction should occur
      const creditData = mockStorage.get("core_credit")[testUserId];
      expect(creditData.credits).toBe(10.0); // Unchanged
    });

    it('should skip deduction for "No response generated" fallback', async () => {
      const mockResult = {
        text: "No response generated.",
        provider: "openrouter",
        model: "openai/gpt-4o-mini",
        usage: {
          total_tokens: 50,
          cost: 0.01,
        },
      };

      await deductCreditsIfNeeded(testUserId, mockResult, "initial");

      // No deduction should occur for fallback response
      const creditData = mockStorage.get("core_credit")[testUserId];
      expect(creditData.credits).toBe(10.0); // Unchanged
    });
  });

  describe("Credit Refund System", () => {
    it("should refund credits for failed operations", async () => {
      // First deduct some credits
      await checkAndDeductAICredits(testUserId);
      expect(mockStorage.get("core_credit")[testUserId].credits).toBe(9.95);

      // Then refund
      const result = await refundAICredits(testUserId, 0.05, "API call failed");

      expect(result.success).toBe(true);
      expect(result.creditsRemaining).toBe(10.0); // Back to original
    });

    it("should refund image credits for failed generations", async () => {
      // First deduct image credits
      await checkAndDeductAIImageCredits(
        testUserId,
        "stability",
        "sd3.5-large-turbo",
      );
      expect(mockStorage.get("core_credit")[testUserId].credits).toBe(7.9);

      // Then refund
      const result = await refundAIImageCredits(
        testUserId,
        2.1,
        "Image generation failed",
      );

      expect(result.success).toBe(true);
      expect(result.creditsRemaining).toBe(10.0); // Back to original
    });

    it("should handle invalid refund amounts", async () => {
      const result = await refundAICredits(testUserId, -0.01, "Invalid amount");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid refund amount");
    });
  });

  describe("Concurrent Operations and Race Conditions", () => {
    it("should handle concurrent credit deductions safely", async () => {
      // Simulate multiple concurrent deductions
      const promises = [
        checkAndDeductAICredits(testUserId),
        checkAndDeductAICredits(testUserId),
        checkAndDeductAICredits(testUserId),
      ];

      const results = await Promise.all(promises);

      // All should succeed (user has enough credits)
      results.forEach(result => {
        expect(result.success).toBe(true);
        expect(result.creditsDeducted).toBe(0.05);
      });

      // Final balance should be correct
      const creditData = mockStorage.get("core_credit")[testUserId];
      expect(creditData.credits).toBe(9.85); // 10.0 - (3 * 0.05)
    });

    it("should handle concurrent usage-based deductions", async () => {
      const mockUsage1 = { cost: 0.02 };
      const mockUsage2 = { cost: 0.03 };
      const mockUsage3 = { cost: 0.01 };

      const promises = [
        deductCreditsFromUsage(
          testUserId,
          mockUsage1,
          "openrouter",
          "model1",
          1.0,
        ),
        deductCreditsFromUsage(
          testUserId,
          mockUsage2,
          "openrouter",
          "model2",
          1.0,
        ),
        deductCreditsFromUsage(
          testUserId,
          mockUsage3,
          "openrouter",
          "model3",
          1.0,
        ),
      ];

      const results = await Promise.all(promises);

      // All should succeed
      results.forEach(result => {
        expect(result.success).toBe(true);
      });

      // Final balance should be correct
      const creditData = mockStorage.get("core_credit")[testUserId];
      expect(creditData.credits).toBe(9.85); // 10.0 - (3 * 0.05) since all are below minimum
    });
  });

  describe("Error Handling and Edge Cases", () => {
    it("should handle invalid user IDs", async () => {
      const result = await checkAndDeductAICredits("invalid-id");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid user ID");
    });

    it("should handle storage errors gracefully", async () => {
      // Mock storage to fail
      const { getStorageManager } = await import(
        "../../../src/utils/storage/storageManager.js"
      );
      getStorageManager.mockResolvedValueOnce({
        get: vi.fn().mockRejectedValue(new Error("Storage error")),
        set: vi.fn().mockRejectedValue(new Error("Storage error")),
      });

      const result = await checkAndDeductAICredits(testUserId);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Storage error");
    });

    it("should handle floating point precision correctly", async () => {
      // Test with values that might cause floating point issues
      const mockUsage = {
        cost: 0.333333333, // Repeating decimal
      };

      const result = await deductCreditsFromUsage(
        testUserId,
        mockUsage,
        "openrouter",
        "test-model",
        1.0,
      );

      expect(result.success).toBe(true);
      // Should be rounded to 2 decimal places
      expect(result.creditsRemaining).toBe(9.67); // 10.0 - 0.33 (rounded)
    });
  });

  describe("Provider-Specific Cost Calculation", () => {
    it("should calculate correct costs for different providers", async () => {
      const testCases = [
        {
          provider: "stability",
          model: "sd3.5-large-turbo",
          expectedCost: 2.1,
        },
        { provider: "stability", model: "sd3.5-large", expectedCost: 3.41 },
        { provider: "stability", model: "sd3.5-medium", expectedCost: 1.84 },
        { provider: "comfyui", model: "any-model", expectedCost: 0.08 },
        { provider: "runpod", model: "any-model", expectedCost: 0.79 },
      ];

      for (const testCase of testCases) {
        const result = await checkAIImageCredits(
          testUserId,
          testCase.provider,
          testCase.model,
        );

        expect(result.creditsNeeded).toBe(testCase.expectedCost);
      }
    });

    it("should fall back to default costs for unknown models", async () => {
      const result = await checkAIImageCredits(
        testUserId,
        "unknown-provider",
        "unknown-model",
      );

      // Should fall back to default image cost
      expect(result.creditsNeeded).toBe(1.2); // Default aiImage cost (updated)
    });
  });
});
