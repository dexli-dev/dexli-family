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
npm install
npm test
```

## Add a sibling

See the discipline doc co-located with the family config (path TBD by engine
cycle-2 scope).

## Design rationale

See `url-handoff-protocol-v1.md` (engine cycle-2 spec).

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the commit convention.
