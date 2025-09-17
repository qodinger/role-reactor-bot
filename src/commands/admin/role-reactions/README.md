# Role Reactions Command

## Overview

The Role Reactions command lets administrators create, manage, and maintain role-reaction messages where users can click emoji reactions to assign or remove roles. It consolidates all role-reaction functionality under a single command with multiple subcommands.

## File Structure

```
role-reactions/
├── index.js              # Command definition, subcommands, entry point
├── handlers.js           # Main command handlers (setup/list/delete/update)
├── embeds.js             # Discord embed creation for all views
├── utils.js              # Core utilities (role processing, mapping, color choices)
├── validation.js         # Interaction validation and bot member checks
├── deferral.js           # Safe interaction deferral with timeout protection
├── permissions.js        # Guild and channel permission validation
├── messageOperations.js  # Message creation, reaction handling, and role mapping
└── README.md             # This documentation
```

## Architecture

### **Core Files**

- **`index.js`**: Defines `/role-reactions` with subcommands (`setup`, `list`, `delete`, `update`), routes to handlers, validates permissions, and defers interactions.
- **`handlers.js`**: Main command handlers that orchestrate the business logic flow using utility modules.
- **`embeds.js`**: Builds all rich embeds used across subcommands for setup, listing, and updates.
- **`utils.js`**: Core utilities for role processing, role mapping functions, and color choices.

### **Utility Modules**

- **`validation.js`**: Interaction validation, bot member availability checks, and standardized error responses.
- **`deferral.js`**: Safe interaction deferral with timeout protection for both commands and button updates.
- **`permissions.js`**: Comprehensive permission validation for guild-level and channel-level permissions.
- **`messageOperations.js`**: Message creation, reaction handling, role input processing, and role mapping persistence.

## Subcommands

- **`/role-reactions setup`**: Create a new role-reaction message.
  - Options: `title` (string, required), `description` (string, required), `roles` (string, required), `color` (choice, optional)
- **`/role-reactions list`**: List all role-reaction messages in the server.
- **`/role-reactions delete`**: Delete a role-reaction message by ID.
  - Options: `message_id` (string, required)
- **`/role-reactions update`**: Update an existing role-reaction message.
  - Options: `message_id` (string, required), `title` (string, optional), `description` (string, optional), `roles` (string, optional), `color` (choice, optional)

## Usage Examples

```
/role-reactions setup title:"Choose Your Roles" description:"React to get roles!" roles:"🎮 @Gamer, 🎨 @Artist, 📚 @Reader" color:"Pastel Blue"
/role-reactions list
/role-reactions update message_id:"1234567890" title:"Updated Title" color:"Pastel Green"
/role-reactions delete message_id:"1234567890"
```

## Permissions Required

- `ManageRoles` for command usage
- Bot requires appropriate role hierarchy and permissions to assign/remove roles
- Bot needs `AddReactions` and `ManageMessages` permissions in target channels

## Key Features

- Interactive role assignment via emoji reactions
- Customizable embed titles, descriptions, and colors
- Pastel color palette with visual emoji indicators
- Role format: "emoji @role" or "emoji rolename"
- Automatic reaction addition to messages
- Paginated list view (4 items per page) with navigation buttons
- Update functionality for modifying existing messages

## Error Handling

- Validates user and bot permissions before execution
- Clear error messages for invalid message IDs, missing roles, or format errors
- Defensive handling of Discord API errors and rate limits
- Graceful handling of missing channels or deleted messages

## Notes

- Ensure the bot's role is above target roles in the hierarchy
- Role format supports both role mentions (@role) and role names
- Color choices are centralized in utils.js for easy maintenance
- Messages persist until manually deleted or bot loses access
