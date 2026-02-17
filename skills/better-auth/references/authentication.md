# Authentication Methods

## Table of Contents
- [Email & Password](#email--password)
- [Social OAuth](#social-oauth)
- [Magic Link](#magic-link)
- [Passkey (WebAuthn)](#passkey-webauthn)
- [Username](#username)
- [Email OTP](#email-otp)
- [Phone Number](#phone-number)
- [Anonymous](#anonymous)
- [Account Linking](#account-linking)

## Email & Password

Built-in, no plugin needed.

### Setup

```ts
const auth = betterAuth({
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,       // default: 8
    maxPasswordLength: 128,     // default: 128
    requireEmailVerification: true,
    autoSignIn: true,           // sign in after signup (default: true)
  },
  emailVerification: {
    sendVerificationEmail: async ({ user, url, token }, request) => {
      await sendEmail({ to: user.email, subject: "Verify email", text: `Click: ${url}` });
    },
    sendOnSignUp: true,
  },
});
```

### Client Usage

```ts
// Sign up
const { data, error } = await authClient.signUp.email({
  email: "user@example.com",
  password: "securepassword",
  name: "User Name",
  callbackURL: "https://example.com/dashboard", // always absolute URLs
});

// Sign in
const { data, error } = await authClient.signIn.email({
  email: "user@example.com",
  password: "securepassword",
  callbackURL: "https://example.com/dashboard",
});
```

### Password Reset

```ts
// Server config
const auth = betterAuth({
  emailAndPassword: {
    enabled: true,
    sendResetPassword: async ({ user, url, token }, request) => {
      void sendEmail({ to: user.email, subject: "Reset password", text: `Click: ${url}` });
    },
    resetPasswordTokenExpiresIn: 60 * 60,  // 1 hour (default)
    revokeSessionsOnPasswordReset: true,    // recommended
    onPasswordReset: async ({ user }, request) => { /* post-reset logic */ },
  },
});

// Client: request reset
await authClient.requestPasswordReset({
  email: "user@example.com",
  redirectTo: "https://example.com/reset-password",
});

// Client: reset password (on reset page, token from URL)
await authClient.resetPassword({
  token: "token-from-url",
  newPassword: "newsecurepassword",
});
```

### Custom Password Hashing

Default: scrypt (Node.js native, OWASP recommended). Custom example with Argon2id:

```ts
import { hash, verify } from "@node-rs/argon2";

const auth = betterAuth({
  emailAndPassword: {
    enabled: true,
    password: {
      hash: (password) => hash(password, { memoryCost: 65536, timeCost: 3, parallelism: 4 }),
      verify: ({ password, hash: stored }) => verify(stored, password),
    },
  },
});
```

## Social OAuth

Built-in, no plugin needed. 40+ providers supported.

### Setup (Top 10 Providers)

```ts
const auth = betterAuth({
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
    github: {
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    },
    apple: {
      clientId: process.env.APPLE_CLIENT_ID!,
      clientSecret: process.env.APPLE_CLIENT_SECRET!,
    },
    discord: {
      clientId: process.env.DISCORD_CLIENT_ID!,
      clientSecret: process.env.DISCORD_CLIENT_SECRET!,
    },
    microsoft: {
      clientId: process.env.MICROSOFT_CLIENT_ID!,
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET!,
    },
    twitter: {
      clientId: process.env.TWITTER_CLIENT_ID!,
      clientSecret: process.env.TWITTER_CLIENT_SECRET!,
    },
    facebook: {
      clientId: process.env.FACEBOOK_CLIENT_ID!,
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET!,
    },
    slack: {
      clientId: process.env.SLACK_CLIENT_ID!,
      clientSecret: process.env.SLACK_CLIENT_SECRET!,
    },
    linkedin: {
      clientId: process.env.LINKEDIN_CLIENT_ID!,
      clientSecret: process.env.LINKEDIN_CLIENT_SECRET!,
    },
    spotify: {
      clientId: process.env.SPOTIFY_CLIENT_ID!,
      clientSecret: process.env.SPOTIFY_CLIENT_SECRET!,
    },
  },
});
```

All other providers (Twitch, Reddit, TikTok, Notion, Zoom, Bitbucket, GitLab, Dropbox, etc.) follow the same `{ clientId, clientSecret }` pattern.

For custom OAuth providers, use the `genericOAuth` plugin:

```ts
import { genericOAuth } from "better-auth/plugins";

const auth = betterAuth({
  plugins: [
    genericOAuth({
      config: [{
        providerId: "myProvider",
        clientId: "...",
        clientSecret: "...",
        discoveryUrl: "https://provider.com/.well-known/openid-configuration",
        // or manual: authorizationUrl, tokenUrl, userInfoUrl
      }],
    }),
  ],
});
```

### Client Usage

```ts
await authClient.signIn.social({
  provider: "google",
  callbackURL: "https://example.com/dashboard",
  errorCallbackURL: "https://example.com/error",
});
```

### OAuth Security

Better Auth automatically uses:
- **PKCE** (Proof Key for Code Exchange) for all OAuth flows
- **State parameter** (32-char random, 10-min expiry) for CSRF protection
- Optional token encryption: `account: { encryptOAuthTokens: true }`

## Magic Link

Plugin: `magicLink`

### Setup

```ts
// Server
import { magicLink } from "better-auth/plugins";

const auth = betterAuth({
  plugins: [
    magicLink({
      sendMagicLink: async ({ email, url, token }, request) => {
        await sendEmail({ to: email, subject: "Sign in link", text: `Click: ${url}` });
      },
      expiresIn: 300,         // 5 minutes (default)
      disableSignUp: false,   // auto-create user on first use
    }),
  ],
});

// Client
import { magicLinkClient } from "better-auth/client/plugins";

const authClient = createAuthClient({
  plugins: [magicLinkClient()],
});
```

### Client Usage

```ts
await authClient.signIn.magicLink({
  email: "user@example.com",
  callbackURL: "https://example.com/dashboard",
});
```

## Passkey (WebAuthn)

Plugin: `passkey` (from `@better-auth/passkey`)

### Setup

```bash
npm install @better-auth/passkey
```

```ts
// Server
import { passkey } from "@better-auth/passkey";

const auth = betterAuth({
  plugins: [
    passkey({
      rpID: "example.com",
      rpName: "My App",
      origin: "https://example.com",
    }),
  ],
});

// Client
import { passkeyClient } from "@better-auth/passkey/client";

const authClient = createAuthClient({
  plugins: [passkeyClient()],
});
```

### Client Usage

```ts
// Register passkey
await authClient.passkey.addPasskey({ name: "My Device" });

// Sign in with passkey
await authClient.signIn.passkey();

// List user's passkeys
const { data } = await authClient.passkey.listPasskeys();

// Delete passkey
await authClient.passkey.deletePasskey({ id: "passkey-id" });
```

## Username

Plugin: `username`

### Setup

```ts
// Server
import { username } from "better-auth/plugins";

const auth = betterAuth({
  plugins: [
    username({
      minUsernameLength: 3,    // default: 3
      maxUsernameLength: 30,   // default: 30
    }),
  ],
});

// Client
import { usernameClient } from "better-auth/client/plugins";

const authClient = createAuthClient({
  plugins: [usernameClient()],
});
```

### Client Usage

```ts
// Sign up with username
await authClient.signUp.email({
  email: "user@example.com",
  password: "securepassword",
  name: "User",
  username: "cooluser",
});

// Sign in with username
await authClient.signIn.username({
  username: "cooluser",
  password: "securepassword",
});
```

## Email OTP

Plugin: `emailOtp`

### Setup

```ts
// Server
import { emailOtp } from "better-auth/plugins";

const auth = betterAuth({
  plugins: [
    emailOtp({
      sendVerificationOTP: async ({ email, otp, type }) => {
        await sendEmail({ to: email, subject: "Your code", text: `Code: ${otp}` });
      },
      otpLength: 6,           // default: 6
      expiresIn: 300,          // 5 minutes (default)
      allowedAttempts: 3,      // default: 3
    }),
  ],
});

// Client
import { emailOtpClient } from "better-auth/client/plugins";

const authClient = createAuthClient({
  plugins: [emailOtpClient()],
});
```

### Client Usage

```ts
// Send OTP
await authClient.emailOtp.sendVerificationOtp({ email: "user@example.com", type: "sign-in" });

// Sign in with OTP
await authClient.signIn.emailOtp({ email: "user@example.com", otp: "123456" });
```

## Phone Number

Plugin: `phoneNumber`

### Setup

```ts
import { phoneNumber } from "better-auth/plugins";

const auth = betterAuth({
  plugins: [
    phoneNumber({
      sendOTP: async ({ phoneNumber, code }) => {
        await sendSMS({ to: phoneNumber, message: `Code: ${code}` });
      },
      verifyOTP: async ({ phoneNumber, code }) => {
        // verify via your SMS provider
        return true; // or false
      },
    }),
  ],
});
```

## Anonymous

Plugin: `anonymous`

### Setup

```ts
// Server
import { anonymous } from "better-auth/plugins";

const auth = betterAuth({
  plugins: [
    anonymous({
      onLinkAccount: async ({ anonymousUser, newUser }) => {
        // migrate data from anonymous to real user
      },
    }),
  ],
});

// Client
import { anonymousClient } from "better-auth/client/plugins";

const authClient = createAuthClient({
  plugins: [anonymousClient()],
});
```

### Client Usage

```ts
// Create anonymous session
await authClient.signIn.anonymous();

// Later, link to real account (anonymous session auto-links)
await authClient.signIn.email({ email: "user@example.com", password: "..." });
```

## Account Linking

Enable linking multiple auth methods to a single user:

```ts
const auth = betterAuth({
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ["google", "github"], // auto-link these without email verification
    },
  },
});
```

When enabled, signing in with a new provider that shares the same email will link to the existing account instead of creating a new one.
