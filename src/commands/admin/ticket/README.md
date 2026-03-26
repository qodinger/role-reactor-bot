# Ticket Command

## Overview

The Ticket command provides a complete support and request management system embedded natively into the bot. It enables interactive ticket panels, dynamic staff control, and robust archiving through highly scalable transcript outputs ranging from markdown logs to full HTML exports via the Pro Engine.

## File Structure

```
ticket/
├── handlers/         # Specialized handler logic
│   ├── admin.js      # Panel creation and settings
│   ├── general.js    # Transcripts and logging
│   └── staff.js      # Granular ticket overrides and modifications
├── index.js          # Command definition, subcommands, entry point
├── utils.js          # Core utilities (formatting, embedding, mapping)
└── README.md         # This documentation
```

## Architecture

Following the modular pattern established by other admin commands:

- **`index.js`**: Command definition, permission validation, and main execution flow
- **`handlers/admin.js`**: Core business logic for setting up ticketing panels and server configurations
- **`handlers/general.js`**: General processing logic tailored to handling exports and user operations
- **`handlers/staff.js`**: Direct modification actions covering ticket rename, transfer, adding, and removing users
- **`utils.js`**: Helper functions, validation, and localized routing logic

## Subcommands

- **`/ticket setup`**: Create a new ticket panel
  - Options: `channel` (channel, required), `title` (string, optional), `description` (string, optional), `color` (string, optional)
- **`/ticket info`**: View ticket system information and limits
- **`/ticket settings`**: Interactive ticketing dashboard configuration
- **`/ticket panel list`**: List all ticket panels currently deployed in the server
- **`/ticket panel delete`**: Delete a ticket panel from existence by ID
  - Options: `panel-id` (string, required)
- **`/ticket close`**: Terminate and securely archive the current ticket
  - Options: `reason` (string, optional)
- **`/ticket add`**: Invite secondary users to the active ticket
  - Options: `member` (user, required)
- **`/ticket remove`**: Remove secondary users from the ticket
  - Options: `member` (user, required)
- **`/ticket transfer`**: Swap the ticket ownership securely
  - Options: `staff` (user, required)
- **`/ticket rename`**: Provide a granular name override for the active ticket
  - Options: `name` (string, required)
- **`/ticket transcript`**: Get the full session history of comments and embeds inside the ticket
  - Options: `ticket-id` (string, required), `format` (string, optional)

## Usage Examples

```
/ticket setup channel:#support title:"Server Support" color:Blurple
/ticket panel list
/ticket panel delete panel-id:1
/ticket transcript ticket-id:15 format:HTML
/ticket close reason:"Issue resolved successfully"
/ticket add member:@StaffMember
/ticket remove member:@Spammer
/ticket transfer staff:@SeniorTeam
/ticket rename name:bug-report-v2
```

## Permissions Required

- `ManageGuild` permission (for setup, settings, panels, and info)
- Configured "Support Role" or Staff role (for add, remove, transfer, rename)
- Ticket Creator or Staff (for close, transcript)

## Key Features

- Interactive Ticket Panels that streamline user interactions easily
- Safe access controls with dynamically generated private channels
- Granular Staff features to `add`, `remove`, `transfer`, and `rename` ongoing tickets
- Complete system isolation limiting unauthorized members from seeing active discussions
- Detailed transcript exports using `markdown`, `json`, or enterprise `html` layouts
- Active dashboard for administrators to view live stats (`/ticket info`) and parameters (`/ticket settings`)

## Dependencies

- Discord.js
- Database manager for tracking active Ticket Channels and deployed Panels
- Theme configuration for colors and emojis
- Permission validation utilities
