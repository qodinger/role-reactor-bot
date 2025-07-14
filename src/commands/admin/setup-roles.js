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
} from "../../utils/permissions.js";
import { setRoleMapping, parseRoleString } from "../../utils/roleManager.js";
import {
  titleOption,
  descriptionOption,
  rolesOption,
  colorOption,
} from "../../utils/roleMessageOptions.js";
import { THEME_COLOR } from "../../config/theme.js";
import {
  sanitizeInput,
  isValidHexColor,
  validateCommandInputs,
  createValidationErrorEmbed,
} from "../../utils/validation.js";
import { getLogger } from "../../utils/logger.js";

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
      logger.warn("Permission denied for setup-roles command", {
        userId: interaction.user.id,
        guildId: interaction.guild.id,
      });

      return interaction.editReply({
        content:
          "❌ **Permission Denied**\nYou need administrator permissions to use this command.",
        flags: 64,
      });
    }

    // Validate bot permissions
    if (!botHasRequiredPermissions(interaction.guild)) {
      const missingPermissions = getMissingBotPermissions(interaction.guild);
      const permissionNames = missingPermissions
        .map(formatPermissionName)
        .join(", ");

      logger.warn("Bot missing permissions for setup-roles command", {
        guildId: interaction.guild.id,
        missingPermissions,
      });

      return interaction.editReply({
        content: `❌ **Missing Bot Permissions**\nI need the following permissions: **${permissionNames}**\n\nPlease ensure I have the required permissions and try again.`,
        flags: 64,
      });
    }

    // Sanitize and validate inputs
    const title = sanitizeInput(interaction.options.getString("title"));
    const description = sanitizeInput(
      interaction.options.getString("description"),
    );
    const rolesString = sanitizeInput(interaction.options.getString("roles"));
    const colorHex = sanitizeInput(interaction.options.getString("color"));

    // Validate all inputs
    const validation = validateCommandInputs({
      title,
      description,
      roles: rolesString,
      color: colorHex,
    });

    if (!validation.isValid) {
      logger.warn("Validation failed for setup-roles command", {
        userId: interaction.user.id,
        errors: validation.errors,
      });

      const errorEmbed = createValidationErrorEmbed(
        "Input Validation",
        validation.errors.join("\n"),
      );

      return interaction.editReply({
        embeds: [errorEmbed],
        flags: 64,
      });
    }

    // Process color
    let color = THEME_COLOR;
    if (colorHex) {
      const hex = colorHex.startsWith("#") ? colorHex : `#${colorHex}`;
      if (!isValidHexColor(hex)) {
        logger.warn("Invalid color format provided", {
          userId: interaction.user.id,
          color: colorHex,
        });

        return interaction.editReply({
          content:
            "❌ **Invalid Color Format**\nPlease provide a valid hex color code (e.g., #0099ff or 0099ff)",
          flags: 64,
        });
      }
      color = hex;
    }

    // Parse role string
    const { roles, errors: parseErrors } = parseRoleString(rolesString);
    const roleMapping = {};
    const validPairs = [];
    const errors = [...parseErrors];
    const botMember = await interaction.guild.members.fetchMe();

    // Build a map of role names to roles for fast lookup
    const roleNameMap = new Map(
      interaction.guild.roles.cache.map(role => [
        role.name.toLowerCase(),
        role,
      ]),
    );

    for (const roleConfig of roles) {
      const role = roleNameMap.get(roleConfig.roleName.toLowerCase());
      if (!role) {
        errors.push(`❌ Role "${roleConfig.roleName}" not found`);
        continue;
      }
      if (role.position >= botMember.roles.highest.position) {
        errors.push(
          `❌ Cannot manage role "${roleConfig.roleName}" - it's higher than my highest role`,
        );
        continue;
      }
      roleMapping[roleConfig.emoji] = roleConfig;
      validPairs.push({
        emoji: roleConfig.emoji,
        role: roleConfig.roleName,
        limit: roleConfig.limit,
      });
    }

    if (errors.length > 0) {
      logger.warn("Role setup errors", {
        userId: interaction.user.id,
        guildId: interaction.guild.id,
        errors,
      });

      return interaction.editReply({
        content: `❌ **Setup Errors**\n\n${errors.join("\n")}`,
        flags: 64,
      });
    }

    if (validPairs.length === 0) {
      logger.warn("No valid roles found for setup", {
        userId: interaction.user.id,
        guildId: interaction.guild.id,
      });

      return interaction.editReply({
        content: "❌ **No Valid Roles**\nNo valid roles were found to set up.",
        flags: 64,
      });
    }

    // Create embed
    const embed = new EmbedBuilder()
      .setTitle(title)
      .setDescription(description)
      .setColor(color)
      .setTimestamp()
      .setFooter({
        text: "Role Reactor • Self-Assignable Roles",
        iconURL: client.user.displayAvatarURL(),
      });

    const roleList = validPairs
      .map(pair => {
        const limitText = pair.limit ? ` (${pair.limit} users max)` : "";
        return `${pair.emoji} **${pair.role}**${limitText}`;
      })
      .join("\n");

    embed.addFields({
      name: "🎭 Available Roles",
      value: roleList,
      inline: false,
    });

    // Send the message without buttons
    const message = await interaction.channel.send({
      embeds: [embed],
    });

    // Add reactions for each role in parallel (limit 3 at a time)
    const limit = pLimit(3);
    const reactionErrors = [];

    await Promise.all(
      validPairs.map(pair =>
        limit(async () => {
          try {
            await message.react(pair.emoji);
          } catch (error) {
            reactionErrors.push(
              `Failed to add reaction ${pair.emoji}: ${error.message}`,
            );
            logger.error("Failed to add reaction", {
              emoji: pair.emoji,
              messageId: message.id,
              error: error.message,
            });
          }
        }),
      ),
    );

    // Save role mapping to database
    const dbSuccess = await setRoleMapping(message.id, {
      guildId: interaction.guild.id,
      channelId: interaction.channel.id,
      roles: roleMapping,
    });

    if (!dbSuccess) {
      logger.error("Failed to save role mapping to database", {
        messageId: message.id,
        guildId: interaction.guild.id,
      });
    }

    // Prepare response
    let replyContent = `✅ **Role-Reaction Message Created!**\n\n**Message:** ${message.url}\n**Roles:** ${validPairs.length} role(s) set up\n\nUsers can now react with the emojis to assign/remove roles.`;

    if (reactionErrors.length > 0) {
      replyContent += `\n\n⚠️ Some reactions failed to add:\n${reactionErrors.join("\n")}`;
    }

    if (!dbSuccess) {
      replyContent += `\n\n⚠️ **Warning:** Role mapping may not be saved properly.`;
    }

    await interaction.editReply({
      content: replyContent,
      flags: 64,
    });

    // Log successful command execution
    const duration = Date.now() - startTime;
    logger.logCommand("setup-roles", interaction.user.id, duration, true);

    logger.info("Role-reaction message created successfully", {
      userId: interaction.user.id,
      guildId: interaction.guild.id,
      messageId: message.id,
      roleCount: validPairs.length,
      duration: `${duration}ms`,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error("Error setting up roles", error);
    logger.logCommand("setup-roles", interaction.user.id, duration, false);

    await interaction.editReply({
      content:
        "❌ **Error**\nAn error occurred while setting up the role-reaction message. Please try again.",
      flags: 64,
    });
  }
}
