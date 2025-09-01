import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { hasAdminPermissions } from "../../../utils/discord/permissions.js";
import { getLogger } from "../../../utils/logger.js";
import { errorEmbed } from "../../../utils/discord/responseMessages.js";
import {
  handleSetup,
  handleList,
  handleDelete,
  handleUpdate,
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

  try {
    if (!hasAdminPermissions(interaction.member)) {
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

    switch (sub) {
      case "setup":
        await handleSetup(interaction, client);
        break;
      case "list":
        await handleList(interaction, client);
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
    logger.error("role-reactions command error", error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply(
        errorEmbed({
          title: "Error",
          description: "Failed to process role-reactions command.",
        }),
      );
    }
  }
}
