# Security Reference

## Table of Contents

- [Rate Limiting](#rate-limiting)
- [Connection Limiting](#connection-limiting)
- [Bandwidth Limiting](#bandwidth-limiting)
- [Access Control by IP](#access-control-by-ip)
- [HTTP Basic Authentication](#http-basic-authentication)
- [Subrequest Authentication](#subrequest-authentication)
- [Security Headers](#security-headers)
- [Hiding Server Information](#hiding-server-information)
- [Client Limits](#client-limits)
- [Denying Access to Hidden Files](#denying-access-to-hidden-files)
- [HTTP Method Restriction](#http-method-restriction)

## Rate Limiting

Based on the leaky bucket algorithm. Requests arrive at various rates and leave at a fixed rate.

### Define the Zone

Set the key, shared memory zone, and rate in the `http` context:

```nginx
http {
    # 10MB zone, keyed by client IP, 1 request/second
    limit_req_zone $binary_remote_addr zone=one:10m rate=1r/s;
}
```

- **Key:** `$binary_remote_addr` is preferred over `$remote_addr` (4 bytes IPv4 / 16 bytes IPv6 vs variable-length string). One megabyte stores about 16,000 states on 64-bit platforms.
- **Rate:** `r/s` (requests per second) or `r/m` (requests per minute). Example: `30r/m` = 0.5 requests/second.
- If zone storage is exhausted, the oldest entry is removed. If still insufficient, a `503` (or custom status) is returned.

### Apply the Limit

```nginx
server {
    location /search/ {
        limit_req zone=one;
    }
}
```

This allows no more than 1 request/second. Excess requests get `503` when the zone is full.

### Burst Handling

Buffer excess requests instead of immediately rejecting:

```nginx
location /search/ {
    limit_req zone=one burst=5;
}
```

Allows bursts of up to 5 excess requests, processed at the defined rate. Beyond burst limit: `503`.

### No-Delay Burst

Process burst requests immediately without artificial delay:

```nginx
location /search/ {
    limit_req zone=one burst=5 nodelay;
}
```

### Delayed Burst (Hybrid)

Serve some requests immediately, then apply rate limiting:

```nginx
location /search/ {
    limit_req zone=one burst=5 delay=3;
}
```

First 3 requests (`delay`) pass without delay. Next 2 (`burst - delay`) are rate-limited. Beyond burst: rejected.

### Custom Status Code

```nginx
limit_req_status 429;   # default: 503
```

### Dry Run Mode

Test rate limits without actually limiting:

```nginx
location /search/ {
    limit_req zone=one;
    limit_req_dry_run on;
}
```

Excess requests are logged with "dry run" but not rejected. Check with `$limit_req_status` variable (`PASSED`, `DELAYED`, `REJECTED`, `DELAYED_DRY_RUN`, `REJECTED_DRY_RUN`).

### Multiple Rate Limits

Apply multiple zones simultaneously:

```nginx
http {
    limit_req_zone $binary_remote_addr zone=perip:10m rate=1r/s;
    limit_req_zone $server_name zone=perserver:10m rate=10r/s;

    server {
        limit_req zone=perip burst=5 nodelay;
        limit_req zone=perserver burst=10;
    }
}
```

## Connection Limiting

Limit simultaneous connections per key:

```nginx
http {
    limit_conn_zone $binary_remote_addr zone=addr:10m;

    server {
        # Max 5 connections per client IP
        limit_conn addr 5;

        location /download/ {
            limit_conn addr 1;   # 1 connection for downloads
        }
    }
}
```

Per-server connection limiting:

```nginx
http {
    limit_conn_zone $server_name zone=servers:10m;

    server {
        limit_conn servers 1000;
    }
}
```

## Bandwidth Limiting

Limit download speed per connection:

```nginx
location /download/ {
    limit_conn addr 1;            # 1 connection per IP
    limit_rate 50k;               # 50 KB/s per connection
}
```

Allow full speed for initial portion, then throttle:

```nginx
location /download/ {
    limit_rate_after 1m;          # full speed for first 1MB
    limit_rate 50k;               # then 50 KB/s
}
```

Dynamic bandwidth based on variables:

```nginx
map $ssl_protocol $response_rate {
    "TLSv1.1" 10k;
    "TLSv1.2" 100k;
    "TLSv1.3" 1000k;
}

server {
    location / {
        limit_rate       $response_rate;
        limit_rate_after 512;
        proxy_pass       http://backend;
    }
}
```

## Access Control by IP

```nginx
# Allow specific networks, deny all others
location /admin/ {
    allow 192.168.1.0/24;
    allow 10.0.0.0/8;
    deny all;
}

# Deny specific IPs, allow all others
location / {
    deny 192.168.1.100;
    allow all;
}
```

Rules are evaluated in order -- first match wins.

## HTTP Basic Authentication

```nginx
location /admin/ {
    auth_basic           "Administrator Login";
    auth_basic_user_file /etc/nginx/.htpasswd;
}
```

Create the password file:

```bash
# Using apache2-utils
htpasswd -c /etc/nginx/.htpasswd admin

# Or using openssl
echo "admin:$(openssl passwd -apr1 'password')" > /etc/nginx/.htpasswd
```

Combine with IP restriction for defense in depth:

```nginx
location /admin/ {
    satisfy all;    # require BOTH auth and IP (use "any" for either)

    allow 192.168.1.0/24;
    deny all;

    auth_basic           "Admin";
    auth_basic_user_file /etc/nginx/.htpasswd;
}
```

## Subrequest Authentication

Delegate authentication to an external service via `auth_request` (requires `--with-http_auth_request_module` for OSS):

```nginx
location /private/ {
    auth_request /auth;
    auth_request_set $auth_status $upstream_status;
}

location = /auth {
    internal;
    proxy_pass http://auth-server/validate;
    proxy_pass_request_body off;
    proxy_set_header Content-Length "";
    proxy_set_header X-Original-URI $request_uri;
}
```

The auth subrequest returns 2xx to allow, 401/403 to deny.

## Security Headers

```nginx
server {
    # Prevent clickjacking
    add_header X-Frame-Options "SAMEORIGIN" always;

    # Prevent MIME type sniffing
    add_header X-Content-Type-Options "nosniff" always;

    # Referrer policy
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Content Security Policy
    add_header Content-Security-Policy "default-src 'self'" always;

    # HTTP Strict Transport Security
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;

    # Permissions Policy
    add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;
}
```

**Note:** `X-XSS-Protection` is deprecated in modern browsers. Use `Content-Security-Policy` instead.

**Important:** The `always` parameter ensures headers are added for all response codes (including errors). Without it, headers are only added for 200, 201, 204, 206, 301, 302, 303, 304, 307, or 308 responses.

## Hiding Server Information

```nginx
# Hide nginx version from response headers and error pages
server_tokens off;

# Hide upstream headers from clients
proxy_hide_header X-Powered-By;
proxy_hide_header Server;
```

## Client Limits

```nginx
# Max request body size (for file uploads)
# Returns 413 "Request Entity Too Large" if exceeded
client_max_body_size 10m;        # default: 1m

# Timeouts for reading client request
client_header_timeout 60s;       # time to read request header
client_body_timeout 60s;         # time between successive reads of body

# Buffer limits (mitigate large header attacks)
client_header_buffer_size 1k;           # buffer for reading request header
large_client_header_buffers 4 8k;       # max number and size of large headers
```

## Denying Access to Hidden Files

Block access to dotfiles (`.git`, `.env`, `.htpasswd`, etc.):

```nginx
location ~ /\. {
    deny all;
    access_log off;
    log_not_found off;
}

# Exception for Let's Encrypt validation
location ~ /\.well-known/ {
    allow all;
}
```

## HTTP Method Restriction

Limit allowed HTTP methods:

```nginx
location /api/ {
    limit_except GET POST {
        deny all;
    }
}
```

Or using `if` for a simple case:

```nginx
# Block all except GET, HEAD, POST
if ($request_method !~ ^(GET|HEAD|POST)$) {
    return 405;
}
```
