/**
 * Giveaway Command - Main entry point
 * @module commands/general/giveaway/index
 */

import { SlashCommandBuilder } from "discord.js";
import {
  handleCreate,
  handleList,
  handleStats,
  handleEnd,
  handleReroll,
  handleCancel,
  handleInfo,
  handleEdit,
  handleSetCreatorRole,
  handleRemoveCreatorRole,
  handleCreatorRoles,
  handleSetAllowedChannel,
  handleRemoveAllowedChannel,
  handleSettings,
  handleSetClaimPeriod,
} from "./handlers.js";

/**
 * Giveaway command definition
 */
export const command = {
  name: "giveaway",
  description: "Manage server giveaways",
  data: new SlashCommandBuilder()
    .setName("giveaway")
    .setDescription("Manage server giveaways")

    // User commands
    .addSubcommand(subcommand =>
      subcommand
        .setName("create")
        .setDescription("Create a new giveaway")
        .addStringOption(option =>
          option
            .setName("prize")
            .setDescription("The prize to give away")
            .setRequired(true)
            .setMinLength(1)
            .setMaxLength(100),
        )
        .addIntegerOption(option =>
          option
            .setName("winners")
            .setDescription("Number of winners")
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(10),
        )
        .addStringOption(option =>
          option
            .setName("duration")
            .setDescription("Duration (e.g., 30m, 1h, 1d, 1w)")
            .setRequired(true),
        )
        .addChannelOption(option =>
          option
            .setName("channel")
            .setDescription("Channel to post giveaway (default: current)")
            .setRequired(false),
        )
        .addStringOption(option =>
          option
            .setName("description")
            .setDescription("Additional description for the giveaway")
            .setRequired(false)
            .setMaxLength(1000),
        )
        .addRoleOption(option =>
          option
            .setName("required-role")
            .setDescription("Role required to enter (optional)")
            .setRequired(false),
        ),
    )
    .addSubcommand(subcommand =>
      subcommand.setName("list").setDescription("List all active giveaways"),
    )
    .addSubcommand(subcommand =>
      subcommand.setName("stats").setDescription("View giveaway statistics"),
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName("info")
        .setDescription("View information about a specific giveaway")
        .addStringOption(option =>
          option
            .setName("giveaway-id")
            .setDescription("The giveaway ID")
            .setRequired(true),
        ),
    )

    // Admin management commands
    .addSubcommand(subcommand =>
      subcommand
        .setName("end")
        .setDescription("End a giveaway early")
        .addStringOption(option =>
          option
            .setName("giveaway-id")
            .setDescription("The giveaway ID")
            .setRequired(true),
        ),
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName("reroll")
        .setDescription("Reroll a giveaway to select new winners")
        .addStringOption(option =>
          option
            .setName("giveaway-id")
            .setDescription("The giveaway ID")
            .setRequired(true),
        )
        .addIntegerOption(option =>
          option
            .setName("winners")
            .setDescription("Number of winners (default: original count)")
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(10),
        ),
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName("cancel")
        .setDescription("Cancel a giveaway without selecting winners")
        .addStringOption(option =>
          option
            .setName("giveaway-id")
            .setDescription("The giveaway ID")
            .setRequired(true),
        ),
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName("edit")
        .setDescription("Edit an active giveaway")
        .addStringOption(option =>
          option
            .setName("giveaway-id")
            .setDescription("The giveaway ID")
            .setRequired(true),
        )
        .addStringOption(option =>
          option
            .setName("prize")
            .setDescription("New prize description")
            .setRequired(false)
            .setMaxLength(100),
        )
        .addIntegerOption(option =>
          option
            .setName("winners")
            .setDescription("New number of winners")
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(10),
        )
        .addStringOption(option =>
          option
            .setName("description")
            .setDescription("New giveaway description")
            .setRequired(false)
            .setMaxLength(1000),
        ),
    )

    // Creator role management
    .addSubcommand(subcommand =>
      subcommand
        .setName("set-creator-role")
        .setDescription("Allow a role to create giveaways")
        .addRoleOption(option =>
          option
            .setName("role")
            .setDescription("Role to grant giveaway creation permissions")
            .setRequired(true),
        ),
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName("remove-creator-role")
        .setDescription("Remove giveaway creation permissions from a role")
        .addRoleOption(option =>
          option
            .setName("role")
            .setDescription("Role to remove giveaway creation permissions")
            .setRequired(true),
        ),
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName("creator-roles")
        .setDescription("List all roles that can create giveaways"),
    )

    // Channel restrictions
    .addSubcommand(subcommand =>
      subcommand
        .setName("set-allowed-channel")
        .setDescription("Allow giveaways in a specific channel")
        .addChannelOption(option =>
          option
            .setName("channel")
            .setDescription("Channel to allow giveaways in")
            .setRequired(true),
        ),
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName("remove-allowed-channel")
        .setDescription("Remove giveaway permissions from a channel")
        .addChannelOption(option =>
          option
            .setName("channel")
            .setDescription("Channel to remove giveaway permissions from")
            .setRequired(true),
        ),
    )

    // Settings
    .addSubcommand(subcommand =>
      subcommand
        .setName("settings")
        .setDescription("View current giveaway settings"),
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName("set-claim-period")
        .setDescription("Set how long winners have to claim prizes")
        .addIntegerOption(option =>
          option
            .setName("hours")
            .setDescription("Hours to claim prize (1-168)")
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(168),
        ),
    ),

  /**
   * Execute the giveaway command
   * @param {Object} interaction - Discord interaction
   * @param {Object} client - Discord client
   */
  async execute(interaction, client) {
    try {
      const subcommand = interaction.options.getSubcommand();

      switch (subcommand) {
        // Public commands (everyone can use)
        case "create":
          await handleCreate(interaction);
          break;
        case "list":
          await handleList(interaction);
          break;
        case "stats":
          await handleStats(interaction);
          break;
        case "info":
          await handleInfo(interaction);
          break;

        // Admin management commands (permission required)
        case "end":
          await handleEnd(interaction);
          break;
        case "reroll":
          await handleReroll(interaction);
          break;
        case "cancel":
          await handleCancel(interaction);
          break;
        case "edit":
          await handleEdit(interaction);
          break;

        // Creator role management
        case "set-creator-role":
          await handleSetCreatorRole(interaction);
          break;
        case "remove-creator-role":
          await handleRemoveCreatorRole(interaction);
          break;
        case "creator-roles":
          await handleCreatorRoles(interaction);
          break;

        // Channel restrictions
        case "set-allowed-channel":
          await handleSetAllowedChannel(interaction);
          break;
        case "remove-allowed-channel":
          await handleRemoveAllowedChannel(interaction);
          break;

        // Settings
        case "settings":
          await handleSettings(interaction);
          break;
        case "set-claim-period":
          await handleSetClaimPeriod(interaction);
          break;

        default:
          await interaction.reply({
            content: "Unknown subcommand",
            ephemeral: true,
          });
      }
    } catch (error) {
      console.error("Giveaway command error:", error);

      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: "An error occurred while processing this command.",
          ephemeral: true,
        });
      }
    }
  },
};

export default command;
