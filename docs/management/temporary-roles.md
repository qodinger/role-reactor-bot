# Temporary Roles

Learn how to assign roles that automatically expire after a set time - perfect for events, trials, and time-limited access.

## 🎯 What Are Temporary Roles?

**Temporary roles** are regular Discord roles that the bot automatically removes after a specified duration. Perfect for:

- **🎉 Event access** - Movie nights, game tournaments, special activities
- **✨ Trial periods** - VIP trials, beta testing, preview access  
- **🏆 Achievement rewards** - Contest winners, daily challenges
- **📅 Seasonal roles** - Holiday events, monthly themes
- **🎫 Limited-time perks** - Temporary permissions, special channels

## ⏰ Assigning Temporary Roles

### Basic Command

```
/assign-temp-role user:@member role:@RoleName duration:2h
```

### With Reason (Recommended)

```
/assign-temp-role user:@member role:@RoleName duration:2h reason:"Movie night access"
```

### Parameters

- **`user`** - The member to assign the role to
- **`role`** - The role to assign (must exist in your server)
- **`duration`** - How long the role should last
- **`reason`** (optional) - Why the role was assigned (for records)

## ⏱️ Duration Formats

### Supported Formats

| Format | Duration | Example Use |
|--------|----------|-------------|
| `30m` | 30 minutes | Quick events, short meetings |
| `2h` | 2 hours | Movie nights, gaming sessions |
| `1d` | 1 day | Daily contest winners |
| `1w` | 1 week | Weekly challenges, trial access |
| `4w` | 4 weeks (maximum) | Monthly events, extended trials |

### Duration Examples

**Short-term access:**
```
/assign-temp-role user:@player role:@EventAccess duration:30m reason:"Speed gaming event"
```

**Event participation:**
```
/assign-temp-role user:@member role:@MovieNight duration:3h reason:"Tonight's movie event"
```

**Trial membership:**
```
/assign-temp-role user:@newbie role:@VIP duration:1w reason:"Welcome week VIP trial"
```

**Achievement reward:**
```
/assign-temp-role user:@winner role:@Champion duration:1d reason:"Daily contest winner"
```

## 📋 Managing Temporary Roles

### View All Temporary Roles

```
/list-temp-roles
```

**Shows:**
- Member with the temporary role
- Role name and expiration time
- Reason for assignment
- Time remaining

### View Roles for Specific Member

```
/list-temp-roles user:@member
```

### Remove Temporary Role Early

```
/remove-temp-role user:@member role:@RoleName
```

**Use when:**
- Event ended early
- Member violated rules
- Role no longer needed
- Mistake in assignment

## 🎮 Real-World Examples

### Gaming Tournament

```
# Give tournament access
/assign-temp-role user:@player1 role:@TournamentPlayer duration:4h reason:"Gaming tournament participant"

# Award winner role
/assign-temp-role user:@winner role:@TournamentChampion duration:1w reason:"Tournament winner - Week 23"
```

### Movie Night Event

```
# Event access role
/assign-temp-role user:@moviefan role:@MovieNight duration:4h reason:"Friday movie night - The Matrix"

# VIP seating for early arrivals
/assign-temp-role user:@early role:@VIPSeating duration:2h reason:"Early arrival VIP seating"
```

### Study Session

```
# Study group access
/assign-temp-role user:@student role:@StudyRoom duration:3h reason:"Mathematics study session"

# Study buddy role
/assign-temp-role user:@helper role:@StudyHelper duration:3h reason:"Helping with calculus problems"
```

### Community Events

```
# Beta tester access
/assign-temp-role user:@tester role:@BetaTester duration:2w reason:"Discord bot beta testing program"

# Event organizer
/assign-temp-role user:@volunteer role:@EventOrganizer duration:1d reason:"Community game night organizer"
```

## 🏢 Professional Server Examples

### Project Teams

```
# Project team member
/assign-temp-role user:@developer role:@ProjectAlpha duration:2w reason:"Alpha project development team"

# Meeting access
/assign-temp-role user:@stakeholder role:@MeetingAccess duration:2h reason:"Weekly stakeholder meeting"
```

### Training Sessions

```
# Training participant
/assign-temp-role user:@trainee role:@TrainingAccess duration:1d reason:"Customer service training day 1"

# Trainer role
/assign-temp-role user:@instructor role:@Trainer duration:1d reason:"Leading today's training session"
```

## 🎯 Best Practices

### Planning Duration

**Consider these factors:**
- **Event length** - How long will the activity last?
- **Buffer time** - Add extra time for delays
- **Time zones** - Account for different member locations
- **Cleanup time** - Time to wrap up and transition

**Duration recommendations:**
- **Live events** - Actual duration + 1 hour buffer
- **Daily activities** - 1 day
- **Weekly events** - 1 week  
- **Trials** - 1-2 weeks
- **Achievements** - 1 day to 1 week

### Documentation

**Always include reasons:**
- **Track why** roles were assigned
- **Easy reference** for staff
- **Member understanding** of their access
- **Audit trail** for server management

**Good reason examples:**
- `"Movie night - The Avengers - 7PM EST"`
- `"Contest winner - Art competition Week 15"`
- `"VIP trial - New member welcome program"`
- `"Beta tester - Bot feature testing Phase 2"`

### Communication

**Let members know:**
- **What the role gives them** access to
- **How long it lasts**
- **What happens when it expires**
- **How to get help** if needed

**Example announcement:**
```
🎉 @member has been given @EventAccess for tonight's movie night!

✅ Access to #movie-chat and voice channels
⏰ Role expires in 4 hours
🎬 Tonight's movie: The Matrix (8PM EST)
❓ Questions? Ask in #help
```

## ⚙️ Advanced Usage

### Bulk Assignments

For multiple people:
```
/assign-temp-role user:@member1 role:@EventAccess duration:2h reason:"Gaming tournament batch 1"
/assign-temp-role user:@member2 role:@EventAccess duration:2h reason:"Gaming tournament batch 1"  
/assign-temp-role user:@member3 role:@EventAccess duration:2h reason:"Gaming tournament batch 1"
```

### Cascading Roles

Different durations for different access levels:
```
# Basic access for all participants
/assign-temp-role user:@participant role:@EventAccess duration:3h reason:"Workshop participant"

# Extended access for helpers
/assign-temp-role user:@helper role:@EventHelper duration:4h reason:"Workshop helper - extra cleanup time"

# Full day access for organizers
/assign-temp-role user:@organizer role:@EventOrganizer duration:1d reason:"Workshop organizer - setup and follow-up"
```

### Role Stacking

Multiple temporary roles for the same person:
```
# Event access
/assign-temp-role user:@vip role:@EventAccess duration:4h reason:"Premium event access"

# VIP perks
/assign-temp-role user:@vip role:@VIPPerks duration:4h reason:"VIP member perks for event"

# Early access
/assign-temp-role user:@vip role:@EarlyAccess duration:5h reason:"30min early access + event time"
```

## 🚨 Important Notes

### Role Hierarchy

{% hint style="warning" %}
**Remember:** The bot can only assign roles that are **below** its own role in your server hierarchy!
{% endhint %}

### Persistence

- **Temporary roles survive bot restarts** - stored in database
- **Expiration continues** even if bot goes offline temporarily  
- **Manual removal** is always possible with `/remove-temp-role`

### Permissions

- **Same permissions required** as regular role assignment
- **Role must exist** in your server before assignment
- **Bot needs "Manage Roles"** permission

### Limitations

- **Maximum duration:** 4 weeks
- **Minimum duration:** 1 minute
- **No automatic renewal** - must reassign if needed
- **No bulk removal command** - remove individually

## 📊 Monitoring Usage

### Regular Reviews

**Weekly checks:**
- Review `/list-temp-roles` for upcoming expirations
- Clean up any roles that should be removed early
- Plan upcoming events and role needs

**Monthly analysis:**
- Which temporary roles are used most?
- Are durations appropriate for activities?
- Do members understand the system?
- Any needed adjustments to processes?

### Member Feedback

**Ask members:**
- Are role durations appropriate?
- Is the purpose of temporary roles clear?
- Would they like notifications before expiration?
- Any suggestions for improvement?

---

Ready to learn more about role management? Check out [Updating Role Messages](updating-messages.md) next!
