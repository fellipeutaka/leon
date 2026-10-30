# Resilience

How a service survives slow or failing dependencies and overload without passing the failure upstream.

| Symptom                                                   | Pattern                                  |
| --------------------------------------------------------- | ---------------------------------------- |
| Requests hang on a slow dependency                        | Timeouts, deadline propagation           |
| Transient errors fail user actions                        | Retries with backoff and jitter          |
| Retried writes create duplicates                          | Idempotency keys                         |
| A dead dependency keeps being hammered                    | Circuit breaker                          |
| One slow dependency exhausts capacity for everything else | Bulkheads                                |
| Overload turns into timeouts for everyone                 | Load shedding, backpressure, rate limits |
| A dependency is down but the product must keep working    | Fallbacks, graceful degradation          |
| Recovery causes a second outage                           | Jittered reconnects, slow start          |

## Timeouts

- Every network call has an explicit timeout. Library defaults are often infinite or far too long.
- Set the request timeout from the dependency's healthy latency distribution (a little above its p99.9), with a separate, short connect timeout.
- **Deadline propagation**: pass the caller's remaining budget downstream (gRPC deadlines, a header). Each hop stops work once the deadline has passed, instead of finishing an answer nobody is waiting for.
- An inner timeout is shorter than the outer one. Otherwise the caller gives up while the callee keeps working.

## Retries

- Retry only **transient** failures: timeouts, connection resets, 503, and 429 (honour `Retry-After`).
- Retry only **idempotent** operations, or make the operation idempotent first (idempotency keys, below).
- **Exponential backoff with full jitter**: sleep a random time between 0 and `min(cap, base × 2^attempt)`, so clients that failed together don't retry together.
- Cap the attempts at 2–3.
- **Retry at one layer.** Retries stack multiplicatively: three layers retrying three times each turn one request into 27 calls against an already struggling dependency.
- A **retry budget** caps retries to a fraction of traffic (around 10%) so retries can't amplify an outage. Never retry while a circuit breaker is open.

## Idempotency keys

The client generates one key per logical operation and sends it with every attempt (an `Idempotency-Key` header). The server:

1. Stores the key with a hash of the request and the outcome, atomically with the effect.
2. On a repeat with the same key and request, returns the stored outcome without redoing the work.
3. On the same key with a different request, rejects it.
4. Expires keys after a window (24 hours is common).

Required for payments, any retried `POST`, and webhook receivers, since providers deliver at least once.

## Circuit breaker

A per-dependency state machine:

- **Closed**: calls flow. Failures and slow calls are counted over a sliding window.
- **Open**: when the failure rate crosses a threshold (with a minimum call count, so three failures out of four don't trip it), calls fail fast or go to a fallback, with no network call. This gives the dependency room to recover and frees the caller's threads.
- **Half-open**: after a cooldown, a few trial calls go through. Success closes the circuit; failure reopens it.

Available as libraries (Resilience4j, Polly, opossum) or in a service mesh (Envoy outlier detection).

## Bulkheads

Give each dependency its own bounded resources: connection pool, thread pool, or concurrency limit. A dependency that turns slow then exhausts only its own compartment, not the capacity that serves every other request.

The same idea applies at larger scale: separate worker pools per queue or priority, and cell-based architecture, where independent copies of the stack each serve a slice of customers.

## Load shedding, backpressure, rate limiting

- **Load shedding**: under overload, reject excess work early and cheaply (`503` or `429` with `Retry-After`) rather than accepting it and timing out late. Accepted work that times out wastes the capacity it consumed. Use bounded queues and concurrency limits, and shed low-priority traffic (recommendations) before critical traffic (checkout).
- **Backpressure**: consumers pull at their own pace, buffers are bounded, and producers slow down or fail when a buffer is full. Queue depth drives scaling instead of unbounded growth.
- **Rate limiting algorithms**:

  | Algorithm      | Behaviour                                                      |
  | -------------- | -------------------------------------------------------------- |
  | Token bucket   | Allows bursts up to bucket size, refills at a steady rate      |
  | Leaky bucket   | Smooths output to a constant rate                              |
  | Fixed window   | Simple; allows double bursts at window boundaries              |
  | Sliding window | Log or weighted counter; accurate, at more memory or computation |

  For a limit shared across instances, keep the counters in Redis, updated atomically (a Lua script), and keyed per user, API key, or IP.

## Fallbacks and graceful degradation

Decide, per dependency, what the product does without it:

- Serve a cached or stale value.
- Use a default (empty recommendations, a generic banner).
- Hide the feature.
- Accept the work and finish it later (take the order now, charge when the payment provider recovers).

A fallback is simpler than the primary path and gets exercised in tests. Auth and payment checks **fail closed**: when the check can't run, the action is refused.

## Health checks

- **Liveness**: is the process alive? A failure means restart it.
- **Readiness**: can this instance serve traffic? A failure means the load balancer takes it out of rotation.

A readiness check that fails when a shared dependency is down removes every instance at once, turning a partial outage into a total one. Keep readiness about the instance itself, and handle dependency failures with the patterns above.

## Recovery

After an outage every client reconnects and every cache is cold:

- Jitter reconnects and retries.
- Use slow start in the load balancer for instances returning to rotation.
- Coalesce cache misses (see [DATA.md](DATA.md)).
- Scale capacity before reopening the gates (waiting room, feature flags).

## Testing failure

Inject latency, errors, and killed instances on purpose: chaos experiments and game days, in staging first, then in production with a limited blast radius. Each experiment checks that the expected pattern engaged (the breaker opened, the fallback served, traffic was shed) and that the alarms fired.
