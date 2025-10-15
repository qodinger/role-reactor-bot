import { MessageFlags } from "discord.js";
import { getLogger } from "../../../utils/logger.js";
import { errorEmbed } from "../../../utils/discord/responseMessages.js";
import { HelpEmbedBuilder } from "./embeds.js";
import { ComponentBuilder } from "./components.js";
import { logHelpUsage, isValidCommandName } from "./utils.js";
import { isDeveloper } from "../../../utils/discord/permissions.js";

// ============================================================================
// HELP COMMAND HANDLERS
// ============================================================================

export async function handleGeneralHelp(interaction, deferred = true) {
  const logger = getLogger();

  try {
    // Log help usage for analytics
    logHelpUsage(null, null, interaction.user.id);

    const embed = HelpEmbedBuilder.createMainHelpEmbed(
      interaction.client,
      interaction.member,
    );
    const components = await ComponentBuilder.createMainComponents(
      interaction.member,
      interaction.client,
    );

    if (deferred) {
      await interaction.editReply({
        embeds: [embed],
        components,
      });
    } else {
      await interaction.reply({
        embeds: [embed],
        components,
        flags: MessageFlags.Ephemeral,
      });
    }
  } catch (error) {
    logger.error("Error creating general help:", error);
    await handleHelpError(
      interaction,
      "Failed to load help information",
      deferred,
    );
  }
}

export async function handleSpecificCommandHelp(
  interaction,
  commandName,
  deferred = true,
) {
  const logger = getLogger();

  try {
    // Debug: Log available commands and what we're looking for
    logger.debug(`Looking for command: ${commandName}`);
    logger.debug(
      `Available commands: ${Array.from(interaction.client.commands.keys()).join(", ")}`,
    );

    // Validate command name
    if (!isValidCommandName(commandName)) {
      await handleCommandNotFound(interaction, commandName, deferred);
      return;
    }

    const command = interaction.client.commands.get(commandName);

    if (!command) {
      logger.warn(`Command not found in client.commands: ${commandName}`);
      await handleCommandNotFound(interaction, commandName, deferred);
      return;
    }

    // Check if this is a developer command and user has permission
    const developerCommands = [
      "health",
      "performance",
      "storage",
      "core-management",
      "verify",
    ];

    if (
      developerCommands.includes(commandName) &&
      !isDeveloper(interaction.user.id)
    ) {
      logger.warn("Permission denied for developer command help", {
        userId: interaction.user.id,
        commandName,
        guildId: interaction.guild?.id,
      });

      await handleCommandNotFound(interaction, commandName, deferred);
      return;
    }

    // Log help usage for analytics
    logHelpUsage(commandName, null, interaction.user.id);

    const embed = HelpEmbedBuilder.createCommandDetailEmbed(
      command,
      interaction.client,
    );
    const components = [ComponentBuilder.createBackButton()];

    if (deferred) {
      await interaction.editReply({
        embeds: [embed],
        components,
      });
    } else {
      await interaction.reply({
        embeds: [embed],
        components,
        flags: MessageFlags.Ephemeral,
      });
    }
  } catch (error) {
    logger.error("Error creating command help:", error);
    await handleHelpError(interaction, "Failed to load command help", deferred);
  }
}

export async function handleCategoryHelp(
  interaction,
  categoryKey,
  deferred = true,
) {
  const logger = getLogger();

  try {
    logger.debug(`Creating category embed for: ${categoryKey}`);
    const embed = HelpEmbedBuilder.createCategoryEmbed(
      categoryKey,
      interaction.client,
    );

    if (!embed) {
      logger.warn(`Category embed is null for: ${categoryKey}`);
      await handleCategoryNotFound(interaction, categoryKey, deferred);
      return;
    }

    const components = await ComponentBuilder.createCategoryComponents(
      categoryKey,
      interaction.member,
      interaction.client,
    );

    if (deferred) {
      await interaction.editReply({
        embeds: [embed],
        components,
      });
    } else {
      await interaction.reply({
        embeds: [embed],
        components,
        flags: MessageFlags.Ephemeral,
      });
    }
  } catch (error) {
    logger.error("Error creating category help:", error);
    await handleHelpError(
      interaction,
      "Failed to load category help",
      deferred,
    );
  }
}

export async function handleAllCommandsHelp(interaction, deferred = true) {
  const logger = getLogger();

  try {
    const embed = HelpEmbedBuilder.createAllCommandsEmbed(
      interaction.client,
      interaction.member,
    );
    const components = await ComponentBuilder.createMainComponents(
      interaction.member,
      interaction.client,
    );

    if (deferred) {
      await interaction.editReply({
        embeds: [embed],
        components,
      });
    } else {
      await interaction.reply({
        embeds: [embed],
        components,
        flags: MessageFlags.Ephemeral,
      });
    }
  } catch (error) {
    logger.error("Error creating all commands help:", error);
    await handleHelpError(interaction, "Failed to load all commands", deferred);
  }
}

// ============================================================================
// ERROR HANDLERS
// ============================================================================

async function handleCommandNotFound(interaction, commandName, deferred) {
  const errorResponse = {
    ...errorEmbed({
      title: "Command Not Found",
      description: `Could not find command \`/${commandName}\`.`,
      solution: "Use `/help` without parameters to see all available commands.",
    }),
  };

  if (deferred) {
    await interaction.editReply(errorResponse);
  } else {
    await interaction.reply({
      ...errorResponse,
      flags: MessageFlags.Ephemeral,
    });
  }
}

async function handleCategoryNotFound(interaction, categoryKey, deferred) {
  const errorResponse = {
    ...errorEmbed({
      title: "Category Not Found",
      description: `Could not find category \`${categoryKey}\`.`,
      solution: "Use `/help` to see all available categories.",
    }),
  };

  if (deferred) {
    await interaction.editReply(errorResponse);
  } else {
    await interaction.reply({
      ...errorResponse,
      flags: MessageFlags.Ephemeral,
    });
  }
}

async function handleHelpError(interaction, message, deferred) {
  const errorResponse = {
    ...errorEmbed({
      title: "Help Error",
      description: message,
      solution: "Please try again or contact support if the issue persists.",
    }),
  };

  if (deferred) {
    await interaction.editReply(errorResponse);
  } else {
    await interaction.reply({
      ...errorResponse,
      flags: MessageFlags.Ephemeral,
    });
  }
}

// ============================================================================
// INTERACTION ROUTING
// ============================================================================

export async function routeHelpInteraction(interaction, deferred = true) {
  const logger = getLogger();

  try {
    if (interaction.customId === "help_category_select") {
      if (!interaction.values || interaction.values.length === 0) {
        logger.warn("No values provided for category selection");
        await handleHelpError(interaction, "No category selected", deferred);
        return;
      }

      const categoryKey = interaction.values[0].replace("category_", "");
      logger.debug(`Selected category: ${categoryKey}`);
      await handleCategoryHelp(interaction, categoryKey, deferred);
    } else if (interaction.customId.startsWith("help_cmd_")) {
      const cmdName = interaction.customId.replace("help_cmd_", "");
      await handleSpecificCommandHelp(interaction, cmdName, deferred);
    } else if (interaction.customId === "help_view_all") {
      await handleAllCommandsHelp(interaction, deferred);
    } else if (
      interaction.customId === "help_view_overview" ||
      interaction.customId === "help_back_main"
    ) {
      await handleGeneralHelp(interaction, deferred);
    } else {
      logger.warn(`Unknown help interaction: ${interaction.customId}`);
      await handleHelpError(interaction, "Unknown interaction type", deferred);
    }
  } catch (error) {
    logger.error("Error routing help interaction:", error);
    await handleHelpError(
      interaction,
      "Failed to process interaction",
      deferred,
    );
  }
}
