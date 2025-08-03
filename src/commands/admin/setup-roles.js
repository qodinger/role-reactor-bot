import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} from "discord.js";
import pLimit from "p-limit";
import {
  hasAdminPermissions,
  botHasRequiredPermissions,
  getMissingBotPermissions,
  formatPermissionName,
} from "../../utils/discord/permissions.js";
import { setRoleMapping } from "../../utils/discord/roleMappingManager.js";
import { processRoles } from "../../utils/discord/roleManager.js";
import {
  titleOption,
  descriptionOption,
  rolesOption,
  colorOption,
} from "../../utils/discord/slashCommandOptions.js";
import { THEME_COLOR } from "../../config/theme.js";
import { sanitizeInput } from "../../utils/discord/inputUtils.js";
import {
  validateCommandInputs,
  createValidationErrorEmbed,
} from "../../utils/discord/commandValidation.js";
import { getLogger } from "../../utils/logger.js";
import {
  roleCreatedEmbed,
  permissionErrorEmbed,
  errorEmbed,
} from "../../utils/discord/responseMessages.js";

export const data = new SlashCommandBuilder()
  .setName("setup-roles")
  .setDescription("Create a role-reaction message for self-assignable roles")
  .addStringOption(titleOption().setRequired(true))
  .addStringOption(descriptionOption().setRequired(true))
  .addStringOption(rolesOption(true))
  .addStringOption(colorOption())
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles);

export async function execute(interaction, client) {
  const logger = getLogger();
  const startTime = Date.now();

  await interaction.deferReply({ flags: 64 });

  try {
    // Validate user permissions
    if (!hasAdminPermissions(interaction.member)) {
      return interaction.editReply(
        permissionErrorEmbed({
          requiredPermissions: ["Administrator"],
          userPermissions: interaction.member.permissions.toArray(),
          tip: "You need Administrator permissions to create role-reaction messages.",
        }),
      );
    }

    // Validate bot permissions
    if (!botHasRequiredPermissions(interaction.guild)) {
      const missingPermissions = getMissingBotPermissions(interaction.guild);
      const permissionNames = missingPermissions
        .map(formatPermissionName)
        .join(", ");

      return interaction.editReply(
        errorEmbed({
          title: "Missing Bot Permissions",
          description: `I need the following permissions to create role-reaction messages: **${permissionNames}**`,
          solution:
            "Please ask a server administrator to grant me these permissions and try again.",
          fields: [
            {
              name: "🔧 How to Fix",
              value:
                "Go to Server Settings → Roles → Find my role → Enable the missing permissions",
              inline: false,
            },
            {
              name: "📋 Required Permissions",
              value:
                "• Manage Messages (to create the role message)\n• Add Reactions (to add role reactions)\n• Manage Roles (to assign roles to members)",
              inline: false,
            },
          ],
        }),
      );
    }

    // Sanitize and validate inputs
    const title = sanitizeInput(interaction.options.getString("title"));
    const description = sanitizeInput(
      interaction.options.getString("description"),
    );
    const rolesString = sanitizeInput(interaction.options.getString("roles"));
    let colorHex = sanitizeInput(interaction.options.getString("color"));

    // Validate all inputs
    const validation = validateCommandInputs({
      title,
      description,
      roles: rolesString,
      color: colorHex,
    });

    if (!validation.isValid) {
      return interaction.editReply(
        createValidationErrorEmbed({
          errors: validation.errors,
          helpText:
            "💡 **Tip**: Use the format `emoji:role,emoji:role` for roles. Example: `🎮:Gamer,🎨:Artist,💻:Developer`",
        }),
      );
    }

    // Process color
    let color = THEME_COLOR;
    if (colorHex) {
      if (!colorHex.startsWith("#")) {
        colorHex = `#${colorHex}`;
      }
      color = colorHex;
    }

    // Process roles
    const roleProcessingResult = await processRoles(interaction, rolesString);

    if (!roleProcessingResult.success) {
      return interaction.editReply(
        errorEmbed({
          title: "Role Processing Error",
          description: roleProcessingResult.errors.join("\n"),
          solution: "Please check your role format and try again.",
          fields: [
            {
              name: "📝 Correct Format",
              value:
                "`emoji:role` or `emoji:role:limit`\nExample: `🎮:Gamer` or `🎮:Gamer:10`",
              inline: false,
            },
            {
              name: "🔍 Common Issues",
              value:
                "• Make sure roles exist in your server\n• Use valid emojis (🎮, 🎨, etc.)\n• Separate roles with commas\n• Don't use spaces around the colon\n• Use `@Role` to mention roles",
              inline: false,
            },
            {
              name: "💡 Examples",
              value:
                "• `💻:Developer` - Basic role\n• `💻:@Developer` - With mention\n• `💻:Developer:10` - With user limit\n• `🎮:Gamer,🎨:Artist` - Multiple roles",
              inline: false,
            },
          ],
        }),
      );
    }

    const { validRoles, roleMapping } = roleProcessingResult;

    if (validRoles.length === 0) {
      return interaction.editReply(
        errorEmbed({
          title: "No Valid Roles Found",
          description:
            "I couldn't find any valid roles to set up. This usually happens when roles don't exist or I don't have permission to manage them.",
          solution:
            "Please check that the roles exist and that I have permission to manage them.",
          fields: [
            {
              name: "🔍 Troubleshooting",
              value:
                "• Verify roles exist in Server Settings → Roles\n• Make sure my role is above the roles I need to manage\n• Check that I have 'Manage Roles' permission",
              inline: false,
            },
            {
              name: "📝 Example",
              value:
                "If you have roles named 'Gamer', 'Artist', 'Developer', use:\n`🎮:Gamer,🎨:Artist,💻:Developer`",
              inline: false,
            },
          ],
        }),
      );
    }

    // Create embed
    const embed = new EmbedBuilder()
      .setTitle(title)
      .setDescription(description)
      .setColor(color)
      .setTimestamp()
      .setFooter({
        text: "Role Reactor • Click reactions to get roles!",
        iconURL: client.user.displayAvatarURL(),
      });

    const roleList = validRoles
      .map(role => {
        const limitText = role.limit ? ` (${role.limit} users max)` : "";
        return `${role.emoji} <@&${role.roleId}>${limitText}`;
      })
      .join("\n");

    embed.addFields({
      name: "🎭 Available Roles",
      value: roleList,
      inline: false,
    });

    // Add helpful tip
    embed.addFields({
      name: "💡 How to Use",
      value:
        "Members can click the reactions below to get or remove roles instantly!",
      inline: false,
    });

    // Send the message without buttons
    logger.debug("Creating role-reaction message...");
    const message = await interaction.channel.send({
      embeds: [embed],
    });
    logger.debug(`Message created with ID: ${message.id}`);

    // Add reactions for each role in parallel (limit 3 at a time)
    const limit = pLimit(3);
    logger.debug(`Adding ${validRoles.length} reactions to message...`);

    // Add timeout to prevent hanging
    const reactionTimeout = setTimeout(() => {
      logger.warn("Reaction adding is taking longer than expected");
    }, 10000); // 10 second timeout

    try {
      await Promise.all(
        validRoles.map(role =>
          limit(async () => {
            try {
              logger.debug(
                `Adding reaction: ${role.emoji} for role: ${role.name}`,
              );
              await message.react(role.emoji);
              logger.debug(`Successfully added reaction: ${role.emoji}`);
            } catch (error) {
              logger.error("Failed to add reaction", {
                emoji: role.emoji,
                messageId: message.id,
                error: error.message,
              });
              throw error; // Re-throw to be caught by the main try-catch
            }
          }),
        ),
      );
    } finally {
      clearTimeout(reactionTimeout);
    }

    // Save role mapping to storage
    logger.debug("Saving role mapping to storage...");
    await setRoleMapping(
      message.id,
      interaction.guild.id,
      interaction.channel.id,
      roleMapping,
    );
    logger.debug("Role mapping saved successfully");

    // Prepare response
    await interaction.editReply(
      roleCreatedEmbed({
        messageUrl: message.url,
        roleCount: validRoles.length,
        channelId: interaction.channel.id,
      }),
    );

    // Log successful command execution
    const duration = Date.now() - startTime;
    logger.logCommand("setup-roles", interaction.user.id, duration, true);
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error("Error setting up roles", error);
    logger.logCommand("setup-roles", interaction.user.id, duration, false);

    // Determine the specific error type
    let errorTitle = "Setup Failed";
    let errorDescription =
      "Something went wrong while creating your role-reaction message.";
    let solution =
      "Please try again in a moment. If the problem persists, check that I have the necessary permissions.";
    let fields = [
      {
        name: "🔧 Quick Fix",
        value:
          "• Make sure I have 'Manage Messages' and 'Add Reactions' permissions\n• Check that the channel allows me to send messages\n• Verify your internet connection is stable",
        inline: false,
      },
    ];

    // Check for specific error types
    if (error.code === 50013) {
      errorTitle = "Missing Permissions";
      errorDescription =
        "I don't have the required permissions to create role-reaction messages.";
      solution =
        "Please ask a server administrator to grant me the necessary permissions.";
      fields = [
        {
          name: "📋 Required Permissions",
          value:
            "• Manage Messages (to create the role message)\n• Add Reactions (to add role reactions)\n• Manage Roles (to assign roles to members)",
          inline: false,
        },
        {
          name: "🔧 How to Fix",
          value:
            "Go to Server Settings → Roles → Find my role → Enable the missing permissions",
          inline: false,
        },
      ];
    } else if (error.code === 50001) {
      errorTitle = "Channel Access Denied";
      errorDescription = "I can't send messages in this channel.";
      solution =
        "Please check the channel permissions or try a different channel.";
      fields = [
        {
          name: "🔧 How to Fix",
          value:
            "• Check channel permissions\n• Make sure I can send messages here\n• Try using a different channel",
          inline: false,
        },
      ];
    } else if (error.code === 50005) {
      errorTitle = "Cannot Send Messages";
      errorDescription =
        "I don't have permission to send messages in this channel.";
      solution =
        "Please check the channel permissions or try a different channel.";
      fields = [
        {
          name: "🔧 How to Fix",
          value:
            "• Check channel permissions\n• Make sure I can send messages here\n• Try using a different channel",
          inline: false,
        },
      ];
    } else if (error.message && error.message.includes("reaction")) {
      errorTitle = "Reaction Error";
      errorDescription =
        "I couldn't add reactions to the message. This might be due to invalid emojis or permission issues.";
      solution =
        "Please check that the emojis are valid and that I have permission to add reactions.";
      fields = [
        {
          name: "🔧 How to Fix",
          value:
            "• Use valid Discord emojis (🎮, 🎨, etc.)\n• Make sure I have 'Add Reactions' permission\n• Check that the emojis aren't custom server emojis I can't access",
          inline: false,
        },
      ];
    } else if (error.message && error.message.includes("role")) {
      errorTitle = "Role Management Error";
      errorDescription =
        "I couldn't process the roles. This might be because the roles don't exist or I don't have permission to manage them.";
      solution =
        "Please check that the roles exist and that I have permission to manage them.";
      fields = [
        {
          name: "🔧 How to Fix",
          value:
            "• Verify roles exist in Server Settings → Roles\n• Make sure my role is above the roles I need to manage\n• Check that I have 'Manage Roles' permission",
          inline: false,
        },
      ];
    }

    await interaction.editReply(
      errorEmbed({
        title: errorTitle,
        description: errorDescription,
        solution,
        fields,
      }),
    );
  }
}
