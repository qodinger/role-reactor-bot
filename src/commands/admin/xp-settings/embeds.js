import { EmbedBuilder } from "discord.js";
import { THEME_COLOR, EMOJIS } from "../../../config/theme.js";

/**
 * Create the main XP settings embed
 * @param {import('discord.js').CommandInteraction} interaction
 * @param {Object} xpSettings
 * @returns {import('discord.js').EmbedBuilder}
 */
export function createXpSettingsEmbed(interaction, xpSettings) {
  return new EmbedBuilder()
    .setColor(THEME_COLOR)
    .setTitle(`${EMOJIS.FEATURES.ROLES} XP System Settings`)
    .setDescription("Current configuration for the XP system")
    .addFields([
      {
        name: `${EMOJIS.STATUS.SUCCESS} System Status`,
        value: xpSettings.enabled ? "🟢 Enabled" : "🔴 Disabled",
        inline: true,
      },
      {
        name: `${EMOJIS.UI.MESSAGE} Message XP`,
        value: xpSettings.messageXP ? "✅ Enabled" : "❌ Disabled",
        inline: true,
      },
      {
        name: `${EMOJIS.UI.COMMAND} Command XP`,
        value: xpSettings.commandXP ? "✅ Enabled" : "❌ Disabled",
        inline: true,
      },
      {
        name: `${EMOJIS.FEATURES.ROLES} Role XP`,
        value: xpSettings.roleXP ? "✅ Enabled" : "❌ Disabled",
        inline: true,
      },
      {
        name: `${EMOJIS.UI.MESSAGE} Message XP Range`,
        value: `${xpSettings.messageXPAmount.min}-${xpSettings.messageXPAmount.max} XP`,
        inline: true,
      },
      {
        name: `${EMOJIS.UI.COMMAND} Command XP Base`,
        value: `${xpSettings.commandXPAmount.base} XP`,
        inline: true,
      },
      {
        name: `${EMOJIS.FEATURES.ROLES} Role XP Amount`,
        value: `${xpSettings.roleXPAmount} XP`,
        inline: true,
      },
      {
        name: `${EMOJIS.UI.TIME} Cooldowns`,
        value: `Message: ${xpSettings.messageCooldown}s | Command: ${xpSettings.commandCooldown}s`,
        inline: false,
      },
      {
        name: `${EMOJIS.UI.INFO} How XP Works`,
        value: [
          "💬 **Messages**: Random XP every 60 seconds",
          "⚡ **Commands**: Base XP + bonuses for engaging commands",
          "🎭 **Roles**: Fixed XP when users get roles",
          "📊 **Levels**: XP accumulates to unlock new levels",
        ].join("\n"),
        inline: false,
      },
    ])
    .setFooter({
      text: `${EMOJIS.FEATURES.ROLES} XP System • ${interaction.guild.name}`,
      iconURL: interaction.guild.iconURL(),
    })
    .setTimestamp();
}
