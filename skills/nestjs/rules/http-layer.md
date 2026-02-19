# HTTP Layer

## Controllers

Keep controllers thin — delegate logic to services. Avoid `@Res()` unless necessary.

```typescript
// ❌ Fat controller with business logic
@Controller('users')
export class UsersController {
  @Get(':id')
  async findOne(@Param('id') id: string, @Res() res: Response) {
    const user = await this.userRepo.findOne(id);
    if (!user) return res.status(404).json({ message: 'Not found' });
    return res.json(user);
  }
}
```

```typescript
// ✅ Thin controller — let NestJS handle response, service throws exceptions
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  findAll(): Promise<User[]> {
    return this.usersService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<User> {
    return this.usersService.findById(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateUserDto): Promise<User> {
    return this.usersService.create(dto);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateUserDto): Promise<User> {
    return this.usersService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.usersService.remove(id);
  }
}
```

If `@Res()` is needed for streaming, always use `passthrough: true`:

```typescript
@Get('export')
download(@Res({ passthrough: true }) res: Response): StreamableFile {
  res.set({ 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename="export.csv"' });
  return new StreamableFile(fs.createReadStream('export.csv'));
}
```

## DTOs and Response Serialization

Never return entity objects directly. Use `@Exclude()` / `@Expose()` with `ClassSerializerInterceptor`.

```typescript
// ❌ Returning entity directly — exposes passwordHash, ssn, internalNotes
@Get(':id')
async findOne(@Param('id') id: string): Promise<User> {
  return this.usersService.findById(id);
}
```

```typescript
// ✅ Entity with @Exclude — ClassSerializerInterceptor strips excluded fields
import { Exclude, Expose, Transform } from 'class-transformer';

@Entity()
export class User {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() email: string;
  @Column() name: string;

  @Column()
  @Exclude() // never sent to client
  passwordHash: string;

  @CreateDateColumn() createdAt: Date;
}

// Register globally in main.ts (or via APP_INTERCEPTOR)
app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));

// For different response shapes use explicit response DTOs
export class UserResponseDto {
  @Expose() id: string;
  @Expose() email: string;
  @Expose() name: string;
  @Expose() @Transform(({ obj }) => obj.posts?.length ?? 0) postCount: number;

  constructor(partial: Partial<User>) { Object.assign(this, partial); }
}

@Get(':id')
async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<UserResponseDto> {
  const user = await this.usersService.findById(id);
  return plainToInstance(UserResponseDto, user, { excludeExtraneousValues: true });
}
```

## Pipes — Input Transformation

Use built-in pipes for common transformations. Create custom pipes for domain-specific needs.

```typescript
// ❌ Manual parsing in every handler
@Get(':id')
async findOne(@Param('id') id: string) {
  if (!isUUID(id)) throw new BadRequestException('Invalid UUID');
  return this.usersService.findOne(id);
}

@Get()
async findAll(@Query('page') page: string, @Query('limit') limit: string) {
  const pageNum = parseInt(page) || 1; // NaN if invalid
  const limitNum = parseInt(limit) || 10;
  return this.usersService.findAll(pageNum, limitNum);
}
```

```typescript
// ✅ Built-in pipes
@Get(':id')
findOne(@Param('id', ParseUUIDPipe) id: string): Promise<User> {
  return this.usersService.findOne(id);
}

@Get()
findAll(
  @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
  @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  @Query('status', new ParseEnumPipe(UserStatus)) status: UserStatus,
): Promise<User[]> {
  return this.usersService.findAll(page, limit, status);
}

// ✅ Custom pipe for business logic
@Injectable()
export class ParseDatePipe implements PipeTransform<string, Date> {
  transform(value: string): Date {
    const date = new Date(value);
    if (isNaN(date.getTime())) throw new BadRequestException('Invalid date format');
    return date;
  }
}

// ✅ Use DTO with transformation for complex query params
export class FindUsersQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page: number = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit: number = 10;
  @IsOptional() @IsString() @MaxLength(100) search?: string;
}

@Get()
findAll(@Query() query: FindUsersQueryDto): Promise<User[]> {
  return this.usersService.findAll(query);
}
```

## Guards — Authentication & Authorization

Guards determine whether a request should proceed. Register globally via `APP_GUARD`.

```typescript
// ❌ Manual auth checks in every handler — repetitive and error-prone
@Get('admin/users')
async getUsers(@Request() req) {
  if (!req.user) throw new UnauthorizedException();
  if (!req.user.roles.includes('admin')) throw new ForbiddenException();
  return this.adminService.getUsers();
}
```

```typescript
// ✅ Guards with declarative decorators
export const Public = () => SetMetadata('isPublic', true);
export const Roles = (...roles: Role[]) => SetMetadata('roles', roles);

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private jwtService: JwtService, private reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
      context.getHandler(), context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const token = request.headers.authorization?.split(' ')[1];
    if (!token) throw new UnauthorizedException('No token provided');

    try {
      request.user = await this.jwtService.verifyAsync(token);
      return true;
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<Role[]>('roles', [
      context.getHandler(), context.getClass(),
    ]);
    if (!roles) return true;
    const { user } = context.switchToHttp().getRequest();
    return roles.some(role => user.roles?.includes(role));
  }
}

// Register globally
@Module({
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}

// Clean controllers
@Controller('admin')
@Roles(Role.Admin)
export class AdminController {
  @Public()
  @Get('health')
  health() { return { status: 'ok' }; }

  @Get('users')
  getUsers(): Promise<User[]> { return this.adminService.getUsers(); }
}
```

## Interceptors — Cross-Cutting Concerns

Use interceptors for logging, response transformation, and timeout handling. Register via `APP_INTERCEPTOR`.

```typescript
// ✅ Logging interceptor
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const { method, url } = context.switchToHttp().getRequest();
    const now = Date.now();

    return next.handle().pipe(
      tap({
        next: () => this.logger.log(`${method} ${url} - ${Date.now() - now}ms`),
        error: (err) => this.logger.error(`${method} ${url} ${err.status ?? 500} - ${Date.now() - now}ms`),
      }),
    );
  }
}

// ✅ Response envelope interceptor
@Injectable()
export class TransformInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map(data => ({ data, timestamp: new Date().toISOString() })),
    );
  }
}

// ✅ Timeout interceptor
@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      timeout(5000),
      catchError(err => {
        if (err instanceof TimeoutError) throw new RequestTimeoutException();
        throw err;
      }),
    );
  }
}
```

## Middleware vs Guards vs Interceptors

| | Middleware | Guard | Interceptor |
|---|---|---|---|
| Runs | Before route matching | After middleware, before handler | Around handler |
| Returns | void / next() | boolean / Observable\<boolean\> | Observable |
| Use for | Body parsing, logging, CORS | Auth, authz, rate-limiting | Transform response, logging, caching |

## Custom Decorators

```typescript
// ✅ Param decorator to extract current user
export const CurrentUser = createParamDecorator(
  (data: keyof User | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;
    return data ? user?.[data] : user;
  },
);

// Usage
@Get('me')
getProfile(@CurrentUser() user: User) { return user; }

@Get('me/id')
getId(@CurrentUser('id') userId: string) { return userId; }
```

Reference: [Controllers](https://docs.nestjs.com/controllers) | [Pipes](https://docs.nestjs.com/pipes) | [Guards](https://docs.nestjs.com/guards) | [Interceptors](https://docs.nestjs.com/interceptors) | [Serialization](https://docs.nestjs.com/techniques/serialization) | [Custom Decorators](https://docs.nestjs.com/custom-decorators)
