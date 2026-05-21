---
name: nodejs
description: Node.js best practices and conventions. Use when working with Node.js backend projects.
---

# Skill: nodejs

## When to Use This Skill

Use this skill when:
- Building a Node.js API or server
- Structuring a Node.js project
- Handling errors in a Node.js app

## Non-Negotiables

- Use ESM (`"type": "module"` in package.json). CommonJS is legacy.
- Never mix callbacks and promises. Use `util.promisify` to convert callback APIs.
- Validate all incoming data at the boundary with Zod before it enters your application logic.

## Error Handling

Never swallow errors silently. Every `catch` must either handle the error or re-throw it with context.

Use structured error types — not raw `new Error('something went wrong')`:

```javascript
class AppError extends Error {
  constructor(message, code, cause) {
    super(message, { cause });
    this.code = code;
  }
}
```

In Express/Fastify, funnel all errors to a central error handler. Never send raw stack traces to clients in production.

## Async Patterns

Async/await everywhere. Avoid raw `.then()` chains — they make error propagation hard to follow.

For Express, wrap async route handlers to catch thrown errors:

```javascript
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
```

## Input Validation

Validate at the route layer before anything else:

```javascript
import { z } from 'zod';

const schema = z.object({ email: z.string().email() });

app.post('/users', asyncHandler(async (req, res) => {
  const body = schema.parse(req.body); // throws ZodError if invalid
  // ...
}));
```

## Project Structure

```
src/
├── routes/       # HTTP layer only — parse input, call service, send response
├── services/     # Business logic — no req/res here
├── models/       # DB access
├── middleware/
└── index.js
```

Keep the HTTP layer thin. Business logic in services, not route handlers.
