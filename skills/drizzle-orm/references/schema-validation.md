# Schema Validation

Generate validation schemas from Drizzle table definitions for use with Zod, Valibot, ArkType, TypeBox, or Effect.

## Table of Contents
- [Installation](#installation)
- [Core API](#core-api)
- [Refinements](#refinements)
- [Type Inference](#type-inference)
- [Data Type Mapping](#data-type-mapping)

## Installation

```bash
# Pick one:
npm i drizzle-zod        # Zod
npm i drizzle-valibot     # Valibot
npm i drizzle-arktype     # ArkType
npm i drizzle-typebox     # TypeBox
npm i drizzle-effect      # Effect Schema
```

## Core API

All integrations share the same API pattern:

### drizzle-zod

```ts
import { createSelectSchema, createInsertSchema, createUpdateSchema } from "drizzle-zod";
import { users } from "./schema";

// Select schema — validates query results
const selectUserSchema = createSelectSchema(users);

// Insert schema — validates new records (omits auto-generated fields, applies defaults)
const insertUserSchema = createInsertSchema(users);

// Update schema — all fields optional (partial)
const updateUserSchema = createUpdateSchema(users);

// Usage
const validUser = insertUserSchema.parse(requestBody);
```

### drizzle-valibot

```ts
import { createSelectSchema, createInsertSchema, createUpdateSchema } from "drizzle-valibot";
import * as v from "valibot";
import { users } from "./schema";

const selectUserSchema = createSelectSchema(users);
const insertUserSchema = createInsertSchema(users);
const updateUserSchema = createUpdateSchema(users);

const result = v.parse(insertUserSchema, requestBody);
```

### drizzle-arktype

```ts
import { createSelectSchema, createInsertSchema, createUpdateSchema } from "drizzle-arktype";
import { users } from "./schema";

const selectUserSchema = createSelectSchema(users);
const insertUserSchema = createInsertSchema(users);
const updateUserSchema = createUpdateSchema(users);

const result = insertUserSchema(requestBody);
```

### drizzle-typebox

```ts
import { createSelectSchema, createInsertSchema, createUpdateSchema } from "drizzle-typebox";
import { Value } from "@sinclair/typebox/value";
import { users } from "./schema";

const selectUserSchema = createSelectSchema(users);
const insertUserSchema = createInsertSchema(users);
const updateUserSchema = createUpdateSchema(users);

const isValid = Value.Check(insertUserSchema, requestBody);
```

### drizzle-effect

```ts
import { createSelectSchema, createInsertSchema, createUpdateSchema } from "drizzle-effect";
import { Schema } from "effect";
import { users } from "./schema";

const selectUserSchema = createSelectSchema(users);
const insertUserSchema = createInsertSchema(users);

const decoded = Schema.decodeUnknownSync(insertUserSchema)(requestBody);
```

## Refinements

Override or extend generated field schemas:

### drizzle-zod

```ts
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./schema";

const insertUserSchema = createInsertSchema(users, {
  // override specific fields with custom validation
  email: z.string().email("Invalid email"),
  age: z.number().min(18, "Must be 18+"),
  // callback form — receives generated schema
  name: (schema) => schema.min(2).max(100),
});
```

### drizzle-valibot

```ts
import { createInsertSchema } from "drizzle-valibot";
import * as v from "valibot";
import { users } from "./schema";

const insertUserSchema = createInsertSchema(users, {
  email: v.pipe(v.string(), v.email("Invalid email")),
  age: v.pipe(v.number(), v.minValue(18)),
  name: (schema) => v.pipe(schema, v.minLength(2)),
});
```

### Enum Column Refinement

```ts
// Given: role: text({ enum: ["admin", "user"] })
// Generated schema already restricts to "admin" | "user"
// Further refine if needed:
const schema = createInsertSchema(users, {
  role: z.enum(["admin", "user"]).default("user"),
});
```

## Type Inference

```ts
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./schema";

const insertSchema = createInsertSchema(users);
const selectSchema = createSelectSchema(users);

// Infer TypeScript types from schemas
type InsertUser = z.infer<typeof insertSchema>;
type SelectUser = z.infer<typeof selectSchema>;

// Equivalent to Drizzle's built-in inference:
// type InsertUser = typeof users.$inferInsert;
// type SelectUser = typeof users.$inferSelect;
```

## Data Type Mapping

| Drizzle Column | Zod Schema | Notes |
|---------------|------------|-------|
| `text()` | `z.string()` | |
| `text({ enum: [...] })` | `z.enum([...])` | |
| `varchar({ length: n })` | `z.string().max(n)` | max length preserved |
| `integer()` | `z.number()` | |
| `bigint({ mode: "bigint" })` | `z.bigint()` | |
| `bigint({ mode: "number" })` | `z.number()` | |
| `boolean()` | `z.boolean()` | |
| `timestamp()` | `z.date()` | mode: "date" |
| `timestamp({ mode: "string" })` | `z.string()` | |
| `date()` | `z.string()` | |
| `json()` | `z.any()` | use .$type<T> + refinement |
| `jsonb()` | `z.any()` | use .$type<T> + refinement |
| `uuid()` | `z.string().uuid()` | |
| `.notNull()` | removes `.nullable()` | |
| `.default(v)` | adds `.default(v)` | in insert schema only |
| `.primaryKey()` (serial) | optional in insert | auto-generated |
