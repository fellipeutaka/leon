# Proxy & Upstream Reference

## Table of Contents

- [proxy_pass Behavior](#proxy_pass-behavior)
- [Proxy Headers](#proxy-headers)
- [Proxy Timeouts](#proxy-timeouts)
- [Proxy Buffering](#proxy-buffering)
- [Outgoing IP Binding](#outgoing-ip-binding)
- [Upstream Groups](#upstream-groups)
- [Load Balancing Methods](#load-balancing-methods)
- [Server Weights](#server-weights)
- [Server Parameters](#server-parameters)
- [Upstream Keepalive](#upstream-keepalive)
- [Passive Health Checks](#passive-health-checks)
- [Proxy Next Upstream](#proxy-next-upstream)
- [WebSocket Proxying](#websocket-proxying)
- [FastCGI Proxying](#fastcgi-proxying)
- [gRPC Proxying](#grpc-proxying)
- [Upstream Variables](#upstream-variables)

## proxy_pass Behavior

When NGINX proxies a request, it sends the request to a proxied server, fetches the response, and sends it back to the client.

The `proxy_pass` directive can point to an HTTP server, a named upstream group, or a UNIX socket. URI handling depends on whether `proxy_pass` includes a URI component:

```nginx
# WITH URI (trailing slash counts as URI) -- replaces the location prefix
location /some/path/ {
    proxy_pass http://www.example.com/link/;
    # /some/path/page.html -> http://www.example.com/link/page.html
}

location /api/ {
    proxy_pass http://backend/;
    # /api/users -> http://backend/users
}

# WITHOUT URI -- full original URI is passed
location /api/ {
    proxy_pass http://backend;
    # /api/users -> http://backend/api/users
}
```

**Special cases:**
- If the address is specified without a URI, or it is not possible to determine the part of URI to be replaced, the full request URI is passed (possibly modified)
- When location uses a regex (`~` or `~*`), `proxy_pass` should NOT include a URI
- Variables in `proxy_pass` cause the URI to be passed as-is

Non-HTTP protocols use their own `*_pass` directives:

```nginx
fastcgi_pass    # FastCGI servers
uwsgi_pass      # uWSGI servers
scgi_pass        # SCGI servers
memcached_pass   # memcached servers
grpc_pass        # gRPC servers
```

## Proxy Headers

By default, NGINX modifies two headers in proxied requests: `Host` is set to `$proxy_host`, and `Connection` is set to `close`. Headers with empty values are eliminated.

```nginx
location /some/path/ {
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_pass http://localhost:8000;
}
```

To prevent a header from being passed to the proxied server, set it to an empty string:

```nginx
proxy_set_header Accept-Encoding "";
```

**Important:** `proxy_set_header` directives are inherited from the parent level only when there are **no** `proxy_set_header` directives on the current level. If you define any, you must redefine all needed headers.

```nginx
# Hide headers from upstream response
proxy_hide_header X-Powered-By;
proxy_hide_header Server;
```

## Proxy Timeouts

```nginx
proxy_connect_timeout 60s;   # time to establish connection to upstream
proxy_read_timeout    60s;   # time between two successive read operations
proxy_send_timeout    60s;   # time between two successive write operations
```

These are **not** total response time limits -- they measure time between successive I/O operations. For long-running requests, increase per-location:

```nginx
location /api/reports/ {
    proxy_read_timeout 300s;
    proxy_pass http://backend;
}
```

## Proxy Buffering

By default, NGINX buffers the entire response from a proxied server before sending to the client. This frees the upstream connection quickly and optimizes performance with slow clients.

```nginx
proxy_buffering on;               # default: on
proxy_buffer_size 2k;             # buffer for response header (first part)
proxy_buffers 16 4k;              # number and size for response body
proxy_busy_buffers_size 8k;       # max busy sending to client while still reading
```

Disable buffering for streaming/SSE:

```nginx
location /api/stream/ {
    proxy_buffering off;
    proxy_pass http://backend;
}
```

The `X-Accel-Buffering: no` response header from upstream also disables buffering per-request. When buffering is disabled, NGINX uses only the buffer configured by `proxy_buffer_size`.

## Outgoing IP Binding

When your proxy server has multiple network interfaces, use `proxy_bind` to choose a source IP:

```nginx
location /app1/ {
    proxy_bind 127.0.0.1;
    proxy_pass http://example.com/app1/;
}

location /app2/ {
    proxy_bind $server_addr;    # use the IP that accepted the request
    proxy_pass http://example.com/app2/;
}
```

## Upstream Groups

Define server groups with the `upstream` directive in the `http` context. Referenced by `proxy_pass`, `fastcgi_pass`, `uwsgi_pass`, `scgi_pass`, `memcached_pass`, and `grpc_pass`:

```nginx
http {
    upstream backend {
        server backend1.example.com weight=5;
        server backend2.example.com:8080;
        server unix:/tmp/backend3;
        server 192.0.0.1 backup;
    }

    server {
        location / {
            proxy_pass http://backend;
        }
    }
}
```

## Load Balancing Methods

NGINX Open Source supports four methods. NGINX Plus adds two more (Least Time, enhanced Random).

When configuring any method other than Round Robin, place the method directive **above** the `server` directives in the `upstream` block.

### Round-Robin (Default)

Distributes requests evenly, respecting weights. No directive needed:

```nginx
upstream backend {
    server backend1.example.com;
    server backend2.example.com;
}
```

### Least Connections

Sends to the server with fewest active connections (weighted):

```nginx
upstream backend {
    least_conn;
    server backend1.example.com;
    server backend2.example.com;
}
```

### IP Hash

Session persistence by client IP (first 3 octets of IPv4, full IPv6):

```nginx
upstream backend {
    ip_hash;
    server backend1.example.com;
    server backend2.example.com;
    server backend3.example.com down;  # preserves hash distribution
}
```

Use `down` (not removing the server) to preserve the current hashing of client IP addresses.

### Generic Hash

Hash on an arbitrary key. Use `consistent` for minimal remapping when servers change (ketama consistent hashing):

```nginx
upstream backend {
    hash $request_uri consistent;
    server backend1.example.com;
    server backend2.example.com;
}
```

This is useful for caching servers and applications that accumulate state.

### Random

Randomly select a server (weighted). Optionally pick two, then choose by `least_conn`:

```nginx
upstream backend {
    random two least_conn;
    server backend1.example.com;
    server backend2.example.com;
}
```

Recommended for distributed environments where multiple load balancers share the same backends.

## Server Weights

Weights influence how Round Robin, Least Connections, and Random distribute requests. Default weight is `1`:

```nginx
upstream backend {
    server backend1.example.com weight=5;
    server backend2.example.com;        # weight=1
    server 192.0.0.1 backup;
}
# Out of every 6 requests: 5 -> backend1, 1 -> backend2
# backup only receives traffic when both primaries are unavailable
```

## Server Parameters

```nginx
upstream backend {
    server backend1.example.com weight=5;
    server backend2.example.com max_fails=3 fail_timeout=30s;
    server backend3.example.com max_conns=100;
    server backup1.example.com  backup;
    server backend4.example.com down;
}
```

| Parameter | Default | Description |
|---|---|---|
| `weight=N` | 1 | Relative weight for load balancing |
| `max_fails=N` | 1 | Failures in `fail_timeout` window before marking unavailable. 0 disables checks |
| `fail_timeout=T` | 10s | Window for counting failures AND duration to mark server unavailable |
| `max_conns=N` | 0 | Max simultaneous connections (0 = unlimited) |
| `backup` | -- | Only receives requests when all primary servers are unavailable |
| `down` | -- | Permanently marks server as unavailable |

**Notes:**
- `backup` cannot be used with `hash`, `ip_hash`, or `random` methods
- If there is only a single server in a group, `max_fails`, `fail_timeout`, and `slow_start` are ignored and the server is never considered unavailable

## Upstream Keepalive

Maintain persistent connections to upstream servers to avoid TCP/TLS handshake overhead:

```nginx
upstream backend {
    server backend1.example.com;
    server backend2.example.com;

    keepalive 32;              # max idle connections per worker
    keepalive_requests 1000;   # max requests per connection
    keepalive_timeout 60s;     # idle connection timeout
}

server {
    location / {
        proxy_pass http://backend;
        proxy_http_version 1.1;          # required for keepalive
        proxy_set_header Connection "";  # clear "close" default
    }
}
```

**Important:** The `keepalive` directive limits **idle** connections, not total connections. When using non-default load balancing methods, activate them **before** the `keepalive` directive.

## Passive Health Checks

NGINX monitors transactions as they happen and temporarily stops sending requests to servers that fail:

```nginx
upstream backend {
    server backend1.example.com;
    server backend2.example.com max_fails=3 fail_timeout=30s;
}
```

If NGINX fails to send a request to a server or does not receive a response 3 times within 30 seconds, it marks the server as unavailable for the next 30 seconds. After that period, NGINX gradually probes with real client requests.

What counts as a failure is defined by `proxy_next_upstream`.

**Note:** Active health checks (periodic probing with `health_check` directive) require NGINX Plus.

## Proxy Next Upstream

Control when to retry with another server:

```nginx
proxy_next_upstream error timeout http_502 http_503 http_504;
proxy_next_upstream_timeout 10s;   # max time for retries (0 = unlimited)
proxy_next_upstream_tries 3;       # max retry attempts (0 = unlimited)
```

Values: `error`, `timeout`, `invalid_header`, `http_500`, `http_502`, `http_503`, `http_504`, `http_403`, `http_404`, `http_429`, `non_idempotent`, `off`

**Note:** Retries only work before anything has been sent to the client. `non_idempotent` must be explicitly set to retry POST/PATCH requests.

## WebSocket Proxying

Since the `Upgrade` header is hop-by-hop, it must be passed explicitly:

```nginx
http {
    map $http_upgrade $connection_upgrade {
        default upgrade;
        ''      close;
    }

    server {
        location /ws/ {
            proxy_pass http://websocket_backend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection $connection_upgrade;
            proxy_set_header Host $host;
            proxy_read_timeout 3600s;
            proxy_send_timeout 3600s;
        }
    }
}
```

The default 60s `proxy_read_timeout` will close idle WebSocket connections. Either increase the timeout or configure the backend to send periodic ping frames.

## FastCGI Proxying

```nginx
location ~ \.php$ {
    try_files $uri =404;
    fastcgi_pass unix:/var/run/php/php-fpm.sock;
    fastcgi_index index.php;
    fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
    include fastcgi_params;
    fastcgi_keep_conn on;   # required for FastCGI keepalive
}
```

## gRPC Proxying

```nginx
upstream grpc_backend {
    server backend1.example.com:50051;
    keepalive 32;
}

server {
    listen 443 ssl;
    http2 on;

    location / {
        grpc_pass grpc://grpc_backend;
        # For TLS to upstream: grpc_pass grpcs://grpc_backend;
    }
}
```

## Upstream Variables

| Variable | Description |
|---|---|
| `$upstream_addr` | IP:port of the upstream server(s) contacted |
| `$upstream_status` | HTTP status from upstream |
| `$upstream_response_time` | Time to receive full response (seconds with ms) |
| `$upstream_header_time` | Time to receive response header |
| `$upstream_connect_time` | Time to establish connection |
| `$upstream_cache_status` | Cache status: MISS, HIT, EXPIRED, STALE, etc. |
| `$upstream_bytes_received` | Bytes received from upstream |
| `$upstream_bytes_sent` | Bytes sent to upstream |
