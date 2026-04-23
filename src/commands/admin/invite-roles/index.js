import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { hasAdminPermissions } from "../../../utils/discord/permissions.js";
import { getLogger } from "../../../utils/logger.js";
import { errorEmbed } from "../../../utils/discord/responseMessages.js";
import { handleInviteRolesCommand } from "./handlers.js";

// ============================================================================
// COMMAND METADATA
// ============================================================================

/**
 * Command metadata for centralized registry
 * This allows the command to be automatically discovered and integrated
 * into help system, command suggestions, and other features
 * This is the single source of truth for command information
 */
export const metadata = {
  name: "invite-roles",
  category: "admin",
  description: "Create invites that grant roles when joined",
  keywords: ["invite", "roles", "auto-role", "onboarding", "welcome"],
  emoji: "🎟️",
  helpFields: [
    {
      name: `How to Use`,
      value: [
        "```/invite-roles create channel:#general role:@Member max-age:24```",
        "```/invite-roles list```",
      ].join("\n"),
      inline: false,
    },
    {
      name: `Subcommands`,
      value: [
        "**create** - Create an invite with auto-role",
        "**list** - List all server invites",
      ].join("\n"),
      inline: false,
    },
    {
      name: `Permissions`,
      value: "• **Manage Channel** and **Create Invite** permissions required",
      inline: false,
    },
    {
      name: `What You'll See`,
      value: [
        "Create special invites that automatically grant roles when users join:",
        "• Perfect for onboarding new members",
        "• Track invite usage and stats",
      ].join("\n"),
      inline: false,
    },
  ],
};

// ============================================================================
// COMMAND DEFINITION
// ============================================================================

export const data = new SlashCommandBuilder()
  .setName(metadata.name)
  .setDescription(metadata.description)
  .setDefaultMemberPermissions(
    PermissionFlagsBits.ManageChannels |
      PermissionFlagsBits.CreateInstantInvite,
  )
  .addSubcommand(sub =>
    sub
      .setName("create")
      .setDescription("Create an invite that grants roles when joined")
      .addChannelOption(opt =>
        opt
          .setName("channel")
          .setDescription("Channel to create invite in")
          .setRequired(true),
      )
      .addRoleOption(opt =>
        opt
          .setName("role")
          .setDescription("Role to grant when invite is used")
          .setRequired(true),
      )
      .addIntegerOption(opt =>
        opt
          .setName("max-age")
          .setDescription("Max age in hours (default: 24)")
          .setMinValue(1)
          .setMaxValue(168)
          .setRequired(false),
      )
      .addIntegerOption(opt =>
        opt
          .setName("max-uses")
          .setDescription("Max uses (default: unlimited)")
          .setMinValue(1)
          .setMaxValue(100)
          .setRequired(false),
      ),
  )
  .addSubcommand(sub =>
    sub.setName("list").setDescription("List all invites with auto-role"),
  );

// ============================================================================
// MAIN EXECUTION
// ============================================================================

export async function execute(interaction, _client) {
  const logger = getLogger();

  try {
    if (!hasAdminPermissions(interaction.member)) {
      return interaction.reply(
        errorEmbed({
          title: "Permission Denied",
          description:
            "You need admin permissions to manage invites with roles.",
          solution: "Contact a server administrator for assistance.",
        }),
      );
    }

    await handleInviteRolesCommand(interaction);
  } catch (error) {
    logger.error("Error in invite-roles command:", error);
    await interaction.reply(
      errorEmbed({
        title: "Error",
        description: "Failed to process invite-roles command.",
        solution: "Please try again or contact support if the issue persists.",
      }),
    );
  }
}
