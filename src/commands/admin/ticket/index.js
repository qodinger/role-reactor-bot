import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
} from "discord.js";
import { getLogger } from "../../../utils/logger.js";
import { createErrorEmbed } from "../../../features/ticketing/embeds.js";
import { getColorChoices } from "../role-reactions/utils.js";
import {
  handleSetup,
  handleInfo,
  handlePanel,
  handleSettings,
} from "./handlers/admin.js";
import { handleTranscript } from "./handlers/general.js";
import {
  handleClose,
  handleAdd,
  handleTransfer,
  handleRemove,
  handleRename,
} from "./handlers/staff.js";

const logger = getLogger();

// ============================================================================
// COMMAND METADATA
// ============================================================================

export const metadata = {
  name: "ticket",
  category: "admin",
  description: "Manage the ticket support system",
  keywords: ["ticket", "support", "help", "ticketing", "support ticket"],
  emoji: "🎫",
  helpFields: [
    {
      name: `How to Use`,
      value: [
        "```/ticket settings```",
        "```/ticket setup channel:#support```",
        "```/ticket info action:stats```",
        "```/ticket panel list```",
        "```/ticket panel delete panel-id:1```",
        "```/ticket close reason:Issue resolved```",
        "```/ticket add member:@Staff```",
        "```/ticket remove member:@User```",
        "```/ticket transfer staff:@SeniorStaff```",
        "```/ticket rename name:bug-report```",
      ].join("\n"),
      inline: false,
    },
    {
      name: `Subcommands`,
      value: [
        "**setup** - Create a new ticket panel (Manage Server)",
        "**info** - View system information and stats (Manage Server)",
        "**settings** - Interactive settings dashboard (Manage Server)",

        "**panel list** - List all ticket panels in the server (Manage Server)",
        "**panel delete** - Delete a ticket panel by ID (Manage Server)",
        "**close** - Close ticket with optional reason (Owner/Staff)",
        "**add** - Add member to current ticket (Staff)",
        "**remove** - Remove member from current ticket (Staff)",
        "**transfer** - Transfer ticket to another staff (Staff)",
        "**rename** - Rename the ticket channel (Staff)",
        "**transcript** - Export chat history (Owner/Staff)",
      ].join("\n"),
      inline: false,
    },
    {
      name: `Permissions`,
      value: [
        "**Setup/Config** - Manage Server permission",
        "**Add/Remove/Transfer/Rename** - Staff role",
        "**Close/Transcript** - Ticket creator or staff",
      ].join("\n"),
      inline: false,
    },
    {
      name: `What You'll See`,
      value:
        "Interactive ticket panels, real-time ticket management with staff " +
        "claims, automatic transcript generation, and secure channel creation. " +
        "Perfect for server support and member assistance!",
      inline: false,
    },
  ],
};

// ============================================================================
// COMMAND DEFINITION
// ============================================================================

export const data = new SlashCommandBuilder()
  .setName("ticket")
  .setDescription("Manage the ticket support system")
  .setDMPermission(false)
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)

  // Admin commands
  .addSubcommand(sub =>
    sub
      .setName("setup")
      .setDescription("Create a new ticket panel")
      .addChannelOption(opt =>
        opt
          .setName("channel")
          .setDescription("Channel to create the panel in")
          .setRequired(true),
      )
      .addStringOption(opt =>
        opt
          .setName("title")
          .setDescription("Panel title")
          .setRequired(false)
          .setMaxLength(100),
      )
      .addStringOption(opt =>
        opt
          .setName("description")
          .setDescription("Panel description")
          .setRequired(false)
          .setMaxLength(1000),
      )
      .addStringOption(opt =>
        opt
          .setName("color")
          .setDescription("Choose a color for the embed")
          .setRequired(false)
          .addChoices(...getColorChoices()),
      ),
  )

  .addSubcommand(sub =>
    sub
      .setName("info")
      .setDescription("View ticket system information and limits"),
  )
  .addSubcommand(sub =>
    sub
      .setName("settings")
      .setDescription("Open the interactive ticket settings dashboard"),
  )
  .addSubcommandGroup(group =>
    group
      .setName("panel")
      .setDescription("Manage ticket panels")
      .addSubcommand(sub =>
        sub
          .setName("list")
          .setDescription("List all ticket panels in the server"),
      )
      .addSubcommand(sub =>
        sub
          .setName("delete")
          .setDescription("Delete a ticket panel")
          .addStringOption(opt =>
            opt
              .setName("panel-id")
              .setDescription("Panel number to delete (e.g., 1)")
              .setRequired(true),
          ),
      ),
  )

  // General commands
  .addSubcommand(sub =>
    sub
      .setName("transcript")
      .setDescription("Get the full transcript of a ticket")
      .addStringOption(opt =>
        opt
          .setName("ticket-id")
          .setDescription("Ticket number (e.g., 1)")
          .setRequired(true),
      )
      .addStringOption(opt =>
        opt
          .setName("format")
          .setDescription("Export format (HTML/JSON require Pro Engine)")
          .setRequired(false)
          .addChoices(
            { name: "HTML", value: "html" },
            { name: "JSON", value: "json" },
            { name: "Markdown", value: "md" },
          ),
      ),
  )

  .addSubcommand(sub =>
    sub
      .setName("close")
      .setDescription("Close the current ticket")
      .addStringOption(opt =>
        opt
          .setName("reason")
          .setDescription("Reason for closing")
          .setRequired(false)
          .setMaxLength(200),
      ),
  )
  .addSubcommand(sub =>
    sub
      .setName("add")
      .setDescription("Add a member to the current ticket")
      .addUserOption(opt =>
        opt.setName("member").setDescription("Member to add").setRequired(true),
      ),
  )
  .addSubcommand(sub =>
    sub
      .setName("transfer")
      .setDescription("Transfer ticket to another staff")
      .addUserOption(opt =>
        opt
          .setName("staff")
          .setDescription("Staff member to transfer to")
          .setRequired(true),
      ),
  )
  .addSubcommand(sub =>
    sub
      .setName("remove")
      .setDescription("Remove a member from the current ticket")
      .addUserOption(opt =>
        opt
          .setName("member")
          .setDescription("Member to remove")
          .setRequired(true),
      ),
  )
  .addSubcommand(sub =>
    sub
      .setName("rename")
      .setDescription("Rename the ticket channel")
      .addStringOption(opt =>
        opt
          .setName("name")
          .setDescription("New channel name")
          .setRequired(true)
          .setMaxLength(100),
      ),
  );

// ============================================================================
// PERMISSIONS
// ============================================================================

// Note: permission enforcement is done inside each handler
export const permissions = [];

// ============================================================================
// COMMAND EXECUTION
// ============================================================================

/**
 * Execute the /ticket command — thin router, all logic lives in handlers/.
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 */
export async function execute(interaction) {
  const subcommandGroup = interaction.options.getSubcommandGroup(false);
  const subcommand = interaction.options.getSubcommand();

  try {
    const adminCommands = ["setup", "info", "settings"];
    if (subcommandGroup === "panel" || adminCommands.includes(subcommand)) {
      if (
        !interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)
      ) {
        return interaction.reply({
          embeds: [
            createErrorEmbed(
              "You need the **Manage Server** or administrator permission to use this command.",
              "Permission Denied",
              interaction.client,
            ),
          ],
          flags: [MessageFlags.Ephemeral],
        });
      }
    }

    if (subcommandGroup === "panel") {
      return await handlePanel(interaction);
    }

    switch (subcommand) {
      case "setup":
        return await handleSetup(interaction);
      case "info":
        return await handleInfo(interaction);
      case "settings":
        return await handleSettings(interaction);
      case "transcript":
        return await handleTranscript(interaction);

      case "close":
        return await handleClose(interaction);
      case "add":
        return await handleAdd(interaction);
      case "transfer":
        return await handleTransfer(interaction);
      case "remove":
        return await handleRemove(interaction);
      case "rename":
        return await handleRename(interaction);
      default:
        return interaction.reply({
          embeds: [
            createErrorEmbed(
              "Unknown subcommand. Please use a valid subcommand.",
              "Unknown Subcommand",
              interaction.client,
            ),
          ],
          flags: [MessageFlags.Ephemeral],
        });
    }
  } catch (error) {
    logger.error("Ticket command error:", error);

    if (!interaction.replied && !interaction.deferred) {
      return interaction.reply({
        embeds: [
          createErrorEmbed(
            `Command failed: ${error.message}`,
            "Command Error",
            interaction.client,
          ),
        ],
        flags: [MessageFlags.Ephemeral],
      });
    }

    if (interaction.deferred && !interaction.replied) {
      return interaction.editReply({
        embeds: [
          createErrorEmbed(
            `Command failed: ${error.message}`,
            "Command Error",
            interaction.client,
          ),
        ],
      });
    }
  }
}
