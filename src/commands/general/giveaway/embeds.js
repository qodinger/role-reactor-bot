/**
 * Giveaway Embeds - Create and format giveaway embeds
 * @module commands/general/giveaway/embeds
 */

import { EmbedBuilder } from 'discord.js';

/**
 * Create a giveaway embed
 * @param {Object} giveaway - Giveaway data
 * @param {number} totalEntries - Total entry count
 * @returns {EmbedBuilder}
 */
export function createGiveawayEmbed(giveaway, totalEntries = 0) {
  const embed = new EmbedBuilder()
    .setTitle('🎉 GIVEAWAY! 🎉')
    .setDescription(giveaway.description || 'Click the button below to enter!')
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
        name: '📊 Entries',
        value: `${totalEntries.toLocaleString()}`,
        inline: true
      }
    )
    .addFields(
      {
        name: '⏰ Ends',
        value: `<t:${Math.floor(giveaway.endTime.getTime() / 1000)}:R>`,
        inline: false
      }
    )
    .setFooter({
      text: `Hosted by ${giveaway.hostUsername || 'Server Staff'} • Giveaway ID: ${giveaway._id.toString().slice(-6)}`
    })
    .setTimestamp(giveaway.startTime);

  if (giveaway.thumbnail) {
    embed.setThumbnail(giveaway.thumbnail);
  }

  // Add requirements if any
  const requirements = [];
  
  if (giveaway.requirements?.roles?.length > 0) {
    requirements.push('• Specific roles required');
  }
  
  if (giveaway.requirements?.minAccountAge > 0) {
    const days = giveaway.requirements.minAccountAge / (1000 * 60 * 60 * 24);
    requirements.push(`• Account age: ${days}+ days`);
  }
  
  if (giveaway.requirements?.minServerAge > 0) {
    const days = giveaway.requirements.minServerAge / (1000 * 60 * 60 * 24);
    requirements.push(`• Server member: ${days}+ days`);
  }

  if (requirements.length > 0) {
    embed.addFields({
      name: '📋 Requirements',
      value: requirements.join('\n'),
      inline: false
    });
  }

  return embed;
}

/**
 * Create a giveaway winner announcement embed
 * @param {Object} giveaway - Giveaway data
 * @param {Array} winners - Array of winner objects with userId
 * @param {Object} client - Discord client for user lookup
 * @returns {Promise<EmbedBuilder>}
 */
export async function createWinnerEmbed(giveaway, winners, client) {
  const winnerMentions = [];
  
  for (const winner of winners) {
    try {
      const user = await client.users.fetch(winner.userId);
      winnerMentions.push(`<@${winner.userId}> (${user.tag})`);
    } catch {
      winnerMentions.push(`<@${winner.userId}> (Unknown)`);
    }
  }

  const embed = new EmbedBuilder()
    .setTitle('🏆 GIVEAWAY WINNER! 🏆')
    .setColor(0x00FF00)
    .addFields(
      {
        name: '🎁 Prize',
        value: giveaway.prize,
        inline: true
      },
      {
        name: '🎉 Winners',
        value: winnerMentions.join('\n'),
        inline: false
      },
      {
        name: '📊 Total Entries',
        value: `${giveaway.entries.reduce((sum, e) => sum + e.count, 0).toLocaleString()}`,
        inline: true
      },
      {
        name: '👤 Host',
        value: giveaway.host ? `<@${giveaway.host}>` : 'Server Staff',
        inline: true
      }
    )
    .setFooter({
      text: giveaway.winnersData?.[0]?.claimed 
        ? 'Prize claimed ✓' 
        : 'Winners have 48 hours to claim their prize'
    })
    .setTimestamp();

  if (giveaway.thumbnail) {
    embed.setThumbnail(giveaway.thumbnail);
  }

  return embed;
}

/**
 * Create a giveaway ended embed (no winners)
 * @param {Object} giveaway - Giveaway data
 * @returns {EmbedBuilder}
 */
export function createNoEntriesEmbed(giveaway) {
  const embed = new EmbedBuilder()
    .setTitle('😔 GIVEAWAY ENDED')
    .setDescription('No one entered this giveaway.')
    .setColor(0xFF0000)
    .addFields(
      {
        name: '🎁 Prize',
        value: giveaway.prize,
        inline: true
      },
      {
        name: '👤 Host',
        value: giveaway.host ? `<@${giveaway.host}>` : 'Server Staff',
        inline: true
      }
    )
    .setFooter({
      text: 'Better luck next time!'
    })
    .setTimestamp();

  return embed;
}

/**
 * Create a giveaway list embed
 * @param {Array} giveaways - Array of active giveaways
 * @returns {EmbedBuilder}
 */
export function createGiveawayListEmbed(giveaways) {
  const embed = new EmbedBuilder()
    .setTitle('🎉 Active Giveaways')
    .setColor(0xFFD700)
    .setDescription(giveaways.length === 0 
      ? 'There are no active giveaways right now.'
      : 'Click on a giveaway to enter!'
    );

  if (giveaways.length > 0) {
    const fields = [];
    
    for (let i = 0; i < Math.min(giveaways.length, 10); i++) {
      const gw = giveaways[i];
      const totalEntries = gw.entries.reduce((sum, e) => sum + e.count, 0);
      
      fields.push({
        name: `${i + 1}. ${gw.prize}`,
        value: `🏆 ${gw.winners} winner(s) • 📊 ${totalEntries} entries\n⏰ Ends <t:${Math.floor(gw.endTime.getTime() / 1000)}:R>`,
        inline: false
      });
    }
    
    embed.addFields(fields);
  }

  embed.setFooter({
    text: `Total: ${giveaways.length} active giveaway(s)`
  });

  return embed;
}

/**
 * Create a giveaway stats embed
 * @param {Object} stats - Giveaway statistics
 * @returns {EmbedBuilder}
 */
export function createStatsEmbed(stats) {
  const embed = new EmbedBuilder()
    .setTitle('📊 Giveaway Statistics')
    .setColor(0xFFD700)
    .addFields(
      {
        name: '📈 Total Giveaways',
        value: `${stats.total || 0}`,
        inline: true
      },
      {
        name: '🎉 Active',
        value: `${stats.active || 0}`,
        inline: true
      },
      {
        name: '✅ Completed',
        value: `${stats.completed || 0}`,
        inline: true
      },
      {
        name: '🏁 Ended',
        value: `${stats.ended || 0}`,
        inline: true
      },
      {
        name: '🚫 Cancelled',
        value: `${stats.cancelled || 0}`,
        inline: true
      },
      {
        name: '📊 Total Entries',
        value: `${(stats.totalEntries || 0).toLocaleString()}`,
        inline: true
      }
    )
    .setFooter({
      text: 'Giveaway Statistics'
    })
    .setTimestamp();

  return embed;
}

/**
 * Create a confirmation embed for giveaway actions
 * @param {string} title - Embed title
 * @param {string} description - Embed description
 * @param {string} type - Type: 'success', 'error', 'warning', 'info'
 * @returns {EmbedBuilder}
 */
export function createConfirmationEmbed(title, description, type = 'info') {
  const colors = {
    success: 0x00FF00,
    error: 0xFF0000,
    warning: 0xFFA500,
    info: 0x3498DB
  };

  const icons = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️'
  };

  const embed = new EmbedBuilder()
    .setTitle(`${icons[type]} ${title}`)
    .setDescription(description)
    .setColor(colors[type])
    .setTimestamp();

  return embed;
}

/**
 * Create an entry confirmation embed (ephemeral)
 * @param {Object} giveaway - Giveaway data
 * @param {number} userEntries - User's entry count
 * @param {number} totalEntries - Total entry count
 * @returns {EmbedBuilder}
 */
export function createEntryConfirmEmbed(giveaway, userEntries, totalEntries) {
  const embed = new EmbedBuilder()
    .setTitle('✅ Successfully Entered!')
    .setDescription(`You've entered the giveaway for **${giveaway.prize}**.`)
    .setColor(0x00FF00)
    .addFields(
      {
        name: '🎫 Your Entries',
        value: `${userEntries}`,
        inline: true
      },
      {
        name: '📊 Total Entries',
        value: `${totalEntries.toLocaleString()}`,
        inline: true
      },
      {
        name: '⏰ Ends',
        value: `<t:${Math.floor(giveaway.endTime.getTime() / 1000)}:R>`,
        inline: false
      }
    )
    .setFooter({
      text: 'Good luck! 🍀'
    })
    .setTimestamp();

  return embed;
}

/**
 * Create a winner DM embed
 * @param {Object} giveaway - Giveaway data
 * @param {string} guildName - Guild name
 * @returns {EmbedBuilder}
 */
export function createWinnerDmEmbed(giveaway, guildName) {
  const embed = new EmbedBuilder()
    .setTitle('🎉 Congratulations! You Won! 🎉')
    .setColor(0xFFD700)
    .setDescription(
      `You won the **${giveaway.prize}** giveaway in **${guildName}**!`
    )
    .addFields(
      {
        name: '📋 Next Steps',
        value: 'Contact the giveaway host to claim your prize!',
        inline: false
      },
      {
        name: '⏰ Claim Period',
        value: 'You have 48 hours to claim your prize.',
        inline: false
      }
    )
    .setFooter({
      text: 'Congratulations again!'
    })
    .setTimestamp();

  return embed;
}
