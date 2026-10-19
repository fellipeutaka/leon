# Data

Storage decisions: which database, how it replicates and partitions, what to cache, where search and large files live, how IDs are minted, and how scarce resources avoid double-booking.

## Choosing a database

Work through four lenses in order; the first that rules a candidate out ends its run.

1. **Numbers.** Sustained writes per second, reads per second, total size, growth. Hundreds of writes per second and a few terabytes fit a single relational primary with replicas, and that is the cheaper design to run. A partitioned store earns its place at write throughput or data volume beyond one node, or when writes must land in several regions.
2. **Shape and access pattern.**
   - Relations, joins, constraints → relational.
   - Huge volume, lookups by a known key → key-value or wide-column, with one table per query.
   - Variable payloads → Postgres `JSONB` first; a document store when documents are the whole model.
   - Full-text search → a search engine, as a derived store.
   - Time series → a time-series or wide-column store.
   - Bytes → object storage.
3. **Consistency under failure (PACELC).** If **P**artitioned, choose **A**vailability or **C**onsistency; **E**lse, choose **L**atency or **C**onsistency. Money, stock, and uniqueness → PC/EC. Likes, comments, feeds, catalogs → PA/EL.
4. **Operations.** Managed offering, team skill, cost.

CAP, stated precisely: network partitions happen, so partition tolerance is not optional; during a partition a replicated store chooses consistency or availability. PACELC adds the trade-off that exists without a partition: synchronous replication buys consistency with latency. Leading with "SQL vs NoSQL" skips all four lenses.

| Store                     | Model                         | Default stance and notes                                                                                                                                    |
| ------------------------- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Postgres / MySQL          | Relational, single primary    | Scale reads with replicas. Sync replication → PC/EC; async → PA/EL. Sharding via Citus, Vitess, or a managed service (Aurora scales storage and readers).   |
| MongoDB                   | Document, replica set         | Elects a new primary on failure. Consistency depends on write/read concern; `majority` gives PC/EC behaviour.                                                |
| Cassandra / ScyllaDB      | Wide-column, leaderless       | PA/EL. Partitioned automatically. Consistency tunable per query (`ONE`, `QUORUM`, `LOCAL_QUORUM`, `ALL`). Model tables around queries; no joins.           |
| DynamoDB                  | Key-value / document          | PA/EL by default; strongly consistent reads are opt-in and single-region.                                                                                  |
| CockroachDB / Spanner     | Distributed SQL (Raft/Paxos)  | PC/EC with ACID across nodes; pays in write latency and cost. Spanner is CP with very high availability, not an exception to CAP.                            |
| Redis                     | In-memory key-value           | Cache, locks, counters, rate limits, pub/sub. Async replication: failover can lose recent writes. Sentinel gives failover; Cluster gives sharding.          |
| Elasticsearch / OpenSearch| Search index                  | Derived store only; fed from the source of truth.                                                                                                          |

**Tunable consistency.** In leaderless stores, a read is guaranteed to overlap the latest acknowledged write when R + W > RF (for example `QUORUM` reads and writes with replication factor 3). Conflicts resolve by last-write-wins on timestamps, so clock skew matters. Typical replication factor is 3.

Reaching for a distributed database at a load a single node handles adds operational cost without a requirement to pay for it.

## Replication

All writes go to the primary; reads spread across replicas. Most ORMs accept separate read and write hosts; managed services expose a reader endpoint.

- **Asynchronous**: fast writes; replicas lag (normally milliseconds to seconds, longer under load), so reads can be stale, and a failover can lose the last writes.
- **Synchronous / semi-synchronous**: no loss on failover; higher write latency, and a lagging replica can stall writes unless acknowledgement uses a quorum.
- **Read-your-writes**: route a user's reads to the primary for a short window after they write, or pass a version and read from a replica that has caught up.
- **Failover**: a replica is promoted to primary; writes are unavailable until promotion completes.

Replicas scale reads. Writes and total storage still sit on one primary.

## Caching

**Cache-aside** is the default: `get(key)` → hit returns; miss loads from the database, `set(key, value, ttl)`, returns. Values are serialized.

Cache data that meets all three:

1. Read often.
2. Tolerates staleness for the TTL.
3. Changes rarely.

Balances, stock at checkout, and permission checks that must revoke instantly read from the source of truth. Cache the hot set, not everything: memory is the scarce resource.

- **Invalidation**: a TTL bounds staleness; deleting the key on write (delete, not update, to avoid racing a concurrent fill) shortens it. Write-through and write-behind are alternative write patterns. Eviction policies (LRU, LFU, `maxmemory`) decide what leaves when memory is full, which is separate from invalidation.
- **Stampede**: a hot key expiring sends every request to the database at once. Coalesce misses (one loader, others wait), refresh early, add TTL jitter.
- **Penetration**: lookups for keys that don't exist always miss. Cache the negative result briefly.
- **Cache outage**: fall back to the database, with load shedding so the database survives the herd.
- **Latency**: a network round trip to Redis is roughly 0.1–1 ms; the larger win is the load taken off the database.

Other cache layers: CDN, HTTP caching, precomputed read models ([DISTRIBUTED.md](DISTRIBUTED.md)).

## Search

`LIKE '%term%'` cannot use a B-tree index and scans the table: fine at small scale, a bottleneck under concurrency (a trigram GIN index helps in Postgres). Full-text search uses an **inverted index**: each term maps to the documents containing it; a multi-term query intersects the lists and ranks the result. Postgres full-text search covers moderate needs. A dedicated engine earns its place for typo tolerance, autocomplete, relevance tuning, and scale. The index is derived: feed it from the source of truth through CDC → Kafka → indexer, and accept index lag.

## Sharding

Splitting data so no single node holds all of it; each shard is a separate database instance. Reach for it after the cheaper rungs: query and index work, caching, read replicas, vertical scaling, archiving cold data, and splitting the system into services along bounded contexts so each service's database is sharded on its own terms. (Multi-tenant systems sharding by tenant are the common exception that shards a monolith.)

**Shard key**, chosen first:

- High cardinality.
- Even distribution of **load**, not only of rows. User behaviour decides: new users are usually the most active, the current year is the hottest.
- Co-locates data queried together (a user with their posts and comments), so most requests hit one shard.
- Present in most queries. Usually derived from the domain's central entity (user in a social network, patient in a hospital system).

Timestamps, low-cardinality columns, and monotonic ranges without automatic splitting make hot shards.

**Distribution:**

- `hash(key) mod N`: simple, but changing N moves most keys.
- Consistent hashing, or many fixed virtual slots mapped to nodes (Redis Cluster uses 16,384): adding a node moves only a fraction of keys.
- Range: efficient range scans; needs automatic splitting and rebalancing (Bigtable, HBase, CockroachDB, MongoDB ranged sharding).

A database with built-in partitioning beats a hand-rolled router.

**Problems to plan for:**

- **Hot key** (a celebrity account): a dedicated shard, splitting the key with read-side aggregation, caching.
- **Cross-shard queries** (global top-10): scatter-gather is slow; precompute the aggregate as a read model or cache it.
- **Cross-shard transactions** (a transfer between users on two shards): avoid them through key choice; otherwise a saga ([DISTRIBUTED.md](DISTRIBUTED.md)) or two-phase commit.
- **Reference tables** unrelated to the key: replicate them to every shard.
- **IDs**: auto-increment breaks across shards; see ID generation below.

## Blobs and large uploads

Bytes in object storage; metadata (owner, size, MIME type, object key, status) in the database. Large bodies through app servers hit proxy and gateway body limits (configurable, often 1–10 MB by default), request timeouts, server bandwidth, and offer no resume.

Upload flow:

1. Client sends metadata; the API stores it with status `pending` and starts a multipart upload.
2. The API signs one presigned `PUT` URL per part (signing is local; no storage round trip per URL) and returns them.
3. The client uploads parts in parallel and retries any part independently.
4. The client asks the API to complete the upload with the part ETags.
5. A storage event notification (not the client's word) flips the status to `uploaded`.

S3 limits: 10,000 parts maximum, parts of 5 MiB to 5 GiB (the last part may be smaller), objects up to 48.8 TiB. Part size ≥ file size ÷ 10,000. To resume, list the parts already stored and continue. Downloads use short-lived presigned `GET` URLs or CDN signed URLs.

Media playback: transcode into several resolutions, each cut into 2–6 second segments with a manifest (HLS or DASH; CMAF lets both share segments). The player picks each segment's bitrate from measured throughput (adaptive bitrate) and starts after the first few segments. Serve segments through a CDN.

## ID generation and short codes

| Approach                          | Notes                                                                                        |
| --------------------------------- | -------------------------------------------------------------------------------------------- |
| Database sequence                 | Single node only.                                                                            |
| Snowflake-style 64-bit            | Timestamp + machine ID + sequence; sortable, no coordination per ID.                          |
| UUIDv7 / ULID                     | Time-ordered, no coordination, longer.                                                       |
| Leased ranges                     | Each server reserves a block (say 1,000) from a durable counter; no round trip per ID.        |
| Redis `INCR`                      | Atomic, but async replication means a failover can hand out an ID twice. Pair with persistence or leased ranges. |

**Short codes**: base62-encode a unique integer, which gives no collisions and no existence check. Length is the smallest k with 62ᵏ ≥ total codes (62⁷ ≈ 3.5 trillion). Sequential codes are enumerable: shuffle the alphabet (Sqids) to obfuscate, or encrypt the integer for real unpredictability, and start the counter at an offset to skip trivially short codes. Random codes are the alternative: insert conditionally (`IF NOT EXISTS`, a unique constraint) and retry on conflict; the chance that a new code collides is (codes issued) ÷ (code space).

Redirects: `301` is cached by browsers (less load, no per-click analytics, hard to revoke); `302`/`307` sends every click through the server (analytics, revocation, cache warmth).

## Scarce resources and double-booking

Name the mechanism that prevents two buyers from taking one seat:

- conditional update: `UPDATE tickets SET status = 'booked' WHERE id = $1 AND status = 'available'`, and check rows affected;
- a unique constraint on the claim;
- `SELECT … FOR UPDATE` inside a transaction;
- an optimistic version column.

**Temporary holds**: a TTL lock (`SET seat:{id} {owner} NX PX 420000`) expires abandoned holds on its own, with no database write and no cron job. Purchase re-checks the hold owner and still finishes with the conditional database write, so losing the lock store degrades the experience but cannot double-sell. Payment webhooks are idempotent; payment confirmed after the hold expired goes to a refund path. A seat map showing a just-taken seat as available is an acceptable staleness when the write path is conditional.
