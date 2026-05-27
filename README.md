# @dexli/family

Shared family infrastructure for the [dexli.dev](https://dexli.dev) tiny-tools
family. Canonical sibling registry + URL handoff builder.

A tool builder working on the Nth dexli.dev sibling imports this package and,
with a single function call, composes a handoff URL targeting any other
registered sibling — passing input values, getting back either a ready-to-use
URL or a clear failure signal. The recipient sibling pays zero engineering
cost: the produced URL conforms to its existing native URL-state shape and
parses through its existing parser, indistinguishable from a URL the user
could have typed.

## Develop

```sh
npm install   # also fetches pinned sibling parsers as git submodules
npm test
```

`npm install` runs a `postinstall` hook that initializes the
`vendored/cron-dexli` and `vendored/regex-dexli` git submodules. Those
submodules carry each shipped sibling's production `src/lib/url-state.ts`
at a pinned SHA — the round-trip test suite imports those parsers by
reference (bar item 4) so cross-cycle drift is detected immediately when
a sibling's parser changes shape.

A fresh `git clone` of this repo alone is sufficient. No
`--recurse-submodules` flag required; `npm install` handles it.

## Add a sibling

See [`DISCIPLINE.md`](./DISCIPLINE.md) for the add-sibling procedure +
slug-stability promise + the three sender preconditions.

When you add a new sibling, also add it as a submodule at
`vendored/<sibling>-dexli` pinned to its current production SHA, and
extend the round-trip test suite to import the new submodule's parser.

## Design rationale

See `url-handoff-protocol-v1.md` (engine cycle-2 spec).

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the commit convention.
