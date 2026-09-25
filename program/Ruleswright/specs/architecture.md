# Architecture — Ruleswright

> **Status:** draft for builder approval — Architect, phase `architecture`.
> Read with `specs/idea.md`, `specs/requirements.md` (approved), and
> `specs/design.md` (approved, v2 — 18 surfaces). FR references throughout.
> **Design contract compliance is tracked at the bottom** — no corrections to
> approved design behavior were needed; see *Design Contract Ledger*.

---

## Stack Decision

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Language | TypeScript 5.x, strict mode, ESM first | Required by NFR-Platform/NFR-DX. `strict: true` + `noUncheckedIndexedAccess` — pack lookups by string id are exactly where unchecked indexing bites. |
| Framework | **None** | Headless library (FR-14: engine performs no I/O; hosts own storage/UI). A framework would be a dependency without a job. |
| UI Framework | None | No UI exists. The 18 design mocks are docs/data-contract surfaces, not implementation targets (design.md, *The Adaptation That Governs This Spec*). |
| State Management | Plain-JSON state + stateless engine functions, thin facades over it | FR-5/FR-14 demand character/party/combat state be plain serializable JSON with no hidden state. Decision detail below — this is the load-bearing state decision. |
| Database | **None.** No engine I/O of any kind | FR-14. The only persisted shapes are snapshots and packs — both plain JSON owned by hosts. The DB phase formalizes the pack data model as the persistence-adjacent contract; there are no migrations (schemaVersion *is* the migration story, deferred by design per FR-14/FR-23). |
| ORM / Data Layer | None | Nothing to map. Content-hash + schemaVersion checks live in `schema/version.ts`. |
| Build Tool | **tsup** (esbuild core, dts rollup) | Dual ESM/CJS output, per-entry builds matching the three subpath exports, near-zero config. Runtime-only bundle proof runs against its output in CI. |
| Test Framework | **Vitest** (node + browser modes) | TS/ESM-native, no jest transform friction. **Browser mode is not optional** — the determinism NFR (identical rolls on Node, browsers, Electron) is a cross-runtime test, and browser mode gives us real Chromium/Firefox/WebKit runs. |
| Lint/Format | ESLint (typescript-eslint, strict-type rules) + Prettier | Type-aware lint carries the security posture: `no-restricted-properties` bans `Math.random`, `eval`, `new Function`, `Date.now` in engine paths — the NFR-Security/no-ambient-randomness rules become CI-enforced, not aspirational. |
| Package Manager | pnpm + workspaces (single workspace for v1) | Deterministic installs; workspace ready if packaging ever splits (see Alternatives). |
| CI | GitHub Actions | Test matrix (Node LTS floor + current), browser determinism runs, bundle-isolation proof, FR-12 proof tests. |
| Deployment Target | npm package (ESM primary + CJS dual); Node LTS ≥ 20, evergreen browsers, Electron | NFR-Platform. No server exists. |

## Alternatives Considered

| Decision | Chosen | Rejected | Why |
|----------|--------|----------|-----|
| **Packaging mechanism** (the FR-22 question design explicitly left to this phase) | **Single package, subpath exports**: `ruleswright`, with `./runtime`, `./schema`, `./compiler` | Workspace packages (`@ruleswright/runtime` …); single barrel entry | Subpath exports meet FR-22 fully: separate entries, tree-shakeable, runtime-only consumption first-class. One version = one compatibility surface, which is what FR-23's single versioning discipline wants in v1. Workspace split buys independent release cadence v1 doesn't need, at the cost of install/version-sync friction. The isolation guarantee does not rest on bundler goodwill: **no file may re-export across surfaces** and CI fails if `generateCampaign` appears in the runtime-only bundle (design mock `packaging.html` is the spec of that check). |
| **DSL representation** | String mini-language, parsed at load into a validated AST (closed grammar, closed function registry) | JSON AST trees in pack data; JS function modules; `eval`/`new Function` | Pack authors hand-edit content (FR-19) — `"damage(1d8 + might)"` is authorable; an AST tree is hostile to hand-editing. Functions-in-packs violate NFR-Security outright. The parser runs once at load; parse/semantic failures are ErrorCards (FR-2), and combat never parses (see Performance). Grammar is closed and versioned with the schema — extension is a schema event, not an escape hatch. |
| **Schema validation** | Hand-rolled validator in `schema/` emitting ErrorCards | zod, ajv, typia | All are runtime dependencies; NFR-Dependencies is near-zero. Equally important: FR-2's error contract (artifact id + JSON path + rule + hint) is not what generic libraries emit — we would wrap every failure anyway. The validator is pure, dependency-free, and the compiler dogfoods the very same code (FR-17). |
| **Seeded RNG** | sfc32 (32-bit integer ops), string/number seed → deterministic hash (cyrb128-class) | `Math.random` + capture; mulberry32; crypto-based | FR-1: same seed + same call sequence ⇒ identical results across platforms. sfc32 is fast, state is four 32-bit ints (trivially JSON-exportable for FR-14), and pure-integer arithmetic avoids float rounding drift across engines. crypto is nondeterministic by contract. |
| **State representation** | Plain-JSON state objects; engine logic as functions operating on state; public API exposes thin facades (`char.derived()`) that wrap {state, runtime} | Class graphs with methods and private fields; ECS framework | FR-5/FR-14: state must be plain serializable JSON — no class instances, no closures. Facades give the ergonomic mock-API surface (`api-map.html`) while `serialize()` emits the plain state. An ECS framework is machinery the requirements never asked for. |
| **Build tool** | tsup | unbuild; raw `tsc`; vite lib mode | Per-entry dts + dual format with the least config. Raw tsc can't bundle or produce the single-file runtime bundle the CI proof consumes. |
| **Test framework** | Vitest | Jest | Jest + ESM + TS still requires transform archaeology; Vitest is native and its browser mode is the determinism contract's test vehicle. |

---

## Module Structure

Precise paths — Planner lifts these directly into its Module Registry.

```
program/Ruleswright/            ← library root (package.json lives here)
├── src/
│   ├── schema/                 — SURFACE 2: pack format (dependency of both others)
│   │   ├── pack.ts             — Pack document type: manifest, stats, actions, formulas,
│   │   │                         content, progression, bestiary, tables (the 8 sections)
│   │   ├── artifacts.ts        — per-artifact types: action, spell, condition, class,
│   │   │                         race, skill, feat, item, statblock, table
│   │   ├── error-card.ts       — ErrorCard {severity, artifactId, jsonPath, rule,
│   │   │                         message, hint?} + rule-id registry — THE error shape
│   │   ├── validate.ts         — structural + semantic validator (pure, all-at-once,
│   │   │                         never partial — FR-2). The compiler imports this.
│   │   └── version.ts          — schemaVersion contract + pack content hash
│   ├── core/                   — shared mechanics, exported only via the two surfaces
│   │   ├── rng.ts              — sfc32 PRNG, seed hashing, state export/import (FR-1)
│   │   ├── dice.ts             — dice recipes → structured RollResult
│   │   ├── dsl/
│   │   │   ├── formula.ts      — formula mini-language: parser → AST → evaluator
│   │   │   └── effect.ts       — effect mini-language: parser → AST → executor
│   │   └── tables.ts           — THE one table engine: weighted/ranged/nested (FR-15)
│   ├── runtime/                — SURFACE 1: the engine (imports compiler: never)
│   │   ├── runtime.ts          — Runtime: pack load via schema.validate, artifact
│   │   │                         index by id, compiled DSL cache, factories
│   │   ├── character.ts        — character state, derived stats, known spells, inventory
│   │   ├── progression.ts      — level-set + XP paths, multi-class, caps (FR-6)
│   │   ├── pools.ts            — drain pools + vancian bindings (FR-8)
│   │   ├── conditions.ts       — condition lifecycle, stacking, restricts (FR-7)
│   │   ├── combat/
│   │   │   ├── combat.ts       — Combat: stepwise loop, initiative, rounds (FR-10)
│   │   │   ├── action-economy.ts — generic slot/points economy, pack-declared (FR-4)
│   │   │   ├── resolve.ts      — effect execution: attack/save/damage/targeting (FR-3/9/11)
│   │   │   ├── spatial.ts      — optional spatial layer; absent = theater of mind (FR-11)
│   │   │   └── triggers.ts     — reactive actions on the event substrate (FR-4/13)
│   │   ├── events.ts           — typed emitter + provenance payloads (FR-13)
│   │   ├── encounter.ts        — threat-budget assembly, deterministic (FR-16)
│   │   ├── bestiary.ts         — statblocks → combatants, same machinery (FR-16)
│   │   └── snapshots.ts        — three serializers + loud-refusal load (FR-14)
│   ├── compiler/               — SURFACE 3: the generator (dev/host territory)
│   │   ├── generate.ts         — generateCampaign entry (FR-17)
│   │   ├── theme.ts            — theme template load + composition base+patches (FR-20)
│   │   ├── knobs.ts            — knob declarations, validation, provenance (FR-18)
│   │   ├── rng-stream.ts       — seed → per-stage deterministic RNG streams
│   │   ├── pipeline.ts         — stage registry: named, ordered, replaceable (Ext. 3)
│   │   ├── stages/             — the eight named stages (design mock `generation-pipeline.html`)
│   │   │   ├── stats.ts  skills.ts  feats.ts  classes.ts
│   │   │   └── magic.ts  bestiary.ts  tables.ts   (+ final validate stage = schema.validate)
│   │   └── themes/             — sample theme templates as JSON: dark-fantasy,
│   │                             zombie-urban (FR-21; data, not code)
│   └── index.ts                — root entry: re-exports the three subpath entries only;
│                                  contains no logic and no cross-surface barrel
├── tests/                      — Vitest; proofs/ holds the FR-12 trio + bundle check
└── package.json                — exports map: ".", "./runtime", "./schema", "./compiler"
```

## Module Contracts

### `src/schema` — the pack format
- **Owns:** the entire pack document contract; the ErrorCard shape and rule-id registry; the validator (structural + semantic, all-at-once, never partial); schemaVersion compatibility and pack content hash. The validator is the *only* gate a pack passes.
- **Exports:** `Pack`, per-artifact types, `ErrorCard`, `validatePack(json): ErrorCard[]`, `packContentHash(json)`, `checkSchemaVersion(pack, engineRange)`.
- **Depends on:** nothing (no internal imports — this is the deepest layer).
- **Key types:** `Pack`, `ErrorCard`, `ValidationResult = { ok: true; pack } | { ok: false; errors: ErrorCard[] }`.

### `src/core` — shared mechanics
- **Owns:** seeded RNG + state serialization (FR-1), dice recipes → structured results, both DSLs as parse-once/eval-many AST interpreters (FR-3), and the single table engine (FR-15 — the compiler has no second implementation).
- **Exports:** internal API consumed by runtime + compiler only; never re-exported at a surface root except `Rng`/`RollResult` types through runtime.
- **Depends on:** nothing (sibling of schema; the two never import each other).
- **Key types:** `Rng` (with `getState()/setState()`), `RollResult`, `FormulaAst`, `EffectAst`, `TableDef`.

### `src/runtime` — the engine
- **Owns:** everything stateful: characters, progression, pools/bindings, conditions, combat (loop, action economy, resolution, spatial, triggers), the event stream, encounter assembly, snapshots. All randomness through injected/core RNG; zero I/O; zero `Math.random`.
- **Exports:** the `ruleswright/runtime` surface — `Runtime`, `Character`, `Combat` facades + the three serializers (design mock `api-map.html` fixes coverage).
- **Depends on:** `schema` (validation, ErrorCard), `core` (rng, dice, dsl, tables). **Never imports `compiler` — CI-enforced.**
- **Key types:** `Runtime`, `CharacterState` (plain JSON), `CombatState` (plain JSON), `GameEvent` (with `why: { rule, rolls[] }`), `Snapshot` variants.

### `src/compiler` — the generator
- **Owns:** theme templates, knobs, composition (base + patches), the eight-stage pipeline, per-stage deterministic RNG streams, canonical serialization for byte-identical output, the two sample themes (FR-21).
- **Exports:** the `ruleswright/compiler` surface — `generateCampaign`, `listThemeKnobs`, pipeline/stage types for extension.
- **Depends on:** `schema` (its final stage *is* `schema.validatePack` — dogfooding without importing runtime), `core` (rng, tables).
- **Key types:** `ThemeTemplate`, `KnobDecl`, `GenerateOptions`, `Stage` ({ name, run(ctx) }).

### `src/index.ts`
- **Owns:** being dumb. Re-exports the three subpath entries; no logic, no cross-surface barrel.

## Data Flow

**Generation (compile time):**
`theme JSON + knobs + seed` → composition merge (FR-20) → stages 1–7 in order, each reading the theme, knobs, and its own RNG stream (`seed + stage name`), each contributing pack sections → stage 8 runs `schema.validatePack` (FR-2 via FR-17) → canonical serialization (stable key order) → `Pack`. Same inputs ⇒ byte-identical bytes.

**Load (play time, once):**
`Pack JSON` → `schema.validatePack` → all ErrorCards or nothing (never partial) → `Runtime` builds the id→artifact index and compiles every formula/effect string to an AST once.

**Play (per action):**
host declares action → pack validity checks (costs, conditions, spatial) → effect-DSL execution (rolls via injected RNG, saves, damage, conditions) → state mutation → typed event emitted with `why` (rule id + roll references) → triggers may fire from that event stream (FR-4/13). Combat advances stepwise; between any two steps the host may call `serialize()`.

**Snapshot:**
`{state, rng state, pack id + schemaVersion + contentHash}` → host stores anywhere. Load: identity check first; mismatch ⇒ loud refusal (ErrorCard `E-SNAP-01`), no mangled characters (FR-14).

## Dependency Flow

```
        ┌───────────┐               ┌───────────┐
        │ compiler  │               │  runtime  │
        └──┬─────┬──┘               └──┬─────┬──┘
           │     │                     │     │
           ▼     ▼                     ▼     ▼
      ┌────────┐ ┌──────────────────────┐ ┌──────┐
      │ schema │ │        core          │ │ ...  │  (schema and core are siblings:
      └────────┘ └──────────────────────┘ └──────┘   neither imports the other)
```

One-way DAG, two rules CI enforces:
1. `runtime` must never import `compiler` (the FR-22 isolation; the string check on the runtime bundle is the same rule from the artifact side).
2. `schema` and `core` import nothing internal — they are the stable base both surfaces share.

The trick that keeps the DAG clean: the compiler's validate stage consumes `schema.validate` directly, so the compiler never needs a runtime import to dogfood the validator (FR-17).

## API Design

No endpoints — no server exists. The public API is the three subpath surfaces; **coverage is the contract, signatures are illustrative until Coder pins them** (design mock `api-map.html`): compiler = `generateCampaign`, `listThemeKnobs`; runtime lifecycle = `new Runtime`, `createCharacter`, `awardXp`, `spawnMonster`, `assembleEncounter`, `startCombat`; character = `derived`, `knownSpells/slots/pools`, `applyTheme/removeTheme`, `prepare`, `serialize`; combat = `step`, `roundComplete`, `declare`, `respond`, `on/off`, `events.sinceRound`, `serialize`; tables = `rollTable`; errors = one `ErrorCard` shape everywhere. The whole area must fit one page — if it can't, it's too big.

## Security Posture

- **Authentication/Authorization:** none — there is no I/O, no network, no process boundary. The attack surface is malformed pack data, which is *trusted developer input* by requirement (Constraints), guarded structurally anyway.
- **No dynamic code execution:** no `eval`, no `new Function`, no data-driven imports — DSLs are AST-interpreted. Lint-enforced (`no-restricted-properties`), plus the FR-12 proof tests would catch any engine-side special-casing that drifted toward codegen.
- **Bounded work:** documented limits on DSL parse depth and table nesting depth so a pathological pack fails validation instead of hanging load. Validation is O(pack size).
- **Data at rest / in transit:** not ours — hosts own storage and transport entirely (FR-14).
- **Supply chain:** near-zero runtime dependencies (currently: zero). Dev tooling unconstrained per requirements.

## Performance Architecture

The budgets are NFR commitments; the architecture meets them by construction:
- **< 50 ms combat round (10 combatants):** all DSL parsing happens once at load, never during play; resolution is AST interpretation + integer PRNG.
- **< 2 s campaign generation:** stages are independent sections; canonical serialization is a single pass.
- **< 500 ms load+validate (sample pack):** single validator pass, hash computed once.
- **< 50 ms snapshot round-trip:** state is already plain JSON; serializing is `JSON.stringify` over it.

## Deployment Architecture

- **Target:** npm (`ruleswright`), subpath exports per the packaging decision. Dual ESM/CJS; TypeScript types ship alongside every entry.
- **Build:** `tsup` per entry → `dist/`; `exports` map in `package.json`; side-effect-free for tree-shaking.
- **Runtime:** consumer's process (Node ≥ 20, browser, Electron). The library never spawns, listens, fetches, or writes.
- **CI gates:** typecheck · lint security rules · unit + browser determinism matrix · FR-12 proof trio · runtime-bundle isolation (no `generateCampaign` string) · perf budgets as regression thresholds · sample-theme generation + validation for both FR-21 packs.

## Design Contract Ledger

How the approved design constrains this architecture — no corrections were needed:

| Design contract (design.md) | Architectural response |
|---|---|
| `packaging.html` — three surfaces; runtime-only bundle proof; mechanism left open | Subpath exports chosen; CI string-check implemented as specified; workspace split documented as the upgrade path |
| `api-map.html` — one page of coverage; ErrorCard shape; stepwise combat verbs | Coverage honored verbatim (see API Design); `ErrorCard` lives in `schema/error-card.ts` as the single shape; `declare/respond/step/on/sinceRound` all present |
| `generation-pipeline.html` — 8 named stages, stable interface, validate stage dogfooded | `stages/` matches the eight names exactly; stage 8 *is* `schema.validate`; `Stage` type is the stable interface |
| `dice.html` / FR-1 — injectable RNG, structured rolls, state in snapshots | sfc32 with exportable state; `Rng` injectable at `startCombat` and everywhere rolls occur |
| `snapshots.html` / FR-14 — three serializers, loud refusal, no I/O | `snapshots.ts` owns exactly three serializers; refusal is ErrorCard `E-SNAP-01`; the runtime contains no I/O code |
| `pack-anatomy.html` — 8-section pack, overrides, schemaVersion | `pack.ts` mirrors the 8 sections; overrides merge in `Runtime` at load, documented precedence, ids address artifacts |
| `combat-loop.html` / FR-4 — generic slot economy, classic structure as data | `action-economy.ts` implements slots/points generically; `turnSlots`/triggered actions are pack content |
| Expression policy (Q7/Q8) | Theme templates are authored coined content; nothing in the architecture mints or transforms names |

## Open Architectural Questions (builder input)

1. **Library root confirmation:** architecture assumes the package root is `program/Ruleswright/` (package.json + src/ + tests/ there). Confirm — or name a different root and this document's paths shift one level.
2. **Node floor:** I've set the minimum at Node 20 LTS (current maintenance line at time of writing). If you want a lower floor for Electron-adjacent users, say so now — it pins the tsup target and test matrix.

Everything else above is decided and documented with its trade-offs.