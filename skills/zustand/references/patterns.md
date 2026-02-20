# Zustand Patterns & Best Practices

## Table of Contents

- [Next.js setup](#nextjs-setup)
- [Slices pattern](#slices-pattern)
- [Auto-generating selectors](#auto-generating-selectors)
- [Reset state](#reset-state)
- [Initialize state with props](#initialize-state-with-props)
- [Actions outside store](#actions-outside-store)
- [Prevent rerenders](#prevent-rerenders)
- [Deep nested updates](#deep-nested-updates)
- [Maps and Sets](#maps-and-sets)
- [URL state](#url-state)
- [SSR and hydration](#ssr-and-hydration)
- [Testing](#testing)
- [Flux-inspired practice](#flux-inspired-practice)

---

## Next.js setup

**Key rules:**
1. Create stores per-request (NOT global singletons) to avoid sharing state between requests
2. RSCs (React Server Components) should NOT read or write Zustand stores
3. Use React Context + Provider pattern

### Store factory

```ts
// stores/bear-store.ts
import { createStore } from "zustand/vanilla"

export interface BearState {
  bears: number
  increase: (by: number) => void
}

export type BearStore = ReturnType<typeof createBearStore>

export const createBearStore = (initState: { bears: number } = { bears: 0 }) =>
  createStore<BearState>()((set) => ({
    ...initState,
    increase: (by) => set((s) => ({ bears: s.bears + by })),
  }))
```

### Provider + hook

```tsx
// providers/bear-store-provider.tsx
"use client"
import { createContext, useContext, useRef, type ReactNode } from "react"
import { useStore } from "zustand"
import { createBearStore, type BearState, type BearStore } from "@/stores/bear-store"

const BearStoreContext = createContext<BearStore | null>(null)

export const BearStoreProvider = ({ children, ...props }: { children: ReactNode } & Partial<BearState>) => {
  const storeRef = useRef<BearStore>(null)
  if (!storeRef.current) storeRef.current = createBearStore(props)
  return <BearStoreContext.Provider value={storeRef.current}>{children}</BearStoreContext.Provider>
}

export const useBearStore = <T,>(selector: (s: BearState) => T): T => {
  const store = useContext(BearStoreContext)
  if (!store) throw new Error("useBearStore must be used within BearStoreProvider")
  return useStore(store, selector)
}
```

### Layout usage

```tsx
// app/layout.tsx
import { BearStoreProvider } from "@/providers/bear-store-provider"
export default function Layout({ children }) {
  return <BearStoreProvider>{children}</BearStoreProvider>
}
```

---

## Slices pattern

Split large stores into smaller "slices":

```ts
import { create, StateCreator } from "zustand"

interface BearSlice { bears: number; addBear: () => void }
interface FishSlice { fishes: number; addFish: () => void }

const createBearSlice: StateCreator<BearSlice & FishSlice, [], [], BearSlice> = (set) => ({
  bears: 0,
  addBear: () => set((s) => ({ bears: s.bears + 1 })),
})

const createFishSlice: StateCreator<BearSlice & FishSlice, [], [], FishSlice> = (set) => ({
  fishes: 0,
  addFish: () => set((s) => ({ fishes: s.fishes + 1 })),
})

// Combine
const useBoundStore = create<BearSlice & FishSlice>()((...a) => ({
  ...createBearSlice(...a),
  ...createFishSlice(...a),
}))
```

Apply middlewares only on the combined store, not individual slices.

---

## Auto-generating selectors

Add `.use.propertyName()` hooks automatically:

```ts
import { create, StoreApi, UseBoundStore } from "zustand"

type WithSelectors<S> = S extends { getState: () => infer T }
  ? S & { use: { [K in keyof T]: () => T[K] } }
  : never

const createSelectors = <S extends UseBoundStore<StoreApi<object>>>(_store: S) => {
  const store = _store as WithSelectors<typeof _store>
  store.use = {}
  for (const k of Object.keys(store.getState())) {
    (store.use as any)[k] = () => store((s) => s[k as keyof typeof s])
  }
  return store
}

// Usage
const useBearStore = createSelectors(
  create<BearState>()((set) => ({
    bears: 0,
    increase: (by) => set((s) => ({ bears: s.bears + by })),
  })),
)

// Now use as:
const bears = useBearStore.use.bears()
const increase = useBearStore.use.increase()
```

---

## Reset state

### Single store

```ts
const initialState = { bears: 0, fish: 0 }

const useBearStore = create<typeof initialState & { reset: () => void }>()((set) => ({
  ...initialState,
  reset: () => set(initialState),
}))
```

### Multiple stores — reset all

```ts
const resetFns = new Set<() => void>()

const createResettable = ((f) => {
  const store = create(f)
  const initialState = store.getInitialState()
  resetFns.add(() => store.setState(initialState, true))
  return store
}) as typeof create

// Reset all stores
export const resetAllStores = () => resetFns.forEach((fn) => fn())
```

---

## Initialize state with props

Use `createStore` + Context for dependency injection:

```ts
const createBearStore = (initProps: { bears: number }) =>
  createStore<BearState>()((set) => ({
    ...initProps,
    increase: (by) => set((s) => ({ bears: s.bears + by })),
  }))
```

Wrap in Context Provider (see Next.js pattern above).

---

## Actions outside store

Define actions externally — no hook needed to call them:

```ts
const useBearStore = create<BearState>()(() => ({ bears: 0 }))

// External actions
export const increase = (by: number) =>
  useBearStore.setState((s) => ({ bears: s.bears + by }))
export const reset = () => useBearStore.setState({ bears: 0 })
```

---

## Prevent rerenders

Use `useShallow` when selectors return new object/array references:

```tsx
import { useShallow } from "zustand/react/shallow"

// Bad — new array every render
const keys = useBearStore((s) => Object.keys(s))

// Good — shallow compared
const keys = useBearStore(useShallow((s) => Object.keys(s)))
const { bears, food } = useBearStore(useShallow((s) => ({ bears: s.bears, food: s.food })))
```

---

## Deep nested updates

### Spread operator (manual)

```ts
set((state) => ({
  deep: { ...state.deep, nested: { ...state.deep.nested, count: state.deep.nested.count + 1 } },
}))
```

### Immer (recommended for deep nesting)

```ts
import { produce } from "immer"
set(produce((state) => { state.deep.nested.count += 1 }))
```

### optics-ts / Ramda

```ts
set(O.modify(O.optic<State>().path("deep.nested.count"))((c) => c + 1))
set(R.modifyPath(["deep", "nested", "count"], (c) => c + 1))
```

---

## Maps and Sets

Create new instances for updates (Zustand detects changes by reference):

```ts
set((state) => ({
  items: new Map(state.items).set(key, value),
  tags: new Set(state.tags).add(tag),
}))
```

---

## URL state

Use `persist` with custom hash/query storage. See [middlewares reference](./middlewares.md#custom-storage).

---

## SSR and hydration

For SSR, create stores per-request and hydrate on client. Use `persist` with `skipHydration: true` for manual control:

```ts
persist(stateCreator, { name: "store", skipHydration: true })

// Then in useEffect:
useBearStore.persist.rehydrate()
```

---

## Testing

Mock `zustand` module to reset stores between tests. Create `__mocks__/zustand.ts`:

```ts
import { act } from "@testing-library/react"
import type * as ZustandExportedTypes from "zustand"
export * from "zustand"

const { create: actualCreate, createStore: actualCreateStore } =
  await vi.importActual<typeof ZustandExportedTypes>("zustand") // Jest: jest.requireActual

export const storeResetFns = new Set<() => void>()

const createUncurried = <T>(stateCreator: ZustandExportedTypes.StateCreator<T>) => {
  const store = actualCreate(stateCreator)
  const initialState = store.getInitialState()
  storeResetFns.add(() => store.setState(initialState, true))
  return store
}

export const create = (<T>(stateCreator: ZustandExportedTypes.StateCreator<T>) => {
  return typeof stateCreator === "function" ? createUncurried(stateCreator) : createUncurried
}) as typeof ZustandExportedTypes.create

// Same pattern for createStore...

afterEach(() => { act(() => { storeResetFns.forEach((fn) => fn()) }) })
```

For Vitest, add `vi.mock("zustand")` in setup file. Use React Testing Library + MSW for component and API testing.

---

## Flux-inspired practice

Recommended patterns:
- **Single store** — one store per app (use slices for modularity)
- **Use `set`/`setState`** for updates — not `store.state = x`
- **Colocate actions** with state in the store (or externalize via `setState`)
