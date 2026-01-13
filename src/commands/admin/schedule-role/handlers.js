import dedent from "dedent";
import { getLogger } from "../../../utils/logger.js";
import {
  botHasRequiredPermissions,
  getMissingBotPermissions,
  formatPermissionName,
} from "../../../utils/discord/permissions.js";
import {
  errorEmbed,
  successEmbed,
  infoEmbed,
} from "../../../utils/discord/responseMessages.js";
import {
  createScheduleEmbed,
  createScheduleListEmbed,
  createScheduleViewEmbed,
} from "./embeds.js";
import {
  validateRole,
  processUserList,
  validateSchedule,
  detectTargetingType,
  generateScheduleId,
} from "./utils.js";
import { getDatabaseManager } from "../../../utils/storage/databaseManager.js";
import { getUserData } from "../../../commands/general/core/utils.js";

/**
 * Handle the create schedule logic
 */
export async function handleCreate(interaction, client, deferred = false) {
  const logger = getLogger();

  try {
    // Validate bot permissions
    if (!botHasRequiredPermissions(interaction.guild)) {
      const missingPermissions = getMissingBotPermissions(interaction.guild);
      const permissionNames = missingPermissions
        .map(formatPermissionName)
        .join(", ");

      const response = errorEmbed({
        title: "Missing Bot Permissions",
        description: `I need the following permissions to schedule roles: **${permissionNames}**`,
        solution:
          "Please ask a server administrator to grant me these permissions and try again.",
      });

      if (deferred) {
        return interaction.editReply(response);
      } else {
        return interaction.reply(response);
      }
    }

    // Get command options
    const action = interaction.options.getString("action"); // "assign" or "remove"
    const role = interaction.options.getRole("role");
    const usersString = interaction.options.getString("users");
    const scheduleType = interaction.options.getString("schedule-type");
    const scheduleInput = interaction.options.getString("schedule");
    const reason =
      interaction.options.getString("reason") || "No reason provided";

    // Validate role
    const roleValidation = validateRole(role, interaction.guild);
    if (!roleValidation.valid) {
      const response = errorEmbed({
        title: "Invalid Role",
        description: roleValidation.error,
        solution: roleValidation.solution,
      });

      if (deferred) {
        return interaction.editReply(response);
      } else {
        return interaction.reply(response);
      }
    }

    // Dynamically detect targeting type based on mentions in users field
    const targeting = detectTargetingType(usersString, interaction.guild);
    const isAllMembers = targeting.type === "everyone";
    const targetRoles = targeting.targetRoles || [];
    const isMixed = targeting.type === "mixed";

    let userIds = [];

    // Handle mixed targeting (users + roles)
    if (isMixed && targetRoles.length > 0) {
      try {
        // First, get users from user mentions
        const userValidation = await processUserList(usersString, interaction);
        const userMentionIds = userValidation.valid
          ? userValidation.validUsers.map(user => user.id)
          : [];

        // Then, get members from role mentions
        const roleNames = targetRoles.map(r => r.name).join(", ");
        logger.info(
          `Fetching members with roles ${roleNames} and processing user mentions for schedule in guild ${interaction.guild.name}`,
        );

        if (deferred && interaction.guild.memberCount > 5000) {
          try {
            await interaction.editReply({
              content: `⏳ Fetching members with roles ${roleNames} and processing user mentions... This may take a moment for large servers.`,
            });
          } catch (error) {
            logger.debug("Failed to update interaction with progress", error);
          }
        }

        // Fetch all members to check their roles
        await interaction.guild.members.fetch();

        // Get all members who have ANY of the target roles (OR logic)
        const roleIds = targetRoles.map(r => r.id);
        const roleMemberIds = interaction.guild.members.cache
          .filter(member =>
            roleIds.some(roleId => member.roles.cache.has(roleId)),
          )
          .filter(
            member =>
              !member.user.bot || member.user.id === interaction.client.user.id,
          )
          .map(member => member.id);

        // Combine user mentions and role-based members, remove duplicates
        userIds = [...new Set([...userMentionIds, ...roleMemberIds])];

        logger.info(
          `Found ${userMentionIds.length} user mentions and ${roleMemberIds.length} members with roles ${roleNames}, total unique: ${userIds.length} in guild ${interaction.guild.name}`,
        );

        if (userIds.length === 0) {
          const response = errorEmbed({
            title: "No Members Found",
            description: `No valid users or members with any of the roles: **${roleNames}** found to schedule the role for.`,
            solution:
              "Make sure the users are valid and the roles exist and have members assigned to them.",
          });

          if (deferred) {
            return interaction.editReply(response);
          } else {
            return interaction.reply(response);
          }
        }

        // Apply member limit for combined result (Core members get higher limits)
        // Base limit: 500 matches RoleExecutor chunk size for optimal processing
        const BASE_MAX_ALL_MEMBERS = 500;
        let MAX_ALL_MEMBERS = BASE_MAX_ALL_MEMBERS;

        try {
          const userData = await getUserData(interaction.user.id);
          // Simple credit-based system: users with credits get enhanced limits
          if (userData.credits > 0) {
            MAX_ALL_MEMBERS = Math.floor(BASE_MAX_ALL_MEMBERS * 2); // 2x limit for Core users
          }
        } catch (error) {
          // If lookup fails, use default limit
          logger.debug("Failed to check Core status for bulk limit:", error);
        }

        if (userIds.length > MAX_ALL_MEMBERS) {
          const response = errorEmbed({
            title: "Too Many Members",
            description: `The combined total of **${userIds.length.toLocaleString()} members** (from user mentions and roles ${roleNames}) exceeds the maximum limit of **${MAX_ALL_MEMBERS.toLocaleString()} members**.`,
            solution: dedent`
              For operations with more than ${MAX_ALL_MEMBERS.toLocaleString()} total members, please use one of these alternatives:
            
**Recommended Solutions:**
1. **Reduce Targeting**: Use fewer roles or split into multiple schedules
2. **Direct Role Assignment**: Assign the target role to another role in Server Settings (instant and efficient)
3. **Split Operations**: Create multiple schedules targeting different groups

              **Why this limit?** Operations on ${userIds.length.toLocaleString()} members would take ${Math.ceil(userIds.length / 500)}-${Math.ceil(userIds.length / 500) * 2} minutes to complete and have higher reliability risks.
            `,
          });

          logger.warn(
            `Attempted to schedule roles for ${userIds.length} members (mixed: ${userMentionIds.length} users + roles ${roleNames}) (exceeds ${MAX_ALL_MEMBERS} limit)`,
          );

          if (deferred) {
            return interaction.editReply(response);
          } else {
            return interaction.reply(response);
          }
        }

        // Warn for large operations
        if (userIds.length > 1000) {
          logger.warn(
            `Large operation detected: ${userIds.length} members (mixed: ${userMentionIds.length} users + roles ${roleNames}) for schedule. This may take a long time.`,
          );
        }
      } catch (error) {
        logger.error("Error fetching members by mixed targeting:", error);
        const response = errorEmbed({
          title: "Failed to Fetch Members",
          description:
            "Could not fetch members with the specified roles or process user mentions. This requires the GUILD_MEMBERS privileged intent.",
          solution:
            "Make sure the bot has the GUILD_MEMBERS intent enabled in the Discord Developer Portal.",
        });

        if (deferred) {
          return interaction.editReply(response);
        } else {
          return interaction.reply(response);
        }
      }
    } else if (targeting.type === "role" && targetRoles.length > 0) {
      // Handle role-based member targeting (supports multiple roles)
      try {
        const roleNames = targetRoles.map(r => r.name).join(", ");
        logger.info(
          `Fetching members with roles ${roleNames} for schedule in guild ${interaction.guild.name}`,
        );

        // Fetch all guild members to check roles (requires GUILD_MEMBERS intent)
        if (deferred && interaction.guild.memberCount > 5000) {
          try {
            await interaction.editReply({
              content: `⏳ Fetching members with roles ${roleNames}... This may take a moment for large servers.`,
            });
          } catch (error) {
            logger.debug("Failed to update interaction with progress", error);
          }
        }

        // Fetch all members to check their roles
        await interaction.guild.members.fetch();

        // Get all members who have ANY of the target roles (OR logic)
        const roleIds = targetRoles.map(r => r.id);
        userIds = interaction.guild.members.cache
          .filter(member =>
            roleIds.some(roleId => member.roles.cache.has(roleId)),
          )
          .filter(
            member =>
              !member.user.bot || member.user.id === interaction.client.user.id,
          )
          .map(member => member.id);

        // Remove duplicates (in case a member has multiple of the mentioned roles)
        userIds = [...new Set(userIds)];

        logger.info(
          `Found ${userIds.length} members with roles ${roleNames} in guild ${interaction.guild.name}`,
        );

        if (userIds.length === 0) {
          const response = errorEmbed({
            title: "No Members Found",
            description: `No members found with any of the roles: **${roleNames}** to schedule the role for.`,
            solution:
              "Make sure the roles exist and have members assigned to them.",
          });

          if (deferred) {
            return interaction.editReply(response);
          } else {
            return interaction.reply(response);
          }
        }

        // Apply member limit (Core members get higher limits)
        // Base limit: 500 matches RoleExecutor chunk size for optimal processing
        const BASE_MAX_ALL_MEMBERS = 500;
        let MAX_ALL_MEMBERS = BASE_MAX_ALL_MEMBERS;

        try {
          const userData = await getUserData(interaction.user.id);
          // Simple credit-based system: users with credits get enhanced limits
          if (userData.credits > 0) {
            MAX_ALL_MEMBERS = Math.floor(BASE_MAX_ALL_MEMBERS * 2); // 2x limit for Core users
          }
        } catch (error) {
          // If lookup fails, use default limit
          logger.debug("Failed to check Core status for bulk limit:", error);
        }

        if (userIds.length > MAX_ALL_MEMBERS) {
          const response = errorEmbed({
            title: "Too Many Members",
            description: `The roles **${roleNames}** have a combined total of **${userIds.length.toLocaleString()} members**, which exceeds the maximum limit of **${MAX_ALL_MEMBERS.toLocaleString()} members** for role-based operations.`,
            solution: dedent`
              For roles with more than ${MAX_ALL_MEMBERS.toLocaleString()} total members, please use one of these alternatives:
            
**Recommended Solutions:**
1. **Direct Role Assignment**: Assign the target role to another role in Server Settings (instant and efficient)
2. **Split Operations**: Create multiple schedules targeting fewer roles or specific role groups
3. **Discord's Built-in Features**: Use Discord's role management in Server Settings

              **Why this limit?** Operations on ${userIds.length.toLocaleString()} members would take ${Math.ceil(userIds.length / 500)}-${Math.ceil(userIds.length / 500) * 2} minutes to complete and have higher reliability risks.
            `,
          });

          logger.warn(
            `Attempted to schedule roles for ${userIds.length} members with roles ${roleNames} (exceeds ${MAX_ALL_MEMBERS} limit)`,
          );

          if (deferred) {
            return interaction.editReply(response);
          } else {
            return interaction.reply(response);
          }
        }
      } catch (error) {
        logger.error("Error fetching members by role:", error);
        const response = errorEmbed({
          title: "Failed to Fetch Members",
          description:
            "Could not fetch members with the specified role. This requires the GUILD_MEMBERS privileged intent.",
          solution:
            "Make sure the bot has the GUILD_MEMBERS intent enabled in the Discord Developer Portal.",
        });

        if (deferred) {
          return interaction.editReply(response);
        } else {
          return interaction.reply(response);
        }
      }
    } else if (targeting.type === "everyone") {
      // Fetch all guild members
      try {
        logger.info(
          `Fetching all members for schedule in guild ${interaction.guild.name} (${interaction.guild.id})`,
        );

        // Fetch all members (requires GUILD_MEMBERS intent)
        // Use efficient fetching - pass empty options to fetch all members
        logger.info("Fetching all guild members...");

        // For very large servers, provide user feedback
        if (deferred && interaction.guild.memberCount > 5000) {
          try {
            await interaction.editReply({
              content: `⏳ Fetching ${interaction.guild.memberCount.toLocaleString()} members... This may take 30-60 seconds for large servers.`,
            });
          } catch (error) {
            logger.debug("Failed to update interaction with progress", error);
          }
        }

        // Fetch all members (Discord.js handles pagination automatically)
        // This may take time on very large servers (5000+ members)
        await interaction.guild.members.fetch(); // Fetch all members (paginated automatically)

        const allMembersCollection = interaction.guild.members.cache;

        // Filter out bots (you might want to keep them, adjust as needed)
        // For now, we'll exclude bots except the bot itself
        userIds = Array.from(allMembersCollection.values())
          .filter(
            member =>
              !member.user.bot || member.user.id === interaction.client.user.id,
          )
          .map(member => member.id);

        logger.info(
          `Found ${userIds.length} members in guild ${interaction.guild.name} (excluding bots)`,
        );

        if (userIds.length === 0) {
          const response = errorEmbed({
            title: "No Members Found",
            description:
              "No members found in this server to schedule the role for.",
            solution:
              "Make sure the bot has access to view server members (GUILD_MEMBERS intent).",
          });

          if (deferred) {
            return interaction.editReply(response);
          } else {
            return interaction.reply(response);
          }
        }

        // Hard limit for "@everyone" operations (Core members get higher limits)
        // Base limit: 500 matches RoleExecutor chunk size for optimal processing
        const BASE_MAX_ALL_MEMBERS = 500;
        let MAX_ALL_MEMBERS = BASE_MAX_ALL_MEMBERS;

        try {
          const userData = await getUserData(interaction.user.id);
          // Simple credit-based system: users with credits get enhanced limits
          if (userData.credits > 0) {
            MAX_ALL_MEMBERS = Math.floor(BASE_MAX_ALL_MEMBERS * 2); // 2x limit for Core users
          }
        } catch (error) {
          // If lookup fails, use default limit
          logger.debug("Failed to check Core status for bulk limit:", error);
        }

        if (userIds.length > MAX_ALL_MEMBERS) {
          const response = errorEmbed({
            title: "Too Many Members",
            description: `This server has **${userIds.length.toLocaleString()} members**, which exceeds the maximum limit of **${MAX_ALL_MEMBERS.toLocaleString()} members** for "@everyone" operations.`,
            solution: dedent`
              For servers with more than ${MAX_ALL_MEMBERS.toLocaleString()} members, please use one of these alternatives:
            
**Recommended Solutions:**
1. **Role-Based Targeting**: Assign the role to another role instead of individual members (instant and efficient)
2. **Split Operations**: Create multiple schedules targeting specific role groups or subsets
3. **Discord's Built-in Features**: Use Discord's role management in Server Settings

              **Why this limit?** Operations on ${userIds.length.toLocaleString()} members would take ${Math.ceil(userIds.length / 500)}-${Math.ceil(userIds.length / 500) * 2} minutes to complete and have higher reliability risks.
            `,
          });

          logger.warn(
            `Attempted to schedule roles for ${userIds.length} members (exceeds ${MAX_ALL_MEMBERS} limit)`,
          );

          if (deferred) {
            return interaction.editReply(response);
          } else {
            return interaction.reply(response);
          }
        }

        // Warn for large servers (but still allow)
        if (userIds.length > 500) {
          logger.warn(
            `Large server detected: ${userIds.length} members for schedule. This may take a long time and could hit rate limits.`,
          );

          // Show estimated time for large operations
          if (userIds.length > 500 && deferred) {
            try {
              const estimatedMinutes = Math.ceil(userIds.length / 500);
              const maxMinutes = estimatedMinutes * 2;

              await interaction.editReply({
                content: `⏳ Large operation detected (${userIds.length.toLocaleString()} members). Estimated execution time: ${estimatedMinutes}-${maxMinutes} minutes. Processing...`,
              });
            } catch (error) {
              logger.debug("Failed to update interaction with progress", error);
            }
          }
        }
      } catch (error) {
        logger.error("Error fetching all members:", error);
        const response = errorEmbed({
          title: "Failed to Fetch Members",
          description:
            "Could not fetch all server members. This requires the GUILD_MEMBERS privileged intent.",
          solution:
            "Make sure the bot has the GUILD_MEMBERS intent enabled in the Discord Developer Portal.",
        });

        if (deferred) {
          return interaction.editReply(response);
        } else {
          return interaction.reply(response);
        }
      }
    } else if (targeting.type === "users") {
      // Process specific user list (no roles, only user mentions)
      const userValidation = await processUserList(usersString, interaction);
      if (!userValidation.valid) {
        const response = errorEmbed({
          title: "Invalid Users",
          description: userValidation.error || "Invalid user format provided.",
          solution:
            userValidation.solution ||
            "Please provide valid user mentions or IDs.",
        });

        if (deferred) {
          return interaction.editReply(response);
        } else {
          return interaction.reply(response);
        }
      }

      const { validUsers } = userValidation;

      // Check maximum user limit for specific users (Core members get higher limits)
      const BASE_MAX_USERS = 10;
      let MAX_USERS = BASE_MAX_USERS;

      try {
        const userData = await getUserData(interaction.user.id);
        // Simple credit-based system: users with credits get enhanced limits
        if (userData.credits > 0) {
          MAX_USERS = Math.floor(BASE_MAX_USERS * 2); // 2x limit for Core users
        }
      } catch (error) {
        // If lookup fails, use default limit
        logger.debug("Failed to check Core status for user limit:", error);
      }

      if (validUsers.length > MAX_USERS) {
        const response = errorEmbed({
          title: "Too Many Users",
          description: `You can only schedule roles for a maximum of **${MAX_USERS} users** at once when specifying individual users.`,
          solution: dedent`
            For bulk operations, you can:
- Use \`users:@everyone\` to target all members
- Mention roles (e.g., \`users:@RoleName\`) to target members with those roles
            - Mix users and roles (e.g., \`users:@user1,@user2,@RoleName\`) to combine both
          `,
        });

        if (deferred) {
          return interaction.editReply(response);
        } else {
          return interaction.reply(response);
        }
      }

      userIds = validUsers.map(user => user.id);
    } else {
      // Unknown targeting type - should not happen, but handle gracefully
      const response = errorEmbed({
        title: "Invalid Targeting",
        description: "Could not determine what to target from the users field.",
        solution:
          "Use user mentions, role mentions (e.g., @RoleName), or @everyone for all members.",
      });

      if (deferred) {
        return interaction.editReply(response);
      } else {
        return interaction.reply(response);
      }
    }

    // Parse and validate schedule
    const scheduleValidation = await validateSchedule(
      scheduleType,
      scheduleInput,
    );
    if (!scheduleValidation.valid) {
      const response = errorEmbed({
        title: "Invalid Schedule",
        description: scheduleValidation.error,
        solution: scheduleValidation.solution,
      });

      if (deferred) {
        return interaction.editReply(response);
      } else {
        return interaction.reply(response);
      }
    }

    const dbManager = await getDatabaseManager();
    if (!dbManager) {
      const response = errorEmbed({
        title: "Database Error",
        description: "Failed to connect to the database.",
        solution: "Please try again or contact support if the issue persists.",
      });

      if (deferred) {
        return interaction.editReply(response);
      } else {
        return interaction.reply(response);
      }
    }

    const scheduleId = generateScheduleId();

    // Create schedule data
    let scheduleData;
    if (scheduleType === "one-time") {
      const scheduledAt = scheduleValidation.scheduledAt;

      scheduleData = {
        id: scheduleId,
        guildId: interaction.guild.id,
        action, // "assign" or "remove"
        roleId: role.id,
        userIds,
        scheduledAt,
        executed: false,
        cancelled: false,
        reason,
        createdBy: interaction.user.id,
        scheduleType: "one-time",
      };

      // Save to scheduled_roles collection
      const created = await dbManager.scheduledRoles.create(scheduleData);
      if (!created) {
        throw new Error("Failed to create scheduled role in database");
      }
    } else {
      // Recurring schedule
      const scheduleConfig = scheduleValidation.scheduleConfig;

      scheduleData = {
        id: scheduleId,
        guildId: interaction.guild.id,
        action,
        roleId: role.id,
        userIds,
        scheduleType,
        scheduleConfig,
        active: true,
        cancelled: false,
        reason,
        createdBy: interaction.user.id,
        lastExecutedAt: null,
      };

      // Save to recurring_schedules collection
      const created = await dbManager.recurringSchedules.create(scheduleData);
      if (!created) {
        throw new Error("Failed to create recurring schedule in database");
      }
    }

    // Create user array for embed (limited to first 10 for display)
    const displayUsers = isAllMembers
      ? [] // Empty array - we'll show "all members" in embed
      : userIds.slice(0, 10).map(userId => {
          const member = interaction.guild.members.cache.get(userId);
          return member?.user || { id: userId };
        });

    // Create success embed
    // Track if we have user mentions in mixed mode
    const hasUserMentions = isMixed && targeting.hasUsers;

    const embed = createScheduleEmbed(
      scheduleData,
      role,
      displayUsers,
      scheduleType,
      scheduleInput,
      client,
      isAllMembers,
      userIds.length,
      targetRoles.length > 0 ? targetRoles[0] : null, // For backward compatibility
      targetRoles, // Pass all roles
      hasUserMentions, // Pass mixed flag
    );

    // Immediately check embed after creation
    logger.info("Embed created, checking description", {
      embedType: embed.constructor.name,
      hasDescription: !!embed.data?.description,
      descriptionValue: embed.data?.description?.substring(0, 50) || "MISSING",
    });

    // Validate embed before sending - ensure description is always present
    const embedJson = embed.toJSON();

    logger.info("Embed JSON before validation", {
      hasDescription: !!embedJson.description,
      descriptionLength: embedJson.description?.length || 0,
      descriptionValue: embedJson.description?.substring(0, 100) || "MISSING",
      embedKeys: Object.keys(embedJson),
    });

    // Force description to exist - Discord requires this field
    if (
      !embedJson.description ||
      typeof embedJson.description !== "string" ||
      embedJson.description.trim().length === 0
    ) {
      logger.error("Embed missing description, setting fallback", {
        embedData: embed.data,
        embedJson: JSON.stringify(embedJson),
        hasDescription: !!embedJson.description,
        descriptionType: typeof embedJson.description,
      });
      embed.setDescription("Schedule created successfully");
      // Re-validate after setting
      const newJson = embed.toJSON();
      if (!newJson.description) {
        throw new Error(
          "Failed to set embed description - embed may be corrupted",
        );
      }
    }

    // Final validation before sending
    const finalEmbedJson = embed.toJSON();
    logger.info("Sending schedule embed", {
      hasDescription: !!finalEmbedJson.description,
      descriptionLength: finalEmbedJson.description?.length || 0,
      descriptionValue:
        finalEmbedJson.description?.substring(0, 100) || "MISSING",
      hasTitle: !!finalEmbedJson.title,
      embedKeys: Object.keys(finalEmbedJson),
    });

    // Ensure embed has description before sending
    if (
      !finalEmbedJson.description ||
      finalEmbedJson.description.trim().length === 0
    ) {
      logger.error(
        "CRITICAL: Embed still missing description after validation",
        {
          embedJson: finalEmbedJson,
        },
      );
      throw new Error("Embed description is required but missing");
    }

    // Final check - verify the embed object itself
    const finalCheck = embed.toJSON();
    if (!finalCheck.description || finalCheck.description.trim().length === 0) {
      logger.error("CRITICAL: Embed description missing in final check", {
        embedData: embed.data,
        embedJson: finalCheck,
      });
      // Force set description one more time
      embed.setDescription("Schedule created successfully");
    }

    // Log the actual payload being sent
    const sendPayload = { embeds: [embed] };
    const sendPayloadJson = { embeds: [embed.toJSON()] };
    logger.info("Payload being sent to Discord", {
      embedsCount: sendPayloadJson.embeds.length,
      firstEmbedDescription:
        sendPayloadJson.embeds[0]?.description || "MISSING",
      firstEmbedDescriptionLength:
        sendPayloadJson.embeds[0]?.description?.length || 0,
    });

    if (deferred) {
      await interaction.editReply(sendPayload);
    } else {
      await interaction.reply({ ...sendPayload, flags: 64 });
    }

    logger.info(
      `Scheduled role ${action} created by ${interaction.user.tag} in ${interaction.guild.name}: Schedule ID ${scheduleId}, Users: ${userIds.length}${isAllMembers ? " (all members)" : ""}`,
    );
  } catch (error) {
    logger.error("Error in handleCreate:", error);

    const response = errorEmbed({
      title: "Error",
      description: "Failed to create scheduled role.",
      solution: "Please try again or contact support.",
    });

    if (deferred) {
      await interaction.editReply(response);
    } else if (!interaction.replied && !interaction.deferred) {
      await interaction.reply(response);
    }
  }
}

/**
 * Handle the list schedules logic
 */
export async function handleList(interaction, client, deferred = false) {
  const logger = getLogger();

  try {
    const dbManager = await getDatabaseManager();
    if (!dbManager) {
      const response = errorEmbed({
        title: "Database Error",
        description: "Failed to connect to the database.",
        solution: "Please try again or contact support if the issue persists.",
      });

      if (deferred) {
        return interaction.editReply(response);
      } else {
        return interaction.reply(response);
      }
    }

    const page = interaction.options.getInteger("page") || 1;
    const showAll = interaction.options.getBoolean("show-all") || false;
    const limit = 10;

    // Get all schedules for this guild
    const [oneTimeSchedules, recurringSchedules] = await Promise.all([
      dbManager.scheduledRoles.getByGuild(interaction.guild.id),
      dbManager.recurringSchedules.getByGuild(interaction.guild.id),
    ]);

    // Combine and filter schedules
    const allSchedules = [];

    // Add one-time schedules
    for (const schedule of Object.values(oneTimeSchedules)) {
      if (showAll) {
        // Show all schedules if show-all is true
        allSchedules.push({ ...schedule, type: "one-time" });
      } else {
        // Show only active schedules (not executed and not cancelled)
        if (!schedule.executed && !schedule.cancelled) {
          allSchedules.push({ ...schedule, type: "one-time" });
        }
      }
    }

    // Add recurring schedules
    for (const schedule of Object.values(recurringSchedules)) {
      if (showAll) {
        // Show all schedules if show-all is true
        allSchedules.push({ ...schedule, type: "recurring" });
      } else {
        // Show only active schedules (active and not cancelled)
        if (schedule.active && !schedule.cancelled) {
          allSchedules.push({ ...schedule, type: "recurring" });
        }
      }
    }

    // Sort by creation date (newest first)
    allSchedules.sort((a, b) => {
      const aDate = new Date(a.createdAt);
      const bDate = new Date(b.createdAt);
      return bDate - aDate;
    });

    // Paginate
    const totalPages = Math.ceil(allSchedules.length / limit);
    const currentPage = Math.max(1, Math.min(page, totalPages || 1));
    const skip = (currentPage - 1) * limit;
    const paginatedSchedules = allSchedules.slice(skip, skip + limit);

    if (paginatedSchedules.length === 0) {
      const response = infoEmbed({
        title: "No Scheduled Roles",
        description: "No active scheduled roles found in this server.",
        solution: "Use `/schedule-role create` to create a new schedule.",
      });

      if (deferred) {
        return interaction.editReply(response);
      } else {
        return interaction.reply({ ...response, flags: 64 });
      }
    }

    // Create list embed
    const embed = createScheduleListEmbed(
      paginatedSchedules,
      interaction.guild,
      currentPage,
      totalPages,
      allSchedules.length,
      client,
      showAll,
    );

    if (deferred) {
      await interaction.editReply({ embeds: [embed] });
    } else {
      await interaction.reply({ embeds: [embed], flags: 64 });
    }

    logger.info(
      `Scheduled roles listed by ${interaction.user.tag} in ${interaction.guild.name}: ${paginatedSchedules.length} schedules on page ${currentPage}`,
    );
  } catch (error) {
    logger.error("Error in handleList:", error);

    if (!interaction.replied && !interaction.deferred) {
      const response = errorEmbed({
        title: "Error",
        description: "Failed to list scheduled roles.",
        solution: "Please try again or contact support.",
      });

      try {
        await interaction.reply({ ...response, flags: 64 });
      } catch (replyError) {
        logger.error("Failed to send error response", {
          interactionId: interaction.id,
          error: replyError.message,
        });
      }
    }
  }
}

/**
 * Handle the view schedule logic
 */
export async function handleView(interaction, client, deferred = false) {
  const logger = getLogger();

  try {
    const scheduleId = interaction.options.getString("schedule-id");

    const dbManager = await getDatabaseManager();
    if (!dbManager) {
      const response = errorEmbed({
        title: "Database Error",
        description: "Failed to connect to the database.",
        solution: "Please try again or contact support if the issue persists.",
      });

      if (deferred) {
        return interaction.editReply(response);
      } else {
        return interaction.reply(response);
      }
    }

    // Try to find in both collections
    const [oneTimeSchedule, recurringSchedule] = await Promise.all([
      dbManager.scheduledRoles.getById(scheduleId),
      dbManager.recurringSchedules.getById(scheduleId),
    ]);

    const schedule = oneTimeSchedule || recurringSchedule;

    if (!schedule) {
      const response = errorEmbed({
        title: "Schedule Not Found",
        description: `No schedule found with ID: **${scheduleId}**`,
        solution:
          "Make sure you're using the correct schedule ID. Use `/schedule-role list` to see all schedules.",
      });

      if (deferred) {
        return interaction.editReply(response);
      } else {
        return interaction.reply(response);
      }
    }

    // Check if schedule belongs to this guild
    if (schedule.guildId !== interaction.guild.id) {
      const response = errorEmbed({
        title: "Access Denied",
        description: "This schedule belongs to a different server.",
        solution: "Use `/schedule-role list` to see schedules for this server.",
      });

      if (deferred) {
        return interaction.editReply(response);
      } else {
        return interaction.reply(response);
      }
    }

    // Determine schedule type
    const scheduleType =
      schedule.scheduleType ||
      (schedule.active !== undefined ? "recurring" : "one-time");

    // Create view embed
    const embed = createScheduleViewEmbed(
      schedule,
      scheduleType,
      interaction.guild,
      client,
    );

    if (deferred) {
      await interaction.editReply({ embeds: [embed] });
    } else {
      await interaction.reply({ embeds: [embed], flags: 64 });
    }

    logger.info(
      `Scheduled role viewed by ${interaction.user.tag} in ${interaction.guild.name}: Schedule ID ${scheduleId}`,
    );
  } catch (error) {
    logger.error("Error in handleView:", error);

    if (!interaction.replied && !interaction.deferred) {
      const response = errorEmbed({
        title: "Error",
        description: "Failed to view scheduled role.",
        solution: "Please try again or contact support.",
      });

      try {
        await interaction.reply({ ...response, flags: 64 });
      } catch (replyError) {
        logger.error("Failed to send error response", {
          interactionId: interaction.id,
          error: replyError.message,
        });
      }
    }
  }
}

/**
 * Handle the cancel schedule logic
 */
export async function handleCancel(interaction, client, deferred = false) {
  const logger = getLogger();

  try {
    const scheduleId = interaction.options.getString("schedule-id");

    const dbManager = await getDatabaseManager();
    if (!dbManager) {
      const response = errorEmbed({
        title: "Database Error",
        description: "Failed to connect to the database.",
        solution: "Please try again or contact support if the issue persists.",
      });

      if (deferred) {
        return interaction.editReply(response);
      } else {
        return interaction.reply(response);
      }
    }

    // Try to find in both collections
    const [oneTimeSchedule, recurringSchedule] = await Promise.all([
      dbManager.scheduledRoles.getById(scheduleId),
      dbManager.recurringSchedules.getById(scheduleId),
    ]);

    const schedule = oneTimeSchedule || recurringSchedule;

    if (!schedule) {
      const response = errorEmbed({
        title: "Schedule Not Found",
        description: `No schedule found with ID: **${scheduleId}**`,
        solution:
          "Make sure you're using the correct schedule ID. Use `/schedule-role list` to see all schedules.",
      });

      if (deferred) {
        return interaction.editReply(response);
      } else {
        return interaction.reply(response);
      }
    }

    // Check if schedule belongs to this guild
    if (schedule.guildId !== interaction.guild.id) {
      const response = errorEmbed({
        title: "Access Denied",
        description: "This schedule belongs to a different server.",
        solution: "Use `/schedule-role list` to see schedules for this server.",
      });

      if (deferred) {
        return interaction.editReply(response);
      } else {
        return interaction.reply(response);
      }
    }

    // Check if already cancelled or executed
    if (schedule.cancelled) {
      const response = errorEmbed({
        title: "Already Cancelled",
        description: "This schedule has already been cancelled.",
        solution: "Use `/schedule-role list` to see active schedules.",
      });

      if (deferred) {
        return interaction.editReply(response);
      } else {
        return interaction.reply(response);
      }
    }

    if (schedule.executed) {
      const response = errorEmbed({
        title: "Already Executed",
        description:
          "This schedule has already been executed and cannot be cancelled.",
        solution: "Use `/schedule-role list` to see active schedules.",
      });

      if (deferred) {
        return interaction.editReply(response);
      } else {
        return interaction.reply(response);
      }
    }

    // Cancel the schedule
    const cancelled = oneTimeSchedule
      ? await dbManager.scheduledRoles.cancel(scheduleId)
      : await dbManager.recurringSchedules.cancel(scheduleId);

    if (!cancelled) {
      throw new Error("Failed to cancel schedule in database");
    }

    const response = successEmbed({
      title: "Schedule Cancelled",
      description: `Successfully cancelled schedule **${scheduleId}**.`,
    });

    if (deferred) {
      await interaction.editReply(response);
    } else {
      await interaction.reply(response);
    }

    logger.info(
      `Scheduled role cancelled by ${interaction.user.tag} in ${interaction.guild.name}: Schedule ID ${scheduleId}`,
    );
  } catch (error) {
    logger.error("Error in handleCancel:", error);

    if (!interaction.replied && !interaction.deferred) {
      const response = errorEmbed({
        title: "Error",
        description: "Failed to cancel scheduled role.",
        solution: "Please try again or contact support.",
      });

      try {
        await interaction.reply({ ...response, flags: 64 });
      } catch (replyError) {
        logger.error("Failed to send error response", {
          interactionId: interaction.id,
          error: replyError.message,
        });
      }
    }
  }
}

/**
 * Handle the delete schedule logic
 */
export async function handleDelete(interaction, client, deferred = false) {
  const logger = getLogger();

  try {
    const scheduleId = interaction.options.getString("schedule-id");

    const dbManager = await getDatabaseManager();
    if (!dbManager) {
      const response = errorEmbed({
        title: "Database Error",
        description: "Failed to connect to the database.",
        solution: "Please try again or contact support if the issue persists.",
      });

      if (deferred) {
        return interaction.editReply(response);
      } else {
        return interaction.reply(response);
      }
    }

    // Try to find in both collections
    const [oneTimeSchedule, recurringSchedule] = await Promise.all([
      dbManager.scheduledRoles.getById(scheduleId),
      dbManager.recurringSchedules.getById(scheduleId),
    ]);

    const schedule = oneTimeSchedule || recurringSchedule;

    if (!schedule) {
      const response = errorEmbed({
        title: "Schedule Not Found",
        description: `No schedule found with ID: **${scheduleId}**`,
        solution:
          "Make sure you're using the correct schedule ID. Use `/schedule-role list` to see all schedules.",
      });

      if (deferred) {
        return interaction.editReply(response);
      } else {
        return interaction.reply(response);
      }
    }

    // Check if schedule belongs to this guild
    if (schedule.guildId !== interaction.guild.id) {
      const response = errorEmbed({
        title: "Access Denied",
        description: "This schedule belongs to a different server.",
        solution: "Use `/schedule-role list` to see schedules for this server.",
      });

      if (deferred) {
        return interaction.editReply(response);
      } else {
        return interaction.reply(response);
      }
    }

    // Delete the schedule permanently
    const deleted = oneTimeSchedule
      ? await dbManager.scheduledRoles.delete(scheduleId)
      : await dbManager.recurringSchedules.delete(scheduleId);

    if (!deleted) {
      throw new Error("Failed to delete schedule from database");
    }

    const response = successEmbed({
      title: "Schedule Deleted",
      description: `Successfully deleted schedule **${scheduleId}** from the database.`,
    });

    if (deferred) {
      await interaction.editReply(response);
    } else {
      await interaction.reply(response);
    }

    logger.info(
      `Scheduled role deleted by ${interaction.user.tag} in ${interaction.guild.name}: Schedule ID ${scheduleId}`,
    );
  } catch (error) {
    logger.error("Error in handleDelete:", error);

    if (!interaction.replied && !interaction.deferred) {
      const response = errorEmbed({
        title: "Error",
        description: "Failed to delete scheduled role.",
        solution: "Please try again or contact support.",
      });

      try {
        await interaction.reply({ ...response, flags: 64 });
      } catch (replyError) {
        logger.error("Failed to send error response", {
          interactionId: interaction.id,
          error: replyError.message,
        });
      }
    }
  }
}
