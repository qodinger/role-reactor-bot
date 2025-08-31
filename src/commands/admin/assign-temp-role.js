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
import { THEME, THEME_COLOR } from "../../config/theme.js";
import { getLogger } from "../../utils/logger.js";
import {
  permissionErrorEmbed,
  errorEmbed,
} from "../../utils/discord/responseMessages.js";

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
    const durationMs = parseDuration(durationStr);
    if (!durationMs) {
      return false;
    }

    const maxDurationMs = 365 * 24 * 60 * 60 * 1000; // 1 year in milliseconds
    const minDurationMs = 1 * 60 * 1000; // 1 minute in milliseconds

    // Check if duration is too long (more than 1 year)
    if (durationMs > maxDurationMs) {
      return false;
    }

    // Check if duration is too short (less than 1 minute)
    if (durationMs < minDurationMs) {
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
          tip: "You need Administrator permissions to assign temporary roles.",
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
          description: `I need the following permissions to assign temporary roles: **${permissionNames}**`,
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
                "• Manage Roles (to assign roles to members)\n• Send Messages (to notify users about their temporary roles)",
              inline: false,
            },
          ],
        }),
      );
    }

    // Get and validate inputs
    const usersString = interaction.options.getString("users");
    const targetRole = interaction.options.getRole("role");
    const durationStr = interaction.options.getString("duration");
    const reason =
      interaction.options.getString("reason") || "No reason provided";

    // Validate role
    if (!validateRole(targetRole)) {
      return interaction.editReply(
        errorEmbed({
          title: "Invalid Role",
          description:
            "I cannot assign this role because it's managed by Discord or another integration.",
          solution:
            "Please choose a different role that you have permission to manage.",
          fields: [
            {
              name: "🔍 What's a Managed Role?",
              value:
                "• Bot roles (created by other bots)\n• Integration roles (from Discord apps)\n• Server Boost roles\n• Auto-generated roles",
              inline: false,
            },
            {
              name: "💡 Tip",
              value:
                "Create a new role specifically for temporary assignments to avoid conflicts.",
              inline: false,
            },
          ],
        }),
      );
    }

    // Validate duration
    if (!validateDuration(durationStr)) {
      return interaction.editReply(
        errorEmbed({
          title: "Invalid Duration",
          description:
            "The duration you provided is not valid or is outside the allowed range.",
          solution: "Please provide a duration between 5 minutes and 1 year.",
          fields: [
            {
              name: "📝 Valid Formats",
              value:
                "• `30m` - 30 minutes\n• `2h` - 2 hours\n• `1d` - 1 day\n• `1w` - 1 week\n• `1mo` - 1 month",
              inline: false,
            },
            {
              name: "⏰ Duration Limits",
              value:
                "• Minimum: 1 minute\n• Maximum: 1 year\n• Examples: `1m`, `15m`, `3h`, `7d`, `2w`",
              inline: false,
            },
          ],
        }),
      );
    }

    // Parse users
    const userIds = [];
    const userInputs = usersString
      .split(",")
      .map(user => user.trim())
      .filter(user => user.length > 0);

    for (const userInput of userInputs) {
      // Handle mentions (@username)
      if (userInput.startsWith("<@") && userInput.endsWith(">")) {
        const userId = userInput.replace(/[<@!>]/g, "");
        if (userId && /^\d+$/.test(userId)) {
          userIds.push(userId);
        }
      }
      // Handle user IDs (just numbers)
      else if (/^\d+$/.test(userInput)) {
        userIds.push(userInput);
      }
      // Handle usernames (try to find by username)
      else {
        try {
          const user = await client.users.fetch(userInput).catch(() => null);
          if (user) {
            userIds.push(user.id);
          }
        } catch {
          // Ignore invalid usernames
        }
      }
    }

    if (userIds.length === 0) {
      return interaction.editReply(
        errorEmbed({
          title: "No Valid Users Found",
          description:
            "I couldn't find any valid users from your input. Please check the format and try again.",
          solution:
            "Use user mentions (@username) or user IDs separated by commas.",
          fields: [
            {
              name: "📝 Valid Formats",
              value:
                "• `@user1 @user2 @user3`\n• `123456789012345678 987654321098765432`\n• `@user1, @user2, @user3`",
              inline: false,
            },
            {
              name: "🔍 What I Found",
              value: `Your input: \`${usersString}\`\nParsed inputs: \`${userInputs.join(", ")}\``,
              inline: false,
            },
            {
              name: "💡 Tip",
              value:
                "Make sure the users are mentioned correctly or use their exact user IDs.",
              inline: false,
            },
          ],
        }),
      );
    }

    // Calculate expiration time
    const durationMs = parseDuration(durationStr);
    const expiresAt = new Date(Date.now() + durationMs);

    // Process users in batches
    const results = {
      success: [],
      failed: [],
      skipped: [],
    };

    const limit = pLimit(3); // Process 3 users at a time

    await Promise.all(
      userIds.map(userId =>
        limit(async () => {
          try {
            const user = await client.users.fetch(userId).catch(() => null);
            if (!user) {
              results.failed.push({
                userId,
                reason: "User not found",
              });
              return;
            }

            const member = await interaction.guild.members
              .fetch(userId)
              .catch(() => null);
            if (!member) {
              results.failed.push({
                userId,
                reason: "User not in server",
              });
              return;
            }

            // Check if user already has the role
            if (member.roles.cache.has(targetRole.id)) {
              results.skipped.push({
                userId,
                reason: "Already has role",
              });
              return;
            }

            // Assign the role
            await member.roles.add(targetRole, reason);
            await storeTemporaryRole({
              guildId: interaction.guild.id,
              userId,
              roleId: targetRole.id,
              expiresAt,
            });

            // Send DM notification
            await assignRoleAndDM({
              userId,
              targetRole,
              expiresAt,
              reason,
              interaction,
              client,
              durationStr,
            });

            results.success.push({
              userId,
              username: user.username,
            });
          } catch (error) {
            logger.error("Error assigning temporary role", {
              userId,
              roleId: targetRole.id,
              error: error.message,
            });

            results.failed.push({
              userId,
              reason: error.message,
            });
          }
        }),
      ),
    );

    // Build and send results embed
    const embed = buildResultsEmbed(
      results,
      targetRole,
      durationStr,
      expiresAt,
      client,
    );

    await interaction.editReply({ embeds: [embed] });

    // Log successful command execution
    const duration = Date.now() - startTime;
    logger.logCommand("assign-temp-role", interaction.user.id, duration, true);
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error("Error assigning temporary roles", error);
    logger.logCommand("assign-temp-role", interaction.user.id, duration, false);

    await interaction.editReply(
      errorEmbed({
        title: "Assignment Failed",
        description:
          "Something went wrong while assigning temporary roles. This might be due to a temporary issue.",
        solution:
          "Please try again in a moment. If the problem persists, check that I have the necessary permissions.",
        fields: [
          {
            name: "🔧 Quick Fix",
            value:
              "• Make sure I have 'Manage Roles' permission\n• Check that the role exists and I can manage it\n• Verify your internet connection is stable",
            inline: false,
          },
        ],
      }),
    );
  }
}

function buildResultsEmbed(
  results,
  targetRole,
  durationStr,
  expiresAt,
  client,
) {
  const totalProcessed =
    results.success.length + results.failed.length + results.skipped.length;

  const embed = new EmbedBuilder()
    .setTitle("✅ **Temporary Role Assignment Complete!**")
    .setDescription(
      `Processed ${totalProcessed} users for the **${targetRole.name}** role.`,
    )
    .setColor(THEME.SUCCESS)
    .setTimestamp()
    .setFooter({
      text: "Role Reactor • Temporary Roles",
      iconURL: client.user.displayAvatarURL(),
    });

  // Add success results
  if (results.success.length > 0) {
    embed.addFields({
      name: `✅ Successfully Assigned (${results.success.length})`,
      value: results.success
        .map(r => `<@${r.userId}>: ${r.username}`)
        .join("\n"),
      inline: false,
    });
  }

  // Add failed results
  if (results.failed.length > 0) {
    embed.addFields({
      name: `❌ Failed (${results.failed.length})`,
      value: results.failed.map(r => `<@${r.userId}>: ${r.reason}`).join("\n"),
      inline: false,
    });
  }

  // Add skipped results
  if (results.skipped.length > 0) {
    embed.addFields({
      name: `⚠️ Skipped (${results.skipped.length})`,
      value: results.skipped.map(r => `<@${r.userId}>: ${r.reason}`).join("\n"),
      inline: false,
    });
  }

  return embed;
}
