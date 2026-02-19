# Error Handling

## Exception Filters

Never catch exceptions in controllers and return manual JSON responses. Use exception filters.

```typescript
// ❌ Manual error handling in controllers
@Get(':id')
async findOne(@Param('id') id: string, @Res() res: Response) {
  try {
    const user = await this.usersService.findById(id);
    if (!user) return res.status(404).json({ statusCode: 404, message: 'Not found' });
    return res.json(user);
  } catch (error) {
    return res.status(500).json({ statusCode: 500, message: 'Internal server error' });
  }
}
```

```typescript
// ✅ Throw exceptions — let filters handle them
@Get(':id')
findOne(@Param('id') id: string): Promise<User> {
  return this.usersService.findById(id); // service throws NotFoundException if not found
}

// Global exception filter — catches everything not handled by more specific filters
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('HTTP');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status = exception instanceof HttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const message = exception instanceof HttpException
      ? exception.message
      : 'Internal server error';

    this.logger.error(
      `${request.method} ${request.url}`,
      exception instanceof Error ? exception.stack : String(exception),
    );

    response.status(status).json({
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}

// Domain-specific filter
@Catch(DomainException)
export class DomainExceptionFilter implements ExceptionFilter {
  catch(exception: DomainException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    response.status(exception.statusCode).json({
      statusCode: exception.statusCode,
      code: exception.code,
      message: exception.message,
      timestamp: new Date().toISOString(),
    });
  }
}

// Register globally via module (supports DI) — preferred over useGlobalFilters in main.ts
@Module({
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_FILTER, useClass: DomainExceptionFilter },
  ],
})
export class AppModule {}
```

## HTTP Exceptions from Services

Throw `HttpException` subclasses from services — keeps controllers thin and errors consistent.

```typescript
// ❌ Return error objects — controllers must check every return value
@Injectable()
export class UsersService {
  async findById(id: string): Promise<{ user?: User; error?: string }> {
    const user = await this.repo.findOne({ where: { id } });
    if (!user) return { error: 'User not found' };
    return { user };
  }
}

@Get(':id')
async findOne(@Param('id') id: string) {
  const result = await this.usersService.findById(id);
  if (result.error) throw new NotFoundException(result.error); // duplicate check
  return result.user;
}
```

```typescript
// ✅ Throw directly from service — controller stays clean
@Injectable()
export class UsersService {
  async findById(id: string): Promise<User> {
    const user = await this.repo.findOne({ where: { id } });
    if (!user) throw new NotFoundException(`User #${id} not found`);
    return user;
  }

  async create(dto: CreateUserDto): Promise<User> {
    const existing = await this.repo.findOne({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email already registered');
    return this.repo.save(this.repo.create(dto));
  }

  async update(id: string, dto: UpdateUserDto): Promise<User> {
    const user = await this.findById(id); // throws NotFoundException if missing
    Object.assign(user, dto);
    return this.repo.save(user);
  }
}

// Controller stays thin
@Get(':id')
findOne(@Param('id', ParseUUIDPipe) id: string): Promise<User> {
  return this.usersService.findById(id);
}
```

Common exception classes: `BadRequestException (400)`, `UnauthorizedException (401)`, `ForbiddenException (403)`, `NotFoundException (404)`, `ConflictException (409)`, `UnprocessableEntityException (422)`, `InternalServerErrorException (500)`.

Custom domain exception:

```typescript
export class UserNotFoundException extends NotFoundException {
  constructor(userId: string) {
    super({ statusCode: 404, error: 'Not Found', message: `User "${userId}" not found`, code: 'USER_NOT_FOUND' });
  }
}
```

## Async Error Handling

NestJS automatically catches errors in async route handlers, but background tasks need explicit handling.

```typescript
// ❌ Fire-and-forget without error handling — unhandled rejections crash the process
async createUser(dto: CreateUserDto): Promise<User> {
  const user = await this.repo.save(dto);
  this.emailService.sendWelcome(user.email); // no .catch — if this rejects, crash
  return user;
}

// ❌ Event handler returning a promise without await
@OnEvent('order.created')
handleOrderCreated(event: OrderCreatedEvent) {
  this.processOrder(event); // unawaited — errors are unhandled
}
```

```typescript
// ✅ Explicit .catch for fire-and-forget tasks
async createUser(dto: CreateUserDto): Promise<User> {
  const user = await this.repo.save(dto);
  this.emailService.sendWelcome(user.email).catch(err => {
    this.logger.error('Failed to send welcome email', err.stack);
    // optionally enqueue for retry
  });
  return user;
}

// ✅ Async event handlers with try/catch
@OnEvent('order.created')
async handleOrderCreated(event: OrderCreatedEvent): Promise<void> {
  try {
    await this.processOrder(event);
  } catch (error) {
    this.logger.error('Failed to process order', { event, error });
    await this.deadLetterQueue.add('order.created', event);
  }
}

// ✅ Scheduled tasks with try/catch
@Cron('0 0 * * *')
async dailyCleanup(): Promise<void> {
  try {
    await this.cleanupService.run();
    this.logger.log('Daily cleanup completed');
  } catch (error) {
    this.logger.error('Daily cleanup failed', error.stack);
  }
}

// ✅ Global safety net in main.ts
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', { promise, reason });
});
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', error);
  process.exit(1);
});
```

Reference: [NestJS Exception Filters](https://docs.nestjs.com/exception-filters)
