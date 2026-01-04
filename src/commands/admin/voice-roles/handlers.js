import { MessageFlags, PermissionFlagsBits } from "discord.js";
import { getLogger } from "../../../utils/logger.js";
import { getStorageManager } from "../../../utils/storage/storageManager.js";
import {
  errorEmbed,
  successEmbed,
} from "../../../utils/discord/responseMessages.js";
import { createVoiceControlListEmbed } from "./embeds.js";
import { delay } from "../../../utils/delay.js";

/**
 * Apply voice roles action to users already in voice channels with the role
 * Optimized with rate limiting and batching to prevent API rate limits
 * @param {import('discord.js').Guild} guild - The guild
 * @param {string} roleId - The role ID
 * @param {string} actionType - 'disconnect', 'mute', 'deafen', or 'move'
 * @param {string} [targetChannelId] - Target channel ID for move action
 * @param {number} [maxMembers=50] - Maximum number of members to process (prevents timeout)
 */
async function applyToExistingVoiceMembers(
  guild,
  roleId,
  actionType,
  targetChannelId = null,
  maxMembers = 50,
) {
  const logger = getLogger();
  const botMember = guild.members.me;

  try {
    // Get all voice channels in the guild
    const voiceChannels = guild.channels.cache.filter(channel =>
      channel.isVoiceBased(),
    );

    // Collect all members that need action applied
    const membersToProcess = [];
    for (const channel of voiceChannels.values()) {
      const membersInChannel = channel.members.filter(
        member => !member.user.bot && member.roles.cache.has(roleId),
      );
      for (const member of membersInChannel.values()) {
        if (member.voice?.channel) {
          membersToProcess.push(member);
        }
      }
    }

    // Limit processing to prevent timeout and rate limits
    const totalMembers = membersToProcess.length;
    const membersToHandle = membersToProcess.slice(0, maxMembers);
    const skippedCount = totalMembers - membersToHandle.length;

    if (skippedCount > 0) {
      logger.warn(
        `Processing ${membersToHandle.length} of ${totalMembers} members with voice roles role (${skippedCount} skipped to prevent timeout)`,
      );
    }

    let affectedCount = 0;
    const batchSize = 5; // Process 5 members at a time
    const delayBetweenBatches = 200; // 200ms delay between batches to respect rate limits

    // Process members in batches with rate limiting
    for (let i = 0; i < membersToHandle.length; i += batchSize) {
      const batch = membersToHandle.slice(i, i + batchSize);

      // Process batch in parallel (but limited to batchSize)
      await Promise.all(
        batch.map(async member => {
          try {
            switch (actionType) {
              case "disconnect":
                if (
                  botMember?.permissions.has(PermissionFlagsBits.MoveMembers)
                ) {
                  if (member.voice.channel) {
                    await member.voice.disconnect(
                      "Voice roles role was configured",
                    );
                    affectedCount++;
                    logger.debug(
                      `Disconnected ${member.user.tag} who was already in voice`,
                    );
                  }
                }
                break;

              case "mute":
                if (
                  botMember?.permissions.has(PermissionFlagsBits.MuteMembers)
                ) {
                  if (!member.voice.mute) {
                    await member.voice.setMute(
                      true,
                      "Voice roles role was configured",
                    );
                    affectedCount++;
                    logger.debug(
                      `Muted ${member.user.tag} who was already in voice`,
                    );
                  }
                }
                break;

              case "deafen":
                if (
                  botMember?.permissions.has(PermissionFlagsBits.DeafenMembers)
                ) {
                  if (!member.voice.deaf) {
                    await member.voice.setDeaf(
                      true,
                      "Voice roles role was configured",
                    );
                    affectedCount++;
                    logger.debug(
                      `Deafened ${member.user.tag} who was already in voice`,
                    );
                  }
                }
                break;

              case "move":
                if (
                  targetChannelId &&
                  botMember?.permissions.has(PermissionFlagsBits.MoveMembers)
                ) {
                  const targetChannel =
                    guild.channels.cache.get(targetChannelId);
                  if (
                    targetChannel &&
                    member.voice.channelId !== targetChannelId
                  ) {
                    const botPermissions =
                      targetChannel.permissionsFor(botMember);
                    if (
                      botPermissions?.has("Connect") &&
                      botPermissions?.has("MoveMembers")
                    ) {
                      await member.voice.setChannel(
                        targetChannel,
                        "Voice roles role was configured",
                      );
                      affectedCount++;
                      logger.debug(
                        `Moved ${member.user.tag} who was already in voice`,
                      );
                    }
                  }
                }
                break;
            }
          } catch (error) {
            logger.error(
              `Failed to apply ${actionType} to ${member.user.tag}:`,
              error.message,
            );
          }
        }),
      );

      // Rate limit: delay between batches (except for the last batch)
      if (i + batchSize < membersToHandle.length) {
        await delay(delayBetweenBatches);
      }
    }

    if (affectedCount > 0) {
      logger.info(
        `Applied ${actionType} action to ${affectedCount} existing voice member(s) with role ${roleId}${skippedCount > 0 ? ` (${skippedCount} skipped)` : ""}`,
      );
    }

    return { affectedCount, totalMembers, skippedCount };
  } catch (error) {
    logger.error(`Error applying voice roles to existing members:`, error);
    return { affectedCount: 0, totalMembers: 0, skippedCount: 0 };
  }
}

/**
 * Handle adding a role to the disconnect list
 * @param {import('discord.js').CommandInteraction} interaction
 */
export async function handleDisconnectAdd(interaction) {
  const logger = getLogger();

  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const role = interaction.options.getRole("role");

    // Check if bot can manage this role
    if (role.position >= interaction.guild.members.me.roles.highest.position) {
      return interaction.editReply(
        errorEmbed({
          title: "Role Position Error",
          description: `I cannot manage the role ${role.toString()} because it's higher than or equal to my highest role.`,
          solution:
            "Please move my role above the role you want to use, or use a role with a lower position.",
        }),
      );
    }

    const storageManager = await getStorageManager();
    const settings = await storageManager.getVoiceControlRoles(
      interaction.guild.id,
    );

    // Check if role is already in the disconnect list
    if (settings.disconnectRoleIds?.includes(role.id)) {
      return interaction.editReply(
        errorEmbed({
          title: "Role Already Added",
          description: `The role ${role.toString()} is already configured to disconnect users from voice channels.`,
          solution: "Use `/voice-roles list` to see all configured roles.",
        }),
      );
    }

    // Add the role
    await storageManager.addVoiceDisconnectRole(interaction.guild.id, role.id);

    logger.info(
      `Added voice disconnect role ${role.name} (${role.id}) in ${interaction.guild.name}`,
    );

    // Apply to users already in voice channels (async, non-blocking)
    const resultPromise = applyToExistingVoiceMembers(
      interaction.guild,
      role.id,
      "disconnect",
    );

    // Respond immediately, then process members in background
    let description = `The role ${role.toString()} will now automatically disconnect users from voice channels when assigned.`;

    // Wait briefly to see if we can get a quick result
    const quickResult = await Promise.race([
      resultPromise,
      new Promise(resolve => {
        setTimeout(() => resolve(null), 500);
      }),
    ]);

    if (quickResult) {
      const { affectedCount, skippedCount } = quickResult;
      if (affectedCount > 0) {
        description += `\n\n**Applied to ${affectedCount} user(s) already in voice channels.${skippedCount > 0 ? ` (${skippedCount} more will be processed in background)` : ""}**`;
      }
    } else {
      // Still processing, mention it's happening in background
      description += `\n\n*Processing existing voice members in background...*`;
    }

    // Continue processing in background (don't await)
    resultPromise
      .then(result => {
        if (result.affectedCount > 0 || result.skippedCount > 0) {
          logger.info(
            `Background processing complete: ${result.affectedCount} affected, ${result.skippedCount} skipped`,
          );
        }
      })
      .catch(error => {
        logger.error("Background voice roles processing error:", error);
      });

    return interaction.editReply(
      successEmbed({
        title: "Role Added",
        description,
        fields: [
          {
            name: "How It Works",
            value:
              "When a user gets this role, if they're currently in a voice channel, they will be automatically disconnected.",
            inline: false,
          },
        ],
      }),
    );
  } catch (error) {
    logger.error("Error in voice-roles disconnect add handler:", error);
    return interaction.editReply(
      errorEmbed({
        title: "Error",
        description: "Failed to add voice disconnect role.",
        solution: "Please try again or contact support if the issue persists.",
      }),
    );
  }
}

/**
 * Handle removing a role from the disconnect list
 * @param {import('discord.js').CommandInteraction} interaction
 */
export async function handleDisconnectRemove(interaction) {
  const logger = getLogger();

  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const role = interaction.options.getRole("role");

    const storageManager = await getStorageManager();
    const settings = await storageManager.getVoiceControlRoles(
      interaction.guild.id,
    );

    // Check if role is in the disconnect list
    if (!settings.disconnectRoleIds?.includes(role.id)) {
      return interaction.editReply(
        errorEmbed({
          title: "Role Not Found",
          description: `The role ${role.toString()} is not configured to disconnect users from voice channels.`,
          solution: "Use `/voice-roles list` to see all configured roles.",
        }),
      );
    }

    // Remove the role
    await storageManager.removeVoiceDisconnectRole(
      interaction.guild.id,
      role.id,
    );

    logger.info(
      `Removed voice disconnect role ${role.name} (${role.id}) in ${interaction.guild.name}`,
    );

    return interaction.editReply(
      successEmbed({
        title: "Role Removed",
        description: `The role ${role.toString()} will no longer disconnect users from voice channels.`,
      }),
    );
  } catch (error) {
    logger.error("Error in voice-roles disconnect remove handler:", error);
    return interaction.editReply(
      errorEmbed({
        title: "Error",
        description: "Failed to remove voice disconnect role.",
        solution: "Please try again or contact support if the issue persists.",
      }),
    );
  }
}

/**
 * Handle adding a role to the mute list
 * @param {import('discord.js').CommandInteraction} interaction
 */
export async function handleMuteAdd(interaction) {
  const logger = getLogger();

  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const role = interaction.options.getRole("role");

    // Check if bot can manage this role
    if (role.position >= interaction.guild.members.me.roles.highest.position) {
      return interaction.editReply(
        errorEmbed({
          title: "Role Position Error",
          description: `I cannot manage the role ${role.toString()} because it's higher than or equal to my highest role.`,
          solution:
            "Please move my role above the role you want to use, or use a role with a lower position.",
        }),
      );
    }

    const storageManager = await getStorageManager();
    const settings = await storageManager.getVoiceControlRoles(
      interaction.guild.id,
    );

    // Check if role is already in the mute list
    if (settings.muteRoleIds?.includes(role.id)) {
      return interaction.editReply(
        errorEmbed({
          title: "Role Already Added",
          description: `The role ${role.toString()} is already configured to mute users in voice channels.`,
          solution: "Use `/voice-roles list` to see all configured roles.",
        }),
      );
    }

    // Add the role
    await storageManager.addVoiceMuteRole(interaction.guild.id, role.id);

    logger.info(
      `Added voice mute role ${role.name} (${role.id}) in ${interaction.guild.name}`,
    );

    // Apply to users already in voice channels (async, non-blocking)
    const resultPromise = applyToExistingVoiceMembers(
      interaction.guild,
      role.id,
      "mute",
    );

    // Respond immediately, then process members in background
    let description = `The role ${role.toString()} will now automatically mute users in voice channels when assigned.`;

    // Wait briefly to see if we can get a quick result
    const quickResult = await Promise.race([
      resultPromise,
      new Promise(resolve => {
        setTimeout(() => resolve(null), 500);
      }),
    ]);

    if (quickResult) {
      const { affectedCount, skippedCount } = quickResult;
      if (affectedCount > 0) {
        description += `\n\n**Applied to ${affectedCount} user(s) already in voice channels.${skippedCount > 0 ? ` (${skippedCount} more will be processed in background)` : ""}**`;
      }
    } else {
      // Still processing, mention it's happening in background
      description += `\n\n*Processing existing voice members in background...*`;
    }

    // Continue processing in background (don't await)
    resultPromise
      .then(result => {
        if (result.affectedCount > 0 || result.skippedCount > 0) {
          logger.info(
            `Background processing complete: ${result.affectedCount} affected, ${result.skippedCount} skipped`,
          );
        }
      })
      .catch(error => {
        logger.error("Background voice roles processing error:", error);
      });

    return interaction.editReply(
      successEmbed({
        title: "Role Added",
        description,
        fields: [
          {
            name: "How It Works",
            value:
              "When a user gets this role, if they're currently in a voice channel, they will be automatically muted.",
            inline: false,
          },
        ],
      }),
    );
  } catch (error) {
    logger.error("Error in voice-roles mute add handler:", error);
    return interaction.editReply(
      errorEmbed({
        title: "Error",
        description: "Failed to add voice mute role.",
        solution: "Please try again or contact support if the issue persists.",
      }),
    );
  }
}

/**
 * Handle removing a role from the mute list
 * @param {import('discord.js').CommandInteraction} interaction
 */
export async function handleMuteRemove(interaction) {
  const logger = getLogger();

  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const role = interaction.options.getRole("role");

    const storageManager = await getStorageManager();
    const settings = await storageManager.getVoiceControlRoles(
      interaction.guild.id,
    );

    // Check if role is in the mute list
    if (!settings.muteRoleIds?.includes(role.id)) {
      return interaction.editReply(
        errorEmbed({
          title: "Role Not Found",
          description: `The role ${role.toString()} is not configured to mute users in voice channels.`,
          solution: "Use `/voice-roles list` to see all configured roles.",
        }),
      );
    }

    // Remove the role
    await storageManager.removeVoiceMuteRole(interaction.guild.id, role.id);

    logger.info(
      `Removed voice mute role ${role.name} (${role.id}) in ${interaction.guild.name}`,
    );

    return interaction.editReply(
      successEmbed({
        title: "Role Removed",
        description: `The role ${role.toString()} will no longer mute users in voice channels.`,
      }),
    );
  } catch (error) {
    logger.error("Error in voice-roles mute remove handler:", error);
    return interaction.editReply(
      errorEmbed({
        title: "Error",
        description: "Failed to remove voice mute role.",
        solution: "Please try again or contact support if the issue persists.",
      }),
    );
  }
}

/**
 * Handle adding a role to the deafen list
 * @param {import('discord.js').CommandInteraction} interaction
 */
export async function handleDeafenAdd(interaction) {
  const logger = getLogger();

  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const role = interaction.options.getRole("role");

    // Check if bot can manage this role
    if (role.position >= interaction.guild.members.me.roles.highest.position) {
      return interaction.editReply(
        errorEmbed({
          title: "Role Position Error",
          description: `I cannot manage the role ${role.toString()} because it's higher than or equal to my highest role.`,
          solution:
            "Please move my role above the role you want to use, or use a role with a lower position.",
        }),
      );
    }

    const storageManager = await getStorageManager();
    const settings = await storageManager.getVoiceControlRoles(
      interaction.guild.id,
    );

    // Check if role is already in the deafen list
    if (settings.deafenRoleIds?.includes(role.id)) {
      return interaction.editReply(
        errorEmbed({
          title: "Role Already Added",
          description: `The role ${role.toString()} is already configured to deafen users in voice channels.`,
          solution: "Use `/voice-roles list` to see all configured roles.",
        }),
      );
    }

    // Add the role
    await storageManager.addVoiceDeafenRole(interaction.guild.id, role.id);

    logger.info(
      `Added voice deafen role ${role.name} (${role.id}) in ${interaction.guild.name}`,
    );

    // Apply to users already in voice channels (async, non-blocking)
    const resultPromise = applyToExistingVoiceMembers(
      interaction.guild,
      role.id,
      "deafen",
    );

    // Respond immediately, then process members in background
    let description = `The role ${role.toString()} will now automatically deafen users in voice channels when assigned.`;

    // Wait briefly to see if we can get a quick result
    const quickResult = await Promise.race([
      resultPromise,
      new Promise(resolve => {
        setTimeout(() => resolve(null), 500);
      }),
    ]);

    if (quickResult) {
      const { affectedCount, skippedCount } = quickResult;
      if (affectedCount > 0) {
        description += `\n\n**Applied to ${affectedCount} user(s) already in voice channels.${skippedCount > 0 ? ` (${skippedCount} more will be processed in background)` : ""}**`;
      }
    } else {
      // Still processing, mention it's happening in background
      description += `\n\n*Processing existing voice members in background...*`;
    }

    // Continue processing in background (don't await)
    resultPromise
      .then(result => {
        if (result.affectedCount > 0 || result.skippedCount > 0) {
          logger.info(
            `Background processing complete: ${result.affectedCount} affected, ${result.skippedCount} skipped`,
          );
        }
      })
      .catch(error => {
        logger.error("Background voice roles processing error:", error);
      });

    return interaction.editReply(
      successEmbed({
        title: "Role Added",
        description,
        fields: [
          {
            name: "How It Works",
            value:
              "When a user gets this role, if they're currently in a voice channel, they will be automatically deafened.",
            inline: false,
          },
        ],
      }),
    );
  } catch (error) {
    logger.error("Error in voice-roles deafen add handler:", error);
    return interaction.editReply(
      errorEmbed({
        title: "Error",
        description: "Failed to add voice deafen role.",
        solution: "Please try again or contact support if the issue persists.",
      }),
    );
  }
}

/**
 * Handle removing a role from the deafen list
 * @param {import('discord.js').CommandInteraction} interaction
 */
export async function handleDeafenRemove(interaction) {
  const logger = getLogger();

  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const role = interaction.options.getRole("role");

    const storageManager = await getStorageManager();
    const settings = await storageManager.getVoiceControlRoles(
      interaction.guild.id,
    );

    // Check if role is in the deafen list
    if (!settings.deafenRoleIds?.includes(role.id)) {
      return interaction.editReply(
        errorEmbed({
          title: "Role Not Found",
          description: `The role ${role.toString()} is not configured to deafen users in voice channels.`,
          solution: "Use `/voice-roles list` to see all configured roles.",
        }),
      );
    }

    // Remove the role
    await storageManager.removeVoiceDeafenRole(interaction.guild.id, role.id);

    logger.info(
      `Removed voice deafen role ${role.name} (${role.id}) in ${interaction.guild.name}`,
    );

    return interaction.editReply(
      successEmbed({
        title: "Role Removed",
        description: `The role ${role.toString()} will no longer deafen users in voice channels.`,
      }),
    );
  } catch (error) {
    logger.error("Error in voice-roles deafen remove handler:", error);
    return interaction.editReply(
      errorEmbed({
        title: "Error",
        description: "Failed to remove voice deafen role.",
        solution: "Please try again or contact support if the issue persists.",
      }),
    );
  }
}

/**
 * Handle adding a role to the move list
 * @param {import('discord.js').CommandInteraction} interaction
 */
export async function handleMoveAdd(interaction) {
  const logger = getLogger();

  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const role = interaction.options.getRole("role");
    const channel = interaction.options.getChannel("channel");

    // Validate channel type
    if (!channel.isVoiceBased()) {
      return interaction.editReply(
        errorEmbed({
          title: "Invalid Channel",
          description: `${channel.toString()} is not a voice channel.`,
          solution: "Please select a voice channel.",
        }),
      );
    }

    // Check if bot can manage this role
    if (role.position >= interaction.guild.members.me.roles.highest.position) {
      return interaction.editReply(
        errorEmbed({
          title: "Role Position Error",
          description: `I cannot manage the role ${role.toString()} because it's higher than or equal to my highest role.`,
          solution:
            "Please move my role above the role you want to use, or use a role with a lower position.",
        }),
      );
    }

    // Check bot permissions for the target channel
    const botMember = interaction.guild.members.me;
    if (
      !channel.permissionsFor(botMember).has("Connect") ||
      !channel.permissionsFor(botMember).has("MoveMembers")
    ) {
      return interaction.editReply(
        errorEmbed({
          title: "Missing Channel Permissions",
          description: `I don't have permission to move users to ${channel.toString()}.`,
          solution:
            "Please grant me Connect and Move Members permissions in the target channel.",
        }),
      );
    }

    const storageManager = await getStorageManager();
    const settings = await storageManager.getVoiceControlRoles(
      interaction.guild.id,
    );

    // Check if role is already in the move list
    if (settings.moveRoleMappings?.[role.id]) {
      const existingChannelId = settings.moveRoleMappings[role.id];
      const existingChannel =
        interaction.guild.channels.cache.get(existingChannelId);

      // If channel was deleted, allow re-adding with new channel
      if (!existingChannel) {
        // Remove the invalid mapping first
        await storageManager.removeVoiceMoveRole(interaction.guild.id, role.id);
        logger.info(
          `Cleaned up invalid move role mapping for ${role.name} (${role.id}) - target channel ${existingChannelId} was deleted`,
        );
      } else {
        return interaction.editReply(
          errorEmbed({
            title: "Role Already Added",
            description: `The role ${role.toString()} is already configured to move users to ${existingChannel.toString()}.`,
            solution:
              "Use `/voice-roles move remove` first, or use `/voice-roles list` to see all configured roles.",
          }),
        );
      }
    }

    // Add the role
    await storageManager.addVoiceMoveRole(
      interaction.guild.id,
      role.id,
      channel.id,
    );

    logger.info(
      `Added voice move role ${role.name} (${role.id}) -> ${channel.name} (${channel.id}) in ${interaction.guild.name}`,
    );

    // Apply to users already in voice channels (async, non-blocking)
    const resultPromise = applyToExistingVoiceMembers(
      interaction.guild,
      role.id,
      "move",
      channel.id,
    );

    // Respond immediately, then process members in background
    let description = `The role ${role.toString()} will now automatically move users to ${channel.toString()} when assigned.`;

    // Wait briefly to see if we can get a quick result
    const quickResult = await Promise.race([
      resultPromise,
      new Promise(resolve => {
        setTimeout(() => resolve(null), 500);
      }),
    ]);

    if (quickResult) {
      const { affectedCount, skippedCount } = quickResult;
      if (affectedCount > 0) {
        description += `\n\n**Applied to ${affectedCount} user(s) already in voice channels.${skippedCount > 0 ? ` (${skippedCount} more will be processed in background)` : ""}**`;
      }
    } else {
      // Still processing, mention it's happening in background
      description += `\n\n*Processing existing voice members in background...*`;
    }

    // Continue processing in background (don't await)
    resultPromise
      .then(result => {
        if (result.affectedCount > 0 || result.skippedCount > 0) {
          logger.info(
            `Background processing complete: ${result.affectedCount} affected, ${result.skippedCount} skipped`,
          );
        }
      })
      .catch(error => {
        logger.error("Background voice roles processing error:", error);
      });

    return interaction.editReply(
      successEmbed({
        title: "Role Added",
        description,
        fields: [
          {
            name: "How It Works",
            value:
              "When a user gets this role, if they're currently in a voice channel, they will be automatically moved to the target channel.",
            inline: false,
          },
        ],
      }),
    );
  } catch (error) {
    logger.error("Error in voice-roles move add handler:", error);
    return interaction.editReply(
      errorEmbed({
        title: "Error",
        description: "Failed to add voice move role.",
        solution: "Please try again or contact support if the issue persists.",
      }),
    );
  }
}

/**
 * Handle removing a role from the move list
 * @param {import('discord.js').CommandInteraction} interaction
 */
export async function handleMoveRemove(interaction) {
  const logger = getLogger();

  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const role = interaction.options.getRole("role");

    const storageManager = await getStorageManager();
    const settings = await storageManager.getVoiceControlRoles(
      interaction.guild.id,
    );

    // Check if role is in the move list
    if (!settings.moveRoleMappings?.[role.id]) {
      return interaction.editReply(
        errorEmbed({
          title: "Role Not Found",
          description: `The role ${role.toString()} is not configured to move users to a voice channel.`,
          solution: "Use `/voice-roles list` to see all configured roles.",
        }),
      );
    }

    // Remove the role
    await storageManager.removeVoiceMoveRole(interaction.guild.id, role.id);

    logger.info(
      `Removed voice move role ${role.name} (${role.id}) in ${interaction.guild.name}`,
    );

    return interaction.editReply(
      successEmbed({
        title: "Role Removed",
        description: `The role ${role.toString()} will no longer move users to a voice channel.`,
      }),
    );
  } catch (error) {
    logger.error("Error in voice-roles move remove handler:", error);
    return interaction.editReply(
      errorEmbed({
        title: "Error",
        description: "Failed to remove voice move role.",
        solution: "Please try again or contact support if the issue persists.",
      }),
    );
  }
}

/**
 * Handle listing all voice roles roles
 * @param {import('discord.js').CommandInteraction} interaction
 */
export async function handleList(interaction) {
  const logger = getLogger();

  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const storageManager = await getStorageManager();
    const settings = await storageManager.getVoiceControlRoles(
      interaction.guild.id,
    );

    const embed = createVoiceControlListEmbed(interaction.guild, settings);

    return interaction.editReply({ embeds: [embed] });
  } catch (error) {
    logger.error("Error in voice-roles list handler:", error);
    return interaction.editReply(
      errorEmbed({
        title: "Error",
        description: "Failed to list voice roles roles.",
        solution: "Please try again or contact support if the issue persists.",
      }),
    );
  }
}
