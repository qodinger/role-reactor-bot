import { ActivityType } from "discord.js";
import { getLogger } from "../utils/logger.js";
import boxen from "boxen";
import gradient from "gradient-string";
import {
  getDefaultInviteLink,
  DEFAULT_INVITE_PERMISSIONS,
  getInvitePermissionName,
} from "../utils/discord/invite.js";

export const name = "ready";
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
  console.log("");
  console.log(titleBox);

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
  console.log("");
  console.log(statsBox);

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
    console.log("");
    console.log(inviteBox);
    console.log("");
  } catch (error) {
    logger.error("Failed to generate invite link:", error);
    console.log(
      "Failed to generate invite link. Please check your bot token and permissions.",
    );
  }
}
