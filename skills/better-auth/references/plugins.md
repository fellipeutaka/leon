# Plugins

## Table of Contents
- [Using Plugins](#using-plugins)
- [Plugin Catalog](#plugin-catalog)
- [API Key Plugin](#api-key-plugin)
- [SSO (SAML/OIDC)](#sso-samloidc)
- [Creating Server Plugins](#creating-server-plugins)
- [Creating Client Plugins](#creating-client-plugins)

## Using Plugins

Pattern: server plugin + client plugin + re-run migrations.

```ts
// Server (auth.ts)
import { betterAuth } from "better-auth";
import { twoFactor } from "better-auth/plugins/two-factor";

export const auth = betterAuth({
  plugins: [twoFactor()],
});

// Client (auth-client.ts)
import { createAuthClient } from "better-auth/react";
import { twoFactorClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  plugins: [twoFactorClient()],
});
```

**After adding plugins, re-run migrations:**

```bash
npx @better-auth/cli@latest migrate   # built-in adapter
npx @better-auth/cli@latest generate   # Prisma/Drizzle
```

**Import from dedicated paths for tree-shaking:**

```ts
// DO
import { twoFactor } from "better-auth/plugins/two-factor";
// DON'T
import { twoFactor } from "better-auth/plugins";
```

## Plugin Catalog

### Built-in Plugins (from `better-auth/plugins/*`)

| Plugin | Client Plugin | Purpose |
|--------|--------------|---------|
| `twoFactor` | `twoFactorClient` | TOTP, OTP, backup codes |
| `organization` | `organizationClient` | Multi-tenant orgs, teams, RBAC |
| `admin` | `adminClient` | User CRUD, roles, ban, impersonation |
| `magicLink` | `magicLinkClient` | Passwordless email links |
| `emailOtp` | `emailOtpClient` | Email one-time passwords |
| `username` | `usernameClient` | Username-based auth |
| `phoneNumber` | `phoneNumberClient` | Phone/SMS auth |
| `anonymous` | `anonymousClient` | Guest sessions, account linking |
| `apiKey` | `apiKeyClient` | API key management |
| `bearer` | — | Bearer token auth for APIs |
| `jwt` | `jwtClient` | JWT token generation |
| `multiSession` | `multiSessionClient` | Multiple active sessions |
| `oauthProvider` | — | Become an OAuth provider |
| `oidcProvider` | — | Become an OIDC provider |
| `openAPI` | — | Auto-generate API docs |
| `customSession` | — | Extend session with custom data |
| `genericOAuth` | `genericOAuthClient` | Custom OAuth providers |
| `oneTap` | `oneTapClient` | Google One Tap sign-in |
| `expo` | — | React Native/Expo support |
| `nextCookies` | — | Next.js RSC cookie access |
| `sveltekitCookies` | — | SvelteKit form action cookies |

### Scoped Packages

| Package | Plugin | Purpose |
|---------|--------|---------|
| `@better-auth/passkey` | `passkey` / `passkeyClient` | WebAuthn/FIDO2 |
| `@better-auth/sso` | `sso` / `ssoClient` | SAML/OIDC enterprise SSO |
| `@better-auth/stripe` | `stripe` | Stripe payments integration |
| `@better-auth/expo` | `expoClient` | Expo secure storage |
| `@better-auth/electron` | `electron` / `electronClient` | Desktop app auth |

## API Key Plugin

```ts
// Server
import { apiKey } from "better-auth/plugins/api-key";

const auth = betterAuth({
  plugins: [
    apiKey({
      defaultKeyLength: 64,
      defaultPrefix: "ba",
      enableMetadata: true,
      rateLimit: { window: 60, max: 100 },
      keyExpiration: { defaultExpiresIn: 60 * 60 * 24 * 30 }, // 30 days
    }),
  ],
});

// Client
import { apiKeyClient } from "better-auth/client/plugins";

const authClient = createAuthClient({ plugins: [apiKeyClient()] });
```

Usage:

```ts
// Create key
const { data } = await authClient.apiKey.create({
  name: "My API Key",
  expiresIn: 60 * 60 * 24 * 90, // 90 days
  remaining: 1000,               // request cap
  refillAmount: 1000,
  refillInterval: 60 * 60 * 24,  // daily refill
  metadata: { project: "my-app" },
});
// data.key — full key (only shown once)

// Verify key (server-side)
const { data } = await auth.api.verifyApiKey({
  body: { key: "ba_..." },
});

// List keys
const { data } = await authClient.apiKey.list();

// Delete key
await authClient.apiKey.delete({ keyId: "key-id" });
```

Storage: `"database"` (default), `"secondary-storage"` (Redis), or both with fallback.

## SSO (SAML/OIDC)

```bash
npm install @better-auth/sso
```

```ts
// Server
import { sso } from "@better-auth/sso";

const auth = betterAuth({
  plugins: [
    sso({
      // configure SSO providers
    }),
  ],
});

// Client
import { ssoClient } from "@better-auth/sso/client";

const authClient = createAuthClient({ plugins: [ssoClient()] });
```

## Creating Server Plugins

```ts
import { createAuthEndpoint } from "better-auth/api";
import { type BetterAuthPlugin } from "better-auth";

const myPlugin = {
  id: "my-plugin",
  endpoints: {
    myEndpoint: createAuthEndpoint(
      "/my-plugin/action",
      { method: "POST", body: z.object({ data: z.string() }) },
      async (ctx) => {
        const session = ctx.context.session; // if sessionMiddleware used
        return ctx.json({ result: "ok" });
      },
    ),
  },
  schema: {
    myTable: {
      tableName: "my_table",
      fields: {
        userId: { type: "string", references: { model: "user", field: "id" } },
        data: { type: "string", required: true },
      },
    },
  },
  hooks: {
    before: [
      {
        matcher: (context) => context.path === "/sign-in/email",
        handler: async (ctx) => { /* pre-sign-in logic */ },
      },
    ],
    after: [
      {
        matcher: (context) => context.path === "/sign-up/email",
        handler: async (ctx) => { /* post-sign-up logic */ },
      },
    ],
  },
  rateLimit: [
    { pathMatcher: (path) => path === "/my-plugin/action", window: 60, max: 10 },
  ],
} satisfies BetterAuthPlugin;
```

### Helper Functions

```ts
import { getSessionFromCtx, sessionMiddleware } from "better-auth/api";

// In endpoint — require authenticated session
const myEndpoint = createAuthEndpoint(
  "/my-plugin/action",
  { method: "POST", use: [sessionMiddleware] },
  async (ctx) => {
    const { user, session } = ctx.context.session;
    // ...
  },
);
```

### Context Utilities

Available in hooks and endpoints:

- `ctx.json(data)` — return JSON response
- `ctx.redirect(url)` — redirect response
- `ctx.setCookies(name, value, options)` — set cookie
- `ctx.getSignedCookie(name, secret)` — read signed cookie
- `ctx.context.session` — current session (with sessionMiddleware)
- `ctx.context.adapter` — database adapter
- `ctx.context.password.hash(pw)` / `.verify({ password, hash })` — password hashing
- `ctx.context.generateId()` — generate unique ID
- `throw new APIError("BAD_REQUEST", { message })` — error responses

## Creating Client Plugins

```ts
import type { BetterAuthClientPlugin } from "better-auth/client";

const myClientPlugin = {
  id: "my-plugin",
  getActions: ($fetch) => ({
    myAction: async (data: { input: string }) => {
      const result = await $fetch("/my-plugin/action", { method: "POST", body: data });
      return result;
    },
  }),
} satisfies BetterAuthClientPlugin;
```

The client plugin infers types from the server plugin endpoints automatically when using `createAuthClient<typeof auth>()`.
