# Zustand Middlewares Reference

## Table of Contents

- [persist](#persist)
- [devtools](#devtools)
- [immer](#immer)
- [redux](#redux)
- [combine](#combine)
- [subscribeWithSelector](#subscribewithselector)
- [Middleware ordering](#middleware-ordering)

---

## `persist`

**Import:** `import { persist, createJSONStorage } from "zustand/middleware"`

Persists store state across page reloads.

### Basic usage

```ts
const useBearStore = create<BearState>()(
  persist(
    (set) => ({
      bears: 0,
      increase: (by) => set((s) => ({ bears: s.bears + by })),
    }),
    { name: "bear-storage" },
  ),
)
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `name` | `string` | **required** | Storage key |
| `storage` | `StateStorage` | `localStorage` | Storage engine |
| `partialize` | `(state) => Partial` | identity | Filter fields to persist |
| `onRehydrateStorage` | `(state) => ((state?, error?) => void)?` | — | Called before/after rehydration |
| `version` | `number` | `0` | Schema version for migrations |
| `migrate` | `(persisted, version) => state` | — | Migration function |
| `merge` | `(persisted, current) => state` | shallow merge | Custom merge strategy |
| `skipHydration` | `boolean` | `false` | Skip auto-hydration (manual via `rehydrate()`) |

### Partialize — persist only specific fields

```ts
persist(
  (set) => ({ bears: 0, fish: 0, secret: "hidden" }),
  {
    name: "store",
    partialize: (state) => ({ bears: state.bears, fish: state.fish }),
    // or exclude fields:
    // partialize: (state) => Object.fromEntries(
    //   Object.entries(state).filter(([key]) => !["secret"].includes(key))
    // ),
  },
)
```

### Custom storage

```ts
import { persist, createJSONStorage } from "zustand/middleware"

// sessionStorage
persist(stateCreator, {
  name: "store",
  storage: createJSONStorage(() => sessionStorage),
})

// Custom (e.g., URL hash)
const hashStorage = {
  getItem: (key) => { const v = new URLSearchParams(location.hash.slice(1)).get(key); return JSON.parse(v ?? "null") },
  setItem: (key, value) => { const params = new URLSearchParams(location.hash.slice(1)); params.set(key, JSON.stringify(value)); location.hash = params.toString() },
  removeItem: (key) => { const params = new URLSearchParams(location.hash.slice(1)); params.delete(key); location.hash = params.toString() },
}

persist(stateCreator, { name: "store", storage: createJSONStorage(() => hashStorage) })
```

### Versioning and migration

```ts
persist(stateCreator, {
  name: "store",
  version: 2,
  migrate: (persistedState, version) => {
    if (version === 0) { /* migrate v0 to v1 */ }
    if (version === 1) { /* migrate v1 to v2 */ }
    return persistedState as BearState
  },
})
```

### API methods on store

```ts
useBearStore.persist.getOptions()
useBearStore.persist.setOptions({ name: "new-key" })
useBearStore.persist.clearStorage()
useBearStore.persist.rehydrate()
useBearStore.persist.hasHydrated()
useBearStore.persist.onHydrate((state) => { /* before */ })
useBearStore.persist.onFinishHydration((state) => { /* after */ })
```

### Hydration check in React

```tsx
// Hook-based
const useHydration = () => {
  const [hydrated, setHydrated] = useState(useBearStore.persist.hasHydrated())
  useEffect(() => {
    const unsub = useBearStore.persist.onFinishHydration(() => setHydrated(true))
    return () => unsub()
  }, [])
  return hydrated
}
```

### Persisting Map/Set (use superjson)

```ts
import superjson from "superjson"
import { persist, createJSONStorage } from "zustand/middleware"

const storage = createJSONStorage(() => localStorage, {
  reviver: (key, value) => superjson.parse(JSON.stringify(value)),
  replacer: (key, value) => JSON.parse(superjson.stringify(value)),
})
```

---

## `devtools`

**Import:** `import { devtools } from "zustand/middleware"`
**Requires:** Redux DevTools browser extension

### Basic usage

```ts
const useBearStore = create<BearState>()(
  devtools(
    (set) => ({
      bears: 0,
      increase: (by) => set((s) => ({ bears: s.bears + by }), undefined, "increase"),
    }),
  ),
)
```

Third argument to `set` is the action name shown in DevTools.

### Options

| Option | Type | Description |
|--------|------|-------------|
| `name` | `string` | Instance name in DevTools |
| `enabled` | `boolean` | Enable/disable (e.g., `process.env.NODE_ENV === "development"`) |
| `store` | `string` | Store name for multiple stores |
| `anonymousActionType` | `string` | Default action name when none provided |

### Cleanup

```ts
useBearStore.devtools?.cleanup()
```

---

## `immer`

**Import:** `import { immer } from "zustand/middleware/immer"`
**Requires:** `npm install immer`

Enables mutable-style updates via Immer"s draft state:

```ts
const useBearStore = create<BearState>()(
  immer((set) => ({
    bears: 0,
    increase: (by) => set((state) => { state.bears += by }),
  })),
)
```

**Gotcha:** Class instances need `[immerable] = true` to work with Immer.

---

## `redux`

**Import:** `import { redux } from "zustand/middleware"`

Redux-style reducer + dispatch:

```ts
import { redux } from "zustand/middleware"

type Action = { type: "INC" } | { type: "DEC" }

const useBearStore = create(
  redux<{ bears: number }, Action>(
    (state, action) => {
      switch (action.type) {
        case "INC": return { bears: state.bears + 1 }
        case "DEC": return { bears: state.bears - 1 }
        default: return state
      }
    },
    { bears: 0 },
  ),
)

// Usage
useBearStore.getState().dispatch({ type: "INC" })
```

---

## `combine`

**Import:** `import { combine } from "zustand/middleware"`

Separates initial state from actions. Auto-infers types:

```ts
const useBearStore = create(
  combine({ bears: 0 }, (set) => ({
    increase: (by: number) => set((s) => ({ bears: s.bears + by })),
  })),
)
```

No curried `create<T>()()` needed since `combine` creates state.

---

## `subscribeWithSelector`

**Import:** `import { subscribeWithSelector } from "zustand/middleware"`

Subscribe to specific state slices externally:

```ts
const useBearStore = create<BearState>()(
  subscribeWithSelector((set) => ({
    bears: 0,
    increase: (by) => set((s) => ({ bears: s.bears + by })),
  })),
)

// Subscribe to a slice
const unsub = useBearStore.subscribe(
  (state) => state.bears,
  (bears, prevBears) => console.log("bears changed:", prevBears, "->", bears),
)
```

---

## Middleware ordering

Apply `devtools` as outermost middleware. It mutates `setState` and adds type info that other middlewares could overwrite.

```ts
// Correct
create<State>()(devtools(persist(immer((set) => ({...})), { name: "store" })))

// Wrong — devtools type info lost
create<State>()(immer(devtools(persist((set) => ({...}), { name: "store" }))))
```

Apply middlewares only on the combined store, not individual slices.
