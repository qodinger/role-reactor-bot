# Auto-Mod System

Automatic content moderation to keep your server safe.

## Features

### Free Filters (5 filters)

- **Bad Words** - Filter inappropriate words
- **Links** - Block URLs in messages
- **Spam** - Detect repeated messages and rate limiting (5 msgs/5s)
- **Mention Spam** - Block mass mentions (3+ mentions)
- **Invite Links** - Block Discord invite links

### Pro Filters (+4 advanced)

- **Domain Allowlist** - Allow specific domains while blocking others
- **Caps Lock Filter** - Block messages that are mostly ALL CAPS
- **Wildcard Matching** - Pattern matching (spam*, *badword)
- **Regex Patterns** - Advanced regex (e.g., `\d{3}-\d{4}` for phone numbers)

## Commands

### Quick Setup

```bash
/automod general settings          # Open interactive settings panel
/automod general enable            # Enable all configured filters
/automod general disable           # Disable all filters
```

### Bad Words

```bash
/automod badwords toggle enabled:true
/automod badwords words:badword1,badword2,badword3

# Pro features
/automod badwords mode:wildcard words:spam*,f*ll*w*rs
/automod badwords mode:regex words:\d{3}-\d{4}
```

### Links

```bash
/automod links toggle enabled:true action:timeout timeout-duration:5
```

### Spam

```bash
/automod spam toggle enabled:true threshold:3 rate-threshold:5
```

### Mention Spam

```bash
/automod mention-spam toggle enabled:true mention-count:5
```

### Invite Links

```bash
/automod invite toggle enabled:true
```

### Caps Lock (Pro)

```bash
/automod caps-lock toggle enabled:true threshold:70 min-length:10
```

### Domain Allowlist (Pro)

```bash
/automod domains add discord.com,youtube.com,github.com
/automod domains remove youtube.com
/automod domains list
/automod domains clear
```

## Configuration Options

Each filter supports these options:

| Option             | Description                        | Default |
| ------------------ | ---------------------------------- | ------- |
| `enabled`          | Enable/disable the filter          | false   |
| `action`           | Action to take (delete/timeout)    | delete  |
| `timeout-duration` | Timeout duration in minutes (1-60) | 5       |
| `ignore-admins`    | Don't affect admins/mods           | true    |

### Spam-specific options:

| Option           | Description                            | Default |
| ---------------- | -------------------------------------- | ------- |
| `threshold`      | Repeated messages to trigger (2-10)    | 3       |
| `rate-threshold` | Messages per 5s to trigger spam (3-10) | 5       |

### Caps Lock-specific options:

| Option       | Description                          | Default |
| ------------ | ------------------------------------ | ------- |
| `threshold`  | Percentage of caps required (50-100) | 70      |
| `min-length` | Minimum message length to check      | 10      |

## Pro Engine

Upgrade to Pro Engine for advanced auto-mod features:

- Domain allowlisting
- Caps Lock filter
- Wildcard patterns in bad words
- Regex pattern matching

See [Core Energy Guide](../../../docs/CORE_ENERGY.md) for pricing and activation.
