import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  StringSelectMenuBuilder,
  PermissionFlagsBits,
} from "discord.js";
import { getLogger } from "../../utils/logger.js";
import { COMMAND_METADATA, COMMAND_CATEGORIES } from "./help/helpData.js";
import { HelpEmbedBuilder } from "./help/helpEmbedBuilder.js";
import { HelpComponentBuilder } from "./help/helpComponentBuilder.js";
import { HelpInteractionHandler } from "./help/helpInteractionHandler.js";
import { EMOJIS, THEME } from "../../config/theme.js";
import config from "../../config/config.js";

function findCommandCategory(commandName) {
  for (const [, category] of Object.entries(COMMAND_CATEGORIES)) {
    if (category.commands.includes(commandName)) {
      return category;
    }
  }
  return null;
}

function hasCategoryPermissions(member, requiredPermissions) {
  if (!requiredPermissions || requiredPermissions.length === 0) {
    return true;
  }

  for (const permission of requiredPermissions) {
    if (permission === "DEVELOPER") {
      const developers = config.discord.developers;
      if (!developers || !developers.includes(member.user.id)) {
        return false;
      }
    } else {
      const permissionFlag = PermissionFlagsBits[permission];
      if (permissionFlag && !member.permissions.has(permissionFlag)) {
        return false;
      }
    }
  }
  return true;
}

async function showCommandHelp(interaction, commandName, client) {
  const command = client.commands.get(commandName);

  if (!command) {
    return await interaction.reply({
      content: `${EMOJIS.STATUS.ERROR} Command not found!`,
      flags: 64,
    });
  }

  const embed = HelpEmbedBuilder.createCommandDetailEmbed(command, client);
  await interaction.reply({
    embeds: [embed],
    ephemeral: true,
  });
}

async function createInteractiveHelp(interaction, client) {
  const embed = HelpEmbedBuilder.createMainHelpEmbed(
    client,
    interaction.member,
  );
  const components =
    (await HelpComponentBuilder.createMainComponents(
      interaction.member,
      client,
    )) || [];

  const response = await interaction.reply({
    embeds: [embed],
    components,
    flags: 64,
  });

  const collector = response.createMessageComponentCollector({
    time: 300000,
  });

  const interactionHandler = new HelpInteractionHandler(client);
  collector.on(
    "collect",
    interactionHandler.handleInteraction.bind(interactionHandler),
  );
  collector.on("end", () => handleCollectorEnd(interaction, components));
}

async function handleCollectorEnd(interaction, components) {
  const disabledComponents = components.map(row => {
    const disabledRow = new ActionRowBuilder();
    disabledRow.addComponents(
      ...row.components.map(component => {
        if (component instanceof StringSelectMenuBuilder) {
          return StringSelectMenuBuilder.from(component).setDisabled(true);
        } else if (component instanceof ButtonBuilder) {
          return ButtonBuilder.from(component).setDisabled(true);
        }
        return component;
      }),
    );
    return disabledRow;
  });

  try {
    await interaction.editReply({ components: disabledComponents });
  } catch (_error) {
    // Ignore errors if message was deleted
  }
}

async function handleError(interaction) {
  const errorEmbed = new EmbedBuilder()
    .setColor(THEME.ERROR)
    .setTitle(`${EMOJIS.STATUS.ERROR} Error`)
    .setDescription("An error occurred. Please try again.")
    .setTimestamp();

  if (!interaction.replied && !interaction.deferred) {
    await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
  } else {
    await interaction.editReply({ embeds: [errorEmbed] });
  }
}

export const data = new SlashCommandBuilder()
  .setName("help")
  .setDescription(
    `${EMOJIS.ACTIONS.HELP} Get interactive help and information about commands`,
  )
  .addStringOption(option =>
    option
      .setName("command")
      .setDescription("Get detailed help for a specific command")
      .setRequired(false)
      .setAutocomplete(true),
  );

export async function autocomplete(interaction) {
  const focusedValue = interaction.options.getFocused().toLowerCase();
  const commands = Object.keys(COMMAND_METADATA);

  const accessibleCommands = commands.filter(cmd => {
    const category = findCommandCategory(cmd);
    if (!category) return true;
    return hasCategoryPermissions(
      interaction.member,
      category.requiredPermissions,
    );
  });

  const filtered = accessibleCommands
    .filter(cmd => {
      const meta = COMMAND_METADATA[cmd];
      return (
        cmd.includes(focusedValue) ||
        meta.tags?.some(tag => tag.includes(focusedValue)) ||
        meta.shortDesc?.toLowerCase().includes(focusedValue)
      );
    })
    .slice(0, 25)
    .map(cmd => ({
      name: `${COMMAND_METADATA[cmd].emoji} ${cmd} - ${COMMAND_METADATA[cmd].shortDesc}`,
      value: cmd,
    }));

  await interaction.respond(filtered);
}

export async function execute(interaction, client) {
  const logger = getLogger();
  const command = interaction.options.getString("command");

  try {
    if (command) {
      return await showCommandHelp(interaction, command, client);
    }
    return await createInteractiveHelp(interaction, client);
  } catch (error) {
    logger.error("Error executing help command", error);
    await handleError(interaction);
  }
}
