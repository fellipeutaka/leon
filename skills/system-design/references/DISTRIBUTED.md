# Distributed data and communication

What happens once state spans more than one system: keeping derived stores in sync, replacing synchronous call chains with events, and surviving duplicates, reordering, and partial failure.

## Dual write

Any "write to the database, then do something elsewhere" is a dual write: publishing to a broker, updating a cache or search index, calling an email provider or another service. The two writes cannot be atomic. A crash or network failure between them leaves one done and the other not: a user with no welcome email, or an email for a user that was never committed. Moving the publish inside the database transaction doesn't help, because the broker is not part of that transaction (publish succeeds, commit fails). The bug is intermittent and the code looks correct, which makes it the classic interview trap.

### Transactional outbox

In the same local transaction, write the business row **and** an outbox row (`id`, `aggregate_id`, `event_type`, `payload`, `created_at`, `published_at`). A relay delivers the outbox afterwards:

- **Polling relay**: `SELECT … WHERE published_at IS NULL ORDER BY id LIMIT n FOR UPDATE SKIP LOCKED`, publish, mark published. Failed publishes stay pending and retry on the next poll.
- **CDC relay**: Debezium tails the database log and routes outbox rows to Kafka (its outbox event router), with no polling code.

Properties to state:

- Delivery is **at-least-once**: a relay crashing after publish and before marking repeats the message, so consumers are idempotent.
- Ordering holds per aggregate when the aggregate ID is the broker's partition key and one relay owns each row (the `SKIP LOCKED` claim or a single relay instance).
- Published rows are purged on a schedule.

Alternatives: CDC directly on business tables (fits derived stores), two-phase commit (rarely supported across databases and brokers, and blocking).

## Change data capture (CDC)

Reads the database's replication log (Postgres WAL through a logical replication slot, MySQL binlog) and emits one event per row change, usually into Kafka; consumers update derived stores. Overhead on the database is low, not zero: a stalled consumer makes the database retain log segments until disk fills, so monitor slot lag. Kafka Connect sink connectors can replace hand-written indexer workers.

## Delivery semantics and idempotency

| Guarantee       | Where it shows up                                   |
| --------------- | --------------------------------------------------- |
| At-most-once    | Redis Pub/Sub, fire-and-forget notifications        |
| At-least-once   | Most brokers, the outbox, Kafka with commit after processing |
| Effectively once| At-least-once delivery + an idempotent consumer     |

- **Idempotent consumer**: record processed event IDs in the same transaction as the effect, or make the effect a natural upsert.
- Retries use backoff; poison messages go to a **dead-letter queue** that someone is alerted on.
- Ordering exists only within a partition or key.
- Event schemas are contracts: evolve them additively, version them, and use a schema registry where available. Events move coupling into the schema; they don't erase it.

## CQRS

Separate the model that handles commands (writes) from the models that serve queries (reads).

**Signals**, all together:

- reads vastly outnumber writes;
- a read costs far more than a write (a product page joining a dozen tables, free-text search);
- heavy reads contend with writes for CPU, memory, connections, and I/O;
- queries stay slow after indexes, bigger hardware, and read replicas (replicas add throughput, but a slow query is still slow);
- the shape the screens need differs from the shape the writes produce.

**Forms:**

- *Light*: separate read models in the same database (materialized views, denormalized tables).
- *With event sourcing*: the event store is the write model and projections are the read models. The two patterns pair naturally but are independent; neither requires the other.
- *Full*: the write store is the source of truth. One or more read stores (document, search, key-value) hold denormalized data shaped per query, fed by CDC or an outbox. Duplication is the intended cost. A read store can be dropped and rebuilt by replaying from the source.

**Costs:**

- Eventual consistency between command and query. Handle read-your-writes by returning the result from the command or showing a pending state.
- A sync pipeline to operate.
- Projections that are idempotent and ordered.
- Backfills when a projection changes.

**Scope** CQRS to the module that has the symptoms; the rest of the system stays plain CRUD. Analytics dashboards over months of orders belong in a separate analytics pipeline (warehouse, OLAP store), never on the OLTP primary.

## Event-driven architecture

**The problem with synchronous call chains between services:**

- Latency adds up along the chain.
- One slow or dead dependency (an external tax authority) times out every caller.
- A traffic spike multiplies across every downstream call.
- The caller must know and change for every new downstream step, and so must the teams.

That shape is a **distributed monolith**. Scaling every service to absorb one service's spike treats an architectural problem as a capacity problem.

**Event-driven:** a producer records a past-tense domain fact (`OrderPlaced`, `InvoiceIssued`) and publishes it to a broker; consumers subscribe and react; the producer doesn't know who listens. The broker absorbs spikes, consumers scale on their own lag, and a new capability subscribes to an existing event (or asks the owning team to emit one) without touching other services.

**Modeling.** Events come from the domain, found through Event Storming and bounded contexts. Causality follows business rules: shipping reacts to `InvoiceIssued`, not `OrderPlaced`, because goods can't ship without an invoice. A payload carries `event_id`, `type`, `aggregate_id`, `occurred_at`, `version`, and the facts consumers need.

**Still required:**

- An outbox on each producer.
- Idempotent consumers.
- Sagas for failure handling.
- Correlation IDs for tracing across async hops (tracing gets harder, not easier).
- Schema evolution.
- No synchronous answer to "did stock actually reserve?", which shapes the UX.

Synchronous request/response remains right for queries and for calls that need an immediate answer; the core flow between services is where events belong.

**Brokers:**

- Kafka: durable log, retention, replay, partitions.
- RabbitMQ: routing, work queues.
- Cloud: SNS → SQS fan-out, EventBridge, Pub/Sub. SQS alone is point-to-point.

**When:** systems with the symptoms above, several teams, and fluency in domain modeling. A small system is better served by HTTP plus a queue for slow jobs.

## Sagas

A sequence of local transactions where a failure triggers compensating actions for the steps already done (refund the payment, release the stock).

- **Choreography**: services react to each other's events. Fits short flows.
- **Orchestration**: a coordinator drives the steps. Fits long or branching flows.

Compensation is semantic undo, not rollback: intermediate states are visible to other transactions, so model them explicitly (`pending`, `reserved`), and make compensations idempotent.

## Kafka essentials

- A topic is split into partitions. Order is guaranteed only within a partition.
- The producer's key picks the partition (hash of the key), so the key is the entity whose events must stay ordered: `match_id`, `order_id`.
- Within a **consumer group** each partition goes to one consumer, so parallelism tops out at the partition count; extra consumers sit idle. Each additional group receives every event independently (fan-out to different purposes).
- Membership changes trigger a **rebalance**. Committing offsets after processing gives at-least-once delivery; duplicates appear on crash or rebalance, so consumers are idempotent.
- Adding partitions remaps keys and breaks per-key ordering during the transition, so provision partitions up front.
- Durability: replication factor 3, `acks=all`, `min.insync.replicas=2`, idempotent producer. Replay needs retention long enough (or compaction) to cover it.
- A queue deletes a message on acknowledgement (work distribution). A log retains it (replay, many independent readers).

## Event sourcing

Storing state as an append-only stream of facts per entity, with current state derived by folding over them. When the design calls for it (history as the domain, temporal queries, many read models from the same facts), read [EVENT-SOURCING.md](EVENT-SOURCING.md).
