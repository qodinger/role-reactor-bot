# Schedule Role Feature Status

## 📋 Overview

The `/schedule-role` command was removed from the bot due to persistent technical issues. This document explains why it was removed, what it could do, its limitations, and plans for potential restoration.

## 🔴 Why It Was Removed

The `/schedule-role` feature was removed because it was causing technical issues:

- **Schedules sometimes failed to execute** - Role assignments/removals would occasionally not run at the scheduled time
- **Recurring schedules got stuck** - Daily/weekly schedules would stop working after a period
- **Database conflicts** - The feature created conflicts with the database that affected the bot's performance

Rather than maintain a broken feature that could impact the bot's stability, it was removed to focus on more reliable features.

## ✅ What It Could Do

If the feature were restored and working properly, it could handle:

### Scheduled Role Assignment/Removal

- **One-time schedules** - Assign or remove a role at a specific date/time
  - Examples: `tomorrow 8am`, `friday 2pm`, `in 2 hours`
- **Recurring schedules** - Automatically assign/remove roles on a schedule
  - **Daily**: `9am` - Every day at 9am
  - **Weekly**: `monday 9am` - Every Monday at 9am
  - **Monthly**: `15 2pm` - 15th of every month at 2pm
  - **Custom**: Interval-based (e.g., every 30 minutes)

### Use Cases It Could Solve

**Example: Voice Channel Restriction**

If you want to restrict voice channel access during certain hours:

1. Create a "Restricted" role with voice channel "Connect" permission denied
2. Schedule it to assign at 11pm daily
3. Schedule it to remove at 8am daily

This would prevent users from joining voice channels during restricted hours.

**Example: Event Roles**

- Automatically assign event participant roles on event days
- Remove temporary roles after events end
- Set up recurring weekly event roles

**Example: Time-Limited Access**

- Grant special roles for limited time periods
- Remove access after expiration
- Set up recurring access windows

## ❌ What It Couldn't Do (Limitations)

The feature had several limitations that would require additional development:

### 1. Voice Management Features

**Cannot mute users already in voice channels**

- Would need server-wide mute functionality
- Requires `member.voice.setMute(true)` API calls
- Not included in basic role assignment

**Cannot disconnect users from voice channels**

- Would need force-disconnect functionality
- Requires `member.voice.disconnect()` API calls
- Not included in basic role assignment

**Note:** Role-based permissions prevent joining voice channels, but don't affect users already connected.

### 2. Bulk Role Assignment

**Cannot automatically target all members with a specific opt-in role**

- Would need to iterate through all guild members
- Would need to filter by role membership
- Would need bulk assignment logic

**Example use case:**

- "Assign 'Restricted' role to everyone who has 'Night Owl' role"
- Would require enhancement to support role-based targeting

### 3. Advanced Scheduling

**Limited timezone support**

- Would need timezone detection/per-user timezones
- Would need to handle daylight saving time changes

**No conditional logic**

- Couldn't schedule based on conditions (e.g., "only if user is in voice")
- Would need to add conditional scheduling features

## 🔧 Technical Details

### Removed Components

The following components were removed with the feature:

- `/schedule-role` command and all handlers
- `RoleScheduler` class (background scheduler)
- `scheduled_roles` database collection
- `recurring_schedules` database collection
- Schedule execution logic
- Help documentation references

### What Remains

The following utility functions remain in the codebase (for potential future use):

- `scheduleParser.js` - Natural language schedule parsing
  - One-time schedule parsing
  - Recurring schedule parsing (daily, weekly, monthly, custom)
  - Natural language time parsing ("tomorrow 9am", "monday 6pm", etc.)

### Similar Features Still Available

**Temporary Roles (`/temp-roles`)**

- Assign roles with expiration times
- Automatic role removal after duration
- One-time scheduled roles (e.g., `2h`, `1d`)
- Does NOT support recurring schedules

**Example:**

```bash
/temp-roles assign users:@user1 role:@EventRole duration:2h
# Role automatically removed after 2 hours
```

**Limitations compared to schedule-role:**

- No recurring schedules (daily, weekly)
- No absolute time scheduling (specific date/time)
- No role-based bulk assignment

## 🚀 Potential Restoration Plans

If there's sufficient demand, the feature could be rebuilt with:

### Phase 1: Core Functionality (Basic Restoration)

1. **Fix underlying technical issues**
   - Reliable schedule execution
   - Proper database handling
   - No recurring schedule conflicts

2. **Basic one-time and recurring schedules**
   - Single user role assignment/removal
   - Daily, weekly, monthly recurring schedules

### Phase 2: Enhanced Features

1. **Bulk role assignment**
   - Target all members with a specific role
   - Bulk assign/remove operations

2. **Voice management integration**
   - Server-wide mute functionality
   - Force disconnect from voice channels
   - Combined with role assignment

3. **Advanced scheduling**
   - Conditional scheduling
   - Timezone support
   - Complex recurring patterns

### Phase 3: User Experience Improvements

1. **Better error handling**
   - Clear error messages
   - Retry logic for failed schedules
   - Schedule status monitoring

2. **Enhanced UI**
   - List all active schedules
   - Edit/cancel schedules
   - Schedule preview/validation

## 💡 Current Workarounds

Until the feature is restored, you can use:

### 1. Temporary Roles (Partial Solution)

```bash
/temp-roles assign users:@user1,@user2 role:@RestrictedRole duration:8h
# Assign role that expires in 8 hours
```

**Limitations:**

- Must run manually each time
- No recurring schedules
- No specific time scheduling (only duration-based)

### 2. Bot Automation (External)

Use external automation tools or bots that support scheduled role management:

- **YAGPDB** - Supports scheduled commands with limitations
- **Custom Discord bots** - With scheduled role features
- **Discord Automod** - Limited scheduled actions

### 3. Manual Role Management

- Use Discord's built-in role management
- Schedule reminders to manually assign/remove roles
- Use server automation features where available

## 📝 Feedback & Requests

If you need this feature restored, please provide feedback on:

1. **Your specific use case** - What are you trying to accomplish?
2. **Required features** - Which limitations are deal-breakers?
3. **Priority** - How important is this feature for your server?

This information helps prioritize feature development and ensures restored functionality meets real-world needs.

## 🔗 Related Documentation

- [CHANGELOG.md](./CHANGELOG.md) - Version history and feature changes
- [Temp Roles README](../src/commands/admin/temp-roles/README.md) - Current temporary role functionality
- [Role Reactions README](../src/commands/admin/role-reactions/README.md) - Role management features

## 📅 Last Updated

This document was last updated to reflect the current status of the schedule-role feature and potential restoration plans.
