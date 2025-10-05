import { EmbedBuilder } from "discord.js";
import { THEME_COLOR, EMOJIS, THEME } from "../../../config/theme.js";

/**
 * Create the main XP settings embed
 * @param {import('discord.js').CommandInteraction} interaction
 * @param {Object} xpSettings
 * @param {import('discord.js').Channel} levelUpChannel
 * @returns {import('discord.js').EmbedBuilder}
 */
export function createXpSettingsEmbed(interaction, xpSettings, levelUpChannel) {
  const embed = new EmbedBuilder()
    .setTitle(`${EMOJIS.FEATURES.EXPERIENCE} XP System Settings`)
    .setDescription(
      `Current XP system configuration for **${interaction.guild.name}**`,
    )
    .setColor(THEME_COLOR)
    .setTimestamp()
    .setFooter({
      text: "Role Reactor • XP System",
      iconURL: interaction.client.user.displayAvatarURL(),
    });

  // Add configuration fields
  embed.addFields([
    {
      name: `${EMOJIS.STATUS.SUCCESS} Status`,
      value: xpSettings.enabled
        ? `${EMOJIS.STATUS.SUCCESS} **Enabled**`
        : `${EMOJIS.STATUS.ERROR} **Disabled**`,
      inline: true,
    },
    {
      name: `${EMOJIS.UI.CHANNELS} Level-Up Channel`,
      value: levelUpChannel
        ? `${levelUpChannel}`
        : `${EMOJIS.STATUS.ERROR} **Not Set**`,
      inline: true,
    },
    {
      name: `${EMOJIS.ACTIONS.EDIT} Level-Up Messages`,
      value: xpSettings.levelUpMessages
        ? `${EMOJIS.STATUS.SUCCESS} **Enabled**`
        : `${EMOJIS.STATUS.ERROR} **Disabled**`,
      inline: true,
    },
    {
      name: `${EMOJIS.UI.MESSAGE} Message XP`,
      value: xpSettings.messageXP
        ? `${EMOJIS.STATUS.SUCCESS} **Enabled** (${xpSettings.messageXPAmount.min}-${xpSettings.messageXPAmount.max} XP)`
        : `${EMOJIS.STATUS.ERROR} **Disabled**`,
      inline: true,
    },
    {
      name: `${EMOJIS.UI.COMMAND} Command XP`,
      value: xpSettings.commandXP
        ? `${EMOJIS.STATUS.SUCCESS} **Enabled** (${xpSettings.commandXPAmount.base} XP)`
        : `${EMOJIS.STATUS.ERROR} **Disabled**`,
      inline: true,
    },
    {
      name: `${EMOJIS.FEATURES.ROLES} Role XP`,
      value: xpSettings.roleXP
        ? `${EMOJIS.STATUS.SUCCESS} **Enabled** (${xpSettings.roleXPAmount} XP)`
        : `${EMOJIS.STATUS.ERROR} **Disabled**`,
      inline: true,
    },
    {
      name: "🎤 Voice XP",
      value: xpSettings.voiceXP
        ? `${EMOJIS.STATUS.SUCCESS} **Enabled** (5 XP per 5 minutes)`
        : `${EMOJIS.STATUS.ERROR} **Disabled**`,
      inline: true,
    },
    {
      name: `${EMOJIS.UI.TIME} Cooldowns`,
      value: `Message: ${xpSettings.messageCooldown}s | Command: ${xpSettings.commandCooldown}s`,
      inline: true,
    },
    {
      name: `${EMOJIS.UI.INFO} How XP Works`,
      value: [
        "💬 **Messages**: Random XP every 60 seconds",
        "⚡ **Commands**: Base XP + bonuses for engaging commands",
        "🎭 **Roles**: Fixed XP when users get roles",
        "🎤 **Voice**: 5 XP every 5 minutes in voice channels",
        "📊 **Levels**: XP accumulates to unlock new levels",
      ].join("\n"),
      inline: false,
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
    .setTitle(`${EMOJIS.UI.INFO} XP Sources Configuration`)
    .setDescription(
      `Configure which activities award XP in **${interaction.guild.name}**`,
    )
    .setColor(THEME_COLOR)
    .setTimestamp()
    .setFooter({
      text: "Role Reactor • XP Sources",
      iconURL: interaction.client.user.displayAvatarURL(),
    });

  // Add XP source fields
  embed.addFields([
    {
      name: `${EMOJIS.UI.MESSAGE} Message XP`,
      value: xpSettings.messageXP
        ? `${EMOJIS.STATUS.SUCCESS} **Enabled**\n${xpSettings.messageXPAmount.min}-${xpSettings.messageXPAmount.max} XP per message\nCooldown: ${xpSettings.messageCooldown}s`
        : `${EMOJIS.STATUS.ERROR} **Disabled**`,
      inline: true,
    },
    {
      name: `${EMOJIS.UI.COMMAND} Command XP`,
      value: xpSettings.commandXP
        ? `${EMOJIS.STATUS.SUCCESS} **Enabled**\n${xpSettings.commandXPAmount.base} XP per command\nCooldown: ${xpSettings.commandCooldown}s`
        : `${EMOJIS.STATUS.ERROR} **Disabled**`,
      inline: true,
    },
    {
      name: `${EMOJIS.FEATURES.ROLES} Role XP`,
      value: xpSettings.roleXP
        ? `${EMOJIS.STATUS.SUCCESS} **Enabled**\n${xpSettings.roleXPAmount} XP per role assignment`
        : `${EMOJIS.STATUS.ERROR} **Disabled**`,
      inline: true,
    },
    {
      name: "🎤 Voice XP",
      value: xpSettings.voiceXP
        ? `${EMOJIS.STATUS.SUCCESS} **Enabled**\n5 XP every 5 minutes in voice channels`
        : `${EMOJIS.STATUS.ERROR} **Disabled**`,
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
    .setTitle(`${EMOJIS.FEATURES.EXPERIENCE} Level-Up Messages Configuration`)
    .setDescription(
      `Configure level-up notifications for **${interaction.guild.name}**`,
    )
    .setColor(THEME_COLOR)
    .setTimestamp()
    .setFooter({
      text: "Role Reactor • Level-Up Messages",
      iconURL: interaction.client.user.displayAvatarURL(),
    });

  // Add level-up configuration fields
  embed.addFields([
    {
      name: `${EMOJIS.STATUS.SUCCESS} Level-Up Messages`,
      value: xpSettings.levelUpMessages
        ? `${EMOJIS.STATUS.SUCCESS} **Enabled**`
        : `${EMOJIS.STATUS.ERROR} **Disabled**`,
      inline: true,
    },
    {
      name: `${EMOJIS.UI.CHANNELS} Channel`,
      value: levelUpChannel
        ? `${levelUpChannel}`
        : `${EMOJIS.STATUS.ERROR} **Not Set**`,
      inline: true,
    },
    {
      name: `${EMOJIS.UI.INFO} Features`,
      value: [
        "🎉 **Celebration**: Users get notified when they level up",
        "📊 **Progress Bar**: Visual progress to next level",
        "📈 **Statistics**: Shows total XP and level information",
        "🎨 **Rich Embeds**: Beautiful, customizable messages",
      ].join("\n"),
      inline: false,
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
    .setTitle(`${EMOJIS.ACTIONS.TEST} XP System Test`)
    .setDescription(
      `Testing XP system functionality for **${interaction.guild.name}**`,
    )
    .setColor(THEME_COLOR)
    .setTimestamp()
    .setFooter({
      text: "Role Reactor • XP Test",
      iconURL: interaction.client.user.displayAvatarURL(),
    });

  // Add test results
  embed.addFields([
    {
      name: `${EMOJIS.STATUS.SUCCESS} System Status`,
      value: xpSettings.enabled
        ? `${EMOJIS.STATUS.SUCCESS} **Active** - XP system is working`
        : `${EMOJIS.STATUS.ERROR} **Inactive** - Enable the system first`,
      inline: false,
    },
    {
      name: `${EMOJIS.UI.INFO} Available XP Sources`,
      value: [
        xpSettings.messageXP ? "✅ Message XP" : "❌ Message XP",
        xpSettings.commandXP ? "✅ Command XP" : "❌ Command XP",
        xpSettings.roleXP ? "✅ Role XP" : "❌ Role XP",
        xpSettings.voiceXP ? "✅ Voice XP" : "❌ Voice XP",
      ].join("\n"),
      inline: false,
    },
    {
      name: `${EMOJIS.UI.INFO} Test Instructions`,
      value: [
        "1. Send a message in any channel (if message XP is enabled)",
        "2. Use a command (if command XP is enabled)",
        "3. Join a voice channel (if voice XP is enabled)",
        "4. Check your level with `/level`",
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
    .setTitle(`${EMOJIS.FEATURES.EXPERIENCE} XP Configuration`)
    .setDescription(
      `Configure your server's XP system settings for **${interaction.guild.name}**. Choose from basic or advanced configuration options below.`,
    )
    .setColor(THEME.ADMIN)
    .setTimestamp()
    .setFooter({
      text: "Role Reactor • XP Configuration",
      iconURL: interaction.client.user.displayAvatarURL(),
    });

  // Configuration options
  embed.addFields([
    {
      name: `${EMOJIS.UI.MENU} Configuration Options`,
      value: [
        "**🔧 Basic Configuration** - Set XP amounts for messages, commands, roles, and voice chat",
        "**⚙️ Advanced Configuration** - Adjust cooldowns, voice XP intervals, and timing settings",
      ].join("\n"),
      inline: false,
    },
  ]);

  return embed;
}
