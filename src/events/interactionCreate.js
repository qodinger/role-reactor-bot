import { Events, InteractionType } from "discord.js";

export const name = Events.InteractionCreate;

export async function execute(interaction, client) {
  try {
    // Validate inputs
    if (!interaction || !client) {
      throw new Error("Missing required parameters");
    }

    // Handle different interaction types
    switch (interaction.type) {
      case InteractionType.ApplicationCommand:
        await handleCommandInteraction(interaction, client);
        break;
      case InteractionType.MessageComponent:
        await handleComponentInteraction(interaction);
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

    // Try to reply with error message
    try {
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({
          content: "❌ An error occurred while processing your request.",
          ephemeral: true,
        });
      } else {
        await interaction.reply({
          content: "❌ An error occurred while processing your request.",
          ephemeral: true,
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
    await interaction.reply({
      content: "❌ Unknown command.",
      ephemeral: true,
    });
    return;
  }

  try {
    await command.execute(interaction, client);
    console.log(
      `Command executed: ${interaction.commandName} by ${interaction.user.tag}`,
    );
  } catch (error) {
    console.error(`Error executing command ${interaction.commandName}:`, error);
    await interaction.reply({
      content: "❌ Error executing command.",
      ephemeral: true,
    });
  }
};

// Handle component interactions (buttons, select menus)
const handleComponentInteraction = async interaction => {
  const customId = interaction.customId;

  if (customId.startsWith("role_")) {
    // Handle role button interactions
    const roleName = customId.replace("role_", "");
    const member = interaction.member;
    const role = interaction.guild.roles.cache.find(r => r.name === roleName);

    // --- Emoji reaction logic ---
    const messageId = interaction.message.id;
    const mapping = global.roleMappings?.[messageId];
    let emoji = null;
    if (mapping && mapping.roles) {
      for (const [em, roleObj] of Object.entries(mapping.roles)) {
        if (roleObj.roleName === roleName) {
          emoji = em;
          break;
        }
      }
    }
    // --- End emoji reaction logic ---

    if (role) {
      try {
        if (member.roles.cache.has(role.id)) {
          // Remove role from user
          await member.roles.remove(role);
          // Remove the user's reaction (if present)
          if (emoji) {
            try {
              const userReactions =
                interaction.message.reactions.cache.get(emoji);
              if (userReactions) {
                await userReactions.users.remove(member.user.id);
              }
            } catch (err) {
              console.error("Failed to remove reaction:", err);
            }
          }
        } else {
          // Add role to user
          await member.roles.add(role);
          // Add the emoji reaction to the message
          if (emoji) {
            try {
              await interaction.message.react(emoji);
            } catch (err) {
              console.error("Failed to add reaction:", err);
            }
          }
        }
        // No reply message
        if (!interaction.replied && !interaction.deferred) {
          await interaction.deferUpdate();
        }
      } catch (err) {
        console.error("Failed to update role:", err);
        if (!interaction.replied && !interaction.deferred) {
          await interaction.deferUpdate();
        }
      }
    } else {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.deferUpdate();
      }
    }
  } else {
    await interaction.reply({
      content: "❌ Unknown button interaction.",
      ephemeral: true,
    });
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
