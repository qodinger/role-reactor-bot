import { getLogger } from "../logger.js";

/**
 * Shared executor for event-based custom triggers (Phase 6).
 * Called from guildMemberAdd, guildMemberRemove, guildMemberUpdate event handlers.
 */

/**
 * Evaluate a single condition in an event context.
 * @param {object} condition
 * @param {object} context  { guild, member, user, channelId, dbManager }
 */
async function evaluateEventCondition(condition, context) {
  const { member, guild, channelId, user, dbManager } = context;

  try {
    switch (condition.type) {
      case "role":
        return member?.roles?.cache?.has(condition.roleId) ?? false;

      case "channel":
        return channelId === condition.channelId;

      case "user":
        return (user?.id ?? member?.id) === condition.userId;

      case "variable": {
        if (!dbManager?.customVariables || !guild) return false;
        const userId = user?.id ?? member?.id;
        const value = await dbManager.customVariables.getValue(
          guild.id,
          condition.variableName,
          condition.scope === "user" ? userId : null,
        );
        return compareValues(value, condition.operator, condition.compareValue);
      }

      case "permission":
        return member?.permissions?.has(condition.permission) ?? false;

      case "chance":
        return Math.random() * 100 < (condition.chance ?? 0);

      default:
        return false;
    }
  } catch {
    return false;
  }
}

function compareValues(actual, operator, expected) {
  switch (operator) {
    case "equals":
      return String(actual) === String(expected);
    case "contains":
      return String(actual).includes(String(expected));
    case "greater":
      return Number(actual) > Number(expected);
    case "less":
      return Number(actual) < Number(expected);
    case "regex":
      try {
        return new RegExp(String(expected)).test(String(actual));
      } catch {
        return false;
      }
    default:
      return false;
  }
}

/**
 * Execute a list of actions in an event context (no Discord interaction object available).
 * @param {object[]} actions
 * @param {object} context  { guild, member, user, client, dbManager }
 */
async function executeEventActions(actions, context) {
  const logger = getLogger();
  if (!actions || actions.length === 0) return;

  const { guild, member, user, client, dbManager } = context;

  for (const action of actions) {
    try {
      switch (action.type) {
        case "role": {
          if (!guild || !member) break;
          const role = guild.roles.cache.get(action.roleId);
          if (!role) break;

          const botMember = guild.members.me;
          if (botMember && role.position >= botMember.roles.highest.position) {
            logger.warn(
              `Event trigger: Cannot manage role ${action.roleId} — hierarchy`,
            );
            break;
          }

          const hasRole = member.roles.cache.has(action.roleId);
          const shouldAdd =
            action.action === "add"
              ? true
              : action.action === "remove"
                ? false
                : !hasRole;

          if (shouldAdd) {
            await member.roles.add(role);
          } else {
            await member.roles.remove(role);
          }
          break;
        }

        case "text":
        case "channel": {
          const targetChannel = guild?.channels.cache.get(action.channelId);
          if (!targetChannel?.isTextBased?.()) break;
          const text = await replaceEventVars(action.content ?? "", context);
          await targetChannel.send(text);
          break;
        }

        case "dm": {
          const targetUserId = action.targetUserId ?? user?.id ?? member?.id;
          if (!targetUserId || !client) break;
          const dmUser = await client.users
            .fetch(targetUserId)
            .catch(() => null);
          if (!dmUser) break;
          const text = await replaceEventVars(action.content ?? "", context);
          await dmUser.send(text).catch(() => {});
          break;
        }

        case "variable": {
          if (!dbManager?.customVariables || !guild) break;
          const userId = user?.id ?? member?.id ?? null;
          const targetId = action.scope === "user" ? userId : null;

          if (action.variableAction === "increment") {
            await dbManager.customVariables.incrementValue(
              guild.id,
              action.variableName,
              Number(action.variableValue) || 1,
              targetId,
            );
          } else if (action.variableAction === "delete") {
            await dbManager.customVariables.deleteValue(
              guild.id,
              action.variableName,
              targetId,
            );
          } else {
            await dbManager.customVariables.setValue(
              guild.id,
              action.variableName,
              action.variableValue,
              targetId,
            );
          }
          break;
        }

        default:
          break;
      }
    } catch (err) {
      logger.error(`Event trigger action '${action.type}' failed:`, err);
    }
  }
}

/**
 * Replace common placeholders in event trigger text.
 * @param {string} text
 * @param {object} context
 */
async function replaceEventVars(text, context) {
  const { guild, member, user, dbManager } = context;
  const resolvedUser = user ?? member?.user;

  let result = text
    .replace(/\{user\}/g, resolvedUser ? `<@${resolvedUser.id}>` : "")
    .replace(/\{user\.id\}/g, resolvedUser?.id ?? "")
    .replace(/\{user\.name\}/g, resolvedUser?.username ?? "")
    .replace(/\{server\}/g, guild?.name ?? "")
    .replace(/\{server\.id\}/g, guild?.id ?? "")
    .replace(/\{count\}/g, String(guild?.memberCount ?? ""));

  // Variable replacement
  if (dbManager?.customVariables && guild) {
    const userId = resolvedUser?.id ?? null;
    const scopedVarPattern = /\{var_([a-zA-Z0-9_]+)\[([^\]]+)\]\}/g;
    const guildVarPattern = /\{var_([a-zA-Z0-9_]+)\}/g;

    const scopedMatches = [...result.matchAll(scopedVarPattern)];
    for (const match of scopedMatches) {
      const [fullMatch, varName, rawTargetId] = match;
      const targetId = rawTargetId.replace("user.id", userId ?? "");
      const value = await dbManager.customVariables
        .getValue(guild.id, varName, targetId)
        .catch(() => null);
      result = result.replace(fullMatch, value !== null ? String(value) : "");
    }

    const guildMatches = [...result.matchAll(guildVarPattern)];
    for (const match of guildMatches) {
      const [fullMatch, varName] = match;
      const value = await dbManager.customVariables
        .getValue(guild.id, varName, null)
        .catch(() => null);
      result = result.replace(fullMatch, value !== null ? String(value) : "");
    }
  }

  return result;
}

/**
 * Fire all enabled event triggers of a given type for a guild.
 * @param {string} guildId
 * @param {string} eventType  e.g. 'member_join', 'member_leave', 'role_add', 'role_remove'
 * @param {object} context    { guild, member, user, client, dbManager }
 */
export async function fireEventTriggers(guildId, eventType, context) {
  const logger = getLogger();
  const { dbManager } = context;

  if (!dbManager?.customEventTriggers) return;

  let triggers;
  try {
    triggers = await dbManager.customEventTriggers.getByEventType(
      guildId,
      eventType,
    );
  } catch (err) {
    logger.error(`Failed to fetch event triggers for ${eventType}:`, err);
    return;
  }

  if (!triggers || triggers.length === 0) return;

  for (const trigger of triggers) {
    try {
      // Evaluate conditions
      if (trigger.conditions?.length > 0) {
        let allMet = true;
        for (const condition of trigger.conditions) {
          const met = await evaluateEventCondition(condition, context);
          if (!met) {
            allMet = false;
            break;
          }
        }
        if (!allMet) continue;
      }

      // Execute actions
      await executeEventActions(trigger.actions ?? [], context);

      logger.debug(
        `Event trigger '${trigger.name}' fired for event '${eventType}' in guild ${guildId}`,
      );
    } catch (err) {
      logger.error(
        `Event trigger '${trigger.name}' (${trigger.triggerId}) failed:`,
        err,
      );
    }
  }
}
