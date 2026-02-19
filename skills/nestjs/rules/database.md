# Database

## Repository Pattern

Abstract data access in repository classes — keeps services focused on business logic and enables easy testing.

```typescript
// ❌ Complex queries mixed with business logic in services
@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private repo: Repository<User>) {}

  async getActiveUsersWithOrders(minOrders: number): Promise<User[]> {
    // Complex query tangled with service logic
    return this.repo.createQueryBuilder('user')
      .leftJoinAndSelect('user.orders', 'order')
      .where('user.isActive = :isActive', { isActive: true })
      .having('COUNT(order.id) >= :minOrders', { minOrders })
      .groupBy('user.id')
      .getMany();
  }
}
```

```typescript
// ✅ Repository class encapsulates queries
@Injectable()
export class UsersRepository {
  constructor(@InjectRepository(User) private readonly repo: Repository<User>) {}

  findById(id: string): Promise<User | null> {
    return this.repo.findOne({ where: { id } });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.repo.findOne({ where: { email } });
  }

  getActiveWithOrders(minOrders: number): Promise<User[]> {
    return this.repo.createQueryBuilder('user')
      .leftJoinAndSelect('user.orders', 'order')
      .where('user.isActive = :isActive', { isActive: true })
      .having('COUNT(order.id) >= :minOrders', { minOrders })
      .groupBy('user.id')
      .getMany();
  }

  save(user: Partial<User>): Promise<User> {
    return this.repo.save(user);
  }
}

// Service stays focused on business logic
@Injectable()
export class UsersService {
  constructor(private readonly usersRepo: UsersRepository) {}

  async findById(id: string): Promise<User> {
    const user = await this.usersRepo.findById(id);
    if (!user) throw new NotFoundException(`User #${id} not found`);
    return user;
  }
}

// Easy to mock in tests
{ provide: UsersRepository, useValue: { findById: jest.fn(), save: jest.fn() } }
```

## Avoid N+1 Queries

Never load relations lazily in loops — use eager loading or QueryBuilder joins.

```typescript
// ❌ N+1 — one query for orders, then N queries for user details
@Get('orders')
async getOrders(): Promise<Order[]> {
  const orders = await this.orderRepo.find(); // 1 query
  for (const order of orders) {
    order.user = await this.userRepo.findOne({ where: { id: order.userId } }); // N queries
  }
  return orders;
}
```

```typescript
// ✅ Use relations option — single JOIN query
const orders = await this.orderRepo.find({
  relations: { user: true, items: { product: true } },
});

// ✅ QueryBuilder for complex joins with conditions
const orders = await this.orderRepo.createQueryBuilder('order')
  .leftJoinAndSelect('order.user', 'user')
  .leftJoinAndSelect('order.items', 'item')
  .leftJoinAndSelect('item.product', 'product')
  .where('order.status = :status', { status: 'pending' })
  .andWhere('user.isActive = :active', { active: true })
  .getMany();

// ✅ Select only needed columns
const users = await this.userRepo.find({
  select: { id: true, email: true, name: true }, // don't load passwordHash, etc.
  where: { isActive: true },
});

// Enable query logging to detect N+1 in development
TypeOrmModule.forRoot({
  logging: process.env.NODE_ENV === 'development',
  // ...
})
```

## Transactions

Use transactions for multi-step operations that must succeed or fail together.

```typescript
// ❌ Multiple saves without transaction — partial writes on failure
async transferFunds(fromId: string, toId: string, amount: number) {
  const from = await this.accountRepo.findOne({ where: { id: fromId } });
  from.balance -= amount;
  await this.accountRepo.save(from); // succeeds

  const to = await this.accountRepo.findOne({ where: { id: toId } });
  to.balance += amount;
  await this.accountRepo.save(to); // crashes — funds deducted but not added
}
```

```typescript
// ✅ DataSource.transaction — automatic rollback on error
@Injectable()
export class AccountsService {
  constructor(private dataSource: DataSource) {}

  async transferFunds(fromId: string, toId: string, amount: number): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const from = await manager.findOne(Account, { where: { id: fromId } });
      if (from.balance < amount) throw new BadRequestException('Insufficient funds');

      from.balance -= amount;
      await manager.save(Account, from);

      const to = await manager.findOne(Account, { where: { id: toId } });
      to.balance += amount;
      await manager.save(Account, to);

      await manager.save(TransactionLog, { fromId, toId, amount, timestamp: new Date() });
      // if any save fails, ALL changes are rolled back automatically
    });
  }
}

// ✅ QueryRunner for complex scenarios (manual commit/rollback)
async complexOperation(): Promise<void> {
  const queryRunner = this.dataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    await queryRunner.manager.save(Entity1, data1);
    await queryRunner.manager.save(Entity2, data2);
    // custom logic between steps...
    await queryRunner.commitTransaction();
  } catch (error) {
    await queryRunner.rollbackTransaction();
    throw error;
  } finally {
    await queryRunner.release(); // always release
  }
}
```

## Migrations

Never use `synchronize: true` in production — it can drop columns and lose data.

```typescript
// ❌ Synchronize in production
TypeOrmModule.forRoot({
  synchronize: process.env.NODE_ENV !== 'production', // still dangerous in staging
})
```

```typescript
// ✅ Migrations always
TypeOrmModule.forRoot({
  synchronize: false, // always false
  migrations: ['dist/migrations/*.js'],
  migrationsRun: true, // auto-run on startup (or run manually with npm run migration:run)
})

// Generate migration from entity changes
// npm run migration:generate -- src/migrations/AddUserAvatarColumn

// Run migrations
// npm run migration:run

// Revert last migration
// npm run migration:revert

// Safe column rename — use multi-step migration
export class RenameUsernameToName implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    // Step 1: Add new column
    await queryRunner.addColumn('users', new TableColumn({ name: 'name', type: 'varchar', isNullable: true }));
    // Step 2: Copy data
    await queryRunner.query('UPDATE users SET name = username');
    // Step 3: Drop old column (in a SEPARATE migration after deploy)
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('users', 'name');
  }
}
```

Reference: [TypeORM with NestJS](https://docs.nestjs.com/techniques/database)
