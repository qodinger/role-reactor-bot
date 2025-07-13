import { Events, InteractionType } from "discord.js";

export const name = Events.InteractionCreate;

export async function execute(interaction, client) {
  try {
    // Diagnostic: log interaction age
    const now = Date.now();
    const created =
      interaction.createdTimestamp || interaction.createdAt?.getTime() || now;
    const age = now - created;
    console.log(
      `[InteractionCreate] Received interaction: ${interaction.commandName || interaction.type} | Age: ${age}ms`,
    );

    // Validate inputs
    if (!interaction || !client) {
      throw new Error("Missing required parameters");
    }

    // Handle different interaction types
    switch (interaction.type) {
      case InteractionType.ApplicationCommand:
        await handleCommandInteraction(interaction, client);
        break;
      case InteractionType.ApplicationCommandAutocomplete:
        await handleAutocompleteInteraction(interaction, client);
        break;
      default:
        // Unknown interaction type, ignore
        break;
    }
  } catch (error) {
    console.error("Error handling interaction:", error);

    // Try to reply with error message only if not already handled
    try {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: "❌ An error occurred while processing your request.",
          flags: 64, // ephemeral flag
        });
      } else if (interaction.deferred) {
        await interaction.editReply({
          content: "❌ An error occurred while processing your request.",
          flags: 64,
        });
      }
    } catch (replyError) {
      console.error("Error sending error reply:", replyError);
    }
  }
}

// Handle command interactions
const handleCommandInteraction = async (interaction, client) => {
  const command = client.commands.get(interaction.commandName);

  if (!command) {
    // Check if already replied to prevent double responses
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: "❌ Unknown command.",
        flags: 64,
      });
    }
    return;
  }

  try {
    await command.execute(interaction, client);
    console.log(
      `Command executed: ${interaction.commandName} by ${interaction.user.tag}`,
    );
  } catch (error) {
    console.error(`Error executing command ${interaction.commandName}:`, error);

    // Only try to reply if we haven't already and the command didn't handle it
    try {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: "❌ Error executing command.",
          flags: 64,
        });
      } else if (interaction.deferred) {
        await interaction.editReply({
          content: "❌ Error executing command.",
          flags: 64,
        });
      }
    } catch (replyError) {
      console.error("Failed to send error response:", replyError);
    }
  }
};

// Handle autocomplete interactions
const handleAutocompleteInteraction = async (interaction, client) => {
  const command = client.commands.get(interaction.commandName);

  if (command && command.autocomplete) {
    try {
      await command.autocomplete(interaction, client);
    } catch (error) {
      console.error(
        `Error in autocomplete for ${interaction.commandName}:`,
        error,
      );
      await interaction.respond([]);
    }
  } else {
    await interaction.respond([]);
  }
};
