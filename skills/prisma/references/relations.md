# Prisma Relations

## Table of Contents

- [The @relation Attribute](#the-relation-attribute)
- [One-to-One Relations](#one-to-one-relations)
- [One-to-Many Relations](#one-to-many-relations)
- [Many-to-Many Relations](#many-to-many-relations)
- [Self-Relations](#self-relations)
- [Disambiguating Relations](#disambiguating-relations)
- [Referential Actions](#referential-actions)
- [Relation Mode](#relation-mode)
- [Troubleshooting](#troubleshooting)

## The @relation Attribute

Anatomy: `@relation(name?, fields: [], references: [], onDelete?, onUpdate?)`

- `name` -- optional string to disambiguate multiple relations between same models
- `fields` -- scalar fields on THIS model that form the foreign key
- `references` -- fields on the OTHER model being referenced (usually `id`)
- `onDelete` / `onUpdate` -- referential actions

Required when:

- Defining 1-1 or 1-n relations (on the side storing the FK)
- Disambiguating multiple relations between same models
- Defining self-relations
- Defining m-n relations for MongoDB

NOT required for implicit m-n relations on relational databases.

**Key terminology:**

- **Relation field** -- field whose type is another model (e.g. `author User`). Does NOT exist in database.
- **Relation scalar field** -- the actual FK column in the database (e.g. `authorId Int`).

```prisma
model Post {
  id       Int  @id @default(autoincrement())
  author   User @relation(fields: [authorId], references: [id])  // relation field
  authorId Int  // relation scalar field (FK in database)
}
```

## One-to-One Relations

The FK side must have `@unique` on the scalar field. The side WITHOUT a relation scalar must be optional (`?`).

### Basic 1-1

```prisma
model User {
  id      Int      @id @default(autoincrement())
  profile Profile?
}

model Profile {
  id     Int  @id @default(autoincrement())
  user   User @relation(fields: [userId], references: [id])
  userId Int  @unique
}
```

### Required vs Optional

Required (cannot create Profile without User):

```prisma
model Profile {
  id     Int  @id @default(autoincrement())
  user   User @relation(fields: [userId], references: [id])
  userId Int  @unique
}
```

Optional (can create Profile without User):

```prisma
model Profile {
  id     Int   @id @default(autoincrement())
  user   User? @relation(fields: [userId], references: [id])
  userId Int?  @unique
}
```

### Multi-field 1-1 (relational DBs only)

```prisma
model User {
  firstName String
  lastName  String
  profile   Profile?
  @@id([firstName, lastName])
}

model Profile {
  id            Int    @id @default(autoincrement())
  user          User   @relation(fields: [userFirstName, userLastName], references: [firstName, lastName])
  userFirstName String
  userLastName  String
  @@unique([userFirstName, userLastName])
}
```

### Choosing FK side

Either side can hold the FK. Place it on whichever model you query/create more often.

## One-to-Many Relations

No `@unique` on the FK scalar (that's what makes it 1-n instead of 1-1).

```prisma
model User {
  id    Int    @id @default(autoincrement())
  posts Post[]
}

model Post {
  id       Int  @id @default(autoincrement())
  author   User @relation(fields: [authorId], references: [id])
  authorId Int
}
```

### Optional 1-n

```prisma
model Post {
  id       Int   @id @default(autoincrement())
  author   User? @relation(fields: [authorId], references: [id])
  authorId Int?
}
```

### Multi-field 1-n

```prisma
model User {
  firstName String
  lastName  String
  posts     Post[]
  @@id([firstName, lastName])
}

model Post {
  id              Int    @id @default(autoincrement())
  author          User   @relation(fields: [authorFirstName, authorLastName], references: [firstName, lastName])
  authorFirstName String
  authorLastName  String
}
```

## Many-to-Many Relations

### Implicit m-n (relational DBs only)

Prisma manages the join table automatically. Simplest API.

```prisma
model Post {
  id         Int        @id @default(autoincrement())
  categories Category[]
}

model Category {
  id    Int    @id @default(autoincrement())
  posts Post[]
}
```

**Rules for implicit m-n:**

- Both models MUST have a single `@id` (no composite IDs, no `@unique` as substitute)
- No `fields`, `references`, `onUpdate`, or `onDelete` allowed in `@relation`
- `@relation` only needed to disambiguate or name the join table

**Join table conventions** (for `prisma db pull` recognition):

- Table name: `_CategoryToPost` (underscore + model names alphabetically joined by `To`)
- Columns: `A` (FK to alphabetically-first model), `B` (FK to second)
- Unique index on `(A, B)`, non-unique index on `B`

### Explicit m-n (with join model)

Use when you need extra fields on the relation or composite IDs.

```prisma
model Post {
  id         Int                 @id @default(autoincrement())
  title      String
  categories CategoriesOnPosts[]
}

model Category {
  id    Int                 @id @default(autoincrement())
  name  String
  posts CategoriesOnPosts[]
}

model CategoriesOnPosts {
  post       Post     @relation(fields: [postId], references: [id])
  postId     Int
  category   Category @relation(fields: [categoryId], references: [id])
  categoryId Int
  assignedAt DateTime @default(now())
  assignedBy String
  @@id([postId, categoryId])
}
```

Both parent models must reference the join model (not each other directly).

### MongoDB m-n

MongoDB requires explicit ID arrays on BOTH sides:

```prisma
model Post {
  id          String     @id @default(auto()) @map("_id") @db.ObjectId
  categoryIDs String[]   @db.ObjectId
  categories  Category[] @relation(fields: [categoryIDs], references: [id])
}

model Category {
  id      String   @id @default(auto()) @map("_id") @db.ObjectId
  postIDs String[] @db.ObjectId
  posts   Post[]   @relation(fields: [postIDs], references: [id])
}
```

## Self-Relations

A model referencing itself. Always require `@relation` with a name.

### 1-1 self-relation

```prisma
model User {
  id          Int   @id @default(autoincrement())
  successorId Int?  @unique
  successor   User? @relation("BlogOwnerHistory", fields: [successorId], references: [id])
  predecessor User? @relation("BlogOwnerHistory")
}
```

### 1-n self-relation

```prisma
model User {
  id        Int    @id @default(autoincrement())
  teacherId Int?
  teacher   User?  @relation("TeacherStudents", fields: [teacherId], references: [id])
  students  User[] @relation("TeacherStudents")
}
```

### m-n self-relation (implicit)

```prisma
model User {
  id         Int    @id @default(autoincrement())
  followedBy User[] @relation("UserFollows")
  following  User[] @relation("UserFollows")
}
```

### m-n self-relation (explicit)

```prisma
model User {
  id         Int       @id @default(autoincrement())
  followedBy Follows[] @relation("followedBy")
  following  Follows[] @relation("following")
}

model Follows {
  followedBy   User @relation("followedBy", fields: [followedById], references: [id])
  followedById Int
  following    User @relation("following", fields: [followingId], references: [id])
  followingId  Int
  @@id([followingId, followedById])
}
```

## Disambiguating Relations

Required when two+ relations exist between the same models. Use the `name` argument on BOTH sides.

```prisma
model User {
  id           Int    @id @default(autoincrement())
  writtenPosts Post[] @relation("WrittenPosts")
  pinnedPost   Post?  @relation("PinnedPost")
}

model Post {
  id         Int    @id @default(autoincrement())
  author     User   @relation("WrittenPosts", fields: [authorId], references: [id])
  authorId   Int
  pinnedBy   User?  @relation("PinnedPost", fields: [pinnedById], references: [id])
  pinnedById Int?   @unique
}
```

## Referential Actions

Set via `onDelete` and `onUpdate` in `@relation`. Not supported on implicit m-n.

```prisma
model Post {
  author   User @relation(fields: [authorId], references: [id], onDelete: Cascade, onUpdate: Cascade)
  authorId Int
}
```

### Action Behaviors

| Action       | On Delete                              | On Update                                |
|:-------------|:---------------------------------------|:-----------------------------------------|
| `Cascade`    | Delete all referencing records         | Update FK in referencing records         |
| `Restrict`   | Prevent deletion if references exist   | Prevent update if references exist       |
| `NoAction`   | Similar to Restrict (DB-dependent)     | Similar to Restrict (DB-dependent)       |
| `SetNull`    | Set FK to NULL (relation must be optional) | Set FK to NULL                       |
| `SetDefault` | Set FK to `@default` value             | Set FK to `@default` value               |

### Defaults

| Clause     | Optional relations | Mandatory relations |
|:-----------|:-------------------|:--------------------|
| `onDelete` | `SetNull`          | `Restrict`          |
| `onUpdate` | `Cascade`          | `Cascade`           |

### Database Support

| Database      | Cascade | Restrict | NoAction | SetNull | SetDefault |
|:--------------|:--------|:---------|:---------|:--------|:-----------|
| PostgreSQL    | Yes     | Yes      | Yes      | Yes     | Yes        |
| MySQL/MariaDB | Yes     | Yes      | Yes      | Yes     | No         |
| SQLite        | Yes     | Yes      | Yes      | Yes     | Yes        |
| SQL Server    | Yes     | No       | Yes      | Yes     | Yes        |
| CockroachDB   | Yes     | Yes      | Yes      | Yes     | Yes        |
| MongoDB       | Yes     | Yes      | Yes      | Yes     | No         |

- **SQL Server**: Use `NoAction` instead of `Restrict`.
- **MySQL**: `SetDefault` acts as `NoAction` at runtime (v8+) or fails (v5.6+).
- **PostgreSQL**: `SetNull` on a non-nullable field compiles but errors at runtime.

### Cycle / Multiple Cascade Path Rules

**SQL Server & MongoDB**: Self-relations and cyclic relations require `onDelete: NoAction, onUpdate: NoAction` on at least one relation in the cycle.

```prisma
model Employee {
  id        Int        @id @default(autoincrement())
  managerId Int?
  manager   Employee?  @relation("management", fields: [managerId], references: [id], onDelete: NoAction, onUpdate: NoAction)
  managees  Employee[] @relation("management")
}
```

**SQL Server only**: Multiple cascade paths between two models require `NoAction` on at least one path.

## Relation Mode

Set in `datasource` block. Controls whether relations are enforced by the DB or by Prisma.

```prisma
datasource db {
  provider     = "mysql"
  relationMode = "prisma"
}
```

### `foreignKeys` (default for relational DBs)

- DB creates real foreign key constraints
- DB enforces referential integrity
- DB creates implicit indexes on FK columns

### `prisma` (default for MongoDB, required for PlanetScale without native FKs)

- No foreign keys in the database
- Prisma Client emulates referential actions at query time
- **Does NOT emulate constraints on create** (can insert invalid references)
- Performance overhead due to extra queries
- `SetDefault` not supported in `prisma` mode
- `NoAction` not supported for PostgreSQL/SQLite in `prisma` mode (use `Restrict`)

**Critical: You MUST manually add `@@index` on FK fields** -- no implicit indexes are created.

```prisma
model Post {
  id     Int  @id
  userId Int
  user   User @relation(fields: [userId], references: [id])

  @@index([userId])  // Required in prisma relation mode
}
```

## Troubleshooting

### Implicit m-n self-relation field ordering

In implicit m-n self-relations, the alphabetically-first relation field maps to column `A`, the second to column `B`. Changing field order without migrating data causes incorrect query results. Prefix fields with `a_` and `b_` to maintain stable ordering.

```prisma
model User {
  id        Int    @id @default(autoincrement())
  a_eats    User[] @relation("FoodChain")  // maps to column A
  b_eatenBy User[] @relation("FoodChain")  // maps to column B
}
```

### Explicit m-n: both sides must reference the join model

Wrong -- parent models referencing each other directly:

```prisma
model Post {
  id         Int        @id @default(autoincrement())
  categories Category[]  // WRONG: should be PostCategories[]
}
```

Correct:

```prisma
model Post {
  id             Int              @id @default(autoincrement())
  postCategories PostCategories[]
}
```

### Don't add `@relation` names on implicit m-n unless disambiguating

Adding separate `@relation("Post")` and `@relation("Category")` names creates two separate 1-n relations instead of one m-n. Use the SAME name on both sides, or omit `@relation` entirely.

### Databases enforcing primary keys on all tables

Implicit m-n join tables have no primary key. Use explicit m-n with `@@id` on the join model instead.

### `SetNull` on required fields

Using `SetNull` on a non-optional relation scalar causes a runtime error. Make the field optional (`Int?`) or use a different action.
