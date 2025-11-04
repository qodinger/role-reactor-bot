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
    // Discord requires description if title is present - always set it
    const safeDescription =
      description &&
      typeof description === "string" &&
      description.trim().length > 0
        ? description.trim()
        : "An error occurred. Please try again.";
    embed.setDescription(safeDescription);

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
    title: "Role Setup Complete", // Simplified title
    description: `Your role-reaction message has been created successfully.`,
    fields: [
      {
        name: "Message Location", // Removed emoji
        value: `[Click here to view](${messageUrl})\nChannel: <#${channelId}>`,
        inline: false,
      },
      {
        name: "Roles Configured", // Removed emoji
        value: `${roleCount} role${roleCount !== 1 ? "s" : ""} available for self-assignment`,
        inline: true,
      },
      {
        name: "Created", // Removed emoji
        value: `<t:${Math.floor(Date.now() / 1000)}:R>`,
        inline: true,
      },
    ],
    footer: "Role Reactor • Role Reactions", // Updated footer to match other commands
  });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel("View Message")
      .setStyle(ButtonStyle.Link)
      .setURL(messageUrl),
  );

  return {
    embeds: [embed],
    components: [row],
    flags: 64,
  };
}

export function roleUpdatedEmbed({ messageId, updates, changeCount = 0 }) {
  const updatesList = updates.split(", ");
  const formattedUpdates = updatesList.map(update => `• ${update}`).join("\n");

  const fields = [
    {
      name: "Message Reference", // Removed emoji
      value: `ID: \`${messageId}\``,
      inline: true,
    },
    {
      name: "Updated", // Removed emoji
      value: `<t:${Math.floor(Date.now() / 1000)}:R>`,
      inline: true,
    },
  ];

  if (changeCount > 0) {
    fields.push({
      name: "Changes Applied", // Removed emoji
      value: `${changeCount} modification${changeCount !== 1 ? "s" : ""}`,
      inline: true,
    });
  }

  const embed = embedFactory.create("INFO", {
    title: "Configuration Updated", // Simplified title
    description: `Your role-reaction message has been updated with the latest changes.`,
    fields: [
      ...fields,
      {
        name: "What Changed", // Removed emoji
        value: formattedUpdates,
        inline: false,
      },
    ],
    footer: "Role Reactor • Role Reactions", // Updated footer to match other commands
  });

  return {
    embeds: [embed],
    flags: 64,
  };
}

export function roleDeletedEmbed({ messageId, rolesRemoved = 0 }) {
  const fields = [
    {
      name: "Deleted Message", // Removed emoji
      value: `ID: \`${messageId}\``,
      inline: true,
    },
    {
      name: "Removed", // Removed emoji
      value: `<t:${Math.floor(Date.now() / 1000)}:R>`,
      inline: true,
    },
  ];

  if (rolesRemoved > 0) {
    fields.push({
      name: "Roles Affected", // Removed emoji
      value: `${rolesRemoved} role${rolesRemoved !== 1 ? "s" : ""} no longer self-assignable`,
      inline: false,
    });
  }

  const embed = embedFactory.create("SUCCESS", {
    // Changed from WARNING to SUCCESS
    title: "Role Configuration Removed", // Simplified title
    description: `The role-reaction message has been successfully removed from the system.`,
    fields,
    footer: "Role Reactor • Role Reactions", // Updated footer to match other commands
  });

  return {
    embeds: [embed],
    flags: 64,
  };
}

// --- Error and Status Responses ---

export function errorEmbed({
  title,
  description = "An error occurred. Please try again.",
  fields = [],
  solution = null,
}) {
  const allFields = [...fields];
  if (solution) {
    allFields.push({
      name: "Suggested Solution", // Removed emoji
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

export function infoEmbed({
  title,
  description = "Information",
  fields = [],
  solution = null,
}) {
  const allFields = [...fields];
  if (solution) {
    allFields.push({
      name: "Suggested Solution", // Removed emoji
      value: solution,
      inline: false,
    });
  }

  const embed = embedFactory.create("INFO", {
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
    description: `You don't have the required permissions to use this command.`,
    fields: [
      {
        name: "Missing Permissions",
        value: missingPerms.map(perm => `• \`${perm}\``).join("\n"),
        inline: false,
      },
    ],
    solution:
      "Ask a server administrator to grant you the necessary permissions.",
  });
}

export function processingEmbed({ action, estimatedTime = null }) {
  const fields = estimatedTime
    ? [
        {
          name: "Estimated Time",
          value: estimatedTime,
          inline: true,
        },
      ]
    : [];

  const embed = embedFactory.create("INFO", {
    title: `Processing ${action}`,
    description: `Please wait while I ${action.toLowerCase()}.`,
    fields,
    footer: "Role Reactor • Processing",
  });

  return {
    embeds: [embed],
    flags: 64,
  };
}

export function validationErrorEmbed({ errors, helpText = null }) {
  const errorList = errors
    .map((error, index) => `${index + 1}. ${error}`)
    .join("\n");

  const fields = helpText
    ? [
        {
          name: "How to Fix",
          value: helpText,
          inline: false,
        },
      ]
    : [];

  const embed = embedFactory.create("ERROR", {
    title: "Validation Failed",
    description: `Please fix the following issues:`,
    fields: [
      {
        name: "Issues Found",
        value: errorList,
        inline: false,
      },
      ...fields,
    ],
    footer: "Role Reactor • Validation",
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
            name: "Duration",
            value: `Expires in \`${duration}\``,
            inline: true,
          },
        ]
      : [];

  const embed = embedFactory.create("SUCCESS", {
    title: "Role Assigned",
    description:
      `**${userName}** has been assigned the **${roleName}** role.\n\n` +
      `Assignment Type: **${isTemporary ? "Temporary" : "Permanent"}**`,
    fields,
    footer: "Role Reactor • Role Reactions", // Updated footer to match other commands
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
      name: "Total Roles",
      value: `${totalRoles}`,
      inline: true,
    },
    {
      name: "Self-Assignable",
      value: `${selfAssignable}`,
      inline: true,
    },
    {
      name: "Activity",
      value: `${Math.round((selfAssignable / totalRoles) * 100)}% usage rate`,
      inline: true,
    },
  ];

  if (mostUsed.length > 0) {
    const topRoles = mostUsed
      .slice(0, 5)
      .map(
        (role, index) =>
          `${index + 1}. **${role.name}** - ${role.count} members`,
      )
      .join("\n");

    fields.push({
      name: "Most Popular Roles",
      value: topRoles,
      inline: false,
    });
  }

  const embed = embedFactory.create("PRIMARY", {
    title: `Role Statistics for ${guildName}`,
    description: `Here's an overview of role usage in your server.`,
    fields,
    footer: "Role Reactor • Statistics",
  });

  return {
    embeds: [embed],
  };
}

export function successEmbed({
  title,
  description,
  solution = null,
  fields = [],
}) {
  const embedFields = [...fields];

  if (solution) {
    embedFields.push({
      name: "What's Next?",
      value: solution,
      inline: false,
    });
  }

  const embed = embedFactory.create("SUCCESS", {
    title,
    description,
    fields: embedFields,
    footer: "Role Reactor • Success",
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
      name: "Usage",
      value: `\`\`\`${usage}\`\`\``,
      inline: false,
    },
  ];

  if (examples.length > 0) {
    fields.push({
      name: "Examples",
      value: examples.map(ex => `\`${ex}\``).join("\n"),
      inline: false,
    });
  }

  if (tips.length > 0) {
    fields.push({
      name: "Pro Tips",
      value: tips.map(tip => `• ${tip}`).join("\n"),
      inline: false,
    });
  }

  const embed = embedFactory.create("PRIMARY", {
    title: `Help: ${commandName}`,
    description,
    fields,
    footer: "Role Reactor • Help",
  });

  return {
    embeds: [embed],
  };
}
