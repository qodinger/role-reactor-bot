import { describe, it, expect, beforeEach, vi, beforeAll } from "vitest";

// Mock logger - Jest hoists this and resolves from project root
vi.mock("src/utils/logger.js", () => ({
  getLogger: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  })),
}));

// Mock MongoDB directly to prevent real connections
vi.mock("mongodb", () => {
  const mockCollection = {
    find: vi.fn().mockReturnValue({
      toArray: vi.fn().mockResolvedValue([]),
    }),
    findOne: vi.fn().mockResolvedValue(null),
    insertOne: vi.fn().mockResolvedValue({ insertedId: "mock-id" }),
    updateOne: vi.fn().mockResolvedValue({ modifiedCount: 1 }),
    replaceOne: vi.fn().mockResolvedValue({ modifiedCount: 1 }),
    deleteOne: vi.fn().mockResolvedValue({ deletedCount: 1 }),
    deleteMany: vi.fn().mockResolvedValue({ deletedCount: 0 }),
    createIndex: vi.fn().mockResolvedValue({}),
  };
  const mockDb = {
    collection: vi.fn().mockReturnValue(mockCollection),
    admin: vi.fn().mockReturnValue({
      ping: vi.fn().mockResolvedValue({}),
    }),
  };
  const mockMongoClient = {
    connect: vi.fn().mockResolvedValue({
      db: vi.fn().mockReturnValue(mockDb),
      close: vi.fn().mockResolvedValue(undefined),
    }),
    db: vi.fn().mockReturnValue(mockDb),
    close: vi.fn().mockResolvedValue(undefined),
  };
  class MongoClient {
    constructor() {
      Object.assign(this, mockMongoClient);
    }
  }
  return {
    MongoClient,
  };
});

// Mock database manager to prevent MongoDB connections
vi.mock("src/utils/storage/databaseManager.js", () => ({
  getDatabaseManager: vi.fn().mockResolvedValue({
    connectionManager: {
      db: null,
      connect: vi.fn().mockResolvedValue(undefined),
    },
  }),
}));

// Mock storage manager to prevent MongoDB connections
vi.mock("src/utils/storage/storageManager.js", () => ({
  getStorageManager: vi.fn().mockResolvedValue({
    save: vi.fn(),
    get: vi.fn(),
    delete: vi.fn(),
    read: vi.fn().mockResolvedValue(null),
    write: vi.fn(),
    getVoiceControlRoles: vi.fn().mockResolvedValue({
      guildId: "guild123",
      disconnectRoleIds: [],
      muteRoleIds: [],
      deafenRoleIds: [],
      moveRoleMappings: {},
      updatedAt: new Date(),
    }),
    isInitialized: true,
  }),
}));

// Mock Core utils to prevent MongoDB connections
vi.mock("src/commands/general/core/utils.js", () => ({
  getUserCorePriority: vi.fn().mockResolvedValue({
    hasCore: false,
    tier: null,
    priority: 0,
  }),
  getCoreRateLimitMultiplier: vi.fn().mockReturnValue(1.0),
}));

// Mock rate limiter to prevent MongoDB connections
vi.mock("src/utils/discord/rateLimiter.js", () => ({
  isRateLimited: vi.fn().mockResolvedValue(false),
}));

// Mock voice tracker - create mock instance outside factory
const mockVoiceTrackerInstance = {
  startVoiceTracking: vi.fn().mockResolvedValue(undefined),
  stopVoiceTracking: vi.fn().mockResolvedValue(undefined),
};

// Mock getVoiceTracker to return our mock instance immediately
vi.mock("src/features/experience/VoiceTracker.js", () => {
  const mockGetVoiceTracker = async () => mockVoiceTrackerInstance;
  return {
    getVoiceTracker: mockGetVoiceTracker,
  };
});

// Import execute after mocks are set up
let execute;
beforeAll(async () => {
  const module = await import("../../../src/events/voiceStateUpdate.js");
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
    vi.clearAllMocks();

    // Use the shared mock instance
    mockVoiceTracker = mockVoiceTrackerInstance;

    // Mock guild first (needed by voice channel)
    mockGuild = {
      id: "guild123",
      name: "Test Guild",
      members: {
        me: {
          permissions: {
            has: vi.fn().mockReturnValue(true),
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
      permissionsFor: vi.fn().mockReturnValue({
        has: vi.fn().mockReturnValue(true),
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
        setMute: vi.fn().mockResolvedValue(undefined),
      },
      fetch: vi.fn().mockResolvedValue(undefined),
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
