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
  helpFields: [
    {
      name: `How to Use`,
      value: [
        "```/temp-roles assign users:@user1,@user2 role:@EventRole duration:2h reason:Tournament participation notify:true```",
        "```/temp-roles assign users:@RoleName role:@Mute duration:5m notify-expiry:true```",
        "```/temp-roles list user:@user1```",
        "```/temp-roles remove users:@user1,@user2 role:@EventRole reason:Early removal notify:true```",
      ].join("\n"),
      inline: false,
    },
    {
      name: `Subcommands`,
      value: [
        "**assign** - Assign temporary roles to users that expire after a set duration",
        "**list** - List active temporary roles for a user or all users",
        "**remove** - Remove a temporary role from users before it expires",
      ].join("\n"),
      inline: false,
    },
    {
      name: `User Targeting`,
      value: [
        "• **User mentions** - `@user1,@user2` (target specific users)",
        "• **Role mentions** - `@RoleName` (target all members with that role)",
        "• **User IDs** - `123456789,987654321` (target by ID)",
        "• **@everyone** - Target all server members",
        "• **Mix formats** - Combine any of the above (e.g., `@user1,@RoleName,123456789`)",
      ].join("\n"),
      inline: false,
    },
    {
      name: `Options`,
      value: [
        "**users** *(required)* - Users to assign/remove role from (supports mentions, IDs, role mentions, @everyone)",
        "**role** *(required)* - The role to assign or remove",
        "**duration** *(required for assign)* - How long the role lasts (e.g., 30m, 2h, 1d, 1w)",
        "**reason** *(optional)* - Reason for the role assignment/removal",
        "**notify** *(optional)* - Send DM notification when role is assigned/removed (default: false)",
        "**notify-expiry** *(optional)* - Send DM notification when role expires (default: false)",
      ].join("\n"),
      inline: false,
    },
    {
      name: `Time Examples`,
      value: [
        "`30m` - 30 minutes (perfect for quick events)",
        "`2h` - 2 hours (great for tournaments)",
        "`1d` - 1 day (good for day-long events)",
        "`1w` - 1 week (for longer special access)",
        "`1h30m` - 1 hour 30 minutes (flexible timing)",
      ].join("\n"),
      inline: false,
    },
    {
      name: `Permissions`,
      value: "• **Manage Roles** permission required",
      inline: false,
    },
    {
      name: `Perfect For`,
      value:
        "Events, tournaments, giveaways, VIP access, beta testing, temporary mutes, or any temporary special access!",
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
