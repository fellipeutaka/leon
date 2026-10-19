# Architecture styles

How the codebase and deployment are cut: monolith, modular monolith, microservices, and how to move between them.

## Monolith

One deployable, usually one database and one repository.

- **Strengths**: simple to build, test, and deploy. Scales vertically, and horizontally behind a load balancer.
- **Weaknesses**:
  - One hot area (payments) can only scale by scaling everything.
  - Without module boundaries, changes ripple.
  - A large team in one codebase collides constantly.

## Modular monolith (the default)

One deployable organized into modules that follow bounded contexts (catalog, orders, cart, customers, payments). Each module:

- owns its entities, rules, and tests;
- talks to other modules only through an explicit interface or in-process events;
- owns its own schema, even on a shared database connection.

Layering inside a module (application/use cases, domain, infrastructure) is a separate choice that composes with this. A well-built modular monolith is the right end state for most systems, not only a stepping stone.

## Microservices: when

Independently deployable services, each with its own database and lifecycle, communicating over the network or a broker. They exist to scale **teams** as much as systems.

They earn their place when:

- domain boundaries are stable and visible in the code (the modular monolith already shows them);
- the organization has enough developers that separate teams own separate services (dozens to hundreds, not ten);
- a module needs independent scaling, deployment cadence, or technology.

**Costs from day one:**

- Network calls in place of function calls.
- A pipeline, deployment, and versioning per service.
- Observability across services.
- A database per service.
- A broker.
- Distributed-data patterns: outbox, sagas, idempotency.
- A platform team to run all of it.

Starting a product this way spends the time that should go to validating it, and it freezes service boundaries before the domain is understood. A discovered relationship (stock is inseparable from product; promotions span products and orders) then means redrawing services, contracts, and databases.

**Monolith first**: build the modular monolith, learn the domain until boundaries are obvious, then extract services one module at a time when a named need appears.

## Domain-driven boundaries

Domain-Driven Design puts the business domain at the center: a model shared with domain experts, a **ubiquitous language**, and **bounded contexts** (areas where a model and its terms hold consistently). Bounded contexts are the candidate module and service boundaries. Event Storming discovers the domain events that later become integration events. DDD is a modeling approach, not a folder layout.

## Strangler migration

Extract a module into a service incrementally:

1. Route the module's traffic through a facade (gateway or proxy).
2. Build the new service behind it.
3. Shift traffic over, then delete the old code.

The data moves with the service: replace cross-module joins with API calls, events, or replicated read models first.

## Distributed monolith smells

The cost of microservices without the benefits:

- Core flows built from synchronous HTTP chains between services.
- Several services sharing one database.
- Every developer maintaining every service.
- One feature requiring coordinated deploys of several services.
- Scaling all services to absorb one service's spike.

The fix is boundaries (bounded contexts, events between them) or merging back into modules.
