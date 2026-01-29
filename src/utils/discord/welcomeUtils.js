import { EmbedBuilder } from "discord.js";
import { THEME_COLOR } from "../../config/theme.js";

/**
 * Process welcome message with placeholders
 * @param {string} message - The message template
 * @param {GuildMember} member - The guild member
 * @returns {string} - Processed message
 */
export function processWelcomeMessage(message, member) {
  // Get human member count (excluding bots)
  const humanCount = member.guild.members.cache.filter(m => !m.user.bot).size;

  return message
    .replace(/{user}/g, member.user.toString())
    .replace(/{user.name}/g, member.user.username)
    .replace(/{user.tag}/g, member.user.tag)
    .replace(/{user.id}/g, member.user.id)
    .replace(/{server}/g, member.guild.name)
    .replace(/{server.id}/g, member.guild.id)
    .replace(/{memberCount}/g, humanCount)
    .replace(/{memberCount.ordinal}/g, getOrdinal(humanCount));
}

/**
 * Create welcome embed
 * @param {Object} settings - Welcome settings
 * @param {GuildMember} member - The guild member
 * @returns {EmbedBuilder} - Welcome embed
 */
export function createWelcomeEmbed(settings, member) {
  const embed = new EmbedBuilder()
    .setColor(settings.embedColor || THEME_COLOR)
    .setAuthor({
      name: `${member.user.username} joined the server`,
      iconURL: member.user.displayAvatarURL({ dynamic: true, size: 64 }),
    })
    .setDescription(
      processWelcomeMessage(
        settings.message || "Welcome **{user}** to **{server}**! 🎉",
        member,
      ),
    )
    .addFields({
      name: "",
      value: "",
      inline: false,
    })
    .addFields({
      name: "📊 Server Statistics",
      value: `**${member.guild.members.cache.filter(m => !m.user.bot).size}** members total`,
      inline: true,
    })
    .addFields({
      name: "⏰ Joined At",
      value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
      inline: true,
    })
    .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
    .setTimestamp()
    .setFooter({
      text: `${member.guild.name} • Welcome System`,
      iconURL: member.client.user.displayAvatarURL(),
    });

  return embed;
}

/**
 * Assign auto-role to member
 * @param {GuildMember} member - The guild member
 * @param {string} roleId - The role ID to assign
 * @param {Logger} logger - Logger instance
 * @returns {Promise<boolean>} - Success status
 */
export async function assignAutoRole(member, roleId, logger) {
  try {
    const role = member.guild.roles.cache.get(roleId);
    if (!role) {
      logger.warn(`Auto-role ${roleId} not found in guild ${member.guild.id}`);
      return false;
    }

    // Check if bot has permission to manage roles
    if (!member.guild.members.me.permissions.has("ManageRoles")) {
      logger.warn(
        `Bot lacks ManageRoles permission in guild ${member.guild.id}`,
      );
      return false;
    }

    // Check if bot's highest role is above the auto-role
    const botHighestRole = member.guild.members.me.roles.highest;
    if (role.position >= botHighestRole.position) {
      logger.warn(
        `Auto-role ${role.name} is higher than or equal to bot's highest role in guild ${member.guild.id}`,
      );
      return false;
    }

    await member.roles.add(role, "Welcome System - Auto-role assignment");
    logger.info(
      `Auto-role ${role.name} assigned to ${member.user.tag} in ${member.guild.name}`,
    );
    return true;
  } catch (error) {
    logger.error(
      `Failed to assign auto-role to ${member.user.tag} in ${member.guild.name}`,
      error,
    );
    return false;
  }
}

/**
 * Get ordinal suffix for a number
 * @param {number} num - The number
 * @returns {string} - Number with ordinal suffix
 */
export function getOrdinal(num) {
  const suffixes = ["th", "st", "nd", "rd"];
  const v = num % 100;
  return num + (suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0]);
}

/**
 * Validate welcome settings
 * @param {Object} settings - Welcome settings
 * @param {Guild} guild - The guild
 * @returns {Object} - Validation result
 */
export function validateWelcomeSettings(settings, guild) {
  const errors = [];

  // Check if channel exists
  if (settings.channelId) {
    const channel = guild.channels.cache.get(settings.channelId);
    if (!channel) {
      errors.push("Welcome channel not found");
    } else if (!channel.permissionsFor(guild.members.me).has("SendMessages")) {
      errors.push("Bot lacks SendMessages permission in welcome channel");
    }
  }

  // Check if auto-role exists and is assignable
  if (settings.autoRoleId) {
    const role = guild.roles.cache.get(settings.autoRoleId);
    if (!role) {
      errors.push("Auto-role not found");
    } else if (role.position >= guild.members.me.roles.highest.position) {
      errors.push("Auto-role is higher than or equal to bot's highest role");
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Test the welcome system by sending a sample message
 * @param {Object} settings - Welcome settings
 * @param {GuildMember} member - Discord member object for testing
 * @param {Object} welcomeChannel - Discord channel to send the test message
 * @param {Logger} logger - Logger instance
 * @returns {Promise<Object>} - Test results with success status and details
 */
export async function testWelcomeSystem(
  settings,
  member,
  welcomeChannel,
  logger,
) {
  try {
    // Check if welcome system is configured
    if (!settings.enabled) {
      return {
        success: false,
        error: "Welcome system is not enabled",
        solution:
          "Use `/welcome setup` to configure and enable the welcome system.",
      };
    }

    if (!settings.channelId) {
      return {
        success: false,
        error: "No welcome channel configured",
        solution: "Use `/welcome setup` to set a welcome channel.",
      };
    }

    // Check if channel exists
    if (!welcomeChannel) {
      return {
        success: false,
        error: "Welcome channel not found",
        solution: "Use `/welcome setup` to reconfigure the welcome system.",
      };
    }

    // Check bot permissions in welcome channel
    const botMember = member.guild.members.me;
    const channelPermissions = welcomeChannel.permissionsFor(botMember);

    if (!channelPermissions.has("SendMessages")) {
      return {
        success: false,
        error: "No permission to send messages in welcome channel",
        solution:
          "Please grant me Send Messages permission in the welcome channel.",
      };
    }

    // If using embeds, also check for EmbedLinks permission
    if (settings.embedEnabled && !channelPermissions.has("EmbedLinks")) {
      return {
        success: false,
        error: "No permission to embed links in welcome channel",
        solution:
          "Please grant me Embed Links permission in the welcome channel.",
      };
    }

    // Test auto-role assignment
    let roleTestResult = null;
    let roleTestDetails = "";

    if (settings.autoRoleId) {
      const autoRole = member.guild.roles.cache.get(settings.autoRoleId);

      if (autoRole) {
        // Check bot permissions for role assignment
        const hasManageRoles = botMember.permissions.has("ManageRoles");
        const botHighestRole = botMember.roles.highest;
        const canAssignRole = autoRole.position < botHighestRole.position;

        if (!hasManageRoles) {
          roleTestResult = false;
          roleTestDetails = "Bot lacks ManageRoles permission";
        } else if (!canAssignRole) {
          roleTestResult = false;
          roleTestDetails = "Auto-role is higher than bot's highest role";
        } else {
          // Try actual role assignment
          try {
            await member.roles.add(autoRole, "Welcome System - Test");
            roleTestResult = true;
            roleTestDetails = "✅ Role assigned successfully";
          } catch (error) {
            roleTestResult = false;
            roleTestDetails = `❌ Role assignment failed: ${error.message}`;
          }
        }
      } else {
        roleTestResult = false;
        roleTestDetails = "Auto-role not found";
      }
    }

    // Send test welcome message
    if (settings.embedEnabled) {
      const embed = createWelcomeEmbed(settings, member);
      await welcomeChannel.send({ embeds: [embed] });
    } else {
      const processedMessage = processWelcomeMessage(settings.message, member);
      await welcomeChannel.send(processedMessage);
    }

    return {
      success: true,
      roleTestResult,
      roleTestDetails,
      format: settings.embedEnabled ? "Embed" : "Text",
    };
  } catch (error) {
    logger.error("Error testing welcome system", error);

    // Handle specific Discord API errors
    if (error.code === 50013) {
      return {
        success: false,
        error: "Missing permissions to send messages in the welcome channel",
        solution:
          "Please ensure the bot has Send Messages and Embed Links permissions in the welcome channel.",
      };
    }

    return {
      success: false,
      error: "An error occurred while testing the welcome system",
      solution: "Please try again or contact support if the issue persists.",
    };
  }
}
