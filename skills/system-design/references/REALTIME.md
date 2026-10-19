# Real-time delivery

Getting server-side changes to clients without a manual refresh, and fanning them out to many connections.

## Picking the transport

| Need                                                                        | Transport           |
| --------------------------------------------------------------------------- | ------------------- |
| Few users, simple page (an internal dashboard)                              | Short polling       |
| Server pushes, client only listens (scores, notifications, LLM tokens, locations) | Server-Sent Events |
| Both directions at high frequency, or binary frames (chat, games, collaboration) | WebSocket        |

- **Short polling**: the client asks on an interval. Simple; it wastes requests and headers, adds up to one interval of latency, and multiplies load with users.
- **Long polling**: the server holds each request until data exists, responds, and the client reconnects. Works at scale but is awkward on both sides; SSE replaces it for one-way push.
- **SSE**: one HTTP response that never ends, carrying `text/event-stream` frames. The browser's `EventSource` reconnects automatically. Text only, server-to-client only.
- **WebSocket**: an HTTP `Upgrade` answered with `101 Switching Protocols`, then a persistent bidirectional framed protocol. More to build: heartbeats, reconnection, backpressure, a connection-aware deploy strategy.

## SSE details

- **Response headers**: `Content-Type: text/event-stream`, `Cache-Control: no-cache`. Disable proxy buffering (`X-Accel-Buffering: no` for NGINX). `Connection: keep-alive` is redundant in HTTP/1.1 and forbidden in HTTP/2.
- **Frames**: `event: <name>`, `id: <id>`, `retry: <ms>`, `data: <payload>`, each on its own line, and a blank line ends the message. Clients listen per event name with `addEventListener`.
- **Resume**: send an `id:` with each event; on reconnect the browser sends `Last-Event-ID`, and the server replays from there or resends a full snapshot.
- **Keepalive**: a comment line (`: ping`) every 15–30 seconds stops idle proxies from closing the stream.
- **Ending the response is the bug**: `EventSource` reconnects immediately, which turns the stream into a polling loop. In DevTools, a healthy stream shows one request with events arriving inside it.
- **Connection limit**: HTTP/1.1 browsers allow about six connections per origin, so several open tabs can starve the page. Serve SSE over HTTP/2.
- **Auth**: `EventSource` can't set headers. Use cookies (`withCredentials`), a short-lived single-use stream ticket in the URL, or a fetch-based SSE client that sends headers. A long-lived bearer token in the query string leaks into access logs, proxy logs, and browser history.

## Fan-out architecture

1. **Initial state**: the client fetches a snapshot with a normal `GET` (from a precomputed read model in Redis or similar).
2. **Stream**: the client opens the SSE or WebSocket connection for the topic it cares about (`/matches/{id}/stream`).
3. **Producer**: a worker that computes updates publishes them to a pub/sub channel per topic.
4. **Each server**:
   - subscribes once per topic it has clients for;
   - keeps an in-memory map `topic → open connections`;
   - writes every message to all connections in the matching entry.
5. **Cleanup**: on client disconnect (`req.on('close')`), remove the connection from the map, clear timers, and unsubscribe when the topic has no listeners left.

Choices to state:

- **Pub/sub durability**: Redis Pub/Sub is at-most-once; a server that's briefly disconnected misses messages. Pair it with snapshot-on-reconnect, or use Redis Streams or Kafka when gaps are unacceptable.
- **Upstream connections**: one shared subscriber connection per process, not one per client. A Redis connection in subscribe mode can't run other commands, so keep a separate connection for reads and writes. The same rule applies to database pools.
- **Capacity**: memory and file descriptors per open connection set connections per node. Node count = peak concurrent connections ÷ connections per node. Load balancers need long idle timeouts, and deploys need connection draining.

## Accepting staleness instead

Real-time push is a cost; name the requirement that pays for it. A view that is briefly stale (a seat map, a like count) is acceptable when the write path rejects conflicting actions: the user who clicks a taken seat gets an error, and no double sale happens.
