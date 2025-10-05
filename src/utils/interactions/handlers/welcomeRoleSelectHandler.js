import { MessageFlags } from "discord.js";
import { getLogger } from "../../logger.js";
import { hasAdminPermissions } from "../../discord/permissions.js";
import { errorEmbed } from "../../discord/responseMessages.js";
import { createRoleSelectComponents } from "../../../commands/admin/welcome/components.js";
import { THEME_COLOR } from "../../../config/theme.js";
import { getDatabaseManager } from "../../storage/databaseManager.js";

/**
 * Handle welcome role select interaction
 * @param {import('discord.js').StringSelectMenuInteraction} interaction
 */
export async function handleWelcomeRoleSelect(interaction) {
  const logger = getLogger();

  try {
    // Check permissions
    if (!hasAdminPermissions(interaction.member)) {
      return interaction.reply({
        embeds: [
          errorEmbed({
            title: "Permission Denied",
            description:
              "You need administrator permissions to configure the welcome auto-role.",
          }),
        ],
        flags: MessageFlags.Ephemeral,
      });
    }

    const selectedRoleId = interaction.values[0];
    const selectedRole = interaction.guild.roles.cache.get(selectedRoleId);

    if (!selectedRole) {
      return interaction.reply({
        embeds: [
          errorEmbed({
            title: "Role Not Found",
            description: "The selected role could not be found.",
          }),
        ],
        flags: MessageFlags.Ephemeral,
      });
    }

    // Defer the reply since we'll be editing it
    await interaction.deferReply({ ephemeral: true });

    // Check if bot can assign this role
    const botMember = interaction.guild.members.me;
    if (selectedRole.position >= botMember.roles.highest.position) {
      return interaction.editReply({
        embeds: [
          errorEmbed({
            title: "Permission Error",
            description: `I cannot assign the role ${selectedRole.toString()} because it's higher than or equal to my highest role.`,
            solution:
              "Please move my role above the selected role in the role hierarchy.",
          }),
        ],
      });
    }

    // Get current settings from database
    const dbManager = await getDatabaseManager();
    const currentSettings = await dbManager.welcomeSettings.getByGuild(
      interaction.guild.id,
    );

    // Update settings with selected role
    const newSettings = {
      ...currentSettings,
      autoRoleId: selectedRoleId,
      updatedAt: new Date(),
    };

    await dbManager.welcomeSettings.set(interaction.guild.id, newSettings);

    // Get updated settings for display
    const updatedSettings = await dbManager.welcomeSettings.getByGuild(
      interaction.guild.id,
    );

    // Return to auto-role configuration page with updated settings
    const components = createRoleSelectComponents(
      interaction.guild,
      updatedSettings.autoRoleId,
    );

    const embed = {
      title: "Configure Welcome Auto-Role",
      description:
        "Select a role from the dropdown below to automatically assign to new members, or use the 'Clear Auto-Role' button to remove the current one.",
      color: THEME_COLOR,
      fields: [
        {
          name: "Select Role",
          value:
            "Choose a role from the dropdown below. Selecting a role will automatically save it as the auto-role.",
          inline: false,
        },
      ],
    };

    await interaction.editReply({
      embeds: [embed],
      components,
    });

    logger.info(
      `Welcome auto-role set to ${selectedRole.name} by ${interaction.user.tag} in ${interaction.guild.name}`,
    );
  } catch (error) {
    logger.error(`Error in handleWelcomeRoleSelect: ${error.message}`, error);
    await interaction.editReply({
      embeds: [
        errorEmbed({
          title: "Selection Error",
          description: "An error occurred while processing the role selection.",
        }),
      ],
    });
  }
}
