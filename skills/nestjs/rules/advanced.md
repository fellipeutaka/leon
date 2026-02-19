# Advanced

## Microservices — Message & Event Patterns

Use `@MessagePattern` for request-response, `@EventPattern` for fire-and-forget.

```typescript
// ❌ Using @EventPattern for request-response — no return value possible
@EventPattern('get_user') // events don't return values
async getUser(data: { id: string }) {
  return this.usersService.findById(data.id); // return value is ignored
}

// ❌ Using @MessagePattern for fire-and-forget — unnecessary overhead
@MessagePattern('user_created') // message patterns expect a response
async handleUserCreated(event: UserCreatedEvent) {
  await this.sendWelcomeEmail(event.userId);
  // caller is waiting for a response they don't need
}
```

```typescript
// ✅ @MessagePattern for request-response (caller awaits result)
@Controller()
export class UsersController {
  @MessagePattern('get_user')
  async getUser(@Payload() data: { id: string }): Promise<User> {
    const user = await this.usersService.findById(data.id);
    if (!user) throw new RpcException({ status: 404, message: 'User not found' });
    return user;
  }

  @MessagePattern('create_user')
  createUser(@Payload() dto: CreateUserDto): Promise<User> {
    return this.usersService.create(dto);
  }
}

// ✅ @EventPattern for fire-and-forget (caller doesn't wait)
@Controller()
export class NotificationsController {
  @EventPattern('user.created')
  async handleUserCreated(@Payload() event: UserCreatedEvent): Promise<void> {
    await this.emailService.sendWelcome(event.userId);
  }

  @EventPattern('order.placed')
  async handleOrderPlaced(@Payload() event: OrderPlacedEvent): Promise<void> {
    await this.inventoryService.reserve(event.items);
  }
}

// Hybrid app — HTTP + microservice
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.REDIS,
    options: { host: 'localhost', port: 6379 },
  });

  await app.startAllMicroservices();
  await app.listen(3000);
}
```

## Background Jobs with BullMQ

Offload long-running tasks to queues — don't block HTTP handlers.

```typescript
// ❌ Long-running task in HTTP handler — times out, blocks other requests
@Post('export')
async exportData(@Body() dto: ExportDto): Promise<void> {
  await this.generateReport(dto);    // takes 30s
  await this.uploadToS3(dto);        // takes 10s
  await this.sendEmail(dto.userId);  // may fail
  // total: 40s+ — request times out
}
```

```typescript
// ✅ BullMQ — enqueue job, return immediately
import { InjectQueue } from '@nestjs/bullmq';
import { Queue, Worker } from 'bullmq';

// Setup
@Module({
  imports: [
    BullModule.forRoot({ connection: { host: 'localhost', port: 6379 } }),
    BullModule.registerQueue({ name: 'export' }),
  ],
})
export class AppModule {}

// Controller — enqueue and return job ID
@Controller('export')
export class ExportController {
  constructor(@InjectQueue('export') private exportQueue: Queue) {}

  @Post()
  async createExport(@Body() dto: ExportDto, @CurrentUser() user: User) {
    const job = await this.exportQueue.add('generate', { dto, userId: user.id }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
      removeOnComplete: 100,
      removeOnFail: 50,
    });
    return { jobId: job.id };
  }

  @Get(':jobId/status')
  async getStatus(@Param('jobId') jobId: string) {
    const job = await this.exportQueue.getJob(jobId);
    return { status: await job?.getState(), progress: job?.progress };
  }
}

// Processor — handles the job
@Processor('export')
export class ExportProcessor {
  private readonly logger = new Logger(ExportProcessor.name);

  @Process('generate')
  async handleGenerate(job: Job<{ dto: ExportDto; userId: string }>): Promise<void> {
    const { dto, userId } = job.data;

    try {
      await job.updateProgress(10);
      const report = await this.generateReport(dto);

      await job.updateProgress(60);
      const url = await this.uploadToS3(report);

      await job.updateProgress(90);
      await this.emailService.sendExportReady(userId, url);

      await job.updateProgress(100);
    } catch (error) {
      this.logger.error(`Export job ${job.id} failed`, error.stack);
      throw error; // BullMQ will retry based on attempts config
    }
  }
}
```

## Health Checks

Implement liveness + readiness probes for Kubernetes/container orchestration.

```typescript
// ❌ Simple ping — doesn't verify dependencies are healthy
@Get('health')
health() { return { status: 'ok' }; }
```

```typescript
// ✅ @nestjs/terminus with dependency checks
@Module({
  imports: [
    TerminusModule,
    TypeOrmModule,
    HttpModule,
  ],
})
export class HealthModule {}

@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private db: TypeOrmHealthIndicator,
    private http: HttpHealthIndicator,
  ) {}

  // Liveness — is the app running? (restart if fails)
  @Get('live')
  @HealthCheck()
  liveness() {
    return this.health.check([]); // just confirms app is up
  }

  // Readiness — can the app serve traffic? (remove from load balancer if fails)
  @Get('ready')
  @HealthCheck()
  readiness() {
    return this.health.check([
      () => this.db.pingCheck('database'),
      () => this.http.pingCheck('external-api', 'https://api.stripe.com'),
    ]);
  }
}

// Custom health indicator (e.g., for Redis/BullMQ)
@Injectable()
export class QueueHealthIndicator extends HealthIndicator {
  constructor(@InjectQueue('main') private queue: Queue) { super(); }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      await this.queue.getJobCounts();
      return this.getStatus(key, true);
    } catch {
      return this.getStatus(key, false, { message: 'Queue unavailable' });
    }
  }
}
```

## API Versioning

Version APIs to allow breaking changes without breaking existing clients.

```typescript
// ❌ Breaking changes without versioning — existing clients break
@Controller('users')
export class UsersController {
  @Get(':id')
  findOne(@Param('id') id: string) {
    // Changed response shape in v2 — breaks v1 clients
    return { data: { user: this.usersService.findById(id) } };
  }
}
```

```typescript
// ✅ URI versioning — /v1/users/:id and /v2/users/:id
// main.ts
app.enableVersioning({ type: VersioningType.URI });

// v1 controller
@Controller({ path: 'users', version: '1' })
export class UsersV1Controller {
  @Get(':id')
  findOne(@Param('id') id: string): Promise<User> {
    return this.usersService.findById(id);
  }
}

// v2 controller — new response shape
@Controller({ path: 'users', version: '2' })
export class UsersV2Controller {
  @Get(':id')
  async findOne(@Param('id') id: string): Promise<UserDetailResponse> {
    const user = await this.usersService.findByIdWithProfile(id);
    return { data: user, meta: { version: '2' } };
  }
}

// Per-route versioning (when controller handles multiple versions)
@Controller('users')
export class UsersController {
  @Get(':id')
  @Version('1')
  findOneV1(@Param('id') id: string) { return this.usersService.findById(id); }

  @Get(':id')
  @Version('2')
  findOneV2(@Param('id') id: string) { return this.usersService.findByIdWithProfile(id); }

  @Get()
  @Version(VERSION_NEUTRAL) // no version prefix — works for all
  findAll() { return this.usersService.findAll(); }
}

// Add deprecation headers to old versions
@Injectable()
export class DeprecationInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const version = context.switchToHttp().getRequest().path.match(/\/v(\d+)\//)?.[1];
    if (version === '1') {
      context.switchToHttp().getResponse().set(
        'Deprecation', 'true',
        'Sunset', 'Sat, 01 Jan 2026 00:00:00 GMT',
      );
    }
    return next.handle();
  }
}
```

## OpenAPI / Swagger

```typescript
// Setup — usually in main.ts
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

const config = new DocumentBuilder()
  .setTitle('My API')
  .setDescription('API description')
  .setVersion('1.0')
  .addBearerAuth()
  .build();

const document = SwaggerModule.createDocument(app, config);
SwaggerModule.setup('api', app, document);

// Decorate DTOs and controllers
export class CreateUserDto {
  @ApiProperty({ example: 'John Doe', minLength: 2 })
  name: string;

  @ApiProperty({ example: 'user@example.com' })
  email: string;

  @ApiPropertyOptional({ example: 25 })
  age?: number;
}

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  @Post()
  @ApiOperation({ summary: 'Create user' })
  @ApiCreatedResponse({ type: User })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  create(@Body() dto: CreateUserDto): Promise<User> {
    return this.usersService.create(dto);
  }
}
```

Reference: [Microservices](https://docs.nestjs.com/microservices/basics) | [Queues](https://docs.nestjs.com/techniques/queues) | [Health Checks](https://docs.nestjs.com/recipes/terminus) | [Versioning](https://docs.nestjs.com/techniques/versioning) | [OpenAPI](https://docs.nestjs.com/openapi/introduction)
