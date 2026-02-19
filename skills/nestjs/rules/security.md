# Security

## Input Validation

Validate all incoming data with `class-validator` DTOs and a global `ValidationPipe`.

```typescript
// ❌ Trusting raw input without validation
@Post()
create(@Body() body: any) {
  return this.usersService.create(body); // body could contain anything
}
```

```typescript
// ✅ Validated DTO with global ValidationPipe
// main.ts
app.useGlobalPipes(new ValidationPipe({
  whitelist: true,            // strip unknown properties
  forbidNonWhitelisted: true, // throw on unknown properties
  transform: true,            // auto-transform to DTO types
  transformOptions: { enableImplicitConversion: true },
}));

// create-user.dto.ts
import { IsEmail, IsString, MinLength, MaxLength, Matches, IsInt, Min, Max, IsOptional } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class CreateUserDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  @Transform(({ value }) => value?.trim())
  name: string;

  @IsEmail()
  @Transform(({ value }) => value?.toLowerCase().trim())
  email: string;

  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: 'Password must contain uppercase, lowercase, and number',
  })
  password: string;

  @IsInt() @Min(0) @Max(150)
  age: number;
}

// Query params — always use typed DTOs, not plain query strings
export class FindUsersQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit: number = 20;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) offset: number = 0;
  @IsOptional() @IsString() @MaxLength(100) search?: string;
}

// Route params
export class UserIdParamDto {
  @IsUUID('4') id: string;
}
```

## JWT Authentication

```typescript
// ❌ Insecure JWT setup
JwtModule.register({ secret: 'secret', signOptions: { expiresIn: '1y' } })

// ❌ Storing sensitive data in JWT payload
const payload = { userId, email, password, ssn, creditCard }; // never do this
```

```typescript
// ✅ Secure JWT with ConfigModule
JwtModule.registerAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    secret: config.getOrThrow('JWT_SECRET'),
    signOptions: { expiresIn: '15m', issuer: 'my-app' }, // short-lived access tokens
  }),
})

// JWT payload — only non-sensitive identifiers
const payload = { sub: user.id, email: user.email, roles: user.roles };

// JWT Strategy — validate user still exists and account is active
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private config: ConfigService, private usersService: UsersService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.getOrThrow('JWT_SECRET'),
      issuer: 'my-app',
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.usersService.findById(payload.sub);
    if (!user || !user.isActive) throw new UnauthorizedException();
    return user; // attached to request.user
  }
}

// Refresh token pattern — store hashed refresh token in DB
async refreshTokens(userId: string, refreshToken: string) {
  const user = await this.usersService.findById(userId);
  const isValid = await bcrypt.compare(refreshToken, user.hashedRefreshToken);
  if (!isValid) throw new UnauthorizedException('Invalid refresh token');
  return this.generateTokens(user);
}
```

## Output Sanitization

Never expose sensitive entity fields to clients.

```typescript
// ❌ Returning entity with sensitive fields
@Get(':id')
findOne(@Param('id') id: string): Promise<User> {
  return this.usersService.findById(id); // exposes passwordHash, ssn, etc.
}
```

```typescript
// ✅ Use @Exclude() + ClassSerializerInterceptor (see http-layer.md)
@Entity()
export class User {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() email: string;
  @Column() name: string;

  @Column() @Exclude() passwordHash: string;
  @Column({ nullable: true }) @Exclude() ssn: string;
  @Column({ default: false }) @Exclude() isAdmin: boolean;
}

// ✅ Sanitize error messages — never leak internal details to clients
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const status = exception instanceof HttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    // Don't expose internal error details in production
    const message = status >= 500 && process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : exception instanceof HttpException ? exception.message : 'Internal server error';

    // log internally (with stack), respond sanitized
    this.logger.error(exception instanceof Error ? exception.stack : String(exception));
    response.status(status).json({ statusCode: status, message });
  }
}
```

## Rate Limiting

Protect all endpoints from brute-force and abuse.

```typescript
// ❌ No rate limiting on auth endpoints
@Post('login')
login(@Body() dto: LoginDto) { return this.authService.login(dto); }
```

```typescript
// ✅ @nestjs/throttler — configure globally, override per-route
// app.module.ts
@Module({
  imports: [
    ThrottlerModule.forRoot([
      { name: 'short', ttl: 1000, limit: 10 },    // 10 req/sec
      { name: 'medium', ttl: 10000, limit: 50 },  // 50 req/10s
      { name: 'long', ttl: 60000, limit: 200 },   // 200 req/min
    ]),
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}

// Strict limits on sensitive endpoints
@Controller('auth')
export class AuthController {
  @Post('login')
  @Throttle({ short: { limit: 5, ttl: 60000 } }) // 5 attempts/min
  login(@Body() dto: LoginDto) { return this.authService.login(dto); }

  @Post('forgot-password')
  @Throttle({ short: { limit: 3, ttl: 3600000 } }) // 3 attempts/hour
  forgotPassword(@Body() dto: ForgotPasswordDto) { return this.authService.forgotPassword(dto); }

  @Get('health')
  @SkipThrottle() // no rate limit for health checks
  health() { return { status: 'ok' }; }
}
```

## Helmet, CORS & CSRF

### Helmet

Register Helmet **before** all routes and other middleware.

```typescript
// ❌ Helmet registered after routes — headers not applied to early routes
app.use(router);
app.use(helmet()); // too late
```

```typescript
// ✅ Express — first middleware
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(helmet()); // must be first
  await app.listen(3000);
}

// ✅ Fastify
import helmet from '@fastify/helmet';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());
  await app.register(helmet);
  await app.listen(3000);
}

// If using Apollo Sandbox/GraphiQL, Helmet's CSP blocks it — configure directives:
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", 'cdn.jsdelivr.net'],
      imgSrc: ["'self'", 'data:', 'cdn.jsdelivr.net'],
    },
  },
}));
```

### CORS

```typescript
// ✅ Enable CORS with options
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') ?? false,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    credentials: true,
  });

  await app.listen(3000);
}

// Or pass in create options (applies before all middleware):
const app = await NestFactory.create(AppModule, { cors: true });
```

### CSRF Protection

```typescript
// npm i csrf-csrf (Express) | @fastify/csrf-protection (Fastify)

// ✅ Express — requires cookie-parser and session before doubleCsrf
import * as cookieParser from 'cookie-parser';
import { doubleCsrf } from 'csrf-csrf';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(cookieParser(process.env.COOKIE_SECRET)); // must come first
  const { doubleCsrfProtection } = doubleCsrf({ getSecret: () => process.env.CSRF_SECRET });
  app.use(doubleCsrfProtection);
  await app.listen(3000);
}

// ✅ Fastify
import fastifyCsrfProtection from '@fastify/csrf-protection';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());
  await app.register(fastifyCsrfProtection);
  await app.listen(3000);
}
```

Reference: [Authentication](https://docs.nestjs.com/security/authentication) | [Authorization](https://docs.nestjs.com/security/authorization) | [Rate Limiting](https://docs.nestjs.com/security/rate-limiting) | [Validation](https://docs.nestjs.com/techniques/validation) | [Helmet](https://docs.nestjs.com/security/helmet) | [CORS](https://docs.nestjs.com/security/cors) | [CSRF](https://docs.nestjs.com/security/csrf)
