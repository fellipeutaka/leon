# Zustand TypeScript Patterns

## Table of Contents

- [Basic typed store](#basic-typed-store)
- [Why curried create](#why-curried-create)
- [combine middleware (auto-infer)](#combine-middleware)
- [ExtractState helper](#extractstate-helper)
- [Selectors and useShallow](#selectors-and-useshallow)
- [Async actions](#async-actions)
- [Middleware typing](#middleware-typing)
- [Slices pattern](#slices-pattern)
- [Bounded useStore for vanilla stores](#bounded-usestore)
- [Reset pattern](#reset-pattern)
- [Middleware mutator reference](#middleware-mutator-reference)
- [Custom middleware authoring](#custom-middleware-authoring)

---

## Basic typed store

Use curried form `create<T>()(...)`:

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
```

## Why curried create

TypeScript cannot infer `T` when it"s both covariant (returned) and contravariant (used in `get`). The extra `()` is a workaround for [microsoft/TypeScript#10571](https://github.com/microsoft/TypeScript/issues/10571) — it lets you annotate the state type while other generics get inferred.

## `combine` middleware

Infers types from initial state — no explicit type annotation needed:

```ts
import { create } from "zustand"
import { combine } from "zustand/middleware"

const useBearStore = create(
  combine({ bears: 0 }, (set) => ({
    increase: (by: number) => set((state) => ({ bears: state.bears + by })),
  })),
)
```

**Caveat:** `set`, `get`, `store` inside the second parameter are typed as if state is only the first parameter. `Object.keys(get())` will return more keys than the type suggests. `set({...}, true)` (replace) could delete actions.

When using `combine` or `redux`, skip curried form — they create state so inference works.

## `ExtractState` helper

Extract store type for props, tests, utilities:

```ts
import { create, type ExtractState } from "zustand"

const useBearStore = create(combine({ bears: 0 }, (set) => ({
  increase: (by: number) => set((s) => ({ bears: s.bears + by })),
})))

type BearState = ExtractState<typeof useBearStore>
```

## Selectors and `useShallow`

Multiple fields — wrap with `useShallow` to avoid unnecessary re-renders:

```tsx
import { useShallow } from "zustand/react/shallow"

const { bears, food } = useBearStore(
  useShallow((state) => ({ bears: state.bears, food: state.food })),
)
```

Derived state — compute in selector, no extra state needed:

```tsx
const totalFood = useBearStore((s) => s.bears * s.foodPerBear)
```

## Async actions

```ts
interface BearState {
  bears: number
  fetchBears: () => Promise<void>
}

const useBearStore = create<BearState>()((set) => ({
  bears: 0,
  fetchBears: async () => {
    const res = await fetch("/api/bears")
    const data: { count: number } = await res.json()
    set({ bears: data.count })
  },
}))
```

## Middleware typing

Use middlewares directly inside `create` for contextual inference:

```ts
const useBearStore = create<BearState>()(
  devtools(
    persist(
      (set) => ({
        bears: 0,
        increase: (by) => set((s) => ({ bears: s.bears + by })),
      }),
      { name: "bearStore" },
    ),
  ),
)
```

**Ordering:** `devtools` should be outermost. It mutates `setState` and adds a type parameter that can be lost if other middlewares (like `immer`) also mutate `setState` before it. Use `devtools(immer(...))` NOT `immer(devtools(...))`.

## Slices pattern

Split store into typed slices using `StateCreator`:

```ts
import { create, StateCreator } from "zustand"

interface BearSlice { bears: number; addBear: () => void; eatFish: () => void }
interface FishSlice { fishes: number; addFish: () => void }

const createBearSlice: StateCreator<BearSlice & FishSlice, [], [], BearSlice> = (set) => ({
  bears: 0,
  addBear: () => set((s) => ({ bears: s.bears + 1 })),
  eatFish: () => set((s) => ({ fishes: s.fishes - 1 })),
})

const createFishSlice: StateCreator<BearSlice & FishSlice, [], [], FishSlice> = (set) => ({
  fishes: 0,
  addFish: () => set((s) => ({ fishes: s.fishes + 1 })),
})

const useBoundStore = create<BearSlice & FishSlice>()((...a) => ({
  ...createBearSlice(...a),
  ...createFishSlice(...a),
}))
```

With middlewares, replace `StateCreator<MyState, [], [], MySlice>` with `StateCreator<MyState, Mutators, [], MySlice>`. Example with devtools: `StateCreator<MyState, [["zustand/devtools", never]], [], MySlice>`.

## Bounded `useStore`

Type-safe wrapper for vanilla stores:

```ts
import { useStore } from "zustand"
import { createStore } from "zustand/vanilla"

const bearStore = createStore<BearState>()((set) => ({
  bears: 0,
  increase: (by) => set((s) => ({ bears: s.bears + by })),
}))

function useBearStore(): BearState
function useBearStore<T>(selector: (state: BearState) => T): T
function useBearStore<T>(selector?: (state: BearState) => T) {
  return useStore(bearStore, selector!)
}
```

## Reset pattern

```ts
const initialState = { bears: 0, food: "honey" }

type BearState = typeof initialState & {
  increase: (by: number) => void
  reset: () => void
}

const useBearStore = create<BearState>()((set) => ({
  ...initialState,
  increase: (by) => set((s) => ({ bears: s.bears + by })),
  reset: () => set(initialState),
}))
```

## Middleware mutator reference

- `devtools` — `["zustand/devtools", never]`
- `persist` — `["zustand/persist", YourPersistedState]`
- `immer` — `["zustand/immer", never]`
- `subscribeWithSelector` — `["zustand/subscribeWithSelector", never]`
- `redux` — `["zustand/redux", YourAction]`
- `combine` — no mutator (does not mutate the store)

## Custom middleware authoring

### Non-store-mutating middleware

```ts
import { create, StateCreator, StoreMutatorIdentifier } from "zustand"

type Logger = <T, Mps extends [StoreMutatorIdentifier, unknown][] = [], Mcs extends [StoreMutatorIdentifier, unknown][] = []>(
  f: StateCreator<T, Mps, Mcs>,
  name?: string,
) => StateCreator<T, Mps, Mcs>

type LoggerImpl = <T>(f: StateCreator<T, [], []>, name?: string) => StateCreator<T, [], []>

const loggerImpl: LoggerImpl = (f, name) => (set, get, store) => {
  const loggedSet: typeof set = (...a) => {
    set(...(a as Parameters<typeof set>))
    console.log(...(name ? [`${name}:`] : []), get())
  }
  const setState = store.setState
  store.setState = (...a) => {
    setState(...(a as Parameters<typeof setState>))
    console.log(...(name ? [`${name}:`] : []), store.getState())
  }
  return f(loggedSet, get, store)
}

export const logger = loggerImpl as unknown as Logger
```

### Store-mutating middleware

Use `declare module "zustand"` to extend `StoreMutators` interface. See [zustand#710](https://github.com/pmndrs/zustand/issues/710) for the higher-kinded mutator pattern.
