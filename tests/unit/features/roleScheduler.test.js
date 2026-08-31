import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock all external dependencies ─────────────────────────────────────────

vi.mock("../../../src/utils/logger.js", () => ({
  getLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock("../../../src/utils/storage/databaseManager.js", () => ({
  getDatabaseManager: vi.fn(),
}));

vi.mock("../../../src/utils/discord/roleManager.js", () => ({
  bulkAddRoles: vi.fn(),
  bulkRemoveRoles: vi.fn(),
  getCachedMember: vi.fn(),
}));

vi.mock("../../../src/features/scheduledRoles/RoleExecutor.js", () => ({
  getRoleExecutor: vi.fn(),
}));

vi.mock("../../../src/commands/general/balance/utils.js", () => ({
  getUsersCorePriority: vi.fn().mockResolvedValue({ hasCore: false, maxTier: null, priority: 0 }),
  sortByCorePriority: vi.fn(),
  logPriorityDistribution: vi.fn(),
}));

// ─── Import the module under test ────────────────────────────────────────────

import { getScheduler } from "../../../src/features/scheduledRoles/RoleScheduler.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildMockClient() {
  return { guilds: { cache: new Map() } };
}

/**
 * Build a Date in LOCAL time from explicit components.
 * This is timezone-safe because setHours/setDate in RoleScheduler also work
 * in local time.
 */
function localDate(year, month, day, hour, minute, second = 0) {
  const d = new Date(year, month - 1, day, hour, minute, second, 0);
  return d;
}

/**
 * Build a minimal recurring-schedule object.
 */
function buildSchedule(overrides = {}) {
  return {
    id: "test-schedule-id",
    guildId: "guild123",
    roleId: "role123",
    action: "assign",
    userIds: ["user1"],
    scheduleType: "weekly",
    scheduleConfig: { dayOfWeek: 2, hour: 10, minute: 0 },
    lastExecutedAt: null,
    createdAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("RoleScheduler – shouldExecuteRecurringSchedule", () => {
  let scheduler;

  beforeEach(() => {
    scheduler = getScheduler(buildMockClient());
  });

  // ── Daily ────────────────────────────────────────────────────────────────

  describe("daily schedules", () => {
    it("returns true when now is just after the scheduled time today (first run)", async () => {
      // Schedule: daily at 09:00 local. now = today at 09:02 local.
      const now = localDate(2026, 7, 22, 9, 2);
      const schedule = buildSchedule({
        scheduleType: "daily",
        scheduleConfig: { type: "daily", hour: 9, minute: 0 },
        lastExecutedAt: null,
      });
      expect(await scheduler.shouldExecuteRecurringSchedule(schedule, now)).toBe(true);
    });

    it("returns true when within the 5-minute window after today's occurrence", async () => {
      const now = localDate(2026, 7, 22, 14, 4, 30);
      const schedule = buildSchedule({
        scheduleType: "daily",
        scheduleConfig: { type: "daily", hour: 14, minute: 0 },
        lastExecutedAt: null,
      });
      expect(await scheduler.shouldExecuteRecurringSchedule(schedule, now)).toBe(true);
    });

    it("returns false when more than 5 minutes have passed since today's occurrence", async () => {
      // 09:07 is 7 minutes after 09:00 — outside the window
      const now = localDate(2026, 7, 22, 9, 7);
      const schedule = buildSchedule({
        scheduleType: "daily",
        scheduleConfig: { type: "daily", hour: 9, minute: 0 },
        lastExecutedAt: null,
      });
      expect(await scheduler.shouldExecuteRecurringSchedule(schedule, now)).toBe(false);
    });

    it("returns false when already executed for today's occurrence (within 1-min guard)", async () => {
      const now = localDate(2026, 7, 22, 9, 1);
      const executedAt = localDate(2026, 7, 22, 9, 0, 30); // ran 30s ago
      const schedule = buildSchedule({
        scheduleType: "daily",
        scheduleConfig: { type: "daily", hour: 9, minute: 0 },
        lastExecutedAt: executedAt.toISOString(),
      });
      expect(await scheduler.shouldExecuteRecurringSchedule(schedule, now)).toBe(false);
    });

    it("returns true when last execution was yesterday (new cycle)", async () => {
      const now = localDate(2026, 7, 22, 9, 1);
      const executedAt = localDate(2026, 7, 21, 9, 0, 30); // yesterday
      const schedule = buildSchedule({
        scheduleType: "daily",
        scheduleConfig: { type: "daily", hour: 9, minute: 0 },
        lastExecutedAt: executedAt.toISOString(),
      });
      expect(await scheduler.shouldExecuteRecurringSchedule(schedule, now)).toBe(true);
    });

    it("returns false when the scheduled time is still in the future today", async () => {
      // 08:00, schedule is at 15:00 — last occurrence was yesterday, far outside window
      const now = localDate(2026, 7, 22, 8, 0);
      const schedule = buildSchedule({
        scheduleType: "daily",
        scheduleConfig: { type: "daily", hour: 15, minute: 0 },
        lastExecutedAt: null,
      });
      expect(await scheduler.shouldExecuteRecurringSchedule(schedule, now)).toBe(false);
    });
  });

  // ── Weekly ───────────────────────────────────────────────────────────────

  describe("weekly schedules", () => {
    // 2026-07-21 is a Tuesday (getDay() === 2)

    it("returns true within 5 minutes after the weekly occurrence (root bug fix)", async () => {
      // THE BUG: old code used getNextExecutionTime which always returns a future
      // date, so timeDiff was always negative → schedule never fired.
      // Schedule: Tuesday 01:53. now = Tuesday 01:54.
      const now = localDate(2026, 7, 21, 1, 54); // Tuesday
      const schedule = buildSchedule({
        scheduleType: "weekly",
        scheduleConfig: { type: "weekly", dayOfWeek: 2, hour: 1, minute: 53 },
        lastExecutedAt: null,
      });
      expect(await scheduler.shouldExecuteRecurringSchedule(schedule, now)).toBe(true);
    });

    it("returns true at the exact scheduled moment", async () => {
      const now = localDate(2026, 7, 21, 1, 53, 0); // exactly Tuesday 01:53
      const schedule = buildSchedule({
        scheduleType: "weekly",
        scheduleConfig: { type: "weekly", dayOfWeek: 2, hour: 1, minute: 53 },
        lastExecutedAt: null,
      });
      expect(await scheduler.shouldExecuteRecurringSchedule(schedule, now)).toBe(true);
    });

    it("returns false when more than 5 minutes have passed since the weekly occurrence", async () => {
      const now = localDate(2026, 7, 21, 1, 59); // 6 min after 01:53
      const schedule = buildSchedule({
        scheduleType: "weekly",
        scheduleConfig: { type: "weekly", dayOfWeek: 2, hour: 1, minute: 53 },
        lastExecutedAt: null,
      });
      expect(await scheduler.shouldExecuteRecurringSchedule(schedule, now)).toBe(false);
    });

    it("returns false when already executed for this week's occurrence (1-min guard)", async () => {
      const now = localDate(2026, 7, 21, 1, 54);
      const executedAt = localDate(2026, 7, 21, 1, 53, 30);
      const schedule = buildSchedule({
        scheduleType: "weekly",
        scheduleConfig: { type: "weekly", dayOfWeek: 2, hour: 1, minute: 53 },
        lastExecutedAt: executedAt.toISOString(),
      });
      expect(await scheduler.shouldExecuteRecurringSchedule(schedule, now)).toBe(false);
    });

    it("returns true when last execution was last week (new cycle)", async () => {
      const now = localDate(2026, 7, 21, 1, 54);
      const executedAt = localDate(2026, 7, 14, 1, 53, 30); // 1 week ago
      const schedule = buildSchedule({
        scheduleType: "weekly",
        scheduleConfig: { type: "weekly", dayOfWeek: 2, hour: 1, minute: 53 },
        lastExecutedAt: executedAt.toISOString(),
      });
      expect(await scheduler.shouldExecuteRecurringSchedule(schedule, now)).toBe(true);
    });

    it("returns false when scheduled day is later this week (not yet reached)", async () => {
      // Wednesday 08:00, schedule is Friday 10:00 → last occurrence last Friday
      const now = localDate(2026, 7, 22, 8, 0); // Wednesday
      const schedule = buildSchedule({
        scheduleType: "weekly",
        scheduleConfig: { type: "weekly", dayOfWeek: 5, hour: 10, minute: 0 }, // Friday
        lastExecutedAt: null,
      });
      expect(await scheduler.shouldExecuteRecurringSchedule(schedule, now)).toBe(false);
    });

    it("returns false when scheduled day is tomorrow", async () => {
      // Wednesday 10:01, schedule is Thursday 10:00
      const now = localDate(2026, 7, 22, 10, 1);
      const schedule = buildSchedule({
        scheduleType: "weekly",
        scheduleConfig: { type: "weekly", dayOfWeek: 4, hour: 10, minute: 0 }, // Thursday
        lastExecutedAt: null,
      });
      expect(await scheduler.shouldExecuteRecurringSchedule(schedule, now)).toBe(false);
    });

    it("does not double-execute within the same 5-minute window (second scheduler tick)", async () => {
      const now = localDate(2026, 7, 21, 1, 54);
      const executedAt = localDate(2026, 7, 21, 1, 53, 45); // ran 15s ago
      const schedule = buildSchedule({
        scheduleType: "weekly",
        scheduleConfig: { type: "weekly", dayOfWeek: 2, hour: 1, minute: 53 },
        lastExecutedAt: executedAt.toISOString(),
      });
      expect(await scheduler.shouldExecuteRecurringSchedule(schedule, now)).toBe(false);
    });
  });

  // ── Monthly ──────────────────────────────────────────────────────────────

  describe("monthly schedules", () => {
    it("returns true within 5 minutes after the monthly occurrence (root bug fix)", async () => {
      const now = localDate(2026, 7, 15, 9, 2); // 15th at 09:02
      const schedule = buildSchedule({
        scheduleType: "monthly",
        scheduleConfig: { type: "monthly", dayOfMonth: 15, hour: 9, minute: 0 },
        lastExecutedAt: null,
      });
      expect(await scheduler.shouldExecuteRecurringSchedule(schedule, now)).toBe(true);
    });

    it("returns true at the exact scheduled moment", async () => {
      const now = localDate(2026, 7, 15, 9, 0, 0);
      const schedule = buildSchedule({
        scheduleType: "monthly",
        scheduleConfig: { type: "monthly", dayOfMonth: 15, hour: 9, minute: 0 },
        lastExecutedAt: null,
      });
      expect(await scheduler.shouldExecuteRecurringSchedule(schedule, now)).toBe(true);
    });

    it("returns false when more than 5 minutes have passed", async () => {
      const now = localDate(2026, 7, 15, 9, 8); // 8 min after 09:00
      const schedule = buildSchedule({
        scheduleType: "monthly",
        scheduleConfig: { type: "monthly", dayOfMonth: 15, hour: 9, minute: 0 },
        lastExecutedAt: null,
      });
      expect(await scheduler.shouldExecuteRecurringSchedule(schedule, now)).toBe(false);
    });

    it("returns false when already executed for this month's occurrence", async () => {
      const now = localDate(2026, 7, 15, 9, 2);
      const executedAt = localDate(2026, 7, 15, 9, 0, 30);
      const schedule = buildSchedule({
        scheduleType: "monthly",
        scheduleConfig: { type: "monthly", dayOfMonth: 15, hour: 9, minute: 0 },
        lastExecutedAt: executedAt.toISOString(),
      });
      expect(await scheduler.shouldExecuteRecurringSchedule(schedule, now)).toBe(false);
    });

    it("returns true when last execution was last month (new cycle)", async () => {
      const now = localDate(2026, 7, 15, 9, 2);
      const executedAt = localDate(2026, 6, 15, 9, 0, 30); // previous month
      const schedule = buildSchedule({
        scheduleType: "monthly",
        scheduleConfig: { type: "monthly", dayOfMonth: 15, hour: 9, minute: 0 },
        lastExecutedAt: executedAt.toISOString(),
      });
      expect(await scheduler.shouldExecuteRecurringSchedule(schedule, now)).toBe(true);
    });

    it("returns false when scheduled day is still in the future this month", async () => {
      // 15th at 09:02, schedule is on the 28th → last occurrence was June 28
      const now = localDate(2026, 7, 15, 9, 2);
      const schedule = buildSchedule({
        scheduleType: "monthly",
        scheduleConfig: { type: "monthly", dayOfMonth: 28, hour: 9, minute: 0 },
        lastExecutedAt: null,
      });
      expect(await scheduler.shouldExecuteRecurringSchedule(schedule, now)).toBe(false);
    });
  });

  // ── Custom interval ──────────────────────────────────────────────────────

  describe("custom interval schedules", () => {
    it("returns true on first run when enough time has elapsed since creation", async () => {
      const createdAt = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2h ago
      const now = new Date();
      const schedule = buildSchedule({
        scheduleType: "custom",
        scheduleConfig: { intervalMinutes: 60 },
        lastExecutedAt: null,
        createdAt: createdAt.toISOString(),
      });
      expect(await scheduler.shouldExecuteRecurringSchedule(schedule, now)).toBe(true);
    });

    it("returns false on first run when not enough time has elapsed since creation", async () => {
      const createdAt = new Date(Date.now() - 30 * 60 * 1000); // 30 min ago
      const now = new Date();
      const schedule = buildSchedule({
        scheduleType: "custom",
        scheduleConfig: { intervalMinutes: 60 },
        lastExecutedAt: null,
        createdAt: createdAt.toISOString(),
      });
      expect(await scheduler.shouldExecuteRecurringSchedule(schedule, now)).toBe(false);
    });

    it("returns true when the interval has passed since last execution", async () => {
      const lastExecutedAt = new Date(Date.now() - 70 * 60 * 1000); // 70 min ago
      const now = new Date();
      const schedule = buildSchedule({
        scheduleType: "custom",
        scheduleConfig: { intervalMinutes: 60 },
        lastExecutedAt: lastExecutedAt.toISOString(),
      });
      expect(await scheduler.shouldExecuteRecurringSchedule(schedule, now)).toBe(true);
    });

    it("returns false when the interval has not yet passed since last execution", async () => {
      const lastExecutedAt = new Date(Date.now() - 30 * 60 * 1000); // 30 min ago
      const now = new Date();
      const schedule = buildSchedule({
        scheduleType: "custom",
        scheduleConfig: { intervalMinutes: 60 },
        lastExecutedAt: lastExecutedAt.toISOString(),
      });
      expect(await scheduler.shouldExecuteRecurringSchedule(schedule, now)).toBe(false);
    });

    it("returns false when executed less than 1 minute ago (duplicate guard)", async () => {
      const lastExecutedAt = new Date(Date.now() - 10 * 1000); // 10s ago
      const now = new Date();
      const schedule = buildSchedule({
        scheduleType: "custom",
        scheduleConfig: { intervalMinutes: 1 },
        lastExecutedAt: lastExecutedAt.toISOString(),
      });
      expect(await scheduler.shouldExecuteRecurringSchedule(schedule, now)).toBe(false);
    });

    it("returns true using 'interval' field (slash command format) when interval has passed", async () => {
      const lastExecutedAt = new Date(Date.now() - 70 * 60 * 1000); // 70 min ago
      const now = new Date();
      const schedule = buildSchedule({
        scheduleType: "custom",
        scheduleConfig: { interval: 60, unit: "minutes" },
        lastExecutedAt: lastExecutedAt.toISOString(),
      });
      expect(await scheduler.shouldExecuteRecurringSchedule(schedule, now)).toBe(true);
    });

    it("returns false using 'interval' field when interval has not passed", async () => {
      const lastExecutedAt = new Date(Date.now() - 30 * 60 * 1000); // 30 min ago
      const now = new Date();
      const schedule = buildSchedule({
        scheduleType: "custom",
        scheduleConfig: { interval: 60, unit: "minutes" },
        lastExecutedAt: lastExecutedAt.toISOString(),
      });
      expect(await scheduler.shouldExecuteRecurringSchedule(schedule, now)).toBe(false);
    });

    it("returns true on first run using 'interval' field when enough time has elapsed", async () => {
      const createdAt = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2h ago
      const now = new Date();
      const schedule = buildSchedule({
        scheduleType: "custom",
        scheduleConfig: { interval: 60, unit: "minutes" },
        lastExecutedAt: null,
        createdAt: createdAt.toISOString(),
      });
      expect(await scheduler.shouldExecuteRecurringSchedule(schedule, now)).toBe(true);
    });

    it("falls back to 60 minutes when neither intervalMinutes nor interval is set", async () => {
      const createdAt = new Date(Date.now() - 90 * 60 * 1000); // 90 min ago
      const now = new Date();
      const schedule = buildSchedule({
        scheduleType: "custom",
        scheduleConfig: {},
        lastExecutedAt: null,
        createdAt: createdAt.toISOString(),
      });
      expect(await scheduler.shouldExecuteRecurringSchedule(schedule, now)).toBe(true);
    });
  });

  // ── Edge cases ───────────────────────────────────────────────────────────

  describe("edge cases", () => {
    it("returns false when scheduleConfig is null", async () => {
      const schedule = buildSchedule({ scheduleConfig: null });
      expect(await scheduler.shouldExecuteRecurringSchedule(schedule, new Date())).toBe(false);
    });

    it("returns false for an unknown schedule type", async () => {
      const schedule = buildSchedule({
        scheduleType: "biweekly",
        scheduleConfig: { dayOfWeek: 1, hour: 10, minute: 0 },
      });
      expect(await scheduler.shouldExecuteRecurringSchedule(schedule, new Date())).toBe(false);
    });
  });
});
