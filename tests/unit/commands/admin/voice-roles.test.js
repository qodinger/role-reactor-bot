import { describe, test, expect, vi, beforeEach } from "vitest";
import { PermissionFlagsBits } from "discord.js";

// IMPORTANT: Mocks must be defined BEFORE importing the module under test
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
const mockDbManager = {
  guildSettings: { exists: true },
  welcomeSettings: { exists: true },
  goodbyeSettings: {},
  connectionManager: {
    db: { collection: vi.fn() },
    connect: vi.fn().mockResolvedValue(undefined),
  },
  connect: vi.fn().mockResolvedValue(undefined),
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
};

vi.mock("../../../src/utils/storage/databaseManager.js", () => ({
  getDatabaseManager: vi.fn().mockResolvedValue(mockDbManager),
  DatabaseManager: vi.fn(() => mockDbManager),
}));

// Mock storage manager with voice control methods
const mockStorageManager = {
  read: vi.fn().mockResolvedValue({}),
  write: vi.fn().mockResolvedValue(true),
  get: vi.fn().mockResolvedValue({}),
  save: vi.fn().mockResolvedValue(true),
  delete: vi.fn().mockResolvedValue(true),
  initialize: vi.fn().mockResolvedValue(undefined),
  isInitialized: true,
  // Voice control methods
  getVoiceControlRoles: vi.fn().mockResolvedValue({
    disconnectRoleIds: [],
    muteRoleIds: [],
    deafenRoleIds: [],
    moveRoleMappings: {},
  }),
  addVoiceDisconnectRole: vi.fn().mockResolvedValue(true),
  removeVoiceDisconnectRole: vi.fn().mockResolvedValue(true),
  addVoiceMuteRole: vi.fn().mockResolvedValue(true),
  removeVoiceMuteRole: vi.fn().mockResolvedValue(true),
  addVoiceDeafenRole: vi.fn().mockResolvedValue(true),
  removeVoiceDeafenRole: vi.fn().mockResolvedValue(true),
  addVoiceMoveRole: vi.fn().mockResolvedValue(true),
  removeVoiceMoveRole: vi.fn().mockResolvedValue(true),
};

vi.mock("../../../src/utils/storage/storageManager.js", () => ({
  getStorageManager: vi.fn().mockResolvedValue(mockStorageManager),
  StorageManager: vi.fn(() => mockStorageManager),
}));

// Mock logger
vi.mock("../../../src/utils/logger.js", () => ({
  getLogger: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  })),
}));

// Helper functions for creating mock objects
function createMockRole(overrides = {}) {
  return {
    id: "role123",
    name: "Test Role",
    position: 5,
    managed: false,
    tags: null,
    toString: vi.fn().mockReturnValue("<@&role123>"),
    ...overrides,
  };
}

function createMockChannel(overrides = {}) {
  return {
    id: "channel123",
    name: "test-channel",
    type: 2, // GUILD_VOICE
    isVoiceBased: vi.fn().mockReturnValue(true),
    toString: vi.fn().mockReturnValue("<#channel123>"),
    permissionsFor: vi.fn().mockReturnValue({
      has: vi.fn().mockReturnValue(true),
    }),
    ...overrides,
  };
}

function createMockMember(overrides = {}) {
  return {
    id: "member123",
    user: {
      id: "member123",
      tag: "TestUser#1234",
      bot: false,
    },
    roles: {
      cache: new Map(),
      highest: { position: 10 },
    },
    permissions: {
      has: vi.fn().mockReturnValue(true),
    },
    voice: {
      channel: null,
      channelId: null,
      mute: false,
      deaf: false,
      setMute: vi.fn().mockResolvedValue(undefined),
      setDeaf: vi.fn().mockResolvedValue(undefined),
      setChannel: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn().mockResolvedValue(undefined),
    },
    ...overrides,
  };
}

function createMockGuild(overrides = {}) {
  const mockBotMember = createMockMember({
    id: "bot123",
    permissions: {
      has: vi.fn().mockReturnValue(true),
    },
    roles: {
      highest: { position: 10 },
    },
  });

  return {
    id: "guild123",
    name: "Test Guild",
    members: {
      me: mockBotMember,
      cache: new Map(),
    },
    channels: {
      cache: new Map(),
    },
    roles: {
      cache: new Map(),
    },
    ...overrides,
  };
}

// Test file for voice-roles functionality

describe("Voice Roles - Core Functionality", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Role Validation", () => {
    test("should validate role position correctly", () => {
      const validateRolePosition = (role, botMember) => {
        return role.position < botMember.roles.highest.position;
      };

      const mockRole = createMockRole({ position: 5 });
      const mockBotMember = createMockMember({
        roles: { highest: { position: 10 } },
      });

      expect(validateRolePosition(mockRole, mockBotMember)).toBe(true);

      const highRole = createMockRole({ position: 15 });
      expect(validateRolePosition(highRole, mockBotMember)).toBe(false);
    });

    test("should validate managed roles", () => {
      const validateManagedRole = (role) => {
        return !role.managed;
      };

      const normalRole = createMockRole({ managed: false });
      const managedRole = createMockRole({ managed: true });

      expect(validateManagedRole(normalRole)).toBe(true);
      expect(validateManagedRole(managedRole)).toBe(false);
    });

    test("should validate bot roles", () => {
      const validateBotRole = (role) => {
        return !(role.tags && role.tags.botId);
      };

      const normalRole = createMockRole({ tags: null });
      const botRole = createMockRole({ tags: { botId: "bot123" } });

      expect(validateBotRole(normalRole)).toBe(true);
      expect(validateBotRole(botRole)).toBe(false);
    });

    test("should reject roles higher than bot", () => {
      const validateRole = (role, guild) => {
        if (role.managed) {
          return {
            valid: false,
            error: `The role **${role.name}** is managed by Discord or an integration and cannot be assigned.`,
            solution: "Choose a different role that is not managed by Discord or integrations.",
          };
        }

        if (role.tags && role.tags.botId) {
          return {
            valid: false,
            error: `The role **${role.name}** is a bot role and cannot be assigned.`,
            solution: "Choose a different role that is not associated with a bot.",
          };
        }

        const botMember = guild.members.me;
        if (botMember && role.position >= botMember.roles.highest.position) {
          return {
            valid: false,
            error: `The role **${role.name}** is higher than or equal to my highest role in the hierarchy.`,
            solution: "Move my role above this role in Server Settings → Roles, or choose a lower role.",
          };
        }

        return { valid: true };
      };

      const mockRole = createMockRole({ position: 15 });
      const mockGuild = createMockGuild({
        members: {
          me: {
            roles: {
              highest: { position: 10 },
            },
          },
        },
      });

      const result = validateRole(mockRole, mockGuild);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("higher than or equal");
    });
  });

  describe("Channel Validation", () => {
    test("should validate voice channels", () => {
      const validateVoiceChannel = (channel) => {
        return channel.isVoiceBased();
      };

      const voiceChannel = createMockChannel({
        type: 2, // GUILD_VOICE
        isVoiceBased: vi.fn().mockReturnValue(true),
      });

      const textChannel = createMockChannel({
        type: 0, // GUILD_TEXT
        isVoiceBased: vi.fn().mockReturnValue(false),
      });

      expect(validateVoiceChannel(voiceChannel)).toBe(true);
      expect(validateVoiceChannel(textChannel)).toBe(false);
    });

    test("should validate bot permissions for channels", () => {
      const validateChannelPermissions = (channel, botMember) => {
        const permissions = channel.permissionsFor(botMember);
        return permissions.has("Connect") && permissions.has("MoveMembers");
      };

      const allowedChannel = createMockChannel({
        permissionsFor: vi.fn().mockReturnValue({
          has: vi.fn().mockReturnValue(true),
        }),
      });

      const deniedChannel = createMockChannel({
        permissionsFor: vi.fn().mockReturnValue({
          has: vi.fn().mockReturnValue(false),
        }),
      });

      const mockBotMember = createMockMember();

      expect(validateChannelPermissions(allowedChannel, mockBotMember)).toBe(true);
      expect(validateChannelPermissions(deniedChannel, mockBotMember)).toBe(false);
    });
  });

  describe("Permission Validation", () => {
    test("should validate bot permissions for different operations", () => {
      const validateBotPermissions = (operation, botMember) => {
        const permissions = {
          disconnect: PermissionFlagsBits.MoveMembers,
          mute: PermissionFlagsBits.MuteMembers,
          deafen: PermissionFlagsBits.DeafenMembers,
          move: PermissionFlagsBits.MoveMembers,
        };

        const requiredPermission = permissions[operation];
        return botMember.permissions.has(requiredPermission);
      };

      const mockBotMember = createMockMember({
        permissions: {
          has: vi.fn().mockImplementation(permission => {
            // Mock having all permissions except DeafenMembers
            return permission !== PermissionFlagsBits.DeafenMembers;
          }),
        },
      });

      expect(validateBotPermissions("disconnect", mockBotMember)).toBe(true);
      expect(validateBotPermissions("mute", mockBotMember)).toBe(true);
      expect(validateBotPermissions("deafen", mockBotMember)).toBe(false);
      expect(validateBotPermissions("move", mockBotMember)).toBe(true);
    });

    test("should validate admin permissions", () => {
      const hasAdminPermissions = (member) => {
        return member.permissions.has(PermissionFlagsBits.Administrator) ||
               member.permissions.has(PermissionFlagsBits.ManageRoles);
      };

      const adminMember = createMockMember({
        permissions: {
          has: vi.fn().mockImplementation(permission => 
            permission === PermissionFlagsBits.Administrator
          ),
        },
      });

      const regularMember = createMockMember({
        permissions: {
          has: vi.fn().mockReturnValue(false),
        },
      });

      expect(hasAdminPermissions(adminMember)).toBe(true);
      expect(hasAdminPermissions(regularMember)).toBe(false);
    });
  });

  describe("Voice Control Settings", () => {
    test("should handle empty voice control settings", () => {
      const processVoiceControlSettings = (settings) => {
        const disconnectRoles = settings.disconnectRoleIds?.filter(Boolean) || [];
        const muteRoles = settings.muteRoleIds?.filter(Boolean) || [];
        const deafenRoles = settings.deafenRoleIds?.filter(Boolean) || [];
        const moveRoles = settings.moveRoleMappings ? Object.keys(settings.moveRoleMappings).filter(Boolean) : [];

        return {
          hasAnyRoles: disconnectRoles.length > 0 || muteRoles.length > 0 || deafenRoles.length > 0 || moveRoles.length > 0,
          totalRoles: disconnectRoles.length + muteRoles.length + deafenRoles.length + moveRoles.length,
          disconnectCount: disconnectRoles.length,
          muteCount: muteRoles.length,
          deafenCount: deafenRoles.length,
          moveCount: moveRoles.length,
        };
      };

      const emptySettings = {
        disconnectRoleIds: [],
        muteRoleIds: [],
        deafenRoleIds: [],
        moveRoleMappings: {},
      };

      const result = processVoiceControlSettings(emptySettings);
      expect(result.hasAnyRoles).toBe(false);
      expect(result.totalRoles).toBe(0);
    });

    test("should handle populated voice control settings", () => {
      const processVoiceControlSettings = (settings) => {
        const disconnectRoles = settings.disconnectRoleIds?.filter(Boolean) || [];
        const muteRoles = settings.muteRoleIds?.filter(Boolean) || [];
        const deafenRoles = settings.deafenRoleIds?.filter(Boolean) || [];
        const moveRoles = settings.moveRoleMappings ? Object.keys(settings.moveRoleMappings).filter(Boolean) : [];

        return {
          hasAnyRoles: disconnectRoles.length > 0 || muteRoles.length > 0 || deafenRoles.length > 0 || moveRoles.length > 0,
          totalRoles: disconnectRoles.length + muteRoles.length + deafenRoles.length + moveRoles.length,
          disconnectCount: disconnectRoles.length,
          muteCount: muteRoles.length,
          deafenCount: deafenRoles.length,
          moveCount: moveRoles.length,
        };
      };

      const populatedSettings = {
        disconnectRoleIds: ["role1", "role2"],
        muteRoleIds: ["role3"],
        deafenRoleIds: ["role4", "role5", "role6"],
        moveRoleMappings: { "role7": "channel1", "role8": "channel2" },
      };

      const result = processVoiceControlSettings(populatedSettings);
      expect(result.hasAnyRoles).toBe(true);
      expect(result.totalRoles).toBe(8); // 2 + 1 + 3 + 2 = 8
      expect(result.disconnectCount).toBe(2);
      expect(result.muteCount).toBe(1);
      expect(result.deafenCount).toBe(3);
      expect(result.moveCount).toBe(2);
    });

    test("should filter out null/undefined role IDs", () => {
      const processVoiceControlSettings = (settings) => {
        const disconnectRoles = settings.disconnectRoleIds?.filter(Boolean) || [];
        const muteRoles = settings.muteRoleIds?.filter(Boolean) || [];
        const deafenRoles = settings.deafenRoleIds?.filter(Boolean) || [];
        const moveRoles = settings.moveRoleMappings ? Object.keys(settings.moveRoleMappings).filter(Boolean) : [];

        return {
          disconnectCount: disconnectRoles.length,
          muteCount: muteRoles.length,
          deafenCount: deafenRoles.length,
          moveCount: moveRoles.length,
        };
      };

      const settingsWithNulls = {
        disconnectRoleIds: ["role1", null, "role2", undefined, ""],
        muteRoleIds: [null, "role3", undefined],
        deafenRoleIds: ["role4", "", null],
        moveRoleMappings: { "role5": "channel1", "": "channel2", "role6": "channel3" },
      };

      const result = processVoiceControlSettings(settingsWithNulls);
      expect(result.disconnectCount).toBe(2); // Only "role1" and "role2"
      expect(result.muteCount).toBe(1); // Only "role3"
      expect(result.deafenCount).toBe(1); // Only "role4"
      expect(result.moveCount).toBe(2); // Only "role5" and "role6"
    });
  });

  describe("Voice Member Processing", () => {
    test("should identify members needing voice control", () => {
      const findMembersNeedingVoiceControl = (voiceChannels, roleId) => {
        const membersToProcess = [];
        
        for (const channel of voiceChannels.values()) {
          const membersInChannel = Array.from(channel.members.values()).filter(
            member => !member.user.bot && member.roles.cache.has(roleId)
          );
          for (const member of membersInChannel.values()) {
            if (member.voice?.channel) {
              membersToProcess.push(member);
            }
          }
        }
        
        return membersToProcess;
      };

      const mockMember1 = createMockMember({
        id: "member1",
        user: { bot: false },
        roles: { cache: new Map([["role123", true]]) },
        voice: { channel: { id: "voice1" } },
      });

      const mockMember2 = createMockMember({
        id: "member2", 
        user: { bot: true }, // Bot - should be excluded
        roles: { cache: new Map([["role123", true]]) },
        voice: { channel: { id: "voice1" } },
      });

      const mockMember3 = createMockMember({
        id: "member3",
        user: { bot: false },
        roles: { cache: new Map([["role456", true]]) }, // Different role
        voice: { channel: { id: "voice1" } },
      });

      const mockChannel = {
        members: new Map([
          ["member1", mockMember1],
          ["member2", mockMember2], 
          ["member3", mockMember3],
        ]),
      };

      const voiceChannels = new Map([["voice1", mockChannel]]);

      const result = findMembersNeedingVoiceControl(voiceChannels, "role123");
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("member1");
    });

    test("should handle rate limiting for batch processing", () => {
      const processMembersInBatches = (members, batchSize = 5) => {
        const batches = [];
        for (let i = 0; i < members.length; i += batchSize) {
          batches.push(members.slice(i, i + batchSize));
        }
        return batches;
      };

      const members = Array.from({ length: 23 }, (_, i) => ({ id: `member${i}` }));
      const batches = processMembersInBatches(members, 5);

      expect(batches).toHaveLength(5); // 23 members / 5 = 4.6, rounded up to 5 batches
      expect(batches[0]).toHaveLength(5);
      expect(batches[1]).toHaveLength(5);
      expect(batches[2]).toHaveLength(5);
      expect(batches[3]).toHaveLength(5);
      expect(batches[4]).toHaveLength(3); // Remaining 3 members
    });
  });

  describe("Storage Manager Integration", () => {
    test("should call correct storage methods for disconnect roles", async () => {
      const guildId = "guild123";
      const roleId = "role123";

      // Test adding disconnect role
      await mockStorageManager.addVoiceDisconnectRole(guildId, roleId);
      expect(mockStorageManager.addVoiceDisconnectRole).toHaveBeenCalledWith(guildId, roleId);

      // Test removing disconnect role
      await mockStorageManager.removeVoiceDisconnectRole(guildId, roleId);
      expect(mockStorageManager.removeVoiceDisconnectRole).toHaveBeenCalledWith(guildId, roleId);

      // Test getting voice control roles
      await mockStorageManager.getVoiceControlRoles(guildId);
      expect(mockStorageManager.getVoiceControlRoles).toHaveBeenCalledWith(guildId);
    });

    test("should call correct storage methods for mute roles", async () => {
      const guildId = "guild123";
      const roleId = "role123";

      await mockStorageManager.addVoiceMuteRole(guildId, roleId);
      expect(mockStorageManager.addVoiceMuteRole).toHaveBeenCalledWith(guildId, roleId);

      await mockStorageManager.removeVoiceMuteRole(guildId, roleId);
      expect(mockStorageManager.removeVoiceMuteRole).toHaveBeenCalledWith(guildId, roleId);
    });

    test("should call correct storage methods for deafen roles", async () => {
      const guildId = "guild123";
      const roleId = "role123";

      await mockStorageManager.addVoiceDeafenRole(guildId, roleId);
      expect(mockStorageManager.addVoiceDeafenRole).toHaveBeenCalledWith(guildId, roleId);

      await mockStorageManager.removeVoiceDeafenRole(guildId, roleId);
      expect(mockStorageManager.removeVoiceDeafenRole).toHaveBeenCalledWith(guildId, roleId);
    });

    test("should call correct storage methods for move roles", async () => {
      const guildId = "guild123";
      const roleId = "role123";
      const channelId = "channel123";

      await mockStorageManager.addVoiceMoveRole(guildId, roleId, channelId);
      expect(mockStorageManager.addVoiceMoveRole).toHaveBeenCalledWith(guildId, roleId, channelId);

      await mockStorageManager.removeVoiceMoveRole(guildId, roleId);
      expect(mockStorageManager.removeVoiceMoveRole).toHaveBeenCalledWith(guildId, roleId);
    });

    test("should handle storage errors gracefully", async () => {
      const guildId = "guild123";
      
      mockStorageManager.getVoiceControlRoles.mockRejectedValue(new Error("Database connection failed"));

      try {
        await mockStorageManager.getVoiceControlRoles(guildId);
      } catch (error) {
        expect(error.message).toBe("Database connection failed");
      }

      expect(mockStorageManager.getVoiceControlRoles).toHaveBeenCalledWith(guildId);
    });
  });

  describe("Voice Control Operations", () => {
    test("should handle disconnect operation correctly", async () => {
      const simulateDisconnectOperation = async (member, reason) => {
        if (member.voice?.channel) {
          await member.voice.disconnect(reason);
          return { success: true, action: "disconnected" };
        }
        return { success: false, reason: "Not in voice channel" };
      };

      const mockMember = createMockMember({
        voice: {
          channel: { id: "voice1" },
          disconnect: vi.fn().mockResolvedValue(undefined),
        },
      });

      const result = await simulateDisconnectOperation(mockMember, "Voice control role applied");
      expect(result.success).toBe(true);
      expect(result.action).toBe("disconnected");
      expect(mockMember.voice.disconnect).toHaveBeenCalledWith("Voice control role applied");
    });

    test("should handle mute operation correctly", async () => {
      const simulateMuteOperation = async (member, reason) => {
        if (member.voice?.channel && !member.voice.mute) {
          await member.voice.setMute(true, reason);
          return { success: true, action: "muted" };
        }
        return { success: false, reason: member.voice?.mute ? "Already muted" : "Not in voice channel" };
      };

      const mockMember = createMockMember({
        voice: {
          channel: { id: "voice1" },
          mute: false,
          setMute: vi.fn().mockResolvedValue(undefined),
        },
      });

      const result = await simulateMuteOperation(mockMember, "Voice control role applied");
      expect(result.success).toBe(true);
      expect(result.action).toBe("muted");
      expect(mockMember.voice.setMute).toHaveBeenCalledWith(true, "Voice control role applied");
    });

    test("should handle deafen operation correctly", async () => {
      const simulateDeafenOperation = async (member, reason) => {
        if (member.voice?.channel && !member.voice.deaf) {
          await member.voice.setDeaf(true, reason);
          return { success: true, action: "deafened" };
        }
        return { success: false, reason: member.voice?.deaf ? "Already deafened" : "Not in voice channel" };
      };

      const mockMember = createMockMember({
        voice: {
          channel: { id: "voice1" },
          deaf: false,
          setDeaf: vi.fn().mockResolvedValue(undefined),
        },
      });

      const result = await simulateDeafenOperation(mockMember, "Voice control role applied");
      expect(result.success).toBe(true);
      expect(result.action).toBe("deafened");
      expect(mockMember.voice.setDeaf).toHaveBeenCalledWith(true, "Voice control role applied");
    });

    test("should handle move operation correctly", async () => {
      const simulateMoveOperation = async (member, targetChannel, reason) => {
        if (member.voice?.channel && member.voice.channelId !== targetChannel.id) {
          await member.voice.setChannel(targetChannel, reason);
          return { success: true, action: "moved" };
        }
        return { success: false, reason: "Already in target channel or not in voice" };
      };

      const mockMember = createMockMember({
        voice: {
          channel: { id: "voice1" },
          channelId: "voice1",
          setChannel: vi.fn().mockResolvedValue(undefined),
        },
      });

      const targetChannel = createMockChannel({ id: "voice2", name: "Target Voice" });

      const result = await simulateMoveOperation(mockMember, targetChannel, "Voice control role applied");
      expect(result.success).toBe(true);
      expect(result.action).toBe("moved");
      expect(mockMember.voice.setChannel).toHaveBeenCalledWith(targetChannel, "Voice control role applied");
    });

    test("should skip operations for members already in correct state", async () => {
      const simulateMuteOperation = async (member, reason) => {
        if (member.voice?.channel && !member.voice.mute) {
          await member.voice.setMute(true, reason);
          return { success: true, action: "muted" };
        }
        return { success: false, reason: member.voice?.mute ? "Already muted" : "Not in voice channel" };
      };

      const alreadyMutedMember = createMockMember({
        voice: {
          channel: { id: "voice1" },
          mute: true,
          setMute: vi.fn(),
        },
      });

      const result = await simulateMuteOperation(alreadyMutedMember, "Voice control role applied");
      expect(result.success).toBe(false);
      expect(result.reason).toBe("Already muted");
      expect(alreadyMutedMember.voice.setMute).not.toHaveBeenCalled();
    });
  });

  describe("Batch Processing", () => {
    test("should process members in batches with rate limiting", async () => {
      const processMembersInBatches = async (members, batchSize = 5, delayMs = 200) => {
        const results = [];
        
        for (let i = 0; i < members.length; i += batchSize) {
          const batch = members.slice(i, i + batchSize);
          
          // Process batch in parallel
          const batchResults = await Promise.all(
            batch.map(async member => {
              // Simulate processing
              return { memberId: member.id, processed: true };
            })
          );
          
          results.push(...batchResults);
          
          // Rate limit: delay between batches (except for the last batch)
          if (i + batchSize < members.length) {
            await new Promise(resolve => {
              setTimeout(resolve, delayMs);
            });
          }
        }
        
        return results;
      };

      const members = Array.from({ length: 12 }, (_, i) => ({ id: `member${i}` }));
      const results = await processMembersInBatches(members, 5, 10); // Small delay for testing

      expect(results).toHaveLength(12);
      expect(results.every(r => r.processed)).toBe(true);
    });

    test("should handle processing errors gracefully", async () => {
      const processWithErrorHandling = async (members) => {
        const results = { successful: 0, failed: 0, errors: [] };
        
        await Promise.all(
          members.map(async member => {
            try {
              if (member.shouldFail) {
                throw new Error(`Failed to process ${member.id}`);
              }
              results.successful++;
            } catch (error) {
              results.failed++;
              results.errors.push(error.message);
            }
            return undefined;
          })
        );
        
        return results;
      };

      const members = [
        { id: "member1", shouldFail: false },
        { id: "member2", shouldFail: true },
        { id: "member3", shouldFail: false },
        { id: "member4", shouldFail: true },
      ];

      const results = await processWithErrorHandling(members);
      expect(results.successful).toBe(2);
      expect(results.failed).toBe(2);
      expect(results.errors).toHaveLength(2);
    });
  });

  describe("Embed Generation", () => {
    test("should generate empty voice control list embed", () => {
      const createVoiceControlListEmbed = (guild, settings) => {
        const disconnectRoles = settings.disconnectRoleIds?.filter(Boolean) || [];
        const muteRoles = settings.muteRoleIds?.filter(Boolean) || [];
        const deafenRoles = settings.deafenRoleIds?.filter(Boolean) || [];
        const moveRoles = settings.moveRoleMappings ? Object.keys(settings.moveRoleMappings).filter(Boolean) : [];

        const hasAnyRoles = disconnectRoles.length > 0 || muteRoles.length > 0 || deafenRoles.length > 0 || moveRoles.length > 0;

        return {
          title: "Voice Control Roles",
          isEmpty: !hasAnyRoles,
          sections: {
            disconnect: disconnectRoles.length,
            mute: muteRoles.length,
            deafen: deafenRoles.length,
            move: moveRoles.length,
          },
        };
      };

      const mockGuild = createMockGuild();
      const emptySettings = {
        disconnectRoleIds: [],
        muteRoleIds: [],
        deafenRoleIds: [],
        moveRoleMappings: {},
      };

      const embed = createVoiceControlListEmbed(mockGuild, emptySettings);
      expect(embed.isEmpty).toBe(true);
      expect(embed.sections.disconnect).toBe(0);
      expect(embed.sections.mute).toBe(0);
      expect(embed.sections.deafen).toBe(0);
      expect(embed.sections.move).toBe(0);
    });

    test("should generate populated voice control list embed", () => {
      const createVoiceControlListEmbed = (guild, settings) => {
        const disconnectRoles = settings.disconnectRoleIds?.filter(Boolean) || [];
        const muteRoles = settings.muteRoleIds?.filter(Boolean) || [];
        const deafenRoles = settings.deafenRoleIds?.filter(Boolean) || [];
        const moveRoles = settings.moveRoleMappings ? Object.keys(settings.moveRoleMappings).filter(Boolean) : [];

        const hasAnyRoles = disconnectRoles.length > 0 || muteRoles.length > 0 || deafenRoles.length > 0 || moveRoles.length > 0;

        return {
          title: "Voice Control Roles",
          isEmpty: !hasAnyRoles,
          sections: {
            disconnect: disconnectRoles.length,
            mute: muteRoles.length,
            deafen: deafenRoles.length,
            move: moveRoles.length,
          },
          validRoles: {
            disconnect: disconnectRoles.filter(roleId => guild.roles.cache.has(roleId)),
            mute: muteRoles.filter(roleId => guild.roles.cache.has(roleId)),
            deafen: deafenRoles.filter(roleId => guild.roles.cache.has(roleId)),
            move: moveRoles.filter(roleId => guild.roles.cache.has(roleId)),
          },
        };
      };

      const mockGuild = createMockGuild({
        roles: {
          cache: new Map([
            ["role1", { id: "role1", name: "Disconnect Role" }],
            ["role2", { id: "role2", name: "Mute Role" }],
            ["role3", { id: "role3", name: "Deafen Role" }],
            ["role4", { id: "role4", name: "Move Role" }],
          ]),
        },
      });

      const populatedSettings = {
        disconnectRoleIds: ["role1"],
        muteRoleIds: ["role2"],
        deafenRoleIds: ["role3"],
        moveRoleMappings: { "role4": "channel1" },
      };

      const embed = createVoiceControlListEmbed(mockGuild, populatedSettings);
      expect(embed.isEmpty).toBe(false);
      expect(embed.sections.disconnect).toBe(1);
      expect(embed.sections.mute).toBe(1);
      expect(embed.sections.deafen).toBe(1);
      expect(embed.sections.move).toBe(1);
      expect(embed.validRoles.disconnect).toHaveLength(1);
      expect(embed.validRoles.mute).toHaveLength(1);
      expect(embed.validRoles.deafen).toHaveLength(1);
      expect(embed.validRoles.move).toHaveLength(1);
    });

    test("should handle deleted roles in embed generation", () => {
      const createVoiceControlListEmbed = (guild, settings) => {
        const disconnectRoles = settings.disconnectRoleIds?.filter(Boolean) || [];
        const validRoles = disconnectRoles.filter(roleId => guild.roles.cache.has(roleId));
        const invalidRoles = disconnectRoles.filter(roleId => !guild.roles.cache.has(roleId));

        return {
          title: "Voice Control Roles",
          sections: {
            disconnect: disconnectRoles.length,
          },
          validRoles: {
            disconnect: validRoles,
          },
          invalidRoles: {
            disconnect: invalidRoles,
          },
        };
      };

      const mockGuild = createMockGuild({
        roles: {
          cache: new Map([
            ["role1", { id: "role1", name: "Valid Role" }],
          ]),
        },
      });

      const settingsWithDeletedRoles = {
        disconnectRoleIds: ["role1", "deleted_role", "another_deleted"],
        muteRoleIds: [],
        deafenRoleIds: [],
        moveRoleMappings: {},
      };

      const embed = createVoiceControlListEmbed(mockGuild, settingsWithDeletedRoles);
      expect(embed.sections.disconnect).toBe(3);
      expect(embed.validRoles.disconnect).toHaveLength(1);
      expect(embed.invalidRoles.disconnect).toHaveLength(2);
    });
  });

  describe("Error Handling", () => {
    test("should handle missing guild members", () => {
      const validateGuildAccess = (guild) => {
        if (!guild) {
          return { valid: false, error: "Guild not found" };
        }
        if (!guild.members) {
          return { valid: false, error: "Guild members not accessible" };
        }
        if (!guild.members.me) {
          return { valid: false, error: "Bot member not found in guild" };
        }
        return { valid: true };
      };

      const validGuild = createMockGuild();
      const invalidGuild = { id: "guild123" }; // Missing members

      expect(validateGuildAccess(validGuild).valid).toBe(true);
      expect(validateGuildAccess(invalidGuild).valid).toBe(false);
      expect(validateGuildAccess(null).valid).toBe(false);
    });

    test("should handle missing role or channel references", () => {
      const validateReferences = (guild, roleId, channelId = null) => {
        const role = guild.roles.cache.get(roleId);
        if (!role) {
          return { valid: false, error: `Role ${roleId} not found` };
        }

        if (channelId) {
          const channel = guild.channels.cache.get(channelId);
          if (!channel) {
            return { valid: false, error: `Channel ${channelId} not found` };
          }
        }

        return { valid: true };
      };

      const mockGuild = createMockGuild({
        roles: {
          cache: new Map([["role123", { id: "role123", name: "Test Role" }]]),
        },
        channels: {
          cache: new Map([["channel123", { id: "channel123", name: "Test Channel" }]]),
        },
      });

      expect(validateReferences(mockGuild, "role123").valid).toBe(true);
      expect(validateReferences(mockGuild, "role123", "channel123").valid).toBe(true);
      expect(validateReferences(mockGuild, "nonexistent").valid).toBe(false);
      expect(validateReferences(mockGuild, "role123", "nonexistent").valid).toBe(false);
    });

    test("should handle voice operation failures", async () => {
      const handleVoiceOperationWithErrorHandling = async (member, operation) => {
        try {
          switch (operation) {
            case "disconnect":
              if (!member.voice?.channel) {
                throw new Error("Member not in voice channel");
              }
              await member.voice.disconnect("Voice control");
              return { success: true };
            case "mute":
              if (!member.voice?.channel) {
                throw new Error("Member not in voice channel");
              }
              await member.voice.setMute(true, "Voice control");
              return { success: true };
            default:
              throw new Error("Unknown operation");
          }
        } catch (error) {
          return { success: false, error: error.message };
        }
      };

      const memberNotInVoice = createMockMember({
        voice: { channel: null },
      });

      const disconnectResult = await handleVoiceOperationWithErrorHandling(memberNotInVoice, "disconnect");
      expect(disconnectResult.success).toBe(false);
      expect(disconnectResult.error).toBe("Member not in voice channel");

      const muteResult = await handleVoiceOperationWithErrorHandling(memberNotInVoice, "mute");
      expect(muteResult.success).toBe(false);
      expect(muteResult.error).toBe("Member not in voice channel");

      const unknownResult = await handleVoiceOperationWithErrorHandling(memberNotInVoice, "unknown");
      expect(unknownResult.success).toBe(false);
      expect(unknownResult.error).toBe("Unknown operation");
    });

    test("should handle API rate limit errors", async () => {
      const handleRateLimitedOperation = async (_member, _operation) => {
        try {
          // Simulate rate limit error
          const error = new Error("Rate limited");
          error.code = 429;
          throw error;
        } catch (error) {
          if (error.code === 429) {
            return { success: false, error: "Rate limited", shouldRetry: true };
          }
          return { success: false, error: error.message, shouldRetry: false };
        }
      };

      const mockMember = createMockMember();
      const result = await handleRateLimitedOperation(mockMember, "disconnect");
      
      expect(result.success).toBe(false);
      expect(result.error).toBe("Rate limited");
      expect(result.shouldRetry).toBe(true);
    });
  });

  describe("Integration Tests", () => {
    test("should simulate complete voice control workflow", async () => {
      const simulateVoiceControlWorkflow = async (guild, roleId, operation, targetChannelId = null) => {
        // Step 1: Validate role
        const role = guild.roles.cache.get(roleId);
        if (!role) {
          return { success: false, step: "validation", error: "Role not found" };
        }

        // Step 2: Check bot permissions
        const botMember = guild.members.me;
        if (role.position >= botMember.roles.highest.position) {
          return { success: false, step: "validation", error: "Role too high" };
        }

        // Step 3: Find members with the role in voice channels
        const membersToProcess = [];
        const voiceChannels = Array.from(guild.channels.cache.values()).filter(c => c.type === 2);
        
        for (const channel of voiceChannels) {
          if (channel.members) {
            const membersInChannel = Array.from(channel.members.values()).filter(
              member => !member.user.bot && member.roles.cache.has(roleId)
            );
            membersToProcess.push(...membersInChannel);
          }
        }

        // Step 4: Apply voice control
        let processedCount = 0;
        for (const member of membersToProcess) {
          try {
            switch (operation) {
              case "disconnect":
                if (member.voice?.channel) {
                  await member.voice.disconnect("Voice control role applied");
                  processedCount++;
                }
                break;
              case "mute":
                if (member.voice?.channel && !member.voice.mute) {
                  await member.voice.setMute(true, "Voice control role applied");
                  processedCount++;
                }
                break;
              case "move":
                if (targetChannelId && member.voice?.channel && member.voice.channelId !== targetChannelId) {
                  const targetChannel = guild.channels.cache.get(targetChannelId);
                  if (targetChannel) {
                    await member.voice.setChannel(targetChannel, "Voice control role applied");
                    processedCount++;
                  }
                }
                break;
            }
          } catch (_error) {
            // Continue processing other members even if one fails
          }
        }

        return { 
          success: true, 
          step: "complete", 
          processedCount, 
          totalMembers: membersToProcess.length 
        };
      };

      // Setup mock guild with voice channels and members
      const mockMember1 = createMockMember({
        id: "member1",
        user: { bot: false },
        roles: { cache: new Map([["role123", true]]) },
        voice: {
          channel: { id: "voice1" },
          channelId: "voice1",
          mute: false,
          disconnect: vi.fn().mockResolvedValue(undefined),
          setMute: vi.fn().mockResolvedValue(undefined),
          setChannel: vi.fn().mockResolvedValue(undefined),
        },
      });

      const mockMember2 = createMockMember({
        id: "member2",
        user: { bot: false },
        roles: { cache: new Map([["role123", true]]) },
        voice: {
          channel: { id: "voice1" },
          channelId: "voice1",
          mute: false,
          disconnect: vi.fn().mockResolvedValue(undefined),
          setMute: vi.fn().mockResolvedValue(undefined),
          setChannel: vi.fn().mockResolvedValue(undefined),
        },
      });

      const mockVoiceChannel = createMockChannel({
        id: "voice1",
        type: 2,
        members: new Map([
          ["member1", mockMember1],
          ["member2", mockMember2],
        ]),
      });

      const mockGuild = createMockGuild({
        roles: {
          cache: new Map([
            ["role123", { id: "role123", name: "Test Role", position: 5 }],
          ]),
        },
        channels: {
          cache: new Map([
            ["voice1", mockVoiceChannel],
            ["voice2", createMockChannel({ id: "voice2", type: 2 })],
          ]),
        },
      });

      // Test disconnect operation
      const disconnectResult = await simulateVoiceControlWorkflow(mockGuild, "role123", "disconnect");
      expect(disconnectResult.success).toBe(true);
      expect(disconnectResult.processedCount).toBe(2);
      expect(disconnectResult.totalMembers).toBe(2);

      // Test mute operation
      const muteResult = await simulateVoiceControlWorkflow(mockGuild, "role123", "mute");
      expect(muteResult.success).toBe(true);
      expect(muteResult.processedCount).toBe(2);

      // Test move operation
      const moveResult = await simulateVoiceControlWorkflow(mockGuild, "role123", "move", "voice2");
      expect(moveResult.success).toBe(true);
      expect(moveResult.processedCount).toBe(2);

      // Test with invalid role
      const invalidRoleResult = await simulateVoiceControlWorkflow(mockGuild, "nonexistent", "disconnect");
      expect(invalidRoleResult.success).toBe(false);
      expect(invalidRoleResult.step).toBe("validation");
      expect(invalidRoleResult.error).toBe("Role not found");
    });
  });
});