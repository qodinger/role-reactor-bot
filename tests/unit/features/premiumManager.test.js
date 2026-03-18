import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ─── Mock Dependencies ──────────────────────────────────────────────────────

// Mock logger
vi.mock("../../../src/utils/logger.js", () => ({
  getLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
    debug: vi.fn(),
  }),
}));

// Mock commandHandler
const mockSyncGuildCommands = vi.fn().mockResolvedValue(undefined);
vi.mock("../../../src/utils/core/commandHandler.js", () => ({
  getCommandHandler: () => ({
    syncGuildCommands: mockSyncGuildCommands,
  }),
}));

// ── Helpers to build mock DB / Storage ───────────────────────────────────────

function createMockDb({
  guildSettings = {},
  credits = 100,
  scheduledRoles = [],
  ticketPanels = [],
} = {}) {
  return {
    guildSettings: {
      getByGuild: vi.fn().mockResolvedValue(guildSettings),
      set: vi.fn().mockResolvedValue(true),
    },
    coreCredits: {
      getByUserId: vi.fn().mockResolvedValue({ credits }),
      updateCredits: vi.fn().mockResolvedValue(true),
    },
    payments: {
      create: vi.fn().mockResolvedValue(true),
    },
    notifications: {
      create: vi.fn().mockResolvedValue(true),
    },
    scheduledRoles: {
      getByGuild: vi.fn().mockResolvedValue(scheduledRoles),
      update: vi.fn().mockResolvedValue(true),
    },
    ticketPanels: ticketPanels.length
      ? { findByGuild: vi.fn().mockResolvedValue(ticketPanels) }
      : null,
  };
}

function createMockStorage(db) {
  return {
    dbManager: db,
    getCoreCredits: vi.fn().mockResolvedValue({ credits: 100 }),
    getTicketPanelsByGuild: vi.fn().mockResolvedValue([]),
    updateTicketPanel: vi.fn().mockResolvedValue(true),
  };
}

// ── Mock storageManager (dynamic: updated per-test via mockGetStorageManager) ─

let mockGetStorageManager;

vi.mock("../../../src/utils/storage/storageManager.js", () => ({
  getStorageManager: (...args) => mockGetStorageManager(...args),
}));

// ── Import the system-under-test AFTER mocks are set up ──────────────────────

const { PremiumManager } = await import(
  "../../../src/features/premium/PremiumManager.js"
);
const { PremiumFeatures } = await import(
  "../../../src/features/premium/config.js"
);

// ─── Test Suite ──────────────────────────────────────────────────────────────

describe("PremiumManager", () => {
  /** @type {InstanceType<typeof PremiumManager>} */
  let pm;
  let db;
  let storage;

  beforeEach(() => {
    vi.clearAllMocks();

    db = createMockDb();
    storage = createMockStorage(db);
    mockGetStorageManager = vi.fn().mockResolvedValue(storage);

    pm = new PremiumManager();
    pm.setClient({
      guilds: {
        fetch: vi.fn().mockResolvedValue({ name: "Test Guild" }),
      },
      users: {
        fetch: vi.fn().mockResolvedValue({
          send: vi.fn().mockResolvedValue(true),
        }),
      },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // isFeatureActive
  // ─────────────────────────────────────────────────────────────────────────

  describe("isFeatureActive", () => {
    it("returns false when DB is unavailable", async () => {
      mockGetStorageManager.mockResolvedValue({ dbManager: null });
      expect(await pm.isFeatureActive("g1", "pro_engine")).toBe(false);
    });

    it("returns false when there is no subscription", async () => {
      db.guildSettings.getByGuild.mockResolvedValue({});
      expect(await pm.isFeatureActive("g1", "pro_engine")).toBe(false);
    });

    it("returns false when subscription is inactive", async () => {
      db.guildSettings.getByGuild.mockResolvedValue({
        premiumFeatures: { pro_engine: { active: false } },
      });
      expect(await pm.isFeatureActive("g1", "pro_engine")).toBe(false);
    });

    it("returns true when subscription is active and within period", async () => {
      const future = new Date();
      future.setDate(future.getDate() + 7);
      db.guildSettings.getByGuild.mockResolvedValue({
        premiumFeatures: {
          pro_engine: { active: true, nextDeductionDate: future },
        },
      });
      expect(await pm.isFeatureActive("g1", "pro_engine")).toBe(true);
    });

    it("returns true during the 3-day grace period", async () => {
      // nextDeductionDate is 2 days in the past → still in grace
      const past = new Date();
      past.setDate(past.getDate() - 2);
      db.guildSettings.getByGuild.mockResolvedValue({
        premiumFeatures: {
          pro_engine: { active: true, nextDeductionDate: past },
        },
      });
      expect(await pm.isFeatureActive("g1", "pro_engine")).toBe(true);
    });

    it("returns false after the grace period expires", async () => {
      // nextDeductionDate is 5 days in the past → grace (3 days) expired
      const past = new Date();
      past.setDate(past.getDate() - 5);
      db.guildSettings.getByGuild.mockResolvedValue({
        premiumFeatures: {
          pro_engine: { active: true, nextDeductionDate: past },
        },
      });
      expect(await pm.isFeatureActive("g1", "pro_engine")).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // activateFeature
  // ─────────────────────────────────────────────────────────────────────────

  describe("activateFeature", () => {
    it("rejects an invalid feature ID", async () => {
      const result = await pm.activateFeature("g1", "INVALID", "u1");
      expect(result.success).toBe(false);
      expect(result.message).toMatch(/invalid/i);
    });

    it("fails when DB is unavailable", async () => {
      mockGetStorageManager.mockResolvedValue({ dbManager: null });
      const result = await pm.activateFeature("g1", "pro_engine", "u1");
      expect(result.success).toBe(false);
      expect(result.message).toMatch(/database/i);
    });

    it("fails when user has insufficient balance", async () => {
      storage.getCoreCredits.mockResolvedValue({ credits: 5 });
      const result = await pm.activateFeature("g1", "pro_engine", "u1");
      expect(result.success).toBe(false);
      expect(result.message).toMatch(/insufficient/i);
    });

    it("activates successfully with sufficient balance", async () => {
      storage.getCoreCredits.mockResolvedValue({ credits: 100 });
      db.guildSettings.getByGuild.mockResolvedValue({
        guildId: "g1",
        premiumFeatures: {},
      });

      const result = await pm.activateFeature("g1", "pro_engine", "u1");

      expect(result.success).toBe(true);
      // Cores should be deducted
      expect(db.coreCredits.updateCredits).toHaveBeenCalledWith(
        "u1",
        -PremiumFeatures.PRO.cost,
      );
      // Guild settings should be updated
      expect(db.guildSettings.set).toHaveBeenCalled();
      // Transaction should be logged
      expect(db.payments.create).toHaveBeenCalled();
      // Guild commands should be synced (Pro Engine specific)
      expect(mockSyncGuildCommands).toHaveBeenCalledWith(
        "g1",
        expect.any(Array),
      );
    });

    it("deducts the correct cost (20 Cores for Pro Engine)", async () => {
      storage.getCoreCredits.mockResolvedValue({ credits: 20 });
      db.guildSettings.getByGuild.mockResolvedValue({
        guildId: "g1",
        premiumFeatures: {},
      });

      await pm.activateFeature("g1", "pro_engine", "u1");

      expect(db.coreCredits.updateCredits).toHaveBeenCalledWith("u1", -20);
    });

    it("sets nextDeductionDate 7 days in the future", async () => {
      storage.getCoreCredits.mockResolvedValue({ credits: 100 });
      db.guildSettings.getByGuild.mockResolvedValue({
        guildId: "g1",
        premiumFeatures: {},
      });

      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-03-18T12:00:00Z"));

      await pm.activateFeature("g1", "pro_engine", "u1");

      const settingsArg = db.guildSettings.set.mock.calls[0][1];
      const nextDate = new Date(
        settingsArg.premiumFeatures.pro_engine.nextDeductionDate,
      );
      expect(nextDate.toISOString()).toBe("2026-03-25T12:00:00.000Z");

      vi.useRealTimers();
    });

    it("creates an in-app notification for the payer", async () => {
      storage.getCoreCredits.mockResolvedValue({ credits: 100 });
      db.guildSettings.getByGuild.mockResolvedValue({
        guildId: "g1",
        premiumFeatures: {},
      });

      await pm.activateFeature("g1", "pro_engine", "u1");

      expect(db.notifications.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "u1",
          type: "pro_activated",
        }),
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // cancelFeature
  // ─────────────────────────────────────────────────────────────────────────

  describe("cancelFeature", () => {
    it("fails when feature is not active", async () => {
      db.guildSettings.getByGuild.mockResolvedValue({
        premiumFeatures: {},
      });
      const result = await pm.cancelFeature("g1", "pro_engine", "u1");
      expect(result.success).toBe(false);
      expect(result.message).toMatch(/not currently active/i);
    });

    it("fails when a different user tries to cancel", async () => {
      db.guildSettings.getByGuild.mockResolvedValue({
        premiumFeatures: {
          pro_engine: { active: true, payerUserId: "u1" },
        },
      });
      const result = await pm.cancelFeature("g1", "pro_engine", "u2");
      expect(result.success).toBe(false);
      expect(result.message).toMatch(/only the user who activated/i);
    });

    it("marks subscription as cancelled without immediately deactivating", async () => {
      const nextDate = new Date();
      nextDate.setDate(nextDate.getDate() + 5);
      db.guildSettings.getByGuild.mockResolvedValue({
        premiumFeatures: {
          pro_engine: {
            active: true,
            payerUserId: "u1",
            nextDeductionDate: nextDate,
          },
        },
      });

      const result = await pm.cancelFeature("g1", "pro_engine", "u1");

      expect(result.success).toBe(true);
      expect(result.message).toMatch(/remain active/i);
      // Sub should still be active; it just has a cancelledAt timestamp
      const savedSettings = db.guildSettings.set.mock.calls[0][1];
      expect(savedSettings.premiumFeatures.pro_engine.active).toBe(true);
      expect(
        savedSettings.premiumFeatures.pro_engine.cancelledAt,
      ).toBeDefined();
      expect(savedSettings.premiumFeatures.pro_engine.autoRenew).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // getSubscriptionStatus
  // ─────────────────────────────────────────────────────────────────────────

  describe("getSubscriptionStatus", () => {
    it("returns null when no subscription exists", async () => {
      db.guildSettings.getByGuild.mockResolvedValue({});
      const status = await pm.getSubscriptionStatus("g1", "pro_engine");
      expect(status).toBeNull();
    });

    it("returns full subscription details", async () => {
      const now = new Date();
      db.guildSettings.getByGuild.mockResolvedValue({
        premiumFeatures: {
          pro_engine: {
            active: true,
            payerUserId: "u1",
            activatedAt: now,
            nextDeductionDate: now,
            cost: 20,
            period: "week",
          },
        },
      });

      const status = await pm.getSubscriptionStatus("g1", "pro_engine");

      expect(status).toEqual({
        active: true,
        payerUserId: "u1",
        activatedAt: now,
        nextDeductionDate: now,
        cost: 20,
        period: "week",
        cancelled: false,
        cancelledAt: null,
        autoRenew: true,
      });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // processRenewals
  // ─────────────────────────────────────────────────────────────────────────

  describe("processRenewals", () => {
    it("renews a feature when balance is sufficient", async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      db.guildSettings.collection = {
        find: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue([
            {
              guildId: "g1",
              premiumFeatures: {
                pro_engine: {
                  active: true,
                  payerUserId: "u1",
                  nextDeductionDate: pastDate,
                  cost: 20,
                  period: "week",
                },
              },
            },
          ]),
        }),
      };
      db.coreCredits.getByUserId.mockResolvedValue({ credits: 50 });

      await pm.processRenewals();

      // Cores should be deducted
      expect(db.coreCredits.updateCredits).toHaveBeenCalledWith("u1", -20);
      // Guild settings should be updated with a new nextDeductionDate
      expect(db.guildSettings.set).toHaveBeenCalled();
      // Transaction should be logged
      expect(db.payments.create).toHaveBeenCalledWith(
        expect.objectContaining({ type: "renewal" }),
      );
    });

    it("disables a cancelled subscription after its billing cycle ends", async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      // Shared settings object — processRenewals reads from the collection,
      // then disableFeature calls getByGuild again internally.
      const guildSettings = {
        guildId: "g1",
        premiumFeatures: {
          pro_engine: {
            active: true,
            payerUserId: "u1",
            nextDeductionDate: pastDate,
            cancelledAt: new Date(),
          },
        },
      };

      db.guildSettings.collection = {
        find: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue([guildSettings]),
        }),
      };
      // disableFeature internally calls getByGuild — return the same object
      db.guildSettings.getByGuild.mockResolvedValue(guildSettings);

      await pm.processRenewals();

      // After the billing cycle ends, the feature should be marked inactive
      expect(db.guildSettings.set).toHaveBeenCalled();
      expect(guildSettings.premiumFeatures.pro_engine.active).toBe(false);
    });

    it("triggers grace period warning when balance is too low", async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      db.guildSettings.collection = {
        find: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue([
            {
              guildId: "g1",
              premiumFeatures: {
                pro_engine: {
                  active: true,
                  payerUserId: "u1",
                  nextDeductionDate: pastDate,
                  cost: 20,
                  period: "week",
                },
              },
            },
          ]),
        }),
      };
      // Not enough balance for renewal
      db.coreCredits.getByUserId.mockResolvedValue({ credits: 5 });

      await pm.processRenewals();

      // Should NOT deduct — insufficient balance
      expect(db.coreCredits.updateCredits).not.toHaveBeenCalled();
    });

    it("disables the feature after grace period expires", async () => {
      // nextDeductionDate was 5 days ago → grace (3 days) expired
      const longPast = new Date();
      longPast.setDate(longPast.getDate() - 5);

      const guildSettings = {
        guildId: "g1",
        premiumFeatures: {
          pro_engine: {
            active: true,
            payerUserId: "u1",
            nextDeductionDate: longPast,
            cost: 20,
            period: "week",
          },
        },
      };

      db.guildSettings.collection = {
        find: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue([guildSettings]),
        }),
      };
      // disableFeature internally calls getByGuild — return the same object
      db.guildSettings.getByGuild.mockResolvedValue(guildSettings);
      db.coreCredits.getByUserId.mockResolvedValue({ credits: 0 });

      await pm.processRenewals();

      // Feature should be disabled
      expect(db.guildSettings.set).toHaveBeenCalled();
      expect(guildSettings.premiumFeatures.pro_engine.active).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // disableFeature
  // ─────────────────────────────────────────────────────────────────────────

  describe("disableFeature", () => {
    it("marks the feature as inactive with a reason", async () => {
      db.guildSettings.getByGuild.mockResolvedValue({
        premiumFeatures: {
          pro_engine: { active: true, payerUserId: "u1" },
        },
      });

      await pm.disableFeature("g1", "pro_engine", {
        reason: "insufficient_balance",
      });

      expect(db.guildSettings.set).toHaveBeenCalled();
      const saved = db.guildSettings.set.mock.calls[0][1];
      expect(saved.premiumFeatures.pro_engine.active).toBe(false);
      expect(saved.premiumFeatures.pro_engine.disableReason).toBe(
        "insufficient_balance",
      );
    });

    it("syncs guild commands when Pro Engine is disabled", async () => {
      db.guildSettings.getByGuild.mockResolvedValue({
        premiumFeatures: {
          pro_engine: { active: true, payerUserId: "u1" },
        },
      });

      await pm.disableFeature("g1", "pro_engine");

      expect(mockSyncGuildCommands).toHaveBeenCalledWith("g1", []);
    });

    it("creates an in-app notification for the payer", async () => {
      db.guildSettings.getByGuild.mockResolvedValue({
        premiumFeatures: {
          pro_engine: { active: true, payerUserId: "u1" },
        },
      });

      await pm.disableFeature("g1", "pro_engine");

      expect(db.notifications.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "u1",
          type: "pro_deactivated",
        }),
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // _handleProDowngrade (tested indirectly through disableFeature)
  // ─────────────────────────────────────────────────────────────────────────

  describe("pro downgrade cleanup", () => {
    it("pauses excess scheduled roles beyond the free limit", async () => {
      // Free limit = 25, so if there are 30 active schedules, 5 should be paused
      const schedules = Array.from({ length: 30 }, (_, i) => ({
        id: `sched_${i}`,
        executed: false,
        cancelled: false,
        createdAt: new Date(Date.now() + i * 1000),
      }));

      db.scheduledRoles.getByGuild.mockResolvedValue(schedules);
      db.guildSettings.getByGuild.mockResolvedValue({
        premiumFeatures: {
          pro_engine: { active: true, payerUserId: "u1" },
        },
      });

      await pm.disableFeature("g1", "pro_engine");

      // 30 - 25 = 5 schedules should be cancelled
      expect(db.scheduledRoles.update).toHaveBeenCalledTimes(5);
      for (const call of db.scheduledRoles.update.mock.calls) {
        expect(call[1]).toEqual(
          expect.objectContaining({
            cancelled: true,
            cancelReason: "pro_downgrade",
          }),
        );
      }
    });

    it("resets level reward mode to 'stack' if it was 'replace'", async () => {
      db.guildSettings.getByGuild.mockResolvedValue({
        premiumFeatures: {
          pro_engine: { active: true, payerUserId: "u1" },
        },
        levelRewardMode: "replace",
      });

      await pm.disableFeature("g1", "pro_engine");

      // guildSettings.set should be called with levelRewardMode: "stack"
      const allSetCalls = db.guildSettings.set.mock.calls;
      const rewardModeReset = allSetCalls.some(
        ([, settings]) => settings.levelRewardMode === "stack",
      );
      expect(rewardModeReset).toBe(true);
    });

    it("does not modify reward mode if already 'stack'", async () => {
      db.guildSettings.getByGuild.mockResolvedValue({
        premiumFeatures: {
          pro_engine: { active: true, payerUserId: "u1" },
        },
        levelRewardMode: "stack",
      });

      await pm.disableFeature("g1", "pro_engine");

      // The disable action itself calls set once (to mark inactive).
      // There should be no additional call just for resetting the mode.
      const allSetCalls = db.guildSettings.set.mock.calls;
      const modeResetCalls = allSetCalls.filter(
        ([, settings]) =>
          settings.levelRewardMode !== undefined &&
          settings.levelRewardMode === "stack" &&
          settings.premiumFeatures === undefined,
      );
      expect(modeResetCalls.length).toBe(0);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Dynamic — auto-test ALL features in PremiumFeatures config
  // ─────────────────────────────────────────────────────────────────────────

  const allFeatures = Object.values(PremiumFeatures).map(f => [
    f.id,
    f.name,
    f.cost,
    f.periodDays,
  ]);

  describe.each(allFeatures)(
    "generic lifecycle for feature '%s' (%s)",
    (featureId, featureName, cost, periodDays) => {
      it("activates successfully with sufficient balance", async () => {
        storage.getCoreCredits.mockResolvedValue({ credits: cost + 100 });
        db.guildSettings.getByGuild.mockResolvedValue({
          guildId: "g1",
          premiumFeatures: {},
          disabledCommands: [],
        });

        const result = await pm.activateFeature("g1", featureId, "u1");

        expect(result.success).toBe(true);
        expect(db.coreCredits.updateCredits).toHaveBeenCalledWith("u1", -cost);
      });

      it(`deducts exactly ${cost} Cores`, async () => {
        storage.getCoreCredits.mockResolvedValue({ credits: cost });
        db.guildSettings.getByGuild.mockResolvedValue({
          guildId: "g1",
          premiumFeatures: {},
          disabledCommands: [],
        });

        await pm.activateFeature("g1", featureId, "u1");

        expect(db.coreCredits.updateCredits).toHaveBeenCalledWith("u1", -cost);
      });

      it(`sets nextDeductionDate ${periodDays} days in the future`, async () => {
        storage.getCoreCredits.mockResolvedValue({ credits: cost + 100 });
        db.guildSettings.getByGuild.mockResolvedValue({
          guildId: "g1",
          premiumFeatures: {},
          disabledCommands: [],
        });

        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-06-01T00:00:00Z"));

        await pm.activateFeature("g1", featureId, "u1");

        const settingsArg = db.guildSettings.set.mock.calls[0][1];
        const nextDate = new Date(
          settingsArg.premiumFeatures[featureId].nextDeductionDate,
        );
        const expected = new Date("2026-06-01T00:00:00Z");
        expected.setDate(expected.getDate() + periodDays);
        expect(nextDate.toISOString()).toBe(expected.toISOString());

        vi.useRealTimers();
      });

      it("fails activation with insufficient balance", async () => {
        storage.getCoreCredits.mockResolvedValue({ credits: cost - 1 });
        const result = await pm.activateFeature("g1", featureId, "u1");
        expect(result.success).toBe(false);
        expect(result.message).toMatch(/insufficient/i);
      });

      it("cancels without immediately disabling", async () => {
        const future = new Date();
        future.setDate(future.getDate() + periodDays);
        db.guildSettings.getByGuild.mockResolvedValue({
          premiumFeatures: {
            [featureId]: {
              active: true,
              payerUserId: "u1",
              nextDeductionDate: future,
            },
          },
        });

        const result = await pm.cancelFeature("g1", featureId, "u1");

        expect(result.success).toBe(true);
        expect(result.message).toMatch(/remain active/i);
        const saved = db.guildSettings.set.mock.calls[0][1];
        expect(saved.premiumFeatures[featureId].active).toBe(true);
        expect(saved.premiumFeatures[featureId].autoRenew).toBe(false);
      });

      it("renews on schedule when balance is sufficient", async () => {
        const pastDate = new Date();
        pastDate.setDate(pastDate.getDate() - 1);

        db.guildSettings.collection = {
          find: vi.fn().mockReturnValue({
            toArray: vi.fn().mockResolvedValue([
              {
                guildId: "g1",
                premiumFeatures: {
                  [featureId]: {
                    active: true,
                    payerUserId: "u1",
                    nextDeductionDate: pastDate,
                    cost,
                    period: "week",
                  },
                },
              },
            ]),
          }),
        };
        db.coreCredits.getByUserId.mockResolvedValue({ credits: cost + 50 });

        await pm.processRenewals();

        expect(db.coreCredits.updateCredits).toHaveBeenCalledWith("u1", -cost);
        expect(db.payments.create).toHaveBeenCalledWith(
          expect.objectContaining({ type: "renewal" }),
        );
      });

      it("disables on disable call", async () => {
        db.guildSettings.getByGuild.mockResolvedValue({
          premiumFeatures: {
            [featureId]: { active: true, payerUserId: "u1" },
          },
        });

        await pm.disableFeature("g1", featureId, { reason: "test_reason" });

        expect(db.guildSettings.set).toHaveBeenCalled();
        const saved = db.guildSettings.set.mock.calls[0][1];
        expect(saved.premiumFeatures[featureId].active).toBe(false);
        expect(saved.premiumFeatures[featureId].disableReason).toBe(
          "test_reason",
        );
      });
    },
  );

  // ─────────────────────────────────────────────────────────────────────────
  // Edge cases
  // ─────────────────────────────────────────────────────────────────────────

  describe("edge cases", () => {
    it("handles DB errors gracefully on activation", async () => {
      storage.getCoreCredits.mockRejectedValue(new Error("DB crash"));
      const result = await pm.activateFeature("g1", "pro_engine", "u1");
      expect(result.success).toBe(false);
      expect(result.message).toMatch(/internal error/i);
    });

    it("handles DB errors gracefully on cancellation", async () => {
      db.guildSettings.getByGuild.mockRejectedValue(new Error("DB crash"));
      const result = await pm.cancelFeature("g1", "pro_engine", "u1");
      expect(result.success).toBe(false);
    });

    it("_sendDM returns false when client is null", async () => {
      pm.setClient(null);
      // Access the private method (JS doesn't enforce privacy)
      const sent = await pm._sendDM("u1", { title: "test" });
      expect(sent).toBe(false);
    });

    it("_sendDM returns false when user.send throws", async () => {
      pm.setClient({
        users: {
          fetch: vi.fn().mockResolvedValue({
            send: vi.fn().mockRejectedValue(new Error("Cannot send DMs")),
          }),
        },
      });
      const sent = await pm._sendDM("u1", { title: "test" });
      expect(sent).toBe(false);
    });

    it("_notify swallows errors silently", async () => {
      const badDb = {
        notifications: {
          create: vi.fn().mockRejectedValue(new Error("Write failed")),
        },
      };
      // Should not throw
      await expect(
        pm._notify(badDb, "u1", {
          type: "test",
          title: "t",
          message: "m",
          icon: "i",
        }),
      ).resolves.toBeUndefined();
    });
  });
});
