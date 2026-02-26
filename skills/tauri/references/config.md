# Configuration Reference

Tauri relies on specific configuration files to build and execute. These include `tauri.conf.json` for Tauri-specific settings and `Cargo.toml` for Rust dependencies and build configurations.

## tauri.conf.json

This is the primary configuration file located in `src-tauri/`. It defines build instructions, app metadata, and security settings.

### Basic Structure

```json
{
  "$schema": "./gen/schemas/desktop-schema.json",
  "productName": "my-app",
  "version": "1.0.0",
  "identifier": "com.example.myapp",
  "build": {
    "devUrl": "http://localhost:5173",
    "frontendDist": "../dist",
    "beforeDevCommand": "npm run dev",
    "beforeBuildCommand": "npm run build"
  },
  "app": {
    "windows": [
      {
        "label": "main",
        "title": "My App",
        "width": 800,
        "height": 600
      }
    ],
    "security": {
      "csp": "default-src 'self'; img-src 'self' data:",
      "capabilities": ["default"]
    }
  },
  "bundle": {
    "active": true,
    "targets": "all",
    "icon": ["icons/icon.icns", "icons/icon.ico", "icons/icon.png"]
  }
}
```

### Key Sections:

- **`build.devUrl`**: During development (`tauri dev`), Tauri connects the WebView to this URL. Must match your frontend framework's dev server.
- **`build.frontendDist`**: During production (`tauri build`), Tauri bundles these static files into the app.
- **`build.beforeDevCommand`** / **`beforeBuildCommand`**: Useful for automatically starting your frontend dev server or running build scripts before Tauri starts.
- **`app.security.capabilities`**: Identifiers corresponding to files in `src-tauri/capabilities/` that list the allowed permissions for the app.
- **`bundle.targets`**: Controls which formats are produced (e.g., `app`, `dmg`, `deb`, `msi`, `nsis`). `all` builds the default target for the current platform.

## Cargo.toml

This file configures the Rust backend, located in `src-tauri/Cargo.toml`.

### Required Configuration for Tauri v2

Tauri v2 supports mobile builds natively. To ensure cross-platform compatibility, the backend must be built as a library rather than solely a binary. This means the `[lib]` section is required.

```toml
[package]
name = "my_app"
version = "0.1.0"
edition = "2021"

[lib]
# Required for mobile support
name = "my_app_lib"
crate-type = ["staticlib", "cdylib", "rlib"]

[build-dependencies]
tauri-build = { version = "2.0.0" }

[dependencies]
tauri = { version = "2.0.0", features = [] }
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"

# Optional: Add plugins as needed
# tauri-plugin-dialog = "2.0.0"
# tauri-plugin-fs = "2.0.0"
```

## Plugin Configuration

Plugins might have their own configuration structures inside `tauri.conf.json`. For example:

```json
{
  "plugins": {
    "log": {
      "level": "info",
      "format": "[{time}] {level}: {message}"
    }
  }
}
```