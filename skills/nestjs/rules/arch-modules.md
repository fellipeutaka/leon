# Architecture & Modules

## Feature Module Organization

Organize by feature, not by technical layer. Each feature module is self-contained with its own controllers, services, entities, and DTOs.

```typescript
// ❌ Technical layer organization — anti-pattern
src/
├── controllers/
│   ├── users.controller.ts
│   └── orders.controller.ts
├── services/
│   ├── users.service.ts
│   └── orders.service.ts
└── entities/
    ├── user.entity.ts
    └── order.entity.ts

// ✅ Feature module organization
src/
├── users/
│   ├── dto/
│   ├── entities/user.entity.ts
│   ├── users.controller.ts
│   ├── users.service.ts
│   └── users.module.ts
├── orders/
│   ├── dto/
│   ├── entities/order.entity.ts
│   ├── orders.controller.ts
│   ├── orders.service.ts
│   └── orders.module.ts
├── shared/
│   ├── guards/
│   ├── interceptors/
│   ├── filters/
│   └── shared.module.ts
└── app.module.ts
```

```typescript
// ✅ users.module.ts
@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService], // only export what others need
})
export class UsersModule {}

// ✅ app.module.ts
@Module({
  imports: [ConfigModule.forRoot(), TypeOrmModule.forRoot(), UsersModule, OrdersModule, SharedModule],
})
export class AppModule {}
```

## Avoid Circular Dependencies

Circular deps are the #1 cause of runtime crashes. Never have Module A import Module B and Module B import Module A.

```typescript
// ❌ Circular module imports
@Module({ imports: [OrdersModule], providers: [UsersService], exports: [UsersService] })
export class UsersModule {}

@Module({ imports: [UsersModule], providers: [OrdersService], exports: [OrdersService] })
export class OrdersModule {}
```

```typescript
// ✅ Option 1: Extract shared logic to a SharedModule
@Module({ providers: [SharedService], exports: [SharedService] })
export class SharedModule {}

@Module({ imports: [SharedModule], providers: [UsersService] })
export class UsersModule {}

@Module({ imports: [SharedModule], providers: [OrdersService] })
export class OrdersModule {}

// ✅ Option 2: Use events for decoupled communication (see below)
```

If `forwardRef()` is absolutely necessary as a last resort:

```typescript
@Injectable()
export class CatsService {
  constructor(@Inject(forwardRef(() => CommonService)) private commonService: CommonService) {}
}
```

> Barrel files (`index.ts`) can also cause circular deps — avoid them for module/provider classes.

## Module Sharing

Providing a service in multiple modules creates separate instances — memory waste and state inconsistency.

```typescript
// ❌ StorageService provided in multiple modules — creates separate instances
@Module({ providers: [StorageService], controllers: [AppController] })
export class AppModule {}

@Module({ providers: [StorageService], controllers: [VideosController] }) // Instance #2!
export class VideosModule {}
```

```typescript
// ✅ Provide once, export, import the module
@Module({ providers: [StorageService], exports: [StorageService] })
export class StorageModule {}

@Module({ imports: [StorageModule], controllers: [VideosController] })
export class VideosModule {}

@Module({ imports: [StorageModule], controllers: [ChannelsController] })
export class ChannelsModule {}
```

Use `@Global()` sparingly — only for truly cross-cutting concerns like config, logging, or DB connections:

```typescript
// ✅ Global module — import once in AppModule, available everywhere
@Global()
@Module({ providers: [ConfigService, LoggerService], exports: [ConfigService, LoggerService] })
export class CoreModule {}
```

Re-exporting pattern — import a module and re-export it for consumers:

```typescript
@Module({
  imports: [CommonModule, DatabaseModule],
  exports: [CommonModule, DatabaseModule], // consumers get both
})
export class CoreModule {}
```

## Event-Driven Decoupling

Use `@nestjs/event-emitter` when services would otherwise create circular dependencies or tight coupling.

```typescript
// ❌ OrdersService knows about all its consumers — tightly coupled
@Injectable()
export class OrdersService {
  constructor(
    private inventoryService: InventoryService,
    private emailService: EmailService,
    private analyticsService: AnalyticsService,
  ) {}

  async createOrder(dto: CreateOrderDto): Promise<Order> {
    const order = await this.repo.save(dto);
    await this.inventoryService.reserve(order.items);
    await this.emailService.sendConfirmation(order);
    await this.analyticsService.track('order_created', order);
    return order;
  }
}
```

```typescript
// ✅ OrdersService emits — consumers handle independently
export class OrderCreatedEvent {
  constructor(
    public readonly orderId: string,
    public readonly userId: string,
    public readonly items: OrderItem[],
    public readonly total: number,
  ) {}
}

@Injectable()
export class OrdersService {
  constructor(private eventEmitter: EventEmitter2, private repo: Repository<Order>) {}

  async createOrder(dto: CreateOrderDto): Promise<Order> {
    const order = await this.repo.save(dto);
    this.eventEmitter.emit('order.created', new OrderCreatedEvent(order.id, order.userId, order.items, order.total));
    return order;
  }
}

@Injectable()
export class InventoryListener {
  @OnEvent('order.created')
  async handleOrderCreated(event: OrderCreatedEvent): Promise<void> {
    await this.inventoryService.reserve(event.items);
  }
}

@Injectable()
export class EmailListener {
  @OnEvent('order.created')
  async handleOrderCreated(event: OrderCreatedEvent): Promise<void> {
    await this.emailService.sendConfirmation(event.orderId);
  }
}
```

Reference: [NestJS Modules](https://docs.nestjs.com/modules) | [Circular Dependency](https://docs.nestjs.com/fundamentals/circular-dependency) | [Events](https://docs.nestjs.com/techniques/events)
