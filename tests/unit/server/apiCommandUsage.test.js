import { describe, it, expect, vi, beforeEach } from "vitest";
import { apiCommandUsage } from "../../../src/server/controllers/StatsController.js";
import * as commandHandlerModule from "../../../src/utils/core/commandHandler.js";

// Mock the response helpers
vi.mock("../../../src/server/utils/responseHelpers.js", () => ({
  createSuccessResponse: vi.fn(data => ({ status: "success", data })),
  createErrorResponse: vi.fn((message, statusCode) => ({
    statusCode,
    response: { status: "error", message },
  })),
  logRequest: vi.fn(),
}));

// Mock the logger
vi.mock("../../../src/utils/logger.js", () => ({
  getLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

describe("apiCommandUsage", () => {
  let mockReq;
  let mockRes;
  let mockCommandHandler;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock Request
    mockReq = {
      query: {},
      requestId: "test-id",
      method: "GET",
      url: "/api/commands/usage",
    };

    // Mock Response
    mockRes = {
      json: vi.fn().mockReturnThis(),
      status: vi.fn().mockReturnThis(),
    };

    // Mock CommandHandler
    mockCommandHandler = {
      getCommandStats: vi.fn(),
    };

    // Ensure getCommandHandler returns our mock
    vi.spyOn(commandHandlerModule, "getCommandHandler").mockReturnValue(
      mockCommandHandler,
    );
  });

  it("should return empty list when no stats exist", async () => {
    mockCommandHandler.getCommandStats.mockResolvedValue({});

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
    const mockStats = {
      poll: {
        count: 10,
        avgDuration: 100,
        lastUsed: "2026-01-17T00:00:00Z",
        uniqueUsers: 5,
      },
      help: {
        count: 50,
        avgDuration: 50,
        lastUsed: "2026-01-17T01:00:00Z",
        uniqueUsers: 20,
      },
    };
    mockCommandHandler.getCommandStats.mockResolvedValue(mockStats);

    await apiCommandUsage(mockReq, mockRes);

    expect(mockRes.json).toHaveBeenCalled();
    const responseData = mockRes.json.mock.calls[0][0].data;

    // Check sorting (help should be first as it has 50 uses)
    expect(responseData.commands[0].name).toBe("help");
    expect(responseData.commands[1].name).toBe("poll");

    // Check summary
    expect(responseData.summary.totalCommands).toBe(2);
    expect(responseData.summary.totalExecutions).toBe(60);
  });

  it("should filter for a specific command", async () => {
    const mockStats = {
      poll: { count: 10, avgDuration: 100 },
      help: { count: 50, avgDuration: 50 },
    };
    mockCommandHandler.getCommandStats.mockResolvedValue(mockStats);
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
    const mockStats = {
      cmd1: { count: 100 },
      cmd2: { count: 80 },
      cmd3: { count: 60 },
    };
    mockCommandHandler.getCommandStats.mockResolvedValue(mockStats);
    mockReq.query.limit = "2";

    await apiCommandUsage(mockReq, mockRes);

    const responseData = mockRes.json.mock.calls[0][0].data;
    expect(responseData.commands.length).toBe(2);
    expect(responseData.commands[0].name).toBe("cmd1");
    expect(responseData.commands[1].name).toBe("cmd2");
  });

  it("should return 404 for non-existent specific command", async () => {
    mockCommandHandler.getCommandStats.mockResolvedValue({
      help: { count: 1 },
    });
    mockReq.query.command = "ghost";

    await apiCommandUsage(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(404);
  });
});
