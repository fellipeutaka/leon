# Session Management

## Table of Contents
- [Session Table](#session-table)
- [Expiration & Refresh](#expiration--refresh)
- [Session Freshness](#session-freshness)
- [Accessing Sessions](#accessing-sessions)
- [Session Management Methods](#session-management-methods)
- [Cookie Cache](#cookie-cache)
- [Secondary Storage](#secondary-storage)
- [Stateless Mode](#stateless-mode)
- [Custom Session Data](#custom-session-data)

## Session Table

| Field | Type | Description |
|-------|------|-------------|
| id | string | Session ID |
| userId | string | User reference |
| token | string | Session token (stored in cookie) |
| expiresAt | Date | Expiration timestamp |
| ipAddress | string | Client IP |
| userAgent | string | Client user agent |
| createdAt | Date | Created timestamp |
| updatedAt | Date | Last updated |

## Expiration & Refresh

```ts
session: {
  expiresIn: 60 * 60 * 24 * 7,  // 7 days (default)
  updateAge: 60 * 60 * 24,       // refresh session every 24h (default)
}
```

- `expiresIn`: total session lifetime in seconds
- `updateAge`: how often to refresh the session expiry. Set to `0` to refresh on every request

## Session Freshness

Controls when re-authentication is required for sensitive operations:

```ts
session: {
  freshAge: 60 * 60 * 24, // 24 hours (default)
}
```

A session is "fresh" if the user authenticated within `freshAge` seconds. Use for password changes, viewing sensitive data, etc.

## Accessing Sessions

### Client-Side

```ts
// React hook (reactive)
const { data: session, isPending, error } = authClient.useSession();

// One-time fetch
const { data: session } = await authClient.getSession();
```

### Server-Side

```ts
// Any framework — pass request headers
const session = await auth.api.getSession({ headers: request.headers });

// Next.js RSC (requires nextCookies plugin)
import { headers } from "next/headers";
const session = await auth.api.getSession({ headers: await headers() });

// SvelteKit
const session = await auth.api.getSession({ headers: event.request.headers });
```

## Session Management Methods

```ts
// List all sessions for current user
const { data } = await authClient.listSessions();

// Revoke a specific session
await authClient.revokeSession({ token: "session-token" });

// Revoke all other sessions (keep current)
await authClient.revokeOtherSessions();

// Revoke all sessions (including current)
await authClient.revokeSessions();
```

Server-side equivalents:

```ts
await auth.api.listSessions({ headers });
await auth.api.revokeSession({ headers, body: { token: "session-token" } });
await auth.api.revokeOtherSessions({ headers });
await auth.api.revokeSessions({ headers });
```

## Cookie Cache

Caches session data in cookies to reduce DB queries:

```ts
session: {
  cookieCache: {
    enabled: true,
    maxAge: 60 * 5,      // 5 minutes (default)
    strategy: "compact",  // "compact" | "jwt" | "jwe"
    version: 1,           // change to invalidate all cached sessions
  },
}
```

| Strategy | Description | Size | Security |
|----------|-------------|------|----------|
| `compact` | Base64url + HMAC-SHA256 | Smallest | Signed |
| `jwt` | Standard HS256 JWT | Medium | Signed, readable |
| `jwe` | A256CBC-HS512 encrypted | Largest | Encrypted |

**Important:**
- Custom session fields (from `customSession` plugin) are NOT cached — always re-fetched from DB
- Use `jwe` when session data contains sensitive info
- Change `version` to invalidate all cached sessions globally

## Secondary Storage

When `secondaryStorage` is configured (Redis, KV, etc.):

- Sessions are stored there **by default** (not in DB)
- Rate limiting uses it automatically
- To also persist to DB: `session: { storeSessionInDatabase: true }`

```ts
const auth = betterAuth({
  secondaryStorage: {
    get: async (key) => await redis.get(key),
    set: async (key, value, ttl) => {
      if (ttl) await redis.set(key, value, "EX", ttl);
      else await redis.set(key, value);
    },
    delete: async (key) => await redis.del(key),
  },
  session: {
    storeSessionInDatabase: true, // persist to both
  },
});
```

## Stateless Mode

No database + cookie cache = fully stateless sessions.

```ts
const auth = betterAuth({
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 60 * 60 * 24, // 24 hours
      strategy: "jwe",       // encrypted recommended
    },
  },
  // no database config
});
```

Limitations:
- No session listing/revocation
- Logout only effective after cache expiry
- No IP/userAgent tracking

## Custom Session Data

Use the `customSession` plugin to extend session response with computed fields:

```ts
import { customSession } from "better-auth/plugins";

const auth = betterAuth({
  plugins: [
    customSession(async ({ user, session }) => {
      const roles = await getUserRoles(user.id);
      return {
        user: { ...user, roles },
        session,
      };
    }),
  ],
});
```

The custom fields are available in `useSession()` and `getSession()` responses, and are fully typed.

**Note:** Custom session fields bypass cookie cache — each request fetches fresh data from the callback.
