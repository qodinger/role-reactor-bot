import { Events } from "discord.js";
import { getLogger } from "../utils/logger.js";
import { getExperienceManager } from "../features/experience/ExperienceManager.js";

export const name = Events.MessageCreate;

export async function execute(message, client) {
  const logger = getLogger();

  if (!message) throw new Error("Missing message");
  if (!client) throw new Error("Missing client");

  try {
    // Ignore bot messages
    if (message.author.bot) {
      return;
    }

    // Ignore DMs
    if (!message.guild) {
      return;
    }

    // Award XP for message activity
    // Level-up notifications are handled by LevelUpNotifier in ExperienceManager
    const experienceManager = await getExperienceManager();
    await experienceManager.awardMessageXP(message.guild.id, message.author.id);
  } catch (error) {
    logger.error("Error processing message for XP", error);
  }
}
