# Performance

## Caching

Cache expensive/frequently accessed data. Focus on high-impact areas — don't cache everything.

```typescript
// ❌ No caching for expensive repeated queries
@Get('popular')
async getPopular(): Promise<Product[]> {
  // runs complex aggregation on EVERY request
  return this.productsRepo.createQueryBuilder('p')
    .leftJoin('p.orders', 'o')
    .select('p.*, COUNT(o.id) as orderCount')
    .groupBy('p.id')
    .orderBy('orderCount', 'DESC')
    .limit(20)
    .getMany();
}
```

```typescript
// ✅ Setup CacheModule with Redis
@Module({
  imports: [
    CacheModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        stores: [new KeyvRedis(config.getOrThrow('REDIS_URL'))],
        ttl: 60_000, // default 60s
      }),
    }),
  ],
})
export class AppModule {}

// ✅ Manual cache-aside pattern — full control over keys and TTL
@Injectable()
export class ProductsService {
  constructor(
    @Inject(CACHE_MANAGER) private cache: Cache,
    private productsRepo: ProductsRepository,
  ) {}

  async getPopular(): Promise<Product[]> {
    const key = 'products:popular';
    const cached = await this.cache.get<Product[]>(key);
    if (cached) return cached;

    const products = await this.fetchPopularProducts();
    await this.cache.set(key, products, 5 * 60_000); // 5 min TTL
    return products;
  }

  // Invalidate on writes
  async updateProduct(id: string, dto: UpdateProductDto): Promise<Product> {
    const product = await this.productsRepo.save({ id, ...dto });
    await this.cache.del('products:popular');
    await this.cache.del(`product:${id}`);
    return product;
  }
}

// ✅ Decorator-based caching for read-heavy GET endpoints
@Controller('categories')
@UseInterceptors(CacheInterceptor)
export class CategoriesController {
  @Get()
  @CacheTTL(30 * 60_000) // 30 min — categories rarely change
  findAll(): Promise<Category[]> { return this.categoriesService.findAll(); }
}

// ✅ Event-based cache invalidation
@Injectable()
export class CacheInvalidationService {
  constructor(@Inject(CACHE_MANAGER) private cache: Cache) {}

  @OnEvent('product.updated')
  @OnEvent('product.deleted')
  async invalidate(event: ProductEvent) {
    await Promise.all([
      this.cache.del('products:popular'),
      this.cache.del(`product:${event.productId}`),
    ]);
  }
}
```

## Lazy Loading Modules

Use `LazyModuleLoader` for rarely-used functionality to improve startup time.

```typescript
// ❌ Always loading heavy modules at startup — even if unused on this invocation
@Module({
  imports: [
    ReportsModule,     // heavy, only needed for /reports endpoints
    DataExportModule,  // heavy, only needed for export jobs
    AdminModule,       // heavy, rarely accessed
  ],
})
export class AppModule {}
```

```typescript
// ✅ Lazy load on first use
@Injectable()
export class AppService {
  constructor(private lazyModuleLoader: LazyModuleLoader) {}

  async generateReport(type: string): Promise<Buffer> {
    const { ReportsModule } = await import('./reports/reports.module');
    const moduleRef = await this.lazyModuleLoader.load(() => ReportsModule);
    const reportsService = moduleRef.get(ReportsService);
    return reportsService.generate(type);
  }
}

// Cache the loaded module reference — don't reload every call
@Injectable()
export class LazyLoader {
  private moduleRefs = new Map<string, ModuleRef>();

  constructor(private lazyModuleLoader: LazyModuleLoader) {}

  async getService<T>(moduleFactory: () => Promise<any>, serviceToken: any): Promise<T> {
    const key = serviceToken.name;
    if (!this.moduleRefs.has(key)) {
      const moduleRef = await this.lazyModuleLoader.load(moduleFactory);
      this.moduleRefs.set(key, moduleRef);
    }
    return this.moduleRefs.get(key)!.get(serviceToken);
  }
}
```

## Async Lifecycle Hooks

Use lifecycle hooks for initialization — never block the constructor.

```typescript
// ❌ Blocking constructor — delays all DI and startup
@Injectable()
export class DatabaseService {
  private connection: Connection;

  constructor() {
    // Synchronous blocking in constructor
    this.connection = createConnection(); // blocks event loop
  }
}

// ❌ Fire-and-forget in lifecycle hook — errors are swallowed
@Injectable()
export class CacheService implements OnModuleInit {
  onModuleInit() {
    this.warmCache(); // not awaited — errors lost, warm-up may not finish before requests
  }
}
```

```typescript
// ✅ Return promise from lifecycle hooks — NestJS awaits them
@Injectable()
export class CacheService implements OnModuleInit, OnModuleDestroy {
  async onModuleInit(): Promise<void> {
    await this.warmCache(); // awaited — cache is ready before first request
    this.logger.log('Cache warmed up');
  }

  async onModuleDestroy(): Promise<void> {
    await this.cache.close(); // cleanup before shutdown
  }
}

// ✅ onApplicationBootstrap for post-DI initialization (cross-module deps ready)
@Injectable()
export class StartupService implements OnApplicationBootstrap {
  async onApplicationBootstrap(): Promise<void> {
    // All modules initialized — safe to call other services
    await this.schedulerService.rescheduleFailedJobs();
    await this.healthCheckService.runInitialCheck();
  }
}

// ✅ Proper provider scope for connection-pool style providers
@Injectable()
export class DatabaseConnectionService implements OnModuleInit {
  private pool: Pool;

  async onModuleInit(): Promise<void> {
    this.pool = await createPool({
      max: 10,
      min: 2,
      connectionString: this.config.getOrThrow('DATABASE_URL'),
    });
  }
}
```

Reference: [NestJS Caching](https://docs.nestjs.com/techniques/caching) | [Lazy Loading](https://docs.nestjs.com/fundamentals/lazy-loading-modules) | [Lifecycle Events](https://docs.nestjs.com/fundamentals/lifecycle-events)
