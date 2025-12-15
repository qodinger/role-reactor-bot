import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
} from "discord.js";
import { hasAdminPermissions } from "../../../utils/discord/permissions.js";
import { getLogger } from "../../../utils/logger.js";
import { errorEmbed } from "../../../utils/discord/responseMessages.js";
import {
  handleTimeout,
  handleWarn,
  handleBan,
  handleKick,
  handleUnban,
  handlePurge,
  handleHistory,
  handleRemoveWarn,
  handleListBans,
} from "./handlers.js";

const logger = getLogger();

export const data = new SlashCommandBuilder()
  .setName("moderation")
  .setDescription(
    "Moderate server members with timeout, warn, ban, kick, and purge",
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
  .addSubcommand(subcommand =>
    subcommand
      .setName("timeout")
      .setDescription(
        "Timeout a user or multiple users (mute them for a specified duration)",
      )
      .addStringOption(option =>
        option
          .setName("users")
          .setDescription(
            "User mentions or IDs separated by commas (e.g., @user1 @user2 or 123456789 987654321)",
          )
          .setRequired(true),
      )
      .addStringOption(option =>
        option
          .setName("duration")
          .setDescription(
            "Duration (e.g., 30m, 1h, 2d, 1w) - minimum 10s, maximum 28 days",
          )
          .setRequired(true),
      )
      .addStringOption(option =>
        option
          .setName("reason")
          .setDescription("Reason for the timeout")
          .setRequired(false),
      ),
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName("warn")
      .setDescription("Warn a user or multiple users with logging")
      .addStringOption(option =>
        option
          .setName("users")
          .setDescription(
            "User mentions or IDs separated by commas (e.g., @user1 @user2 or 123456789 987654321)",
          )
          .setRequired(true),
      )
      .addStringOption(option =>
        option
          .setName("reason")
          .setDescription("Reason for the warning")
          .setRequired(false),
      ),
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName("ban")
      .setDescription("Ban a user or multiple users from the server")
      .addStringOption(option =>
        option
          .setName("users")
          .setDescription(
            "User mentions or IDs separated by commas (e.g., @user1 @user2 or 123456789 987654321)",
          )
          .setRequired(true),
      )
      .addStringOption(option =>
        option
          .setName("reason")
          .setDescription("Reason for the ban")
          .setRequired(false),
      )
      .addIntegerOption(option =>
        option
          .setName("delete-days")
          .setDescription("Days of messages to delete (0-7, default: 0)")
          .setRequired(false)
          .setMinValue(0)
          .setMaxValue(7),
      ),
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName("kick")
      .setDescription("Kick a user or multiple users from the server")
      .addStringOption(option =>
        option
          .setName("users")
          .setDescription(
            "User mentions or IDs separated by commas (e.g., @user1 @user2 or 123456789 987654321)",
          )
          .setRequired(true),
      )
      .addStringOption(option =>
        option
          .setName("reason")
          .setDescription("Reason for the kick")
          .setRequired(false),
      ),
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName("unban")
      .setDescription("Unban a user or multiple users from the server")
      .addStringOption(option =>
        option
          .setName("users")
          .setDescription(
            "User mentions or IDs separated by commas (e.g., @user1 @user2 or 123456789 987654321)",
          )
          .setRequired(true),
      ),
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName("purge")
      .setDescription("Delete multiple messages from a channel")
      .addIntegerOption(option =>
        option
          .setName("amount")
          .setDescription("Number of messages to delete (1-100)")
          .setRequired(true)
          .setMinValue(1)
          .setMaxValue(100),
      )
      .addChannelOption(option =>
        option
          .setName("channel")
          .setDescription("Channel to purge (default: current channel)")
          .setRequired(false),
      ),
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName("history")
      .setDescription("View moderation history for a user or the entire server")
      .addUserOption(option =>
        option
          .setName("user")
          .setDescription(
            "User to view history for (optional - leave empty to view all server history)",
          )
          .setRequired(false),
      ),
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName("remove-warn")
      .setDescription("Remove a specific warning from a user")
      .addUserOption(option =>
        option
          .setName("user")
          .setDescription("The user to remove warning from")
          .setRequired(true),
      )
      .addStringOption(option =>
        option
          .setName("case-id")
          .setDescription("Case ID of the warning to remove")
          .setRequired(true),
      ),
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName("list-bans")
      .setDescription("List all banned users in the server"),
  );

export async function execute(interaction, client) {
  try {
    // Check interaction age first - Discord interactions expire after 3 seconds
    const age = Date.now() - interaction.createdTimestamp;
    if (age > 2500) {
      // Leave 500ms buffer
      logger.warn("Interaction too old to process", {
        interactionId: interaction.id,
        age,
        maxAge: 3000,
      });
      return; // Don't try to respond to expired interactions
    }

    // Defer the interaction to prevent timeout
    let deferred = false;
    try {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        deferred = true;
        logger.debug("Deferred moderation interaction", {
          interactionId: interaction.id,
          age,
        });
      }
    } catch (deferError) {
      logger.warn("Failed to defer interaction, proceeding without deferral", {
        interactionId: interaction.id,
        error: deferError.message,
      });
    }

    // Validate user permissions
    if (!hasAdminPermissions(interaction.member)) {
      const response = errorEmbed({
        title: "Permission Denied",
        description:
          "You need Administrator permissions to use moderation commands.",
        solution: "Contact a server administrator for assistance.",
      });

      if (deferred) {
        return interaction.editReply({ embeds: [response] });
      } else {
        return interaction.reply({
          embeds: [response],
          flags: MessageFlags.Ephemeral,
        });
      }
    }

    const subcommand = interaction.options.getSubcommand();

    logger.debug(
      `Moderation command executed by ${interaction.user.username} (${interaction.user.id}): ${subcommand}`,
    );

    switch (subcommand) {
      case "timeout":
        await handleTimeout(interaction, client);
        break;
      case "warn":
        await handleWarn(interaction, client);
        break;
      case "ban":
        await handleBan(interaction, client);
        break;
      case "kick":
        await handleKick(interaction, client);
        break;
      case "unban":
        await handleUnban(interaction, client);
        break;
      case "purge":
        await handlePurge(interaction, client);
        break;
      case "history":
        await handleHistory(interaction, client);
        break;
      case "remove-warn":
        await handleRemoveWarn(interaction, client);
        break;
      case "list-bans":
        await handleListBans(interaction, client);
        break;
      default: {
        const response = errorEmbed({
          title: "Unknown Subcommand",
          description: "Please use a valid subcommand.",
        });
        await interaction.editReply({ embeds: [response] });
        break;
      }
    }
  } catch (error) {
    logger.error("Error in moderation command:", error);
    const response = errorEmbed({
      title: "Command Error",
      description:
        "An unexpected error occurred while processing your request. Please try again later.",
    });

    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ embeds: [response] }).catch(() => {});
    } else {
      await interaction
        .reply({ embeds: [response], flags: MessageFlags.Ephemeral })
        .catch(() => {});
    }
  }
}
