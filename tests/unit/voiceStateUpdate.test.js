import {
  describe,
  it,
  expect,
  beforeEach,
  jest,
  beforeAll,
} from "@jest/globals";

// Mock logger - Jest hoists this and resolves from project root
jest.mock("src/utils/logger.js", () => ({
  getLogger: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  })),
}));

// Mock MongoDB directly to prevent real connections
jest.mock("mongodb", () => {
  const mockMongoClient = {
    connect: jest.fn().mockResolvedValue({
      db: jest.fn().mockReturnValue({
        collection: jest.fn().mockReturnValue({
          find: jest.fn(),
          updateOne: jest.fn(),
          deleteOne: jest.fn(),
        }),
      }),
      close: jest.fn().mockResolvedValue(undefined),
    }),
    close: jest.fn().mockResolvedValue(undefined),
  };
  return {
    MongoClient: jest.fn(() => mockMongoClient),
  };
});

// Mock database manager to prevent MongoDB connections
jest.mock("src/utils/storage/databaseManager.js", () => ({
  getDatabaseManager: jest.fn().mockResolvedValue({
    connectionManager: {
      db: null,
      connect: jest.fn().mockResolvedValue(undefined),
    },
  }),
}));

// Mock storage manager to prevent MongoDB connections
jest.mock("src/utils/storage/storageManager.js", () => ({
  getStorageManager: jest.fn().mockResolvedValue({
    save: jest.fn(),
    get: jest.fn(),
    delete: jest.fn(),
    read: jest.fn().mockResolvedValue(null),
    write: jest.fn(),
    isInitialized: true,
  }),
}));

// Mock Core utils to prevent MongoDB connections
jest.mock("src/commands/general/core/utils.js", () => ({
  getUserCorePriority: jest.fn().mockResolvedValue({
    hasCore: false,
    tier: null,
    priority: 0,
  }),
  getCoreRateLimitMultiplier: jest.fn().mockReturnValue(1.0),
}));

// Mock rate limiter to prevent MongoDB connections
jest.mock("src/utils/discord/rateLimiter.js", () => ({
  isRateLimited: jest.fn().mockResolvedValue(false),
}));

// Mock voice tracker - create mock instance outside factory
const mockVoiceTrackerInstance = {
  startVoiceTracking: jest.fn().mockResolvedValue(undefined),
  stopVoiceTracking: jest.fn().mockResolvedValue(undefined),
};

// Mock getVoiceTracker to return our mock instance immediately
jest.mock("src/features/experience/VoiceTracker.js", () => {
  const mockGetVoiceTracker = async () => mockVoiceTrackerInstance;
  return {
    getVoiceTracker: mockGetVoiceTracker,
  };
});

// Import execute after mocks are set up
let execute;
beforeAll(async () => {
  const module = await import("../../src/events/voiceStateUpdate.js");
  execute = module.execute;
});

describe("Voice State Update Event", () => {
  let oldState;
  let newState;
  let mockMember;
  let mockGuild;
  let mockVoiceChannel;
  let mockVoiceTracker;

  beforeEach(async () => {
    jest.clearAllMocks();

    // Use the shared mock instance
    mockVoiceTracker = mockVoiceTrackerInstance;

    // Mock guild first (needed by voice channel)
    mockGuild = {
      id: "guild123",
      name: "Test Guild",
      members: {
        me: {
          permissions: {
            has: jest.fn().mockReturnValue(true),
          },
        },
      },
    };

    // Mock voice channel
    mockVoiceChannel = {
      id: "voice123",
      name: "Voice Channel",
      type: 2, // GUILD_VOICE
      guild: mockGuild,
      permissionsFor: jest.fn().mockReturnValue({
        has: jest.fn().mockReturnValue(true),
      }),
      permissionOverwrites: {
        cache: new Map(),
      },
    };

    // Mock member
    mockMember = {
      id: "member123",
      user: {
        id: "member123",
        tag: "TestUser#1234",
      },
      guild: mockGuild,
      voice: {
        channel: null,
        setMute: jest.fn().mockResolvedValue(undefined),
      },
      fetch: jest.fn().mockResolvedValue(undefined),
    };

    // Mock old state (before change)
    oldState = {
      guild: mockGuild,
      member: mockMember,
      channelId: null,
      channel: null,
      mute: false,
      selfMute: false,
    };

    // Mock new state (after change)
    newState = {
      guild: mockGuild,
      member: mockMember,
      channelId: null,
      channel: null,
      mute: false,
      selfMute: false,
    };
  });

  describe("Voice Channel Join", () => {
    it("should track voice activity when user joins voice channel", async () => {
      // User joins voice channel
      oldState.channelId = null;
      newState.channelId = "voice123";
      newState.channel = mockVoiceChannel;
      mockMember.voice = {
        channel: mockVoiceChannel,
        channelId: "voice123",
      };

      await execute(oldState, newState, {
        voiceTracker: mockVoiceTracker,
      });

      // Verify voice tracking is called
      expect(mockVoiceTracker.startVoiceTracking).toHaveBeenCalled();
    });

    it("should track voice activity when user switches voice channels", async () => {
      // User switches from one channel to another
      oldState.channelId = "voice123";
      oldState.channel = { id: "voice123", name: "Old Channel" };
      newState.channelId = "voice456";
      newState.channel = { id: "voice456", name: "New Channel" };
      mockMember.voice.channel = newState.channel;

      await execute(oldState, newState, {
        voiceTracker: mockVoiceTracker,
      });

      // Verify voice tracking is updated
      expect(mockVoiceTracker.stopVoiceTracking).toHaveBeenCalled();
      expect(mockVoiceTracker.startVoiceTracking).toHaveBeenCalled();
    });

    it("should skip when member is not in a guild", async () => {
      newState.guild = null;
      newState.channelId = "voice123";
      newState.channel = mockVoiceChannel;

      await execute(oldState, newState, {
        voiceTracker: mockVoiceTracker,
      });

      // Should not track when not in guild
      expect(mockVoiceTracker.startVoiceTracking).not.toHaveBeenCalled();
    });

    it("should skip when member is null", async () => {
      newState.member = null;
      newState.channelId = "voice123";
      newState.channel = mockVoiceChannel;

      await execute(oldState, newState, {
        voiceTracker: mockVoiceTracker,
      });

      // Should not track when member is null
      expect(mockVoiceTracker.startVoiceTracking).not.toHaveBeenCalled();
    });
  });

  describe("XP Tracking", () => {
    it("should track voice activity when user joins voice channel", async () => {
      oldState.channelId = null;
      oldState.mute = false;
      oldState.selfMute = false;
      newState.channelId = "voice123";
      newState.channel = mockVoiceChannel;
      newState.mute = false;
      newState.selfMute = false;
      mockMember.voice.channel = mockVoiceChannel;
      mockMember.voice.mute = false;
      mockMember.voice.selfMute = false;

      await execute(oldState, newState, {
        voiceTracker: mockVoiceTracker,
      });

      // Verify voice tracking is called
      expect(mockVoiceTracker.startVoiceTracking).toHaveBeenCalled();
    });

    it("should stop tracking when user leaves voice channel", async () => {
      oldState.channelId = "voice123";
      oldState.channel = mockVoiceChannel;
      newState.channelId = null;
      newState.channel = null;
      mockMember.voice.channel = null;

      await execute(oldState, newState, {
        voiceTracker: mockVoiceTracker,
      });

      expect(mockVoiceTracker.stopVoiceTracking).toHaveBeenCalled();
    });

    it("should update tracking when user switches channels", async () => {
      oldState.channelId = "voice123";
      oldState.channel = { id: "voice123", name: "Old Channel" };
      oldState.mute = false;
      oldState.selfMute = false;
      newState.channelId = "voice456";
      newState.channel = { id: "voice456", name: "New Channel" };
      newState.mute = false;
      newState.selfMute = false;
      mockMember.voice.channel = newState.channel;
      mockMember.voice.mute = false;
      mockMember.voice.selfMute = false;

      await execute(oldState, newState, {
        voiceTracker: mockVoiceTracker,
      });

      // Verify voice tracking is updated
      expect(mockVoiceTracker.stopVoiceTracking).toHaveBeenCalled();
      expect(mockVoiceTracker.startVoiceTracking).toHaveBeenCalled();
    });
  });

  describe("Error Handling", () => {
    it("should handle unexpected errors gracefully", async () => {
      oldState.channelId = null;
      newState.channelId = "voice123";
      newState.channel = mockVoiceChannel;
      mockMember.voice.channel = mockVoiceChannel;

      // Should not throw
      await expect(execute(oldState, newState)).resolves.not.toThrow();
    });

    it("should handle member fetch errors gracefully", async () => {
      oldState.channelId = null;
      newState.channelId = "voice123";
      newState.channel = mockVoiceChannel;
      mockMember.voice.channel = mockVoiceChannel;
      mockMember.fetch.mockRejectedValue(new Error("Fetch failed"));

      // Should not throw
      await expect(execute(oldState, newState)).resolves.not.toThrow();
    });
  });
});
