# Drizzle Seed

Database seeding with type-safe, deterministic data generation from Drizzle schemas.

## Table of Contents
- [Installation](#installation)
- [Basic Usage](#basic-usage)
- [Seed Options](#seed-options)
- [Reset (Truncate)](#reset-truncate)
- [Generators](#generators)
- [Refinements](#refinements)
- [Deterministic Seeding](#deterministic-seeding)
- [Versioning](#versioning)

## Installation

```bash
npm i drizzle-seed
```

## Basic Usage

```ts
import { drizzle } from "drizzle-orm/node-postgres";
import { seed } from "drizzle-seed";
import * as schema from "./schema";

const db = drizzle(process.env.DATABASE_URL!, { schema });

async function main() {
  // Seed 20 users and 50 posts (auto-resolves foreign keys)
  await seed(db, schema);
}

main();
```

Drizzle Seed automatically:
- Detects table relations from foreign keys
- Generates appropriate data types per column (names, emails, dates, etc.)
- Maintains referential integrity
- Seeds tables in correct dependency order

## Seed Options

```ts
await seed(db, schema, {
  count: 100,          // number of rows per table (default: 10)
  seed: 12345,         // deterministic seed number
});

// Seed specific tables only
await seed(db, { users: schema.users, posts: schema.posts });
```

## Reset (Truncate)

Clear all data before seeding:

```ts
import { reset } from "drizzle-seed";

// Truncate all tables in schema
await reset(db, schema);

// Then seed fresh
await seed(db, schema);
```

## Generators

Built-in generators infer from column name and type:

| Column Pattern | Generated Data |
|---------------|---------------|
| `name`, `firstName`, `lastName` | Realistic names |
| `email` | Email addresses |
| `phone` | Phone numbers |
| `city`, `country`, `address` | Location data |
| `age` | Numbers in human age range |
| `url`, `website` | URLs |
| `createdAt`, `updatedAt` | Timestamps |
| `boolean`, `isActive` | true/false |
| `uuid`, `id` | UUIDs or sequential IDs |
| `price`, `amount` | Currency-like numbers |

## Refinements

Override generated data for specific columns:

```ts
import { seed } from "drizzle-seed";

await seed(db, schema).refine((f) => ({
  users: {
    count: 50,
    columns: {
      // Use a specific generator
      name: f.fullName(),
      email: f.email(),
      age: f.int({ minValue: 18, maxValue: 99 }),

      // Fixed value
      role: f.valuesFromArray({ values: ["admin", "user", "moderator"] }),

      // Weighted random
      status: f.weightedRandom([
        { value: f.default(), weight: 0.7 },    // 70% default generated
        { value: f.valuesFromArray({ values: ["vip"] }), weight: 0.3 },
      ]),
    },
  },
  posts: {
    count: 200,
    columns: {
      title: f.loremIpsum({ sentencesCount: 1 }),
      content: f.loremIpsum({ sentencesCount: 10 }),
    },
  },
}));
```

### Available Generator Functions

```ts
f.default()                                    // auto-detect from column
f.valuesFromArray({ values: [...] })           // pick from array
f.intPrimaryKey()                              // sequential IDs
f.number({ minValue, maxValue, precision })    // numbers
f.int({ minValue, maxValue })                  // integers
f.boolean()                                    // true/false
f.date({ minDate, maxDate })                   // dates
f.time()                                       // time strings
f.timestamp()                                  // timestamps
f.datetime()                                   // datetime
f.year()                                       // years
f.json()                                       // JSON objects
f.interval()                                   // intervals
f.string({ isUnique })                         // random strings
f.firstName()                                  // first names
f.lastName()                                   // last names
f.fullName()                                   // full names
f.email()                                      // emails
f.phone()                                      // phone numbers
f.country()                                    // countries
f.city()                                       // cities
f.streetAddress()                              // street addresses
f.jobTitle()                                   // job titles
f.postcode()                                   // postcodes
f.state()                                      // states
f.companyName()                                // company names
f.loremIpsum({ sentencesCount })               // lorem ipsum text
f.point()                                      // geographic points
f.line()                                       // geographic lines
f.uuid()                                       // UUIDs
f.weightedRandom([{ value, weight }])          // weighted selection
```

## Deterministic Seeding

Pass a `seed` number for reproducible data across runs:

```ts
// Same seed = same data every time
await seed(db, schema, { seed: 42 });

// Different seed = different data
await seed(db, schema, { seed: 123 });
```

Useful for:
- Consistent test fixtures
- Reproducible demos
- CI/CD environments

## Versioning

Seed versioning ensures deterministic output stays unchanged across `drizzle-seed` updates. If generator logic changes, a new version is released. Pin a version to keep existing data stable while upgrading for new features:

```ts
await seed(db, schema, { version: "2" });
```

| API Version | npm Version | Changed Generators |
|---|---|---|
| v1 | 0.1.1 | — |
| v2 (LTS) | 0.2.1 | `string()`, `interval({ isUnique: true })` |
