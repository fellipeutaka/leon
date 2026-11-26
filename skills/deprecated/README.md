# Deprecated skills

Retired skills are removed from the active tree and catalogs; their content and
provenance remain in Git. This directory contains documentation only, because
recursive installers can still discover a retired `SKILL.md` placed here.

Follow the [review policy](../../docs/skill-retirement-review.md) before retiring
a skill. Custom instructions, best practices, do/don't guidance, and actionable
workflows remain active, including shadcn-dream.

## tanstack-hotkeys — 2026-11-05

- Former directory and name: `skills/tanstack-hotkeys`, `tanstack-hotkeys`.
- Reason: API reference, option tables, usage examples, and standard composition
  recipes, without a distinct custom policy or best-practice ruleset in either
  the main file or its supporting `references/react-api.md`.
- Official replacement: [TanStack Hotkeys llms.txt](https://tanstack.com/hotkeys/latest/llms.txt).
  Verified HTTP 200 and plain text, including links to React Markdown guides.
- Checked coverage: [overview](https://tanstack.com/hotkeys/latest/docs/overview.md),
  [React quick start](https://tanstack.com/hotkeys/latest/docs/framework/react/quick-start.md),
  and [React hotkeys guide](https://tanstack.com/hotkeys/latest/docs/framework/react/guides/hotkeys.md)
  each returned HTTP 200 with Markdown content.
- Stop condition: the first official-source check succeeded. Repository skills
  and upstream issue/discussion searches were not needed and were not performed.

Use the official index to load the required pages instead of installing Leon's
copied API reference. `latest` tracks current upstream documentation: check the
installed package version and use matching documentation/source when APIs differ.
An llms.txt file is not proof of versioned Intent skill coverage.

Existing copies installed locally or globally are not removed by updating Leon;
remove them separately in each agent/installation scope.

### Historical content

Last active revision:
[`d0e756d`](https://github.com/fellipeutaka/leon/tree/d0e756d2399e01a03d19b6b1bbe07329384cf71a/skills/tanstack-hotkeys).

```bash
git show d0e756d2399e01a03d19b6b1bbe07329384cf71a:skills/tanstack-hotkeys/SKILL.md
git show d0e756d2399e01a03d19b6b1bbe07329384cf71a:skills/tanstack-hotkeys/references/react-api.md
```

The Intent contribution campaign retains this source through the optional
`leonSourceRevision` on the `tanstack-hotkeys` contribution.
