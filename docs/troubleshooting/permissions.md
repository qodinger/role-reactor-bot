# Permission Problems

Detailed guide to understanding, diagnosing, and fixing permission-related issues with Role Reactor Bot.

## Understanding Discord Permissions

### How Discord Permissions Work

Discord uses a hierarchical permission system where:

**Role Hierarchy (Top to Bottom):**
```
🔴 Server Owner (Ultimate authority)
🟠 Admin Roles (High permissions)
🟡 Moderator Roles (Medium permissions) 
🟢 Bot Roles (Positioned strategically)
🔵 Member Roles (Lower permissions)
⚪ @everyone Role (Base permissions)
```

**Key Permission Principles:**
- Higher roles can manage lower roles
- Bots can only assign roles below their position
- Permission inheritance flows from higher to lower roles
- Explicit "Deny" permissions override "Allow" permissions

### Role Reactor Bot Permission Requirements

**Essential Bot Permissions:**
```
✅ Required Permissions:
• Manage Roles - Assign/remove roles
• Add Reactions - Add reaction emojis to messages
• Read Message History - Access existing role messages
• Send Messages - Send confirmation messages
• Use External Emojis - Use custom server emojis

⚠️ Optional but Recommended:
• Embed Links - Rich confirmation messages
• Mention Everyone - For role notifications (if enabled)
```

## Common Permission Error Scenarios

### 1. "Bot Cannot Assign This Role" Error

**Error Message:**
```
❌ I don't have permission to give you this role
```

**Diagnosis and Solutions:**

**Role Hierarchy Issue (Most Common):**
```
Problem: Bot's role is below the target role in hierarchy

Check:
1. Go to Server Settings → Roles
2. Find Role Reactor Bot's role
3. Check if it's above all roles it needs to manage

Solution:
• Drag bot role above all assignable roles
• Ensure bot role stays below admin/mod roles for security
```

**Missing Manage Roles Permission:**
```
Problem: Bot role lacks "Manage Roles" permission

Check:
1. Server Settings → Roles → [Bot Role Name]
2. Look for "Manage Roles" permission
3. Verify it's enabled (green checkmark)

Solution:
• Enable "Manage Roles" permission for bot
• Apply changes and test role assignment
```

**Role Assignment Restrictions:**
```
Problem: Server has role assignment restrictions

Check:
• Two-factor authentication requirements
• Server verification level settings
• Custom permission overrides

Solution:
• Adjust server verification settings
• Check 2FA requirements for role management
• Review custom permission configurations
```

### 2. "You Don't Have Permission" Error

**Error Message:**
```
❌ You don't have permission to get this role
```

**User Permission Issues:**

**Verification Requirements:**
```
Problem: Server requires phone/email verification

Check Your Account:
• User Settings → My Account
• Verify phone number is confirmed
• Verify email address is confirmed

Server Verification Levels:
🔒 None - No requirements
🔒 Low - Verified email required
🔒 Medium - Registered for 5+ minutes
🔒 High - Member for 10+ minutes
🔒 Highest - Verified phone number required
```

**Role Prerequisites:**
```
Problem: Role requires other roles first

Common Prerequisites:
• Must have @Member role before specialty roles
• Must complete server introduction
• Must be active for certain period
• Must have minimum reputation/level

Solution:
• Check role requirements in server rules
• Get prerequisite roles first
• Contact server staff for clarification
```

**Custom Server Restrictions:**
```
Problem: Server has custom role assignment rules

Possible Restrictions:
• Time-based access (must be member for X days)
• Channel activity requirements
• Invitation source requirements
• Manual approval needed

Solution:
• Read server rules and role information
• Contact server moderators for assistance
• Wait for requirements to be met
```

### 3. Bot Permission Configuration Issues

**Diagnostic Steps for Admins:**

**Check Bot Role Permissions:**
```
1. Server Settings → Roles → [Bot Role]
2. Verify these permissions are enabled:
   ✅ Manage Roles
   ✅ Add Reactions  
   ✅ Read Message History
   ✅ Send Messages
   ✅ Use External Emojis (if using custom emojis)
```

**Check Channel-Specific Permissions:**
```
1. Channel Settings → Permissions
2. Check bot role has permissions in role channels:
   ✅ View Channel
   ✅ Add Reactions
   ✅ Send Messages
   ✅ Read Message History
```

**Verify Role Hierarchy:**
```
Correct Setup:
🔴 Server Owner
🟠 Admin Roles
🟡 Moderator Roles
🟢 Role Reactor Bot ← Must be here or higher
🔵 All assignable roles ← Must be below bot
⚪ @everyone
```

## Advanced Permission Scenarios

### 1. Complex Role Hierarchies

**Multiple Bot Management:**
```
Challenge: Multiple bots managing different role sets

Solution Strategy:
• Position Role Reactor Bot above its managed roles only
• Use different bots for different role categories
• Create role "zones" with appropriate bot positioning
• Document which bot manages which roles
```

**VIP/Premium Role Issues:**
```
Problem: Special roles need different permission handling

Best Practices:
• Place premium roles below bot but above regular roles
• Use separate role messages for premium/VIP roles
• Implement verification systems for exclusive roles
• Consider manual approval for high-value roles
```

### 2. Server Security Considerations

**Preventing Permission Abuse:**
```
Security Best Practices:
✅ Never give bot Administrator permission
✅ Position bot role carefully in hierarchy
✅ Regularly audit bot permissions
✅ Monitor role assignment logs
✅ Use principle of least privilege
```

**Protecting Important Roles:**
```
Sensitive Roles to Protect:
🔒 Admin and Moderator roles
🔒 Bot management roles
🔒 Server booster roles
🔒 Special recognition roles

Protection Method:
• Keep these roles ABOVE Role Reactor Bot
• Never include in role messages
• Assign manually only
```

### 3. Channel Permission Conflicts

**Role vs Channel Permissions:**
```
Understanding Interaction:
• Channel permissions can override role permissions
• Explicit DENY always wins over ALLOW
• Multiple roles can provide cumulative permissions

Common Conflicts:
❌ Role gives channel access, but channel denies that role
❌ Multiple roles with conflicting permissions
❌ @everyone role conflicts with assigned role
```

**Resolving Channel Conflicts:**
```
Troubleshooting Steps:
1. Check role permissions for the specific channel
2. Look for explicit DENY permissions
3. Verify @everyone role settings
4. Test with minimal role setup
5. Adjust channel overrides as needed
```

## Platform-Specific Permission Issues

### 1. Mobile App Permission Problems

**Mobile-Specific Issues:**
```
Problem: App doesn't reflect permission changes immediately
Solution: 
• Force close and restart Discord app
• Wait 2-3 minutes for sync
• Try on desktop to verify changes

Problem: Can't see permission settings on mobile
Solution:
• Use desktop/web for permission management
• Mobile app has limited admin functionality
```

### 2. Web Browser Permission Handling

**Browser Permission Cache:**
```
Problem: Browser caching old permission states
Solution:
• Hard refresh (Ctrl+F5 or Cmd+Shift+R)
• Clear Discord cache and cookies
• Try incognito/private browsing mode
```

## Diagnostic Tools and Commands

### For Users

**Check Your Permissions:**
```
/myroles - See all your current roles
/roleinfo role:@RoleName - Check specific role permissions
/help - Get general bot help information
```

**Test Role Functionality:**
```
Steps to test:
1. Try getting a basic role first
2. Check if you receive confirmation message
3. Verify role appears in your profile
4. Test role benefits (channel access, etc.)
```

### For Server Administrators

**Bot Health Check:**
```
Regular Checks:
• Bot online status
• Role hierarchy positioning
• Permission consistency across channels
• Error message monitoring
```

**Permission Audit Commands:**
```
Useful Discord Features:
• Server Settings → Audit Log (track permission changes)
• Role management interface (drag-and-drop hierarchy)
• Channel permission overrides
• Member permission calculator
```

## Fixing Common Permission Problems

### Quick Fix Checklist

**For "Bot Can't Assign Role" Errors:**
```
✅ Check bot role is above target role
✅ Verify bot has "Manage Roles" permission
✅ Confirm role still exists and hasn't been renamed
✅ Test with a simple role first
✅ Check for server-wide permission restrictions
```

**For "User Can't Get Role" Errors:**
```
✅ Verify user account verification status
✅ Check if user meets role requirements
✅ Confirm user has base permissions in server
✅ Test if issue affects other users too
✅ Review server verification level settings
```

**For Channel Access Issues:**
```
✅ Confirm role provides claimed permissions
✅ Check for channel-specific permission overrides
✅ Verify no conflicting DENY permissions
✅ Test channel access with minimal roles
✅ Wait for Discord permission sync (2-3 minutes)
```

### Prevention Strategies

**Server Setup Best Practices:**
```
✅ Plan role hierarchy before adding bot
✅ Document which roles bot should manage
✅ Test role system with non-admin account
✅ Regularly review and audit permissions
✅ Keep bot permissions minimal but sufficient
```

**Ongoing Maintenance:**
```
✅ Monitor role assignment errors
✅ Update role hierarchy when adding new roles
✅ Check bot permissions after server changes
✅ Train moderators on permission management
✅ Create backup plans for permission issues
```

Remember: Most permission problems stem from role hierarchy issues or missing bot permissions. Always check the basics first: bot role position and "Manage Roles" permission!
