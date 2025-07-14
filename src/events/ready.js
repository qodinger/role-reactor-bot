import { Events, OAuth2Scopes, ActivityType } from "discord.js";

import {
  requiredPermissions,
  formatPermissionName,
} from "../utils/permissions.js";
import {
  createSpinner,
  createInfoBox,
  createSuccessMessage,
  createWelcomeBox,
} from "../utils/terminal.js";
import { BOT_VERSION } from "../utils/version.js";

export const name = Events.ClientReady;

export const once = true;

export async function execute(client) {
  // Create a beautiful startup spinner
  const spinner = createSpinner("Initializing Role Reactor Bot...");
  spinner.start();

  // Simulate a brief loading time for visual effect
  await new Promise(resolve => {
    setTimeout(resolve, 1500).unref();
  });

  spinner.succeed("Bot initialized successfully!");

  // Welcome section using terminal.js utility
  const titleText = `🤖 Role Reactor Bot v${BOT_VERSION} 🤖`;
  const titleBox = createWelcomeBox(titleText, "cristal");
  console.log(titleBox);

  // Print bot statistics (aligned)
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
  console.log(statsBox);

  // Set bot status
  const activities = [
    { name: "role reactions", type: ActivityType.Watching },
    { name: "/help for commands", type: ActivityType.Playing },
    {
      name: `${client.guilds.cache.size} servers`,
      type: ActivityType.Watching,
    },
  ];

  let activityIndex = 0;

  // Check if setActivity method exists before calling
  if (client.user && typeof client.user.setActivity === "function") {
    client.user.setActivity(activities[activityIndex]);

    // Rotate status every 30 seconds
    setInterval(() => {
      activityIndex = (activityIndex + 1) % activities.length;
      client.user.setActivity(activities[activityIndex]);
    }, 30000).unref();
  }

  // Generate and log OAuth2 invite link with required permissions
  let inviteLink = "";
  if (client && typeof client.generateInvite === "function") {
    try {
      inviteLink = await client.generateInvite({
        scopes: [OAuth2Scopes.Bot, OAuth2Scopes.ApplicationsCommands],
        permissions: requiredPermissions,
      });
    } catch (error) {
      console.error("Error generating invite link", error);
      inviteLink = "Error generating invite link";
    }
  } else {
    inviteLink = "Invite link generation not available";
  }

  // Create invite link section
  const inviteSection = [
    `🔗 Bot Invite Link:`,
    inviteLink,
    "",
    `📋 Required Permissions:`,
    ...requiredPermissions.map(perm => `   • ${formatPermissionName(perm)}`),
  ];

  const inviteBox = createInfoBox("🔗 Invitation Details", inviteSection, {
    borderColor: "green",
  });

  console.log(inviteBox);

  // Final success message
  const successMessage = createSuccessMessage("🚀 Bot is ready to serve!");
  console.log(successMessage);
  console.log("");
}
