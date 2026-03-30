import { describe, it, expect, vi, beforeEach } from "vitest";
import { apiCommandUsage } from "../../../src/server/controllers/StatsController.js";

vi.mock("../../../src/server/utils/responseHelpers.js", () => ({
  createSuccessResponse: vi.fn(data => ({ status: "success", data })),
  createErrorResponse: vi.fn((message, statusCode) => ({
    statusCode,
    response: { status: "error", message },
  })),
  logRequest: vi.fn(),
}));

vi.mock("../../../src/utils/logger.js", () => ({
  getLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock("../../../src/utils/storage/databaseManager.js", () => {
  const mockGetAllStats = vi.fn();
  return {
    getDatabaseManager: vi.fn().mockResolvedValue({
      commandUsage: {
        getAllStats: mockGetAllStats,
      },
    }),
    __mockGetAllStats: mockGetAllStats,
  };
});

vi.mock("../../../src/utils/core/commandHandler.js", () => ({
  getCommandHandler: vi.fn().mockReturnValue({
    commands: new Map([
      ["poll", { disabled: false }],
      ["help", { disabled: false }],
      ["ask", { disabled: true }],
      ["imagine", { disabled: true }],
    ]),
    getCommandStats: vi.fn().mockResolvedValue({}),
  }),
}));

describe("apiCommandUsage", () => {
  let mockReq;
  let mockRes;
  let mockGetAllStats;

  beforeEach(async () => {
    vi.clearAllMocks();

    const dbModule = await import(
      "../../../src/utils/storage/databaseManager.js"
    );
    mockGetAllStats = dbModule.__mockGetAllStats;

    mockReq = {
      query: {},
      requestId: "test-id",
      method: "GET",
      url: "/api/commands/usage",
    };

    mockRes = {
      json: vi.fn().mockReturnThis(),
      status: vi.fn().mockReturnThis(),
    };
  });

  it("should return empty list when no stats exist", async () => {
    mockGetAllStats.mockResolvedValue([]);

    await apiCommandUsage(mockReq, mockRes);

    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          commands: [],
          summary: { totalCommands: 0, totalExecutions: 0 },
        }),
      }),
    );
  });

  it("should return sorted commands and summary", async () => {
    const mockDbStats = [
      {
        name: "poll",
        count: 10,
        avgDuration: 100,
        lastUsed: "2026-01-17T00:00:00Z",
        uniqueUsers: 5,
      },
      {
        name: "help",
        count: 50,
        avgDuration: 50,
        lastUsed: "2026-01-17T01:00:00Z",
        uniqueUsers: 20,
      },
    ];
    mockGetAllStats.mockResolvedValue(mockDbStats);

    await apiCommandUsage(mockReq, mockRes);

    expect(mockRes.json).toHaveBeenCalled();
    const responseData = mockRes.json.mock.calls[0][0].data;

    expect(responseData.commands[0].name).toBe("help");
    expect(responseData.commands[1].name).toBe("poll");

    expect(responseData.summary.totalCommands).toBe(2);
    expect(responseData.summary.totalExecutions).toBe(60);
  });

  it("should filter out disabled commands", async () => {
    const mockDbStats = [
      {
        name: "poll",
        count: 10,
        avgDuration: 100,
        lastUsed: "2026-01-17T00:00:00Z",
        uniqueUsers: 5,
      },
      {
        name: "help",
        count: 50,
        avgDuration: 50,
        lastUsed: "2026-01-17T01:00:00Z",
        uniqueUsers: 20,
      },
      {
        name: "ask",
        count: 5,
        avgDuration: 50,
        lastUsed: "2026-01-17T01:00:00Z",
        uniqueUsers: 3,
      },
      {
        name: "imagine",
        count: 3,
        avgDuration: 100,
        lastUsed: "2026-01-17T01:00:00Z",
        uniqueUsers: 2,
      },
    ];
    mockGetAllStats.mockResolvedValue(mockDbStats);

    await apiCommandUsage(mockReq, mockRes);

    const responseData = mockRes.json.mock.calls[0][0].data;

    expect(responseData.commands.length).toBe(2);
    expect(responseData.commands.map(c => c.name)).toEqual(["help", "poll"]);
  });

  it("should filter for a specific command", async () => {
    const mockDbStats = [
      { name: "poll", count: 10, avgDuration: 100 },
      { name: "help", count: 50, avgDuration: 50 },
    ];
    mockGetAllStats.mockResolvedValue(mockDbStats);
    mockReq.query.command = "poll";

    await apiCommandUsage(mockReq, mockRes);

    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          command: "poll",
          count: 10,
        }),
      }),
    );
  });

  it("should apply limit parameter", async () => {
    const mockDbStats = [
      { name: "cmd1", count: 100 },
      { name: "cmd2", count: 80 },
      { name: "cmd3", count: 60 },
    ];
    mockGetAllStats.mockResolvedValue(mockDbStats);
    mockReq.query.limit = "2";

    await apiCommandUsage(mockReq, mockRes);

    const responseData = mockRes.json.mock.calls[0][0].data;
    expect(responseData.commands.length).toBe(2);
    expect(responseData.commands[0].name).toBe("cmd1");
    expect(responseData.commands[1].name).toBe("cmd2");
  });

  it("should return 404 for non-existent specific command", async () => {
    const mockDbStats = [{ name: "help", count: 1 }];
    mockGetAllStats.mockResolvedValue(mockDbStats);
    mockReq.query.command = "ghost";

    await apiCommandUsage(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(404);
  });

  it("should return sorted data from database", async () => {
    const mockDbStats = [{ name: "poll", count: 10, avgDuration: 100 }];
    mockGetAllStats.mockResolvedValue(mockDbStats);

    await apiCommandUsage(mockReq, mockRes);

    const responseData = mockRes.json.mock.calls[0][0].data;
    expect(responseData.commands[0].name).toBe("poll");
  });
});
