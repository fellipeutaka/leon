# Error Handling in Rust

Proper error handling is critical for building reliable, idiomatic Rust applications.

## Core Principles

- **Never Panic**: Do not use `unwrap()` or `expect()` in production code. Always return `Result<T, E>`.
- **Propagate Errors**: Use the `?` operator to bubble errors up to the caller cleanly.
- **Provide Context**: Use libraries like `anyhow` or `thiserror` to add meaningful context to errors.
- **Don't Swallow Errors**: If you map an error or ignore it, document why it's safe to do so.

## Libraries & Modules: `thiserror`

For libraries, internal modules, or explicit API boundaries where the caller might need to match on the error type, use `thiserror`. It allows you to define structured, typed errors with custom `Display` formats and `From` trait implementations.

```rust
use thiserror::Error;
use std::io;

#[derive(Error, Debug)]
pub enum AppError {
    #[error("Failed to read configuration: {0}")]
    Config(#[from] io::Error),
    #[error("Invalid input: {0}")]
    Validation(String),
    #[error("Network request failed: {0}")]
    Network(#[from] reqwest::Error),
}
```

## Binaries & Entry Points: `anyhow`

For application binaries (`main.rs`), CLI tools, or generic wrappers where error types don't need to be introspected programmatically, use `anyhow`. It provides rich context and backtraces.

```rust
use anyhow::{Context, Result};
use std::fs;

fn read_config(path: &str) -> Result<String> {
    fs::read_to_string(path)
        .with_context(|| format!("Failed to read config file from {}", path))
}
```

## Error Mapping & Conversions

- When converting errors within a library, use `Result::map_err`.
- When dealing with async closures or stream processing, map errors cleanly without losing context.
- Use `#[from]` inside `thiserror` enums to automatically derive `From<T> for AppError`, enabling the `?` operator to work implicitly.

### Common Patterns

```rust
// Converting generic errors to specific ones
fn parse_number(input: &str) -> Result<u32, AppError> {
    input
        .parse::<u32>()
        .map_err(|e| AppError::Validation(format!("Not a number: {}", e)))
}
```

## Fallible Operations

- Functions that can fail should return a `Result`.
- Functions that may or may not return a value but don't strictly "fail" (like a dictionary lookup) should return an `Option<T>`.
- Do not mix `Option` and `Result` lazily; if the absence of a value implies a failure in logic, use `.ok_or(AppError::NotFound)?`.
