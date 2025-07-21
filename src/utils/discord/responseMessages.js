// src/utils/responseMessages.js
import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import { THEME, EMOJIS } from "../../config/theme.js";

/**
 * Creates a beautiful embed for successful role-reaction message creation
 */
export function roleCreatedEmbed({ messageUrl, roleCount, channelId }) {
  const embed = new EmbedBuilder()
    .setColor(THEME.SUCCESS)
    .setTitle(`${EMOJIS.STATUS.SUCCESS} Role Setup Complete!`)
    .setDescription(
      `${EMOJIS.FEATURES.AUTOMATION} Your role-reaction message has been created successfully!\n\n` +
        `${EMOJIS.UI.STAR} Members can now self-assign roles by reacting to the message.`,
    )
    .addFields(
      {
        name: `${EMOJIS.UI.MENU} Message Location`,
        value: `${EMOJIS.ACTIONS.LINK} [Click here to view](${messageUrl})\n${EMOJIS.ACTIONS.VIEW} Channel: <#${channelId}>`,
        inline: false,
      },
      {
        name: `${EMOJIS.FEATURES.ROLES} Roles Configured`,
        value: `\`${roleCount}\` role${roleCount !== 1 ? "s" : ""} available for self-assignment`,
        inline: true,
      },
      {
        name: `${EMOJIS.TIME.CLOCK} Created`,
        value: `<t:${Math.floor(Date.now() / 1000)}:R>`,
        inline: true,
      },
    )
    .setThumbnail(
      "https://cdn.discordapp.com/attachments/1234567890/1234567890/success.png",
    )
    .setFooter({
      text: "💡 Tip: Members can click reactions to get roles instantly!",
      iconURL: null,
    })
    .setTimestamp();

  // Add helpful button for quick access
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel("View Message")
      .setStyle(ButtonStyle.Link)
      .setURL(messageUrl)
      .setEmoji(EMOJIS.ACTIONS.VIEW),
    new ButtonBuilder()
      .setCustomId("setup_help")
      .setLabel("Setup Guide")
      .setStyle(ButtonStyle.Secondary)
      .setEmoji(EMOJIS.ACTIONS.HELP),
  );

  return {
    embeds: [embed],
    components: [row],
    flags: 64,
  };
}

/**
 * Creates an enhanced embed for role-reaction message updates
 */
export function roleUpdatedEmbed({ messageId, updates, changeCount = 0 }) {
  const updatesList = updates.split(", ");
  const formattedUpdates = updatesList
    .map(update => {
      const icons = {
        title: EMOJIS.ACTIONS.EDIT,
        description: EMOJIS.UI.MENU,
        roles: EMOJIS.FEATURES.ROLES,
        color: EMOJIS.UI.SLIDER,
      };
      return `${icons[update] || EMOJIS.ACTIONS.EDIT} \`${update}\``;
    })
    .join("\n");

  const embed = new EmbedBuilder()
    .setColor(THEME.INFO)
    .setTitle(`${EMOJIS.ACTIONS.REFRESH} Configuration Updated Successfully!`)
    .setDescription(
      `${EMOJIS.STATUS.SUCCESS} Your role-reaction message has been updated with the latest changes.\n\n` +
        `**What changed:**\n${formattedUpdates}`,
    )
    .addFields(
      {
        name: `${EMOJIS.ACTIONS.LINK} Message Reference`,
        value: `ID: \`${messageId}\``,
        inline: true,
      },
      {
        name: `${EMOJIS.TIME.CLOCK} Updated`,
        value: `<t:${Math.floor(Date.now() / 1000)}:R>`,
        inline: true,
      },
    );

  if (changeCount > 0) {
    embed.addFields({
      name: `${EMOJIS.FEATURES.SYNC} Changes Applied`,
      value: `\`${changeCount}\` modification${changeCount !== 1 ? "s" : ""}`,
      inline: true,
    });
  }

  embed
    .setFooter({
      text: "✨ Changes are now live • Members can use the updated configuration",
      iconURL: null,
    })
    .setTimestamp();

  return {
    embeds: [embed],
    flags: 64,
  };
}

/**
 * Creates a clean embed for role-reaction message deletion
 */
export function roleDeletedEmbed({ messageId, rolesRemoved = 0 }) {
  const embed = new EmbedBuilder()
    .setColor(THEME.WARNING)
    .setTitle(`${EMOJIS.ACTIONS.DELETE} Role Configuration Removed`)
    .setDescription(
      `${EMOJIS.STATUS.WARNING} The role-reaction message has been successfully removed from the system.\n\n` +
        `${EMOJIS.UI.CROSS} Members can no longer self-assign roles from this message.`,
    )
    .addFields(
      {
        name: `${EMOJIS.ACTIONS.DELETE} Deleted Message`,
        value: `ID: \`${messageId}\``,
        inline: true,
      },
      {
        name: `${EMOJIS.TIME.CLOCK} Removed`,
        value: `<t:${Math.floor(Date.now() / 1000)}:R>`,
        inline: true,
      },
    );

  if (rolesRemoved > 0) {
    embed.addFields({
      name: `${EMOJIS.FEATURES.ROLES} Roles Affected`,
      value: `\`${rolesRemoved}\` role${rolesRemoved !== 1 ? "s" : ""} no longer self-assignable`,
      inline: false,
    });
  }

  embed
    .setFooter({
      text: "🔒 Configuration permanently removed • Create a new setup if needed",
      iconURL: null,
    })
    .setTimestamp();

  return {
    embeds: [embed],
    flags: 64,
  };
}

/**
 * Creates an error embed with helpful troubleshooting info
 */
export function errorEmbed({
  title,
  description,
  fields = [],
  solution = null,
}) {
  const embed = new EmbedBuilder()
    .setColor(THEME.ERROR)
    .setTitle(`${EMOJIS.STATUS.ERROR} ${title}`)
    .setDescription(description);

  if (fields.length > 0) {
    embed.addFields(fields);
  }

  if (solution) {
    embed.addFields({
      name: `${EMOJIS.UI.STAR} Suggested Solution`,
      value: solution,
      inline: false,
    });
  }

  embed
    .setFooter({
      text: "Need help? Contact support or check the documentation",
      iconURL: null,
    })
    .setTimestamp();

  return {
    embeds: [embed],
    flags: 64,
  };
}

/**
 * Creates a permission error embed
 */
export function permissionErrorEmbed({
  requiredPermissions,
  userPermissions = [],
}) {
  const missingPerms = requiredPermissions.filter(
    perm => !userPermissions.includes(perm),
  );

  return errorEmbed({
    title: "Insufficient Permissions",
    description:
      `${EMOJIS.FEATURES.SECURITY} You don't have the required permissions to use this command.\n\n` +
      `**Missing permissions:**\n${missingPerms.map(perm => `${EMOJIS.UI.CROSS} \`${perm}\``).join("\n")}`,
    solution:
      "Ask a server administrator to grant you the necessary permissions.",
  });
}

/**
 * Creates a loading/processing embed
 */
export function processingEmbed({ action, estimatedTime = null }) {
  const embed = new EmbedBuilder()
    .setColor(THEME.INFO)
    .setTitle(`${EMOJIS.STATUS.LOADING} Processing ${action}...`)
    .setDescription(
      `${EMOJIS.TIME.HOURGLASS} Please wait while I ${action.toLowerCase()}.\n\n` +
        `${EMOJIS.FEATURES.AUTOMATION} This may take a moment.`,
    );

  if (estimatedTime) {
    embed.addFields({
      name: `${EMOJIS.TIME.TIMER} Estimated Time`,
      value: estimatedTime,
      inline: true,
    });
  }

  embed.setFooter({
    text: "⚡ Working on it...",
    iconURL: null,
  });

  return {
    embeds: [embed],
    flags: 64,
  };
}

/**
 * Creates a validation error embed with detailed feedback
 */
export function validationErrorEmbed({ errors, helpText = null }) {
  const errorList = errors
    .map(
      (error, index) =>
        `${EMOJIS.NUMBERS[Object.keys(EMOJIS.NUMBERS)[index]] || EMOJIS.UI.CROSS} ${error}`,
    )
    .join("\n\n");

  const embed = new EmbedBuilder()
    .setColor(THEME.ERROR)
    .setTitle(`${EMOJIS.STATUS.WARNING} Validation Failed`)
    .setDescription(
      `${EMOJIS.UI.CROSS} Please fix the following issues:\n\n${errorList}`,
    );

  if (helpText) {
    embed.addFields({
      name: `${EMOJIS.ACTIONS.HELP} How to fix`,
      value: helpText,
      inline: false,
    });
  }

  embed
    .setFooter({
      text: "💡 Check the command syntax and try again",
      iconURL: null,
    })
    .setTimestamp();

  return {
    embeds: [embed],
    flags: 64,
  };
}

/**
 * Creates a success embed for role assignment
 */
export function roleAssignedEmbed({
  roleName,
  userName,
  isTemporary = false,
  duration = null,
}) {
  const embed = new EmbedBuilder()
    .setColor(THEME.SUCCESS)
    .setTitle(`${EMOJIS.STATUS.SUCCESS} Role Assigned!`)
    .setDescription(
      `${EMOJIS.FEATURES.ROLES} **${userName}** has been given the **${roleName}** role!\n\n` +
        `${isTemporary ? EMOJIS.FEATURES.TEMPORARY : EMOJIS.FEATURES.PERMANENT} This role is **${isTemporary ? "temporary" : "permanent"}**.`,
    );

  if (isTemporary && duration) {
    embed.addFields({
      name: `${EMOJIS.TIME.TIMER} Duration`,
      value: `Expires in \`${duration}\``,
      inline: true,
    });
  }

  embed
    .setFooter({
      text: "✨ Role successfully assigned",
      iconURL: null,
    })
    .setTimestamp();

  return {
    embeds: [embed],
    flags: 64,
  };
}

/**
 * Creates an info embed for displaying role statistics
 */
export function roleStatsEmbed({
  guildName,
  totalRoles,
  selfAssignable,
  mostUsed = [],
}) {
  const embed = new EmbedBuilder()
    .setColor(THEME.PRIMARY)
    .setTitle(`${EMOJIS.FEATURES.MONITORING} Role Statistics for ${guildName}`)
    .setDescription(
      `${EMOJIS.UI.MENU} Here's an overview of role usage in your server.`,
    )
    .addFields(
      {
        name: `${EMOJIS.FEATURES.ROLES} Total Roles`,
        value: `\`${totalRoles}\``,
        inline: true,
      },
      {
        name: `${EMOJIS.FEATURES.REACTIONS} Self-Assignable`,
        value: `\`${selfAssignable}\``,
        inline: true,
      },
      {
        name: `${EMOJIS.USAGE.HIGH} Activity`,
        value: `\`${Math.round((selfAssignable / totalRoles) * 100)}%\` usage rate`,
        inline: true,
      },
    );

  if (mostUsed.length > 0) {
    const topRoles = mostUsed
      .slice(0, 5)
      .map(
        (role, index) =>
          `${EMOJIS.NUMBERS[Object.keys(EMOJIS.NUMBERS)[index]]} **${role.name}** - \`${role.count}\` members`,
      )
      .join("\n");

    embed.addFields({
      name: `${EMOJIS.UI.STAR} Most Popular Roles`,
      value: topRoles,
      inline: false,
    });
  }

  embed
    .setFooter({
      text: "📊 Stats updated live • Refresh for latest data",
      iconURL: null,
    })
    .setTimestamp();

  return {
    embeds: [embed],
  };
}

/**
 * Creates a help embed with beautiful formatting
 */
export function helpEmbed({
  commandName,
  description,
  usage,
  examples = [],
  tips = [],
}) {
  const embed = new EmbedBuilder()
    .setColor(THEME.PRIMARY)
    .setTitle(`${EMOJIS.ACTIONS.HELP} Help: ${commandName}`)
    .setDescription(`${EMOJIS.UI.MENU} ${description}`)
    .addFields({
      name: `${EMOJIS.ACTIONS.QUICK} Usage`,
      value: `\`\`\`${usage}\`\`\``,
      inline: false,
    });

  if (examples.length > 0) {
    embed.addFields({
      name: `${EMOJIS.UI.MENU} Examples`,
      value: examples.map(ex => `\`${ex}\``).join("\n"),
      inline: false,
    });
  }

  if (tips.length > 0) {
    embed.addFields({
      name: `${EMOJIS.UI.STAR} Pro Tips`,
      value: tips.map(tip => `${EMOJIS.UI.CHECKMARK} ${tip}`).join("\n"),
      inline: false,
    });
  }

  embed
    .setFooter({
      text: "💡 Need more help? Check our documentation or ask in support",
      iconURL: null,
    })
    .setTimestamp();

  return {
    embeds: [embed],
  };
}
