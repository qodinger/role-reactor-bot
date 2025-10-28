import { EmbedBuilder } from "discord.js";
import { THEME, EMOJIS } from "../../../config/theme.js";

/**
 * Create the main XP settings embed
 * @param {import('discord.js').CommandInteraction} interaction
 * @param {Object} xpSettings
 * @param {import('discord.js').Channel} levelUpChannel
 * @returns {import('discord.js').EmbedBuilder}
 */
export function createXpSettingsEmbed(interaction, xpSettings, levelUpChannel) {
  const embed = new EmbedBuilder()
    .setTitle("XP System")
    .setDescription(
      `Configure XP system settings for **${interaction.guild.name}**`,
    )
    .setColor(THEME.PRIMARY)
    .setTimestamp()
    .setFooter({
      text: "Role Reactor • XP System",
      iconURL: interaction.client.user.displayAvatarURL(),
    });

  // Configuration fields
  embed.addFields([
    {
      name: "Status",
      value: xpSettings.enabled
        ? `${EMOJIS.STATUS.SUCCESS} Enabled`
        : `${EMOJIS.STATUS.ERROR} Disabled`,
      inline: true,
    },
    {
      name: "Level-Up Channel",
      value: levelUpChannel
        ? `${levelUpChannel}`
        : `${EMOJIS.STATUS.ERROR} Not Set`,
      inline: true,
    },
    {
      name: "Level-Up Messages",
      value: xpSettings.levelUpMessages
        ? `${EMOJIS.STATUS.SUCCESS} Enabled`
        : `${EMOJIS.STATUS.ERROR} Disabled`,
      inline: true,
    },
    {
      name: "Message XP",
      value: xpSettings.messageXP
        ? `${EMOJIS.STATUS.SUCCESS} Enabled (${xpSettings.messageXPAmount.min}-${xpSettings.messageXPAmount.max} XP)`
        : `${EMOJIS.STATUS.ERROR} Disabled`,
      inline: true,
    },
    {
      name: "Command XP",
      value: xpSettings.commandXP
        ? `${EMOJIS.STATUS.SUCCESS} Enabled (${xpSettings.commandXPAmount.base} XP)`
        : `${EMOJIS.STATUS.ERROR} Disabled`,
      inline: true,
    },
    {
      name: "Role XP",
      value: xpSettings.roleXP
        ? `${EMOJIS.STATUS.SUCCESS} Enabled (${xpSettings.roleXPAmount} XP)`
        : `${EMOJIS.STATUS.ERROR} Disabled`,
      inline: true,
    },
    {
      name: "Voice XP",
      value: xpSettings.voiceXP
        ? `${EMOJIS.STATUS.SUCCESS} Enabled (5 XP per 5 minutes)`
        : `${EMOJIS.STATUS.ERROR} Disabled`,
      inline: true,
    },
    {
      name: "Cooldowns",
      value: `Message: ${xpSettings.messageCooldown}s | Command: ${xpSettings.commandCooldown}s`,
      inline: true,
    },
  ]);

  return embed;
}

/**
 * Create XP source configuration embed
 * @param {import('discord.js').CommandInteraction} interaction
 * @param {Object} xpSettings
 * @returns {import('discord.js').EmbedBuilder}
 */
export function createXpSourceEmbed(interaction, xpSettings) {
  const embed = new EmbedBuilder()
    .setTitle("XP Sources")
    .setDescription(
      `Configure which activities award XP in **${interaction.guild.name}**`,
    )
    .setColor(THEME.PRIMARY)
    .setTimestamp()
    .setFooter({
      text: "Role Reactor • XP Sources",
      iconURL: interaction.client.user.displayAvatarURL(),
    });

  // Add XP source fields
  embed.addFields([
    {
      name: "Message XP",
      value: xpSettings.messageXP
        ? `${EMOJIS.STATUS.SUCCESS} Enabled\n${xpSettings.messageXPAmount.min}-${xpSettings.messageXPAmount.max} XP per message\nCooldown: ${xpSettings.messageCooldown}s`
        : `${EMOJIS.STATUS.ERROR} Disabled`,
      inline: true,
    },
    {
      name: "Command XP",
      value: xpSettings.commandXP
        ? `${EMOJIS.STATUS.SUCCESS} Enabled\n${xpSettings.commandXPAmount.base} XP per command\nCooldown: ${xpSettings.commandCooldown}s`
        : `${EMOJIS.STATUS.ERROR} Disabled`,
      inline: true,
    },
    {
      name: "Role XP",
      value: xpSettings.roleXP
        ? `${EMOJIS.STATUS.SUCCESS} Enabled\n${xpSettings.roleXPAmount} XP per role assignment`
        : `${EMOJIS.STATUS.ERROR} Disabled`,
      inline: true,
    },
    {
      name: "Voice XP",
      value: xpSettings.voiceXP
        ? `${EMOJIS.STATUS.SUCCESS} Enabled\n5 XP every 5 minutes in voice channels`
        : `${EMOJIS.STATUS.ERROR} Disabled`,
      inline: true,
    },
  ]);

  return embed;
}

/**
 * Create level-up configuration embed
 * @param {import('discord.js').CommandInteraction} interaction
 * @param {Object} xpSettings
 * @param {import('discord.js').Channel} levelUpChannel
 * @returns {import('discord.js').EmbedBuilder}
 */
export function createLevelUpEmbed(interaction, xpSettings, levelUpChannel) {
  const embed = new EmbedBuilder()
    .setTitle("Level-Up Messages")
    .setDescription(
      `Configure level-up notifications for **${interaction.guild.name}**`,
    )
    .setColor(THEME.PRIMARY)
    .setTimestamp();

  // Add level-up configuration fields
  embed.addFields([
    {
      name: "Status",
      value: xpSettings.levelUpMessages
        ? `${EMOJIS.STATUS.SUCCESS} Enabled`
        : `${EMOJIS.STATUS.ERROR} Disabled`,
      inline: true,
    },
    {
      name: "Channel",
      value: levelUpChannel
        ? `${EMOJIS.STATUS.SUCCESS} ${levelUpChannel}`
        : `${EMOJIS.STATUS.ERROR} Not Set`,
      inline: true,
    },
  ]);

  return embed;
}

/**
 * Create XP test embed
 * @param {import('discord.js').CommandInteraction} interaction
 * @param {Object} xpSettings
 * @returns {import('discord.js').EmbedBuilder}
 */
export function createXpTestEmbed(interaction, xpSettings) {
  const embed = new EmbedBuilder()
    .setTitle("XP System Test")
    .setDescription(
      `Testing XP system functionality for **${interaction.guild.name}**`,
    )
    .setColor(THEME.PRIMARY)
    .setTimestamp()
    .setFooter({
      text: "Role Reactor • XP Test",
      iconURL: interaction.client.user.displayAvatarURL(),
    });

  // Add test results
  embed.addFields([
    {
      name: "System Status",
      value: xpSettings.enabled
        ? `${EMOJIS.STATUS.SUCCESS} Active - XP system is working`
        : `${EMOJIS.STATUS.ERROR} Inactive - Enable the system first`,
      inline: false,
    },
    {
      name: "Available XP Sources",
      value: [
        xpSettings.messageXP ? "✅ Message XP" : "❌ Message XP",
        xpSettings.commandXP ? "✅ Command XP" : "❌ Command XP",
        xpSettings.roleXP ? "✅ Role XP" : "❌ Role XP",
        xpSettings.voiceXP ? "✅ Voice XP" : "❌ Voice XP",
      ].join("\n"),
      inline: false,
    },
  ]);

  return embed;
}

/**
 * Create XP configuration page embed
 * @param {import('discord.js').Interaction} interaction - The interaction
 * @param {Object} xpSettings - Current XP settings
 * @param {import('discord.js').Channel} levelUpChannel - Level-up channel
 * @returns {import('discord.js').EmbedBuilder}
 */
export function createXpConfigPageEmbed(
  interaction,
  _xpSettings,
  _levelUpChannel,
) {
  const embed = new EmbedBuilder()
    .setTitle("XP Configuration")
    .setDescription(
      `Configure your server's XP system settings for **${interaction.guild.name}**. Choose from basic or advanced configuration options below.`,
    )
    .setColor(THEME.PRIMARY)
    .setTimestamp()
    .setFooter({
      text: "Role Reactor • XP Configuration",
      iconURL: interaction.client.user.displayAvatarURL(),
    });

  // Configuration options
  embed.addFields([
    {
      name: "Configuration Options",
      value: [
        "**🔧 Basic Configuration** - Set XP amounts for messages, commands, roles, and voice chat",
        "**⚙️ Advanced Configuration** - Adjust cooldowns, voice XP intervals, and timing settings",
      ].join("\n"),
      inline: false,
    },
  ]);

  return embed;
}
