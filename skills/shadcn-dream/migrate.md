# Migrate a shadcn project to shadcn-dream

Brings a project on the default shadcn setup (`lib/utils.ts` exporting `cn`, `class-variance-authority`, components as the CLI wrote them) into dream shape: setup, every component, and every `cn` / `cva` use in app code. Rules, the `lib/cva` module, and the done criterion live in [dream.md](./dream.md); read it in full before step 1.

Use the project's package manager (`packageManager` from project context) for every install and script below.

## 1. Inventory

Search the project (excluding `node_modules`, build output, and the lockfile) for each of:

- `class-variance-authority`
- `cn` imports: `@/lib/utils`, the `aliases.utils` path, `from "cn"`
- `clsx`, `tailwind-merge`, `twMerge`
- `@radix-ui/react-`
- `cva(`
- `null` passed to a variants function, in `defaultVariants`, or in a `compoundVariants` selector

Read the installed TypeScript version from the package manager (`npm ls typescript`, `pnpm why typescript`, `bun pm ls`), not the `package.json` range.

Done when you hold a file list per search, each file tagged **component** or **other** per [dream.md — Scope](./dream.md#scope). That list is the migration's checklist: every file on it is visited in step 6.

## 2. Radix imports

On a `radix` base with `@radix-ui/react-*` hits, run `npx shadcn@latest migrate radix`. Skip on `base` and `aria`.

## 3. Direct `clsx` / `tailwind-merge` use

When files other than `lib/utils.ts` import `clsx` or `tailwind-merge`, run `npx shadcn@latest migrate cn`: it moves those calls onto the `cn` package. Note every usage it reports as unsupported and rewrite those by hand onto `cn` from `lib/cva`. If it refuses to run, do the same by hand for every hit.

## 4. Dependencies

Edit `package.json` once, then run one install:

- add `cva` at exactly `1.0.0-beta.12` and `cn` to `dependencies`;
- raise `typescript` to `^6` when the installed version is below 6.

Leave removals for step 8, after nothing imports the old packages.

If TypeScript 6 surfaces errors unrelated to `cva`, stop and ask the user whether to land the TypeScript upgrade separately first.

## 5. `lib/cva.ts`

Write it at the `lib` path from `resolvedPaths` with the exact content from [dream.md — The `lib/cva` module](./dream.md#the-libcva-module).

## 6. Rewrite

Visit every file on the step 1 checklist:

- **component** files get every rule in dream.md;
- **other** files get the import rules (1, 2, 3, 8) and the `null` rule.

Each `null` variant use becomes an explicit `unset: null` option passed by name. When a `null` default or compound selector encodes behavior nobody can explain, ask the user which output is intended.

## 7. Global CSS

Merge the base layer from [dream.md — rule 9](./dream.md#9-global-css-carries-the-dream-base-layer) into `tailwindCssFile`.

## 8. Remove leftovers

Re-run the step 1 searches. Once they return no import of each item:

- delete `lib/utils.ts` (when it only exported `cn`);
- remove `class-variance-authority`, `clsx`, `tailwind-merge`, and any `@radix-ui/react-*` package from `package.json`, then install.

Leave `aliases.utils` in `components.json` as it is: the CLI uses it to place its own `utils` file, and pointing it at `lib/cva` lets a later `add` overwrite the module. Files the CLI writes there later are handled by the adopt flow in [SKILL.md](./SKILL.md#shadcn-dream).

## 9. Editor and lint config

Where the project lists class functions (Tailwind IntelliSense `tailwindCSS.classFunctions`, Biome `useSortedClasses` `functions`), the list includes `cva`, `cx`, and `cn`. Skip when the project has no such config.

## 10. Verify

Done when all hold:

1. [dream.md — Done](./dream.md#done) passes: the audit over every component file, the audit with `--rules 1,2,3,8` over the other files, typecheck, lint.
2. The step 1 searches return nothing outside `lib/cva.ts` (which imports `cn`) and the lockfile.
3. The package manager resolves `cva` to `1.0.0-beta.12`.

Report the files changed, the dependency changes, and every case you settled by hand (unsupported `migrate cn` usages, `null` variants).
