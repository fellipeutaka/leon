# Rust Core Patterns

As a Senior Rust engineer, you must adhere to idiomatic patterns, zero-cost abstractions, and memory safety. Apply these rules across all Rust code.

## Ownership and Borrowing

- **Borrowing First**: Always prefer references (`&T`, `&mut T`) over `.clone()` unless transferring ownership is required by the function signature or lifetime boundaries.
- **Strings and Slices**: Use `&str` instead of `String` and `&[T]` instead of `Vec<T>` for function parameters. Only take owned types when the function needs to consume the data or transfer it to another thread.
- **Copy vs Clone**: Small, simple types (≤24 bytes, like primitive structs) should implement `Copy`. For larger types, implement `Clone` but avoid redundant clones in tight loops.
- **Cow for Ambiguity**: Use `std::borrow::Cow<'_, T>` when a function might either borrow or own data, reducing allocations.

## Traits and Generics

- **Static vs Dynamic Dispatch**: Use generics (`<T: Trait>` or `impl Trait`) for static dispatch (zero-cost abstractions) in performance-critical code. Use trait objects (`Box<dyn Trait>`, `&dyn Trait`) only when heterogeneous collections are needed or to reduce compile times at non-critical API boundaries.
- **Marker Traits**: Ensure thread safety boundaries with `Send` and `Sync` when designing concurrent APIs.
- **Type State Pattern**: Encode valid states in the type system to catch invalid operations at compile time using `PhantomData` or generic parameters.

```rust
use std::marker::PhantomData;

struct FileHandle<State> {
    _state: PhantomData<State>,
}

struct Open;
struct Closed;

impl FileHandle<Open> {
    fn read(&self) -> String { "data".into() }
    fn close(self) -> FileHandle<Closed> { FileHandle { _state: PhantomData } }
}
```

## Iterators and Performance

- **Iterator Chaining**: Prefer iterators over manual `for` loops. Rust optimizes iterator chains (like `.filter().map()`) efficiently, often vectorizing them.
- **Avoid Redundant Collections**: Avoid calling `.collect()` if you're just going to iterate over the result again. Keep it as an iterator until you actually need the concrete collection.
- **By-value vs By-reference Iterators**:
  - `vec.iter()` for `&T`
  - `vec.iter_mut()` for `&mut T`
  - `vec.into_iter()` for `T` (consumes the vector)

## Default and New

- Implement `Default` trait for types that have a sensible default state.
- Provide a `new()` function for initialization, especially if `Default` doesn't make logical sense or if initialization requires arguments.
