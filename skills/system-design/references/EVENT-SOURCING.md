# Event sourcing

Store each entity as an append-only sequence of facts; current state is derived by folding over them. A balance is not stored: it is what the deposits, withdrawals, and transfers add up to.

## When it fits

- **Signals:**
  - The history is the domain: ledgers, order tracking, anything regulators audit.
  - The business asks how something reached its state, or what the state was at time T.
  - Several read models must come from the same facts (statement screen, BI, search).
  - New questions will be asked of past behaviour.
- **Poor fit:**
  - CRUD-shaped domains (profiles, settings, catalogs edited by admins).
  - Systems whose only need is an audit trail. An append-only history table (one polymorphic table with a `type` column and a `JSONB` payload) covers that and scales fine in a relational database.
  - Teams without time to absorb the learning curve.
  - Data dominated by personal information that must be erasable.
- **Scope**: per bounded context or aggregate, never system-wide by default. The account ledger can be event-sourced while customer profiles stay CRUD.

## Model

- **Event**: a past-tense fact in domain language (`AccountOpened`, `MoneyDeposited`, `PixTransferSent`) carrying the data the fact needs (amount, destination, currency).
  - An `AccountUpdated` carrying the new state is CRUD in disguise: it records the result and loses the reason.
  - Metadata on every event: `event_id`, stream ID, version (position in the stream, starting at 0), `occurred_at`, schema version, `correlation_id`, `causation_id`.
- **Stream**: one per aggregate instance, named `<entity>-<id>` (`account-123`). Different event types for the same entity live in the same stream, so heterogeneous operations need no table per type.
- **Aggregate**: the consistency boundary. Commands target one aggregate; its stream is the unit of ordering and concurrency.

| Version | Event              | Data                          | Balance |
| ------- | ------------------ | ----------------------------- | ------- |
| 0       | `AccountOpened`    | currency BRL                  | 0       |
| 1       | `MoneyDeposited`   | 10,000                        | 10,000  |
| 2       | `MoneyWithdrawn`   | 1,500                         | 8,500   |
| 3       | `PixTransferSent`  | 2,000 to account-777          | 6,500   |
| 4       | `CardPurchaseMade` | 850                           | 5,650   |

## Handling a command

1. **Load**: read the latest snapshot, if any, plus the events after it.
2. **Evolve**: fold the events into current state.
3. **Decide**: validate the command against that state (sufficient balance, account open) and produce new events, or reject.
4. **Append** with the expected version: "append only if the stream is still at version 4".
5. **On conflict** (another command appended first): reload and retry, or reject.

Validation runs against state rehydrated from the stream, never against a read model: the read model lags, and a second transfer could pass before the first one is projected. Rehydration alone is still not enough: two concurrent commands can both read a balance of 1,000. The expected-version check on append is the mechanism that makes one of them fail.

## Event store

| Option                                   | Notes                                                                                                                                                         |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Purpose-built (EventStoreDB, now KurrentDB) | Streams, expected-revision appends, catch-up and persistent subscriptions built in.                                                                         |
| Relational table                         | `events(stream_id, version, type, data JSONB, metadata JSONB, recorded_at)` with `UNIQUE (stream_id, version)`: the constraint is the concurrency check. Libraries such as Marten build on this. |
| Kafka                                    | Good for distributing events, poor as the source of truth: no efficient per-stream read, no expected-version append, retention and compaction fight keeping events forever. |

## Projections

A projection is a consumer that folds events into a read model in whatever store suits the query: a document per account with balance and statement, a relational table for BI, a search index. One stream feeds many projections; clients read only from projections.

- **Checkpoint**: store the last processed position atomically with the read-model update.
- **Idempotency**: skip events at or below the checkpoint, so redelivery doesn't count a deposit twice.
- **Ordering**: per stream. Cross-stream read models must tolerate interleaving.
- **Rebuild**:
  1. Deploy the new projection version alongside the old one, starting from position 0.
  2. Let it catch up.
  3. Switch reads over.
  4. Drop the old version.

  Estimate catch-up time from the event count before relying on it.
- **Read-your-writes**: return the new state from the command response, or show a pending state, while the projection catches up.

## Snapshots

An optimization for long streams: persist the folded state with the version it reflects (`{stream: account-123, version: 4, state: {balance: 5650}}`) every N events, then load the snapshot plus the events after it.

- The application writes snapshots, to a separate stream or table. They carry a schema version so they can be discarded and recomputed when the state shape changes.
- Reach for short streams first. "Closing the books" (one stream per account per period, opened with a carried-forward balance) keeps rehydration cheap without snapshots.

## Replay and corrections

Replay rebuilds projections, creates new ones, and answers temporal queries. It does not change what happened: money that moved stays moved.

- **Corrections are new events.** When a fee is ruled illegal, find every `FeeCharged` and append a `FeeRefunded` to each stream; the history then shows both the charge and the refund.
- **Replays must not repeat side effects.** Handlers that send emails or move money keep their own checkpoints and stay off during projection rebuilds.

## Evolving events

Stored events are immutable and live as long as the system.

- Prefer additive changes (new optional fields).
- Introduce a new event type for a change in meaning.
- **Upcast**: transform old shapes into the current one on read.
- Rewriting history is a copy-and-transform migration into a new store, planned like any data migration.

## Publishing to other services

- **Domain events** are internal, fine-grained, and free to change with the model.
- **Integration events** are a public contract: stable, versioned, often coarser.

Translate domain events into integration events from a subscription on the store. The append is the only write, so the store doubles as the outbox and no dual write exists.

## Personal data

An immutable log collides with the right to erasure:

- Keep personal data out of events and reference it by ID from a deletable store.
- Or **crypto-shred**: encrypt each subject's personal fields with a per-subject key, and delete the key on an erasure request.

## Testing

- **Command tests**: given these past events, when this command arrives, then expect these new events or this error.
- **Projection tests**: given these events, expect this read model.

## Costs

- A learning curve for the team.
- Eventually consistent reads everywhere.
- Event schemas maintained forever.
- An event store to operate.
- Debugging through projections instead of a row you can inspect.
- Storage that only grows.
