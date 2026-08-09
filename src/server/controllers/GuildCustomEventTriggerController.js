import { getLogger } from "../../utils/logger.js";
import {
  createSuccessResponse,
  createErrorResponse,
} from "../utils/responseHelpers.js";
import { logRequest } from "../utils/apiShared.js";
import { randomUUID } from "node:crypto";

const logger = getLogger();

const VALID_EVENT_TYPES = [
  "member_join",
  "member_leave",
  "member_boost",
  "role_add",
  "role_remove",
];

const VALID_ACTION_TYPES = ["role", "text", "dm", "channel", "variable"];

async function getEventTriggerRepo() {
  const { getDatabaseManager } = await import(
    "../../utils/storage/databaseManager.js"
  );
  const dbManager = await getDatabaseManager();
  if (!dbManager?.customEventTriggers) {
    throw new Error("Custom event triggers repository not available");
  }
  return dbManager.customEventTriggers;
}

async function checkTriggerLimit(guildId) {
  const { getPremiumManager } = await import(
    "../../features/premium/PremiumManager.js"
  );
  const { PRO_TIER, FREE_TIER } = await import(
    "../../features/premium/config.js"
  );

  const isPremium = await getPremiumManager().isFeatureActive(
    guildId,
    "pro_engine",
  );

  const repo = await getEventTriggerRepo();
  const currentCount = await repo.countByGuild(guildId);
  const maxTriggers = isPremium
    ? PRO_TIER.CUSTOM_EVENT_TRIGGERS_MAX
    : FREE_TIER.CUSTOM_EVENT_TRIGGERS_MAX;

  return {
    isPremium,
    currentCount,
    maxTriggers,
    canCreate: currentCount < maxTriggers,
    allowedTypes: isPremium
      ? PRO_TIER.CUSTOM_EVENT_TYPES
      : FREE_TIER.CUSTOM_EVENT_TYPES,
  };
}

function validateActions(actions) {
  if (!Array.isArray(actions)) return "actions must be an array";
  for (const action of actions) {
    if (!VALID_ACTION_TYPES.includes(action.type)) {
      return `Invalid action type: ${action.type}`;
    }
    if (action.type === "role" && !action.roleId) {
      return "Role action requires roleId";
    }
    if (action.type === "channel" && !action.channelId) {
      return "Channel action requires channelId. Use 'text' type for replies without a target channel.";
    }
    if ((action.type === "text" || action.type === "dm" || action.type === "channel") && !action.content) {
      return "Text/DM/channel action requires content";
    }
    if (action.type === "variable" && (!action.variableName)) {
      return "Variable action requires variableName";
    }
  }
  return null;
}

/**
 * GET /:guildId/event-triggers
 */
export async function apiListEventTriggers(req, res) {
  const { guildId } = req.params;
  logRequest(`List event triggers: ${guildId}`, req);

  try {
    const repo = await getEventTriggerRepo();
    const triggers = await repo.getByGuild(guildId);
    res.json(createSuccessResponse({ triggers }));
  } catch (error) {
    logger.error(`❌ Error listing event triggers for guild ${guildId}:`, error);
    const { statusCode, response } = createErrorResponse(
      "Failed to retrieve event triggers",
      500,
      error.message,
    );
    res.status(statusCode).json(response);
  }
}

/**
 * POST /:guildId/event-triggers
 */
export async function apiCreateEventTrigger(req, res) {
  const { guildId } = req.params;
  logRequest(`Create event trigger for guild ${guildId}`, req);

  try {
    const limit = await checkTriggerLimit(guildId);
    if (!limit.isPremium) {
      const { statusCode, response } = createErrorResponse(
        "Pro Engine is required to use event triggers",
        403,
      );
      return res.status(statusCode).json(response);
    }
    if (!limit.canCreate) {
      const { statusCode, response } = createErrorResponse(
        `Event trigger limit reached (${limit.currentCount}/${limit.maxTriggers})`,
        403,
      );
      return res.status(statusCode).json(response);
    }

    const { name, trigger, actions, conditions, createdBy } = req.body;

    if (!name || !trigger?.type || !createdBy) {
      const { statusCode, response } = createErrorResponse(
        "name, trigger.type, and createdBy are required",
        400,
      );
      return res.status(statusCode).json(response);
    }

    if (!VALID_EVENT_TYPES.includes(trigger.type)) {
      const { statusCode, response } = createErrorResponse(
        `trigger.type must be one of: ${VALID_EVENT_TYPES.join(", ")}`,
        400,
      );
      return res.status(statusCode).json(response);
    }

    // Check if event type is allowed for this tier
    if (
      limit.allowedTypes[0] !== "all" &&
      !limit.allowedTypes.includes(trigger.type)
    ) {
      const { statusCode, response } = createErrorResponse(
        `Event type '${trigger.type}' requires Pro Engine`,
        403,
      );
      return res.status(statusCode).json(response);
    }

    if (actions) {
      const actionError = validateActions(actions);
      if (actionError) {
        const { statusCode, response } = createErrorResponse(actionError, 400);
        return res.status(statusCode).json(response);
      }
    }

    const now = new Date();
    const triggerData = {
      guildId,
      triggerId: randomUUID(),
      name,
      enabled: true,
      trigger,
      actions: Array.isArray(actions) ? actions : [],
      conditions: Array.isArray(conditions) ? conditions : [],
      createdBy,
      createdAt: now,
      updatedAt: now,
    };

    const repo = await getEventTriggerRepo();
    await repo.create(triggerData);

    logger.info(`✅ Event trigger '${name}' created for guild ${guildId}`);
    res.status(201).json(
      createSuccessResponse({
        message: `Event trigger '${name}' created successfully`,
        trigger: triggerData,
      }),
    );
  } catch (error) {
    logger.error(
      `❌ Error creating event trigger for guild ${guildId}:`,
      error,
    );
    const { statusCode, response } = createErrorResponse(
      "Failed to create event trigger",
      500,
      error.message,
    );
    res.status(statusCode).json(response);
  }
}

/**
 * PATCH /:guildId/event-triggers/:triggerId
 */
export async function apiUpdateEventTrigger(req, res) {
  const { guildId, triggerId } = req.params;
  logRequest(`Update event trigger ${triggerId} for guild ${guildId}`, req);

  try {
    const repo = await getEventTriggerRepo();
    const existing = await repo.getById(guildId, triggerId);
    if (!existing) {
      const { statusCode, response } = createErrorResponse(
        "Event trigger not found",
        404,
      );
      return res.status(statusCode).json(response);
    }

    const { name, enabled, trigger, actions, conditions } = req.body;
    const updateData = {};

    if (name !== undefined) updateData.name = name;
    if (enabled !== undefined) updateData.enabled = Boolean(enabled);

    if (trigger !== undefined) {
      if (trigger.type && !VALID_EVENT_TYPES.includes(trigger.type)) {
        const { statusCode, response } = createErrorResponse(
          `trigger.type must be one of: ${VALID_EVENT_TYPES.join(", ")}`,
          400,
        );
        return res.status(statusCode).json(response);
      }
      updateData.trigger = trigger;
    }

    if (actions !== undefined) {
      const actionError = validateActions(actions);
      if (actionError) {
        const { statusCode, response } = createErrorResponse(actionError, 400);
        return res.status(statusCode).json(response);
      }
      updateData.actions = actions;
    }

    if (conditions !== undefined) {
      updateData.conditions = Array.isArray(conditions) ? conditions : [];
    }

    await repo.update(guildId, triggerId, updateData);

    logger.info(
      `✅ Event trigger '${existing.name}' updated for guild ${guildId}`,
    );
    res.json(
      createSuccessResponse({
        message: `Event trigger '${existing.name}' updated successfully`,
      }),
    );
  } catch (error) {
    logger.error(
      `❌ Error updating event trigger ${triggerId} for guild ${guildId}:`,
      error,
    );
    const { statusCode, response } = createErrorResponse(
      "Failed to update event trigger",
      500,
      error.message,
    );
    res.status(statusCode).json(response);
  }
}

/**
 * DELETE /:guildId/event-triggers/:triggerId
 */
export async function apiDeleteEventTrigger(req, res) {
  const { guildId, triggerId } = req.params;
  logRequest(`Delete event trigger ${triggerId} for guild ${guildId}`, req);

  try {
    const repo = await getEventTriggerRepo();
    const existing = await repo.getById(guildId, triggerId);
    if (!existing) {
      const { statusCode, response } = createErrorResponse(
        "Event trigger not found",
        404,
      );
      return res.status(statusCode).json(response);
    }

    await repo.delete(guildId, triggerId);

    logger.info(
      `✅ Event trigger '${existing.name}' deleted for guild ${guildId}`,
    );
    res.json(
      createSuccessResponse({
        message: `Event trigger '${existing.name}' deleted successfully`,
      }),
    );
  } catch (error) {
    logger.error(
      `❌ Error deleting event trigger ${triggerId} for guild ${guildId}:`,
      error,
    );
    const { statusCode, response } = createErrorResponse(
      "Failed to delete event trigger",
      500,
      error.message,
    );
    res.status(statusCode).json(response);
  }
}
