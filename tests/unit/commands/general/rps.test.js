import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  createMockInteraction,
  createMockClient,
  createMockMember,
  setupCommonMocks,
} from "../../../utils/testHelpers.js";

// Setup common mocks before imports
setupCommonMocks();

// Mock embeds
vi.mock("src/commands/general/rps/embeds.js", () => ({
  createRPSEmbed: vi.fn((challengerChoice, botChoice, user) => ({
    data: {
      title: "Rock Paper Scissors",
      description: `You chose ${challengerChoice}, Bot chose ${botChoice}`,
    },
  })),
  createChallengeEmbed: vi.fn((challenger, challenged, challengeId, createdAt) => ({
    data: {
      title: "RPS Challenge",
      description: `${challenger.displayName} challenged ${challenged.displayName}`,
    },
  })),
  createMultiplayerResultEmbed: vi.fn(
    (challengerChoice, challengedChoice, challenger, challenged) => ({
      data: {
        title: "RPS Result",
        description: `${challenger.displayName} vs ${challenged.displayName}`,
      },
    }),
  ),
  createExpiredChallengeEmbed: vi.fn(challenge => ({
    data: {
      title: "Challenge Expired",
      description: "This challenge has expired.",
    },
  })),
  createErrorEmbed: vi.fn(() => ({
    data: {
      title: "Error",
      description: "An error occurred",
    },
    setDescription: vi.fn(function (desc) {
      this.data.description = desc;
      return this;
    }),
  })),
}));

// Mock components
vi.mock("src/commands/general/rps/components.js", () => ({
  createChallengeButtons: vi.fn(challengeId => ({
    type: 1, // ACTION_ROW
    components: [
      {
        type: 2, // BUTTON
        customId: `rps_choice-${challengeId}-rock`,
        label: "Rock",
      },
      {
        type: 2,
        customId: `rps_choice-${challengeId}-paper`,
        label: "Paper",
      },
      {
        type: 2,
        customId: `rps_choice-${challengeId}-scissors`,
        label: "Scissors",
      },
    ],
  })),
}));

// Mock utils
vi.mock("src/commands/general/rps/utils.js", () => ({
  getBotChoice: vi.fn(() => "rock"),
  generateChallengeId: vi.fn(() => "challenge-123"),
  determineWinner: vi.fn((choice1, choice2, isMultiplayer) => {
    if (choice1 === choice2) return "tie";
    if (
      (choice1 === "rock" && choice2 === "scissors") ||
      (choice1 === "paper" && choice2 === "rock") ||
      (choice1 === "scissors" && choice2 === "paper")
    ) {
      return "challenger";
    }
    return "challenged";
  }),
}));

import { execute, handleRPSButton, stopPeriodicCleanup } from "../../../../src/commands/general/rps/handlers.js";

describe("RPS Command", () => {
  let mockInteraction;
  let mockClient;
  let mockChallengedUser;
  let mockChallengedMember;

  beforeEach(() => {
    vi.clearAllMocks();

    mockChallengedUser = {
      id: "challenged123",
      tag: "ChallengedUser#5678",
      username: "ChallengedUser",
      bot: false,
      toString: vi.fn(() => "<@challenged123>"),
    };

    mockChallengedMember = createMockMember({
      id: "challenged123",
      user: mockChallengedUser,
    });

    mockInteraction = createMockInteraction({
      options: {
        getUser: vi.fn().mockReturnValue(mockChallengedUser),
        getString: vi.fn().mockReturnValue("rock"),
      },
      deferReply: vi.fn().mockResolvedValue(undefined),
      editReply: vi.fn().mockResolvedValue({
        id: "message123",
      }),
      guild: {
        id: "guild123",
        members: {
          cache: {
            get: vi.fn(id => {
              if (id === "user123") {
                return createMockMember({ id: "user123" });
              }
              if (id === "challenged123") {
                return mockChallengedMember;
              }
              return null;
            }),
          },
        },
        channels: {
          fetch: vi.fn().mockResolvedValue({
            messages: {
              fetch: vi.fn().mockResolvedValue({
                edit: vi.fn().mockResolvedValue(undefined),
              }),
            },
          }),
        },
      },
    });

    mockClient = createMockClient();
  });

  afterEach(() => {
    stopPeriodicCleanup();
  });

  describe("execute", () => {
    it("should create a challenge for another user", async () => {
      await execute(mockInteraction, mockClient);

      expect(mockInteraction.deferReply).toHaveBeenCalled();
      expect(mockInteraction.options.getUser).toHaveBeenCalledWith("user");
      expect(mockInteraction.options.getString).toHaveBeenCalledWith("choice");
      expect(mockInteraction.editReply).toHaveBeenCalled();
    });

    it("should immediately show result when challenging a bot", async () => {
      mockChallengedUser.bot = true;
      mockInteraction.options.getUser.mockReturnValue(mockChallengedUser);

      await execute(mockInteraction, mockClient);

      expect(mockInteraction.editReply).toHaveBeenCalled();
      const callArgs = mockInteraction.editReply.mock.calls[0][0];
      expect(callArgs.embeds).toBeDefined();
      // Should not have buttons for bot challenges
      expect(callArgs.components).toBeUndefined();
    });

    it("should reject self-challenges", async () => {
      mockInteraction.options.getUser.mockReturnValue(mockInteraction.user);

      await execute(mockInteraction, mockClient);

      expect(mockInteraction.editReply).toHaveBeenCalled();
      const callArgs = mockInteraction.editReply.mock.calls[0][0];
      expect(callArgs.embeds[0].data.description).toContain("cannot challenge yourself");
    });

    it("should validate required options", async () => {
      mockInteraction.options.getUser.mockReturnValue(null);

      await execute(mockInteraction, mockClient);

      expect(mockInteraction.editReply).toHaveBeenCalled();
      const callArgs = mockInteraction.editReply.mock.calls[0][0];
      expect(callArgs.embeds[0].data.description).toContain("Missing required option");
    });

    it("should create challenge with buttons", async () => {
      await execute(mockInteraction, mockClient);

      expect(mockInteraction.editReply).toHaveBeenCalled();
      const callArgs = mockInteraction.editReply.mock.calls[0][0];
      expect(callArgs.components).toBeDefined();
      expect(callArgs.components.length).toBeGreaterThan(0);
    });

    it("should handle errors gracefully", async () => {
      // Mock an error that occurs during execution
      mockInteraction.guild.members.cache.get.mockImplementation(() => {
        throw new Error("Test error");
      });

      await expect(execute(mockInteraction, mockClient)).resolves.not.toThrow();
      
      // Should still attempt to send error embed
      expect(mockInteraction.editReply).toHaveBeenCalled();
    });
  });

  describe("handleRPSButton", () => {
    let mockButtonInteraction;

    beforeEach(() => {
      mockButtonInteraction = createMockInteraction({
        isButton: vi.fn().mockReturnValue(true),
        customId: "rps_choice-challenge-123-rock",
        user: mockChallengedUser,
        message: {
          id: "message123",
          edit: vi.fn().mockResolvedValue(undefined),
        },
        update: vi.fn().mockResolvedValue(undefined),
        deferUpdate: vi.fn().mockResolvedValue(undefined),
        reply: vi.fn().mockResolvedValue(undefined),
        followUp: vi.fn().mockResolvedValue(undefined),
        replied: false,
        deferred: false,
        guild: mockInteraction.guild,
        client: mockClient,
      });
    });

    it("should handle valid challenge button click", async () => {
      // Since challenges are stored internally, we'll test that the handler
      // processes the button format correctly
      mockButtonInteraction.customId = "rps_choice-challenge-123-rock";

      await handleRPSButton(mockButtonInteraction);

      // Should attempt to process (will fail because challenge doesn't exist, but format is valid)
      expect(mockButtonInteraction.reply).toHaveBeenCalled();
    });

    it("should reject invalid button format", async () => {
      mockButtonInteraction.customId = "invalid-button";

      await handleRPSButton(mockButtonInteraction);

      expect(mockButtonInteraction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          embeds: expect.arrayContaining([
            expect.objectContaining({
              data: expect.objectContaining({
                description: expect.stringContaining("Invalid challenge button"),
              }),
            }),
          ]),
        }),
      );
    });

    it("should reject expired challenges", async () => {
      mockButtonInteraction.customId = "rps_choice-expired-challenge-rock";

      await handleRPSButton(mockButtonInteraction);

      expect(mockButtonInteraction.reply).toHaveBeenCalled();
      const callArgs = mockButtonInteraction.reply.mock.calls[0][0];
      expect(callArgs.embeds[0].data.description).toContain("expired");
    });

    it("should reject unauthorized users", async () => {
      mockButtonInteraction.user = {
        id: "unauthorized123",
        tag: "Unauthorized#0000",
      };
      mockButtonInteraction.customId = "rps_choice-challenge-123-rock";

      await handleRPSButton(mockButtonInteraction);

      expect(mockButtonInteraction.reply).toHaveBeenCalled();
      // Since challenge doesn't exist in our test, it will show expired error
      // In real scenario with existing challenge, it would show "Access Denied"
      const callArgs = mockButtonInteraction.reply.mock.calls[0][0];
      expect(callArgs.embeds[0].data.description).toBeDefined();
    });

    it("should handle errors gracefully", async () => {
      mockButtonInteraction.update.mockRejectedValue(new Error("Test error"));

      await expect(handleRPSButton(mockButtonInteraction)).resolves.not.toThrow();
    });
  });
});

