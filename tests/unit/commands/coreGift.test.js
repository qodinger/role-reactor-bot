import { describe, it, expect, beforeEach, vi } from "vitest";
import { validateGiftInputs } from "../../../src/commands/general/core/validation.js";

describe("core gift Command Validation & Tax Logic", () => {
  describe("validateGiftInputs", () => {
    it("blocks self-gifting", () => {
      const mockInteraction = {
        user: { id: "user_123" },
        options: {
          getUser: () => ({ id: "user_123", bot: false }),
          getNumber: () => 10,
        },
      };

      const result = validateGiftInputs(mockInteraction);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("You cannot gift Cores to yourself");
    });

    it("blocks gifting to bot accounts", () => {
      const mockInteraction = {
        user: { id: "user_123" },
        options: {
          getUser: () => ({ id: "bot_456", bot: true }),
          getNumber: () => 10,
        },
      };

      const result = validateGiftInputs(mockInteraction);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("You cannot gift Cores to bot accounts");
    });

    it("blocks amounts less than 1 Core", () => {
      const mockInteraction = {
        user: { id: "user_123" },
        options: {
          getUser: () => ({ id: "user_789", bot: false }),
          getNumber: () => 0.5,
        },
      };

      const result = validateGiftInputs(mockInteraction);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Minimum gift amount is 1 Core");
    });

    it("validates successful gift inputs", () => {
      const mockInteraction = {
        user: { id: "user_123" },
        options: {
          getUser: () => ({ id: "user_789", bot: false }),
          getNumber: () => 20,
        },
      };

      const result = validateGiftInputs(mockInteraction);
      expect(result.valid).toBe(true);
      expect(result.data.amount).toBe(20);
    });
  });

  describe("10% Deflationary Transfer Tax Calculations", () => {
    it("correctly calculates 10% tax and net amount received", () => {
      const grossAmount = 10;
      const taxAmount = Math.round(grossAmount * 0.10 * 100) / 100;
      const netAmount = Math.round((grossAmount - taxAmount) * 100) / 100;

      expect(taxAmount).toBe(1.0);
      expect(netAmount).toBe(9.0);
    });

    it("correctly calculates 10% tax for odd amounts", () => {
      const grossAmount = 15.5;
      const taxAmount = Math.round(grossAmount * 0.10 * 100) / 100;
      const netAmount = Math.round((grossAmount - taxAmount) * 100) / 100;

      expect(taxAmount).toBe(1.55);
      expect(netAmount).toBe(13.95);
    });
  });
});
