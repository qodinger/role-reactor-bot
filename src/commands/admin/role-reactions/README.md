# Role Reactions Command

## Overview

The Role Reactions command lets administrators create, manage, and maintain role-reaction messages where users can click emoji reactions to assign or remove roles.

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

Following the modular pattern established by other admin commands:

- **`index.js`**: Command definition, permission validation, and main execution flow
- **`handlers.js`**: Core business logic, database operations, and interaction processing
- **`embeds.js`**: Discord embed creation and formatting
- **`utils.js`**: Helper functions, validation, and color choices
- **`validation.js`**: Interaction validation and bot member checks
- **`deferral.js`**: Safe interaction deferral with timeout protection
- **`permissions.js`**: Guild and channel permission validation
- **`messageOperations.js`**: Message creation, reaction handling, and role mapping

## Subcommands

- **`/role-reactions setup`**: Create a new role-reaction message
  - Options: `title` (required), `description` (required), `roles` (required), `color` (optional)
- **`/role-reactions list`**: List all role-reaction messages in the server
- **`/role-reactions delete`**: Delete a role-reaction message by ID
  - Options: `message_id` (required)
- **`/role-reactions update`**: Update an existing role-reaction message
  - Options: `message_id` (required), `title` (optional), `description` (optional), `roles` (optional), `color` (optional)

## Usage Examples

```
/role-reactions setup title:"Choose Your Roles" description:"React to get roles!" roles:"🎮:Gamer,🎨:Artist,💻:Developer" color:"Neon Blue"
/role-reactions setup title:"Role Selection" description:"Pick your roles!" roles:"🎮 @Gamer, 🎨 @Artist, 📚 @Reader" color:"Matrix Green"
/role-reactions setup title:"Limited Roles" description:"Limited availability!" roles:"🎮:Gamer:10,🎨:Artist:5,💻:Developer" color:"Quantum Purple"
/role-reactions setup title:"Quoted Names" description:"Special role names!" roles:"🎮 \"Gaming Enthusiast\", 🎨 \"Creative Artist\", 💻 \"Code Master\"" color:"Default"
/role-reactions list
/role-reactions update message_id:"1234567890" title:"Updated Title" color:"Cyber Red"
/role-reactions delete message_id:"1234567890"
```

## Permissions Required

- `ManageRoles` permission
- Admin role or equivalent

## Key Features

- Interactive role assignment via emoji reactions
- Customizable embed titles, descriptions, and colors
- Cyberpunk color palette with futuristic themes
- Multiple role format support (emoji:role, emoji @role, emoji "role name")
- Automatic reaction addition to messages
- Paginated list view with navigation buttons
- Update functionality for modifying existing messages

## Available Colors

- **Default** - Bot's theme color (soft lavender)
- **Neon Blue** - Bright cyberpunk blue
- **Matrix Green** - Iconic Matrix digital rain color
- **Cyber Red** - Aggressive cyberpunk red
- **Electric Yellow** - Pure electric yellow
- **Quantum Purple** - Mystical quantum purple
- **Plasma Orange** - Hot plasma orange
- **Synth Pink** - Synthetic digital pink
- **Hologram Cyan** - Holographic cyan
- **Steel Brown** - Industrial steel brown
- **Chrome Gray** - Polished chrome gray

## Role Format & Limits

The system natively supports singular roles, limits, nested bundles, and dynamic arrays.

**Formats:**

- `emoji:role` - Simple format (🎮:Gamer)
- `emoji:@role` - Role mention format (🎮:@Gamer)
- `emoji:"Role Name"` - Quoted role names (🎮:"Gaming Enthusiast")
- `emoji:role:limit` - With user limit (🎮:Gamer:10)
- `emoji:[BundleName]` - Imports a saved Multi-Role Bundle (💡:[Starter Pack])
- `emoji:[@Role1, @Role2]` - Creates an inline multi-role array instantly (💡:[@Artist, @Coder])

**Tier Limits:**

- **Active Menus per Server:** 3 Menus (Free Tier) | 20 Menus (Pro Engine)
- **Emojis per Menu:** 10 Emojis (Free Tier) | 20 Emojis (Pro Engine)
- **Roles per Bundle/Array:** 5 Roles (Free Tier) | 15 Roles (Pro Engine)

## Dependencies

- Discord.js
- Database manager for role mappings
- Theme configuration for colors and emojis
- Permission validation utilities
