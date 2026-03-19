/**
 * Role Bundle Command Handlers
 * @module commands/admin/role-bundle/handlers
 */

import { EmbedBuilder, PermissionsBitField } from "discord.js";
import roleBundleManager from "../../../features/rolebundles/RoleBundleManager.js";

import { getMentionableCommand } from "../../../utils/commandUtils.js";
import { getLogger } from "../../../utils/logger.js";

const logger = getLogger();

/**
 * Handle /role-bundle create command
 * @param {Object} interaction - Discord interaction
 */
export async function handleCreate(interaction) {
  try {
    await interaction.deferReply({ ephemeral: true });

    const name = interaction.options.getString("name");
    const rolesString = interaction.options.getString("roles");

    // Check permissions
    if (
      !interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuild)
    ) {
      return interaction.editReply({
        embeds: [
          createErrorEmbed(
            "Permission Denied",
            "You need **Manage Server** permission to create role bundles.",
          ),
        ],
      });
    }

    // Validate bundle name
    const validation = roleBundleManager.validateName(name);
    if (!validation.valid) {
      return interaction.editReply({
        embeds: [createErrorEmbed("Invalid Name", validation.error)],
      });
    }

    // Check if bundle already exists
    const exists = await roleBundleManager.exists(interaction.guild.id, name);
    if (exists) {
      return interaction.editReply({
        embeds: [
          createErrorEmbed(
            "Bundle Exists",
            `A bundle named **${name}** already exists. Please use a different name or delete the existing bundle first.`,
          ),
        ],
      });
    }

    // Parse roles from string
    const roles = parseRoles(rolesString, interaction.guild);

    if (roles.length === 0) {
      return interaction.editReply({
        embeds: [
          createErrorEmbed(
            "No Valid Roles",
            "No valid roles were found. Please mention roles using @RoleName format.",
          ),
        ],
      });
    }

    // Create bundle
    await roleBundleManager.create({
      _id: undefined, // Let MongoDB generate
      guildId: interaction.guild.id,
      name: name.trim(),
      roles: roles,
    });

    logger.info(`📦 Role bundle created by ${interaction.user.tag}: ${name}`);

    return interaction.editReply({
      embeds: [
        createSuccessEmbed(
          "Bundle Created!",
          `Role bundle **${name}** has been created with **${roles.length}** role(s):\n\n${roles.map(r => `• ${r.roleName}`).join("\n")}`,
        ),
      ],
    });
  } catch (error) {
    logger.error("❌ Error creating role bundle:", error);

    return interaction.editReply({
      embeds: [
        createErrorEmbed(
          "Error",
          "Failed to create role bundle. Please try again.",
        ),
      ],
    });
  }
}

/**
 * Handle /role-bundle delete command
 * @param {Object} interaction - Discord interaction
 */
export async function handleDelete(interaction) {
  try {
    await interaction.deferReply({ ephemeral: true });

    const name = interaction.options.getString("name");

    // Check permissions
    if (
      !interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuild)
    ) {
      return interaction.editReply({
        embeds: [
          createErrorEmbed(
            "Permission Denied",
            "You need **Manage Server** permission to delete role bundles.",
          ),
        ],
      });
    }

    // Check if bundle exists
    const exists = await roleBundleManager.exists(interaction.guild.id, name);
    if (!exists) {
      return interaction.editReply({
        embeds: [
          createErrorEmbed("Not Found", `Bundle **${name}** not found.`),
        ],
      });
    }

    // Delete bundle
    const result = await roleBundleManager.deleteByName(
      interaction.guild.id,
      name,
    );

    if (!result.success) {
      return interaction.editReply({
        embeds: [
          createErrorEmbed("Error", result.error || "Failed to delete bundle."),
        ],
      });
    }

    logger.info(`🗑️ Role bundle deleted by ${interaction.user.tag}: ${name}`);

    return interaction.editReply({
      embeds: [
        createSuccessEmbed(
          "Bundle Deleted!",
          `Role bundle **${name}** has been deleted.`,
        ),
      ],
    });
  } catch (error) {
    logger.error("❌ Error deleting role bundle:", error);

    return interaction.editReply({
      embeds: [
        createErrorEmbed(
          "Error",
          "Failed to delete role bundle. Please try again.",
        ),
      ],
    });
  }
}

/**
 * Handle /role-bundle list command
 * @param {Object} interaction - Discord interaction
 */
export async function handleList(interaction) {
  try {
    await interaction.deferReply({ ephemeral: true });

    const bundles = await roleBundleManager.getAllForGuild(
      interaction.guild.id,
    );

    if (bundles.length === 0) {
      return interaction.editReply({
        embeds: [
          createInfoEmbed(
            "No Bundles",
            `There are no role bundles in this server yet.\n\nUse ${getMentionableCommand(interaction.client, "role-bundle create")} to create one!`,
          ),
        ],
      });
    }

    const embed = new EmbedBuilder()
      .setTitle("📦 Role Bundles")
      .setColor(0x5865f2)
      .setDescription(
        `There are **${bundles.length}** role bundle(s) in this server.`,
      );

    bundles.forEach((bundle, index) => {
      const roleCount = bundle.roles?.length || 0;
      embed.addFields({
        name: `${index + 1}. ${bundle.name}`,
        value: `${roleCount} role(s) • Created <t:${Math.floor(bundle.createdAt.getTime() / 1000)}:R>`,
        inline: true,
      });
    });

    embed.setFooter({
      text: "Use /role-bundle view name:<bundle> to see all roles in a bundle",
    });

    return interaction.editReply({
      embeds: [embed],
    });
  } catch (error) {
    logger.error("❌ Error listing role bundles:", error);

    return interaction.editReply({
      embeds: [
        createErrorEmbed(
          "Error",
          "Failed to list role bundles. Please try again.",
        ),
      ],
    });
  }
}

/**
 * Parse roles from string
 * @param {string} rolesString - Roles string
 * @param {Object} guild - Discord guild
 * @returns {Array} Array of { roleId, roleName }
 */
function parseRoles(rolesString, guild) {
  const roles = [];

  // Match role mentions: <@&123456789> or @RoleName
  const mentionRegex = /<@&(\d+)>|@(&?)([\w\s\-_]+)/g;
  let match;

  while ((match = mentionRegex.exec(rolesString)) !== null) {
    if (match[1]) {
      // Role mention with ID: <@&123456789>
      const role = guild.roles.cache.get(match[1]);
      if (role) {
        roles.push({ roleId: role.id, roleName: role.name });
      }
    } else {
      // Role name: @RoleName
      const roleName = match[3].trim();
      const role = guild.roles.cache.find(
        r => r.name.toLowerCase() === roleName.toLowerCase(),
      );
      if (role) {
        roles.push({ roleId: role.id, roleName: role.name });
      }
    }
  }

  return roles;
}

/**
 * Create error embed
 * @param {string} title - Embed title
 * @param {string} description - Embed description
 * @returns {EmbedBuilder}
 */
function createErrorEmbed(title, description) {
  return new EmbedBuilder()
    .setTitle("❌ " + title)
    .setDescription(description)
    .setColor(0xff0000)
    .setTimestamp();
}

/**
 * Create success embed
 * @param {string} title - Embed title
 * @param {string} description - Embed description
 * @returns {EmbedBuilder}
 */
function createSuccessEmbed(title, description) {
  return new EmbedBuilder()
    .setTitle("✅ " + title)
    .setDescription(description)
    .setColor(0x00ff00)
    .setTimestamp();
}

/**
 * Create info embed
 * @param {string} title - Embed title
 * @param {string} description - Embed description
 * @returns {EmbedBuilder}
 */
function createInfoEmbed(title, description) {
  return new EmbedBuilder()
    .setTitle("ℹ️ " + title)
    .setDescription(description)
    .setColor(0x3498db)
    .setTimestamp();
}
