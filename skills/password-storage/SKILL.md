---
name: password-storage
description: Store and verify user passwords so a leaked database resists offline cracking. Use when implementing signup or login with passwords, choosing or tuning a password hash (Argon2id, scrypt, bcrypt, PBKDF2), adding a pepper, or migrating legacy MD5/SHA hashes.
---

# Password Storage

Assume the database will leak. The goal is to make offline guessing against each stored hash slow and expensive enough that strong passwords stay unrecovered, while login stays fast enough for real traffic. Work the steps in order.

## Why each layer exists

| Layer                          | Attacker advantage it removes                                                                 |
| ------------------------------ | --------------------------------------------------------------------------------------------- |
| Hash instead of plaintext      | Reading passwords directly (SQL injection, backup leak) and reusing them on other sites.       |
| Per-user random salt           | Precomputed tables, and cracking every user with the same password at once.                    |
| Slow, tunable password hash    | Fast hashes (MD5, SHA-1, SHA-256) run billions of guesses per second on commodity hardware.    |
| Memory-hard hash (Argon2id)    | GPU and ASIC parallelism: each guess needs megabytes of RAM, capping concurrent guesses.       |
| Pepper (secret outside the DB) | A database-only dump becomes uncrackable without also compromising the app's secrets.          |

None of these save a password that appears in leaked wordlists: it falls within the first few thousand guesses even against a slow hash. That is why step 5 exists.

## Steps

### 1. Choose the algorithm

Pick the first that your platform supports in a maintained library:

1. **Argon2id**, minimum one of: m=19 MiB, t=2, p=1 · m=46 MiB, t=1, p=1 · m=12 MiB, t=3, p=1 (equal strength, trading RAM for CPU).
2. **scrypt**: N=2¹⁷ (128 MiB), r=8, p=1, or an equivalent lower-memory setting.
3. **bcrypt** (legacy stacks): cost ≥ 10. Input is truncated at 72 bytes, so enforce a 72-byte maximum password length. Pre-hashing to get around the limit risks null-byte truncation and password shucking.
4. **PBKDF2** (when FIPS-140 is required): HMAC-SHA-256 with ≥ 600,000 iterations.

Benchmark on production hardware and raise the parameters as far as login latency and concurrency allow. Memory-hard hashing on the login path is also a capacity cost: a login burst reserves `memory × concurrent logins`, so rate-limit the endpoint so it can't become a denial-of-service lever.

**Done when** the algorithm and parameters are written down with the benchmark that justifies them.

### 2. Use the library's encoded format

Call the library's hash and verify functions; never hand-roll the construction or the comparison. The encoded string carries everything needed to verify, for example `$argon2id$v=19$m=19456,t=2,p=1$<salt>$<hash>`: algorithm, version, parameters, salt, hash. None of it is secret. Store the whole string in one column. The library generates the salt (16+ random bytes per hash) and compares in constant time.

Accept the full Unicode range in passwords, with no forced character-class rules and no truncation beyond the algorithm's limit.

**Done when** signup stores the library's encoded string and login calls the library's verify.

### 3. Add a pepper (defense in depth)

A pepper is one secret shared by all hashes, stored outside the database in a secrets manager or HSM, never next to the hashes.

- Apply it through the library's secret/key parameter where it exists (Argon2 has one), or feed `base64(HMAC-SHA-256(pepper, password))` into the password hash. Base64 avoids bcrypt's null-byte truncation and stays under its 72-byte limit; plain string concatenation does neither.
- A pepper can't be rotated without the plaintext: a leaked pepper forces password resets for every user under it. Record a pepper version with each hash so a new pepper applies to new hashes while old ones are reset.

**Done when** the pepper lives in the secrets store, the hash records which pepper version it used, and the rotation procedure is written down.

### 4. Rehash and migrate

- **On every successful login**, check whether the stored hash uses outdated parameters or algorithm (libraries expose `needs_rehash`). If so, rehash the just-verified password and save it.
- **Legacy fast hashes** (MD5, SHA-1, unsalted): wrap them right away, `argon2id(md5_hash)`, so no fast hash stays at rest, then replace the wrapped value with a direct hash at each user's next login. Expire users who never return and send them through password reset.

**Done when** no stored hash is computable at fast-hash speed, and parameter upgrades happen automatically at login.

### 5. Surround the hash

- Check new passwords against breached-password lists (k-anonymity range APIs such as Have I Been Pwned's) and reject matches. Require a minimum length (8+, 15+ for passwords used without MFA) instead of composition rules.
- Rate-limit and throttle login attempts per account and per IP, which also caps online guessing.
- Offer or require MFA. Use generic error messages that don't reveal whether the account exists.
- Keep passwords out of logs, error reports, and analytics payloads.

**Done when** every item above is in place or explicitly deferred with a reason.
