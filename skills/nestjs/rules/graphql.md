# GraphQL

## Setup (Code-First)

Use `@nestjs/graphql` with `ApolloDriver`. Code-first is recommended — types derived from TypeScript decorators.

```bash
npm i @nestjs/graphql @nestjs/apollo @apollo/server @as-integrations/express5 graphql
```

```typescript
// ❌ Missing driver, using deprecated playground, hardcoded schema path
GraphQLModule.forRoot({
  autoSchemaFile: 'schema.gql',
  playground: true, // deprecated as of April 2025
})
```

```typescript
// ✅ Apollo driver, autoSchemaFile in memory, graphiql replaces playground
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';

@Module({
  imports: [
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: true,   // generates schema in memory
      graphiql: true,         // replaces deprecated playground
      sortSchema: true,
    }),
  ],
})
export class AppModule {}

// ✅ forRootAsync when config is needed
GraphQLModule.forRootAsync<ApolloDriverConfig>({
  driver: ApolloDriver,
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    autoSchemaFile: true,
    graphiql: config.get('NODE_ENV') !== 'production',
    context: ({ req }: { req: Request }) => ({ req }),
  }),
})
```

## Object Types & Resolvers

```typescript
// ❌ Missing @Field types — schema generation fails for non-string fields
@ObjectType()
export class Author {
  @Field()
  id: number;  // inferred as String, not Int
}

@Resolver()
export class AuthorResolver {
  @Query()
  author() { ... }  // missing return type — GQL schema can't be built
}
```

```typescript
// ✅ Explicit @Field types for non-string scalars, typed @Query
import { ObjectType, Field, Int, ID, Resolver, Query, ResolveField, Parent, Args } from '@nestjs/graphql';

@ObjectType()
export class Author {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field(() => String, { nullable: true })
  bio?: string;

  @Field(() => [Post])
  posts: Post[];
}

@ObjectType()
export class Post {
  @Field(() => ID)
  id: string;

  @Field()
  title: string;

  @Field(() => Int, { defaultValue: 0 })
  votes: number;
}

// Resolver tied to Author type
@Resolver(() => Author)
export class AuthorResolver {
  constructor(
    private authorsService: AuthorsService,
    private postsService: PostsService,
  ) {}

  @Query(() => Author, { nullable: true })
  author(@Args('id', { type: () => ID }) id: string): Promise<Author | null> {
    return this.authorsService.findById(id);
  }

  @Query(() => [Author])
  authors(): Promise<Author[]> {
    return this.authorsService.findAll();
  }

  // Resolved field — only fetched when client requests it
  @ResolveField('posts', () => [Post])
  getPosts(@Parent() author: Author): Promise<Post[]> {
    return this.postsService.findByAuthorId(author.id);
  }
}
```

## Args — Dedicated ArgsType

```typescript
// ❌ Inline args for complex parameters — no validation possible
@Query(() => [Author])
authors(
  @Args('firstName') firstName: string,
  @Args('lastName') lastName: string,
  @Args('limit', { type: () => Int }) limit: number,
) { ... }
```

```typescript
// ✅ @ArgsType class — supports class-validator decorators
@ArgsType()
export class GetAuthorsArgs {
  @Field(() => String, { nullable: true })
  @IsOptional()
  @MinLength(1)
  firstName?: string;

  @Field(() => Int, { defaultValue: 25 })
  @Max(100)
  @Min(1)
  limit: number = 25;

  @Field(() => Int, { defaultValue: 0 })
  @Min(0)
  offset: number = 0;
}

@Query(() => [Author])
authors(@Args() args: GetAuthorsArgs): Promise<Author[]> {
  return this.authorsService.findAll(args);
}
```

## Mutations & InputTypes

```typescript
// ❌ Passing plain object — no type safety, no validation
@Mutation()
createAuthor(@Args('name') name: string, @Args('bio') bio: string) { ... }
```

```typescript
// ✅ @InputType for mutation arguments — validates input
@InputType()
export class CreateAuthorInput {
  @Field()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @Field(() => String, { nullable: true })
  @MaxLength(500)
  bio?: string;
}

@InputType()
export class UpdatePostInput {
  @Field(() => ID)
  id: string;

  @Field({ nullable: true })
  title?: string;
}

@Resolver(() => Author)
export class AuthorResolver {
  @Mutation(() => Author)
  createAuthor(@Args('input') input: CreateAuthorInput): Promise<Author> {
    return this.authorsService.create(input);
  }

  @Mutation(() => Boolean)
  deleteAuthor(@Args('id', { type: () => ID }) id: string): Promise<boolean> {
    return this.authorsService.delete(id);
  }
}
```

## Subscriptions

Use `graphql-ws` — `subscriptions-transport-ws` and `installSubscriptionHandlers` are deprecated.

```typescript
// ❌ Deprecated subscription transport
GraphQLModule.forRoot({
  installSubscriptionHandlers: true, // deprecated
})

// ❌ PubSub instantiated inline — not injectable, not testable
const pubSub = new PubSub();

@Subscription()
commentAdded() {
  return pubSub.asyncIterableIterator('commentAdded');
}
```

```typescript
// ✅ graphql-ws transport + PubSub as injectable provider
// Installation
// npm i graphql-ws ws @graphql-tools/schema

GraphQLModule.forRoot<ApolloDriverConfig>({
  driver: ApolloDriver,
  autoSchemaFile: true,
  subscriptions: {
    'graphql-ws': true,  // enables WebSocket subscriptions via graphql-ws
  },
})

// ✅ PubSub registered as a provider
export const PUB_SUB = 'PUB_SUB';

@Module({
  providers: [
    { provide: PUB_SUB, useValue: new PubSub() },
    CommentsResolver,
    CommentsService,
  ],
})
export class CommentsModule {}

// ✅ @Subscription with filter and injectable PubSub
@ObjectType()
export class Comment {
  @Field(() => ID)
  id: string;

  @Field()
  content: string;

  @Field(() => ID)
  postId: string;
}

@Resolver(() => Comment)
export class CommentsResolver {
  constructor(
    private commentsService: CommentsService,
    @Inject(PUB_SUB) private pubSub: PubSub,
  ) {}

  @Mutation(() => Comment)
  async addComment(@Args('postId', { type: () => ID }) postId: string,
                   @Args('content') content: string): Promise<Comment> {
    const comment = await this.commentsService.create({ postId, content });
    // Payload key must match subscription field name
    await this.pubSub.publish('commentAdded', { commentAdded: comment });
    return comment;
  }

  @Subscription(() => Comment, {
    filter: (payload, variables) =>
      payload.commentAdded.postId === variables.postId,
  })
  commentAdded(@Args('postId', { type: () => ID }) postId: string) {
    return this.pubSub.asyncIterableIterator('commentAdded');
  }
}
```

## Guards & Context in GraphQL

```typescript
// ❌ HTTP-only guard — context.switchToHttp() returns null in GraphQL
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}

// ❌ @CurrentUser based on HTTP request — won't work for GraphQL
@Get('me')
getMe(@CurrentUser() user: User) { ... }
```

```typescript
// ✅ Override getRequest for GraphQL context
@Injectable()
export class GqlAuthGuard extends AuthGuard('jwt') {
  getRequest(context: ExecutionContext) {
    const ctx = GqlExecutionContext.create(context);
    return ctx.getContext().req;  // GraphQL context carries the HTTP request
  }
}

// ✅ @CurrentUser param decorator for GraphQL resolvers
export const CurrentUser = createParamDecorator(
  (data: unknown, context: ExecutionContext) => {
    const ctx = GqlExecutionContext.create(context);
    return ctx.getContext().req.user;
  },
);

@Resolver(() => Author)
export class AuthorResolver {
  @Query(() => Author)
  @UseGuards(GqlAuthGuard)
  me(@CurrentUser() user: User): Promise<Author> {
    return this.authorsService.findById(user.id);
  }
}
```

## Module Registration

```typescript
// ✅ Resolvers are providers in their feature module
@Module({
  imports: [TypeOrmModule.forFeature([Author, Post])],
  providers: [AuthorResolver, PostsResolver, AuthorsService, PostsService],
})
export class AuthorsModule {}
```

Reference: [GraphQL Quick Start](https://docs.nestjs.com/graphql/quick-start) | [Resolvers](https://docs.nestjs.com/graphql/resolvers-map) | [Mutations](https://docs.nestjs.com/graphql/mutations) | [Subscriptions](https://docs.nestjs.com/graphql/subscriptions)
