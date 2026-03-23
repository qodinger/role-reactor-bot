# Role Bundle Commands

## Overview

The Role Bundle system allows administrators to create pre-configured "bundles" (groups) of roles that can be subsequently mapped together in Role Reactions. Rather than mapping complex strings of roles repeatedly across different message channels, you can save them as a single structural Bundle.

## File Structure

```
role-bundle/
├── index.js              # Command definition and subcommands
├── handlers.js           # Main logic for creating, viewing, deleting, and listing role bundles
└── README.md             # This documentation
```

## Subcommands

- **`/role-bundle create`**: Create a new structural bundle.
  - Options: `name` (required, 1-50 characters), `roles` (required)
- **`/role-bundle delete`**: Delete a previously saved bundle.
  - Options: `name` (required)
- **`/role-bundle list`**: Lists all saved bundles natively within this server.
- **`/role-bundle view`**: Outputs the precise roles mapped to a particular bundle.
  - Options: `name` (required)

## Usage Examples

```
/role-bundle create name:"Pro Gaming Pack" roles:"@Gamer @Streamer @Premium"
/role-bundle create name:"Color Red" roles:"<@&123456789123456789>"
/role-bundle list
/role-bundle view name:"Pro Gaming Pack"
/role-bundle delete name:"Color Red"
```

## Role Formatting & Limits

When defining the initial `roles` array when creating a bundle, standard formatting rules natively apply.

**Formats Supported:**

- Role Mentions: `@RoleName`
- Raw Role Names: `Role Name`
- Role IDs: `<@&123456789>`

**Tier Limits:**

- **Free Tier:** Maximum **5** uniquely mapped roles per bundle.
- **Pro Engine:** Maximum **15** uniquely mapped roles per bundle.

## Permissions Required

- `ManageRoles` permission at the Guild Level
- The assigned Bot role must physically be situated _above_ all intended target roles within the Discord Server settings hierarchy natively.

## Integration Reference

Once a Role Bundle natively exists in the database, it can be passed organically into any Role Reaction menu sequentially wrapped inside brackets explicitly:

`💡:[Pro Gaming Pack]`
