# Zustand API Reference

## Table of Contents

- [create](#create)
- [createStore](#createstore)
- [createWithEqualityFn](#createwithequalityfn)
- [shallow](#shallow)
- [useStore](#usestore)
- [useShallow](#useshallow)
- [useStoreWithEqualityFn](#usestorewithequalityfn)

---

## `create`

**Import:** `import { create } from "zustand"`

Creates a React hook with API utilities attached: `setState`, `getState`, `getInitialState`, `subscribe`.

### Signature

```ts
create<T>()(stateCreatorFn: StateCreator<T>) => UseBoundStore<StoreApi<T>>
```

Use curried form `create<T>()(...)` for TypeScript (required for type inference).

### `set` behavior

- Shallow merges by default: `set({ count: 1 })` merges with existing state
- Updater function: `set((state) => ({ count: state.count + 1 }))`
- Replace entire state: `set(newState, true)`
- Only merges at one level — nested objects need explicit spreading

### `get` behavior

- Returns current state: `get().count`
- Do NOT call `get()` synchronously during store creation (returns `undefined`)

### Basic example

```ts
import { create } from "zustand"

interface BearState {
  bears: number
  increase: (by: number) => void
}

const useBearStore = create<BearState>()((set) => ({
  bears: 0,
  increase: (by) => set((state) => ({ bears: state.bears + by })),
}))

// Usage in component — select only what you need
const bears = useBearStore((state) => state.bears)
const increase = useBearStore((state) => state.increase)

// External access
useBearStore.getState().bears
useBearStore.setState({ bears: 10 })
const unsub = useBearStore.subscribe((state) => console.log(state))
```

---

## `createStore`

**Import:** `import { createStore } from "zustand/vanilla"`

Creates a vanilla (non-React) store. Same API as `create` but returns a store object instead of a hook.

```ts
import { createStore } from "zustand/vanilla"

const store = createStore<BearState>()((set) => ({
  bears: 0,
  increase: (by) => set((state) => ({ bears: state.bears + by })),
}))

store.getState().bears
store.setState({ bears: 10 })
store.subscribe((state) => console.log(state))
```

Use with React via `useStore` hook:

```ts
import { useStore } from "zustand"
const bears = useStore(store, (s) => s.bears)
```

---

## `createWithEqualityFn`

**Import:** `import { createWithEqualityFn } from "zustand/traditional"`
**Peer dep:** `use-sync-external-store`

Like `create` but accepts a custom equality function as second argument:

```ts
import { createWithEqualityFn } from "zustand/traditional"
import { shallow } from "zustand/shallow"

const useBearStore = createWithEqualityFn<BearState>()(
  (set) => ({ bears: 0, increase: (by) => set((s) => ({ bears: s.bears + by })) }),
  shallow,
)
```

---

## `shallow`

**Import:** `import { shallow } from "zustand/vanilla/shallow"`

Compares top-level properties of objects, arrays, Maps, and Sets. Returns `true` if shallow-equal.

- Does NOT compare nested objects
- Also checks prototype equality
- Useful with `useShallow` or `createWithEqualityFn`

---

## `useStore`

**Import:** `import { useStore } from "zustand"`

React hook to use vanilla stores (`createStore`) in React components.

```ts
import { useStore } from "zustand"
import { bearStore } from "./bear-store"

const bears = useStore(bearStore, (s) => s.bears)
```

### Patterns

**Scoped via Context:**
```tsx
const StoreContext = createContext<StoreApi<BearState> | null>(null)

const Provider = ({ children }) => {
  const [store] = useState(() => createStore<BearState>()((set) => ({...})))
  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>
}

const useBearStore = <T,>(selector: (s: BearState) => T) => {
  const store = useContext(StoreContext)
  if (!store) throw new Error("Missing Provider")
  return useStore(store, selector)
}
```

---

## `useShallow`

**Import:** `import { useShallow } from "zustand/react/shallow"`

Wraps a selector to memoize output using shallow comparison. Prevents re-renders when selector returns new references but structurally same data.

```tsx
import { useShallow } from "zustand/react/shallow"

// Without useShallow — re-renders on every state change
const keys = useBearStore((s) => Object.keys(s))

// With useShallow — only re-renders when keys actually change
const keys = useBearStore(useShallow((s) => Object.keys(s)))

// Picking multiple fields
const { bears, food } = useBearStore(
  useShallow((s) => ({ bears: s.bears, food: s.food })),
)
```

---

## `useStoreWithEqualityFn`

**Import:** `import { useStoreWithEqualityFn } from "zustand/traditional"`
**Peer dep:** `use-sync-external-store`

Like `useStore` but with custom equality function:

```ts
import { useStoreWithEqualityFn } from "zustand/traditional"
import { shallow } from "zustand/shallow"

const bears = useStoreWithEqualityFn(bearStore, (s) => s.bears, shallow)
```
