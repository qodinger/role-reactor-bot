# Action Registry System

## Overview

The Action Registry is a centralized configuration system for all AI actions. It provides a single source of truth for action definitions, making it easy to add, modify, or remove actions without touching multiple files.

## Benefits

### Before Refactoring

- ❌ Action types hardcoded in multiple places (validation, execution, re-query logic)
- ❌ Adding new actions required changes in 3+ files
- ❌ Easy to forget updating one of the lists
- ❌ No metadata about actions (category, behavior, etc.)
- ❌ Difficult to maintain and extend

### After Refactoring

- ✅ Single source of truth (`actionRegistry.js`)
- ✅ Add new actions in one place
- ✅ Automatic validation, routing, and re-query logic
- ✅ Rich metadata (category, requiresGuild, triggersReQuery, blocked, etc.)
- ✅ Easy to maintain and extend

## File Structure

```
src/utils/ai/
├── actionRegistry.js    # Centralized action configuration
├── chatService.js       # Uses registry for validation and execution
└── ACTION_REGISTRY.md    # This documentation
```

## Adding a New Action

### Step 1: Add to Registry

Edit `src/utils/ai/actionRegistry.js` and add your action to `ACTION_REGISTRY`:

```javascript
export const ACTION_REGISTRY = {
  // ... existing actions ...

  // Your new action
  my_new_action: {
    type: "my_new_action",
    category: ACTION_CATEGORIES.DATA_RETRIEVE, // or DATA_FETCH, COMMAND_EXEC, etc.
    requiresGuild: true, // Does it need server context?
    triggersReQuery: false, // Should AI re-query after execution?
    blocked: false, // Is it blocked for security?
    requiresOptions: true, // Does it need options?
    requiredOptions: ["param1", "param2"], // Required option keys
    description: "What this action does",
  },
};
```

### Step 2: Implement Handler

Add the execution logic in `src/utils/ai/chatService.js` in the `executeStructuredActions` method:

```javascript
case "my_new_action":
  // Your implementation here
  break;
```

### Step 3: Done!

That's it! The registry automatically handles:

- ✅ Validation (blocked check, options validation, guild requirement)
- ✅ Re-query logic (if `triggersReQuery: true`)
- ✅ Server action filtering (if `requiresGuild: true`)

## Action Configuration Schema

```typescript
{
  type: string                    // Action type identifier (must match key)
  category: ACTION_CATEGORIES     // Action category
  requiresGuild: boolean          // Requires server context?
  triggersReQuery: boolean       // Triggers AI re-query?
  blocked: boolean               // Is it blocked?
  blockReason?: string           // Reason if blocked
  requiresOptions: boolean        // Needs options object?
  requiredOptions?: string[]     // Required option keys
  description: string            // Human-readable description
}
```

## Action Categories

- `DATA_FETCH` - Fetches data from Discord (triggers re-query)
- `DATA_RETRIEVE` - Retrieves specific data (read-only, no re-query)
- `COMMAND_EXEC` - Executes bot commands
- `ADMIN` - Admin actions (blocked)
- `MODERATION` - Moderation actions (blocked)

## Registry Functions

### Query Functions

```javascript
import {
  getActionConfig, // Get action config by type
  isActionBlocked, // Check if action is blocked
  actionRequiresGuild, // Check if action needs guild
  actionTriggersReQuery, // Check if action triggers re-query
  getServerActions, // Get all actions requiring guild
  getReQueryActions, // Get all actions triggering re-query
  getBlockedActions, // Get all blocked actions
  getAllowedActions, // Get all allowed actions
  getActionsByCategory, // Get actions by category
} from "./actionRegistry.js";
```

### Validation Function

```javascript
import { validateActionOptions } from "./actionRegistry.js";

const validation = validateActionOptions(action);
if (!validation.isValid) {
  console.error(validation.error);
}
```

## Examples

### Example 1: Adding a Read-Only Data Action

```javascript
// In actionRegistry.js
get_user_stats: {
  type: "get_user_stats",
  category: ACTION_CATEGORIES.DATA_RETRIEVE,
  requiresGuild: true,
  triggersReQuery: false,
  blocked: false,
  requiresOptions: true,
  requiredOptions: ["user_id"],
  description: "Get user statistics",
},
```

```javascript
// In chatService.js executeStructuredActions
case "get_user_stats":
  if (!guild) {
    results.push("Cannot get user stats: not in a server");
    break;
  }
  // Implementation...
  break;
```

### Example 2: Adding a Data Fetch Action (Triggers Re-Query)

```javascript
// In actionRegistry.js
fetch_emojis: {
  type: "fetch_emojis",
  category: ACTION_CATEGORIES.DATA_FETCH,
  requiresGuild: true,
  triggersReQuery: true,  // ← This triggers re-query!
  blocked: false,
  requiresOptions: false,
  description: "Fetch all server emojis",
},
```

The re-query logic is **automatic** - no code changes needed!

### Example 3: Blocking an Action

```javascript
// In actionRegistry.js
dangerous_action: {
  type: "dangerous_action",
  category: ACTION_CATEGORIES.ADMIN,
  requiresGuild: true,
  triggersReQuery: false,
  blocked: true,  // ← Blocked!
  blockReason: "This action is not available for security reasons",
  requiresOptions: true,
  requiredOptions: ["param"],
  description: "Dangerous action (BLOCKED)",
},
```

The validation is **automatic** - no code changes needed!

## Migration Notes

### What Changed

1. **Validation**: Now uses `validateActionOptions()` from registry
2. **Server Actions**: Now uses `actionRequiresGuild()` from registry
3. **Re-Query Logic**: Now uses `actionTriggersReQuery()` from registry
4. **Blocked Actions**: Now uses `isActionBlocked()` from registry

### What Stayed the Same

- Action execution logic (still in `executeStructuredActions` switch)
- Action format (still JSON with `type` and `options`)
- Error handling and responses

## Future Enhancements

Potential improvements:

- Action permissions (user-level restrictions)
- Action rate limiting per type
- Action logging/auditing
- Action metadata for AI system prompt
- Action dependencies (action A requires action B first)

## See Also

- `src/utils/ai/chatService.js` - Action execution
- `src/utils/ai/discordActionExecutor.js` - Discord action handlers
- `src/utils/ai/commandExecutor.js` - Command execution
