import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { hasAdminPermissions } from "../../../utils/discord/permissions.js";
import { getLogger } from "../../../utils/logger.js";
import { errorEmbed } from "../../../utils/discord/responseMessages.js";
import {
  handleSetup,
  handleList,
  handleDelete,
  handleUpdate,
  handlePagination,
} from "./handlers.js";
import { getColorChoices } from "./utils.js";

// (no dynamic imports needed; handlers are co-located)

export const data = new SlashCommandBuilder()
  .setName("role-reactions")
  .setDescription("Manage role reaction messages")
  .addSubcommand(sub =>
    sub
      .setName("setup")
      .setDescription(
        "Create a role-reaction message for self-assignable roles",
      )
      .addStringOption(opt =>
        opt
          .setName("title")
          .setDescription("Title of the role message")
          .setRequired(true),
      )
      .addStringOption(opt =>
        opt
          .setName("description")
          .setDescription("Description of the role message")
          .setRequired(true),
      )
      .addStringOption(opt =>
        opt
          .setName("roles")
          .setDescription(
            "Comma-separated emoji:role pairs (e.g., 🎮:Gamer,🎨:Artist,💻:Developer)",
          )
          .setRequired(true),
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
    sub.setName("list").setDescription("List all role-reaction messages"),
  )
  .addSubcommand(sub =>
    sub
      .setName("delete")
      .setDescription("Delete a role-reaction message")
      .addStringOption(opt =>
        opt
          .setName("message_id")
          .setDescription("The ID of the message to delete")
          .setRequired(true),
      ),
  )
  .addSubcommand(sub =>
    sub
      .setName("update")
      .setDescription("Update an existing role-reaction message")
      .addStringOption(opt =>
        opt
          .setName("message_id")
          .setDescription("The ID of the message to update")
          .setRequired(true),
      )
      .addStringOption(opt =>
        opt.setName("title").setDescription("New title").setRequired(false),
      )
      .addStringOption(opt =>
        opt
          .setName("description")
          .setDescription("New description")
          .setRequired(false),
      )
      .addStringOption(opt =>
        opt
          .setName("roles")
          .setDescription(
            "Comma-separated emoji:role pairs (e.g., 🎮:Gamer,🎨:Artist,💻:Developer)",
          )
          .setRequired(false),
      )
      .addStringOption(opt =>
        opt
          .setName("color")
          .setDescription("Choose a color for the embed")
          .setRequired(false)
          .addChoices(...getColorChoices()),
      ),
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles);

export async function execute(interaction, client) {
  const logger = getLogger();

  logger.debug("Main command handler executing for role-reactions", {
    interactionAge: Date.now() - interaction.createdTimestamp,
  });

  // Check if interaction has already been acknowledged
  if (interaction.replied || interaction.deferred) {
    logger.warn("Interaction already acknowledged, skipping command");
    return;
  }

  try {
    if (!hasAdminPermissions(interaction.member)) {
      logger.warn("User lacks admin permissions, blocking command");
      return interaction.reply(
        errorEmbed({
          title: "Permission Denied",
          description:
            "You need Administrator permissions to manage role reaction messages.",
          solution: "Contact a server administrator for assistance.",
        }),
      );
    }

    const sub = interaction.options.getSubcommand();
    logger.debug("Executing subcommand", { subcommand: sub });

    switch (sub) {
      case "setup":
        logger.debug("Calling handleSetup");
        await handleSetup(interaction, client);
        logger.debug("handleSetup completed");
        break;
      case "list":
        logger.debug("Calling handleList", {
          interactionAge: Date.now() - interaction.createdTimestamp,
        });
        await handleList(interaction, client, 1, false);
        logger.debug("handleList completed");
        break;
      case "delete":
        await handleDelete(interaction);
        break;
      case "update":
        await handleUpdate(interaction);
        break;
      default: {
        await interaction.reply(
          errorEmbed({
            title: "Unknown Subcommand",
            description: `Subcommand \`${sub}\` is not supported.`,
          }),
        );
      }
    }
  } catch (error) {
    logger.error("Error in main command handler", { error: error.message });
    logger.error("role-reactions command error", error);

    // Check for specific error types
    if (error.message.includes("Unknown interaction")) {
      logger.warn("Interaction expired before response could be sent");
      return; // Don't try to respond to expired interactions
    }

    // Only try to respond if the interaction hasn't been acknowledged yet
    if (!interaction.replied && !interaction.deferred) {
      logger.debug("Attempting to send error reply (not replied/deferred)");
      try {
        await interaction.reply(
          errorEmbed({
            title: "Error",
            description: "Failed to process role-reactions command.",
          }),
        );
        logger.debug("Error reply sent successfully");
      } catch (replyError) {
        logger.error("Failed to send error reply", {
          error: replyError.message,
        });
        logger.error("Failed to send error reply", replyError);
      }
    } else if (interaction.deferred && !interaction.replied) {
      logger.debug("Attempting to send error edit (deferred but not replied)");
      try {
        await interaction.editReply(
          errorEmbed({
            title: "Error",
            description: "Failed to process role-reactions command.",
          }),
        );
        logger.debug("Error edit sent successfully");
      } catch (editError) {
        logger.error("Failed to send error edit", { error: editError.message });
        logger.error("Failed to send error edit", editError);
      }
    } else {
      logger.debug("Interaction already handled, skipping error response");
    }
  }
}

// Handle button interactions for pagination
export async function handleButtonInteraction(interaction, client) {
  const customId = interaction.customId;

  // Check if this is a pagination button
  if (customId.startsWith("role_list_")) {
    await handlePagination(interaction, client);
  }
}
