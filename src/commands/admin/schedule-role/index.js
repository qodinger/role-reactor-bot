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
} from "./handlers.js";

export const data = new SlashCommandBuilder()
  .setName("schedule-role")
  .setDescription("Schedule automatic role assignments and removals")
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

      default: {
        const response = errorEmbed({
          title: "Unknown Subcommand",
          description: `The subcommand "${subcommand}" is not recognized.`,
          solution: "Use create, list, view, or cancel as subcommands.",
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
