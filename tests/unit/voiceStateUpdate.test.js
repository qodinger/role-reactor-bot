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
  }),
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

// Mock voice restrictions utility
const mockEnforceVoiceRestrictions = jest.fn();
jest.mock("src/utils/discord/voiceRestrictions.js", () => ({
  enforceVoiceRestrictions: jest.fn((...args) =>
    mockEnforceVoiceRestrictions(...args),
  ),
}));

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

    // Default mock for enforceVoiceRestrictions
    mockEnforceVoiceRestrictions.mockResolvedValue({
      disconnected: false,
      muted: false,
      unmuted: false,
    });
  });

  describe("Voice Channel Join", () => {
    it("should enforce voice restrictions when user joins voice channel", async () => {
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
        enforceVoiceRestrictions: mockEnforceVoiceRestrictions,
      });

      // Should enforce restrictions when user joins
      expect(mockEnforceVoiceRestrictions).toHaveBeenCalledWith(
        mockMember,
        "User joined voice channel",
      );
    });

    it("should enforce voice restrictions when user switches voice channels", async () => {
      // User switches from one channel to another
      oldState.channelId = "voice123";
      oldState.channel = { id: "voice123", name: "Old Channel" };
      newState.channelId = "voice456";
      newState.channel = { id: "voice456", name: "New Channel" };
      mockMember.voice.channel = newState.channel;

      await execute(oldState, newState, {
        voiceTracker: mockVoiceTracker,
        enforceVoiceRestrictions: mockEnforceVoiceRestrictions,
      });

      expect(mockEnforceVoiceRestrictions).toHaveBeenCalledWith(
        mockMember,
        "User switched voice channels",
      );
    });

    it("should skip when member is not in a guild", async () => {
      newState.guild = null;
      newState.channelId = "voice123";
      newState.channel = mockVoiceChannel;

      await execute(oldState, newState, {
        voiceTracker: mockVoiceTracker,
        enforceVoiceRestrictions: mockEnforceVoiceRestrictions,
      });

      expect(mockEnforceVoiceRestrictions).not.toHaveBeenCalled();
    });

    it("should skip when member is null", async () => {
      newState.member = null;
      newState.channelId = "voice123";
      newState.channel = mockVoiceChannel;

      await execute(oldState, newState, {
        voiceTracker: mockVoiceTracker,
        enforceVoiceRestrictions: mockEnforceVoiceRestrictions,
      });

      expect(mockEnforceVoiceRestrictions).not.toHaveBeenCalled();
    });
  });

  describe("Voice Restriction Enforcement", () => {
    it("should disconnect user when Connect restriction exists", async () => {
      oldState.channelId = null;
      newState.channelId = "voice123";
      newState.channel = mockVoiceChannel;
      mockMember.voice.channel = mockVoiceChannel;

      mockEnforceVoiceRestrictions.mockResolvedValue({
        disconnected: true,
        muted: false,
        unmuted: false,
      });

      await execute(oldState, newState, {
        voiceTracker: mockVoiceTracker,
        enforceVoiceRestrictions: mockEnforceVoiceRestrictions,
      });

      expect(mockEnforceVoiceRestrictions).toHaveBeenCalledWith(
        mockMember,
        "User joined voice channel",
      );
    });

    it("should mute user when Speak restriction exists", async () => {
      oldState.channelId = null;
      newState.channelId = "voice123";
      newState.channel = mockVoiceChannel;
      mockMember.voice.channel = mockVoiceChannel;

      mockEnforceVoiceRestrictions.mockResolvedValue({
        disconnected: false,
        muted: true,
        unmuted: false,
      });

      await execute(oldState, newState, {
        voiceTracker: mockVoiceTracker,
        enforceVoiceRestrictions: mockEnforceVoiceRestrictions,
      });

      expect(mockEnforceVoiceRestrictions).toHaveBeenCalled();
    });

    it("should handle errors from voice restriction enforcement gracefully", async () => {
      oldState.channelId = null;
      newState.channelId = "voice123";
      newState.channel = mockVoiceChannel;
      mockMember.voice.channel = mockVoiceChannel;

      mockEnforceVoiceRestrictions.mockResolvedValue({
        disconnected: false,
        muted: false,
        unmuted: false,
        error: "Missing permissions",
      });

      // Should not throw
      await expect(
        execute(oldState, newState, {
          voiceTracker: mockVoiceTracker,
          enforceVoiceRestrictions: mockEnforceVoiceRestrictions,
        }),
      ).resolves.not.toThrow();

      expect(mockEnforceVoiceRestrictions).toHaveBeenCalled();
    });
  });

  describe("Unmute Logic", () => {
    it("should check for unmute when user is muted but not self-muted", async () => {
      // User is in voice and muted (not self-muted)
      oldState.channelId = "voice123";
      oldState.channel = mockVoiceChannel;
      oldState.mute = true;
      oldState.selfMute = false;

      newState.channelId = "voice123";
      newState.channel = mockVoiceChannel;
      newState.mute = true;
      newState.selfMute = false;

      mockMember.voice.channel = mockVoiceChannel;

      // No restrictive Speak role - should unmute
      mockEnforceVoiceRestrictions.mockResolvedValue({
        disconnected: false,
        muted: false,
        unmuted: true,
      });

      await execute(oldState, newState, {
        voiceTracker: mockVoiceTracker,
        enforceVoiceRestrictions: mockEnforceVoiceRestrictions,
      });

      // Should check for unmute (enforceVoiceRestrictions handles unmute)
      expect(mockEnforceVoiceRestrictions).toHaveBeenCalled();
    });

    it("should skip unmute check when user is self-muted", async () => {
      // User is self-muted - should not check unmute (implementation skips when selfMute is true)
      oldState.channelId = "voice123";
      oldState.channel = mockVoiceChannel;
      oldState.mute = false;
      oldState.selfMute = true;

      newState.channelId = "voice123";
      newState.channel = mockVoiceChannel;
      newState.mute = false;
      newState.selfMute = true;

      mockMember.voice.channel = mockVoiceChannel;

      await execute(oldState, newState, {
        voiceTracker: mockVoiceTracker,
        enforceVoiceRestrictions: mockEnforceVoiceRestrictions,
      });

      // Should not check restrictions when user is self-muted (implementation condition: mute && !selfMute)
      expect(mockEnforceVoiceRestrictions).not.toHaveBeenCalled();
    });

    it("should skip unmute check when user is not muted", async () => {
      // User is not muted - should not check unmute (implementation only checks when mute is true)
      oldState.channelId = "voice123";
      oldState.channel = mockVoiceChannel;
      oldState.mute = false;
      oldState.selfMute = false;

      newState.channelId = "voice123";
      newState.channel = mockVoiceChannel;
      newState.mute = false;
      newState.selfMute = false;

      mockMember.voice.channel = mockVoiceChannel;

      await execute(oldState, newState, {
        voiceTracker: mockVoiceTracker,
        enforceVoiceRestrictions: mockEnforceVoiceRestrictions,
      });

      // Should not check restrictions when user is not muted (implementation condition: mute && !selfMute)
      expect(mockEnforceVoiceRestrictions).not.toHaveBeenCalled();
    });
  });

  describe("XP Tracking", () => {
    it("should track voice activity when user joins voice channel", async () => {
      oldState.channelId = null;
      newState.channelId = "voice123";
      newState.channel = mockVoiceChannel;
      mockMember.voice.channel = mockVoiceChannel;

      await execute(oldState, newState, {
        voiceTracker: mockVoiceTracker,
        enforceVoiceRestrictions: mockEnforceVoiceRestrictions,
      });

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
        enforceVoiceRestrictions: mockEnforceVoiceRestrictions,
      });

      expect(mockVoiceTracker.stopVoiceTracking).toHaveBeenCalled();
    });

    it("should update tracking when user switches channels", async () => {
      oldState.channelId = "voice123";
      oldState.channel = { id: "voice123", name: "Old Channel" };
      newState.channelId = "voice456";
      newState.channel = { id: "voice456", name: "New Channel" };
      mockMember.voice.channel = newState.channel;

      await execute(oldState, newState, {
        voiceTracker: mockVoiceTracker,
        enforceVoiceRestrictions: mockEnforceVoiceRestrictions,
      });

      expect(mockVoiceTracker.startVoiceTracking).toHaveBeenCalled();
    });
  });

  describe("Error Handling", () => {
    it("should handle unexpected errors gracefully", async () => {
      oldState.channelId = null;
      newState.channelId = "voice123";
      newState.channel = mockVoiceChannel;
      mockMember.voice.channel = mockVoiceChannel;

      mockEnforceVoiceRestrictions.mockRejectedValue(
        new Error("Unexpected error"),
      );

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
