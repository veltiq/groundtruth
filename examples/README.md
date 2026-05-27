# Examples

Try groundtruth against a canned transcript:

```bash
npx @veltiq/groundtruth verify --transcript examples/phantom-change.jsonl --no-git
```

(`--no-git` makes the output deterministic by checking the claims against the
transcript's own tool calls only, rather than your current working tree.)

## `phantom-change.jsonl`

The assistant claims it added a `rateLimiter` middleware to `src/server.ts`,
fixed a bug, and added tests — but the only thing it actually did was edit
`README.md`. groundtruth flags all three checkable claims as **unsupported**.

This is the canonical case the tool exists for: confident prose, no
corresponding diff.
