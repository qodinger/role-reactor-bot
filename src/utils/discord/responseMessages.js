// src/utils/responseMessages.js
import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import { THEME, EMOJIS } from "../../config/theme.js";

/**
 * A factory for creating standardized embeds.
 */
class EmbedFactory {
  constructor(theme, emojis) {
    this.theme = theme;
    this.emojis = emojis;
  }

  /**
   * Creates a base embed with a specified type.
   * @param {('SUCCESS'|'ERROR'|'WARNING'|'INFO'|'PRIMARY')} type - The type of embed.
   * @param {object} options - The options for the embed.
   * @param {string} options.title - The title of the embed.
   * @param {string} options.description - The description of the embed.
   * @param {Array<object>} [options.fields=[]] - The fields to add to the embed.
   * @param {string} [options.footer=null] - The footer text.
   * @returns {EmbedBuilder}
   */
  create(type, { title, description, fields = [], footer = null }) {
    const embed = new EmbedBuilder().setTimestamp();
    const statusEmoji = this.emojis.STATUS[type] || "";

    switch (type) {
      case "SUCCESS":
        embed.setColor(this.theme.SUCCESS);
        break;
      case "ERROR":
        embed.setColor(this.theme.ERROR);
        break;
      case "WARNING":
        embed.setColor(this.theme.WARNING);
        break;
      case "INFO":
        embed.setColor(this.theme.INFO);
        break;
      default:
        embed.setColor(this.theme.PRIMARY);
        break;
    }

    embed.setTitle(`${statusEmoji} ${title}`.trim());
    embed.setDescription(description);

    if (fields.length > 0) {
      embed.addFields(fields);
    }

    if (footer) {
      embed.setFooter({ text: footer });
    }

    return embed;
  }
}

const embedFactory = new EmbedFactory(THEME, EMOJIS);

// --- Role Setup Responses ---

export function roleCreatedEmbed({ messageUrl, roleCount, channelId }) {
  const embed = embedFactory.create("SUCCESS", {
    title: "Role Setup Complete!",
    description:
      `${EMOJIS.FEATURES.AUTOMATION} Your role-reaction message has been created successfully!\n\n` +
      `${EMOJIS.UI.STAR} Members can now self-assign roles by reacting to the message.`,
    fields: [
      {
        name: `${EMOJIS.UI.MENU} Message Location`,
        value: `${EMOJIS.ACTIONS.LINK} [Click here to view](${messageUrl})\n${EMOJIS.ACTIONS.VIEW} Channel: <#${channelId}>`,
        inline: false,
      },
      {
        name: `${EMOJIS.FEATURES.ROLES} Roles Configured`,
        value: `\`${roleCount}\` role${
          roleCount !== 1 ? "s" : ""
        } available for self-assignment`,
        inline: true,
      },
      {
        name: `${EMOJIS.TIME.CLOCK} Created`,
        value: `<t:${Math.floor(Date.now() / 1000)}:R>`,
        inline: true,
      },
    ],
    footer: "💡 Tip: Members can click reactions to get roles instantly!",
  });

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

  const fields = [
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
  ];

  if (changeCount > 0) {
    fields.push({
      name: `${EMOJIS.FEATURES.SYNC} Changes Applied`,
      value: `\`${changeCount}\` modification${changeCount !== 1 ? "s" : ""}`,
      inline: true,
    });
  }

  const embed = embedFactory.create("INFO", {
    title: "Configuration Updated Successfully!",
    description:
      `${EMOJIS.STATUS.SUCCESS} Your role-reaction message has been updated with the latest changes.\n\n` +
      `**What changed:**\n${formattedUpdates}`,
    fields,
    footer:
      "✨ Changes are now live • Members can use the updated configuration",
  });

  return {
    embeds: [embed],
    flags: 64,
  };
}

export function roleDeletedEmbed({ messageId, rolesRemoved = 0 }) {
  const fields = [
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
  ];

  if (rolesRemoved > 0) {
    fields.push({
      name: `${EMOJIS.FEATURES.ROLES} Roles Affected`,
      value: `\`${rolesRemoved}\` role${
        rolesRemoved !== 1 ? "s" : ""
      } no longer self-assignable`,
      inline: false,
    });
  }

  const embed = embedFactory.create("WARNING", {
    title: "Role Configuration Removed",
    description:
      `${EMOJIS.STATUS.WARNING} The role-reaction message has been successfully removed from the system.\n\n` +
      `${EMOJIS.UI.CROSS} Members can no longer self-assign roles from this message.`,
    fields,
    footer:
      "🔒 Configuration permanently removed • Create a new setup if needed",
  });

  return {
    embeds: [embed],
    flags: 64,
  };
}

// --- Error and Status Responses ---

export function errorEmbed({
  title,
  description,
  fields = [],
  solution = null,
}) {
  const allFields = [...fields];
  if (solution) {
    allFields.push({
      name: `${EMOJIS.UI.STAR} Suggested Solution`,
      value: solution,
      inline: false,
    });
  }

  const embed = embedFactory.create("ERROR", {
    title,
    description,
    fields: allFields,
    footer: "Need help? Contact support or check the documentation",
  });

  return {
    embeds: [embed],
    flags: 64,
  };
}

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
      `**Missing permissions:**\n${missingPerms
        .map(perm => `${EMOJIS.UI.CROSS} \`${perm}\``)
        .join("\n")}`,
    solution:
      "Ask a server administrator to grant you the necessary permissions.",
  });
}

export function processingEmbed({ action, estimatedTime = null }) {
  const fields = estimatedTime
    ? [
        {
          name: `${EMOJIS.TIME.TIMER} Estimated Time`,
          value: estimatedTime,
          inline: true,
        },
      ]
    : [];

  const embed = embedFactory.create("INFO", {
    title: `Processing ${action}...`,
    description:
      `${EMOJIS.TIME.HOURGLASS} Please wait while I ${action.toLowerCase()}.\n\n` +
      `${EMOJIS.FEATURES.AUTOMATION} This may take a moment.`,
    fields,
    footer: "⚡ Working on it...",
  });

  return {
    embeds: [embed],
    flags: 64,
  };
}

export function validationErrorEmbed({ errors, helpText = null }) {
  const errorList = errors
    .map(
      (error, index) =>
        `${
          EMOJIS.NUMBERS[Object.keys(EMOJIS.NUMBERS)[index]] || EMOJIS.UI.CROSS
        } ${error}`,
    )
    .join("\n\n");

  const fields = helpText
    ? [
        {
          name: `${EMOJIS.ACTIONS.HELP} How to fix`,
          value: helpText,
          inline: false,
        },
      ]
    : [];

  const embed = embedFactory.create("ERROR", {
    title: "Validation Failed",
    description: `${EMOJIS.UI.CROSS} Please fix the following issues:\n\n${errorList}`,
    fields,
    footer: "💡 Check the command syntax and try again",
  });

  return {
    embeds: [embed],
    flags: 64,
  };
}

// --- General Responses ---

export function roleAssignedEmbed({
  roleName,
  userName,
  isTemporary = false,
  duration = null,
}) {
  const fields =
    isTemporary && duration
      ? [
          {
            name: `${EMOJIS.TIME.TIMER} Duration`,
            value: `Expires in \`${duration}\``,
            inline: true,
          },
        ]
      : [];

  const embed = embedFactory.create("SUCCESS", {
    title: "Role Assigned!",
    description:
      `${EMOJIS.FEATURES.ROLES} **${userName}** has been given the **${roleName}** role!\n\n` +
      `${
        isTemporary ? EMOJIS.FEATURES.TEMPORARY : EMOJIS.FEATURES.PERMANENT
      } This role is **${isTemporary ? "temporary" : "permanent"}**.`,
    fields,
    footer: "✨ Role successfully assigned",
  });

  return {
    embeds: [embed],
    flags: 64,
  };
}

export function roleStatsEmbed({
  guildName,
  totalRoles,
  selfAssignable,
  mostUsed = [],
}) {
  const fields = [
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
      value: `\`${Math.round(
        (selfAssignable / totalRoles) * 100,
      )}%\` usage rate`,
      inline: true,
    },
  ];

  if (mostUsed.length > 0) {
    const topRoles = mostUsed
      .slice(0, 5)
      .map(
        (role, index) =>
          `${
            EMOJIS.NUMBERS[Object.keys(EMOJIS.NUMBERS)[index]]
          } **${role.name}** - \`${role.count}\` members`,
      )
      .join("\n");

    fields.push({
      name: `${EMOJIS.UI.STAR} Most Popular Roles`,
      value: topRoles,
      inline: false,
    });
  }

  const embed = embedFactory.create("PRIMARY", {
    title: `Role Statistics for ${guildName}`,
    description: `${EMOJIS.UI.MENU} Here's an overview of role usage in your server.`,
    fields,
    footer: "📊 Stats updated live • Refresh for latest data",
  });

  return {
    embeds: [embed],
  };
}

export function helpEmbed({
  commandName,
  description,
  usage,
  examples = [],
  tips = [],
}) {
  const fields = [
    {
      name: `${EMOJIS.ACTIONS.QUICK} Usage`,
      value: `\`\`\`${usage}\`\`\``,
      inline: false,
    },
  ];

  if (examples.length > 0) {
    fields.push({
      name: `${EMOJIS.UI.MENU} Examples`,
      value: examples.map(ex => `\`${ex}\``).join("\n"),
      inline: false,
    });
  }

  if (tips.length > 0) {
    fields.push({
      name: `${EMOJIS.UI.STAR} Pro Tips`,
      value: tips.map(tip => `${EMOJIS.UI.CHECKMARK} ${tip}`).join("\n"),
      inline: false,
    });
  }

  const embed = embedFactory.create("PRIMARY", {
    title: `Help: ${commandName}`,
    description: `${EMOJIS.UI.MENU} ${description}`,
    fields,
    footer: "💡 Need more help? Check our documentation or ask in support",
  });

  return {
    embeds: [embed],
  };
}
