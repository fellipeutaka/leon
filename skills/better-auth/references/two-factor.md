# Two-Factor Authentication

## Table of Contents
- [Setup](#setup)
- [Enabling 2FA for Users](#enabling-2fa-for-users)
- [TOTP (Authenticator App)](#totp-authenticator-app)
- [OTP (Email/SMS)](#otp-emailsms)
- [Backup Codes](#backup-codes)
- [Sign-In Flow with 2FA](#sign-in-flow-with-2fa)
- [Trusted Devices](#trusted-devices)
- [Disabling 2FA](#disabling-2fa)
- [Security Notes](#security-notes)
- [Complete Config](#complete-config)

## Setup

```ts
// Server
import { betterAuth } from "better-auth";
import { twoFactor } from "better-auth/plugins/two-factor";

export const auth = betterAuth({
  appName: "My App",
  plugins: [
    twoFactor({
      issuer: "My App", // shown in authenticator apps
    }),
  ],
});

// Client
import { createAuthClient } from "better-auth/react";
import { twoFactorClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  plugins: [
    twoFactorClient({
      onTwoFactorRedirect() {
        window.location.href = "/2fa";
      },
    }),
  ],
});
```

Run `npx @better-auth/cli migrate` after adding the plugin.

## Enabling 2FA for Users

Requires password verification. Returns TOTP URI + backup codes.

```ts
const { data, error } = await authClient.twoFactor.enable({
  password: "user-password",
});

if (data) {
  // data.totpURI — generate QR code from this
  // data.backupCodes — show to user for safekeeping
}
```

**Important:** `twoFactorEnabled` flag is NOT set to `true` until the user verifies their first TOTP code. This confirms proper authenticator setup.

To skip initial verification (not recommended):

```ts
twoFactor({ skipVerificationOnEnable: true });
```

## TOTP (Authenticator App)

### QR Code Display

```tsx
import QRCode from "react-qr-code";

<QRCode value={totpURI} />
```

### Verify TOTP

Accepts codes from one period before/after current time (clock skew tolerance).

```ts
const { data, error } = await authClient.twoFactor.verifyTotp({
  code: "123456",
  trustDevice: true, // optional: skip 2FA for 30 days
});
```

### Config

```ts
twoFactor({
  totpOptions: {
    digits: 6,    // 6 or 8 (default: 6)
    period: 30,   // seconds (default: 30)
  },
});
```

## OTP (Email/SMS)

Send one-time codes via email or SMS. You must implement `sendOTP`.

### Setup

```ts
twoFactor({
  otpOptions: {
    sendOTP: async ({ user, otp }, ctx) => {
      await sendEmail({
        to: user.email,
        subject: "Your verification code",
        text: `Code: ${otp}`,
      });
    },
    period: 5,           // minutes (default: 3)
    digits: 6,           // default: 6
    allowedAttempts: 5,   // default: 5
    storeOTP: "encrypted", // "plain" | "encrypted" | "hashed"
  },
});
```

### Client Usage

```ts
// Send OTP
await authClient.twoFactor.sendOtp();

// Verify OTP
const { data, error } = await authClient.twoFactor.verifyOtp({
  code: "123456",
  trustDevice: true,
});
```

### Custom OTP Encryption

```ts
otpOptions: {
  storeOTP: {
    encrypt: async (token) => myEncrypt(token),
    decrypt: async (token) => myDecrypt(token),
  },
}
```

## Backup Codes

Generated automatically when 2FA is enabled. Each code is single-use.

### Show to User

```tsx
const BackupCodes = ({ codes }: { codes: string[] }) => (
  <ul>
    {codes.map((code, i) => <li key={i}>{code}</li>)}
  </ul>
);
```

### Regenerate (invalidates previous codes)

```ts
const { data } = await authClient.twoFactor.generateBackupCodes({
  password: "user-password",
});
// data.backupCodes
```

### Use for Recovery

```ts
await authClient.twoFactor.verifyBackupCode({
  code: "backup-code",
  trustDevice: true,
});
```

### Config

```ts
twoFactor({
  backupCodeOptions: {
    amount: 10,                   // default: 10
    length: 10,                   // default: 10
    storeBackupCodes: "encrypted", // "plain" | "encrypted"
  },
});
```

## Sign-In Flow with 2FA

When a 2FA-enabled user signs in, the response includes `twoFactorRedirect: true`.

### Client-Side

```ts
const { data, error } = await authClient.signIn.email(
  { email, password },
  {
    onSuccess(context) {
      if (context.data.twoFactorRedirect) {
        window.location.href = "/2fa"; // or use onTwoFactorRedirect in client plugin
      }
    },
  },
);
```

### Server-Side

```ts
const response = await auth.api.signInEmail({
  body: { email, password },
});

if ("twoFactorRedirect" in response) {
  // handle 2FA verification
}
```

### Session Flow During 2FA

1. User signs in with credentials
2. Session cookie is **removed** (not yet authenticated)
3. Temporary two-factor cookie is set (10-min expiry by default)
4. User verifies via TOTP, OTP, or backup code
5. Session cookie is created on successful verification

## Trusted Devices

Skip 2FA on subsequent sign-ins for trusted devices.

Pass `trustDevice: true` when verifying:

```ts
await authClient.twoFactor.verifyTotp({ code: "123456", trustDevice: true });
```

Config:

```ts
twoFactor({
  trustDeviceMaxAge: 30 * 24 * 60 * 60, // 30 days (default)
});
```

Trust refreshes on each successful sign-in within the window.

## Disabling 2FA

```ts
await authClient.twoFactor.disable({ password: "user-password" });
```

Trusted device records are revoked when 2FA is disabled.

## Security Notes

- TOTP secrets are encrypted at rest using the auth secret
- Backup codes stored encrypted by default
- Constant-time comparison for OTP verification (timing attack prevention)
- Built-in rate limiting: 3 requests per 10 seconds on all 2FA endpoints
- 2FA only available for credential (email/password) accounts, not social-only accounts

## Complete Config

```ts
twoFactor({
  issuer: "My App",
  totpOptions: { digits: 6, period: 30 },
  otpOptions: {
    sendOTP: async ({ user, otp }) => {
      await sendEmail({ to: user.email, subject: "Code", text: `Code: ${otp}` });
    },
    period: 5,
    allowedAttempts: 5,
    storeOTP: "encrypted",
  },
  backupCodeOptions: { amount: 10, length: 10, storeBackupCodes: "encrypted" },
  twoFactorCookieMaxAge: 600,          // 10 minutes
  trustDeviceMaxAge: 30 * 24 * 60 * 60, // 30 days
});
```
