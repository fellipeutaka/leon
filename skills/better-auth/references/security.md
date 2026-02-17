# Security

## Table of Contents
- [Secret Management](#secret-management)
- [Rate Limiting](#rate-limiting)
- [CSRF Protection](#csrf-protection)
- [Trusted Origins](#trusted-origins)
- [Cookie Security](#cookie-security)
- [OAuth Security](#oauth-security)
- [IP-Based Security](#ip-based-security)
- [Account Enumeration Prevention](#account-enumeration-prevention)
- [Background Tasks](#background-tasks)
- [Database Hooks for Auditing](#database-hooks-for-auditing)
- [Complete Security Config](#complete-security-config)
- [Security Checklist](#security-checklist)

## Secret Management

```ts
const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET, // or via env var directly
});
```

Lookup order: `options.secret` → `BETTER_AUTH_SECRET` → `AUTH_SECRET` env var.

Production validation:
- Rejects default/placeholder secrets
- Warns if < 32 characters
- Warns if entropy < 120 bits

Generate: `openssl rand -base64 32`

## Rate Limiting

Enabled by default in production. Applies to all endpoints.

```ts
const auth = betterAuth({
  rateLimit: {
    enabled: true,
    window: 10,    // seconds (default: 10)
    max: 100,      // requests per window (default: 100)
    storage: "secondary-storage", // "memory" | "database" | "secondary-storage"
  },
});
```

**Storage options:**
- `"memory"` — fast but resets on restart. **Not recommended for serverless.**
- `"database"` — persistent but adds DB load
- `"secondary-storage"` — uses configured Redis/KV (default when available)

### Per-Endpoint Rules

Default stricter limits: `/sign-in`, `/sign-up`, `/change-password`, `/change-email` → 3 req/10s.

```ts
rateLimit: {
  customRules: {
    "/api/auth/sign-in/email": { window: 60, max: 5 },
    "/api/auth/sign-up/email": { window: 60, max: 3 },
    "/api/auth/some-safe-endpoint": false, // disable
  },
}
```

### Custom Storage

```ts
rateLimit: {
  customStorage: {
    get: async (key) => { /* return { count, expiresAt } | null */ },
    set: async (key, data) => { /* store data */ },
  },
}
```

## CSRF Protection

Three layers, all enabled by default:

1. **Origin Header Validation** — `Origin`/`Referer` must match trusted origin when cookies present
2. **Fetch Metadata** — blocks requests where `Sec-Fetch-Site: cross-site` + `Sec-Fetch-Mode: navigate` + `Sec-Fetch-Dest: document`
3. **First-Login Protection** — validates origin even without cookies via Fetch Metadata

```ts
advanced: {
  disableCSRFCheck: false, // keep enabled (default)
}
```

## Trusted Origins

Controls which domains can make authenticated requests.

```ts
const auth = betterAuth({
  baseURL: "https://api.example.com", // auto-trusted
  trustedOrigins: [
    "https://app.example.com",
    "https://admin.example.com",
    "*.example.com",                  // subdomain wildcard
    "https://*.example.com",          // protocol-specific wildcard
    "exp://192.168.*.*:*/*",          // custom schemes (Expo)
  ],
});
```

Via env var: `BETTER_AUTH_TRUSTED_ORIGINS=https://app.example.com,https://admin.example.com`

### Dynamic Origins

```ts
trustedOrigins: async (request) => {
  const tenant = getTenantFromRequest(request);
  return [`https://${tenant}.myapp.com`];
}
```

Validated parameters: `callbackURL`, `redirectTo`, `errorCallbackURL`, `newUserCallbackURL`, `origin`. Invalid → 403.

## Cookie Security

### Defaults

- `secure`: true when HTTPS or production
- `sameSite`: `"lax"`
- `httpOnly`: true
- `path`: `"/"`
- Prefix: `__Secure-` when secure enabled

### Custom Config

```ts
advanced: {
  useSecureCookies: true,
  cookiePrefix: "myapp",
  defaultCookieAttributes: {
    sameSite: "strict",
    path: "/auth",
  },
  // Per-cookie
  cookies: {
    session_token: {
      name: "auth-session",
      attributes: { sameSite: "strict" },
    },
  },
}
```

### Cross-Subdomain Cookies

```ts
advanced: {
  crossSubDomainCookies: {
    enabled: true,
    domain: ".example.com", // leading dot
    additionalCookies: ["session_token", "session_data"],
  },
}
```

Only enable if you trust all subdomains.

## OAuth Security

### PKCE (automatic)

All OAuth flows use PKCE automatically:
1. Generates 128-char random `code_verifier`
2. Creates `code_challenge` using S256 (SHA-256)
3. Validates code exchange with original verifier

### State Parameter

32-char random, 10-min expiry, encrypted. Stored in cookie by default.

```ts
account: {
  storeStateStrategy: "cookie", // "cookie" (default) | "database"
}
```

### Token Encryption

```ts
account: {
  encryptOAuthTokens: true, // AES-256-GCM
}
```

Enable if storing OAuth tokens for API access on behalf of users.

### Mobile Apps (skip state cookie)

```ts
account: {
  skipStateCookieCheck: true, // only for mobile apps that can't maintain cookies
}
```

## IP-Based Security

```ts
advanced: {
  ipAddress: {
    ipAddressHeaders: ["x-forwarded-for", "x-real-ip"],
    disableIpTracking: false,
    ipv6Subnet: 64, // 128 | 64 | 48 | 32 (default: 64)
  },
  trustedProxyHeaders: true, // only if behind trusted proxy
}
```

## Account Enumeration Prevention

Built-in protections:
- Consistent response messages ("If this email exists...")
- Dummy operations when user not found (same timing)
- Background email sending (no timing differences)

**Do:** Return generic errors ("Invalid credentials"). **Don't:** Return "User not found" or "Incorrect password".

## Background Tasks

For serverless platforms — ensures async operations (emails) complete without affecting response timing:

```ts
advanced: {
  backgroundTasks: {
    handler: (promise) => {
      waitUntil(promise); // Vercel: waitUntil, Cloudflare: ctx.waitUntil
    },
  },
}
```

## Database Hooks for Auditing

```ts
const auth = betterAuth({
  databaseHooks: {
    session: {
      create: {
        after: async ({ data, ctx }) => {
          await auditLog("session.created", {
            userId: data.userId,
            ip: ctx?.request?.headers.get("x-forwarded-for"),
          });
        },
      },
    },
    user: {
      update: {
        after: async ({ data, oldData }) => {
          if (oldData?.email !== data.email) {
            await auditLog("user.email_changed", { userId: data.id });
          }
        },
      },
      delete: {
        before: async ({ data }) => {
          if (protectedUserIds.includes(data.id)) return false; // block deletion
        },
      },
    },
  },
});
```

## Complete Security Config

```ts
const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: "https://api.example.com",
  trustedOrigins: ["https://app.example.com", "https://*.preview.example.com"],

  rateLimit: {
    enabled: true,
    storage: "secondary-storage",
    customRules: {
      "/api/auth/sign-in/email": { window: 60, max: 5 },
      "/api/auth/sign-up/email": { window: 60, max: 3 },
    },
  },

  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
    freshAge: 60 * 60,
    cookieCache: { enabled: true, maxAge: 300, strategy: "jwe" },
  },

  account: { encryptOAuthTokens: true },

  advanced: {
    useSecureCookies: true,
    cookiePrefix: "myapp",
    ipAddress: { ipAddressHeaders: ["x-forwarded-for"], ipv6Subnet: 64 },
    backgroundTasks: { handler: (promise) => waitUntil(promise) },
  },
});
```

## Security Checklist

- [ ] Secret: 32+ chars, high entropy, not in version control
- [ ] HTTPS: `baseURL` uses HTTPS in production
- [ ] Trusted origins: all frontends configured
- [ ] Rate limiting: enabled with appropriate limits
- [ ] CSRF: enabled (don't set `disableCSRFCheck: true`)
- [ ] Secure cookies: automatic with HTTPS
- [ ] OAuth tokens: `encryptOAuthTokens: true` if storing for API access
- [ ] Background tasks: configured for serverless platforms
- [ ] Audit logging: implemented via `databaseHooks`
- [ ] IP tracking: headers configured if behind proxy
- [ ] Email verification: enabled for email/password auth
- [ ] Session revocation: `revokeSessionsOnPasswordReset: true`
