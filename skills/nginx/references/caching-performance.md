# Caching & Performance Reference

## Table of Contents

- [Proxy Cache](#proxy-cache)
- [Cache Key](#cache-key)
- [Cache Validity](#cache-validity)
- [Cache Bypass and No-Cache](#cache-bypass-and-no-cache)
- [Stale Content](#stale-content)
- [Cache Status](#cache-status)
- [Cache Purging](#cache-purging)
- [Byte-Range Caching](#byte-range-caching)
- [Combined Cache Example](#combined-cache-example)
- [Gzip Compression](#gzip-compression)
- [Static Gzip Files](#static-gzip-files)
- [Decompression](#decompression)
- [Static Content Serving](#static-content-serving)
- [File I/O Optimization](#file-io-optimization)
- [Worker Tuning](#worker-tuning)
- [Keepalive Connections](#keepalive-connections)
- [Open File Cache](#open-file-cache)
- [Backlog Queue Tuning](#backlog-queue-tuning)

## Proxy Cache

### Enable Caching

Define a cache path in the `http` context, then activate it per server or location:

```nginx
http {
    proxy_cache_path /data/nginx/cache
        levels=1:2                  # subdirectory structure
        keys_zone=mycache:10m       # name:size for metadata (10MB ~ 80k keys)
        max_size=1g                 # max disk usage
        inactive=60m                # remove entries not accessed in 60 min
        use_temp_path=off;          # write directly to cache dir

    server {
        proxy_cache mycache;

        location / {
            proxy_pass http://backend;
        }
    }
}
```

**Note:** `keys_zone` size limits metadata, not cached data. Actual data is stored on disk, limited by `max_size`. The cache manager periodically evicts LRU entries when `max_size` is exceeded.

### Cache Processes

Two background processes manage the cache:
- **Cache manager:** periodically checks cache size, removes LRU data when exceeding `max_size`
- **Cache loader:** runs once at startup to load metadata into shared memory. Configure iterative loading for large caches:

```nginx
proxy_cache_path /data/nginx/cache keys_zone=mycache:10m
    loader_threshold=300    # iteration duration (ms)
    loader_files=200        # items per iteration
    loader_sleep=50;        # delay between iterations (ms)
```

## Cache Key

By default, NGINX uses the request string as the cache key. Customize it:

```nginx
proxy_cache_key "$scheme$request_method$host$request_uri";

# Include cookies for user-specific caching
proxy_cache_key "$host$request_uri$cookie_user";
```

## Cache Validity

Control how long cached responses are considered valid:

```nginx
proxy_cache_valid 200 302 10m;    # 200 and 302 responses: 10 minutes
proxy_cache_valid 404 1m;         # 404 responses: 1 minute
proxy_cache_valid any 5m;         # all other status codes: 5 minutes
```

Set minimum request count before caching:

```nginx
proxy_cache_min_uses 3;   # cache only after 3 identical requests
```

Cache additional HTTP methods:

```nginx
proxy_cache_methods GET HEAD POST;   # default: GET HEAD
```

## Cache Bypass and No-Cache

Skip the cache for specific requests:

```nginx
# Bypass: fetch from upstream even if cached
proxy_cache_bypass $cookie_nocache $arg_nocache$arg_comment;

# No-cache: don't store the response
proxy_no_cache $http_pragma $http_authorization;
```

If any parameter is non-empty and non-zero, the directive activates.

## Stale Content

Serve stale cached content when upstream errors occur:

```nginx
proxy_cache_use_stale error timeout updating
                      http_500 http_502 http_503 http_504;

# Update cache in the background while serving stale content
proxy_cache_background_update on;

# Prevent multiple requests from hitting upstream simultaneously
proxy_cache_lock on;
proxy_cache_lock_timeout 5s;
```

## Cache Status

Expose the cache status to clients for debugging:

```nginx
add_header X-Cache-Status $upstream_cache_status;
```

Values: `MISS`, `BYPASS`, `EXPIRED`, `STALE`, `UPDATING`, `REVALIDATED`, `HIT`

## Cache Purging

Remove specific cached content (core feature since recent versions, advanced purging in NGINX Plus):

```nginx
http {
    map $request_method $purge_method {
        PURGE 1;
        default 0;
    }

    server {
        location / {
            proxy_pass        http://backend;
            proxy_cache       mycache;
            proxy_cache_purge $purge_method;
        }
    }
}
```

Restrict purge access:

```nginx
geo $purge_allowed {
    default         0;
    10.0.0.1        1;
    192.168.0.0/24  1;
}

map $request_method $purge_method {
    PURGE   $purge_allowed;
    default 0;
}
```

Purge with:
```bash
curl -X PURGE "https://www.example.com/path/to/resource"
```

## Byte-Range Caching

Cache large files in slices for faster initial delivery (useful for video):

```nginx
location / {
    slice             1m;
    proxy_cache       cache;
    proxy_cache_key   $uri$is_args$args$slice_range;
    proxy_set_header  Range $slice_range;
    proxy_cache_valid 200 206 1h;
    proxy_pass        http://backend;
}
```

## Combined Cache Example

```nginx
http {
    proxy_cache_path /data/nginx/cache keys_zone=mycache:10m
                     loader_threshold=300 loader_files=200 max_size=200m;

    server {
        listen 8080;
        proxy_cache mycache;

        location / {
            proxy_pass http://backend1;
        }

        location /some/path {
            proxy_pass http://backend2;
            proxy_cache_valid any 1m;
            proxy_cache_min_uses 3;
            proxy_cache_bypass $cookie_nocache $arg_nocache$arg_comment;
        }
    }
}
```

## Gzip Compression

```nginx
server {
    gzip on;
    gzip_types      text/plain text/css text/javascript
                    application/javascript application/json
                    application/xml image/svg+xml;
    gzip_proxied    no-cache no-store private expired auth;
    gzip_min_length 1000;    # don't compress tiny responses (default: 20)
    gzip_comp_level 5;       # 1-9 (5 is a good balance)
    gzip_vary on;            # add Vary: Accept-Encoding header
}
```

**Notes:**
- `text/html` is always compressed -- don't include it in `gzip_types`
- NGINX won't double-compress already-compressed content from upstream
- For proxied requests, `gzip_proxied` controls when to compress based on response headers
- Be aware of BREACH attack when using compression with SSL for sensitive responses

`gzip_proxied` parameters:
- `expired` -- compress if Expires header disables caching
- `no-cache`, `no-store`, `private` -- compress based on Cache-Control value
- `no_last_modified` -- compress if no Last-Modified header
- `no_etag` -- compress if no ETag header
- `auth` -- compress if Authorization header present
- `any` -- compress all proxied responses

## Static Gzip Files

Serve pre-compressed `.gz` files instead of compressing at runtime:

```nginx
location / {
    gzip_static on;
}
```

For `/path/to/file`, NGINX looks for `/path/to/file.gz`. If found and client supports gzip, it serves the compressed version. Otherwise, the original file is served. This avoids runtime compression overhead.

**Note:** Requires `ngx_http_gzip_static_module` (may need `--with-http_gzip_static_module` for OSS builds).

## Decompression

Decompress gzipped responses for clients that don't support it:

```nginx
server {
    gzip on;
    gzip_min_length 1000;
    gunzip on;
}
```

**Note:** Requires `ngx_http_gunzip_module` (may need `--with-http_gunzip_module` for OSS builds).

## Static Content Serving

### root vs alias

```nginx
# root: appends URI to path
location /images/ {
    root /data;
    # /images/photo.jpg -> /data/images/photo.jpg
}

# alias: replaces matched location with path
location /images/ {
    alias /data/photos/;
    # /images/photo.jpg -> /data/photos/photo.jpg
}
```

### try_files

Check file existence in order, fallback to last parameter:

```nginx
# Serve file, then directory, then 404
location / {
    try_files $uri $uri/ $uri.html =404;
}

# SPA fallback
location / {
    try_files $uri $uri/ /index.html;
}

# Fallback to named location
location / {
    try_files $uri $uri/ @backend;
}

location @backend {
    proxy_pass http://backend.example.com;
}
```

### index

NGINX treats requests ending with `/` as directory requests and looks for index files:

```nginx
location / {
    index index.html index.htm index.php;
}
```

### autoindex

Generate directory listings:

```nginx
location /files/ {
    autoindex on;
}
```

## File I/O Optimization

```nginx
http {
    # Use kernel sendfile -- avoid copying to userspace buffer
    sendfile on;

    # Limit per-sendfile chunk to prevent one connection from monopolizing a worker
    sendfile_max_chunk 1m;

    # Optimize packet sending (send headers + file in one packet)
    # Only works with sendfile on
    tcp_nopush on;

    # Disable Nagle's algorithm -- send data immediately
    # Use for keepalive connections
    tcp_nodelay on;
}
```

## Worker Tuning

```nginx
# Auto-detect CPU cores
worker_processes auto;

events {
    # Max simultaneous connections per worker
    # Total connections = worker_processes x worker_connections
    worker_connections 1024;

    # Accept multiple connections at once
    multi_accept on;
}
```

## Keepalive Connections

### Client-Side

```nginx
http {
    keepalive_timeout 65s;         # how long to keep idle connections open
    keepalive_requests 1000;       # max requests per keepalive connection
}
```

### Upstream

See [proxy-upstream.md](proxy-upstream.md) for upstream keepalive configuration.

## Open File Cache

Cache file descriptors, sizes, and errors for frequently accessed files:

```nginx
http {
    open_file_cache max=1000 inactive=20s;
    open_file_cache_valid 30s;       # revalidate cached entries every 30s
    open_file_cache_min_uses 2;      # cache after 2 accesses
    open_file_cache_errors on;       # cache file-not-found errors too
}
```

## Backlog Queue Tuning

Under high load, tune the listen backlog:

1. Increase OS limit:
```bash
# Linux
sudo sysctl -w net.core.somaxconn=4096
# Persist in /etc/sysctl.conf:
# net.core.somaxconn = 4096
```

2. Match in NGINX:
```nginx
server {
    listen 80 backlog=4096;
}
```
