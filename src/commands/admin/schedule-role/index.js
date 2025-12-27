import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
} from "discord.js";
import { hasAdminPermissions } from "../../../utils/discord/permissions.js";
import { getLogger } from "../../../utils/logger.js";
import { errorEmbed } from "../../../utils/discord/responseMessages.js";
import {
  handleCreate,
  handleList,
  handleCancel,
  handleView,
  handleDelete,
} from "./handlers.js";

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
  name: "schedule-role",
  category: "admin",
  description: "Schedule automatic role assignments and removals",
  keywords: [
    "schedule-role",
    "schedule role",
    "scheduled",
    "automatic",
    "roles",
    "schedule",
  ],
  emoji: "📅",
  helpFields: [
    {
      name: `How to Use`,
      value: [
        "```/schedule-role create action:assign role:@EventRole users:@user1,@RoleName schedule-type:one-time schedule:tomorrow 8am```",
        "```/schedule-role create action:remove role:@Mute users:@RoleName schedule-type:daily schedule:9am```",
        "```/schedule-role list page:1 show-all:false```",
        "```/schedule-role view schedule-id:abc123```",
        "```/schedule-role cancel schedule-id:abc123```",
        "```/schedule-role delete schedule-id:abc123```",
      ].join("\n"),
      inline: false,
    },
    {
      name: `What You Need`,
      value: [
        "**create** - **action** *(required)*, **role** *(required)*, **users** *(required)*, **schedule-type** *(required)*, **schedule** *(required)*, **reason** *(optional)*",
        "**list** - **page** *(optional)*, **show-all** *(optional)*",
        "**view** - **schedule-id** *(required)*",
        "**cancel** - **schedule-id** *(required)*",
        "**delete** - **schedule-id** *(required)*",
      ].join("\n"),
      inline: false,
    },
    {
      name: `Subcommands`,
      value: [
        "**create** - Create a new scheduled role assignment or removal",
        "**list** - List all active scheduled roles with pagination",
        "**view** - View details of a specific scheduled role",
        "**cancel** - Cancel a scheduled role (keeps in database)",
        "**delete** - Permanently delete a scheduled role from database",
      ].join("\n"),
      inline: false,
    },
    {
      name: `Schedule Types`,
      value: [
        "**one-time** - Execute once at the specified time",
        "**daily** - Execute every day at the specified time",
        "**weekly** - Execute every week on the specified day and time",
        "**monthly** - Execute every month on the specified date and time",
        "**custom** - Execute at custom intervals (specified in minutes)",
      ].join("\n"),
      inline: false,
    },
    {
      name: `Schedule Format Examples`,
      value: [
        "`tomorrow 8am` - Tomorrow at 8:00 AM",
        "`9am` - Today at 9:00 AM (if before 9am) or tomorrow",
        "`monday 9am` - Next Monday at 9:00 AM",
        "`15 2pm` - 15th of this month at 2:00 PM",
        "`60` - 60 minutes from now (for custom intervals)",
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
        "• **Mix formats** - Combine any of the above",
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
        "Automated role assignments for events, scheduled maintenance, recurring tasks, or any time-based role management!",
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
      .setName("create")
      .setDescription("Create a new scheduled role assignment or removal")
      .addStringOption(opt =>
        opt
          .setName("action")
          .setDescription("Whether to assign or remove the role")
          .setRequired(true)
          .addChoices(
            { name: "Assign", value: "assign" },
            { name: "Remove", value: "remove" },
          ),
      )
      .addRoleOption(opt =>
        opt
          .setName("role")
          .setDescription("The role to assign or remove")
          .setRequired(true),
      )
      .addStringOption(opt =>
        opt
          .setName("users")
          .setDescription(
            "User IDs/mentions, '@everyone', role mentions, or mix (e.g., @user1,@RoleName)",
          )
          .setRequired(true),
      )
      .addStringOption(opt =>
        opt
          .setName("schedule-type")
          .setDescription("Type of schedule (one-time or recurring)")
          .setRequired(true)
          .addChoices(
            { name: "One-time", value: "one-time" },
            { name: "Daily", value: "daily" },
            { name: "Weekly", value: "weekly" },
            { name: "Monthly", value: "monthly" },
            { name: "Custom Interval", value: "custom" },
          ),
      )
      .addStringOption(opt =>
        opt
          .setName("schedule")
          .setDescription(
            "Schedule time (e.g., 'tomorrow 8am', '9am', 'monday 9am', '15 2pm', '60')",
          )
          .setRequired(true),
      )
      .addStringOption(opt =>
        opt
          .setName("reason")
          .setDescription("Reason for this scheduled role (optional)")
          .setRequired(false),
      ),
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName("list")
      .setDescription("List all active scheduled roles")
      .addIntegerOption(opt =>
        opt
          .setName("page")
          .setDescription("Page number (default: 1)")
          .setRequired(false)
          .setMinValue(1),
      )
      .addBooleanOption(opt =>
        opt
          .setName("show-all")
          .setDescription(
            "Show all schedules including executed, inactive, and cancelled",
          )
          .setRequired(false),
      ),
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName("view")
      .setDescription("View details of a specific scheduled role")
      .addStringOption(opt =>
        opt
          .setName("schedule-id")
          .setDescription("The ID of the schedule to view")
          .setRequired(true),
      ),
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName("cancel")
      .setDescription("Cancel a scheduled role")
      .addStringOption(opt =>
        opt
          .setName("schedule-id")
          .setDescription("The ID of the schedule to cancel")
          .setRequired(true),
      ),
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName("delete")
      .setDescription("Permanently delete a scheduled role from the database")
      .addStringOption(opt =>
        opt
          .setName("schedule-id")
          .setDescription("The ID of the schedule to delete")
          .setRequired(true),
      ),
  );

export async function execute(interaction, client) {
  const logger = getLogger();

  try {
    // Check interaction age first
    const age = Date.now() - interaction.createdTimestamp;
    if (age > 2500) {
      logger.warn("Interaction too old to process", {
        interactionId: interaction.id,
        age,
        maxAge: 3000,
      });
      return;
    }

    // Defer the interaction to prevent timeout
    let deferred = false;
    try {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        deferred = true;
        logger.debug("Deferred schedule-role interaction", {
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
          "You need Administrator permissions to manage scheduled roles.",
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
      case "create":
        await handleCreate(interaction, client, deferred);
        break;
      case "list":
        await handleList(interaction, client, deferred);
        break;
      case "view":
        await handleView(interaction, client, deferred);
        break;
      case "cancel":
        await handleCancel(interaction, client, deferred);
        break;
      case "delete":
        await handleDelete(interaction, client, deferred);
        break;

      default: {
        const response = errorEmbed({
          title: "Unknown Subcommand",
          description: `The subcommand "${subcommand}" is not recognized.`,
          solution: "Use create, list, view, cancel, or delete as subcommands.",
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
      `Error in schedule-role ${interaction.options.getSubcommand()} command:`,
      error,
    );

    // Only reply if we haven't already replied
    if (!interaction.replied && !interaction.deferred) {
      const response = errorEmbed({
        title: "Error",
        description: "Failed to process schedule-role command.",
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
    }
  }
}
