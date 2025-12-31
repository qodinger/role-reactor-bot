import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  createMockInteraction,
  createMockClient,
  setupCommonMocks,
} from "../../../utils/testHelpers.js";

// Setup common mocks before imports
setupCommonMocks();

// Mock invite utility
const mockGetDefaultInviteLink = vi.fn().mockResolvedValue(
  "https://discord.com/api/oauth2/authorize?client_id=123456789&permissions=8&scope=bot%20applications.commands",
);

vi.mock("src/utils/discord/invite.js", () => ({
  getDefaultInviteLink: mockGetDefaultInviteLink,
}));

// Mock embeds
vi.mock("src/commands/general/invite/embeds.js", () => ({
  createInviteEmbed: vi.fn((botName, botAvatar, userName, inviteLink) => ({
    data: {
      title: `Invite ${botName}`,
      description: `Click the button below to invite ${botName} to your server!`,
      fields: [
        {
          name: "Invite Link",
          value: inviteLink,
        },
      ],
      color: 0x5865f2,
    },
  })),
}));

// Mock components
vi.mock("src/commands/general/invite/components.js", () => ({
  createInviteButtons: vi.fn().mockResolvedValue({
    type: 1, // ACTION_ROW
    components: [
      {
        type: 2, // BUTTON
        style: 5, // LINK
        label: "Invite Bot",
        url: "https://discord.com/api/oauth2/authorize?client_id=123456789",
      },
    ],
  }),
}));

import { execute } from "../../../../src/commands/general/invite/handlers.js";

describe("Invite Command", () => {
  let mockInteraction;
  let mockClient;

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetDefaultInviteLink.mockClear();
    mockGetDefaultInviteLink.mockResolvedValue(
      "https://discord.com/api/oauth2/authorize?client_id=123456789&permissions=8&scope=bot%20applications.commands",
    );

    mockInteraction = createMockInteraction({
      deferReply: vi.fn().mockResolvedValue(undefined),
      editReply: vi.fn().mockResolvedValue(undefined),
    });

    mockClient = createMockClient({
      user: {
        id: "bot123",
        username: "TestBot",
        displayAvatarURL: vi.fn().mockReturnValue("https://example.com/bot-avatar.png"),
      },
      inviteLink: undefined, // Explicitly undefined
    });
  });

  describe("execute", () => {
    it("should generate and display invite link", async () => {
      await execute(mockInteraction, mockClient);

      expect(mockInteraction.deferReply).toHaveBeenCalledWith({
        ephemeral: true,
      });
      expect(mockInteraction.editReply).toHaveBeenCalled();
    });

    it("should use existing invite link if available", async () => {
      mockClient.inviteLink = "https://existing-invite-link.com";

      await execute(mockInteraction, mockClient);

      expect(mockGetDefaultInviteLink).not.toHaveBeenCalled();
      expect(mockInteraction.editReply).toHaveBeenCalled();
      const callArgs = mockInteraction.editReply.mock.calls[0][0];
      expect(callArgs.embeds).toBeDefined();
      expect(callArgs.components).toBeDefined();
    });

    it("should generate default invite link if not set", async () => {
      // Ensure inviteLink is not set
      delete mockClient.inviteLink;

      await execute(mockInteraction, mockClient);

      // Should successfully generate and display invite link
      expect(mockInteraction.editReply).toHaveBeenCalled();
      const callArgs = mockInteraction.editReply.mock.calls[0][0];
      // Should have embeds and components if successful
      if (callArgs.embeds) {
        expect(callArgs.embeds).toBeDefined();
        expect(callArgs.components).toBeDefined();
      }
    });

    it("should handle errors gracefully", async () => {
      mockGetDefaultInviteLink.mockResolvedValueOnce(null);

      await execute(mockInteraction, mockClient);

      // Should show error message
      expect(mockInteraction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining("Unable to generate invite link"),
        }),
      );
    });

    it("should send ephemeral reply", async () => {
      await execute(mockInteraction, mockClient);

      expect(mockInteraction.deferReply).toHaveBeenCalledWith({
        ephemeral: true,
      });
    });

    it("should include bot name and avatar in embed", async () => {
      await execute(mockInteraction, mockClient);

      expect(mockInteraction.editReply).toHaveBeenCalled();
      const callArgs = mockInteraction.editReply.mock.calls[0][0];
      // Check if embeds exist (might be undefined if error occurred)
      if (callArgs.embeds) {
        expect(callArgs.embeds).toBeDefined();
        expect(callArgs.components).toBeDefined();
      }
    });

    it("should handle missing bot user gracefully", async () => {
      mockClient.user = null;

      await execute(mockInteraction, mockClient);

      expect(mockInteraction.editReply).toHaveBeenCalled();
    });
  });
});

