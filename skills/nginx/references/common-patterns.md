# Common Configuration Patterns

## Table of Contents

- [Config File Management](#config-file-management)
- [Virtual Server Selection](#virtual-server-selection)
- [SPA with API Backend](#spa-with-api-backend)
- [API Gateway / Microservices](#api-gateway--microservices)
- [PHP with FastCGI](#php-with-fastcgi)
- [Django / uWSGI Application Gateway](#django--uwsgi-application-gateway)
- [HTTP to HTTPS Redirect](#http-to-https-redirect)
- [www to non-www Redirect](#www-to-non-www-redirect)
- [URI Rewriting](#uri-rewriting)
- [Error Pages](#error-pages)
- [Map Directive](#map-directive)
- [Logging](#logging)
- [Conditional Logging](#conditional-logging)
- [Multiple Domains on One Server](#multiple-domains-on-one-server)
- [Include Patterns](#include-patterns)
- [Full Production Template](#full-production-template)

## Config File Management

NGINX configuration typically uses a main file with includes:

```
/etc/nginx/
├── nginx.conf              # main config
├── conf.d/                 # additional HTTP server configs
│   ├── default.conf
│   └── example.com.conf
├── snippets/               # reusable config fragments
│   ├── ssl-params.conf
│   └── proxy-headers.conf
├── sites-available/        # Debian/Ubuntu style
├── sites-enabled/          # symlinks to sites-available
└── mime.types
```

Use `include` to organize configuration:

```nginx
http {
    include /etc/nginx/mime.types;
    include /etc/nginx/conf.d/*.conf;
    include /etc/nginx/snippets/ssl-params.conf;
}
```

Feature-specific config files are recommended: one file per domain, shared snippets for SSL, proxy headers, etc.

## Virtual Server Selection

When multiple `server` blocks match a request, NGINX selects by:

1. Match `listen` IP:port
2. Match `server_name` against the `Host` header:
   - Exact name (highest priority)
   - Longest wildcard starting with `*` (e.g., `*.example.org`)
   - Longest wildcard ending with `*` (e.g., `mail.*`)
   - First matching regex (in config order)
3. If no `server_name` matches, use the `default_server` for that port

```nginx
# Explicit default server
server {
    listen 80 default_server;
    server_name _;
    return 444;    # close connection without response
}

# Specific domain
server {
    listen 80;
    server_name example.com www.example.com;
    root /var/www/example;
}
```

## SPA with API Backend

```nginx
server {
    listen 80;
    server_name example.com;
    root /var/www/app/dist;

    # API requests -> backend
    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Static assets with long cache
    location ~* \.(js|css|png|jpg|gif|ico|svg|woff2?)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files $uri =404;
    }

    # SPA catch-all -> index.html
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

## API Gateway / Microservices

```nginx
upstream auth_service {
    server auth:3001;
    keepalive 16;
}

upstream user_service {
    server user:3002;
    keepalive 16;
}

upstream order_service {
    server order:3003;
    keepalive 16;
}

server {
    listen 443 ssl;
    server_name api.example.com;

    ssl_certificate     /etc/nginx/ssl/api.example.com.crt;
    ssl_certificate_key /etc/nginx/ssl/api.example.com.key;
    ssl_protocols       TLSv1.2 TLSv1.3;

    # Common proxy settings
    proxy_http_version 1.1;
    proxy_set_header Connection "";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;

    location /auth/ {
        proxy_pass http://auth_service/;
    }

    location /users/ {
        proxy_pass http://user_service/;
    }

    location /orders/ {
        proxy_pass http://order_service/;
    }
}
```

## PHP with FastCGI

```nginx
server {
    listen 80;
    server_name example.com;
    root /var/www/html;
    index index.php index.html;

    location / {
        try_files $uri $uri/ /index.php$is_args$args;
    }

    location ~ \.php$ {
        try_files $uri =404;
        fastcgi_pass unix:/var/run/php/php-fpm.sock;
        fastcgi_index index.php;
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
        include fastcgi_params;
    }

    # Deny access to .ht* files
    location ~ /\.ht {
        deny all;
    }
}
```

## Django / uWSGI Application Gateway

```nginx
server {
    listen 80;
    server_name example.com;

    location / {
        include uwsgi_params;
        uwsgi_pass unix:/run/uwsgi/app.sock;
    }

    location /static/ {
        alias /var/www/app/static/;
        expires 30d;
    }

    location /media/ {
        alias /var/www/app/media/;
        expires 30d;
    }
}
```

## HTTP to HTTPS Redirect

```nginx
server {
    listen 80;
    server_name example.com www.example.com;
    return 301 https://$host$request_uri;
}
```

## www to non-www Redirect

```nginx
server {
    listen 80;
    listen 443 ssl;
    server_name www.example.com;

    ssl_certificate     /etc/nginx/ssl/example.com.crt;
    ssl_certificate_key /etc/nginx/ssl/example.com.key;

    return 301 https://example.com$request_uri;
}
```

## URI Rewriting

### return vs rewrite

Use `return` for simple redirects (more efficient):

```nginx
location /old-page {
    return 301 /new-page;
}
```

Use `rewrite` for pattern-based transformations:

```nginx
# Regex capture and redirect
rewrite ^/users/(.*)$ /show?user=$1 break;

# Multiple rewrites with flags
server {
    rewrite ^(/download/.*)/media/(\w+)\.?.*$ $1/mp3/$2.mp3 last;
    rewrite ^(/download/.*)/audio/(\w+)\.?.*$ $1/mp3/$2.ra  last;
    return 403;
}
```

Flags:
- `last` -- stop rewrite directives in current context, restart location matching
- `break` -- stop rewrite directives and cancel location search
- `redirect` -- temporary redirect (302)
- `permanent` -- permanent redirect (301)

## Error Pages

```nginx
# Custom error page
error_page 404 /404.html;
error_page 500 502 503 504 /50x.html;

location = /50x.html {
    root /usr/share/nginx/html;
    internal;
}

# Redirect on error
error_page 404 =301 http://example.com/new/path.html;

# Fallback to backend if file not found
location /images/ {
    root /data/www;
    error_page 404 = /fetch$uri;
}

location /fetch/ {
    internal;
    proxy_pass http://backend/;
}
```

## Map Directive

Create variables based on other variables (evaluated lazily at use time):

```nginx
http {
    # Set backend based on URI prefix
    map $uri $backend {
        ~^/api/v1  http://api_v1;
        ~^/api/v2  http://api_v2;
        default    http://api_v1;
    }

    # Block user agents
    map $http_user_agent $bad_bot {
        default      0;
        ~*scrapy     1;
        ~*curl       1;
    }

    # Set connection upgrade for WebSocket
    map $http_upgrade $connection_upgrade {
        default upgrade;
        ''      close;
    }
}
```

## Logging

### Custom Log Format

```nginx
http {
    log_format main '$remote_addr - $remote_user [$time_local] '
                    '"$request" $status $body_bytes_sent '
                    '"$http_referer" "$http_user_agent" '
                    '$request_time $upstream_response_time';

    # JSON format
    log_format json escape=json '{'
        '"time":"$time_iso8601",'
        '"remote_addr":"$remote_addr",'
        '"request":"$request",'
        '"status":$status,'
        '"body_bytes_sent":$body_bytes_sent,'
        '"request_time":$request_time,'
        '"upstream_response_time":"$upstream_response_time",'
        '"http_user_agent":"$http_user_agent"'
    '}';

    access_log /var/log/nginx/access.log main;
    error_log  /var/log/nginx/error.log warn;
}
```

### Error Log Levels

From least to most verbose: `emerg`, `alert`, `crit`, `error`, `warn`, `notice`, `info`, `debug`.

Debug logging requires NGINX compiled with `--with-debug`.

### Syslog

```nginx
access_log syslog:server=192.168.1.1,facility=local7,tag=nginx,severity=info main;
error_log  syslog:server=192.168.1.1 warn;
```

## Conditional Logging

```nginx
# Only log errors (status >= 400)
map $status $loggable {
    ~^[23] 0;
    default 1;
}

access_log /var/log/nginx/access.log main if=$loggable;
```

Disable logging for specific locations:

```nginx
location /health {
    access_log off;
    return 200 "OK";
}

location ~* \.(js|css|png|jpg|gif|ico)$ {
    access_log off;
}
```

## Multiple Domains on One Server

```nginx
server {
    listen 80;
    server_name site1.example.com;
    root /var/www/site1;
}

server {
    listen 80;
    server_name site2.example.com;
    root /var/www/site2;
}
```

## Include Patterns

### Reusable Snippets

```nginx
# /etc/nginx/snippets/proxy-headers.conf
proxy_set_header Host $host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
```

```nginx
# /etc/nginx/snippets/ssl-params.conf
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers HIGH:!aNULL:!MD5;
ssl_prefer_server_ciphers off;
ssl_session_cache shared:SSL:10m;
ssl_session_timeout 10m;
ssl_stapling on;
ssl_stapling_verify on;
```

Use in server blocks:

```nginx
server {
    listen 443 ssl;
    include snippets/ssl-params.conf;
    include snippets/proxy-headers.conf;
}
```

## Full Production Template

```nginx
worker_processes auto;

events {
    worker_connections 1024;
    multi_accept on;
}

http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;

    # Logging
    log_format main '$remote_addr - $remote_user [$time_local] '
                    '"$request" $status $body_bytes_sent '
                    '"$http_referer" "$http_user_agent" '
                    '$request_time $upstream_response_time';
    access_log /var/log/nginx/access.log main;
    error_log  /var/log/nginx/error.log warn;

    # Performance
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    keepalive_requests 1000;

    # Security
    server_tokens off;

    # Gzip
    gzip on;
    gzip_comp_level 5;
    gzip_min_length 256;
    gzip_vary on;
    gzip_proxied any;
    gzip_types text/plain text/css text/javascript
               application/javascript application/json
               application/xml image/svg+xml;

    # SSL defaults (inherited by all servers)
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    ssl_stapling on;
    ssl_stapling_verify on;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=general:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=login:10m rate=1r/s;

    # Upstream
    upstream backend {
        server 127.0.0.1:3000;
        keepalive 32;
    }

    # Redirect HTTP -> HTTPS
    server {
        listen 80 default_server;
        server_name _;
        return 301 https://$host$request_uri;
    }

    # Main server
    server {
        listen 443 ssl;
        http2 on;
        server_name example.com;
        root /var/www/app/dist;

        ssl_certificate     /etc/nginx/ssl/example.com.crt;
        ssl_certificate_key /etc/nginx/ssl/example.com.key;
        ssl_trusted_certificate /etc/nginx/ssl/chain.pem;
        resolver 8.8.8.8 8.8.4.4 valid=300s;

        # Security headers
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header Referrer-Policy "strict-origin-when-cross-origin" always;
        add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;

        # Client limits
        client_max_body_size 10m;

        # Block hidden files
        location ~ /\. {
            deny all;
            access_log off;
            log_not_found off;
        }

        # Health check
        location /health {
            access_log off;
            return 200 "OK";
        }

        # API proxy
        location /api/ {
            limit_req zone=general burst=20 nodelay;
            proxy_pass http://backend;
            proxy_http_version 1.1;
            proxy_set_header Connection "";
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # Login rate limit
        location /api/auth/login {
            limit_req zone=login burst=5;
            limit_req_status 429;
            proxy_pass http://backend;
            proxy_http_version 1.1;
            proxy_set_header Connection "";
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # Static assets
        location ~* \.(js|css|png|jpg|gif|ico|svg|woff2?)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
            access_log off;
        }

        # SPA fallback
        location / {
            try_files $uri $uri/ /index.html;
        }
    }
}
```
