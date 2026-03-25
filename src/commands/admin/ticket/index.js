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
import {
  handleList,
  handleView,
  handleTranscript,
} from "./handlers/general.js";
import {
  handleClaim,
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
        "```/ticket list status:open```",
        "```/ticket view ticket-id:00001```",
        "```/ticket claim```",
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
        "**list** - View your tickets with status filter (Members)",
        "**view** - View details of a specific ticket (Members)",
        "**claim** - Claim the current ticket (Staff)",
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
        "**Claim/Add/Remove/Transfer/Rename** - Staff role",
        "**Close/Transcript** - Ticket creator or staff",
        "**List/View** - Members",
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
      )
      .addSubcommand(sub =>
        sub
          .setName("add-category")
          .setDescription("Add a new category (department) to a ticket panel")
          .addStringOption(opt =>
            opt
              .setName("panel-id")
              .setDescription("The panel to add the category to")
              .setRequired(true),
          )
          .addStringOption(opt =>
            opt
              .setName("label")
              .setDescription("The button label (e.g., Bug Report)")
              .setRequired(true)
              .setMaxLength(80),
          )
          .addStringOption(opt =>
            opt
              .setName("id")
              .setDescription("A unique keyword for this category (e.g., bug)")
              .setRequired(true)
              .setMaxLength(20),
          )
          .addStringOption(opt =>
            opt
              .setName("emoji")
              .setDescription("Emoji for the button")
              .setRequired(false),
          )
          .addStringOption(opt =>
            opt
              .setName("description")
              .setDescription(
                "Custom description for the ticket welcome message",
              )
              .setRequired(false)
              .setMaxLength(500),
          )
          .addStringOption(opt =>
            opt
              .setName("color")
              .setDescription("Embed color for this category")
              .setRequired(false)
              .addChoices(...getColorChoices()),
          ),
      )
      .addSubcommand(sub =>
        sub
          .setName("remove-category")
          .setDescription("Remove a category from a ticket panel")
          .addStringOption(opt =>
            opt
              .setName("panel-id")
              .setDescription("The panel to remove the category from")
              .setRequired(true),
          )
          .addStringOption(opt =>
            opt
              .setName("category-id")
              .setDescription("The ID of the category to remove")
              .setRequired(true),
          ),
      )
      .addSubcommand(sub =>
        sub
          .setName("list-categories")
          .setDescription("List all categories for a ticket panel")
          .addStringOption(opt =>
            opt
              .setName("panel-id")
              .setDescription("The panel to list categories for")
              .setRequired(true),
          ),
      ),
  )

  // General commands
  .addSubcommand(sub =>
    sub
      .setName("list")
      .setDescription("View your tickets")
      .addStringOption(opt =>
        opt
          .setName("status")
          .setDescription("Filter by status")
          .setRequired(false)
          .addChoices(
            { name: "Open", value: "open" },
            { name: "Closed", value: "closed" },
            { name: "All", value: "all" },
          ),
      ),
  )
  .addSubcommand(sub =>
    sub
      .setName("view")
      .setDescription("View a specific ticket")
      .addStringOption(opt =>
        opt
          .setName("ticket-id")
          .setDescription("Ticket number (e.g., 1)")
          .setRequired(true),
      ),
  )
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
    sub.setName("claim").setDescription("Claim the current ticket"),
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
      case "list":
        return await handleList(interaction);
      case "view":
        return await handleView(interaction);
      case "transcript":
        return await handleTranscript(interaction);
      case "claim":
        return await handleClaim(interaction);
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
