import { Events } from "discord.js";
import { removeRoleMapping } from "../utils/roleManager.js";

export const name = Events.MessageDelete;

export async function execute(message, client) {
  if (!message) throw new Error("Missing message");
  if (!client) throw new Error("Missing client");

  try {
    console.log(
      `🔍 Message deleted: ${message.id} in channel ${message.channel?.id}`,
    );

    // Check if this is a role message that was deleted
    const roleMapping = await removeRoleMapping(message.id);

    if (roleMapping) {
      console.log(`🗑️ Role mapping removed for deleted message: ${message.id}`);
      console.log(
        `📊 Removed ${Object.keys(roleMapping.roles || {}).length} role mappings`,
      );
    } else {
      console.log(
        `ℹ️ No role mapping found for deleted message: ${message.id}`,
      );
    }
  } catch (error) {
    console.error("Error handling message deletion:", error);
  }
}
