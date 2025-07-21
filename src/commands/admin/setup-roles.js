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
  validationErrorEmbed,
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
        permissionErrorEmbed({ requiredPermissions: ["Administrator"] }),
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
          description: `I need the following permissions: **${permissionNames}**`,
          solution:
            "Please ensure I have the required permissions and try again.",
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
        createValidationErrorEmbed({ errors: validation.errors }),
      );
    }

    // Process color
    let color = THEME_COLOR;
    if (colorHex) {
      if (!colorHex.startsWith("#")) {
        colorHex = `#${colorHex}`;
      }
      if (!/^#[0-9a-f]{6}$/i.test(colorHex)) {
        return interaction.editReply(
          validationErrorEmbed({
            errors: ["Invalid hex color code provided."],
            helpText:
              "Please provide a valid hex color code (e.g., #0099ff or 0099ff)",
          }),
        );
      }
      color = colorHex;
    }

    // Process and validate roles using the new utility function
    const roleProcessingResult = await processRoles(interaction, rolesString);

    if (!roleProcessingResult.success) {
      const helpText = `**Accepted formats:**\n- emoji role_name\n- emoji:role_name\n- emoji "role name"\n- emoji <@&role_id>\n(And combinations with limits like \`:10\`)`;
      return interaction.editReply(
        createValidationErrorEmbed({
          errors: roleProcessingResult.errors,
          helpText,
        }),
      );
    }

    const { validRoles, roleMapping } = roleProcessingResult;

    if (validRoles.length === 0) {
      return interaction.editReply(
        errorEmbed({
          title: "No Valid Roles",
          description: "No valid roles were found to set up.",
          solution:
            "Check if the roles exist and if the bot has permission to manage them.",
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
        text: "Role Reactor • Self-Assignable Roles",
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

    // Send the message without buttons
    const message = await interaction.channel.send({
      embeds: [embed],
    });

    // Add reactions for each role in parallel (limit 3 at a time)
    const limit = pLimit(3);

    await Promise.all(
      validRoles.map(role =>
        limit(async () => {
          try {
            await message.react(role.emoji);
          } catch (error) {
            logger.error("Failed to add reaction", {
              emoji: role.emoji,
              messageId: message.id,
              error: error.message,
            });
          }
        }),
      ),
    );

    // Save role mapping to storage
    await setRoleMapping(
      message.id,
      interaction.guild.id,
      interaction.channel.id,
      roleMapping,
    );

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

    await interaction.editReply(
      errorEmbed({
        title: "Error",
        description:
          "An error occurred while setting up the role-reaction message. Please try again.",
      }),
    );
  }
}
