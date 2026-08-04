import { MessageFlags } from "discord.js";
import { getDatabaseManager } from "../../../utils/storage/databaseManager.js";
import { getLogger } from "../../../utils/logger.js";
import {
  successEmbed,
  errorEmbed,
  infoEmbed,
} from "../../../utils/discord/responseMessages.js";

const logger = getLogger();

export async function execute(interaction) {
  try {
    const subcommand = interaction.options.getSubcommand();

    // Use MessageFlags.Ephemeral per project convention
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const db = await getDatabaseManager();
    if (!db) {
      return interaction.editReply(
        errorEmbed({
          title: "Database Error",
          description: "Database connection failed. Please try again later.",
        }),
      );
    }

    const guildId = interaction.guild.id;
    const settings = await db.starboardSettings.getSettings(guildId);

    if (subcommand === "setup") {
      const channel = interaction.options.getChannel("channel");
      let emoji = interaction.options.getString("emoji") || settings.emoji;
      const threshold =
        interaction.options.getInteger("threshold") || settings.threshold;

      // Clean up custom emoji format if they passed it in <a:name:id> or <:name:id> format
      if (emoji.startsWith("<") && emoji.endsWith(">")) {
        // Keep it as is, since it's already a custom emoji string
      } else if (emoji.includes(":")) {
        // Handle cases where users just type name:id
        emoji = `<:${emoji}>`;
      }

      await db.starboardSettings.updateSettings(guildId, {
        channelId: channel.id,
        emoji,
        threshold,
        enabled: true, // Auto-enable on setup
      });

      await interaction.editReply(
        successEmbed({
          title: "⭐ Starboard Setup Complete",
          description: "Starboard has been configured and enabled.",
          fields: [
            { name: "Channel", value: `<#${channel.id}>`, inline: true },
            { name: "Emoji", value: emoji, inline: true },
            {
              name: "Threshold",
              value: `${threshold} reactions`,
              inline: true,
            },
          ],
        }),
      );
      logger.info(
        `⭐ Starboard setup by ${interaction.user.username} in guild ${guildId}`,
      );
    } else if (subcommand === "enable") {
      if (!settings.channelId) {
        return interaction.editReply(
          errorEmbed({
            title: "Setup Required",
            description:
              "You must run `/starboard setup` before enabling the starboard.",
          }),
        );
      }

      await db.starboardSettings.updateSettings(guildId, { enabled: true });

      await interaction.editReply(
        successEmbed({
          title: "⭐ Starboard Enabled",
          description: `The starboard is now active in <#${settings.channelId}>.`,
        }),
      );
      logger.info(
        `⭐ Starboard enabled by ${interaction.user.username} in guild ${guildId}`,
      );
    } else if (subcommand === "disable") {
      await db.starboardSettings.updateSettings(guildId, { enabled: false });

      await interaction.editReply(
        infoEmbed({
          title: "⭐ Starboard Disabled",
          description:
            "The starboard has been disabled. Existing starboard messages will remain, but new ones will not be posted.",
        }),
      );
      logger.info(
        `⭐ Starboard disabled by ${interaction.user.username} in guild ${guildId}`,
      );
    }
  } catch (error) {
    logger.error("Error executing starboard command:", error);
    await interaction
      .editReply(
        errorEmbed({
          title: "Command Failed",
          description:
            "An error occurred while configuring the starboard. Please try again.",
        }),
      )
      .catch(() => {});
  }
}
