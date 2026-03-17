/**
 * Giveaway Command Handlers
 * @module commands/general/giveaway/handlers
 */

import { PermissionsBitField, EmbedBuilder } from 'discord.js';
import giveawayManager from '../../../features/giveaway/GiveawayManager.js';
import {
  createGiveawayEmbed,
  createConfirmationEmbed,
  createGiveawayListEmbed,
  createStatsEmbed
} from './embeds.js';
import { createActiveGiveawayActions } from './components.js';
import {
  parseDuration,
  formatDuration,
  validateGiveawayCreation,
  sanitizeText
} from '../../../utils/giveaway/utils.js';
import { getLogger } from '../../../utils/logger.js';

const logger = getLogger();

/**
 * Handle /giveaway create command
 * @param {Object} interaction - Discord interaction
 */
export async function handleCreate(interaction) {
  try {
    await interaction.deferReply({ ephemeral: true });

    const prize = interaction.options.getString('prize');
    const winners = interaction.options.getInteger('winners');
    const duration = interaction.options.getString('duration');
    const channel = interaction.options.getChannel('channel');
    const description = interaction.options.getString('description');
    const requiredRole = interaction.options.getRole('required-role');

    // Validate permissions
    const permCheck = await giveawayManager.canUserCreateGiveaway(
      interaction.member,
      interaction.guild.id
    );

    if (!permCheck.allowed) {
      return interaction.editReply({
        embeds: [createConfirmationEmbed(
          'Permission Denied',
          `You cannot create giveaways. Reason: **${permCheck.reason}**`,
          'error'
        )]
      });
    }

    // Check rate limit
    const rateCheck = await giveawayManager.checkRateLimit(
      interaction.user.id,
      interaction.guild.id
    );

    if (!rateCheck.allowed) {
      return interaction.editReply({
        embeds: [createConfirmationEmbed(
          'Rate Limit Exceeded',
          `${rateCheck.reason} (Current: ${rateCheck.current}, Max: ${rateCheck.max})`,
          'error'
        )]
      });
    }

    // Check channel restrictions
    const targetChannel = channel || interaction.channel;
    const channelCheck = await giveawayManager.canUseChannel(
      interaction.guild.id,
      targetChannel.id
    );

    if (!channelCheck.allowed) {
      return interaction.editReply({
        embeds: [createConfirmationEmbed(
          'Channel Not Allowed',
          `Giveaways are not allowed in ${targetChannel}. Please use an allowed channel.`,
          'error'
        )]
      });
    }

    // Validate input
    const validation = validateGiveawayCreation({
      prize,
      winners,
      duration,
      description
    });

    if (!validation.valid) {
      return interaction.editReply({
        embeds: [createConfirmationEmbed(
          'Invalid Input',
          validation.errors.join('\n'),
          'error'
        )]
      });
    }

    const durationMs = parseDuration(duration);

    // Check bot permissions
    const botPermissions = targetChannel.permissionsFor(interaction.client.user);
    
    if (!botPermissions.has(PermissionsBitField.Flags.SendMessages)) {
      return interaction.editReply({
        embeds: [createConfirmationEmbed(
          'Permission Error',
          'I don\'t have permission to send messages in that channel!',
          'error'
        )]
      });
    }

    if (!botPermissions.has(PermissionsBitField.Flags.EmbedLinks)) {
      return interaction.editReply({
        embeds: [createConfirmationEmbed(
          'Permission Error',
          'I need **Embed Links** permission to create giveaways!',
          'error'
        )]
      });
    }

    // Create giveaway in database
    const giveaway = await giveawayManager.create({
      guildId: interaction.guild.id,
      channelId: targetChannel.id,
      prize: sanitizeText(prize),
      winners,
      duration: durationMs,
      description: description ? sanitizeText(description) : '',
      host: interaction.user.id,
      hostUsername: interaction.user.tag,
      requiredRoles: requiredRole ? [requiredRole.id] : []
    });

    // Create and send giveaway message
    const totalEntries = await giveawayManager.getTotalEntries(giveaway._id.toString());
    const embed = createGiveawayEmbed(giveaway, totalEntries);
    const components = createActiveGiveawayActions();

    const message = await targetChannel.send({
      embeds: [embed],
      components: [components]
    });

    // Update giveaway with message ID
    await giveawayManager.updateMessageId(giveaway._id.toString(), message.id);

    // Update embed with message link
    const updatedEmbed = createGiveawayEmbed(giveaway, totalEntries);
    updatedEmbed.setFooter({
      text: `Hosted by ${interaction.user.tag} • Giveaway ID: ${giveaway._id.toString().slice(-6)}`
    });

    await message.edit({
      embeds: [updatedEmbed],
      components: [components]
    });

    logger.info(`🎉 Giveaway created by ${interaction.user.tag} in ${interaction.guild.name}`);

    return interaction.editReply({
      embeds: [createConfirmationEmbed(
        'Giveaway Created!',
        `Your giveaway for **${sanitizeText(prize)}** has been created!\n\n[View Giveaway](${message.url})`,
        'success'
      )]
    });

  } catch (error) {
    logger.error('❌ Error creating giveaway:', error);
    
    if (!interaction.replied && !interaction.deferred) {
      return interaction.reply({
        embeds: [createConfirmationEmbed(
          'Error',
          'Failed to create giveaway. Please try again.',
          'error'
        )],
        ephemeral: true
      });
    }

    return interaction.editReply({
      embeds: [createConfirmationEmbed(
        'Error',
        'Failed to create giveaway. Please try again.',
        'error'
      )]
    });
  }
}

/**
 * Handle /giveaway list command
 * @param {Object} interaction - Discord interaction
 */
export async function handleList(interaction) {
  try {
    await interaction.deferReply({ ephemeral: true });

    const giveaways = await giveawayManager.getActiveForGuild(interaction.guild.id);
    const embed = createGiveawayListEmbed(giveaways);

    return interaction.editReply({
      embeds: [embed],
      ephemeral: true
    });

  } catch (error) {
    logger.error('❌ Error listing giveaways:', error);
    
    return interaction.editReply({
      embeds: [createConfirmationEmbed(
        'Error',
        'Failed to list giveaways. Please try again.',
        'error'
      )],
      ephemeral: true
    });
  }
}

/**
 * Handle /giveaway stats command
 * @param {Object} interaction - Discord interaction
 */
export async function handleStats(interaction) {
  try {
    await interaction.deferReply({ ephemeral: true });

    const stats = await giveawayManager.getStats(interaction.guild.id);
    const embed = createStatsEmbed(stats);

    return interaction.editReply({
      embeds: [embed],
      ephemeral: true
    });

  } catch (error) {
    logger.error('❌ Error getting giveaway stats:', error);
    
    return interaction.editReply({
      embeds: [createConfirmationEmbed(
        'Error',
        'Failed to get statistics. Please try again.',
        'error'
      )],
      ephemeral: true
    });
  }
}

/**
 * Handle /giveaway end command
 * @param {Object} interaction - Discord interaction
 */
export async function handleEnd(interaction) {
  try {
    await interaction.deferReply({ ephemeral: true });

    const giveawayId = interaction.options.getString('giveaway-id');

    if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
      return interaction.editReply({
        embeds: [createConfirmationEmbed(
          'Permission Denied',
          'You need **Manage Server** permission to end giveaways.',
          'error'
        )]
      });
    }

    const giveaway = await giveawayManager.getById(giveawayId);

    if (!giveaway) {
      return interaction.editReply({
        embeds: [createConfirmationEmbed(
          'Not Found',
          'Giveaway not found. Please check the ID.',
          'error'
        )]
      });
    }

    if (giveaway.guildId !== interaction.guild.id) {
      return interaction.editReply({
        embeds: [createConfirmationEmbed(
          'Invalid Giveaway',
          'This giveaway is not from this server.',
          'error'
        )]
      });
    }

    const result = await giveawayManager.endGiveaway(giveawayId);

    if (!result.success) {
      return interaction.editReply({
        embeds: [createConfirmationEmbed(
          'Error',
          result.error || 'Failed to end giveaway.',
          'error'
        )]
      });
    }

    logger.info(`🏁 Giveaway ended by ${interaction.user.tag}: ${giveawayId}`);

    return interaction.editReply({
      embeds: [createConfirmationEmbed(
        'Giveaway Ended',
        `Giveaway ended successfully! ${result.winners.length} winner(s) selected.`,
        'success'
      )]
    });

  } catch (error) {
    logger.error('❌ Error ending giveaway:', error);
    
    return interaction.editReply({
      embeds: [createConfirmationEmbed(
        'Error',
        'Failed to end giveaway. Please try again.',
        'error'
      )],
      ephemeral: true
    });
  }
}

/**
 * Handle /giveaway reroll command
 * @param {Object} interaction - Discord interaction
 */
export async function handleReroll(interaction) {
  try {
    await interaction.deferReply({ ephemeral: true });

    const giveawayId = interaction.options.getString('giveaway-id');
    const winners = interaction.options.getInteger('winners');

    if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
      return interaction.editReply({
        embeds: [createConfirmationEmbed(
          'Permission Denied',
          'You need **Manage Server** permission to reroll giveaways.',
          'error'
        )]
      });
    }

    const giveaway = await giveawayManager.getById(giveawayId);

    if (!giveaway) {
      return interaction.editReply({
        embeds: [createConfirmationEmbed(
          'Not Found',
          'Giveaway not found. Please check the ID.',
          'error'
        )]
      });
    }

    if (giveaway.guildId !== interaction.guild.id) {
      return interaction.editReply({
        embeds: [createConfirmationEmbed(
          'Invalid Giveaway',
          'This giveaway is not from this server.',
          'error'
        )]
      });
    }

    const result = await giveawayManager.rerollGiveaway(giveawayId, winners);

    if (!result.success) {
      return interaction.editReply({
        embeds: [createConfirmationEmbed(
          'Error',
          result.error || 'Failed to reroll giveaway.',
          'error'
        )]
      });
    }

    logger.info(`🔄 Giveaway rerolled by ${interaction.user.tag}: ${giveawayId}`);

    return interaction.editReply({
      embeds: [createConfirmationEmbed(
        'Giveaway Rerolled',
        `New winner(s) selected successfully!`,
        'success'
      )]
    });

  } catch (error) {
    logger.error('❌ Error rerolling giveaway:', error);
    
    return interaction.editReply({
      embeds: [createConfirmationEmbed(
        'Error',
        'Failed to reroll giveaway. Please try again.',
        'error'
      )],
      ephemeral: true
    });
  }
}

/**
 * Handle /giveaway cancel command
 * @param {Object} interaction - Discord interaction
 */
export async function handleCancel(interaction) {
  try {
    await interaction.deferReply({ ephemeral: true });

    const giveawayId = interaction.options.getString('giveaway-id');

    if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
      return interaction.editReply({
        embeds: [createConfirmationEmbed(
          'Permission Denied',
          'You need **Manage Server** permission to cancel giveaways.',
          'error'
        )]
      });
    }

    const giveaway = await giveawayManager.getById(giveawayId);

    if (!giveaway) {
      return interaction.editReply({
        embeds: [createConfirmationEmbed(
          'Not Found',
          'Giveaway not found. Please check the ID.',
          'error'
        )]
      });
    }

    if (giveaway.guildId !== interaction.guild.id) {
      return interaction.editReply({
        embeds: [createConfirmationEmbed(
          'Invalid Giveaway',
          'This giveaway is not from this server.',
          'error'
        )]
      });
    }

    const result = await giveawayManager.cancelGiveaway(giveawayId);

    if (!result.success) {
      return interaction.editReply({
        embeds: [createConfirmationEmbed(
          'Error',
          result.error || 'Failed to cancel giveaway.',
          'error'
        )]
      });
    }

    logger.info(`🚫 Giveaway cancelled by ${interaction.user.tag}: ${giveawayId}`);

    return interaction.editReply({
      embeds: [createConfirmationEmbed(
        'Giveaway Cancelled',
        'Giveaway has been cancelled. No winners will be selected.',
        'warning'
      )]
    });

  } catch (error) {
    logger.error('❌ Error cancelling giveaway:', error);
    
    return interaction.editReply({
      embeds: [createConfirmationEmbed(
        'Error',
        'Failed to cancel giveaway. Please try again.',
        'error'
      )],
      ephemeral: true
    });
  }
}

/**
 * Handle /giveaway info command
 * @param {Object} interaction - Discord interaction
 */
export async function handleInfo(interaction) {
  try {
    await interaction.deferReply({ ephemeral: true });

    const giveawayId = interaction.options.getString('giveaway-id');

    const giveaway = await giveawayManager.getById(giveawayId);

    if (!giveaway) {
      return interaction.editReply({
        embeds: [createConfirmationEmbed(
          'Not Found',
          'Giveaway not found. Please check the ID.',
          'error'
        )]
      });
    }

    if (giveaway.guildId !== interaction.guild.id) {
      return interaction.editReply({
        embeds: [createConfirmationEmbed(
          'Invalid Giveaway',
          'This giveaway is not from this server.',
          'error'
        )]
      });
    }

    const totalEntries = giveaway.entries.reduce((sum, e) => sum + e.count, 0);
    const statusLabel = getStatusLabel(giveaway.status);

    const embed = new EmbedBuilder()
      .setTitle('📊 Giveaway Information')
      .setColor(giveaway.color || 0xFFD700)
      .addFields(
        {
          name: '🎁 Prize',
          value: giveaway.prize,
          inline: true
        },
        {
          name: '🏆 Winners',
          value: `${giveaway.winners}`,
          inline: true
        },
        {
          name: '📊 Status',
          value: statusLabel,
          inline: true
        },
        {
          name: '📈 Total Entries',
          value: `${totalEntries.toLocaleString()}`,
          inline: true
        },
        {
          name: '👤 Host',
          value: giveaway.host ? `<@${giveaway.host}>` : 'Unknown',
          inline: true
        },
        {
          name: '⏰ Duration',
          value: formatDuration(giveaway.duration),
          inline: true
        }
      );

    if (giveaway.status === 'active') {
      embed.addFields({
        name: '⏰ Ends',
        value: `<t:${Math.floor(giveaway.endTime.getTime() / 1000)}:R>`,
        inline: false
      });
    }

    if (giveaway.winnersData?.length > 0) {
      const winnerMentions = giveaway.winnersData.map(w => `<@${w.userId}>`).join('\n');
      embed.addFields({
        name: '🏆 Winners',
        value: winnerMentions || 'None',
        inline: false
      });
    }

    embed.setFooter({
      text: `Giveaway ID: ${giveaway._id.toString()}`
    });

    return interaction.editReply({
      embeds: [embed],
      ephemeral: true
    });

  } catch (error) {
    logger.error('❌ Error getting giveaway info:', error);
    
    return interaction.editReply({
      embeds: [createConfirmationEmbed(
        'Error',
        'Failed to get giveaway information. Please try again.',
        'error'
      )],
      ephemeral: true
    });
  }
}

/**
 * Handle /giveaway edit command
 * @param {Object} interaction - Discord interaction
 */
export async function handleEdit(interaction) {
  try {
    await interaction.deferReply({ ephemeral: true });

    const giveawayId = interaction.options.getString('giveaway-id');
    const prize = interaction.options.getString('prize');
    const winners = interaction.options.getInteger('winners');
    const description = interaction.options.getString('description');

    if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
      return interaction.editReply({
        embeds: [createConfirmationEmbed(
          'Permission Denied',
          'You need **Manage Server** permission to edit giveaways.',
          'error'
        )]
      });
    }

    const giveaway = await giveawayManager.getById(giveawayId);

    if (!giveaway) {
      return interaction.editReply({
        embeds: [createConfirmationEmbed(
          'Not Found',
          'Giveaway not found. Please check the ID.',
          'error'
        )]
      });
    }

    if (giveaway.guildId !== interaction.guild.id) {
      return interaction.editReply({
        embeds: [createConfirmationEmbed(
          'Invalid Giveaway',
          'This giveaway is not from this server.',
          'error'
        )]
      });
    }

    if (giveaway.status !== 'active') {
      return interaction.editReply({
        embeds: [createConfirmationEmbed(
          'Invalid Status',
          'Only active giveaways can be edited.',
          'error'
        )]
      });
    }

    const updates = {};
    if (prize) updates.prize = sanitizeText(prize);
    if (winners) updates.winners = winners;
    if (description !== undefined) updates.description = sanitizeText(description);

    await giveawayManager.edit(giveawayId, updates);

    logger.info(`✏️ Giveaway edited by ${interaction.user.tag}: ${giveawayId}`);

    return interaction.editReply({
      embeds: [createConfirmationEmbed(
        'Giveaway Edited',
        'Giveaway has been updated successfully!',
        'success'
      )]
    });

  } catch (error) {
    logger.error('❌ Error editing giveaway:', error);
    
    return interaction.editReply({
      embeds: [createConfirmationEmbed(
        'Error',
        error.message || 'Failed to edit giveaway. Please try again.',
        'error'
      )],
      ephemeral: true
    });
  }
}

/**
 * Handle /giveaway set-creator-role command
 * @param {Object} interaction - Discord interaction
 */
export async function handleSetCreatorRole(interaction) {
  try {
    await interaction.deferReply({ ephemeral: true });

    const role = interaction.options.getRole('role');

    if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
      return interaction.editReply({
        embeds: [createConfirmationEmbed(
          'Permission Denied',
          'You need **Manage Server** permission to manage creator roles.',
          'error'
        )]
      });
    }

    await giveawayManager.addCreatorRole(interaction.guild.id, role.id);

    logger.info(`➕ Creator role added by ${interaction.user.tag}: ${role.name}`);

    return interaction.editReply({
      embeds: [createConfirmationEmbed(
        'Creator Role Added',
        `Users with **${role.name}** can now create giveaways!`,
        'success'
      )]
    });

  } catch (error) {
    logger.error('❌ Error adding creator role:', error);
    
    return interaction.editReply({
      embeds: [createConfirmationEmbed(
        'Error',
        'Failed to add creator role. Please try again.',
        'error'
      )],
      ephemeral: true
    });
  }
}

/**
 * Handle /giveaway remove-creator-role command
 * @param {Object} interaction - Discord interaction
 */
export async function handleRemoveCreatorRole(interaction) {
  try {
    await interaction.deferReply({ ephemeral: true });

    const role = interaction.options.getRole('role');

    if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
      return interaction.editReply({
        embeds: [createConfirmationEmbed(
          'Permission Denied',
          'You need **Manage Server** permission to manage creator roles.',
          'error'
        )]
      });
    }

    await giveawayManager.removeCreatorRole(interaction.guild.id, role.id);

    logger.info(`➖ Creator role removed by ${interaction.user.tag}: ${role.name}`);

    return interaction.editReply({
      embeds: [createConfirmationEmbed(
        'Creator Role Removed',
        `Users with **${role.name}** can no longer create giveaways.`,
        'success'
      )]
    });

  } catch (error) {
    logger.error('❌ Error removing creator role:', error);
    
    return interaction.editReply({
      embeds: [createConfirmationEmbed(
        'Error',
        'Failed to remove creator role. Please try again.',
        'error'
      )],
      ephemeral: true
    });
  }
}

/**
 * Handle /giveaway creator-roles command
 * @param {Object} interaction - Discord interaction
 */
export async function handleCreatorRoles(interaction) {
  try {
    await interaction.deferReply({ ephemeral: true });

    const settings = await giveawayManager.getGuildSettings(interaction.guild.id);

    const embed = new EmbedBuilder()
      .setTitle('🎯 Giveaway Creator Roles')
      .setColor(0xFFD700)
      .setDescription(
        settings.creatorRoles?.length > 0
          ? 'Users with these roles can create giveaways:'
          : 'No custom creator roles set. Only users with **Manage Server** or **Manage Roles** can create giveaways.'
      );

    if (settings.creatorRoles?.length > 0) {
      const roleMentions = [];
      for (const roleId of settings.creatorRoles) {
        const role = interaction.guild.roles.cache.get(roleId);
        if (role) {
          roleMentions.push(`• ${role.toString()}`);
        } else {
          roleMentions.push(`• <@&${roleId}> (Deleted)`);
        }
      }
      embed.addFields({
        name: 'Roles',
        value: roleMentions.join('\n'),
        inline: false
      });
    }

    embed.setFooter({
      text: 'Use /giveaway set-creator-role to add roles'
    });

    return interaction.editReply({
      embeds: [embed],
      ephemeral: true
    });

  } catch (error) {
    logger.error('❌ Error getting creator roles:', error);
    
    return interaction.editReply({
      embeds: [createConfirmationEmbed(
        'Error',
        'Failed to get creator roles. Please try again.',
        'error'
      )],
      ephemeral: true
    });
  }
}

/**
 * Handle /giveaway set-allowed-channel command
 * @param {Object} interaction - Discord interaction
 */
export async function handleSetAllowedChannel(interaction) {
  try {
    await interaction.deferReply({ ephemeral: true });

    const channel = interaction.options.getChannel('channel');

    if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
      return interaction.editReply({
        embeds: [createConfirmationEmbed(
          'Permission Denied',
          'You need **Manage Server** permission to manage allowed channels.',
          'error'
        )]
      });
    }

    await giveawayManager.addAllowedChannel(interaction.guild.id, channel.id);

    logger.info(`➕ Allowed channel added by ${interaction.user.tag}: ${channel.name}`);

    return interaction.editReply({
      embeds: [createConfirmationEmbed(
        'Channel Allowed',
        `Giveaways can now be created in ${channel}!`,
        'success'
      )]
    });

  } catch (error) {
    logger.error('❌ Error adding allowed channel:', error);
    
    return interaction.editReply({
      embeds: [createConfirmationEmbed(
        'Error',
        'Failed to add allowed channel. Please try again.',
        'error'
      )],
      ephemeral: true
    });
  }
}

/**
 * Handle /giveaway remove-allowed-channel command
 * @param {Object} interaction - Discord interaction
 */
export async function handleRemoveAllowedChannel(interaction) {
  try {
    await interaction.deferReply({ ephemeral: true });

    const channel = interaction.options.getChannel('channel');

    if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
      return interaction.editReply({
        embeds: [createConfirmationEmbed(
          'Permission Denied',
          'You need **Manage Server** permission to manage allowed channels.',
          'error'
        )]
      });
    }

    await giveawayManager.removeAllowedChannel(interaction.guild.id, channel.id);

    logger.info(`➖ Allowed channel removed by ${interaction.user.tag}: ${channel.name}`);

    return interaction.editReply({
      embeds: [createConfirmationEmbed(
        'Channel Removed',
        `Giveaways can no longer be created in ${channel}.`,
        'success'
      )]
    });

  } catch (error) {
    logger.error('❌ Error removing allowed channel:', error);
    
    return interaction.editReply({
      embeds: [createConfirmationEmbed(
        'Error',
        'Failed to remove allowed channel. Please try again.',
        'error'
      )],
      ephemeral: true
    });
  }
}

/**
 * Handle /giveaway settings command
 * @param {Object} interaction - Discord interaction
 */
export async function handleSettings(interaction) {
  try {
    await interaction.deferReply({ ephemeral: true });

    const settings = await giveawayManager.getGuildSettings(interaction.guild.id);

    const embed = new EmbedBuilder()
      .setTitle('⚙️ Giveaway Settings')
      .setColor(0xFFD700)
      .addFields(
        {
          name: '🎯 Creator Roles',
          value: settings.creatorRoles?.length || 0,
          inline: true
        },
        {
          name: '📝 Allowed Channels',
          value: settings.allowedChannels?.length || 0,
          inline: true
        },
        {
          name: '⏰ Claim Period',
          value: `${settings.claimPeriod} hours`,
          inline: true
        },
        {
          name: '🔒 Min Account Age',
          value: settings.requireAccountAge > 0 ? `${settings.requireAccountAge} days` : 'None',
          inline: true
        },
        {
          name: '🏠 Min Server Age',
          value: settings.requireServerAge > 0 ? `${settings.requireServerAge} days` : 'None',
          inline: true
        },
        {
          name: '🤖 Exclude Bots',
          value: settings.excludeBots ? 'Yes' : 'No',
          inline: true
        },
        {
          name: '📊 Max Active Per User',
          value: `${settings.maxActivePerUser || 3}`,
          inline: true
        },
        {
          name: '📜 Log Channel',
          value: settings.logChannel ? `<#${settings.logChannel}>` : 'Not set',
          inline: true
        }
      )
      .setFooter({
        text: 'Use /giveaway set-claim-period to change claim time'
      });

    return interaction.editReply({
      embeds: [embed],
      ephemeral: true
    });

  } catch (error) {
    logger.error('❌ Error getting settings:', error);
    
    return interaction.editReply({
      embeds: [createConfirmationEmbed(
        'Error',
        'Failed to get settings. Please try again.',
        'error'
      )],
      ephemeral: true
    });
  }
}

/**
 * Handle /giveaway set-claim-period command
 * @param {Object} interaction - Discord interaction
 */
export async function handleSetClaimPeriod(interaction) {
  try {
    await interaction.deferReply({ ephemeral: true });

    const hours = interaction.options.getInteger('hours');

    if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
      return interaction.editReply({
        embeds: [createConfirmationEmbed(
          'Permission Denied',
          'You need **Manage Server** permission to manage settings.',
          'error'
        )]
      });
    }

    if (hours < 1 || hours > 168) { // 1 hour to 7 days
      return interaction.editReply({
        embeds: [createConfirmationEmbed(
          'Invalid Value',
          'Claim period must be between 1 and 168 hours (7 days).',
          'error'
        )]
      });
    }

    await giveawayManager.updateGuildSettings(interaction.guild.id, {
      claimPeriod: hours
    });

    logger.info(`⏰ Claim period set by ${interaction.user.tag}: ${hours} hours`);

    return interaction.editReply({
      embeds: [createConfirmationEmbed(
        'Claim Period Updated',
        `Winners now have **${hours} hours** to claim their prizes.`,
        'success'
      )]
    });

  } catch (error) {
    logger.error('❌ Error setting claim period:', error);
    
    return interaction.editReply({
      embeds: [createConfirmationEmbed(
        'Error',
        'Failed to set claim period. Please try again.',
        'error'
      )],
      ephemeral: true
    });
  }
}

// Helper function
function getStatusLabel(status) {
  const labels = {
    active: '🟢 Active',
    ended: '🔴 Ended',
    completed: '✅ Completed',
    cancelled: '🚫 Cancelled'
  };
  return labels[status] || '❓ Unknown';
}
