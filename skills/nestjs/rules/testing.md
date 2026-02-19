# Testing

## Unit Tests with TestingModule

Use `Test.createTestingModule` for unit tests — don't bypass the DI container.

```typescript
// ❌ Manual instantiation — misses DI lifecycle and NestJS behaviors
describe('UsersService', () => {
  it('should find user', async () => {
    const service = new UsersService(new UserRepository()); // real DB connection in tests
    const user = await service.findById('1');
    expect(user).toBeDefined();
  });
});
```

```typescript
// ✅ TestingModule with mocked providers
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

describe('UsersService', () => {
  let service: UsersService;
  let mockRepo: jest.Mocked<Repository<User>>;

  beforeEach(async () => {
    mockRepo = {
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
      find: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: mockRepo },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('should return user when found', async () => {
    const user = { id: '1', email: 'test@example.com', name: 'Test' } as User;
    mockRepo.findOne.mockResolvedValue(user);

    const result = await service.findById('1');
    expect(result).toEqual(user);
    expect(mockRepo.findOne).toHaveBeenCalledWith({ where: { id: '1' } });
  });

  it('should throw NotFoundException when not found', async () => {
    mockRepo.findOne.mockResolvedValue(null);
    await expect(service.findById('999')).rejects.toThrow(NotFoundException);
  });
});

// Testing guards with ExecutionContext mock
describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: jest.Mocked<Reflector>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        RolesGuard,
        { provide: Reflector, useValue: { getAllAndOverride: jest.fn() } },
      ],
    }).compile();

    guard = module.get(RolesGuard);
    reflector = module.get(Reflector);
  });

  it('should allow access when no roles required', () => {
    reflector.getAllAndOverride.mockReturnValue(null);
    const context = createMockExecutionContext({ user: { roles: [] } });
    expect(guard.canActivate(context)).toBe(true);
  });
});

function createMockExecutionContext(requestData: Partial<Request>): ExecutionContext {
  return {
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: () => ({
      getRequest: () => requestData,
    }),
  } as any;
}
```

## E2E Tests with Supertest

```typescript
// ✅ E2E test setup
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';

describe('UsersController (e2e)', () => {
  let app: INestApplication;
  let authToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(getRepositoryToken(User))
      .useValue(mockUserRepository)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    // Get auth token once for all tests
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'test@example.com', password: 'password123' });
    authToken = loginRes.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /users/:id should return user', async () => {
    const res = await request(app.getHttpServer())
      .get('/users/1')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(res.body).toMatchObject({ id: '1', email: expect.any(String) });
    expect(res.body.passwordHash).toBeUndefined(); // serialization check
  });

  it('POST /users should validate DTO', async () => {
    const res = await request(app.getHttpServer())
      .post('/users')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ email: 'not-an-email', name: 'a' }) // invalid
      .expect(400);

    expect(res.body.message).toBeInstanceOf(Array);
  });
});
```

## Mocking External Services

```typescript
// ❌ Calling real HTTP services in tests — slow, flaky, non-deterministic
@Injectable()
export class UsersService {
  constructor(private httpService: HttpService) {}

  async getExternalProfile(userId: string) {
    const res = await this.httpService.get(`https://api.external.com/users/${userId}`).toPromise();
    return res.data;
  }
}

// Test that calls real API — fails without network, slow, non-deterministic
describe('UsersService', () => {
  it('should get profile', async () => {
    const result = await service.getExternalProfile('123'); // real HTTP call
    expect(result).toBeDefined();
  });
});
```

```typescript
// ✅ Mock external dependencies
describe('UsersService', () => {
  let mockHttpService: { get: jest.Mock };

  beforeEach(async () => {
    mockHttpService = { get: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: HttpService, useValue: mockHttpService },
      ],
    }).compile();

    service = module.get(UsersService);
  });

  it('should get external profile', async () => {
    mockHttpService.get.mockReturnValue(
      of({ data: { id: '123', name: 'Test User' } })
    );

    const result = await service.getExternalProfile('123');
    expect(result).toEqual({ id: '123', name: 'Test User' });
    expect(mockHttpService.get).toHaveBeenCalledWith('https://api.external.com/users/123');
  });

  it('should handle external service errors', async () => {
    mockHttpService.get.mockReturnValue(
      throwError(() => new Error('Service unavailable'))
    );
    await expect(service.getExternalProfile('123')).rejects.toThrow();
  });
});

// Mock ConfigService pattern
const mockConfigService = { get: jest.fn(), getOrThrow: jest.fn() };
mockConfigService.get.mockImplementation((key: string) => {
  const config = { JWT_SECRET: 'test-secret', DATABASE_URL: 'sqlite::memory:' };
  return config[key];
});
```

Reference: [NestJS Testing](https://docs.nestjs.com/fundamentals/testing)
