import { SlashCommandBuilder, MessageFlags } from "discord.js";
import { getLogger } from "../../../utils/logger.js";
import { errorEmbed } from "../../../utils/discord/responseMessages.js";
import {
  handleGeneralHelp as handleGeneralHelpHandler,
  handleSpecificCommandHelp as handleSpecificCommandHelpHandler,
} from "./handlers.js";
import { isDeveloper } from "../../../utils/discord/permissions.js";

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
  name: "help",
  category: "general",
  description: "Get help and information about bot commands",
  keywords: [
    "help",
    "commands",
    "info",
    "guide",
    "documentation",
    "assistance",
  ],
  emoji: "❓",
  helpFields: [
    {
      name: `How to Use`,
      value: "```/help [command]```",
      inline: false,
    },
    {
      name: `What You Need`,
      value:
        "**command** *(optional)* - Get detailed help for a specific command",
      inline: false,
    },
    {
      name: `Permissions`,
      value: "• No special permissions required",
      inline: false,
    },
    {
      name: `What You'll See`,
      value:
        "Detailed instructions, examples, and everything you need to know about using the bot effectively!",
      inline: false,
    },
  ],
};

// ============================================================================
// COMMAND DEFINITION
// ============================================================================

export const data = new SlashCommandBuilder()
  .setName(metadata.name)
  .setDescription(metadata.description)
  .addStringOption(option =>
    option
      .setName("command")
      .setDescription("Get detailed help for a specific command")
      .setRequired(false)
      .setAutocomplete(true),
  );

// ============================================================================
// MAIN EXECUTION
// ============================================================================

export async function execute(interaction) {
  const logger = getLogger();

  try {
    if (!interaction.isRepliable()) {
      logger.warn("Interaction is no longer repliable, skipping execution");
      return;
    }

    const deferred = await deferInteraction(interaction);
    await routeHelpCommand(interaction, deferred);
  } catch (error) {
    logger.error("Error in help command:", error);
    await handleCommandError(interaction, error);
  }
}

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

async function routeHelpCommand(interaction, deferred) {
  const commandName = interaction.options.getString("command");

  if (commandName) {
    await handleSpecificCommandHelp(interaction, commandName, deferred);
  } else {
    await handleGeneralHelp(interaction, deferred);
  }
}

async function handleSpecificCommandHelp(interaction, commandName, deferred) {
  await handleSpecificCommandHelpHandler(interaction, commandName, deferred);
}

async function handleGeneralHelp(interaction, deferred) {
  await handleGeneralHelpHandler(interaction, deferred);
}

async function handleCommandError(interaction, _error) {
  try {
    if (interaction.deferred) {
      await interaction.editReply({
        embeds: [
          errorEmbed({
            title: "Unexpected Error",
            description: "An unexpected error occurred. Please try again.",
          }),
        ],
      });
    } else {
      await interaction.reply({
        embeds: [
          errorEmbed({
            title: "Unexpected Error",
            description: "An unexpected error occurred. Please try again.",
          }),
        ],
        flags: MessageFlags.Ephemeral,
      });
    }
  } catch (replyError) {
    const logger = getLogger();
    logger.error("Failed to send error response:", replyError);
  }
}

// ============================================================================
// AUTOCOMPLETE HANDLER
// ============================================================================

export async function autocomplete(interaction) {
  const focusedValue = interaction.options.getFocused().toLowerCase().trim();

  // Use registry as the source of truth for all commands
  const { commandRegistry } = await import(
    "../../../utils/core/commandRegistry.js"
  );
  await commandRegistry.initialize(interaction.client);

  const userIsDeveloper = isDeveloper(interaction.user.id);

  // Get all commands from registry (more reliable than client.commands)
  const allCommandNames = commandRegistry.getAllCommandNames();

  // If search is empty or very short, show all commands (just filter by permissions)
  const showAll = !focusedValue || focusedValue.length < 2;

  // Score commands based on match quality
  const scoredCommands = allCommandNames
    .map(choice => {
      // Get command metadata to check category
      const metadata = commandRegistry.getCommandMetadata(choice);

      // Filter out developer commands if user is not a developer
      // Developer commands should ONLY be visible to developers
      if (metadata?.category === "developer") {
        if (!userIsDeveloper) {
          // User is not a developer, hide this command
          return null;
        }
        // User is a developer, show this command
      }

      // If showing all commands, give all a base score
      if (showAll) {
        return { name: choice, score: 1 };
      }

      // Check if command name matches
      const nameLower = choice.toLowerCase();
      let score = 0;
      let matches = false;

      if (nameLower === focusedValue) {
        // Exact match gets highest score
        score = 100;
        matches = true;
      } else if (nameLower.startsWith(focusedValue)) {
        // Starts with gets high score
        score = 50;
        matches = true;
      } else if (nameLower.includes(focusedValue)) {
        // Contains gets medium score
        score = 25;
        matches = true;
      } else {
        // Check keywords from registry
        const keywords = commandRegistry.getCommandKeywords(choice);
        if (keywords && keywords.length > 0) {
          for (const keyword of keywords) {
            const keywordLower = keyword.toLowerCase();
            if (keywordLower === focusedValue) {
              score = 40; // Keyword exact match
              matches = true;
              break;
            } else if (keywordLower.startsWith(focusedValue)) {
              score = Math.max(score, 30); // Keyword starts with
              matches = true;
            } else if (keywordLower.includes(focusedValue)) {
              score = Math.max(score, 15); // Keyword contains
              matches = true;
            }
          }
        }
      }

      if (!matches && !showAll) {
        return null;
      }

      return { name: choice, score };
    })
    .filter(cmd => cmd !== null)
    .sort((a, b) => {
      // Sort by score (descending), then alphabetically
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return a.name.localeCompare(b.name);
    })
    .slice(0, 25);

  await interaction.respond(
    scoredCommands.map(cmd => ({ name: `/${cmd.name}`, value: cmd.name })),
  );
}
