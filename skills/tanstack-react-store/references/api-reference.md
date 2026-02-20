# TanStack Store — API Reference

## Table of Contents

- [Core Functions](#core-functions)
- [Store Class](#store-class)
- [ReadonlyStore Class](#readonlystore-class)
- [Atoms](#atoms)
- [Async Atoms](#async-atoms)
- [Utility Functions](#utility-functions)
- [React-specific API](#react-specific-api)
- [Types and Interfaces](#types-and-interfaces)

## Core Functions

### createStore

```ts
// Writable store
function createStore<T>(initialValue: T): Store<T>;

// Readonly derived store (auto-tracks dependencies)
function createStore<T>(getValue: (prev?: T) => T): ReadonlyStore<T>;
```

### batch

Batch multiple setState calls. Subscribers notified once at the end.

```ts
function batch(fn: () => void): void;
```

### flush

Force synchronous flush of pending notifications.

```ts
function flush(): void;
```

## Store Class

```ts
class Store<T> {
  constructor(initialValue: T);
  constructor(getValue: (prev?: T) => T);

  get state(): T;
  get(): T;
  setState(updater: (prev: T) => T): void;
  subscribe(observerOrFn: Observer<T> | ((value: T) => void)): Subscription;
}
```

## ReadonlyStore Class

Like `Store` but without `setState`. Returned when `createStore` receives a getter function.

```ts
class ReadonlyStore<T> implements Omit<Store<T>, "setState"> {
  constructor(getValue: (prev?: T) => T);
  constructor(initialValue: T);

  get state(): T;
  get(): T;
  subscribe(observerOrFn: Observer<T> | ((value: T) => void)): Subscription;
}
```

## Atoms

Lower-level primitive. Stores are built on atoms internally.

### createAtom

```ts
// Writable atom
function createAtom<T>(initialValue: T, options?: AtomOptions<T>): Atom<T>;

// Readonly derived atom
function createAtom<T>(getValue: (prev?: T) => T, options?: AtomOptions<T>): ReadonlyAtom<T>;
```

### Atom interface

```ts
interface Atom<T> extends BaseAtom<T> {
  get(): T;
  set(fn: (prev: T) => T): void;
  set(value: T): void;
  subscribe(observer: Observer<T>): Subscription;
  subscribe(next: (value: T) => void, error?: (err: unknown) => void, complete?: () => void): Subscription;
}
```

### ReadonlyAtom interface

```ts
interface ReadonlyAtom<T> extends BaseAtom<T> {
  get(): T;
  // No set method
  subscribe(observer: Observer<T>): Subscription;
}
```

### AtomOptions

```ts
interface AtomOptions<T> {
  compare?: (prev: T, next: T) => boolean;
}
```

## Async Atoms

Create a readonly atom from an async getter. State includes loading/error info.

```ts
function createAsyncAtom<T>(
  getValue: () => Promise<T>,
  options?: AtomOptions<AsyncAtomState<T, unknown>>,
): ReadonlyAtom<AsyncAtomState<T, unknown>>;
```

`AsyncAtomState<T, E>` contains the resolved value, loading state, and error.

## Utility Functions

### toObserver

Convert handler functions into an Observer object.

```ts
function toObserver<T>(
  nextHandler?: Observer<T> | ((value: T) => void),
  errorHandler?: (error: unknown) => void,
  completionHandler?: () => void,
): Observer<T>;
```

## React-specific API

Package: `@tanstack/react-store`

### useStore

```ts
function useStore<TAtom extends AnyAtom | undefined, T>(
  atom: TAtom,
  selector: (snapshot: AtomState) => T,
  compare?: (a: T, b: T) => boolean,
): T;
```

- `atom` — Store, Atom, or undefined
- `selector` — extract the slice of state to subscribe to
- `compare` — equality check to prevent re-renders (default: `Object.is`)

### shallow

Shallow comparison utility for use as `compare` argument in `useStore`.

```ts
function shallow<T>(objA: T, objB: T): boolean;
```

Use when selecting objects or arrays to avoid unnecessary re-renders when contents haven't changed.

## Types and Interfaces

### Observer

```ts
type Observer<T> = {
  next?: (value: T) => void;
  error?: (err: unknown) => void;
  complete?: () => void;
};
```

### Subscription

```ts
interface Subscription {
  unsubscribe(): void;
}
```

### Selection

```ts
type Selection<TSelected> = Readable<TSelected>;
```

### AnyAtom

```ts
type AnyAtom = BaseAtom<any>;
```
