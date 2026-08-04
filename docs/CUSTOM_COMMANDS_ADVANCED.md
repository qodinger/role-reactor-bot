# Custom Commands Advanced Features — Implementation Guide

## Overview

This document details the implementation plan for 6 advanced features that transform the custom commands system from a basic slash command responder into a comprehensive no-code bot builder platform.

**Features:**
1. Enhanced Embeds — Rich embed formatting (fields, images, author, timestamp)
2. Button/Menu Actions — Complete the stubbed component handlers
3. Variables/Data Storage — Per-user/guild persistent variables
4. Conditional Logic — If/else branching based on roles, channels, variables
5. Keyword Triggers — Message-based auto-responses
6. Event Triggers — Automation on member join/leave, role changes, etc.

**Total Estimated Effort:** 19-30 days

---

## Table of Contents

- [Architecture Principles](#architecture-principles)
- [Phase 1: Enhanced Embeds](#phase-1-enhanced-embeds)
- [Phase 2: Button/Menu Actions](#phase-2-buttonmenu-actions)
- [Phase 3: Variables/Data Storage](#phase-3-variablesdata-storage)
- [Phase 4: Conditional Logic](#phase-4-conditional-logic)
- [Phase 5: Keyword Triggers](#phase-5-keyword-triggers)
- [Phase 6: Event Triggers](#phase-6-event-triggers)
- [Database Migration](#database-migration)
- [Premium Configuration](#premium-configuration)
- [Testing Strategy](#testing-strategy)
- [File Reference](#file-reference)

---

## Architecture Principles

### Design Decisions

1. **Backward Compatible** — All existing commands continue to work without modification
2. **Progressive Enhancement** — Features build on each other (conditions require variables)
3. **Premium Gated** — Advanced features reserved for Pro Engine
4. **Fail Safe** — Invalid configurations fail gracefully, never crash the bot
5. **Rate Limited** — All new features respect existing rate limiting patterns

### Data Flow

```
User Interaction
       |
       v
Trigger Detection
  - Slash command -> CustomCommandExecutor.execute()
  - Keyword match -> messageCreate listener
  - Event fire -> event listener
       |
       v
Pre-Execution Checks
  - Premium status
  - Command enabled
  - Channel restrictions
  - Role requirements
  - Cooldown
       |
       v
Condition Evaluation
  - Required roles (existing)
  - Allowed channels (existing)
  - Conditional blocks (new)
       |
       v
Action Execution
  - Primary response (text/embed/role/dm)
  - Multi-actions (existing)
  - Component actions (new)
  - Variable updates (new)
       |
       v
Response Delivery
  - Reply to interaction
  - Send to channel
  - Send DM
  - Update variables
```

---

## Phase 1: Enhanced Embeds

### Current State

Embeds only support 4 fields: `title`, `description`, `color`, `footer`

### Target State

Full Discord.js EmbedBuilder support with `fields`, `thumbnail`, `image`, `author`, `timestamp`, `url`

### Implementation Steps

#### Step 1: Update Data Model Validation

**File:** `src/server/controllers/GuildCustomCommandController.js`

Add validation for new embed fields in `apiCreateCustomCommand` and `apiUpdateCustomCommand`:

```javascript
// Validate fields (max 25)
if (embed.fields && Array.isArray(embed.fields)) {
  if (embed.fields.length > 25) {
    return createErrorResponse("Maximum 25 embed fields allowed", 400);
  }
  for (const field of embed.fields) {
    if (!field.name || !field.value) {
      return createErrorResponse("Each field must have name and value", 400);
    }
    if (field.name.length > 256) {
      return createErrorResponse("Field name max 256 characters", 400);
    }
    if (field.value.length > 1024) {
      return createErrorResponse("Field value max 1024 characters", 400);
    }
  }
}

// Validate URLs
function isValidUrl(string) {
  try { new URL(string); return true; } catch { return false; }
}
```

#### Step 2: Update Embed Storage

**File:** `src/server/controllers/GuildCustomCommandController.js`

Update embed construction in create/update:

```javascript
embed: type === "embed" ? {
  title: embed.title.trim(),
  description: embed.description.trim(),
  color: embed.color || "#9b8bf0",
  footer: embed.footer?.trim() || null,
  fields: embed.fields || null,
  thumbnail: embed.thumbnail || null,
  image: embed.image || null,
  author: embed.author || null,
  timestamp: Boolean(embed.timestamp),
  url: embed.url || null,
} : null,
```

#### Step 3: Update Embed Builder

**File:** `src/utils/core/CustomCommandExecutor.js`

Replace the embed building section (lines 274-302) to support new fields:

```javascript
} else if (command.type === "embed") {
  const { EmbedBuilder } = await import("discord.js");

  let color = 0x9b8bf0;
  try {
    color = parseInt((command.embed.color ?? "#9b8bf0").replace("#", ""), 16);
  } catch {}

  const embed = new EmbedBuilder()
    .setTitle(await replaceVariables(command.embed.title))
    .setDescription(await replaceVariables(command.embed.description))
    .setColor(color);

  if (command.embed.footer) {
    embed.setFooter({ text: await replaceVariables(command.embed.footer) });
  }

  if (command.embed.fields?.length > 0) {
    embed.setFields(command.embed.fields.slice(0, 25).map(f => ({
      name: f.name,
      value: f.value,
      inline: f.inline ?? false,
    })));
  }

  if (command.embed.thumbnail?.url) {
    embed.setThumbnail(command.embed.thumbnail.url);
  }

  if (command.embed.image?.url) {
    embed.setImage(command.embed.image.url);
  }

  if (command.embed.author?.name) {
    embed.setAuthor({
      name: command.embed.author.name,
      iconURL: command.embed.author.iconUrl,
      url: command.embed.author.url,
    });
  }

  if (command.embed.timestamp) embed.setTimestamp();
  if (command.embed.url) embed.setURL(command.embed.url);

  const components = buildComponents();
  await interaction.reply({
    embeds: [embed],
    flags: ephemeral,
    ...(components.length > 0 ? { components } : {}),
  });
}
```

#### Step 4: Add Tests

**File:** `tests/unit/commands/custom-commands/enhanced-embeds.test.js`

- Build embed with fields
- Build embed with thumbnail/image/author/timestamp/URL
- Reject more than 25 fields
- Reject invalid URLs
- Replace variables in fields

---

## Phase 2: Button/Menu Actions

### Current State

Buttons and select menus render but handlers only acknowledge clicks (lines 495-582).

### Target State

Components execute defined actions (role, text, dm, channel, variable).

### Implementation Steps

#### Step 1: Update Data Model

Add `actions` array to button and select menu option objects:

```javascript
components: {
  buttons: [{
    label, style, emoji, url,
    actions: [{
      type: "role" | "text" | "dm" | "channel" | "variable",
      roleId?, channelId?, content?, variableName?, variableValue?,
      action?: "add" | "remove" | "toggle"
    }]
  }],
  selectMenu: {
    options: [{
      label, value, description, emoji,
      actions: [{ ... }]
    }]
  }
}
```

#### Step 2: Add Validation

**File:** `src/server/controllers/GuildCustomCommandController.js`

```javascript
function validateAction(action) {
  if (!action.type) return "Action type is required";
  const validTypes = ["role", "text", "dm", "channel", "variable"];
  if (!validTypes.includes(action.type)) return `Invalid action type: ${action.type}`;
  switch (action.type) {
    case "role": return action.roleId ? null : "Role ID required";
    case "text":
    case "dm": return action.content ? null : "Content required";
    case "channel": return action.channelId ? null : "Channel ID required";
    case "variable": return (action.variableName && action.variableValue) ? null : "Variable name and value required";
  }
  return null;
}
```

#### Step 3: Implement Action Executor

**File:** `src/utils/core/CustomCommandExecutor.js`

Create `executeComponentActions(actions, interaction, command)` function that:

1. Iterates over actions array
2. For each action type:
   - **role**: Fetch member, check role hierarchy, add/remove/toggle
   - **text**: Fetch channel, send message with variable replacement
   - **dm**: Fetch user, send DM with variable replacement
   - **channel**: Same as text but explicit channel targeting
   - **variable**: Update variable value in database

#### Step 4: Update Button Handler

**File:** `src/utils/core/CustomCommandExecutor.js`

Replace `handleCustomCommandButton` (lines 495-533):

```javascript
export async function handleCustomCommandButton(interaction) {
  const logger = getLogger();
  const { customId } = interaction;

  try {
    const parts = customId.split("_");
    if (parts.length < 3) return;

    const commandId = parts[1];
    const buttonLabel = parts.slice(2).join("_");

    const { getDatabaseManager } = await import("../storage/databaseManager.js");
    const dbManager = await getDatabaseManager();
    if (!dbManager?.customCommands) return;

    const command = await dbManager.customCommands.getById(interaction.guildId, commandId);
    if (!command?.enabled) {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: "This button is no longer available.", flags: [MessageFlags.Ephemeral] });
      }
      return;
    }

    // Find matching button
    const button = command.components?.buttons?.find(b =>
      b.label.toLowerCase().replace(/\s+/g, "_") === buttonLabel
    );

    if (!button?.actions) {
      await interaction.reply({ content: "Button action not configured.", flags: [MessageFlags.Ephemeral] });
      return;
    }

    // Execute actions
    await executeComponentActions(button.actions, interaction, command);

    // Acknowledge
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: "Action completed!", flags: [MessageFlags.Ephemeral] });
    }
  } catch (error) {
    logger.error(`Error handling custom command button ${customId}:`, error);
  }
}
```

#### Step 5: Update Select Menu Handler

Similar to button handler but iterate over `selectedValues` and execute matching option actions.

---

## Phase 3: Variables/Data Storage

### Current State

Only predefined placeholders (`{user}`, `{server}`, etc.)

### Target State

Persistent variables scoped to guild, user, or channel.

### New Collection

**Collection:** `custom_variables`

```javascript
{
  guildId: string,
  variableId: string,           // UUID
  name: string,                 // Alphanumeric + underscore
  scope: "guild" | "user" | "channel",
  type: "text" | "number" | "collection" | "object",
  defaultValue: any,
  values: { [targetId]: any },  // Cached values for user/channel scoped
  createdBy: string,
  createdAt: Date,
  updatedAt: Date
}
```

### New Repository

**File:** `src/utils/storage/repositories/CustomVariableRepository.js`

```javascript
export class CustomVariableRepository extends BaseRepository {
  constructor(db, cache, logger) {
    super(db, "custom_variables", cache, logger);
  }

  async getByName(guildId, name) { ... }
  async getByGuild(guildId) { ... }
  async getValue(guildId, name, targetId = null) { ... }
  async setValue(guildId, name, value, targetId = null) { ... }
  async incrementValue(guildId, name, amount, targetId = null) { ... }
  async deleteValue(guildId, name, targetId = null) { ... }
  async countByGuild(guildId) { ... }
}
```

### Variable Syntax

Extend `replaceVariables` in `CustomCommandExecutor.js`:

```javascript
// New patterns:
{var_variable_name}              // Guild-scoped
{var_variable_name[user_id]}     // User-scoped
{var_variable_name[channel_id]}  // Channel-scoped

// Example:
"Hello {var_username[user.id]}, you have {var_points[user.id]} points!"
```

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/:guildId/variables` | List all variables |
| `POST` | `/:guildId/variables` | Create variable |
| `PATCH` | `/:guildId/variables/:variableId` | Update variable |
| `DELETE` | `/:guildId/variables/:variableId` | Delete variable |

### Implementation Steps

#### Step 1: Create Repository

**File:** `src/utils/storage/repositories/CustomVariableRepository.js`

#### Step 2: Register in DatabaseManager

**File:** `src/utils/storage/databaseManager.js`

Add `customVariables` collection initialization.

#### Step 3: Update Executor

**File:** `src/utils/core/CustomCommandExecutor.js`

Extend `replaceVariables` to resolve `{var_*}` patterns.

#### Step 4: Add API Endpoints

**File:** `src/server/routes/v1/guilds.js`

Add routes for variable CRUD.

#### Step 5: Add Variable Action to Components

Allow buttons/menus to set/increment/delete variables.

---

## Phase 4: Conditional Logic

### Current State

No branching logic.

### Target State

If/else branching based on roles, channels, variables, permissions.

### Data Model

Add `conditions` array to commands:

```javascript
{
  // ... existing fields
  conditions: [{
    type: "role" | "channel" | "user" | "variable" | "permission" | "chance" | "comparison",
    // Type-specific config:
    roleId?: string,
    channelId?: string,
    userId?: string,
    variableName?: string,
    operator?: "equals" | "contains" | "greater" | "less" | "regex",
    compareValue?: any,
    permission?: string,
    chance?: number,           // 0-100
    trueActions: [{ ... }],
    falseActions: [{ ... }]
  }]
}
```

### Condition Types

| Type | Config | Description |
|------|--------|-------------|
| `role` | `roleId` | User has specific role |
| `channel` | `channelId` | Command used in specific channel |
| `user` | `userId` | Specific user triggered |
| `variable` | `variableName`, `operator`, `compareValue` | Variable comparison |
| `permission` | `permission` | Discord permission check |
| `chance` | `chance` | Random percentage (0-100) |
| `comparison` | `operator`, `compareValue` | Generic value comparison |

### Implementation Steps

#### Step 1: Update Data Model

**File:** `src/server/controllers/GuildCustomCommandController.js`

Add conditions validation in create/update.

#### Step 2: Implement Condition Evaluator

**File:** `src/utils/core/CustomCommandExecutor.js`

```javascript
async function evaluateCondition(condition, context) {
  const { member, guild, channelId, userId, variables } = context;

  switch (condition.type) {
    case "role":
      return member?.roles.cache.has(condition.roleId) ?? false;
    case "channel":
      return channelId === condition.channelId;
    case "user":
      return userId === condition.userId;
    case "variable":
      const value = await variables.getValue(guild.id, condition.variableName, userId);
      return compareValues(value, condition.operator, condition.compareValue);
    case "permission":
      return member?.permissions.has(condition.permission) ?? false;
    case "chance":
      return Math.random() * 100 < (condition.chance ?? 0);
    default:
      return false;
  }
}

function compareValues(actual, operator, expected) {
  switch (operator) {
    case "equals": return actual === expected;
    case "contains": return String(actual).includes(String(expected));
    case "greater": return Number(actual) > Number(expected);
    case "less": return Number(actual) < Number(expected);
    case "regex": return new RegExp(expected).test(String(actual));
    default: return false;
  }
}
```

#### Step 3: Update Execution Flow

**File:** `src/utils/core/CustomCommandExecutor.js`

After pre-execution checks, evaluate conditions and route to true/false actions.

#### Step 4: Limit Nesting Depth

Max 5 levels of nested conditions to prevent infinite loops.

---

## Phase 5: Keyword Triggers

### Current State

Only slash command triggers.

### Target State

Auto-responses when users type specific keywords/patterns.

### Data Model

Add `trigger` field to commands:

```javascript
{
  // ... existing fields
  trigger: {
    type: "slash" | "keyword" | "regex",
    patterns: [{
      pattern: string,
      matchType: "exact" | "contains" | "starts" | "ends" | "regex",
      caseSensitive: boolean
    }],
    channels?: string[],       // Restrict to channels
    ignoreBots: boolean,
    ignoreDMs: boolean
  }
}
```

### New Listener

**File:** `src/events/messageCreate.js` (new file)

```javascript
export default {
  name: "messageCreate",
  async execute(message, client) {
    if (message.author.bot) return;
    if (!message.guild) return;

    const { getDatabaseManager } = await import("../utils/storage/databaseManager.js");
    const dbManager = await getDatabaseManager();
    if (!dbManager?.customCommands) return;

    const commands = await dbManager.customCommands.getByGuild(message.guild.id);
    const keywordCommands = commands.filter(c =>
      c.enabled && c.trigger?.type !== "slash"
    );

    for (const command of keywordCommands) {
      if (matchesTrigger(message.content, command.trigger)) {
        await executeKeywordCommand(message, command);
      }
    }
  }
};
```

### Matching Logic

```javascript
function matchesTrigger(content, trigger) {
  if (!trigger?.patterns) return false;

  for (const pattern of trigger.patterns) {
    const testContent = trigger.caseSensitive ? content : content.toLowerCase();
    const testPattern = trigger.caseSensitive ? pattern.pattern : pattern.pattern.toLowerCase();

    let match = false;
    switch (pattern.matchType) {
      case "exact": match = testContent === testPattern; break;
      case "contains": match = testContent.includes(testPattern); break;
      case "starts": match = testContent.startsWith(testPattern); break;
      case "ends": match = testContent.endsWith(testPattern); break;
      case "regex": match = new RegExp(pattern.pattern).test(content); break;
    }

    if (match) return true;
  }
  return false;
}
```

### Rate Limiting

- Separate cooldown per keyword trigger
- Max 10 keyword triggers per minute per guild

### Implementation Steps

#### Step 1: Update Data Model

Add `trigger` field validation in controller.

#### Step 2: Create Message Listener

**File:** `src/events/messageCreate.js`

#### Step 3: Register Listener

**File:** `src/utils/core/eventLoader.js`

Add messageCreate event registration.

#### Step 4: Add Tests

Test keyword matching, regex, case sensitivity, channel restrictions.

---

## Phase 6: Event Triggers

### Current State

No event-based automation.

### Target State

Auto-execute actions on Discord events.

### New Collection

**Collection:** `custom_event_triggers`

```javascript
{
  guildId: string,
  triggerId: string,            // UUID
  name: string,
  enabled: boolean,
  trigger: {
    type: "member_join" | "member_leave" | "member_boost" |
          "role_add" | "role_remove" |
          "channel_create" | "channel_delete" |
          "message_delete" | "message_edit" |
          "voice_join" | "voice_leave" |
          "scheduled" | "webhook",
    roleId?: string,
    channelId?: string,
    schedule?: {
      type: "once" | "daily" | "weekly" | "monthly",
      time: string,             // HH:MM
      day?: number
    },
    webhookSecret?: string
  },
  actions: [{ ... }],
  conditions: [{ ... }],
  createdBy: string,
  createdAt: Date
}
```

### New Listeners

**File:** `src/events/memberJoin.js` (new file)
**File:** `src/events/memberLeave.js` (new file)
**File:** `src/events/roleChange.js` (new file)
**File:** `src/events/channelChange.js` (new file)

### Implementation Steps

#### Step 1: Create Repository

**File:** `src/utils/storage/repositories/CustomEventTriggerRepository.js`

#### Step 2: Create Event Listeners

One file per event type with trigger execution logic.

#### Step 3: Register Listeners

Add to event loader.

#### Step 4: Add Scheduled Event Support

Use node-cron or similar for scheduled triggers.

#### Step 5: Add Webhook Support

Accept external webhooks to trigger events.

---

## Database Migration

### New Collections

1. `custom_variables` — Variable storage
2. `custom_event_triggers` — Event-based automation

### Schema Changes

1. `custom_commands` — Add `trigger`, `conditions` fields
2. `custom_commands.components.buttons` — Add `actions` array
3. `custom_commands.components.selectMenu.options` — Add `actions` array
4. `custom_commands.embed` — Add `fields`, `thumbnail`, `image`, `author`, `timestamp`, `url`

### Migration Script

**File:** `scripts/migrate-custom-commands-v2.js`

```javascript
// 1. Add new fields to existing commands (defaults)
// 2. Create new collections
// 3. Create indexes
// 4. Validate migration
```

---

## Premium Configuration

### Config Updates

**File:** `src/features/premium/config.js`

```javascript
export const FREE_TIER = {
  // ... existing
  CUSTOM_VARIABLES_MAX: 10,
  CUSTOM_KEYWORD_TRIGGERS_MAX: 5,
  CUSTOM_EVENT_TRIGGERS_MAX: 5,
  CUSTOM_EVENT_TYPES: ["member_join", "member_leave"],
};

export const PRO_TIER = {
  // ... existing
  CUSTOM_VARIABLES_MAX: 100,
  CUSTOM_KEYWORD_TRIGGERS_MAX: 25,
  CUSTOM_EVENT_TRIGGERS_MAX: 25,
  CUSTOM_EVENT_TYPES: ["all"],
};
```

### Feature List Update

**File:** `src/commands/general/premium/premiumData.js`

```javascript
includes: [
  // ... existing
  "Custom Commands (25 commands)",
  "Custom Variables (100 variables, user/channel scoping)",
  "Keyword Triggers (25 triggers, regex support)",
  "Event Triggers (25 triggers, all event types)",
  "Conditional Logic (role, channel, variable, permission checks)",
]
```

---

## Testing Strategy

### Unit Tests

- `tests/unit/commands/custom-commands/enhanced-embeds.test.js`
- `tests/unit/commands/custom-commands/button-actions.test.js`
- `tests/unit/commands/custom-commands/variable-storage.test.js`
- `tests/unit/commands/custom-commands/conditional-logic.test.js`
- `tests/unit/commands/custom-commands/keyword-triggers.test.js`
- `tests/unit/commands/custom-commands/event-triggers.test.js`

### Integration Tests

- Button/menu actions end-to-end
- Keyword triggers with messageCreate
- Variable persistence across commands
- Conditional branching

### Premium Gating Tests

- Free tier limits enforced
- Pro tier access granted
- Feature gating (regex, scheduled events)

---

## File Reference

### Modified Files

| File | Changes |
|------|---------|
| `src/server/controllers/GuildCustomCommandController.js` | Validation, storage for new fields |
| `src/utils/core/CustomCommandExecutor.js` | Enhanced embeds, action executor, variable replacement |
| `src/utils/storage/repositories/CustomCommandRepository.js` | Cache updates |
| `src/utils/interactions/routers/buttonRouter.js` | Already routes correctly |
| `src/utils/interactions/routers/selectMenuRouter.js` | Already routes correctly |
| `src/features/premium/config.js` | New limits |
| `src/commands/general/premium/premiumData.js` | Feature list |

### New Files

| File | Purpose |
|------|---------|
| `src/utils/storage/repositories/CustomVariableRepository.js` | Variable CRUD |
| `src/utils/storage/repositories/CustomEventTriggerRepository.js` | Event trigger CRUD |
| `src/events/messageCreate.js` | Keyword trigger listener |
| `src/events/memberJoin.js` | Member join event listener |
| `src/events/memberLeave.js` | Member leave event listener |
| `src/events/roleChange.js` | Role change event listener |
| `src/events/channelChange.js` | Channel change event listener |
| `src/server/routes/v1/variables.js` | Variable API routes |
| `src/server/routes/v1/eventTriggers.js` | Event trigger API routes |
| `scripts/migrate-custom-commands-v2.js` | Database migration |
| `tests/unit/commands/custom-commands/*.test.js` | Test files |

---

## Implementation Order

```
Phase 1 (Week 1-2): Quick Wins
  - Enhanced Embeds (1-2 days)
  - Button/Menu Actions (2-3 days)

Phase 2 (Week 3-4): Foundation
  - Variables/Data Storage (5-7 days)

Phase 3 (Week 5-6): Logic Layer
  - Conditional Logic (5-7 days)

Phase 4 (Week 7-8): Triggers
  - Keyword Triggers (3-5 days)
  - Event Triggers (3-5 days)
```
