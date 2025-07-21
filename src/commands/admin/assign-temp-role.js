import {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
} from "discord.js";
import pLimit from "p-limit";
import {
  hasAdminPermissions,
  botHasRequiredPermissions,
  getMissingBotPermissions,
  formatPermissionName,
} from "../../utils/discord/permissions.js";
import {
  addTemporaryRole,
  parseDuration,
  formatDuration,
} from "../../utils/discord/temporaryRoles.js";
import { THEME_COLOR } from "../../config/theme.js";
import { getLogger } from "../../utils/logger.js";

export const data = new SlashCommandBuilder()
  .setName("assign-temp-role")
  .setDescription(
    "Assign a temporary role to multiple users that expires after a set time",
  )
  .addStringOption(option =>
    option
      .setName("users")
      .setDescription(
        "Comma-separated list of user IDs or mentions to assign the temporary role to",
      )
      .setRequired(true),
  )
  .addRoleOption(option =>
    option
      .setName("role")
      .setDescription("The role to assign temporarily")
      .setRequired(true),
  )
  .addStringOption(option =>
    option
      .setName("duration")
      .setDescription("How long the role should last (e.g., 1h, 2d, 1w, 30m)")
      .setRequired(true),
  )
  .addStringOption(option =>
    option
      .setName("reason")
      .setDescription("Reason for assigning the temporary role")
      .setRequired(false),
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles);

// Validate if a role can be assigned
export function validateRole(role) {
  // Don't assign managed roles (bot roles, integration roles, etc.)
  if (role.managed) {
    return false;
  }

  // Don't assign bot roles
  if (role.tags && role.tags.botId) {
    return false;
  }

  return true;
}

// Store temporary role data
export async function storeTemporaryRole(roleData) {
  const logger = getLogger();

  try {
    await addTemporaryRole(
      roleData.guildId,
      roleData.userId,
      roleData.roleId,
      roleData.expiresAt,
    );
    return true;
  } catch (error) {
    logger.error("Error storing temporary role", error);
    return false;
  }
}

// Validate duration string
export function validateDuration(durationStr) {
  try {
    const expiresAt = parseDuration(durationStr);
    const now = new Date();
    const maxDuration = new Date();
    maxDuration.setFullYear(maxDuration.getFullYear() + 1);

    // Check if duration is too long (more than 1 year)
    if (expiresAt > maxDuration) {
      return false;
    }

    // Check if duration is too short (less than 5 minutes)
    const minDuration = new Date(now.getTime() + 5 * 60 * 1000); // 5 minutes
    if (expiresAt < minDuration) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

function delay(ms) {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}

async function assignRoleAndDM({
  userId,
  targetRole,
  expiresAt,
  reason,
  interaction,
  client,
  durationStr,
}) {
  const result = { userId, status: "", error: null };
  try {
    const targetMember = await interaction.guild.members.fetch(userId);
    if (!targetMember) {
      result.status = "❌ User not found";
      return result;
    }
    if (targetMember.user.bot) {
      result.status = "❌ Cannot assign roles to bots";
      return result;
    }
    const alreadyHasRole = targetMember.roles.cache.has(targetRole.id);
    if (alreadyHasRole) {
      result.status = "⚠️ Already has role";
      return result;
    }
    // Retry logic for Discord API requests
    let retries = 2;
    while (retries >= 0) {
      try {
        await targetMember.roles.add(
          targetRole,
          `Temporary role assigned by ${interaction.user.tag}: ${reason}`,
        );
        break;
      } catch (err) {
        if (retries === 0) throw err;
        await delay(1000);
        retries--;
      }
    }
    // DM user
    try {
      const userEmbed = new EmbedBuilder()
        .setTitle("🎭 Temporary Role Assigned!")
        .setDescription(
          `You've been assigned the **${targetRole.name}** role in **${interaction.guild.name}**`,
        )
        .setColor(targetRole.color || THEME_COLOR)
        .setTimestamp()
        .setFooter({
          text: "Role Reactor • Temporary Roles",
          iconURL: client.user.displayAvatarURL(),
        });
      userEmbed.addFields(
        {
          name: "⏰ Duration",
          value: formatDuration(durationStr),
          inline: true,
        },
        {
          name: "🕐 Expires At",
          value: `<t:${Math.floor(expiresAt.getTime() / 1000)}:F>\n(<t:${Math.floor(expiresAt.getTime() / 1000)}:R>)`,
          inline: true,
        },
        {
          name: "📝 Reason",
          value: reason,
          inline: false,
        },
        {
          name: "👮 Assigned By",
          value: `${interaction.user} (${interaction.user.tag})`,
          inline: false,
        },
      );
      await targetMember.user.send({ embeds: [userEmbed] });
    } catch (_dmError) {
      // Ignore DM errors
    }
    result.status = "✅ Role assigned";
    return result;
  } catch (err) {
    result.status = `❌ ${err.message}`;
    result.error = err;
    return result;
  }
}

export async function execute(interaction, client) {
  await interaction.deferReply({ flags: 64 });
  try {
    if (!hasAdminPermissions(interaction.member)) {
      return interaction.editReply({
        content:
          "❌ **Permission Denied**\nYou need administrator permissions to use this command.",
        flags: 64,
      });
    }
    if (!botHasRequiredPermissions(interaction.guild)) {
      const missingPermissions = getMissingBotPermissions(interaction.guild);
      const permissionNames = missingPermissions
        .map(formatPermissionName)
        .join(", ");
      return interaction.editReply({
        content: `❌ **Missing Bot Permissions**\nI need the following permissions: **${permissionNames}**\n\nPlease ensure I have the required permissions and try again.`,
        flags: 64,
      });
    }
    const usersStr = interaction.options.getString("users");
    const userIds = usersStr
      .split(",")
      .map(u => u.trim())
      .filter(Boolean)
      .map(u => u.replace(/<@!?([0-9]+)>/, "$1"));
    const targetRole = interaction.options.getRole("role");
    const durationStr = interaction.options.getString("duration");
    const reason =
      interaction.options.getString("reason") || "No reason provided";
    const botMember = await interaction.guild.members.fetchMe();
    if (targetRole.position >= botMember.roles.highest.position) {
      return interaction.editReply({
        content: `❌ **Role Too High**\nI cannot manage the **${targetRole.name}** role because it's higher than my highest role.\n\n**How to fix:** Move my highest role above the target role in your server's role settings (Server Settings > Roles).`,
        flags: 64,
      });
    }
    if (targetRole.position >= interaction.member.roles.highest.position) {
      return interaction.editReply({
        content: `❌ **Role Too High**\nYou cannot manage the **${targetRole.name}** role because it's higher than your highest role.`,
        flags: 64,
      });
    }
    let expiresAt;
    try {
      const durationMs = parseDuration(durationStr);
      if (!durationMs || isNaN(durationMs)) {
        return interaction.editReply({
          content: `❌ **Invalid Duration Format**\n\n**Valid formats:**\n• \`30m\` - 30 minutes\n• \`2h\` - 2 hours\n• \`1d\` - 1 day\n• \`1w\` - 1 week\n• \`1h30m\` - 1 hour 30 minutes`,
          flags: 64,
        });
      }
      expiresAt = new Date(Date.now() + durationMs);
    } catch (error) {
      return interaction.editReply({
        content: `❌ **Invalid Duration Format**\n\n**Valid formats:**\n• \`30m\` - 30 minutes\n• \`2h\` - 2 hours\n• \`1d\` - 1 day\n• \`1w\` - 1 week\n• \`1h30m\` - 1 hour 30 minutes\n\n**Error:** ${error.message}`,
        flags: 64,
      });
    }
    const maxDuration = new Date();
    maxDuration.setFullYear(maxDuration.getFullYear() + 1);
    if (expiresAt > maxDuration) {
      return interaction.editReply({
        content:
          "❌ **Duration Too Long**\nThe maximum duration for temporary roles is 1 year.",
        flags: 64,
      });
    }
    const limit = pLimit(3); // 3 concurrent Discord API requests
    const jobs = userIds.map(userId =>
      limit(() =>
        assignRoleAndDM({
          userId,
          targetRole,
          expiresAt,
          reason,
          interaction,
          client,
          durationStr,
        }),
      ),
    );
    let results = [];
    if (userIds.length > 30) {
      await interaction.editReply({
        content: `⏳ Processing ${userIds.length} users. This may take a few minutes. You will receive a summary when complete.`,
        flags: 64,
      });
      results = await Promise.all(jobs);
      await interaction.followUp({
        content: `✅ Assignment complete! See below for details.`,
        embeds: [
          buildResultsEmbed(
            results,
            targetRole,
            durationStr,
            expiresAt,
            client,
          ),
        ],
        flags: 64,
      });
      // Bulk insert to DB
      await bulkAddTemporaryRoles(
        interaction.guild.id,
        targetRole.id,
        expiresAt,
        results,
      );
      return;
    } else {
      results = await Promise.all(jobs);
      // Bulk insert to DB
      await bulkAddTemporaryRoles(
        interaction.guild.id,
        targetRole.id,
        expiresAt,
        results,
      );
      const embed = buildResultsEmbed(
        results,
        targetRole,
        durationStr,
        expiresAt,
        client,
      );
      return interaction.editReply({ embeds: [embed], flags: 64 });
    }
  } catch (error) {
    const logger = getLogger();
    logger.error("Error executing assign-temp-role command", error);
    return interaction.editReply({
      content: `❌ **Error:** ${error.message}`,
      flags: 64,
    });
  }
}

function buildResultsEmbed(
  results,
  targetRole,
  durationStr,
  expiresAt,
  client,
) {
  return new EmbedBuilder()
    .setTitle("✅ **Temporary Role Assignment Complete!**")
    .setDescription(
      `Successfully processed ${results.length} users for the **${targetRole.name}** role.`,
    )
    .setColor(THEME_COLOR)
    .setTimestamp()
    .setFooter({
      text: "Role Reactor • Temporary Roles",
      iconURL: client.user.displayAvatarURL(),
    })
    .addFields({
      name: "📋 Results",
      value: results.map(r => `<@${r.userId}>: ${r.status}`).join("\n"),
      inline: false,
    });
}

// Bulk insert to DB
async function bulkAddTemporaryRoles(guildId, roleId, expiresAt, results) {
  const { getDatabaseManager } = await import(
    "../../utils/storage/databaseManager.js"
  );
  const dbManager = await getDatabaseManager();
  const docs = results
    .filter(r => r.status === "✅ Role assigned")
    .map(r => ({
      guildId,
      userId: r.userId,
      roleId,
      expiresAt: expiresAt.toISOString(),
    }));
  if (docs.length > 0 && dbManager.bulkAddTemporaryRoles) {
    await dbManager.bulkAddTemporaryRoles(docs);
  } else {
    // fallback to single insert
    for (const doc of docs) {
      await dbManager.addTemporaryRole(
        doc.guildId,
        doc.userId,
        doc.roleId,
        doc.expiresAt,
      );
    }
  }
}
