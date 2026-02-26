# Security & Capabilities

Tauri v2 operates with a default-deny security model. To allow the frontend to access any backend commands or plugins, explicit capabilities must be defined in the `src-tauri/capabilities/` directory.

## Capabilities Directory Structure

Capabilities are stored as JSON or TOML files in `src-tauri/capabilities/`.

```
src-tauri/
├── capabilities/
│   ├── default.json
│   ├── desktop.json
│   └── mobile.json
```

## Creating a Capability

A capability file specifies which windows can access which permissions.

### Example: `default.json`
```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "Default permissions for the main window",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "fs:allow-read-text-file",
    "dialog:allow-open"
  ]
}
```

### Breakdown of Fields:
- `$schema`: Points to the generated JSON schema for validation and autocompletion in IDEs.
- `identifier`: A unique name for this capability file. Used in `tauri.conf.json`'s `app.security.capabilities` array.
- `windows`: An array of window labels this capability applies to. `["main"]` is the default main window.
- `permissions`: A list of explicitly granted permissions.

## Core Permissions

The `core:default` permission is a bundled permission that includes essential Tauri functionalities like basic window management.

## Custom Command Permissions

If you write a custom command, the frontend cannot call it until it is allowed in a capability.

1. Create a command:
   ```rust
   #[tauri::command]
   fn custom_action() {}
   ```
2. Enable it in your capability file (e.g., `default.json`):
   ```json
   {
     "identifier": "default",
     "windows": ["main"],
     "permissions": [
       "core:default",
       "custom_action"
     ]
   }
   ```

## Plugin Permissions

To use plugins like `fs`, `dialog`, or `shell`, you must explicitly allow the specific actions you need. For example, to read a file, `fs:allow-read-text-file` is needed.

Tauri provides fine-grained controls for plugins. A plugin might offer `allow-read-text-file` for any file, or you might define custom scopes to restrict access to specific directories (e.g., `$APP_DATA/*`).

### Scoped Permissions Example

In a `capabilities/my-app.json` file:

```json
{
  "identifier": "app-files",
  "windows": ["main"],
  "permissions": [
    "fs:allow-read-file",
    {
      "identifier": "fs:scope-read-file",
      "allow": [{ "path": "$APPDATA/**" }]
    }
  ]
}
```

## Activating Capabilities

After defining a capability in `src-tauri/capabilities/`, make sure its identifier is listed in your `tauri.conf.json`:

```json
{
  "app": {
    "security": {
      "capabilities": ["default", "app-files"]
    }
  }
}
```

## Summary Checklist
1. Write the Rust command or install a plugin.
2. Add the command name or plugin permission string to a file in `src-tauri/capabilities/`.
3. Ensure the capability's identifier is in `tauri.conf.json` under `app.security.capabilities`.