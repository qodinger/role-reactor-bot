import { Events } from "discord.js";
import { getAllRoleMappings, removeRoleMapping } from "../utils/roleManager.js";

export const name = Events.GuildDelete;

export async function execute(guild, client) {
  if (!guild) throw new Error("Missing guild");
  if (!client) throw new Error("Missing client");

  try {
    // Get all role mappings and check if any are in the deleted guild
    const allMappings = await getAllRoleMappings();
    let removedCount = 0;

    for (const [messageId, mapping] of Object.entries(allMappings)) {
      if (mapping.guildId === guild.id) {
        const removedMapping = await removeRoleMapping(messageId);
        if (removedMapping) {
          console.log(`🗑️ Role mapping removed for left guild: ${messageId}`);
          removedCount++;
        }
      }
    }

    if (removedCount > 0) {
      console.log(
        `📊 Removed ${removedCount} role mappings from left guild: ${guild.name}`,
      );
    }
  } catch (error) {
    console.error("Error handling guild deletion:", error);
  }
}
