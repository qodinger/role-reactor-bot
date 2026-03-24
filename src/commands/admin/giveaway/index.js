/**
 * Giveaway Command - Main entry point
 * @module commands/admin/giveaway/index
 */

import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
} from "discord.js";
import {
  handleCreate,
  handleList,
  handleEnd,
  handleReroll,
  handleCancel,
  handleEdit,
  handleDelete,
} from "./handlers.js";

export const metadata = {
  name: "giveaway",
  category: "admin",
  description: "Create and manage high-capacity server giveaways",
  keywords: ["giveaway", "raffle", "drop", "contest"],
  emoji: "🎁",
  helpFields: [
    {
      name: `How to Use`,
      value: [
        "```/giveaway create prize:Nitro winners:1 duration:24h```",
        "```/giveaway list```",
        "```/giveaway end giveaway-id:12345```",
        "```/giveaway reroll giveaway-id:12345```",
      ].join("\n"),
      inline: false,
    },
    {
      name: `Subcommands`,
      value: [
        "**create** - Create a new customized giveaway",
        "**list** - List all active giveaways on the server",
        "**edit** - Edit an active giveaway's rules or prize",
        "**end** - End a giveaway early and draw winners",
        "**reroll** - Reroll a giveaway to select new winners",
        "**cancel** - Void a giveaway completely",
        "**delete** - Purge a giveaway from the database",
      ].join("\n"),
      inline: false,
    },
    {
      name: `Permissions`,
      value: "• **Manage Server** permission required",
      inline: false,
    },
    {
      name: `Advanced Requirements`,
      value:
        "When creating a giveaway, you can strictly restrict entry to specific subsets of your community! You can require a specific **Role**, a minimum **XP Level**, a minimum **Server Age**, or even strictly require a **Top.gg Vote** within the last 12 hours!",
      inline: false,
    },
    {
      name: `Tier Limitations`,
      value:
        "Free Tier safely supports up to **2,500 active entries**, **5 simultaneous Winners**, and **3 Active Giveaways**. Upgrade to Pro Engine to safely host massive server events supporting **50,000 Entries** and up to **20 simultaneous Winners** with automatic DMs!",
      inline: false,
    },
  ],
};

/**
 * Giveaway command definition
 */
export const command = {
  name: "giveaway",
  description: "Manage server giveaways",
  data: new SlashCommandBuilder()
    .setName("giveaway")
    .setDescription("Create and manage server giveaways")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false)

    // Giveaway Management Subcommands
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
            .setDescription("Number of winners (1-20, default: 1)")
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(20),
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
        )
        .addIntegerOption(option =>
          option
            .setName("min-level")
            .setDescription("Minimum XP level required to enter (optional)")
            .setRequired(false)
            .setMinValue(1),
        )
        .addBooleanOption(option =>
          option
            .setName("require-vote")
            .setDescription(
              "Require users to have voted on top.gg in the last 12h (optional)",
            )
            .setRequired(false),
        )
        .addIntegerOption(option =>
          option
            .setName("claim-period")
            .setDescription("Hours winners have to claim prizes (default: 48)")
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(168),
        )
        .addIntegerOption(option =>
          option
            .setName("min-account-age")
            .setDescription("Minimum Discord account age in days (optional)")
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(365),
        )
        .addIntegerOption(option =>
          option
            .setName("min-server-age")
            .setDescription("Minimum server membership in days (optional)")
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(365),
        ),
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName("list")
        .setDescription("List active giveaways")
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
            .setDescription("Show all giveaways including ended and cancelled")
            .setRequired(false),
        ),
    )
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
            .setMaxValue(20),
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
        .setName("delete")
        .setDescription("Permanently delete a giveaway from the database")
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
            .setMaxValue(20),
        )
        .addStringOption(option =>
          option
            .setName("description")
            .setDescription("New giveaway description")
            .setRequired(false)
            .setMaxLength(1000),
        ),
    ),

  /**
   * Execute the giveaway command
   * @param {Object} interaction - Discord interaction
   * @param {Object} _client - Discord client (unused)
   */
  async execute(interaction, _client) {
    try {
      const subcommand = interaction.options.getSubcommand();

      switch (subcommand) {
        case "create":
          await handleCreate(interaction);
          break;
        case "list":
          await handleList(interaction);
          break;
        case "end":
          await handleEnd(interaction);
          break;
        case "reroll":
          await handleReroll(interaction);
          break;
        case "cancel":
          await handleCancel(interaction);
          break;
        case "delete":
          await handleDelete(interaction);
          break;
        case "edit":
          await handleEdit(interaction);
          break;
        default:
          await interaction.reply({
            content: "Unknown subcommand",
            flags: [MessageFlags.Ephemeral],
          });
      }
    } catch (error) {
      console.error("Giveaway command error:", error);

      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: "An error occurred while processing this command.",
          flags: [MessageFlags.Ephemeral],
        });
      }
    }
  },
};

// Export data and execute for command loader compatibility
export const { data } = command;
export const { execute } = command;
export default command;
