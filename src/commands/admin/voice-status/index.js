import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { hasAdminPermissions } from "../../../utils/discord/permissions.js";
import { getLogger } from "../../../utils/logger.js";
import {
  errorEmbed,
  successEmbed,
} from "../../../utils/discord/responseMessages.js";

export const metadata = {
  name: "voice-status",
  category: "admin",
  description: "Set voice channel status",
  keywords: ["voice", "channel", "status", "gaming", "afk"],
  emoji: "🎤",
  helpFields: [
    {
      name: `How to Use`,
      value: "```/voice-status set channel:#voice-channel status:Gaming```",
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
  ],
};

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

    const subcommand = interaction.options.getSubcommand();
    const channel = interaction.options.getChannel("channel");

    if (channel.type !== 2 && channel.type !== 13) {
      return interaction.reply(
        errorEmbed({
          title: "Invalid Channel",
          description: "Please select a voice channel.",
        }),
      );
    }

    if (subcommand === "set") {
      const status = interaction.options.getString("status");

      if (status.length > 500) {
        return interaction.reply(
          errorEmbed({
            title: "Status Too Long",
            description: "Status must be 500 characters or less.",
          }),
        );
      }

      await channel.setVoiceStatus(status);

      return interaction.reply(
        successEmbed({
          title: "Voice Status Set",
          description: `Status set to: "${status}" for ${channel.name}`,
        }),
      );
    }

    if (subcommand === "clear") {
      await channel.setVoiceStatus("");

      return interaction.reply(
        successEmbed({
          title: "Voice Status Cleared",
          description: `Status removed from ${channel.name}`,
        }),
      );
    }
  } catch (error) {
    logger.error("Error in voice-status command:", error);
    await interaction.reply(
      errorEmbed({
        title: "Error",
        description: "Failed to set voice channel status.",
        solution: "Please try again or contact support if the issue persists.",
      }),
    );
  }
}
