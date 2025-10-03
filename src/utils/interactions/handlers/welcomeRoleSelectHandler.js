import { getLogger } from "../../logger.js";
import { hasAdminPermissions } from "../../discord/permissions.js";
import { errorEmbed } from "../../discord/responseMessages.js";
import { createWelcomeSettingsEmbed } from "../../../commands/admin/welcome/embeds.js";
import { createWelcomeSettingsComponents } from "../../../commands/admin/welcome/components.js";
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
        ephemeral: true,
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
        ephemeral: true,
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

    const welcomeChannel = updatedSettings.channelId
      ? interaction.guild.channels.cache.get(updatedSettings.channelId)
      : null;

    const embed = createWelcomeSettingsEmbed(
      interaction,
      updatedSettings,
      welcomeChannel,
      selectedRole,
    );
    const components = createWelcomeSettingsComponents(updatedSettings);

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
