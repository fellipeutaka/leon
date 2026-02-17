# Organizations

## Table of Contents
- [Setup](#setup)
- [Creating Organizations](#creating-organizations)
- [Active Organization](#active-organization)
- [Members](#members)
- [Invitations](#invitations)
- [Roles & Permissions](#roles--permissions)
- [Teams](#teams)
- [Dynamic Access Control](#dynamic-access-control)
- [Lifecycle Hooks](#lifecycle-hooks)
- [Schema Customization](#schema-customization)
- [Security](#security)

## Setup

```ts
// Server
import { betterAuth } from "better-auth";
import { organization } from "better-auth/plugins/organization";

export const auth = betterAuth({
  plugins: [
    organization({
      allowUserToCreateOrganization: true,
      organizationLimit: 5,
      membershipLimit: 100,
    }),
  ],
});

// Client
import { createAuthClient } from "better-auth/react";
import { organizationClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  plugins: [organizationClient()],
});
```

Run `npx @better-auth/cli migrate` after adding the plugin.

## Creating Organizations

Creator is automatically assigned `owner` role.

```ts
const { data, error } = await authClient.organization.create({
  name: "My Company",
  slug: "my-company",
  logo: "https://example.com/logo.png",
  metadata: { plan: "pro" },
});
```

### Restrict Creation

```ts
organization({
  allowUserToCreateOrganization: async (user) => user.emailVerified === true,
  organizationLimit: async (user) => user.plan === "premium" ? 20 : 3,
});
```

### Server-Side (on behalf of user)

```ts
await auth.api.createOrganization({
  body: { name: "Client Org", slug: "client-org", userId: "owner-user-id" },
});
```

## Active Organization

Stored in session, scopes subsequent API calls.

```ts
await authClient.organization.setActive({ organizationId: "org-id" });

// These use active org automatically
await authClient.organization.listMembers();
await authClient.organization.listInvitations();

// Get full data
const { data } = await authClient.organization.getFullOrganization();
// data.organization, data.members, data.invitations, data.teams
```

## Members

### Add (server-side, no invitation)

```ts
await auth.api.addMember({
  body: { userId: "user-id", role: "member", organizationId: "org-id" },
});

// Multiple roles
await auth.api.addMember({
  body: { userId: "user-id", role: ["admin", "moderator"], organizationId: "org-id" },
});
```

### Remove

```ts
await authClient.organization.removeMember({ memberIdOrEmail: "user@example.com" });
```

Last owner cannot be removed — transfer ownership first.

### Update Role

```ts
await authClient.organization.updateMemberRole({ memberId: "member-id", role: "admin" });
```

### Membership Limits

```ts
organization({
  membershipLimit: async (user, organization) => {
    return organization.metadata?.plan === "enterprise" ? 1000 : 50;
  },
});
```

## Invitations

Requires email sending configuration.

### Setup Email

```ts
organization({
  sendInvitationEmail: async ({ email, organization, inviter, invitation }) => {
    await sendEmail({
      to: email,
      subject: `Join ${organization.name}`,
      html: `<a href="https://app.com/accept-invite?id=${invitation.id}">Accept</a>`,
    });
  },
  invitationExpiresIn: 60 * 60 * 24 * 7, // 7 days (default: 48h)
  invitationLimit: 100,
  cancelPendingInvitationsOnReInvite: true,
});
```

### Send Invitation

```ts
await authClient.organization.inviteMember({ email: "user@example.com", role: "member" });
```

### Shareable URL (no email sent)

```ts
const { data } = await authClient.organization.getInvitationURL({
  email: "user@example.com",
  role: "member",
  callbackURL: "https://app.com/dashboard",
});
// Share data.url via Slack, SMS, etc.
```

### Accept/Reject

```ts
await authClient.organization.acceptInvitation({ invitationId: "inv-id" });
await authClient.organization.rejectInvitation({ invitationId: "inv-id" });
```

## Roles & Permissions

Default roles:

| Role | Permissions |
|------|------------|
| `owner` | Full access, can delete org |
| `admin` | Manage members, invitations, settings |
| `member` | Basic access |

### Check Permission

```ts
// API call (works with dynamic access control)
const { data } = await authClient.organization.hasPermission({
  permission: "member:write",
});

// Client-side only (static roles, no API call)
const can = authClient.organization.checkRolePermission({
  role: "admin",
  permissions: ["member:write"],
});
```

## Teams

### Enable

```ts
organization({
  teams: { enabled: true, maximumTeams: 20, maximumMembersPerTeam: 50 },
});
```

### Usage

```ts
// Create team
const { data } = await authClient.organization.createTeam({ name: "Engineering" });

// Add member (must be org member first)
await authClient.organization.addTeamMember({ teamId: "team-id", userId: "user-id" });

// Remove from team (stays in org)
await authClient.organization.removeTeamMember({ teamId: "team-id", userId: "user-id" });

// Set active team
await authClient.organization.setActiveTeam({ teamId: "team-id" });
```

## Dynamic Access Control

Custom roles per organization at runtime.

```ts
organization({
  dynamicAccessControl: { enabled: true },
});
```

```ts
// Create custom role
await authClient.organization.createRole({
  role: "moderator",
  permission: { member: ["read"], invitation: ["read"] },
});

// Update role
await authClient.organization.updateRole({
  roleId: "role-id",
  permission: { member: ["read", "write"] },
});

// Delete custom role (pre-defined roles can't be deleted)
await authClient.organization.deleteRole({ roleId: "role-id" });
```

## Lifecycle Hooks

```ts
organization({
  hooks: {
    organization: {
      beforeCreate: async ({ data, user }) => ({
        data: { ...data, metadata: { ...data.metadata, createdBy: user.id } },
      }),
      afterCreate: async ({ organization, member }) => {
        await createDefaultResources(organization.id);
      },
      beforeDelete: async ({ organization }) => {
        await archiveOrganizationData(organization.id);
      },
    },
    member: {
      afterCreate: async ({ member, organization }) => {
        await notifyAdmins(organization.id, "New member joined");
      },
    },
    invitation: {
      afterCreate: async ({ invitation }) => { await logInvitation(invitation); },
    },
  },
});
```

## Schema Customization

```ts
organization({
  schema: {
    organization: {
      modelName: "workspace",
      fields: { name: "workspaceName" },
      additionalFields: {
        billingId: { type: "string", required: false },
      },
    },
    member: {
      additionalFields: {
        department: { type: "string", required: false },
        title: { type: "string", required: false },
      },
    },
  },
});
```

## Security

- **Owner protection:** last owner can't be removed, can't leave, role can't be removed
- **Ownership transfer:** update another member to `owner` before demoting/removing current owner
- **Org deletion:** `disableOrganizationDeletion: true` to prevent, or use hooks for soft delete
- **Invitation security:** expire after 48h by default, only invited email can accept, admins can cancel
