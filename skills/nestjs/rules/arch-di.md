# Dependency Injection

## Constructor Injection

Always use constructor injection. It makes dependencies explicit, enables TypeScript type checking, and improves testability.

```typescript
// ❌ Property injection — hidden dependencies, harder to test
@Injectable()
export class UsersService {
  @Inject()
  private userRepo: UserRepository; // not visible in constructor

  @Inject('CONFIG')
  private config: ConfigType;
}
```

```typescript
// ✅ Constructor injection — explicit and testable
@Injectable()
export class UsersService {
  constructor(
    private readonly userRepo: UserRepository,
    @Inject('CONFIG') private readonly config: ConfigType,
  ) {}
}

// Easy to instantiate in tests without the DI container
const service = new UsersService(mockRepo, { dbUrl: 'test' });
```

Only use `@Optional()` + property injection for truly optional enhancements:

```typescript
@Injectable()
export class LoggingService {
  @Optional()
  @Inject('ANALYTICS')
  private analytics?: AnalyticsService;
}
```

## Injection Tokens for Interfaces

TypeScript interfaces are erased at compile time and cannot be used as injection tokens. Use symbols, strings, or abstract classes.

```typescript
// ❌ Interface as injection token — fails at runtime
interface PaymentGateway { charge(amount: number): Promise<PaymentResult>; }

@Injectable()
export class OrdersService {
  constructor(private payment: PaymentGateway) {} // won't work
}
```

```typescript
// ✅ Symbol token
export const PAYMENT_GATEWAY = Symbol('PAYMENT_GATEWAY');

export interface PaymentGateway {
  charge(amount: number): Promise<PaymentResult>;
}

@Module({
  providers: [{
    provide: PAYMENT_GATEWAY,
    useClass: process.env.NODE_ENV === 'test' ? MockPaymentService : StripeService,
  }],
  exports: [PAYMENT_GATEWAY],
})
export class PaymentModule {}

@Injectable()
export class OrdersService {
  constructor(@Inject(PAYMENT_GATEWAY) private payment: PaymentGateway) {}
}
```

```typescript
// ✅ Abstract class (carries runtime type info — no @Inject needed)
export abstract class PaymentGateway {
  abstract charge(amount: number): Promise<PaymentResult>;
}

@Injectable()
export class StripeService extends PaymentGateway {
  async charge(amount: number): Promise<PaymentResult> { /* ... */ }
}

@Module({
  providers: [{ provide: PaymentGateway, useClass: StripeService }],
  exports: [PaymentGateway],
})
export class PaymentModule {}

@Injectable()
export class OrdersService {
  constructor(private payment: PaymentGateway) {} // no @Inject needed
}
```

## Provider Scopes

| Scope | Behavior | Use When |
|---|---|---|
| `DEFAULT` (singleton) | One instance for the app lifetime | Stateless services (default, most common) |
| `REQUEST` | New instance per HTTP request | Per-request state, multi-tenancy |
| `TRANSIENT` | New instance per injection | Loggers with caller context |

> Warning: `REQUEST` scope bubbles up — all providers depending on a request-scoped provider also become request-scoped, impacting performance.

```typescript
// ❌ Singleton with mutable per-request state — shared across all concurrent requests
@Injectable()
export class RequestContextService {
  private userId: string; // DANGER: all requests share this!

  setUser(userId: string) { this.userId = userId; }
  getUser() { return this.userId; } // returns wrong user under load
}
```

```typescript
// ✅ Request-scoped for per-request state
@Injectable({ scope: Scope.REQUEST })
export class AuditService {
  constructor(@Inject(REQUEST) private request: Request) {}

  log(action: string) {
    console.log(`User ${this.request.user?.id} performed ${action}`);
  }
}

// ✅ Better: nestjs-cls for async context — stays singleton, no scope bubble-up
import { ClsService } from 'nestjs-cls';

@Injectable() // stays singleton
export class AuditService {
  constructor(private cls: ClsService) {}

  log(action: string) {
    const userId = this.cls.get('userId');
    console.log(`User ${userId} performed ${action}`);
  }
}
```

## Avoid Service Locator Anti-Pattern

Don't use `ModuleRef.get()` in service logic — it hides dependencies and breaks testability.

```typescript
// ❌ Service locator — dependencies are hidden
@Injectable()
export class OrdersService {
  constructor(private moduleRef: ModuleRef) {}

  async createOrder(dto: CreateOrderDto) {
    const usersService = this.moduleRef.get(UsersService); // hidden dep
    const paymentService = this.moduleRef.get(PaymentService); // hidden dep
    // ...
  }
}
```

```typescript
// ✅ Constructor injection — dependencies are explicit and testable
@Injectable()
export class OrdersService {
  constructor(
    private usersService: UsersService,
    private paymentService: PaymentService,
  ) {}

  async createOrder(dto: CreateOrderDto) {
    const user = await this.usersService.findOne(dto.userId);
    // ...
  }
}

// ✅ ModuleRef is valid for factory/strategy patterns (dynamic instantiation)
@Injectable()
export class HandlerFactory {
  constructor(private moduleRef: ModuleRef) {}

  getHandler(type: string): Handler {
    switch (type) {
      case 'email': return this.moduleRef.get(EmailHandler);
      case 'sms': return this.moduleRef.get(SmsHandler);
      default: return this.moduleRef.get(DefaultHandler);
    }
  }
}
```

Reference: [NestJS Custom Providers](https://docs.nestjs.com/fundamentals/custom-providers) | [Injection Scopes](https://docs.nestjs.com/fundamentals/injection-scopes) | [Module Reference](https://docs.nestjs.com/fundamentals/module-ref)
