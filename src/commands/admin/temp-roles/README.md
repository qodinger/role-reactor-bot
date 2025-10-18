# Temp Roles Command

## Overview

The Temp Roles command provides a comprehensive system for managing temporary role assignments that automatically expire after a specified duration. It features a modern, visually appealing interface with rich embeds, smart notifications, and robust error handling. The system consolidates all temporary role functionality under a single command with multiple subcommands for assigning, listing, and removing temporary roles.

## File Structure

```
temp-roles/
├── index.js          # Command definition, subcommands, entry point
├── handlers.js       # Core logic for assign/list/remove flows
├── embeds.js         # Discord embed creation for all views
├── utils.js          # Helpers (validation, processing, logging)
├── deferral.js       # Aggressive deferral utilities (legacy, unused)
└── README.md         # This documentation
```

## Architecture

- **`index.js`**: Defines `/temp-roles` with subcommands (`assign`, `list`, `remove`), routes to handlers, validates permissions, and executes interactions directly without deferral.
- **`handlers.js`**: Implements business logic for assigning, listing, and removing temporary roles; orchestrates embeds and utils.
- **`embeds.js`**: Builds all rich embeds used across subcommands for assignments, listings, and removals.
- **`utils.js`**: Validation functions, role processing, user handling, time calculations, and logging utilities.

## Subcommands

- **`/temp-roles assign`**: Assign temporary roles to users that expire after a set duration.
  - Options: `users` (string, required), `role` (role, required), `duration` (string, required), `reason` (string, optional), `notify` (boolean, optional), `notify-expiry` (boolean, optional)
- **`/temp-roles list`**: List active temporary roles for a user or all users in the server.
  - Options: `user` (user, optional)
- **`/temp-roles remove`**: Remove a temporary role from users before it expires.
  - Options: `users` (string, required), `role` (role, required), `reason` (string, optional)

## Usage Examples

```
/temp-roles assign users:"@User1, @User2" role:@VIP duration:"2d" reason:"Event participation"
/temp-roles assign users:"123456789, 987654321" role:@Moderator duration:"1w" reason:"Trial moderator" notify:true notify-expiry:true
/temp-roles list
/temp-roles list user:@User1
/temp-roles remove users:"@User1, @User2" role:@VIP reason:"Early removal requested"
```

## Permissions Required

- `ManageRoles` for command usage
- Bot requires appropriate role hierarchy and permissions to assign/remove roles
- Bot needs higher role position than target roles in server hierarchy

## Key Features

- **Flexible Duration Support**: Natural duration formats (1h, 2d, 1w, 30m, 1y)
- **Bulk Operations**: Assign and remove roles from multiple users simultaneously with comma separation
- **Flexible Role Removal**: Remove any role the user has, not just temporary ones (handles manual assignments, other bots, etc.)
- **User Input Flexibility**: Support for user mentions (@user) and user IDs
- **Automatic Expiration**: Roles automatically removed when duration expires
- **Comprehensive Validation**: Role hierarchy, permissions, and duration checks
- **Modern Rich Embeds**: Visually appealing embeds with thumbnails, colors, and organized information
- **Smart Notifications**:
  - **Assignment DMs**: Users can receive DMs when roles are assigned (opt-in via `notify` parameter)
  - **Expiration DMs**: Users can receive DMs when roles expire (opt-in via `notify-expiry` parameter)
- **Visual Status Indicators**: Warning emojis (⚠️) for roles expiring soon (≤5 minutes)
- **Enhanced User Experience**: Sorted lists, role counts, server statistics, and quick action suggestions
- **Activity Logging**: All actions logged for audit purposes

## Duration Formats

- **Minutes**: `30m`, `45m`
- **Hours**: `1h`, `24h`
- **Days**: `1d`, `7d`
- **Weeks**: `1w`, `2w`
- **Years**: `1y`
- **Mixed**: `1d 12h`, `2w 3d`

**Limits**: Minimum 1 minute, Maximum 1 year

## Interaction Handling

- **Direct Execution**: Commands execute immediately without deferral to prevent timeout issues
- **Double-Reply Prevention**: All error handlers check interaction state before replying
- **Ephemeral Responses**: All responses use `MessageFlags.Ephemeral` for better user experience
- **Timeout Resilience**: Eliminates "Unknown interaction" and "Interaction has already been acknowledged" errors
- **Immediate Feedback**: Users receive instant responses without "thinking" state delays

## Error Handling

- Validates user and bot permissions before execution
- Clear error messages for invalid users, roles, or durations
- Graceful handling of Discord API errors and rate limits
- Defensive validation of role hierarchy and bot capabilities
- Comprehensive logging for debugging and audit trails
- Prevents double replies with interaction state checking

## User Experience

- **Modern Visual Design**: Two-column layouts, thumbnails, and color-coded information
- **Assignment Results**: Shows success/failure counts and detailed issue reporting
- **Time Display**: Human-readable time remaining and Discord timestamp formatting
- **Role Information**: Display role colors, names, hierarchy position, and hex colors
- **Smart Organization**: Alphabetically sorted users, role counts, and server statistics
- **Visual Status Indicators**: Warning emojis for expiring roles and status-appropriate colors
- **Batch Processing**: Parallel processing with rate limiting for multiple users (both assignment and removal)
- **Quick Actions**: Easy command suggestions with emojis for follow-up actions
- **Empty States**: Proper handling when no temporary roles exist

## Notes

- Ensure the bot's role is above target roles in the hierarchy
- Users with existing roles will skip assignment to prevent duplicates
- DM notifications are sent when possible but failures are handled gracefully
- **Expiration notifications** are now fully functional and respect the `notify-expiry` setting
- Expired roles are automatically filtered from list views
- Role assignments persist across bot restarts via database storage
- All times are displayed in Discord timestamp format for user's timezone
- **Modern embed design** provides comprehensive information with visual appeal

## Expiration System

The bot automatically handles temporary role expiration:

- **Automatic Cleanup**: Roles are checked every 30 seconds and removed when expired
- **Database Management**: Expired role records are automatically cleaned up
- **Smart Notifications**: Users receive DM notifications when their roles expire (if `notify-expiry` was enabled)
- **Enhanced Notifications**: Expiration DMs include role details, server info, and expiration timestamps
- **No Manual Intervention**: Expired roles don't need to be manually removed
- **Visual Feedback**: List view shows warning indicators for roles expiring soon (≤5 minutes)

## Recent Improvements

### 🎨 Visual Design Overhaul

- **Modern Embed Layout**: Two-column designs with better information organization
- **Visual Enhancements**: Role thumbnails, user avatars, server icons, and color-coded information
- **Status Indicators**: Warning emojis (⚠️) for roles expiring soon, standard emojis (⏰) for others
- **Enhanced Typography**: Better text formatting, bold headers, and structured information display

### 🔔 Notification System Fixes

- **Fixed Expiration Notifications**: Expiration DMs now work correctly and respect the `notify-expiry` setting
- **Enhanced DM Content**: Assignment and expiration DMs include comprehensive role and server information
- **Database Schema Updates**: Added `notifyExpiry` field to store user preferences for expiration notifications
- **Improved Error Handling**: Better handling of DM failures with graceful degradation

### 📊 User Experience Enhancements

- **Smart Organization**: Alphabetically sorted users and roles for consistent display
- **Statistics Display**: Server statistics showing total roles, affected users, and role counts
- **Quick Actions**: Easy-to-find command suggestions with emojis for better navigation
- **Empty State Handling**: Proper display when no temporary roles exist
- **Improved Time Display**: Discord timestamp formatting for better timezone support

### 🛠️ Technical Improvements

- **Database Integration**: Enhanced storage system supporting notification preferences
- **Scheduler Updates**: Improved role expiration scheduler with notification support
- **Error Handling**: Better error messages and logging for debugging
- **Performance**: Optimized role processing and display logic

### 🗑️ Bulk Removal Feature

- **Multiple User Support**: Remove temporary roles from multiple users simultaneously
- **Consistent Interface**: Same user input format as assignment (comma-separated mentions/IDs)
- **Flexible Role Removal**: Can remove any role the user has, not just temporary ones
  - Removes roles from Discord regardless of how they were assigned
  - Automatically cleans up temporary roles database when applicable
  - Handles manually assigned roles, other bot assignments, etc.
- **Comprehensive Validation**: Validates each user's role assignment before removal
- **Detailed Results**: Shows success/failure counts with specific error details
- **Modern Embed Design**: New removal embed with role details and removal statistics
- **Parallel Processing**: Rate-limited concurrent processing for optimal performance
- **Robust Error Handling**: Fixed user list processing and undefined error issues

### 🐛 Recent Bug Fixes

- **Fixed "Invalid User List" Error**: Resolved issues with user list processing in remove command
- **Fixed Undefined User Errors**: Corrected data structure handling in bulk removal operations
- **Improved Function Calls**: Fixed `processUserList` parameter passing and async handling
- **Enhanced Data Extraction**: Proper handling of user objects from validation results
- **Better Error Messages**: More accurate error reporting with actual user information instead of `<@Unknown>`

### ⚡ Interaction Timeout Fixes (Latest)

- **Removed Deferral System**: Eliminated aggressive deferral pattern that was causing timeouts
- **Direct Execution**: Commands now execute immediately without deferral to prevent "Unknown interaction" errors
- **Double-Reply Prevention**: Added interaction state checks to prevent "Interaction has already been acknowledged" errors
- **MessageFlags.Ephemeral**: Updated to use proper Discord.js flags instead of deprecated `ephemeral` property
- **Timeout Resilience**: Commands now work reliably even with slow Discord API responses
- **Immediate User Feedback**: Users receive instant responses without "thinking" state delays
