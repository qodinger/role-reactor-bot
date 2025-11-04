# Schedule Role Command

## Overview

The `/schedule-role` command allows you to schedule automatic role assignments and removals. You can create one-time schedules (assign/remove a role at a specific date/time) or recurring schedules (daily, weekly, monthly, or custom intervals).

## File Structure

```
schedule-role/
├── index.js          # Command definition, subcommands, entry point
├── handlers.js       # Core logic for create/list/view/cancel flows
├── embeds.js         # Discord embed creation for all views
├── utils.js          # Helpers (validation, processing, formatting)
└── README.md         # This documentation
```

## Architecture

Following the modular pattern established by other admin commands:

- **`index.js`**: Command definition, permission validation, and main execution flow
- **`handlers.js`**: Core business logic, database operations, and interaction processing
- **`embeds.js`**: Discord embed creation and formatting
- **`utils.js`**: Helper functions, validation, and logging utilities

## Subcommands

- **`/schedule-role create`**: Create a new scheduled role assignment or removal
  - Options: `action` (string, required), `role` (role, required), `users` (string, required), `all-members` (boolean, optional), `schedule-type` (string, required), `schedule` (string, required), `reason` (string, optional)
- **`/schedule-role list`**: List all active scheduled roles for the current server
  - Options: `page` (integer, optional)
- **`/schedule-role view`**: View details of a specific scheduled role
  - Options: `schedule-id` (string, required)
- **`/schedule-role cancel`**: Cancel a scheduled role before it executes
  - Options: `schedule-id` (string, required)

## Usage Examples

```
# One-time: Assign role tomorrow at 8am
/schedule-role create action:assign role:@EventRole users:@user1,@user2 schedule-type:one-time schedule:"tomorrow 8am"

# Daily: Assign role every day at 9am
/schedule-role create action:assign role:@RestrictedRole users:@user1 schedule-type:daily schedule:"9am" reason:"Night shift restriction"

# Weekly: Remove role every Monday at 8am
/schedule-role create action:remove role:@WeekendRole users:@user1 schedule-type:weekly schedule:"monday 8am"

# Monthly: Assign role on the 15th of every month at 2pm
/schedule-role create action:assign role:@MonthlyEventRole users:@user1 schedule-type:monthly schedule:"15 2pm"

# Custom: Assign role every 30 minutes
/schedule-role create action:assign role:@TempRole users:@user1 schedule-type:custom schedule:"30"

# Target all members
/schedule-role create action:assign role:@EventRole users:@everyone schedule-type:daily schedule:"9am"

# Target members by role
/schedule-role create action:assign role:@PremiumRole users:@VerifiedRole schedule-type:daily schedule:"9am"

# Mix users and roles
/schedule-role create action:assign role:@EventRole users:@user1,@user2,@VerifiedRole schedule-type:daily schedule:"9am"

# List schedules
/schedule-role list page:1

# View schedule
/schedule-role view schedule-id:"abc123-def456-ghi789"

# Cancel schedule
/schedule-role cancel schedule-id:"abc123-def456-ghi789"
```

## Permissions Required

- `ManageRoles` permission
- Admin role or equivalent

## Key Features

### Schedule Types

- **One-Time**: Execute once at a specific date/time
  - Relative time: `in 2 hours`, `tomorrow 8am`, `next friday 2pm`
  - Absolute time: `2024-01-15 14:30`, `Jan 15 2024 2:30pm`
  - Natural language: `tonight`, `morning`, `afternoon`, `evening`
- **Daily**: Every day at a specific time (e.g., `9am`, `2:30pm`, `14:30`)
- **Weekly**: Every week on a specific day and time (e.g., `monday 9am`, `friday 6pm`)
- **Monthly**: Every month on a specific day and time (e.g., `15 2pm`, `1 9am`)
- **Custom**: Every N minutes (e.g., `60` for every hour, `1440` for every day)

### Targeting Options

- **Individual Users**: Specify up to 10 users by mention or ID
- **All Members**: Use `@everyone`, `everyone`, `all`, or `all-members:true` option
- **Role-Based**: Target members who have specific roles by mentioning those roles
- **Mixed**: Combine user mentions and role mentions in the same command

### Voice Channel Management

When assigning restrictive roles, the bot automatically handles users who are already in voice channels:

- **Disconnects** users from voice channels if the role has `Connect` permission disabled
- **Mutes** users if the role has `Speak` permission disabled
- Prevents users from joining voice channels (via role permissions)

**Requirements:**

- Bot needs `Move Members` permission (guild-level) for disconnecting users
- Bot needs `Mute Members` permission (guild-level) for muting users
- Restrictive role must have `Connect`/`Speak` permissions disabled in voice channel settings

### Performance Optimization

- Adaptive batch processing based on operation size
- Automatic rate limit detection and backoff
- Chunked execution for large operations (>1000 users)
- Member caching to reduce API calls
- Optimized executor for operations >50 users

## Limitations

1. **Maximum users per schedule**: 10 users per schedule when specifying individual users
2. **All members option limit**: Maximum of 10,000 members when using `@everyone`
3. **Role-based targeting limit**: Combined total of members with mentioned roles must not exceed 10,000 members
4. **Custom interval limit**: Minimum 1 minute, maximum 10080 minutes (1 week)
5. **Role hierarchy**: Bot must be above the target role in the role hierarchy
6. **Managed roles**: Cannot schedule assignments for Discord-managed roles or bot roles

## Schedule Format Reference

### One-Time Schedules

- `in 2 hours` - 2 hours from now
- `tomorrow 8am` - Tomorrow at 8:00 AM
- `friday 2pm` - Next Friday at 2:00 PM
- `next monday 9am` - Next Monday at 9:00 AM
- `2024-01-15 14:30` - Specific date and time
- `tonight` - Tonight (defaults to 6pm)
- `morning` - Morning (defaults to 9am)
- `afternoon` - Afternoon (defaults to 2pm)
- `evening` - Evening (defaults to 7pm)

### Daily Schedules

- `9am` - Every day at 9:00 AM
- `2:30pm` - Every day at 2:30 PM
- `14:30` - Every day at 2:30 PM (24-hour format)
- `09:00` - Every day at 9:00 AM (24-hour format)

### Weekly Schedules

- `monday 9am` - Every Monday at 9:00 AM
- `friday 6pm` - Every Friday at 6:00 PM
- `wednesday 14:30` - Every Wednesday at 2:30 PM (24-hour format)

### Monthly Schedules

- `15 2pm` - 15th of every month at 2:00 PM
- `1 9am` - 1st of every month at 9:00 AM
- `31 14:30` - 31st of every month at 2:30 PM (24-hour format)

### Custom Intervals

- `30` - Every 30 minutes
- `60` - Every 1 hour (60 minutes)
- `1440` - Every 1 day (1440 minutes = 24 hours)
- `10080` - Every 1 week (10080 minutes = 7 days)

## Dependencies

- Discord.js
- Database manager for scheduled role storage
- Schedule parser for parsing schedule strings
- Theme configuration for colors and emojis
- Permission validation utilities
- Optimized role executor for large operations
