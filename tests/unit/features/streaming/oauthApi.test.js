import { describe, it, expect, vi, beforeEach } from "vitest";
import { updateChannel, searchGame } from "../../../../src/features/streaming/utils/oauth.js";

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// Mock config
vi.mock("../../../../src/config/config.js", () => ({
  config: {
    twitch: {
      clientId: "test-client-id",
      clientSecret: "test-client-secret",
    },
  },
}));

// Mock logger
vi.mock("../../../../src/utils/logger.js", () => ({
  getLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

describe("updateChannel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends PATCH request with title", async () => {
    mockFetch.mockResolvedValue({ ok: true });

    const result = await updateChannel("token123", "user123", { title: "New Title" });

    expect(result).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("https://api.twitch.tv/helix/channels?"),
      expect.objectContaining({
        method: "PATCH",
        headers: expect.objectContaining({
          Authorization: "Bearer token123",
          "Client-Id": "test-client-id",
        }),
      })
    );
  });

  it("sends PATCH request with gameId", async () => {
    mockFetch.mockResolvedValue({ ok: true });

    const result = await updateChannel("token123", "user123", { gameId: "game123" });

    expect(result).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("game_id=game123"),
      expect.anything()
    );
  });

  it("returns false on API error", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ message: "Unauthorized" }),
    });

    const result = await updateChannel("bad-token", "user123", { title: "Test" });

    expect(result).toBe(false);
  });

  it("returns false on network error", async () => {
    mockFetch.mockRejectedValue(new Error("Network error"));

    const result = await updateChannel("token123", "user123", { title: "Test" });

    expect(result).toBe(false);
  });
});

describe("searchGame", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns game ID when found", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [{ id: "game-123", name: "Just Chatting" }] }),
    });

    const result = await searchGame("token123", "Just Chatting");

    expect(result).toBe("game-123");
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("query=Just%20Chatting"),
      expect.anything()
    );
  });

  it("returns null when no results", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [] }),
    });

    const result = await searchGame("token123", "NonexistentGame");

    expect(result).toBeNull();
  });

  it("returns null on API error", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ message: "Bad Request" }),
    });

    const result = await searchGame("token123", "Test");

    expect(result).toBeNull();
  });

  it("returns null on network error", async () => {
    mockFetch.mockRejectedValue(new Error("Network error"));

    const result = await searchGame("token123", "Test");

    expect(result).toBeNull();
  });
});
