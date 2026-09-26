# Ruleswright

Headless TypeScript library: a one-line theme becomes a complete, playable d20-style
campaign pack — consumed by an embeddable party / character / combat runtime.

**Rules are data.** The engine implements mechanics generically; packs declare specifics.
No magic subsystem, no hardcoded action slots, no second table engine — packs declare
specifics, the engine interprets them.

- Zero runtime dependencies. Engine performs no I/O — hosts own storage, pacing, and UI.
- Deterministic to the byte: same theme + seed + knobs ⇒ byte-identical packs; same seed +
  same call sequence ⇒ identical rolls on Node, browsers, and Electron.

## Status

v1 core in active development. This README is a placeholder — the runnable quickstart
lands with the packaging release (S08).

## Development

```sh
pnpm install
pnpm typecheck   # tsc --noEmit over src/ + tests/
pnpm lint        # ESLint, including the engine hygiene rules (no Math.random/eval/Date.now under src/)
pnpm test        # Vitest (node environment)
```

Engine determinism contract: all randomness flows through the seeded, injectable RNG
(`core/rng`) whose state serializes as four uint32 words — snapshots carry it so a
resumed fight rolls the same future as an uninterrupted one.