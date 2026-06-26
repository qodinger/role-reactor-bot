import { ActivityType } from "discord.js";
import { getLogger } from "../utils/logger.js";
import boxen from "boxen";
import gradient from "gradient-string";
import {
  getDefaultInviteLink,
  DEFAULT_INVITE_PERMISSIONS,
  getInvitePermissionName,
} from "../utils/discord/invite.js";

export const name = "clientReady";
export const once = true;

function createWelcomeBox(titleText, gradientType) {
  const content =
    gradientType && gradient[gradientType]
      ? gradient[gradientType](titleText)
      : titleText;
  return boxen(content, {
    padding: 1,
    margin: 0,
    borderStyle: "round",
    borderColor: "cyan",
    title: "Role Reactor",
    titleAlignment: "center",
  });
}

function createInfoBox(title, content, options = {}) {
  const defaultOptions = {
    title,
    titleAlignment: "center",
    padding: 1,
    margin: 0,
    borderStyle: "round",
    borderColor: "cyan",
  };

  const boxOptions = { ...defaultOptions, ...options };
  const contentText = Array.isArray(content) ? content.join("\n") : content;

  return boxen(contentText, boxOptions);
}

export async function execute(client) {
  const logger = getLogger();

  // Log bot startup
  const titleText = `🤖 Role Reactor Bot 🤖`;
  const titleBox = createWelcomeBox(titleText, "cristal");
  logger.info(`\n${titleBox}`);

  // Set bot activity
  client.user.setActivity("role reactions", {
    type: ActivityType.Watching,
  });

  // Log bot statistics
  const stats = {
    botName: client.user.tag,
    botId: client.user.id,
    servers: client.guilds.cache.size,
    users: client.users.cache.size,
    startTime: new Date().toLocaleString(),
    memoryUsage: (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2),
  };

  // Record daily guild count snapshot
  try {
    const { getDatabaseManager } = await import(
      "../utils/storage/databaseManager.js"
    );
    const dbManager = await getDatabaseManager();
    if (dbManager?.guildCount) {
      let totalUsers = 0;
      for (const guild of client.guilds.cache.values()) {
        totalUsers += guild.approximateMemberCount || guild.memberCount || 0;
      }
      await dbManager.guildCount.recordSnapshot(
        client.guilds.cache.size,
        totalUsers,
      );
      logger.debug("📊 Daily guild count snapshot recorded");
    }

    // Seed guild history for all current guilds
    if (dbManager?.guildHistory) {
      const seeded = await dbManager.guildHistory.seedFromClient(client);
      if (seeded > 0) {
        logger.info(`📝 Seeded ${seeded} guilds into guild history`);
      }
    }
  } catch (error) {
    logger.debug("Failed to record guild count snapshot:", error.message);
  }

  // Format stats for alignment
  const statLines = [
    `🟢 Status:        ONLINE`,
    `🤖 Bot Name:     ${stats.botName}`,
    `🆔 Bot ID:       ${stats.botId}`,
    `🌐 Servers:      ${stats.servers}`,
    `👥 Total Users:  ${stats.users}`,
    `⏰ Started at:   ${stats.startTime}`,
    `💾 Memory Usage: ${stats.memoryUsage} MB`,
  ];
  const statsBox = createInfoBox("📊 Bot Status", statLines, {
    borderColor: "cyan",
  });
  logger.info(`\n${statsBox}`);

  // Generate invite link
  try {
    const inviteLink = await getDefaultInviteLink(client);
    client.inviteLink = inviteLink;

    // Create invite link section
    const permissionNames = DEFAULT_INVITE_PERMISSIONS.map(
      bit => `   • ${getInvitePermissionName(bit)}`,
    );
    const inviteSection = [
      `🔗 Bot Invite Link:`,
      inviteLink,
      "",
      `📋 Required Permissions:`,
      ...permissionNames,
    ];

    const inviteBox = createInfoBox("🔗 Invitation Details", inviteSection, {
      borderColor: "green",
    });
    logger.info(`\n${inviteBox}\n`);
  } catch (error) {
    logger.error("Failed to generate invite link:", error);
    logger.warn(
      "Failed to generate invite link. Please check your bot token and permissions.",
    );
  }
}
