import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
} from "discord.js";
import { hasAdminPermissions } from "../../../utils/discord/permissions.js";
import { getLogger } from "../../../utils/logger.js";
import { errorEmbed } from "../../../utils/discord/responseMessages.js";
import { handleAssign, handleList, handleRemove } from "./handlers.js";

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
  name: "temp-roles",
  category: "admin",
  description: "Manage temporary role assignments",
  keywords: [
    "temp-roles",
    "temporary roles",
    "temp roles",
    "temporary",
    "roles",
    "assign",
  ],
  emoji: "⏰",
};

// ============================================================================
// COMMAND DEFINITION
// ============================================================================

export const data = new SlashCommandBuilder()
  .setName(metadata.name)
  .setDescription(metadata.description)
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
  .addSubcommand(subcommand =>
    subcommand
      .setName("assign")
      .setDescription(
        "Assign a temporary role to users that expires after a set time",
      )
      .addStringOption(opt =>
        opt
          .setName("users")
          .setDescription(
            "User IDs, mentions, role mentions (@RoleName), or @everyone for all members",
          )
          .setRequired(true),
      )
      .addRoleOption(opt =>
        opt
          .setName("role")
          .setDescription("The role to assign temporarily")
          .setRequired(true),
      )
      .addStringOption(opt =>
        opt
          .setName("duration")
          .setDescription(
            "How long the role should last (e.g., 1h, 2d, 1w, 30m)",
          )
          .setRequired(true),
      )
      .addStringOption(opt =>
        opt
          .setName("reason")
          .setDescription("Reason for assigning the temporary role")
          .setRequired(false),
      )
      .addBooleanOption(opt =>
        opt
          .setName("notify")
          .setDescription("Send DM notification to users (default: false)")
          .setRequired(false),
      )
      .addBooleanOption(opt =>
        opt
          .setName("notify-expiry")
          .setDescription(
            "Send DM notification when role expires (default: false)",
          )
          .setRequired(false),
      ),
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName("list")
      .setDescription("List temporary roles for a user or all users")
      .addUserOption(opt =>
        opt
          .setName("user")
          .setDescription("The user to check (leave empty for all users)")
          .setRequired(false),
      ),
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName("remove")
      .setDescription("Remove a temporary role from users before it expires")
      .addStringOption(opt =>
        opt
          .setName("users")
          .setDescription(
            "User IDs, mentions, role mentions (@RoleName), or @everyone for all members",
          )
          .setRequired(true),
      )
      .addRoleOption(opt =>
        opt
          .setName("role")
          .setDescription("The temporary role to remove")
          .setRequired(true),
      )
      .addStringOption(opt =>
        opt
          .setName("reason")
          .setDescription("Reason for removing the temporary role")
          .setRequired(false),
      )
      .addBooleanOption(opt =>
        opt
          .setName("notify")
          .setDescription(
            "Send DM notification to users about role removal (default: false)",
          )
          .setRequired(false),
      ),
  );

export async function execute(interaction, client) {
  const logger = getLogger();

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
        logger.debug("Deferred temp-roles interaction", {
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
          "You need Administrator permissions to manage temporary roles.",
        solution: "Contact a server administrator for assistance.",
      });

      if (deferred) {
        return interaction.editReply(response);
      } else {
        return interaction.reply({
          ...response,
          flags: MessageFlags.Ephemeral,
        });
      }
    }

    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case "assign":
        await handleAssign(interaction, client, deferred);
        break;
      case "list":
        await handleList(interaction, client, deferred);
        break;
      case "remove":
        await handleRemove(interaction, client, deferred);
        break;

      default: {
        const response = errorEmbed({
          title: "Unknown Subcommand",
          description: `The subcommand "${subcommand}" is not recognized.`,
          solution: "Use assign, list, or remove as subcommands.",
        });

        if (deferred) {
          await interaction.editReply(response);
        } else {
          await interaction.reply({
            ...response,
            flags: MessageFlags.Ephemeral,
          });
        }
        break;
      }
    }
  } catch (error) {
    logger.error(
      `Error in temp-roles ${interaction.options.getSubcommand()} command:`,
      error,
    );

    // Only reply if we haven't already replied
    if (!interaction.replied && !interaction.deferred) {
      const response = errorEmbed({
        title: "Error",
        description: "Failed to process temp-roles command.",
        solution: "Please try again or contact support if the issue persists.",
      });

      try {
        await interaction.reply({ ...response, flags: MessageFlags.Ephemeral });
      } catch (replyError) {
        logger.error("Failed to send error response", {
          interactionId: interaction.id,
          error: replyError.message,
        });
      }
    } else if (interaction.deferred && !interaction.replied) {
      // If deferred but not replied, try to edit reply with error
      const response = errorEmbed({
        title: "Error",
        description: "Failed to process temp-roles command.",
        solution: "Please try again or contact support if the issue persists.",
      });

      try {
        await interaction.editReply(response);
      } catch (editError) {
        logger.error("Failed to edit error response", {
          interactionId: interaction.id,
          error: editError.message,
        });
      }
    }
  }
}
