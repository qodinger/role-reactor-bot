/**
 * ComfyUI Startup Recovery
 * Automatically recovers orphaned jobs when the bot starts and runs periodic recovery
 */

import { getLogger } from "../../../logger.js";
import { jobRecovery } from "./jobRecovery.js";
import { AttachmentBuilder, EmbedBuilder } from "discord.js";

const logger = getLogger();

// Global recovery interval
let recoveryInterval = null;

/**
 * Start automatic job recovery system
 */
export async function startAutomaticRecovery(comfyuiProvider, discordClient) {
  try {
    logger.info("[AutoRecovery] Starting automatic job recovery system...");

    // Perform initial startup recovery
    await performRecovery(comfyuiProvider, discordClient, "startup");

    // Start with more frequent checks initially (every 30 seconds for first 5 minutes)
    let checkCount = 0;
    const maxFastChecks = 10; // 10 checks * 30 seconds = 5 minutes
    
    const startRecoveryChecks = () => {
      const checkInterval = checkCount < maxFastChecks ? 30 * 1000 : 2 * 60 * 1000; // 30s then 2min
      
      recoveryInterval = setTimeout(async () => {
        try {
          await performRecovery(comfyuiProvider, discordClient, "periodic");
          checkCount++;
          
          // Continue scheduling
          if (recoveryInterval) {
            startRecoveryChecks();
          }
        } catch (error) {
          logger.error("[AutoRecovery] Periodic recovery failed:", error);
          // Continue scheduling even if recovery fails
          if (recoveryInterval) {
            startRecoveryChecks();
          }
        }
      }, checkInterval);
    };

    // Start the recovery check cycle
    startRecoveryChecks();

    logger.info("[AutoRecovery] Automatic recovery system started (30s intervals for 5min, then 2min intervals)");

  } catch (error) {
    logger.error("[AutoRecovery] Failed to start automatic recovery:", error);
  }
}

/**
 * Stop automatic recovery system
 */
export function stopAutomaticRecovery() {
  if (recoveryInterval) {
    clearTimeout(recoveryInterval);
    recoveryInterval = null;
    logger.info("[AutoRecovery] Automatic recovery system stopped");
  }
}

/**
 * Perform recovery check
 */
async function performRecovery(comfyuiProvider, discordClient, type = "periodic") {
  try {
    // Clean up old jobs first (only on startup)
    if (type === "startup") {
      const cleanedJobs = await jobRecovery.cleanupOldJobs();
      if (cleanedJobs > 0) {
        logger.info(`[AutoRecovery] Cleaned up ${cleanedJobs} old jobs`);
      }
    }

    // Recover orphaned jobs
    const recoveredJobs = await comfyuiProvider.recoverOrphanedJobs();
    
    if (recoveredJobs.length === 0) {
      if (type === "startup") {
        logger.info("[AutoRecovery] No orphaned jobs to recover on startup");
      }
      return;
    }

    logger.info(`[AutoRecovery] Found ${recoveredJobs.length} completed jobs to recover (${type})`);

    // Send recovered images to users
    for (const recovery of recoveredJobs) {
      try {
        await sendRecoveredJobSeamlessly(recovery, discordClient);
      } catch (error) {
        logger.error(`[AutoRecovery] Failed to send recovered job ${recovery.job.promptId}:`, error);
      }
    }

    logger.info(`[AutoRecovery] Recovery complete - processed ${recoveredJobs.length} jobs`);

  } catch (error) {
    logger.error(`[AutoRecovery] ${type} recovery failed:`, error);
  }
}

/**
 * Send a recovered job seamlessly to the original channel
 */
async function sendRecoveredJobSeamlessly(recovery, discordClient) {
  const { job, images } = recovery;
  
  if (!images || images.length === 0) {
    logger.warn(`[AutoRecovery] No images found for job ${job.promptId}`);
    return;
  }

  try {
    // Get the original channel
    let channel = null;
    if (job.channelId) {
      try {
        channel = await discordClient.channels.fetch(job.channelId);
      } catch (error) {
        logger.debug(`[AutoRecovery] Could not access original channel ${job.channelId}:`, error);
      }
    }

    if (!channel) {
      logger.warn(`[AutoRecovery] Original channel ${job.channelId} not accessible for job ${job.promptId}`);
      return;
    }

    // Create the image attachment
    const image = images[0];
    const attachment = new AttachmentBuilder(image.data, { 
      name: `imagine_${Date.now()}.png` 
    });

    // Create embed that looks like a normal imagine result
    const embed = new EmbedBuilder()
      .setTitle("🎨 AI Generated Image")
      .setDescription(`**Prompt:** ${job.prompt}`)
      .setColor(0x00AE86)
      .setImage(`attachment://imagine_${Date.now()}.png`)
      .addFields([
        { name: "Model", value: job.model || "Unknown", inline: true },
        { name: "Provider", value: "ComfyUI", inline: true },
        { name: "Status", value: "✅ Completed", inline: true },
      ])
      .setFooter({ text: "AI Image Generator • Role Reactor" })
      .setTimestamp();

    // Send to original channel, mentioning the user
    await channel.send({
      content: `<@${job.userId}> Your image generation has completed!`,
      embeds: [embed],
      files: [attachment],
    });

    logger.info(`[AutoRecovery] Successfully delivered recovered job ${job.promptId} to channel ${job.channelId}`);

  } catch (error) {
    logger.error(`[AutoRecovery] Failed to send recovered job ${job.promptId}:`, error);
    
    // Fallback: try to DM the user
    try {
      const user = await discordClient.users.fetch(job.userId);
      if (user) {
        const image = images[0];
        const attachment = new AttachmentBuilder(image.data, { 
          name: `recovered_${Date.now()}.png` 
        });

        const embed = new EmbedBuilder()
          .setTitle("🔄 Recovered Image Generation")
          .setDescription(
            `Your image generation completed while the bot was processing. Here's your image!\n\n` +
            `**Prompt:** ${job.prompt}`
          )
          .setColor(0x00FF00)
          .setImage(`attachment://recovered_${Date.now()}.png`)
          .setFooter({ text: "Delivered via DM - original channel was inaccessible" })
          .setTimestamp();

        await user.send({
          embeds: [embed],
          files: [attachment],
        });

        logger.info(`[AutoRecovery] Sent recovered job ${job.promptId} via DM as fallback`);
      }
    } catch (dmError) {
      logger.error(`[AutoRecovery] Failed to send DM fallback for job ${job.promptId}:`, dmError);
    }
  }
}

// Legacy exports for backward compatibility
export const performStartupRecovery = startAutomaticRecovery;

export default {
  startAutomaticRecovery,
  stopAutomaticRecovery,
  performStartupRecovery,
};