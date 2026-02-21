# SSL/TLS Reference

## Table of Contents

- [Setting Up an HTTPS Server](#setting-up-an-https-server)
- [SSL Protocols and Ciphers](#ssl-protocols-and-ciphers)
- [HTTPS Server Optimization](#https-server-optimization)
- [SSL Certificate Chains](#ssl-certificate-chains)
- [Single HTTP/HTTPS Server](#single-httphttps-server)
- [Name-Based HTTPS Servers](#name-based-https-servers)
- [Server Name Indication (SNI)](#server-name-indication-sni)
- [OCSP Stapling](#ocsp-stapling)
- [OCSP Validation of Client Certificates](#ocsp-validation-of-client-certificates)
- [SSL to Upstream Servers](#ssl-to-upstream-servers)
- [HTTP/2 and HTTP/3](#http2-and-http3)
- [HTTP to HTTPS Redirect](#http-to-https-redirect)
- [Key Directives Reference](#key-directives-reference)

## Setting Up an HTTPS Server

Enable the `ssl` parameter on the `listen` directive and specify the certificate and private key:

```nginx
server {
    listen              443 ssl;
    server_name         www.example.com;
    ssl_certificate     www.example.com.crt;
    ssl_certificate_key www.example.com.key;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;
}
```

The server certificate is public and sent to every client. The private key must be stored with restricted access but must be readable by the nginx master process. The private key can be stored in the same file as the certificate -- only the certificate portion is sent to clients.

## SSL Protocols and Ciphers

Since version 1.23.4, NGINX defaults to:

```nginx
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers   HIGH:!aNULL:!MD5;
```

These defaults are secure for modern deployments. Avoid SSLv3 (POODLE attack) and CBC-mode ciphers (BEAST attack). Do not enable TLSv1.0 or TLSv1.1 unless you need to support legacy clients.

**Historical defaults:**
- 1.27.3+: TLSv1.2 and TLSv1.3
- 1.23.4+: TLSv1, TLSv1.1, TLSv1.2, TLSv1.3
- 1.9.1+: TLSv1, TLSv1.1, TLSv1.2
- Pre-0.8.19: SSLv2, SSLv3, TLSv1

## HTTPS Server Optimization

SSL handshakes are the most CPU-intensive SSL operation. Minimize them with:

1. **Keepalive connections** -- send multiple requests over one connection
2. **SSL session reuse** -- avoid handshakes for parallel and subsequent connections

```nginx
worker_processes auto;

http {
    ssl_session_cache   shared:SSL:10m;   # ~4000 sessions per MB
    ssl_session_timeout 10m;              # default: 5m

    server {
        listen              443 ssl;
        server_name         www.example.com;
        keepalive_timeout   70;

        ssl_certificate     www.example.com.crt;
        ssl_certificate_key www.example.com.key;
        ssl_protocols       TLSv1.2 TLSv1.3;
        ssl_ciphers         HIGH:!aNULL:!MD5;
    }
}
```

Session cache types:
- `off` -- strictly prohibit session reuse
- `none` -- gently disallow (tell client reuse is OK but don't actually cache)
- `builtin[:size]` -- per-worker OpenSSL cache (can cause fragmentation)
- `shared:name:size` -- shared across all workers (recommended)

Both `builtin` and `shared` can be used together, but `shared` alone is more efficient.

## SSL Certificate Chains

If the issuing CA used an intermediate certificate, concatenate them (server cert first):

```bash
cat www.example.com.crt bundle.crt > www.example.com.chained.crt
```

```nginx
server {
    listen              443 ssl;
    server_name         www.example.com;
    ssl_certificate     www.example.com.chained.crt;
    ssl_certificate_key www.example.com.key;
}
```

If concatenated in the wrong order, NGINX fails with:
```
SSL_CTX_use_PrivateKey_file(" ... /www.example.com.key") failed
   (SSL: error:0B080074:x509 certificate routines:X509_check_private_key:key values mismatch)
```

Verify the chain with:
```bash
openssl s_client -connect www.example.com:443
```

## Single HTTP/HTTPS Server

Handle both HTTP and HTTPS on one virtual server:

```nginx
server {
    listen              80;
    listen              443 ssl;
    server_name         www.example.com;
    ssl_certificate     www.example.com.crt;
    ssl_certificate_key www.example.com.key;
}
```

## Name-Based HTTPS Servers

SSL is established before the HTTP Host header is available, so by default only the default server's certificate is offered. Solutions:

**Separate IP addresses (most compatible):**
```nginx
server {
    listen          192.168.1.1:443 ssl;
    server_name     www.example.com;
    ssl_certificate www.example.com.crt;
    ssl_certificate_key www.example.com.key;
}

server {
    listen          192.168.1.2:443 ssl;
    server_name     www.example.org;
    ssl_certificate www.example.org.crt;
    ssl_certificate_key www.example.org.key;
}
```

**Multi-name certificate (SAN or wildcard):**
```nginx
ssl_certificate     common.crt;
ssl_certificate_key common.key;

server {
    listen          443 ssl;
    server_name     www.example.com;
}

server {
    listen          443 ssl;
    server_name     www.example.org;
}
```

Place shared cert/key at the `http` level for a single memory copy across all servers.

**Server Name Indication (SNI):** see below.

## Server Name Indication (SNI)

SNI (RFC 6066) allows the browser to pass the requested server name during the SSL handshake, enabling NGINX to select the correct certificate.

Supported by all modern browsers. Requires OpenSSL with SNI support:
```bash
nginx -V
# Look for: TLS SNI support enabled
```

Since version 1.11.0, NGINX supports multiple `ssl_certificate` directives per server for different key types (RSA, ECDSA):

```nginx
server {
    listen              443 ssl;
    server_name         example.com;

    ssl_certificate     example.com.rsa.crt;
    ssl_certificate_key example.com.rsa.key;

    ssl_certificate     example.com.ecdsa.crt;
    ssl_certificate_key example.com.ecdsa.key;
}
```

## OCSP Stapling

OCSP stapling lets the server provide a cached OCSP response during the TLS handshake, avoiding the client's need to contact the CA:

```nginx
server {
    listen 443 ssl;

    ssl_certificate     /etc/nginx/ssl/example.com.crt;
    ssl_certificate_key /etc/nginx/ssl/example.com.key;

    ssl_stapling on;
    ssl_stapling_verify on;
    ssl_trusted_certificate /etc/nginx/ssl/chain.pem;
    resolver 8.8.8.8 8.8.4.4 valid=300s;
    resolver_timeout 5s;
}
```

The `ssl_trusted_certificate` must include the issuer's certificate. A `resolver` is required for OCSP responder hostname resolution.

## OCSP Validation of Client Certificates

Validate client certificate revocation status via OCSP:

```nginx
server {
    listen 443 ssl;

    ssl_certificate     /etc/ssl/server.crt;
    ssl_certificate_key /etc/ssl/server.key;

    ssl_verify_client       on;
    ssl_trusted_certificate /etc/ssl/cachain.pem;
    ssl_ocsp                on;

    # Optional: override the OCSP responder URI
    ssl_ocsp_responder http://ocsp.example.com/;

    # Cache OCSP responses (shared across workers)
    ssl_ocsp_cache shared:one:10m;
}
```

The result is available in `$ssl_client_verify` (values: `SUCCESS`, `FAILED:reason`, `NONE`).

## SSL to Upstream Servers

Encrypt traffic between NGINX and upstream backends:

```nginx
server {
    location / {
        proxy_pass https://backend;
        proxy_ssl_protocols     TLSv1.2 TLSv1.3;
        proxy_ssl_ciphers       HIGH:!aNULL:!MD5;
        proxy_ssl_session_reuse on;

        # Verify upstream certificate
        proxy_ssl_verify       on;
        proxy_ssl_trusted_certificate /etc/nginx/ssl/backend-ca.pem;

        # Present client certificate to upstream
        proxy_ssl_certificate     /etc/nginx/ssl/proxy.crt;
        proxy_ssl_certificate_key /etc/nginx/ssl/proxy.key;
    }
}
```

## HTTP/2 and HTTP/3

```nginx
server {
    listen 443 ssl;
    listen 443 quic;        # HTTP/3 (QUIC)
    http2 on;               # HTTP/2

    ssl_certificate     /etc/nginx/ssl/example.com.crt;
    ssl_certificate_key /etc/nginx/ssl/example.com.key;

    # Advertise HTTP/3 support
    add_header Alt-Svc 'h3=":443"; ma=86400';
}
```

**Note:** The `http2` directive replaced the `listen ... http2` parameter since NGINX 1.25.1.

## HTTP to HTTPS Redirect

```nginx
server {
    listen 80;
    server_name example.com www.example.com;
    return 301 https://$host$request_uri;
}
```

Combine with HSTS to prevent future HTTP requests:

```nginx
add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
```

## Key Directives Reference

| Directive | Default | Context | Description |
|---|---|---|---|
| `ssl_certificate` | -- | http, server | Path to PEM certificate file |
| `ssl_certificate_key` | -- | http, server | Path to PEM private key file |
| `ssl_protocols` | TLSv1.2 TLSv1.3 | http, server | Enabled protocols |
| `ssl_ciphers` | HIGH:!aNULL:!MD5 | http, server | Enabled cipher suites |
| `ssl_prefer_server_ciphers` | off | http, server | Prefer server cipher order |
| `ssl_session_cache` | none | http, server | Session cache type and size |
| `ssl_session_timeout` | 5m | http, server | Time a client can reuse session params |
| `ssl_session_tickets` | on | http, server | Enable TLS session tickets |
| `ssl_stapling` | off | http, server | Enable OCSP stapling |
| `ssl_stapling_verify` | off | http, server | Verify OCSP responses |
| `ssl_trusted_certificate` | -- | http, server | Trusted CA certs for client verification and OCSP |
| `ssl_verify_client` | off | http, server | Require client certificate |
| `ssl_verify_depth` | 1 | http, server | Client cert chain verification depth |
| `ssl_buffer_size` | 16k | http, server | Buffer for sending data (smaller = faster TTFB) |
| `ssl_early_data` | off | http, server | TLS 1.3 0-RTT early data (replay risk) |

## SSL Variables

| Variable | Description |
|---|---|
| `$ssl_protocol` | Protocol of the SSL connection (e.g., TLSv1.3) |
| `$ssl_cipher` | Cipher used for the connection |
| `$ssl_server_name` | Server name requested through SNI |
| `$ssl_session_id` | Session identifier |
| `$ssl_session_reused` | `r` if reused, `.` otherwise |
| `$ssl_client_verify` | Client cert result: SUCCESS, FAILED:reason, NONE |
| `$ssl_client_s_dn` | Subject DN of client certificate |
| `$ssl_client_i_dn` | Issuer DN of client certificate |
| `$ssl_client_serial` | Serial number of client certificate |
| `$ssl_early_data` | `1` if TLS 1.3 early data is being used |
