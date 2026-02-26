# Tauri IPC Patterns

Tauri provides several Inter-Process Communication (IPC) primitives for communication between the frontend and the Rust backend: Commands, Events, and Channels.

## 1. Commands

Commands are the primary way to call Rust functions from the frontend.

### Basic Commands
```rust
#[tauri::command]
fn simple_command(name: String) -> String {
    format!("Hello, {}!", name)
}
```

### Async Commands
Use async for I/O operations to avoid blocking the main thread.
**Important:** Do not use borrowed types (`&str`) in async commands. Use owned types (`String`).

```rust
#[tauri::command]
async fn fetch_data(url: String) -> Result<String, String> {
    // Perform async operation
    Ok("data".into())
}
```

### Error Handling
Return `Result<T, E>` where `E` implements `serde::Serialize`. Using `thiserror` is recommended.

```rust
use thiserror::Error;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
}

impl serde::Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where S: serde::ser::Serializer {
        serializer.serialize_str(self.to_string().as_ref())
    }
}

#[tauri::command]
fn read_file(path: String) -> Result<String, AppError> {
    let content = std::fs::read_to_string(path)?;
    Ok(content)
}
```

### Frontend Invocation
```typescript
import { invoke } from '@tauri-apps/api/core';

try {
  const result = await invoke<string>('read_file', { path: '/tmp/file.txt' });
} catch (e) {
  console.error('Command failed:', e);
}
```

## 2. Events

Events are fire-and-forget messages that can be sent from the backend to the frontend or vice versa.

### Rust to Frontend
```rust
use tauri::Emitter;

#[tauri::command]
fn start_process(app: tauri::AppHandle) {
    std::thread::spawn(move || {
        app.emit("progress", 50).unwrap();
    });
}
```

```typescript
import { listen } from '@tauri-apps/api/event';

const unlisten = await listen<number>('progress', (event) => {
    console.log(`Progress: ${event.payload}%`);
});

// To stop listening:
// unlisten();
```

### Frontend to Rust
```typescript
import { emit } from '@tauri-apps/api/event';
await emit('user-action', { action: 'click' });
```

```rust
use tauri::Listener;

app.listen("user-action", |event| {
    println!("Received: {:?}", event.payload());
});
```

## 3. Channels

Channels provide a way to stream data from a Rust command back to the frontend over time.

### Rust Implementation
```rust
use tauri::ipc::Channel;
use serde::Serialize;

#[derive(Clone, Serialize)]
struct Progress {
    percent: u32,
}

#[tauri::command]
async fn download_file(on_progress: Channel<Progress>) {
    for i in 1..=100 {
        on_progress.send(Progress { percent: i }).unwrap();
        // simulate work
    }
}
```

### Frontend Implementation
```typescript
import { invoke, Channel } from '@tauri-apps/api/core';

const channel = new Channel<{ percent: number }>();
channel.onmessage = (message) => {
    console.log(`Download progress: ${message.percent}%`);
};

await invoke('download_file', { onProgress: channel });
```