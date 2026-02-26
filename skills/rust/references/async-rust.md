# Async Rust & Tokio

Modern asynchronous Rust involves understanding the event loop, blocking operations, and thread safety.

## Tokio Runtime Rules

Tokio is a reactor-based asynchronous runtime. Its threads are responsible for advancing `Future`s.

- **Non-blocking Rule**: Never run heavy CPU-bound tasks or synchronous I/O operations directly inside an `async fn`. Doing so blocks the runtime thread, preventing other tasks from advancing (starvation).
- **Offloading Blocking Work**: Use `tokio::task::spawn_blocking` to execute heavy logic on Tokio's dedicated blocking thread pool.

```rust
use tokio::task;

async fn process_data(data: Vec<u8>) -> Result<String, MyError> {
    // Correct: Offload heavy CPU work to a blocking thread
    let result = task::spawn_blocking(move || {
        heavy_cpu_computation(data)
    })
    .await
    .map_err(|e| MyError::Internal(e.to_string()))?;

    Ok(result)
}
```

## Concurrency & Spawning

- Use `tokio::spawn` to concurrently execute completely independent tasks that don't need to block the current control flow immediately.
- Use `tokio::join!` when waiting for multiple independent async tasks to complete simultaneously.
- Use `tokio::select!` when waiting for multiple async tasks, but you only care about the first one to finish (like timeouts or cancellations).

## Mutexes and State

- **Synchronous Mutexes**: Prefer `std::sync::Mutex` or `parking_lot::Mutex` when the lock does *not* need to be held across an `.await` point. They are much faster and don't require the overhead of waking tasks.
- **Asynchronous Mutexes**: Only use `tokio::sync::Mutex` when the lock *must* be held across an `.await` point. Otherwise, holding a synchronous lock across an await point will cause the Rust compiler to complain that the `Future` is not `Send`.

```rust
use std::sync::Mutex;
use std::sync::Arc;
use tokio::sync::Mutex as AsyncMutex;

// Correct: Holding std::sync::Mutex briefly before async work
let data = {
    let mut cache = sync_cache.lock().unwrap();
    cache.clone()
};
let res = fetch_async(data).await;

// Correct: Using tokio::sync::Mutex across await points
let mut connection = async_lock.lock().await;
connection.write(b"data").await?;
// lock is dropped here
```

## Send and Sync bounds

- The `async` block or function generates a state machine `Future`. If the `Future` is passed to `tokio::spawn`, it must be `Send + 'static`.
- Ensure variables captured inside the `async move` block or referenced across `.await` points implement `Send`.
