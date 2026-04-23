import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { hasAdminPermissions } from "../../../utils/discord/permissions.js";
import { getLogger } from "../../../utils/logger.js";
import { errorEmbed } from "../../../utils/discord/responseMessages.js";
import { handleVoiceStatusCommand } from "./handlers.js";

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
  name: "voice-status",
  category: "admin",
  description: "Set voice channel status",
  keywords: ["voice", "channel", "status", "gaming", "afk"],
  emoji: "🎤",
  helpFields: [
    {
      name: `How to Use`,
      value: [
        "```/voice-status set channel:#voice-channel status:Gaming```",
        "```/voice-status clear channel:#voice-channel```",
      ].join("\n"),
      inline: false,
    },
    {
      name: `Subcommands`,
      value: [
        "**set** - Set a voice channel's status",
        "**clear** - Remove the status from a voice channel",
      ].join("\n"),
      inline: false,
    },
    {
      name: `Permissions`,
      value: "• **Manage Channel** permission required",
      inline: false,
    },
    {
      name: `What You'll See`,
      value: [
        "Voice channel status allows you to show what users are doing:",
        "• Gaming, Music, AFK, LFG, etc.",
        "• Shows in the voice channel name area",
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
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
  .addSubcommand(sub =>
    sub
      .setName("set")
      .setDescription("Set a voice channel's status")
      .addChannelOption(opt =>
        opt
          .setName("channel")
          .setDescription("The voice channel to set status on")
          .setRequired(true),
      )
      .addStringOption(opt =>
        opt
          .setName("status")
          .setDescription("Status text (max 500 characters)")
          .setRequired(true),
      ),
  )
  .addSubcommand(sub =>
    sub
      .setName("clear")
      .setDescription("Remove status from a voice channel")
      .addChannelOption(opt =>
        opt
          .setName("channel")
          .setDescription("The voice channel to clear status from")
          .setRequired(true),
      ),
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
            "You need Manage Channels permissions to set voice channel status.",
          solution: "Contact a server administrator for assistance.",
        }),
      );
    }

    await handleVoiceStatusCommand(interaction);
  } catch (error) {
    logger.error("Error in voice-status command:", error);
    await interaction.reply(
      errorEmbed({
        title: "Error",
        description: "Failed to process voice-status command.",
        solution: "Please try again or contact support if the issue persists.",
      }),
    );
  }
}
