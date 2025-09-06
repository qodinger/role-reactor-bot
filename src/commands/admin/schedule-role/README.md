# Schedule Role Command

## Overview

The Schedule Role command lets administrators schedule role assignments for users at specific times or on recurring intervals. It also supports listing, viewing, and canceling scheduled assignments.

## File Structure

```
schedule-role/
├── index.js          # Command definition, subcommands, entry point
├── handlers.js       # Core logic for create/cancel/view flows
├── list.js           # Logic for listing scheduled roles
├── embeds.js         # Discord embed creation for all views
├── utils.js          # Helpers (validation, parsing, formatting)
└── README.md         # This documentation
```

## Architecture

- **`index.js`**: Defines `/schedule-role` with subcommands (`create`, `list`, `cancel`, `view`), routes to handlers, validates permissions, and defers interactions.
- **`handlers.js`**: Implements business logic for scheduling, canceling, and viewing schedules; orchestrates embeds and utils.
- **`list.js`**: Dedicated listing logic for scheduled and recurring roles.
- **`embeds.js`**: Builds all rich embeds used across subcommands.
- **`utils.js`**: Parsing of inputs (times, durations), validation, ID formatting, common helpers.

## Subcommands

- **`/schedule-role create`**: Schedule a role assignment for users.
  - Options: `users` (string, required), `role` (role, required), `type` (choice, required), `schedule` (string, required), `duration` (string, required), `reason` (string, optional)
- **`/schedule-role list`**: List scheduled and recurring role assignments.
- **`/schedule-role cancel`**: Cancel a scheduled or recurring assignment by ID.
  - Options: `id` (string, required)
- **`/schedule-role view`**: View details for a specific schedule by ID.
  - Options: `id` (string, required)

## Usage Examples

```
/schedule-role create users:"123,456" role:@Member type:"one-time" schedule:"tomorrow 9am" duration:"2h" reason:"Event access"
/schedule-role create users:"@User" role:@VIP type:"weekly" schedule:"monday 6pm" duration:"1d"
/schedule-role list
/schedule-role view id:2802a998...7f7a
/schedule-role cancel id:2802a998...7f7a
```

## Permissions Required

- `ManageRoles` for command usage
- Bot requires appropriate role hierarchy and permissions to assign/remove roles

## Key Features

- One-time and recurring schedules (daily/weekly/monthly/custom)
- Natural language-like schedule parsing (e.g., "tomorrow 9am")
- Duration-based temporary role assignments
- Detailed embeds for auditability (who, when, why, duration)
- List, view, and cancel flows for full lifecycle management

## Error Handling

- Validates user and bot permissions
- Clear error messages for invalid IDs, missing roles, or schedule conflicts
- Defensive handling of Discord API errors and timeouts

## Notes

- Ensure the bot’s role is above the target role in the hierarchy.
- Timezone behavior follows the hosting environment unless otherwise configured.
