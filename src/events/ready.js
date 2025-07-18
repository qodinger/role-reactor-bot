import { ActivityType } from "discord.js";
import { getLogger } from "../utils/logger.js";
import { createWelcomeBox, createInfoBox } from "../utils/terminal.js";

export const name = "ready";
export const once = true;

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
    const inviteLink = client.generateInvite({
      permissions: [
        "ManageRoles",
        "ManageMessages",
        "AddReactions",
        "ReadMessageHistory",
        "ViewChannel",
      ],
      scopes: ["bot"],
    });

    // Create invite link section
    const inviteSection = [
      `🔗 Bot Invite Link:`,
      inviteLink,
      "",
      `📋 Required Permissions:`,
      `   • Manage Roles`,
      `   • Manage Messages`,
      `   • Add Reactions`,
      `   • Read Message History`,
      `   • View Channel`,
    ];

    const inviteBox = createInfoBox("🔗 Invitation Details", inviteSection, {
      borderColor: "green",
    });
    console.log("");
    console.log(inviteBox);
    console.log("");
  } catch (error) {
    logger.error("Error generating invite link", error);
  }

  // Log success message
  const successMessage = "✅ Bot is ready to handle role reactions!";
  logger.success(successMessage);
  logger.info(""); // Empty line for readability
}
