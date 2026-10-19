# Case studies

Five classic designs run through the method. Each one shows what the problem really tests, the numbers that drove decisions, and the alternatives rejected along the way. Use them as worked examples of requirement → decision → trade-off, not as templates to copy.

## URL shortener

**Tests**: math and uniqueness.

- **Requirements**:
  - Shorten a URL and redirect.
  - 100M new URLs/day, 10:1 read:write, ~100 bytes per record, 10-year retention.
  - Codes as short as possible, alphanumeric only.
- **Numbers**:
  - Writes ≈ 1,160/s and reads ≈ 11,600/s average, higher at peak.
  - 365B records, ≈ 36.5 TB.
  - 62⁶ ≈ 57B is too small and 62⁷ ≈ 3.5T fits, so codes are 7 characters.
- **Store**: billions of key lookups → a partitioned key-value or wide-column store keyed by `short_code`.
- **Code generation**:
  - Hashing the URL (MD5, SHA-1) was rejected: truncating the digest to 7 characters produces collisions that need checks.
  - Random codes were rejected: collisions need a conditional insert and a retry. Workable, but it adds latency and a failure mode.
  - Chosen: a unique integer from a distributed counter, base62-encoded. Bijective, so no collisions and no existence check.
- **Hardening**:
  - Sequential codes are enumerable. Obfuscate with a shuffled alphabet, or encrypt the integer.
  - Start the counter at an offset so early codes aren't one or two characters.
  - The counter must survive failover without reissuing IDs (leased ranges, durable counter).
- **Read path**: cache hot codes. Return `302` so every click reaches the service (analytics, revocation, cache warmth); `301` would offload repeat visits to the browser at the cost of visibility.
- **Scale**: stateless app tier behind a load balancer, store cluster, HA for the counter.

## File storage and sync (Drive, Dropbox)

**Tests**: large-file handling and sync mechanics, not raw scale.

- **Requirements**:
  - Upload, download, and two-way sync of a local folder.
  - 20M users × 15 GB quota; uploads up to 15 GB, resumable.
  - 3M uploads/day averaging 50 MB.
- **Numbers**:
  - 300 PB total quota → object storage.
  - 150 TB/day ingress → bytes bypass app servers.
  - ≈ 35 metadata writes/s → a single relational primary is plenty. Picking a distributed database here is the classic overreach.
  - The unestimated load to watch is millions of desktop agents asking "what changed?"
- **Entities**: User, Folder (`parent_id` adjacency list), FileMetadata. Bytes stay in object storage.
- **Upload**: metadata first (`pending`), presigned multipart part URLs, parallel part uploads with per-part retry, complete with ETags, storage event flips the status. Resume by listing stored parts.
- **Download**: short-lived presigned `GET` URL.
- **Sync, local → remote**: a desktop agent watches the folder through OS file-system events (inotify on Linux, FSEvents on macOS, `ReadDirectoryChangesW` on Windows), keeps local state in SQLite, and reuses the upload flow.
- **Sync, remote → local**: the agent asks for changes since a cursor.
  - Use a server-issued sequence rather than client timestamps, to avoid clock skew.
  - Deletes travel as tombstones.
  - Conflicts need a rule (keep both copies, or last writer wins).
  - Long polling or push can replace fixed-interval polling.
- **Advanced**: block-level delta sync sends only the changed chunks of a large file.

## Video platform (YouTube)

**Tests**: upload versus playback as two separate problems.

- **Requirements**:
  - Upload and watch.
  - 1M uploads/day, files up to 256 GB.
  - 100M DAU × 5 views, fast start even on slow connections.
- **Numbers**:
  - 500M views/day ≈ 5,800/s average, several times that at peak.
  - Storage multiplies by the renditions kept.
  - Egress bandwidth is the dominant cost, and it is what justifies the CDN.
- **Upload traps**:
  - Base64 in JSON inflates the file by a third and buffers it whole.
  - Streaming the body through the API holds a request open for hours and has no resume.
  - Fix: presigned multipart upload straight to object storage. A 256 GB file needs parts of at least ~26 MiB to stay within 10,000 parts.
- **Processing**: an object-created event triggers a job (via Lambda or EventBridge) on a transcoder that writes several resolutions in 2–6 s segments plus a manifest. A completion event marks the video playable: `pending` → `uploaded` → `ready`.
- **Playback**: the player loads the manifest and fetches a few segments ahead, choosing each segment's bitrate from measured throughput (adaptive bitrate). Segments are served through a CDN in front of object storage. Playing the raw upload would mean downloading the whole file first.
- **Metadata store**: a partitioned store if global multi-region writes are required; otherwise a relational store with cache and replicas would do.

## Ticketing (Ticketmaster)

**Tests**: contention on fixed supply, and absorbing a demand spike.

- **Requirements**:
  - View, search, and buy tickets.
  - 10M concurrent users on hot events; 100:1 read:write.
  - Search under 500 ms with typo tolerance.
  - No double-booking; fairness against bots and geography.
- **Store**: relational. Strong relations and the no-double-booking rule fit ACID, with an explicit mechanism: a conditional update on ticket status.
- **Reads**: cache-aside for event pages. Search goes to Elasticsearch fed by CDC (Postgres WAL → Debezium → Kafka → indexer). `LIKE '%term%'` and basic full-text search fall short of the typo and relevance requirements.
- **Holds**:
  - Writing `reserved` to the database was rejected: abandoned holds stay forever.
  - A cron job reverting stale holds was rejected: it keeps polling the database.
  - Chosen: a Redis TTL lock per seat, about 7 minutes. Purchase re-checks the hold and commits with the conditional update; the payment webhook is idempotent.
- **Spike**: tens of thousands of tickets against millions of users. A bought virtual waiting room admits buyers in batches with randomized positions, so the system serves the supply, not the crowd. Bot defences sit alongside it.
- **Staleness accepted**: the seat map isn't pushed live. A taken seat errors on click, and correctness holds on the write path.

## Live scoreboard (World Cup)

**Tests**: event flow, ordering, and push fan-out to millions.

- **Requirements**:
  - Live score without refresh; match history and stats.
  - 10M concurrent viewers; no lost events.
- **Ingestion**: providers (in-house scouts or a sports-data API via webhook) → load-balanced ingestion API that maps events to the domain model (an anti-corruption layer) with its own `event_id`, a stable `match_id`, and a per-match sequence number. Ordering by match minute isn't enough.
- **Log**: Kafka topic `match-events`, keyed by `match_id`. Ordering holds per match while matches run in parallel; partitions are provisioned for the consumer count.
- **Consumers** (separate groups read the same topic independently):
  - The *event store* group appends every event to Postgres (`matches`, `match_events` with `JSONB` payloads). This is the event-sourced history, and it is replayable to fix projection bugs.
  - The *score* group folds goals, cards, and substitutions into a per-match snapshot in Redis and publishes it to a pub/sub channel per match.
  - Both are idempotent on `event_id`, since delivery is at-least-once.
- **Serving**: `GET` returns the snapshot. SSE streams updates; each web server subscribes per match and fans out through an in-memory `match → connections` map. On reconnect the server resends the snapshot, because Redis Pub/Sub is at-most-once.
- **Cold path**: history and statistics query Postgres. Low traffic, no real-time requirement.
- **Durability**: Kafka with replication factor 3 and `acks=all` backs the "no lost events" requirement. Connection capacity (connections per node, node count) backs the 10M viewers.
