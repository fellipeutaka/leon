# Admin Plugin

## Table of Contents
- [Setup](#setup)
- [User Management](#user-management)
- [Roles](#roles)
- [Ban / Unban](#ban--unban)
- [Session Management](#session-management)
- [Impersonation](#impersonation)
- [Access Control](#access-control)

## Setup

```ts
// Server
import { betterAuth } from "better-auth";
import { admin } from "better-auth/plugins/admin";

export const auth = betterAuth({
  plugins: [admin()],
});

// Client
import { createAuthClient } from "better-auth/react";
import { adminClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  plugins: [adminClient()],
});
```

Run `npx @better-auth/cli migrate` after adding the plugin.

By default, only users with `role: "admin"` can access admin endpoints.

## User Management

### Create User

```ts
const { data } = await authClient.admin.createUser({
  name: "New User",
  email: "user@example.com",
  password: "securepassword",
  role: "user",
});
```

### List Users

```ts
const { data } = await authClient.admin.listUsers({
  query: {
    limit: 10,
    offset: 0,
    searchField: "email",
    searchValue: "example.com",
    searchOperator: "contains", // "starts_with" | "ends_with" | "contains" | "eq"
    sortBy: "createdAt",
    sortDirection: "desc",
    filterField: "role",
    filterValue: "admin",
    filterOperator: "eq",
  },
});
// data.users, data.total
```

### Update User

```ts
await authClient.admin.setUserPassword({
  userId: "user-id",
  newPassword: "newsecurepassword",
});
```

### Remove User

```ts
await authClient.admin.removeUser({ userId: "user-id" });
```

## Roles

### Set Role

```ts
await authClient.admin.setRole({
  userId: "user-id",
  role: "admin", // or any custom role
});
```

### Multiple Roles

Users can have multiple roles (comma-separated in DB):

```ts
await authClient.admin.setRole({
  userId: "user-id",
  role: ["admin", "moderator"],
});
```

## Ban / Unban

### Ban User

```ts
await authClient.admin.banUser({
  userId: "user-id",
  banReason: "Violated terms of service",
  banExpiresIn: 60 * 60 * 24 * 7, // 7 days (optional, permanent if omitted)
});
```

Banned users:
- Cannot sign in
- Existing sessions are revoked
- Receive `USER_BANNED` error with reason and expiry

### Unban User

```ts
await authClient.admin.unbanUser({ userId: "user-id" });
```

## Session Management

### List User Sessions

```ts
const { data } = await authClient.admin.listSessions({ userId: "user-id" });
```

### Revoke Session

```ts
await authClient.admin.revokeSession({ sessionToken: "session-token" });
```

### Revoke All Sessions

```ts
await authClient.admin.revokeSessions({ userId: "user-id" });
```

## Impersonation

Admins can impersonate users for debugging. Creates a special session that can be reverted.

```ts
// Start impersonation
await authClient.admin.impersonateUser({ userId: "target-user-id" });

// Stop impersonation (return to admin session)
await authClient.admin.stopImpersonation();
```

The impersonation session stores the original admin session for restoration.

## Access Control

### Default

By default, the `admin` plugin checks for `role: "admin"` on the user. Customize with `adminRoles`:

```ts
admin({
  adminRoles: ["admin", "superadmin"],
});
```

### Custom Access Control

For fine-grained permissions, use `createAccessControl`:

```ts
import { admin, createAccessControl } from "better-auth/plugins/admin";

const ac = createAccessControl({
  user: ["create", "read", "update", "delete", "ban", "impersonate", "set-role"],
  session: ["read", "revoke"],
});

const auth = betterAuth({
  plugins: [
    admin({
      ac,
      roles: {
        admin: ac.newRole({
          user: ["create", "read", "update", "delete", "ban", "set-role"],
          session: ["read", "revoke"],
        }),
        moderator: ac.newRole({
          user: ["read", "ban"],
          session: ["read"],
        }),
      },
    }),
  ],
});
```

### Check Permissions

```ts
const { data } = await authClient.admin.hasPermission({
  permission: { resource: "user", action: "delete" },
});
// data.hasPermission: boolean
```
