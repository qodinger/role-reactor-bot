import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ─── Mock Dependencies ──────────────────────────────────────────────────────

const HOURS = 60 * 60 * 1000;

const makeDoc = (overrides = {}) => ({
  userId: "u1",
  sparks: 10,
  credits: 5,
  lastVote: Date.now() - 13 * HOURS,
  totalVotes: 2,
  voteStreak: 1,
  ...overrides,
});

const mockDbManager = {
  coreCredits: {
    collection: {
      findOne: vi.fn(),
      updateOne: vi.fn().mockResolvedValue({ acknowledged: true }),
    },
    updateSparks: vi.fn().mockResolvedValue(true),
  },
  payments: {
    create: vi.fn().mockResolvedValue({}),
  },
  notifications: {
    create: vi.fn().mockResolvedValue({}),
  },
};

vi.mock("../../../src/utils/storage/databaseManager.js", () => ({
  getDatabaseManager: vi.fn().mockResolvedValue(mockDbManager),
}));

vi.mock("../../../src/utils/logger.js", () => ({
  getLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock("../../../src/utils/core/BotContext.js", () => ({
  getBotContext: () => ({ client: null }),
}));

// ─── Import AFTER mocks ─────────────────────────────────────────────────────

const { getVoteStatus } = await import("../../../src/webhooks/topgg.js");

// ─── Helpers ────────────────────────────────────────────────────────────────

function mockTopggApiVoted(voted) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ voted }),
  });
}

function mockTopggApiDown() {
  global.fetch = vi.fn().mockRejectedValue(new Error("network down"));
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("topgg getVoteStatus — missed-webhook self-heal", () => {
  let originalEnv;

  beforeEach(() => {
    vi.clearAllMocks();
    originalEnv = { ...process.env };
    process.env.TOPGG_API_TOKEN = "test-token";
    process.env.DISCORD_CLIENT_ID = "1392714201558159431";
    mockDbManager.coreCredits.collection.findOne.mockResolvedValue(makeDoc());
  });

  afterEach(() => {
    process.env = originalEnv;
    delete global.fetch;
  });

  it("credits the reward when top.gg says voted but DB shows no recent reward", async () => {
    // lastVote 13h ago (older than cooldown), top.gg says voted in last 12h
    // => a vote happened that our webhook missed. Streak: 13h < 36h => streak 2 => 5 sparks
    mockTopggApiVoted(1);
    const staleDoc = makeDoc();
    mockDbManager.coreCredits.collection.findOne
      .mockResolvedValueOnce(staleDoc) // initial status read
      .mockResolvedValueOnce(staleDoc) // processVote cooldown read
      .mockResolvedValueOnce(
        makeDoc({ lastVote: Date.now(), totalVotes: 3, voteStreak: 2 })
      ); // heal re-read

    const status = await getVoteStatus("u1");

    expect(mockDbManager.coreCredits.updateSparks).toHaveBeenCalledWith("u1", 5);
    expect(mockDbManager.coreCredits.collection.updateOne).toHaveBeenCalledWith(
      { userId: "u1" },
      expect.objectContaining({
        $set: expect.objectContaining({
          totalVotes: 3,
          voteStreak: 2,
        }),
      }),
      { upsert: true }
    );
    expect(status.hasVoted).toBe(true);
    expect(status.canVote).toBe(false);
    expect(status.totalVotes).toBe(3);
  });

  it("does NOT credit when DB already shows a recent reward (webhook worked)", async () => {
    mockTopggApiVoted(1);
    mockDbManager.coreCredits.collection.findOne.mockResolvedValue(
      makeDoc({ lastVote: Date.now() - 1 * HOURS })
    );

    const status = await getVoteStatus("u1");

    expect(mockDbManager.coreCredits.updateSparks).not.toHaveBeenCalled();
    expect(status.hasVoted).toBe(true);
    expect(status.canVote).toBe(false);
  });

  it("does NOT credit when top.gg says user has not voted", async () => {
    mockTopggApiVoted(0);
    mockDbManager.coreCredits.collection.findOne.mockResolvedValue(
      makeDoc({ lastVote: Date.now() - 13 * HOURS })
    );

    const status = await getVoteStatus("u1");

    expect(mockDbManager.coreCredits.updateSparks).not.toHaveBeenCalled();
    expect(status.hasVoted).toBe(false);
    expect(status.canVote).toBe(true);
  });

  it("falls back to DB when top.gg API is unavailable (no heal attempt)", async () => {
    mockTopggApiDown();
    mockDbManager.coreCredits.collection.findOne.mockResolvedValue(
      makeDoc({ lastVote: Date.now() - 1 * HOURS })
    );

    const status = await getVoteStatus("u1");

    expect(mockDbManager.coreCredits.updateSparks).not.toHaveBeenCalled();
    expect(status.hasVoted).toBe(true);
    expect(status.canVote).toBe(false);
  });

  it("credits first-ever vote even without a DB record", async () => {
    mockTopggApiVoted(1);
    // No document at all until heal (upsert), then healed doc appears
    mockDbManager.coreCredits.collection.findOne
      .mockResolvedValueOnce(null) // initial status read
      .mockResolvedValueOnce(null) // processVote cooldown read
      .mockResolvedValueOnce(
        makeDoc({ lastVote: Date.now(), totalVotes: 1, voteStreak: 1 })
      ); // heal re-read

    const status = await getVoteStatus("u1");

    expect(mockDbManager.coreCredits.updateSparks).toHaveBeenCalledWith("u1", 5);
    expect(status.totalVotes).toBe(1);
  });

  it("concurrent status calls only credit the reward once", async () => {
    mockTopggApiVoted(1);

    const [statusA, statusB] = await Promise.all([
      getVoteStatus("u1"),
      getVoteStatus("u1"),
    ]);

    expect(mockDbManager.coreCredits.updateSparks).toHaveBeenCalledTimes(1);
    expect(statusA).toBeDefined();
    expect(statusB).toBeDefined();
  });

  it("logs and continues when retroactive credit fails", async () => {
    mockTopggApiVoted(1);
    mockDbManager.coreCredits.updateSparks.mockRejectedValueOnce(
      new Error("db write failed")
    );
    // processVote's updateSparks throws → caught inside getVoteStatus heal block

    const status = await getVoteStatus("u1");

    // Should still return a valid status object (DB fallback path, lastVote 13h old)
    expect(status).toBeDefined();
    expect(typeof status.canVote).toBe("boolean");
  });
});
