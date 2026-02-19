# Config & Lifecycle

## Configuration with ConfigModule

Never access `process.env` directly. Use `@nestjs/config` with validation.

```typescript
// ❌ Direct process.env access — no validation, no type safety, scattered across codebase
@Injectable()
export class DatabaseService {
  private url = process.env.DATABASE_URL; // undefined if not set — no error at startup
  private port = parseInt(process.env.PORT); // NaN if not set
}
```

```typescript
// ✅ ConfigModule with Joi validation — fails fast at startup if required vars are missing
import * as Joi from 'joi';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // available everywhere without importing
      validationSchema: Joi.object({
        NODE_ENV: Joi.string().valid('development', 'production', 'test').required(),
        PORT: Joi.number().default(3000),
        DATABASE_URL: Joi.string().required(),
        JWT_SECRET: Joi.string().min(32).required(),
        REDIS_URL: Joi.string().uri().required(),
      }),
      validationOptions: { abortEarly: false }, // report all missing vars at once
    }),
  ],
})
export class AppModule {}

// ✅ Namespaced config with registerAs — organized and type-safe
export const databaseConfig = registerAs('database', () => ({
  url: process.env.DATABASE_URL,
  maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS ?? '10'),
  logging: process.env.NODE_ENV === 'development',
}));

@Module({
  imports: [ConfigModule.forFeature(databaseConfig)],
})
export class DatabaseModule {}

@Injectable()
export class DatabaseService {
  constructor(@Inject(databaseConfig.KEY) private config: ConfigType<typeof databaseConfig>) {}

  connect() {
    return createConnection({ url: this.config.url, max: this.config.maxConnections });
  }
}

// ✅ ConfigService.getOrThrow — throws if undefined (preferred over .get())
@Injectable()
export class AppService {
  constructor(private config: ConfigService) {}

  getDatabaseUrl(): string {
    return this.config.getOrThrow<string>('DATABASE_URL'); // throws TypeError if missing
  }

  getPort(): number {
    return this.config.get<number>('PORT', { infer: true }) ?? 3000;
  }
}
```

## Structured Logging

Use NestJS `Logger` over `console.log`. Add request context to all log entries.

```typescript
// ❌ console.log everywhere — no context, no log levels, no structured output
console.log('User created', user.id);
console.log('Error:', error.message);
```

```typescript
// ✅ NestJS Logger with context
@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  async createUser(dto: CreateUserDto): Promise<User> {
    this.logger.log(`Creating user with email ${dto.email}`);

    try {
      const user = await this.repo.save(dto);
      this.logger.log(`User created: ${user.id}`);
      return user;
    } catch (error) {
      this.logger.error('Failed to create user', error.stack);
      throw error;
    }
  }
}

// ✅ Request context logging with nestjs-cls
@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  constructor(private cls: ClsService) {}

  use(req: Request, res: Response, next: NextFunction) {
    this.cls.set('requestId', req.headers['x-request-id'] ?? randomUUID());
    this.cls.set('userId', req.user?.id);
    next();
  }
}

@Injectable()
export class AppLogger extends Logger {
  constructor(private cls: ClsService) { super(); }

  log(message: string, context?: string) {
    const requestId = this.cls.get('requestId');
    super.log(`[${requestId}] ${message}`, context);
  }
}

// ✅ JSON logging for production (use Pino)
// npm i nestjs-pino pino-http pino-pretty
@Module({
  imports: [
    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        pinoHttp: {
          level: config.get('NODE_ENV') === 'production' ? 'info' : 'debug',
          redact: ['req.headers.authorization', 'req.body.password'], // hide sensitive fields
          transport: config.get('NODE_ENV') !== 'production'
            ? { target: 'pino-pretty' }
            : undefined,
        },
      }),
    }),
  ],
})
export class AppModule {}
```

## Graceful Shutdown

Handle SIGTERM for zero-downtime deployments — stop accepting new requests, finish in-flight ones.

```typescript
// ❌ No shutdown handling — requests cut off mid-flight on deploy
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(3000);
  // process.kill(pid, 'SIGTERM') → immediate crash
}
```

```typescript
// ✅ Graceful shutdown with lifecycle hooks
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableShutdownHooks(); // enables OnApplicationShutdown lifecycle events

  // Optional: custom signal handling before NestJS shutdown
  process.on('SIGTERM', async () => {
    logger.log('SIGTERM received — starting graceful shutdown');
    await app.close(); // triggers OnApplicationShutdown, closes HTTP server
    process.exit(0);
  });

  await app.listen(3000);
}

// ✅ Service cleanup on shutdown
@Injectable()
export class DatabaseService implements OnApplicationShutdown {
  async onApplicationShutdown(signal: string): Promise<void> {
    this.logger.log(`Closing database connections (signal: ${signal})`);
    await this.dataSource.destroy();
  }
}

@Injectable()
export class QueueService implements OnApplicationShutdown {
  async onApplicationShutdown(): Promise<void> {
    // Wait for in-flight jobs to complete before shutdown
    await this.queue.close();
  }
}

// ✅ Track in-flight requests — wait for them before shutdown
@Injectable()
export class RequestTrackerService implements OnApplicationShutdown {
  private activeRequests = 0;

  increment() { this.activeRequests++; }
  decrement() { this.activeRequests--; }

  async onApplicationShutdown(): Promise<void> {
    // Wait up to 30s for in-flight requests
    const deadline = Date.now() + 30_000;
    while (this.activeRequests > 0 && Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    if (this.activeRequests > 0) {
      this.logger.warn(`Shutdown with ${this.activeRequests} requests still active`);
    }
  }
}
```

Reference: [NestJS Configuration](https://docs.nestjs.com/techniques/configuration) | [Logger](https://docs.nestjs.com/techniques/logger) | [Lifecycle Events](https://docs.nestjs.com/fundamentals/lifecycle-events)
