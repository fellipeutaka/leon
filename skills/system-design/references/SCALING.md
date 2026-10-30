# Scaling

Compute and traffic: how the stateless tier grows, how traffic is spread, and how slow work leaves the request.

## Vertical before horizontal

- **Vertical** (bigger machine): no code change, cheapest first move. Limits: a hardware ceiling, cost that grows faster than capacity, and the machine stays a single point of failure.
- **Horizontal** (N replicas behind a load balancer): removes the server as a single point of failure and lets each replica be small. Requires a **stateless** tier:
  - sessions in a shared store (Redis) or in signed tokens, not in process memory;
  - uploads in object storage, not on local disk;
  - no in-process caches whose divergence would be visible to users.
- Move the database to its own server before replicating the app: the two compete for CPU and RAM, and each tier then scales to its own demand.
- Only the load balancer is public; app servers sit on a private network the balancer can reach.

## Load balancers

### Layer

| Layer | Sees                                         | Use for                                                                                  |
| ----- | -------------------------------------------- | ---------------------------------------------------------------------------------------- |
| L4    | Connection 5-tuple (IPs, ports, protocol)    | Raw throughput, non-HTTP protocols (game UDP, custom TCP), TLS passthrough                 |
| L7    | Full HTTP: host, path, headers, cookies      | Web apps and APIs (the default): path routing, TLS termination, auth, rate limiting       |

L4 balances per connection: a browser reusing one keep-alive connection stays on one backend, which is correct behaviour, not a failure. L7 balancers proxy WebSockets and SSE fine.

Products: software NGINX, HAProxy, Envoy, Traefik; cloud AWS ALB (L7) and NLB (L4), Azure Application Gateway (L7) and Load Balancer (L4), Google Cloud Load Balancing (both); hardware F5 BIG-IP and similar for on-prem.

### Algorithm

| Algorithm               | Fits                                                                                      |
| ----------------------- | ----------------------------------------------------------------------------------------- |
| Round robin             | Identical servers, uniform request cost. The default; rarely the right final answer.      |
| Weighted round robin    | Heterogeneous servers (one large original box plus smaller replicas).                     |
| Least connections       | Variable request cost (fast reads mixed with slow reports), long-lived connections.       |
| Least response time     | Nodes of uneven health; shifts load off a degrading node.                                 |
| Hash (IP or key)        | Cache locality: the same key lands on the same backend.                                   |

**Session affinity** (sticky sessions) layers on any algorithm and lets a stateful app scale out, at a cost: skewed load, sessions lost when a node dies, slow scale-in. Externalizing session state is usually the better answer.

The balancer is itself a single point of failure: run a managed balancer or an HA pair, with DNS pointing at it.

## Autoscaling

Configure minimum and maximum instance counts, a scaling metric (CPU, requests per second, queue depth), and an alarm when the maximum is reached. Instances take time to boot, so a sudden spike outruns reactive scaling: pre-warm or schedule capacity for known events (launches, Black Friday). Elasticity pays only for what runs, so name cost as one of its benefits.

## Async work

Any job slower than the request's latency budget (report generation, payment processing, transcoding, email) goes to a queue:

1. The request validates, enqueues, and returns `202 Accepted` (or the created resource in a pending state).
2. A worker pool consumes at its own rate; the broker absorbs spikes.
3. The user learns of completion by notification, polling a status, or push.

Scale workers on queue depth or consumer lag. Workers need idempotency, retries with backoff, and a dead-letter queue; see [DISTRIBUTED.md](DISTRIBUTED.md) for delivery semantics.

## CDN

A pull-through edge cache: a miss fetches from origin and caches; later requests are served near the user. It cuts latency and origin egress, which is the dominant cost for media. Estimate egress bandwidth to justify it. Signed URLs or signed cookies protect private content.

## Multi-region

A full copy of the stack per region, with traffic steered by DNS (latency-, geo-, or health-check-based routing) or anycast, not by a regional load balancer. Data is the hard part: decide which data stays region-local, which replicates asynchronously (state the recovery point objective), and which needs cross-region consensus (expensive in latency). Reach for it when the requirements include disaster tolerance or global latency targets.

## Throttling demand

When demand far exceeds supply (tens of thousands of tickets against millions of buyers), the system only has to serve the supply. A **virtual waiting room** in front of the hot path admits users in batches; it is a bought capability (Cloudflare Waiting Room, Queue-it). Randomizing queue positions at opening removes the advantage of arriving early or sitting near the data center. Bots need their own defences: bot detection, CAPTCHA, purchase limits per identity.

Rate limiting per user or IP at the gateway handles abuse; volumetric DDoS needs edge protection (CDN, WAF). Rate-limiting algorithms and load shedding live in [RESILIENCE.md](RESILIENCE.md).

## API gateway

A single entry point in front of multiple services: routing, central authentication, rate limiting, request shaping. It is the client's one address, so the client never learns the service topology. Replicate it like any other stateless tier.

## Observability and delivery

Logs, metrics (requests per second, p50/p95/p99 latency, error rate, saturation), distributed traces with a correlation ID propagated across async hops, alerts, and CI/CD. Metrics locate the next bottleneck; the next rung on the ladder is chosen from measurements.
