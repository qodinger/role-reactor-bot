# Schedule Role User Limits - Recommendations

## Overview

This document explains the recommended maximum user limits for the schedule-role feature, based on optimization strategies and Discord API constraints.

## Recommended Limits

### **Manual User Lists: 25 Users Maximum**

**Current Implementation**: 25 users per schedule when specifying individual users

**Rationale:**

- **User Experience**: Commands with 25 users complete in ~5-10 seconds, providing good UX
- **Rate Limit Safety**: Well below Discord's 50 requests/second limit with our batching
- **Practical Use Cases**: Most manual schedules are for specific users (events, groups, etc.)
- **Clarity of Intent**: Keeping limits reasonable prevents accidental bulk operations

**When to Use Manual Lists:**

- Scheduling roles for specific event participants
- Small groups or team assignments
- Individual user management
- Testing and small-scale operations

### **All Members Option: 10,000 Member Maximum**

**Current Implementation**: Maximum of 10,000 members when using `all-members:true` or `@everyone`

**Rationale:**

- **Practical Limit**: Operations on >10,000 members take 10-20+ minutes and have higher reliability risks
- **User Experience**: Beyond 10,000 members, execution time becomes impractical
- **Better Alternatives**: Role-based targeting is faster and more reliable for large servers
- **Reliability**: Reduces chance of partial failures and improves overall success rate

**For Servers >10,000 Members:**

When using `@everyone` or `all-members:true` on servers with more than 10,000 members, the bot will reject the operation and suggest alternatives:

1. **Role-Based Targeting** (Recommended): Assign the role to another role instead
2. **Split Operations**: Create multiple schedules for different role groups
3. **Discord's Built-in Features**: Use Server Settings role management

**When to Use All Members:**

- Server-wide role assignments
- Maintenance or event roles for all members
- Recurring bulk operations
- Any operation targeting more than 25 users

## Technical Analysis

### Discord API Rate Limits

- **Global Rate Limit**: 50 requests per second per endpoint
- **Role Operations**: Use `/guilds/{guild.id}/members/{user.id}/roles/{role.id}` endpoint
- **Safe Operation**: With batch size 10 and 100ms delays = ~100 requests/second theoretical maximum, but spread over time prevents hitting limits

### Performance Calculations

**Manual List with 25 Users:**

- Batch size: 10 (small operation)
- Batches needed: 3 (10 + 10 + 5)
- Processing time: ~5-10 seconds
- API calls: ~25-50 requests (some may already have/don't have role)
- Rate limit risk: **Very Low** ✅

**All Members (e.g., 1000 users):**

- Batch size: Adaptive (8-10 for medium, 5 for large)
- Chunking: Automatic for >1000 users (500 per chunk)
- Processing time: ~1-3 minutes
- API calls: ~1000-2000 requests (distributed over time)
- Rate limit risk: **Low-Medium** (mitigated by chunking) ✅

**All Members (e.g., 5000 users):**

- Batch size: 5 (large operation)
- Chunking: 10 chunks of 500 users each
- Processing time: ~10-25 minutes total
- API calls: ~5000-10000 requests (distributed over 10-25 minutes)
- Rate limit risk: **Medium** (well distributed, automatic backoff) ✅

## Recommendation Summary

| Use Case                  | Recommended Limit  | Reason                                             |
| ------------------------- | ------------------ | -------------------------------------------------- |
| **Manual user lists**     | **25 users**       | Optimal balance of UX, safety, and practicality    |
| **All members option**    | **10,000 members** | Practical limit for execution time and reliability |
| **Small operations**      | <50 users          | Standard processing, fast completion               |
| **Medium operations**     | 50-500 users       | Optimized executor, efficient processing           |
| **Large operations**      | 500-1000 users     | Chunked preparation, safe execution                |
| **Very large operations** | >1000 users        | Multi-chunk processing, distributed over time      |

## Best Practices

### When to Use Each Approach

1. **Use Manual Lists (≤25 users)** when:
   - You need to target specific individuals
   - The operation is for a small group
   - You want quick command response

2. **Use All Members Option** when:
   - You need to target more than 25 users
   - You want server-wide operations
   - The operation applies to all or most members

### Optimization Tips

1. **Split Large Manual Lists**: If you need to schedule for 50 users, use two schedules with 25 each
2. **Use All Members for Bulk**: For 50+ users, always use `all-members:true` option
3. **Leverage Recurring Schedules**: For ongoing operations, recurring schedules are more efficient than multiple one-time schedules

## Implementation Details

### Current Code Configuration

```javascript
// In handlers.js
const MAX_USERS = 25; // Recommended limit for manual lists

// All members option has no hard limit
// Uses OptimizedRoleExecutor automatically for >50 users
```

### Why 25 and Not Higher?

**For Manual Lists:**

- **25 users** = ~5-10 seconds processing time
- **50 users** = ~15-25 seconds (acceptable but slower)
- **100+ users** = 30+ seconds (poor UX for command response)

**Key Insight**: Manual lists are for **specific** users. If you need more than 25, you should use the "all members" option which is designed for bulk operations and provides better feedback through scheduled execution.

## Conclusion

- **Manual User Lists**: **25 users maximum** - Provides optimal user experience while maintaining safety
- **All Members Option**: **No limit** - Automatically optimizes for any server size
- The system is designed to scale: Small operations are fast, large operations are efficient
- Rate limits are automatically handled through batching, chunking, and backoff strategies

This approach ensures:
✅ Fast command responses for small operations
✅ Efficient handling of large operations
✅ No rate limit issues
✅ Scalability for any server size
✅ Clear distinction between manual and bulk operations
