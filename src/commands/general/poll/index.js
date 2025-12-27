import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
} from "discord.js";
import { getLogger } from "../../../utils/logger.js";
import { errorEmbed } from "../../../utils/discord/responseMessages.js";
import {
  handlePollList,
  handlePollEnd,
  handlePollDelete,
  handlePollCreateModal,
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
  name: "poll",
  category: "general",
  description: "Create and manage native Discord polls",
  keywords: ["poll", "vote", "survey", "question", "election", "choice"],
  emoji: "🗳️",
  helpFields: [
    {
      name: `How to Use`,
      value: [
        "```/poll create```",
        "```/poll list```",
        "```/poll end poll-id:1234567890```",
        "```/poll delete poll-id:1234567890```",
      ].join("\n"),
      inline: false,
    },
    {
      name: `What You Need`,
      value: [
        "**create** - No parameters needed, opens interactive form",
        "**list** - No parameters needed, shows all polls",
        "**end** - **poll-id** *(required)* - The poll ID to end",
        "**delete** - **poll-id** *(required)* - The poll ID to delete",
      ].join("\n"),
      inline: false,
    },
    {
      name: `Subcommands`,
      value: [
        "**create** - Open an interactive form to create a new poll",
        "**list** - List all active polls in the server (with pagination)",
        "**end** - End an active poll early",
        "**delete** - Delete a poll permanently",
      ].join("\n"),
      inline: false,
    },
    {
      name: `Permissions`,
      value:
        "• **Send Messages** permission required\n• **Create Polls** - Anyone can create polls\n• **Manage Polls** - Poll creators and admins can close polls",
      inline: false,
    },
    {
      name: `What You'll See`,
      value:
        "Interactive poll creation form, real-time voting with progress bars, and automatic closing. Great for community decisions and feedback collection!",
      inline: false,
    },
  ],
};

// ============================================================================
// INTERACTION MANAGEMENT
// ============================================================================

async function deferInteraction(interaction) {
  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    return true; // Successfully deferred
  } catch (deferError) {
    if (
      deferError.message !== "Interaction has already been acknowledged." &&
      deferError.message !== "Unknown interaction"
    ) {
      const logger = getLogger();
      logger.error("Failed to defer reply:", deferError);
    }
    return false; // Failed to defer
  }
}

export const data = new SlashCommandBuilder()
  .setName(metadata.name)
  .setDescription(metadata.description)
  .addSubcommand(subcommand =>
    subcommand
      .setName("create")
      .setDescription("Create a new poll using an interactive form"),
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName("list")
      .setDescription("List polls in this server")
      .addIntegerOption(option =>
        option
          .setName("page")
          .setDescription("Page number to display")
          .setRequired(false)
          .setMinValue(1),
      )
      .addBooleanOption(option =>
        option
          .setName("show-ended")
          .setDescription("Include ended polls in the list")
          .setRequired(false),
      ),
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName("end")
      .setDescription("End an active poll early")
      .addStringOption(option =>
        option
          .setName("poll-id")
          .setDescription("The poll ID to end")
          .setRequired(true),
      ),
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName("delete")
      .setDescription("Delete a poll")
      .addStringOption(option =>
        option
          .setName("poll-id")
          .setDescription("The poll ID to delete")
          .setRequired(true),
      ),
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages);

export async function execute(interaction, client) {
  const logger = getLogger();

  const deferred = await deferInteraction(interaction);
  if (!deferred) {
    return; // Failed to defer, interaction is likely expired
  }

  try {
    const subcommand = interaction.options.getSubcommand();

    // Poll creators can delete their own polls, admins can delete any poll

    logger.info(
      `Poll command executed: ${subcommand} by ${interaction.user.tag}`,
    );

    switch (subcommand) {
      case "create":
        await handlePollCreateModal(interaction, client, true);
        break;
      case "list":
        await handlePollList(interaction, client, true);
        break;
      case "end":
        await handlePollEnd(interaction, client, true);
        break;
      case "delete":
        await handlePollDelete(interaction, client, true);
        break;
      default:
        logger.warn(`Unknown subcommand: ${subcommand}`);
        await interaction.editReply(
          errorEmbed({
            title: "Unknown Subcommand",
            description: `The subcommand "${subcommand}" is not recognized.`,
            solution:
              "Please use a valid subcommand: create, list, end, or delete.",
          }),
        );
    }
  } catch (error) {
    logger.error("Error in poll command:", error);

    try {
      await interaction.editReply(
        errorEmbed({
          title: "Error",
          description: "Failed to process poll command.",
          solution:
            "Please try again or contact support if the issue persists.",
        }),
      );
    } catch (editError) {
      logger.error("Failed to send error editReply", editError);
    }
  }
}
