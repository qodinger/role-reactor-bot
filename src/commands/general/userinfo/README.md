# Userinfo Command

Display detailed information about a Discord user, including account details, badges, roles, permissions, and server-specific information.

## Usage

```
/userinfo [user]
```

### Options

- `user` (optional) - The user to get information about. If not specified, shows information about yourself.

## Examples

```
/userinfo
/userinfo user:@username
/userinfo user:123456789012345678
```

## Features

- **Account Information**: Username, display name, tag, ID, bot status
- **Account Age**: Creation date and account age
- **Badges**: Discord badges and special flags (Staff, Partner, HypeSquad, etc.)
- **Server Member Info** (if user is in the server):
  - Join date
  - Nickname
  - Roles (with count)
  - Key permissions
  - Server booster status
  - Timeout status
  - Current voice channel

## Permissions Required

- `ViewChannel` - Basic permission to view channels

## Notes

- If the user is not a member of the server, only basic account information will be shown
- Roles are sorted by position (highest first)
- Permissions are limited to the most important ones to avoid clutter
- The embed automatically truncates long role lists
