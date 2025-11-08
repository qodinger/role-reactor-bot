import { ActivityType } from "discord.js";
import { getLogger } from "../utils/logger.js";
import boxen from "boxen";
import gradient from "gradient-string";
import {
  getDefaultInviteLink,
  DEFAULT_INVITE_PERMISSIONS,
  getInvitePermissionName,
} from "../utils/discord/invite.js";
import { getVoiceOperationQueue } from "../utils/discord/voiceOperationQueue.js";
import {
  checkConnectRestriction,
  checkSpeakRestriction,
} from "../utils/discord/voiceRestrictions.js";

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

  // Verify voice states on startup
  // This fixes the issue where members remain muted after role removal while bot was stopped
  await verifyVoiceStatesOnStartup(client, logger);
}

/**
 * Verify all voice states on startup to fix members who are muted but no longer have restrictive roles
 * This handles the case where roles were removed while the bot was stopped
 * @param {import("discord.js").Client} client - Discord client
 * @param {import("../utils/logger.js").Logger} logger - Logger instance
 */
async function verifyVoiceStatesOnStartup(client, logger) {
  try {
    logger.info("🔍 Verifying voice states on startup...");

    const voiceQueue = getVoiceOperationQueue();
    let totalChecked = 0;
    let totalQueued = 0;

    // Iterate through all guilds
    for (const guild of client.guilds.cache.values()) {
      try {
        // Get all voice channels in the guild
        const voiceChannels = guild.channels.cache.filter(channel =>
          channel.isVoiceBased(),
        );

        if (voiceChannels.size === 0) {
          continue;
        }

        // Check each voice channel
        for (const channel of voiceChannels.values()) {
          try {
            // Get all members in this voice channel
            const members = channel.members;

            for (const member of members.values()) {
              totalChecked++;

              try {
                // Refresh member to get latest roles and voice state
                // This is critical - we need the latest role information
                await member.fetch();

                // Also refresh voice state to ensure we have the latest mute status
                // Note: member.fetch() should update voice state, but we fetch separately to be sure
                let voiceStateMute = member.voice.mute;
                let voiceStateSelfMute = member.voice.selfMute;
                try {
                  const voiceState = await member.guild.voiceStates.fetch(
                    member.id,
                  );
                  if (voiceState) {
                    voiceStateMute = voiceState.mute;
                    voiceStateSelfMute = voiceState.selfMute;
                  }
                } catch (error) {
                  logger.debug(
                    `Failed to fetch voice state for ${member.user.tag}:`,
                    error.message,
                  );
                }

                // Log current state for debugging
                logger.debug(
                  `Verifying ${member.user.tag} in ${channel.name}: muted=${voiceStateMute}, selfMuted=${voiceStateSelfMute}, roles=[${Array.from(member.roles.cache.keys()).join(", ")}]`,
                );

                // Skip if member is not server-muted
                // IMPORTANT: We check server-mute (muted) regardless of self-mute status
                // A member can be both server-muted (by bot) and self-muted (by themselves)
                // We should remove the server mute if they no longer have restrictive roles,
                // even if they're also self-muted
                if (!voiceStateMute) {
                  logger.debug(
                    `Skipping ${member.user.tag} - not server-muted (mute: ${voiceStateMute})`,
                  );
                  continue;
                }

                // Check if member has restrictive roles
                // IMPORTANT: This checks the member's CURRENT roles after fetch()
                const { hasRestrictiveRole: hasConnectRestriction } =
                  checkConnectRestriction(member, channel);
                const { hasRestrictiveSpeakRole } = checkSpeakRestriction(
                  member,
                  channel,
                );

                logger.debug(
                  `Checking ${member.user.tag} in ${channel.name}: muted=${voiceStateMute}, selfMuted=${voiceStateSelfMute}, hasConnectRestriction=${hasConnectRestriction}, hasRestrictiveSpeakRole=${hasRestrictiveSpeakRole}`,
                );

                // If member is muted but doesn't have restrictive roles, queue unmute
                if (!hasConnectRestriction && !hasRestrictiveSpeakRole) {
                  logger.info(
                    `Found muted member ${member.user.tag} in ${channel.name} without restrictive roles - queuing unmute`,
                  );

                  voiceQueue
                    .queueOperation({
                      member,
                      reason:
                        "Startup verification - role removed while bot was stopped",
                      type: "enforce",
                    })
                    .catch(error => {
                      logger.debug(
                        `Failed to queue voice operation for ${member.user.tag}:`,
                        error.message,
                      );
                    });

                  totalQueued++;
                } else {
                  logger.debug(
                    `Member ${member.user.tag} correctly muted - has restrictive role (Connect: ${hasConnectRestriction}, Speak: ${hasRestrictiveSpeakRole})`,
                  );
                }
              } catch (memberError) {
                logger.debug(
                  `Error checking member ${member.user.tag} in ${channel.name}:`,
                  memberError.message,
                );
              }
            }
          } catch (channelError) {
            logger.debug(
              `Error checking voice channel ${channel.name}:`,
              channelError.message,
            );
          }
        }
      } catch (guildError) {
        logger.debug(`Error checking guild ${guild.name}:`, guildError.message);
      }
    }

    if (totalQueued > 0) {
      logger.info(
        `✅ Startup verification complete: Checked ${totalChecked} members, queued ${totalQueued} unmute operations`,
      );
    } else {
      logger.debug(
        `✅ Startup verification complete: Checked ${totalChecked} members, no corrections needed`,
      );
    }
  } catch (error) {
    logger.error("Error during startup voice state verification:", error);
  }
}
