import pLimit from "p-limit";
import { getLogger } from "../../../utils/logger.js";
import {
  botHasRequiredPermissions,
  getMissingBotPermissions,
  formatPermissionName,
} from "../../../utils/discord/permissions.js";
import {
  errorEmbed,
  roleCreatedEmbed,
} from "../../../utils/discord/responseMessages.js";
import { processRoles, setRoleMapping, getRoleMapping } from "./utils.js";
import { getStorageManager } from "../../../utils/storage/storageManager.js";
import {
  createSetupRolesEmbed,
  createListRolesEmbed,
  createUpdatedRolesEmbed,
  createPaginationButtons,
} from "./embeds.js";
import { THEME_COLOR } from "../../../config/theme.js";

// Track active setups to prevent duplicates
const activeSetups = new Set();
const activeLists = new Set();

export async function handleSetup(interaction, client) {
  const logger = getLogger();

  logger.debug("Starting role-reaction setup", {
    interactionId: interaction.id,
    user: interaction.user.username,
    channel: interaction.channel.name,
  });

  // Prevent duplicate executions
  if (activeSetups.has(interaction.id)) {
    logger.warn("Setup already in progress for this interaction, skipping");
    return;
  }
  activeSetups.add(interaction.id);

  // Check if interaction has already been acknowledged
  if (interaction.replied || interaction.deferred) {
    logger.warn("Interaction already acknowledged, skipping setup");
    return;
  }

  // Check if interaction is still valid (not expired - Discord has 3 second timeout)
  const interactionAge = Date.now() - interaction.createdTimestamp;
  logger.debug("Interaction age check", { age: interactionAge });
  if (interactionAge > 3000) {
    logger.warn("Interaction has expired, skipping setup");
    return;
  }
  logger.debug("Interaction is still valid, proceeding");

  try {
    await interaction.deferReply({ flags: 64 });
    logger.debug("Successfully deferred reply");
  } catch (error) {
    logger.error("Failed to defer reply", { error: error.message });
    logger.warn("Interaction expired or invalid, aborting setup");
    activeSetups.delete(interaction.id);
    return;
  }

  logger.debug("Starting permission checks after successful deferReply");

  // Check if bot member is available (required for permission checks)
  if (!interaction.guild.members.me) {
    activeSetups.delete(interaction.id);
    return interaction.editReply(
      errorEmbed({
        title: "Bot Permission Error",
        description: "I cannot access my member information in this server.",
        solution:
          "Please make sure I have the necessary permissions and try again.",
        fields: [
          {
            name: "🔧 How to Fix",
            value:
              "1. Go to **Server Settings** → **Roles**\n2. Make sure my role (Role Reactor) exists\n3. Grant me basic permissions like **View Channels**\n4. Try the command again",
            inline: false,
          },
        ],
      }),
    );
  }

  // Check guild-level permissions first (required for channel permission checks)
  const guildHasPermissions = botHasRequiredPermissions(interaction.guild);
  logger.debug("Guild permissions check", {
    hasAllPermissions: guildHasPermissions,
    guildId: interaction.guild.id,
    guildName: interaction.guild.name,
  });

  if (!guildHasPermissions) {
    const missingPermissions = getMissingBotPermissions(interaction.guild);
    const permissionNames = missingPermissions
      .map(formatPermissionName)
      .join(", ");

    logger.warn("Missing guild permissions", { permissions: permissionNames });
    activeSetups.delete(interaction.id);
    return interaction.editReply(
      errorEmbed({
        title: "Missing Bot Permissions",
        description: `I need the following server-level permissions: **${permissionNames}**`,
        solution:
          "Please ask a server administrator to grant me these permissions and try again.",
        fields: [
          {
            name: "🔧 How to Fix (Server Level)",
            value:
              "1. Go to **Server Settings** → **Roles**\n2. Find my role (Role Reactor)\n3. Enable the missing permissions listed above\n4. Make sure my role is positioned above the roles you want to assign",
            inline: false,
          },
          {
            name: "📋 Required Server Permissions",
            value:
              "• **Manage Roles** - To assign/remove roles from users\n• **Manage Messages** - To manage role-reaction messages\n• **Add Reactions** - To add emoji reactions to messages\n• **Read Message History** - To read channel history\n• **View Channel** - To access channel information\n• **Send Messages** - To send role-reaction messages\n• **Embed Links** - To create rich embeds\n• **Manage Server** - To manage server settings\n• **Use External Emojis** - To use emojis from other servers",
            inline: false,
          },
        ],
      }),
    );
  }

  // Now check channel-specific permissions (more specific errors)
  logger.debug("Checking channel permissions");
  const channelPermissions = interaction.channel.permissionsFor(
    interaction.guild.members.me,
  );

  logger.debug("Channel permissions check", {
    hasSendMessages: channelPermissions.has("SendMessages"),
    hasEmbedLinks: channelPermissions.has("EmbedLinks"),
    hasAddReactions: channelPermissions.has("AddReactions"),
    channelId: interaction.channel.id,
    channelName: interaction.channel.name,
  });

  // Check for missing channel permissions
  const missingChannelPermissions = [];
  if (!channelPermissions.has("SendMessages")) {
    missingChannelPermissions.push("Send Messages");
  }
  if (!channelPermissions.has("EmbedLinks")) {
    missingChannelPermissions.push("Embed Links");
  }
  if (!channelPermissions.has("AddReactions")) {
    missingChannelPermissions.push("Add Reactions");
    logger.warn(
      "Missing AddReactions permission - this will prevent role-reaction setup",
    );
    logger.warn("AddReactions permission check: FAILED");
  } else {
    logger.debug("AddReactions permission check: PASSED");
  }

  if (missingChannelPermissions.length > 0) {
    logger.warn("Missing channel permissions", {
      permissions: missingChannelPermissions,
    });
    logger.warn("BLOCKING role-reaction setup due to missing permissions");

    // Special handling for Add Reactions permission
    if (missingChannelPermissions.includes("Add Reactions")) {
      logger.warn("BLOCKING setup due to missing Add Reactions permission");
      activeSetups.delete(interaction.id);
      return interaction.editReply(
        errorEmbed({
          title: "Cannot Setup Role Reactions",
          description:
            "I don't have the **Add Reactions** permission in this channel, which is required to create role-reaction messages.",
          solution:
            "Please grant me the **Add Reactions** permission in this channel and try again.",
          fields: [
            {
              name: "🔧 How to Fix (Channel Level)",
              value:
                "1. Right-click on this channel → **Edit Channel**\n2. Go to **Permissions** tab\n3. Find my role (Role Reactor) or @everyone\n4. Enable **Add Reactions** permission\n5. Make sure no other role is denying this permission",
              inline: false,
            },
            {
              name: "📋 Why This Permission is Critical",
              value:
                "• **Add Reactions** - Required to add emoji reactions to role-reaction messages\n• Without this permission, role-reaction messages are useless\n• Users won't be able to click reactions to get/remove roles",
              inline: false,
            },
          ],
        }),
      );
    }

    activeSetups.delete(interaction.id);
    return interaction.editReply(
      errorEmbed({
        title: "Missing Channel Permissions",
        description: `I don't have permission to **${missingChannelPermissions.join("** and **")}** in this channel.`,
        solution:
          "Please grant me the missing permissions in this channel and try again.",
        fields: [
          {
            name: "🔧 How to Fix (Channel Level)",
            value:
              "1. Right-click on this channel → **Edit Channel**\n2. Go to **Permissions** tab\n3. Find my role (Role Reactor) or @everyone\n4. Enable the missing permissions listed above\n5. Make sure no other role is denying these permissions",
            inline: false,
          },
          {
            name: "📋 Missing Channel Permissions",
            value: missingChannelPermissions
              .map(
                perm => `• **${perm}** - Required for role-reaction messages`,
              )
              .join("\n"),
            inline: false,
          },
        ],
      }),
    );
  }

  logger.debug(
    "All channel permissions check passed, proceeding with message creation",
  );

  logger.debug("Starting message creation process");
  logger.warn(
    "This should not be reached if AddReactions permission is missing!",
  );
  const title = interaction.options.getString("title");
  const description = interaction.options.getString("description");
  const rolesString = interaction.options.getString("roles");
  let colorHex = interaction.options.getString("color");

  // Color
  let color = THEME_COLOR;
  if (colorHex) {
    if (!colorHex.startsWith("#")) colorHex = `#${colorHex}`;
    color = colorHex;
  }

  // Roles processing via shared util
  const roleProcessingResult = await processRoles(interaction, rolesString);
  if (!roleProcessingResult.success) {
    return interaction.editReply(
      errorEmbed({
        title: "Role Processing Error",
        description:
          roleProcessingResult.errors?.join("\n") || roleProcessingResult.error,
        solution: "Please check your role format and try again.",
      }),
    );
  }

  const { validRoles, roleMapping } = roleProcessingResult;
  const embed = createSetupRolesEmbed(
    title,
    description,
    color,
    validRoles,
    client,
  );

  logger.debug("Attempting to send role-reaction message to channel");
  logger.warn("This should only happen if AddReactions permission is present!");

  // Double-check permissions before creating message
  const finalPermissionCheck = interaction.channel.permissionsFor(
    interaction.guild.members.me,
  );
  logger.debug("Final permission check before message creation", {
    hasAddReactions: finalPermissionCheck.has("AddReactions"),
    hasSendMessages: finalPermissionCheck.has("SendMessages"),
    hasEmbedLinks: finalPermissionCheck.has("EmbedLinks"),
  });

  if (!finalPermissionCheck.has("AddReactions")) {
    logger.error(
      "CRITICAL ERROR: AddReactions permission missing at message creation time!",
    );
    activeSetups.delete(interaction.id);
    return interaction.editReply(
      errorEmbed({
        title: "Permission Error",
        description: "Add Reactions permission was lost during setup process.",
        solution: "Please grant me the Add Reactions permission and try again.",
      }),
    );
  }

  let message;
  try {
    message = await interaction.channel.send({ embeds: [embed] });
    logger.debug("Successfully sent role-reaction message", {
      messageId: message.id,
    });
    logger.warn("Message created despite potential permission issues!");
  } catch (error) {
    logger.error("Failed to send role-reaction message", {
      error: error.message,
    });
    return interaction.editReply(
      errorEmbed({
        title: "Failed to Send Message",
        description: `Unable to send the role-reaction message to this channel: ${error.message}`,
        solution: "Please check my permissions in this channel and try again.",
        fields: [
          {
            name: "🔧 Required Permissions",
            value:
              "• **Send Messages** - To send the role-reaction message\n• **Embed Links** - To create rich embeds\n• **Add Reactions** - To add emoji reactions",
            inline: false,
          },
        ],
      }),
    );
  }

  // Add reactions to the message
  const limiter = pLimit(3);
  const reactionResults = await Promise.allSettled(
    validRoles.map(role =>
      limiter(async () => {
        try {
          await message.react(role.emoji);
          logger.debug(`Added reaction ${role.emoji} for role ${role.name}`);
          return { success: true, role: role.name, emoji: role.emoji };
        } catch (error) {
          logger.warn(
            `Failed to add reaction ${role.emoji} for role ${role.name}`,
            {
              error: error.message,
            },
          );
          return {
            success: false,
            role: role.name,
            emoji: role.emoji,
            error: error.message,
          };
        }
      }),
    ),
  );

  // Check if any reactions failed
  const failedReactions = reactionResults
    .filter(result => result.status === "fulfilled" && !result.value.success)
    .map(result => result.value);

  if (failedReactions.length > 0) {
    logger.warn(`Failed to add ${failedReactions.length} reactions`, {
      failedReactions,
    });

    // If all reactions failed, it's likely a permission issue
    if (failedReactions.length === validRoles.length) {
      return interaction.editReply(
        errorEmbed({
          title: "Failed to Add Reactions",
          description:
            "I couldn't add any emoji reactions to the message. This usually means I don't have the **Add Reactions** permission in this channel.",
          solution:
            "Please grant me the **Add Reactions** permission in this channel and try again.",
          fields: [
            {
              name: "🔧 How to Fix",
              value:
                "1. Right-click on this channel → **Edit Channel**\n2. Go to **Permissions** tab\n3. Find my role (Role Reactor) or @everyone\n4. Enable **Add Reactions** permission\n5. Make sure no other role is denying this permission",
              inline: false,
            },
          ],
        }),
      );
    }
  }

  await setRoleMapping(
    message.id,
    interaction.guild.id,
    interaction.channel.id,
    roleMapping,
  );

  await interaction.editReply(
    roleCreatedEmbed({
      messageUrl: message.url,
      roleCount: validRoles.length,
      channelId: interaction.channel.id,
    }),
  );

  // Cleanup
  activeSetups.delete(interaction.id);
  logger.debug("Role-reaction setup completed successfully");
}

export async function handleList(
  interaction,
  client,
  page = 1,
  isButtonUpdate = false,
) {
  const logger = getLogger();

  // Prevent duplicate executions for non-button updates
  if (!isButtonUpdate) {
    if (activeLists.has(interaction.id)) {
      logger.warn("List already in progress for this interaction, skipping");
      return;
    }
    activeLists.add(interaction.id);
  }

  // Check if interaction has already been acknowledged (skip for button updates)
  if (!isButtonUpdate && (interaction.replied || interaction.deferred)) {
    logger.warn("Interaction already acknowledged, skipping list");
    if (!isButtonUpdate) activeLists.delete(interaction.id);
    return;
  }

  // Handle deferral based on interaction type
  if (isButtonUpdate) {
    // For button updates, defer the update
    try {
      await interaction.deferUpdate();
      logger.debug("Successfully deferred pagination update");
    } catch (error) {
      logger.error("Failed to defer pagination update", {
        error: error.message,
      });
      return;
    }
  } else {
    // For regular commands, defer the reply immediately
    try {
      logger.debug("Attempting to defer reply");
      logger.debug("Interaction state before defer", {
        replied: interaction.replied,
        deferred: interaction.deferred,
        age: Date.now() - interaction.createdTimestamp,
      });

      // Add timeout to deferReply to prevent hanging
      const deferPromise = interaction.deferReply({ flags: 64 });
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("DeferReply timeout")), 2000);
      });

      await Promise.race([deferPromise, timeoutPromise]);
      logger.debug("Successfully deferred reply");
    } catch (error) {
      logger.error("Failed to defer reply", { error: error.message });
      logger.debug("Interaction state on error", {
        replied: interaction.replied,
        deferred: interaction.deferred,
        age: Date.now() - interaction.createdTimestamp,
      });

      // Check if it's a timeout or unknown interaction error
      if (
        error.message.includes("timeout") ||
        error.message.includes("Unknown interaction")
      ) {
        logger.warn("Interaction expired or timed out, cannot respond");
        activeLists.delete(interaction.id);
        return;
      }

      activeLists.delete(interaction.id);
      return;
    }
  }

  // Check if interaction is still valid (not expired - Discord has 3 second timeout)
  const interactionAge = Date.now() - interaction.createdTimestamp;
  logger.debug("Interaction age check", { age: interactionAge });
  if (interactionAge > 2500) {
    // Use 2.5s instead of 3s to be safe
    logger.warn("Interaction has expired, skipping list");
    if (!isButtonUpdate) activeLists.delete(interaction.id);
    return;
  }

  // Use paginated query instead of fetching all data
  const itemsPerPage = 4;
  logger.debug("Getting storage manager");
  const startTime = Date.now();
  const storageManager = await getStorageManager();
  const storageTime = Date.now() - startTime;
  logger.debug(
    `Storage manager obtained in ${storageTime}ms, getting paginated results`,
  );
  const queryStartTime = Date.now();
  const paginatedResult = await storageManager.getRoleMappingsPaginated(
    interaction.guild.id,
    page,
    itemsPerPage,
  );
  const queryTime = Date.now() - queryStartTime;
  logger.debug(`Paginated results obtained in ${queryTime}ms`);

  const { mappings: guildMappings, pagination } = paginatedResult;

  if (pagination.totalItems === 0) {
    if (!isButtonUpdate) activeLists.delete(interaction.id);
    return interaction.editReply(
      errorEmbed({
        title: "No Role-Reaction Messages Found",
        description:
          "There are no role-reaction messages set up in this server yet.",
        solution:
          "Use `role-reactions setup` to create your first role-reaction message!",
      }),
    );
  }

  // Validate page number
  const validPage = Math.max(1, Math.min(page, pagination.totalPages));

  // Convert mappings object to array format for createListRolesEmbed
  const guildMappingsArray = Object.entries(guildMappings);

  const {
    embed,
    totalPages: calculatedTotalPages,
    currentPage,
  } = createListRolesEmbed(
    guildMappingsArray,
    client,
    validPage,
    itemsPerPage,
    pagination,
  );

  // Only add pagination buttons if there are multiple pages
  const components =
    calculatedTotalPages > 1
      ? createPaginationButtons(currentPage, calculatedTotalPages)
      : [];

  await interaction.editReply({
    embeds: [embed],
    components,
    flags: 64,
  });

  // Cleanup
  if (!isButtonUpdate) {
    activeLists.delete(interaction.id);
    logger.debug("Role-reaction list completed successfully");
  }
}

export async function handleDelete(interaction) {
  const logger = getLogger();

  logger.debug("Starting role-reaction deletion", {
    interactionId: interaction.id,
    user: interaction.user.username,
    guild: interaction.guild.name,
  });

  // Check if interaction has already been acknowledged
  if (interaction.replied || interaction.deferred) {
    logger.warn("Interaction already acknowledged, skipping delete");
    return;
  }

  // Check if interaction is still valid (not expired - Discord has 3 second timeout)
  const interactionAge = Date.now() - interaction.createdTimestamp;
  if (interactionAge > 3000) {
    logger.warn("Interaction has expired, skipping delete");
    return;
  }

  try {
    await interaction.deferReply({ flags: 64 });
    logger.debug("Successfully deferred delete reply");
  } catch (error) {
    logger.error("Failed to defer reply", { error: error.message });
    return;
  }

  const messageId = interaction.options.getString("message_id");
  logger.debug("Looking for message ID", {
    messageId,
    guildId: interaction.guild.id,
  });

  const mapping = await getRoleMapping(messageId, interaction.guild.id);
  logger.debug("Mapping found", { mapping });

  if (!mapping) {
    logger.warn("No mapping found for message ID", { messageId });

    // Let's also try to get all mappings to see what's available
    const storageManager = await getStorageManager();
    const allMappings = await storageManager.getRoleMappings();
    const guildMappings = Object.entries(allMappings).filter(
      ([, m]) => m.guildId === interaction.guild.id,
    );
    logger.debug("All mappings in this guild", {
      guildMappings: guildMappings.map(([id, m]) => ({
        messageId: id,
        guildId: m.guildId,
      })),
    });

    return interaction.editReply(
      errorEmbed({
        title: "Message Not Found",
        description:
          "I couldn't find a role-reaction message with that ID in this server.",
      }),
    );
  }
  let msg = null;
  const channel = interaction.guild.channels.cache.get(mapping.channelId);
  if (channel) {
    msg = await channel.messages.fetch(messageId).catch(() => null);
  }
  const { removeRoleMapping } = await import(
    "../../../utils/discord/roleMappingManager.js"
  );
  await removeRoleMapping(messageId, interaction.guild.id);
  if (msg) await msg.delete().catch(() => null);
  const { roleDeletedEmbed } = await import(
    "../../../utils/discord/responseMessages.js"
  );
  await interaction.editReply(
    roleDeletedEmbed({
      messageId,
      rolesRemoved: Object.keys(mapping.roles || {}).length,
      messageDeleted: !!msg,
    }),
  );
}

export async function handleUpdate(interaction) {
  const logger = getLogger();

  // Check if interaction has already been acknowledged
  if (interaction.replied || interaction.deferred) {
    logger.warn("Interaction already acknowledged, skipping update");
    return;
  }

  // Check if interaction is still valid (not expired - Discord has 3 second timeout)
  const interactionAge = Date.now() - interaction.createdTimestamp;
  if (interactionAge > 3000) {
    logger.warn("Interaction has expired, skipping update");
    return;
  }

  try {
    await interaction.deferReply({ flags: 64 });
  } catch (error) {
    logger.error("Failed to defer reply", { error: error.message });
    return;
  }
  const messageId = interaction.options.getString("message_id");
  const title = interaction.options.getString("title");
  const description = interaction.options.getString("description");
  const rolesString = interaction.options.getString("roles");
  const colorHex = interaction.options.getString("color");

  const mapping = await getRoleMapping(messageId, interaction.guild.id);
  if (!mapping) {
    return interaction.editReply(
      errorEmbed({
        title: "Message Not Found",
        description:
          "I couldn't find a role-reaction message with that ID in this server.",
      }),
    );
  }

  const updates = {};
  if (title) updates.title = title;
  if (description) updates.description = description;

  let roleMapping = mapping.roles;
  if (rolesString) {
    const result = await processRoles(rolesString, interaction.guild);
    if (!result.success) {
      return interaction.editReply(
        errorEmbed({
          title: "Role Processing Error",
          description: result.error || "Failed to process roles.",
        }),
      );
    }
    roleMapping = result.roleMapping;
    updates.roles = roleMapping;
  }

  if (colorHex) {
    const hex = colorHex.startsWith("#") ? colorHex : `#${colorHex}`;
    if (!/^#[0-9A-F]{6}$/i.test(hex)) {
      return interaction.editReply(
        errorEmbed({
          title: "Invalid Color Format",
          description: "Provide a valid 6-digit hex color.",
        }),
      );
    }
    updates.color = hex;
  }

  const updatedMapping = { ...mapping, ...updates };
  const channel = await interaction.guild.channels.fetch(mapping.channelId);
  const message = await channel.messages.fetch(messageId);
  const embed = createUpdatedRolesEmbed(
    updatedMapping,
    roleMapping,
    interaction.client,
  );
  await message.edit({ embeds: [embed] });

  const { setRoleMapping: setMap } = await import(
    "../../../utils/discord/roleMappingManager.js"
  );
  await setMap(
    messageId,
    updatedMapping.guildId,
    updatedMapping.channelId,
    roleMapping,
  );

  const { roleUpdatedEmbed } = await import(
    "../../../utils/discord/responseMessages.js"
  );
  await interaction.editReply(
    roleUpdatedEmbed({
      messageId,
      updates: Object.keys(updates).join(", "),
      changeCount: Object.keys(updates).length,
    }),
  );
}

// Handle pagination button interactions
export async function handlePagination(interaction, client) {
  const logger = getLogger();

  logger.debug("Pagination button clicked", { customId: interaction.customId });

  const customId = interaction.customId;

  // Parse the custom ID to get the action and page number
  const parts = customId.split("_");

  if (parts.length !== 3) {
    logger.warn("Invalid pagination custom ID format", {
      customId,
      parts,
    });
    return;
  }

  const action = parts[1]; // 'prev' or 'next'
  const pageStr = parts[2];
  const page = parseInt(pageStr, 10);

  logger.debug("Debug parsing", {
    customId,
    parts,
    action,
    pageStr,
    page,
    isNaN: isNaN(page),
  });

  if (isNaN(page) || page < 1) {
    logger.warn("Invalid page number", { page, pageStr });
    return;
  }

  logger.debug(`Pagination button clicked: ${action} to page ${page}`);

  // Call handleList with the new page number and button update flag
  try {
    logger.debug("Calling handleList for pagination update");
    await handleList(interaction, client, page, true);
    logger.debug("Pagination update completed successfully");
  } catch (error) {
    logger.error("Error in pagination update", {
      error: error.message,
      stack: error.stack,
    });
  }
}
