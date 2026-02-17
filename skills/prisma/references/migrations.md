# Prisma Migrate Reference

## Table of Contents

- [prisma.config.ts](#prismaconfigts)
- [Commands](#commands)
- [Migration History](#migration-history)
- [Shadow Database](#shadow-database)
- [Development Workflow](#development-workflow)
- [Production Deployment](#production-deployment)
- [Customizing Migrations](#customizing-migrations)
- [Baselining Existing Databases](#baselining-existing-databases)
- [Seeding](#seeding)
- [Squashing Migrations](#squashing-migrations)
- [Down Migrations](#down-migrations)
- [Prototyping with db push](#prototyping-with-db-push)
- [Patching and Hotfixing Production](#patching-and-hotfixing-production)
- [Native Database Functions and PG Extensions](#native-database-functions-and-pg-extensions)
- [Unsupported Database Features](#unsupported-database-features)
- [Advisory Locking](#advisory-locking)

## prisma.config.ts

```ts
import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
    initShadowDb: `CREATE TABLE public.ext_table (id SERIAL PRIMARY KEY);`,
  },
  datasource: {
    url: env("DATABASE_URL"),
    shadowDatabaseUrl: env("SHADOW_DATABASE_URL"),
  },
});
```

- `migrations.initShadowDb` -- SQL run on shadow DB before migration generation (for external tables)
- `datasource.shadowDatabaseUrl` -- explicit shadow DB URL (for cloud-hosted DBs that disallow CREATE/DROP DATABASE)

## Commands

| Command | Env | Description |
|---|---|---|
| `prisma migrate dev` | dev | Generate + apply migrations, triggers client generation |
| `prisma migrate dev --create-only` | dev | Generate migration without applying (for editing) |
| `prisma migrate dev --name <name>` | dev | Name the migration folder |
| `prisma migrate deploy` | prod/staging | Apply pending migrations only |
| `prisma migrate reset` | dev | Drop DB, reapply all migrations, run seed |
| `prisma migrate resolve --applied <name>` | prod | Mark migration as already applied |
| `prisma migrate resolve --rolled-back <name>` | prod | Mark failed migration as rolled back |
| `prisma migrate diff` | any | Diff two schema sources, output SQL |
| `prisma migrate status` | any | Show migration status |
| `prisma db push` | dev | Sync schema to DB without migrations |
| `prisma db push --accept-data-loss` | dev | Push even if destructive changes |
| `prisma db pull` | any | Introspect DB into Prisma schema |
| `prisma db seed` | any | Run seed command from config |
| `prisma db execute --file <path>` | any | Run raw SQL file against DB |

## Migration History

```
prisma/migrations/
  migration_lock.toml
  20240101120000_init/
    migration.sql
  20240115090000_add_profile/
    migration.sql
```

The `_prisma_migrations` table tracks applied migrations, checksums (to detect edits), and error logs for failures.

Commit the entire `prisma/migrations/` folder (including `migration_lock.toml`) to source control. Customized migrations contain info not representable in the Prisma schema alone.

## Shadow Database

Temporary database created/deleted automatically by `migrate dev` to:
1. **Detect schema drift** -- replays history in shadow DB, compares to dev DB
2. **Generate new migrations** -- diffs target schema against shadow DB end state

Not used by production commands (`migrate deploy`, `migrate resolve`).

DB permissions: PostgreSQL needs `CREATEDB`, MySQL needs `CREATE, ALTER, DROP, REFERENCES ON *.*`.

For cloud DBs that disallow CREATE/DROP, set `shadowDatabaseUrl` in `prisma.config.ts` (must differ from `url`).

## Development Workflow

```bash
# 1. Edit schema.prisma
# 2. Create and apply migration
npx prisma migrate dev --name add_user_email

# 3. If schema drift or conflict detected, reset
npx prisma migrate reset
```

`migrate dev` will prompt to reset when:
- A migration file was edited or deleted
- DB schema drifted from migration history (e.g. manual DB changes)

## Production Deployment

```bash
npx prisma migrate deploy
```

Compares `_prisma_migrations` against `prisma/migrations/`, applies pending migrations. Warns on modified migrations. Does NOT reset DB, generate client, or use shadow DB. Run in CI/CD.

## Customizing Migrations

Use `--create-only` to generate a migration without applying, edit the SQL, then run `migrate dev` to apply.

### Rename a field (avoid data loss)

```bash
npx prisma migrate dev --name rename_bio --create-only
```

Replace the generated DROP/ADD with RENAME:

```sql
-- Generated (data loss):
ALTER TABLE "Profile" DROP COLUMN "biograpy", ADD COLUMN "biography" TEXT NOT NULL;
-- Fixed:
ALTER TABLE "Profile" RENAME COLUMN "biograpy" TO "biography";
```

```bash
npx prisma migrate dev
```

### Expand and contract pattern (zero-downtime)

1. Add new field alongside old, create migration, deploy writing to both
2. Create migration: `UPDATE "Profile" SET biography = bio;`
3. Switch reads to new field, stop writing old field
4. Remove old field from schema, create final migration

### Change 1-1 relation direction

Use `--create-only`, edit SQL to copy FK data before dropping old column:

```sql
ALTER TABLE "User" ADD COLUMN "profileId" INTEGER;
UPDATE "User" SET "profileId" = "Profile".id FROM "Profile" WHERE "User".id = "Profile"."userId";
ALTER TABLE "User" ALTER COLUMN "profileId" SET NOT NULL;
ALTER TABLE "Profile" DROP COLUMN "userId";
```

## Baselining Existing Databases

For databases that existed before Prisma Migrate and contain data that must be preserved:

```bash
# 1. Introspect to sync schema
npx prisma db pull

# 2. Generate baseline migration SQL
npx prisma migrate diff \
  --from-empty \
  --to-schema prisma/schema.prisma \
  --script > prisma/migrations/0_init/migration.sql

# 3. Mark as already applied (don't re-run on existing DB)
npx prisma migrate resolve --applied 0_init
```

This lets `migrate deploy` skip the baseline on production while new dev environments get the full history.

## Seeding

Configure in `prisma.config.ts`:

```ts
migrations: {
  path: "prisma/migrations",
  seed: "tsx prisma/seed.ts",
},
```

Example seed script (`prisma/seed.ts`):

```ts
import { PrismaClient } from "../prisma/generated/client";
const prisma = new PrismaClient();

async function main() {
  await prisma.user.upsert({
    where: { email: "alice@prisma.io" },
    update: {},
    create: { email: "alice@prisma.io", name: "Alice" },
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
```

```bash
npx prisma db seed
npx prisma db seed -- --environment development  # custom args
```

In Prisma v7, seeding is only triggered explicitly (not automatically during `migrate dev`/`reset`).

## Squashing Migrations

### Feature branch (before merging)

Reset `prisma/migrations/` to main branch state, then generate one migration:

```bash
npx prisma migrate dev --name squashed_migrations
```

### Production (clean history)

```bash
# Delete prisma/migrations/ contents, then:
npx prisma migrate diff \
  --from-empty --to-schema ./prisma/schema.prisma \
  --script > ./prisma/migrations/0_squashed/migration.sql
npx prisma migrate resolve --applied 0_squashed
```

Warning: custom SQL in migration files (views, triggers) is not retained when squashing.

## Down Migrations

Generate down migration **before** creating the up migration:

```bash
# 1. Edit schema, then generate down migration (new -> current state)
npx prisma migrate diff \
  --from-schema prisma/schema.prisma \
  --to-migrations prisma/migrations \
  --script > down.sql
# 2. Create up migration, copy down.sql into migration folder
npx prisma migrate dev --name add_profile
```

Apply after a failed deploy:

```bash
npx prisma db execute --file ./down.sql
npx prisma migrate resolve --rolled-back add_profile
```

## Prototyping with db push

Syncs schema to DB without migration files. No history, no `_prisma_migrations` interaction. Cannot rename columns (treats as drop + create).

```bash
npx prisma db push                  # sync schema
npx prisma db push --accept-data-loss  # force destructive changes
```

Transition to migrations when schema is stable:

```bash
npx prisma migrate dev --name initial  # prompts DB reset
```

Use `db push` for MongoDB (Prisma Migrate not supported).

## Patching and Hotfixing Production

When you apply a hotfix directly to production (e.g. adding an index):

```bash
# 1. Replicate change in schema.prisma, generate migration locally
npx prisma migrate dev --name retroactively_add_index
# 2. Mark as applied on production (don't re-run the hotfix)
npx prisma migrate resolve --applied "20240101120000_retroactively_add_index"
# 3. Commit migration; CI/CD applies to non-patched environments
```

### Fixing failed migrations

Option A -- roll back and re-deploy:

```bash
npx prisma migrate resolve --rolled-back "20240101_my_migration"
# Fix the migration SQL, then:
npx prisma migrate deploy
```

Option B -- manually complete and mark applied:

```bash
npx prisma migrate resolve --applied "20240101_my_migration"
```

Option C -- use `migrate diff` to generate fix scripts:

```bash
# Revert production to pre-migration state
npx prisma migrate diff \
  --from-config-datasource --to-migrations ./prisma/migrations \
  --config prisma.config.prod.ts --script > backward.sql
npx prisma db execute --config prisma.config.prod.ts --file backward.sql
npx prisma migrate resolve --rolled-back my_migration

# Or move forward to target state
npx prisma migrate diff \
  --from-config-datasource --to-schema schema.prisma \
  --config prisma.config.prod.ts --script > forward.sql
npx prisma db execute --config prisma.config.prod.ts --file forward.sql
npx prisma migrate resolve --applied my_migration
```

## Native Database Functions and PG Extensions

### Via Prisma schema (4.5.0+)

```prisma
datasource db {
  provider   = "postgresql"
  extensions = [pgcrypto]
}
```

Run `prisma migrate dev` to generate the migration with `CREATE EXTENSION`.

### Via custom migration SQL

```bash
npx prisma migrate dev --create-only
# Add to migration.sql:
```

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;
-- then use gen_random_uuid() in column defaults
```

```bash
npx prisma migrate dev
```

Always install extensions inside migrations so the shadow database gets them too.

## Unsupported Database Features

For features not representable in Prisma schema (stored procedures, triggers, views, partial indexes), use `--create-only`, add custom SQL, then apply:

```bash
npx prisma migrate dev --create-only
# Add to migration.sql:
#   CREATE UNIQUE INDEX tests_success_constraint ON posts (subject, target) WHERE success;
npx prisma migrate dev
```

## Advisory Locking

`migrate deploy`, `migrate dev`, and `migrate resolve` use advisory locks to prevent concurrent execution.

- 10-second timeout (not configurable)
- Uses native advisory locking: PostgreSQL `pg_advisory_lock`, MySQL `GET_LOCK`, MSSQL `sp_getapplock`
- Disable with env var: `PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK=true`
