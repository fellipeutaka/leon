# Hooks & Middleware

## Table of Contents
- [Before Hooks](#before-hooks)
- [After Hooks](#after-hooks)
- [Context Object](#context-object)
- [Context Utilities](#context-utilities)
- [Inner Context](#inner-context)
- [Database Hooks](#database-hooks)
- [Audit Logging Example](#audit-logging-example)

## Before Hooks

Execute before an endpoint handler. Can modify requests or return early.

```ts
import { betterAuth } from "better-auth";
import { createAuthMiddleware } from "better-auth/api";

const auth = betterAuth({
  hooks: {
    before: [
      {
        matcher: (context) => context.path === "/sign-up/email",
        handler: createAuthMiddleware(async (ctx) => {
          // Validate domain
          const email = ctx.body?.email;
          if (email && !email.endsWith("@company.com")) {
            throw new APIError("BAD_REQUEST", { message: "Only company emails allowed" });
          }
          // Continue to handler (return nothing)
        }),
      },
    ],
  },
});
```

### Return Early (skip handler)

```ts
handler: createAuthMiddleware(async (ctx) => {
  return ctx.json({ blocked: true }, { status: 403 }); // stops here
}),
```

### Modify Request Body

```ts
handler: createAuthMiddleware(async (ctx) => {
  return { context: { body: { ...ctx.body, role: "user" } } };
}),
```

## After Hooks

Execute after the endpoint handler. Can modify responses.

```ts
const auth = betterAuth({
  hooks: {
    after: [
      {
        matcher: (context) => context.path === "/sign-up/email",
        handler: createAuthMiddleware(async (ctx) => {
          const newSession = ctx.context.newSession;
          if (newSession) {
            await sendWelcomeEmail(newSession.user.email);
          }
          // Return nothing to pass through original response
        }),
      },
    ],
  },
});
```

### Modify Response

```ts
handler: createAuthMiddleware(async (ctx) => {
  const returned = ctx.context.returned;
  return ctx.json({ ...returned, extra: "data" });
}),
```

## Context Object

Available in both before and after hooks:

| Property | Description |
|----------|-------------|
| `ctx.path` | Endpoint path (e.g., `/sign-in/email`) |
| `ctx.body` | Request body (parsed) |
| `ctx.headers` | Request headers |
| `ctx.request` | Raw Request object |
| `ctx.query` | Query parameters |
| `ctx.params` | URL parameters |
| `ctx.context` | Inner context (session, adapter, etc.) |

## Context Utilities

```ts
// JSON response
ctx.json({ data: "value" });
ctx.json({ error: "message" }, { status: 400 });

// Redirect
ctx.redirect("https://example.com/dashboard");

// Cookies
ctx.setCookies("name", "value", { httpOnly: true, secure: true });
ctx.getSignedCookie("name", secret);

// Error
throw new APIError("BAD_REQUEST", { message: "Invalid input" });
throw new APIError("UNAUTHORIZED", { message: "Not authenticated" });
throw new APIError("FORBIDDEN", { message: "Access denied" });
```

## Inner Context

Accessible via `ctx.context`:

| Property | Description |
|----------|-------------|
| `session` | Current session (if authenticated) |
| `secret` | Auth secret |
| `authCookies` | Cookie configuration |
| `password.hash(pw)` | Hash a password |
| `password.verify({ password, hash })` | Verify a password |
| `adapter` | Database adapter |
| `internalAdapter` | Internal adapter (higher-level operations) |
| `generateId()` | Generate a unique ID |
| `tables` | Schema table definitions |
| `baseURL` | Auth base URL |

After hooks also have:

| Property | Description |
|----------|-------------|
| `newSession` | Session created by the endpoint |
| `returned` | Response from the endpoint handler |
| `responseHeaders` | Response headers |

## Database Hooks

Triggered on database operations. Available for `user`, `session`, and `account` models.

```ts
const auth = betterAuth({
  databaseHooks: {
    user: {
      create: {
        before: async ({ data }) => {
          // Modify data before insert
          return { data: { ...data, role: "user" } };
        },
        after: async ({ data }) => {
          await createDefaultSettings(data.id);
        },
      },
      update: {
        before: async ({ data, where }) => { /* validate changes */ },
        after: async ({ data, oldData }) => { /* notify on changes */ },
      },
      delete: {
        before: async ({ data }) => {
          // Return false to block deletion
          if (data.role === "admin") return false;
        },
      },
    },
    session: {
      create: {
        after: async ({ data, ctx }) => { /* log new session */ },
      },
    },
    account: {
      create: {
        after: async ({ data }) => { /* log account linking */ },
      },
    },
  },
});
```

### Block Operations

Return `false` from a `before` hook to prevent the operation:

```ts
user: {
  delete: {
    before: async ({ data }) => {
      if (protectedUsers.includes(data.id)) return false;
    },
  },
}
```

## Audit Logging Example

```ts
const auth = betterAuth({
  databaseHooks: {
    session: {
      create: {
        after: async ({ data, ctx }) => {
          await auditLog("session.created", {
            userId: data.userId,
            ip: ctx?.request?.headers.get("x-forwarded-for"),
            userAgent: ctx?.request?.headers.get("user-agent"),
          });
        },
      },
      delete: {
        before: async ({ data }) => {
          await auditLog("session.revoked", { sessionId: data.id });
        },
      },
    },
    user: {
      update: {
        after: async ({ data, oldData }) => {
          if (oldData?.email !== data.email) {
            await auditLog("user.email_changed", {
              userId: data.id,
              oldEmail: oldData?.email,
              newEmail: data.email,
            });
          }
        },
      },
    },
    account: {
      create: {
        after: async ({ data }) => {
          await auditLog("account.linked", {
            userId: data.userId,
            provider: data.providerId,
          });
        },
      },
    },
  },
});
```
