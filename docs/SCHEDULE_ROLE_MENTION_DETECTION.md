# Mention Detection Guide

This document explains how the `/schedule-role` command differentiates between user mentions and role mentions.

## Discord Mention Formats

Discord uses different formats for mentioning users vs roles. The bot uses these patterns to detect what type of mention you're using.

### User Mentions

**Format:** `<@123456789>` or `<@!123456789>`

- `<@` - Opening tag
- `!` - Optional, indicates nickname mention (can be omitted)
- `123456789` - User ID (17-19 digits)
- `>` - Closing tag

**Pattern:** `/<@!?\d+>/`

- `!?` means the `!` is optional
- `\d+` matches one or more digits

**Examples:**

```
<@123456789012345678>     → User mention (standard)
<@!123456789012345678>    → User mention (with nickname)
```

### Role Mentions

**Format:** `<@&123456789>`

- `<@&` - Opening tag (note the `&` character)
- `123456789` - Role ID (17-19 digits)
- `>` - Closing tag

**Pattern:** `/<@&(\d+)>/`

- The `&` character is **required** and distinguishes role mentions from user mentions
- `(\d+)` captures the role ID

**Examples:**

```
<@&123456789012345678>    → Role mention
```

### Key Difference

The **`&` character** is what distinguishes role mentions from user mentions:

- `<@123456789>` → User mention (no `&`)
- `<@&123456789>` → Role mention (has `&`)

## Role Names (Text Format)

You can also reference roles by name using `@RoleName`:

**Format:** `@RoleName`

- Starts with `@`
- Followed by the role name (case-insensitive)
- No angle brackets

**Examples:**

```
@VerifiedRole
@PremiumRole
@Event Attendees
```

**Note:** Role names are resolved by searching the guild's role cache for a matching name. This is case-insensitive.

## Detection Process

The bot detects mentions in the following order:

1. **Check for @everyone**
   - Exact match: `@everyone`, `everyone`, or `all`
   - If found, targets all server members

2. **Detect User Mentions**
   - Looks for pattern: `<@!?\d+>`
   - Also checks for plain user IDs (17-19 digits)

3. **Detect Role Mentions**
   - Looks for pattern: `<@&\d+>`
   - Extracts role ID and looks it up in the guild

4. **Detect Role Names**
   - Splits input by delimiters (comma, semicolon, space)
   - Checks if parts starting with `@` match role names
   - Excludes user mention formats (`@!?digits`)

5. **Determine Type**
   - If both users and roles found → `mixed`
   - If only roles found → `role`
   - If only users found → `users`
   - Default → `users`

## Examples

### User Mentions Only

```
Input: <@123456789012345678> <@987654321098765432>
Result: type = "users"
```

### Role Mentions Only

```
Input: <@&123456789012345678>
Result: type = "role", targetRoles = [Role]
```

### Role Names Only

```
Input: @VerifiedRole @PremiumRole
Result: type = "role", targetRoles = [VerifiedRole, PremiumRole]
```

### Mixed (Users + Roles)

```
Input: <@123456789012345678> <@&987654321098765432>
Result: type = "mixed", targetRoles = [Role], hasUsers = true
```

### Mixed (Users + Role Names)

```
Input: <@123456789012345678> @VerifiedRole
Result: type = "mixed", targetRoles = [VerifiedRole], hasUsers = true
```

### @everyone

```
Input: @everyone
Result: type = "everyone", isAllMembers = true
```

## Common Patterns

### Pattern 1: User Mention

```javascript
/<@!?\d+>/;
```

Matches: `<@123456789>` or `<@!123456789>`

### Pattern 2: Role Mention

```javascript
/<@&(\d+)>/;
```

Matches: `<@&123456789>` and captures the ID

### Pattern 3: User ID

```javascript
/^\d{17,19}$/;
```

Matches: `123456789012345678` (plain number)

### Pattern 4: Role Name

```javascript
/^@[^@\d]+$/;
```

Matches: `@RoleName` (not a mention format or number)

## Troubleshooting

### "Invalid Users" Error

If you get an "Invalid Users" error when mentioning a role:

1. **Check the mention format:**
   - Use `<@&roleId>` for role mentions
   - Use `@RoleName` for role names

2. **Check role permissions:**
   - Make sure the role exists in the server
   - The bot must be able to see the role

3. **Check for typos:**
   - Role names are case-insensitive but must match exactly
   - Special characters in role names must be included

### Mixed Detection Not Working

If mixed mentions aren't being detected:

1. **Verify formats:**
   - User mentions: `<@userId>` or `<@!userId>`
   - Role mentions: `<@&roleId>`
   - Role names: `@RoleName`

2. **Check delimiters:**
   - Use commas, semicolons, or spaces to separate mentions
   - Example: `@user1,@user2,@RoleName`

3. **Check limits:**
   - Maximum 25 individual user mentions
   - Combined total (users + role members) max 10,000

## Technical Details

### Regex Patterns Used

```javascript
// User mentions
const userMentionPattern = /<@!?\d+>/g;
// Matches: <@123> or <@!123>

// Role mentions
const roleMentionPattern = /<@&(\d+)>/g;
// Matches: <@&123> and captures ID

// User IDs
const userIdPattern = /^\d{17,19}$/;
// Matches: 17-19 digit numbers

// Role name validation
const roleNamePattern = /^@[^@\d]+$/;
// Matches: @ followed by non-digit, non-@ characters
```

### Detection Function

The `detectTargetingType()` function in `src/commands/admin/schedule-role/utils.js` handles all detection logic. It:

1. Checks for special keywords (@everyone)
2. Detects user mentions using regex
3. Detects role mentions using regex
4. Resolves role names by searching guild cache
5. Combines results and returns targeting type

## Best Practices

1. **Use role mentions for large groups:**
   - `<@&roleId>` or `@RoleName` is more efficient than listing many users

2. **Use user mentions for specific individuals:**
   - `<@userId>` or plain user IDs for precise targeting

3. **Mix when needed:**
   - Combine specific users with role-based groups
   - Example: `@moderator1,@moderator2,@VerifiedRole`

4. **Be explicit:**
   - Use proper mention formats
   - Avoid ambiguous formats like `@123` (could be user or role name)
