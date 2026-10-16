# Architecture — Ruleswright

> **Status:** approved architecture with scoped random-adventures Author amendment (2026-10-16).
> Revised in review: **Node floor set at 18 LTS (Electron-adjacent)** — builder
> decision. **Library root corrected to the repo root (`./`)** per builder —
> package.json, `src/`, and `tests/` live at the repository root; `program/Ruleswright/`
> holds program artifacts (specs, mocks) and is never part of the shipped package.
> Read with `specs/idea.md`, `specs/requirements.md` (approved), and
> `specs/design.md` (approved, v3 — 21 surfaces). FR references throughout.
> **Design contract compliance is tracked at the bottom** — no corrections to
> approved design behavior were needed; see *Design Contract Ledger*.
> **revised 2026-10-05 — Architect re-entry (class-features, builder-authorized
> 2026-10-04):** file locations updated for the v1-shell `validate/` split, the
> combat-decomposition `combat/` and `snapshots/` splits, and the class-features
> `features.ts` leaf; also `wyldwood` added to the sample `themes/` list and
> known-spell derivation attributed to `pools.ts` (fed by `features.ts`), not
> `character.ts`; no boundary or contract change.

---

## Stack Decision

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Language | TypeScript 5.x, strict mode, ESM first | Required by NFR-Platform/NFR-DX. `strict: true` + `noUncheckedIndexedAccess` — pack lookups by string id are exactly where unchecked indexing bites. |
| Framework | **None** | Headless library (FR-14: engine performs no I/O; hosts own storage/UI). A framework would be a dependency without a job. |
| UI Framework | None | No UI exists. The 21 design surfaces are docs/data-contract surfaces, not implementation targets (design.md, *The Adaptation That Governs This Spec*). |
| State Management | Plain-JSON state + stateless engine functions, thin facades over it | FR-5/FR-14 demand character/party/combat state be plain serializable JSON with no hidden state. Decision detail below — this is the load-bearing state decision. |
| Database | **None.** No engine I/O of any kind | FR-14. Persisted shapes are snapshots, packs and separate adventure templates/definitions — plain JSON owned by hosts. The DB phase formalizes the pack data model as the persistence-adjacent contract; there are no migrations (schemaVersion *is* the migration story, deferred by design per FR-14/FR-23). |
| ORM / Data Layer | None | Nothing to map. Content-hash + schemaVersion checks live in `schema/version.ts`. |
| Build Tool | **tsup** (esbuild core, dts rollup) | Dual ESM/CJS output, per-entry builds matching the three subpath exports, near-zero config. Runtime-only bundle proof runs against its output in CI. |
| Test Framework | **Vitest** (node + browser modes) | TS/ESM-native, no jest transform friction. **Browser mode is not optional** — the determinism NFR (identical rolls on Node, browsers, Electron) is a cross-runtime test, and browser mode gives us real Chromium/Firefox/WebKit runs. |
| Lint/Format | ESLint 10 flat config (typescript-eslint recommended, non-type-aware) + Prettier | Restricted-property lint carries the security posture: `no-restricted-properties` bans `Math.random`, `eval`, `new Function`, `Date.now` in engine paths — the NFR-Security/no-ambient-randomness rules become CI-enforced, not aspirational. |
| Package Manager | pnpm + workspaces (single workspace for v1) | Deterministic installs; workspace ready if packaging ever splits (see Alternatives). |
| CI | GitHub Actions | Test matrix (Node 18 floor + current LTS), browser determinism runs, bundle-isolation proof, FR-12 proof tests. |
| Deployment Target | npm package (ESM primary + CJS dual); Node ≥ 18 LTS floor (Electron-adjacent; builder decision), evergreen browsers, Electron | NFR-Platform. No server exists. |

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
| **Library root** | **Repository root (`./`)** — builder decision in review | `program/Ruleswright/` | The repo *is* the package; program artifacts are project bookkeeping. With the root at `./`, `package.json` must carry a strict `files` field (`dist`, `README`, `LICENSE`) so `program/` and agent docs never enter the npm tarball. |

---

## Module Structure

Precise paths — Planner lifts these directly into its Module Registry.
**All paths are repository-relative; the repo root is the package root.**

```
./                              ← repo root = library root (package.json lives here)
├── src/
│   ├── schema/                 — SURFACE 2: pack format (dependency of both others)
│   │   ├── pack.ts             — Pack document type: manifest, stats, actions, formulas,
│   │   │                         content, progression, bestiary, tables (the 8 sections)
│   │   ├── artifacts.ts        — per-artifact types: action, spell, condition, class,
│   │   │                         race, skill, feat, item, statblock, table
│   │   ├── error-card.ts       — ErrorCard {severity, artifactId, jsonPath, rule,
│   │   │                         message, hint?} + rule-id registry — THE error shape
│   │   ├── validate/           — structural + semantic validator (pure, all-at-once,
│   │   │                         never partial — FR-2), one module per pass/section
│   │   │                         (index.ts, sections/*.ts). The compiler imports this.
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
│   │   ├── character.ts        — character state, derived stats, inventory
│   │   ├── progression.ts      — level-set + XP paths, multi-class, caps (FR-6)
│   │   ├── features.ts         — class features: granted feats, unlocked actions/spells,
│   │   │                         derived from progression tables (FR-6, v1.10)
│   │   ├── pools.ts            — drain pools + vancian bindings (FR-8); known spells
│   │   │                         (FR-9; class-feature unlocks via features.ts)
│   │   ├── character-profile.ts — profile/balances and explicit item/spell settlement
│   │   ├── inventory.ts        — item/loot writers through the shared table engine
│   │   ├── equipment.ts        — equip/use gates and derived equipment view
│   │   ├── feats.ts            — learned feats and slot caps; features.ts reads grants
│   │   ├── display-roll.ts     — roll strings used in event provenance
│   │   ├── conditions.ts       — condition lifecycle, stacking, restricts (FR-7)
│   │   ├── combat/
│   │   │   ├── combat.ts       — Combat: startCombat, the public verbs, turn advance;
│   │   │   │                     stepwise loop, initiative, rounds (FR-10)
│   │   │   ├── fight.ts        — FightCore: the fight's shared mutable state + primitives
│   │   │   ├── declare.ts      — declare gates + spend helpers (restriction, target,
│   │   │   │                     reach, range, slot pick)
│   │   │   ├── execute.ts      — effect execution over FightCore: bound effects,
│   │   │   │                     action resolution, end rule
│   │   │   ├── movement.ts     — movement + terrain: move gate, path walk (FR-11)
│   │   │   ├── action-economy.ts — generic slot/points economy, pack-declared (FR-4)
│   │   │   ├── resolve.ts      — effect execution: attack/save/damage/targeting (FR-3/9/11)
│   │   │   ├── spatial.ts      — optional spatial layer; absent = theater of mind (FR-11)
│   │   │   ├── triggers.ts     — reactive actions on the event substrate, trigger
│   │   │   │                     answering (FR-4/13)
│   │   │   ├── types.ts        — combat types: plain-JSON combat state, verb shapes
│   │   │   └── combatants.ts   — pure combatant facts: down/defeat, profile, reach
│   │   ├── events.ts           — typed emitter + provenance payloads (FR-13)
│   │   ├── encounter.ts        — threat-budget assembly, deterministic (FR-16)
│   │   ├── bestiary.ts         — statblocks → combatants, same machinery (FR-16)
│   │   └── snapshots/          — three serializers + loud-refusal load (FR-14)
│   │       ├── index.ts        — the public names (serialize/restore per envelope)
│   │       ├── envelope.ts     — pack-identity gate (E-SNAP-01/02)
│   │       ├── character.ts    — character + party envelopes
│   │       └── combat.ts       — combat envelope
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
│   │                             zombie-urban, wyldwood (FR-21; data, not code)
│   └── index.ts                — root entry: re-exports the three subpath entries only;
│                                  contains no logic and no cross-surface barrel
├── tests/                      — Vitest; proofs/ holds the FR-12 trio + bundle check
├── program/Ruleswright/        — program artifacts: specs/, mocks/, PROGRAM-CONFIG —
│                                  project bookkeeping; excluded from the npm tarball
└── package.json                — exports map: ".", "./runtime", "./schema", "./compiler";
                                   strict `files` field: [dist, README, LICENSE]
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
- **Key types:** `Runtime`, `CharacterState` (plain JSON), `CombatState` (plain JSON), `RuntimeEvent` (with `why: { rule, rolls[] }`), `Snapshot` variants.

### `src/compiler` — the generator
- **Owns:** theme templates, knobs, composition (base + patches), the eight-stage pipeline, per-stage deterministic RNG streams, canonical serialization for byte-identical output, the three bundled themes (dark-fantasy, zombie-urban, wyldwood).
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
- **Build:** `tsup` per entry → `dist/`; `exports` map in `package.json`; side-effect-free for tree-shaking. Build target **es2020** (Node 18 floor + evergreen browsers). **Strict `files` field** (`dist`, `README`, `LICENSE`) — with the package root at the repo root, this is what keeps `program/` and tooling docs out of the published tarball.
- **Runtime:** consumer's process (Node ≥ 18, browser, Electron). The library never spawns, listens, fetches, or writes.
- **CI gates:** typecheck · lint security rules · unit + browser determinism matrix · FR-12 proof trio · runtime-bundle isolation (no `generateCampaign` string; extend to `generateAdventure` with S02) · perf budgets as regression thresholds · sample-theme generation + validation for all three bundled packs.

## Design Contract Ledger

How the approved design constrains this architecture — no corrections were needed:

| Design contract (design.md) | Architectural response |
|---|---|
| `packaging.html` — three surfaces; runtime-only bundle proof; mechanism left open | Subpath exports chosen; CI string-check implemented as specified; workspace split documented as the upgrade path |
| `api-map.html` — one page of coverage; ErrorCard shape; stepwise combat verbs | Coverage honored verbatim (see API Design); `ErrorCard` lives in `schema/error-card.ts` as the single shape; `declare/respond/step/on/sinceRound` all present |
| `generation-pipeline.html` — 8 named stages, stable interface, validate stage dogfooded | `stages/` matches the eight names exactly; stage 8 *is* `schema.validate`; `Stage` type is the stable interface |
| `dice.html` / FR-1 — injectable RNG, structured rolls, state in snapshots | sfc32 with exportable state; `Rng` injectable at `startCombat` and everywhere rolls occur |
| `snapshots.html` / FR-14 — three serializers, loud refusal, no I/O | `snapshots/` (`index.ts` re-exports `envelope`/`character`/`combat`) owns exactly three serializers; refusal is ErrorCard `E-SNAP-01`; the runtime contains no I/O code |
| `pack-anatomy.html` — 8-section pack, overrides, schemaVersion | `pack.ts` mirrors the 8 sections; overrides merge in `Runtime` at load, documented precedence, ids address artifacts |
| `combat-loop.html` / FR-4 — generic slot economy, classic structure as data | `action-economy.ts` implements slots/points generically; `turnSlots`/triggered actions are pack content |
| Expression policy (Q7/Q8) | Theme templates are authored coined content; nothing in the architecture mints or transforms names |

## Open Architectural Questions

1. ~~**Library root**~~ — **Resolved in review:** repo root (`./`) is the package root; paths in this document are repository-relative; `files` field pins the tarball.
2. ~~**Node floor**~~ — **Resolved in review (builder):** floor set at **Node 18 LTS**, the widest Electron-adjacent line. Consequences: tsup/esbuild target **es2020**; CI matrix = Node 18 / 20 / 22. Recorded trade-off: Node 18 is past upstream EOL — this floor is chosen for reach, not support policy; the browser determinism matrix remains the real compatibility story.

Everything else above is decided and documented with its trade-offs.
## Approved random-adventures composition — AR-01–AR-06 (2026-10-16)

Authority: the presented packet was approved by “start”; “i authorize it” authorizes this deliberate Author re-entry. FR-24–29 and design v3 constrain this section. These are implementation contracts, not realized APIs or proof of capability. Existing low-level APIs, pack/override fields, generated pack bytes, stack, package and three subpaths remain unchanged. No provider, database, migration, application transport or runtime dependency is introduced.

### Precise ownership and connections

| Module | Planned paths | Producer → consumer; dependency |
|---|---|---|
| M01 schema | `src/schema/play-session.ts` | Portable EncounterSetup, EncounterSessionOptions and snapshot mirrors/validators → M03 play and M04 generation. Imports schema only; does not roll tables or instantiate Runtime. |
| M01 schema | `src/schema/adventure.ts` | AdventureTemplate, AdventureDefinition, AdventureStartOptions and portable identity/policy mirrors/validators → M04 generator and M03 adventure. Composition of play-session DTOs; no core/runtime values. |
| M03 runtime | `src/runtime/play/{session,encounter,settlement,snapshot}.ts` | createEncounterSession → real assembleEncounter/spawnEncounter → detached profileFromCharacter/startCombat → command routing → staged settlement → whole snapshot/restore. Uses M01/M02 and existing M03 writers. |
| M04 compiler | `src/compiler/adventure.ts`, `adventure-templates.ts`, `adventure-templates/{dark-fantasy,zombie-urban,wyldwood}.json` | Separate generateAdventure + static loadAdventureTemplate registry → validated definition. Uses M01 and the existing M02 Rng/rollTable; never imports M03. Existing generateCampaign pipeline unchanged. |
| M03 runtime | `src/runtime/adventure/{types,adventure,choices,rewards,snapshot}.ts` | Definition + members → node/choice guards → S01 encounter aggregate → earned reward roll/claim → existing awardXp/grantItem/rest/prepare/equipment writers → whole adventure snapshot. |
| M03 runtime | `src/runtime/combat/preview.ts`, existing `combat/{combat,declare,movement}.ts` | Side-effect-free shared legality result → production declare and bounded candidates. No trial declaration, speculative event emission or independent AI rules engine. |
| M03 runtime | `src/runtime/adventure/{director,narration}.ts` | Saved policy + legal candidates → actual aggregate dispatch; committed journal → pure narrated messages; acknowledgement → aggregate dispatch. |

Barrels export only their own surface. M05 remains dumb re-export composition. These additions preserve module edges M03→M01/M02 and M04→M01/M02. New paths are declared, not realized; Planner reconciles the module registry separately. Contracts under `src/schema/contracts/` remain DB-owned.

### Public call contract (synchronous; no endpoints)

```ts
// schema surface: portable data only
EncounterSessionOptions = { sessionId: string; seed: string | number;
  members: readonly { memberId: string; character: CharacterSnapshot }[];
  setup: EncounterSetup };
AdventureStartOptions = { adventureId: string; seed: string | number;
  members: readonly { memberId: string; character: CharacterSnapshot }[] };
// compiler surface
generateAdventure({ pack, template, seed }): AdventureDefinition;
loadAdventureTemplate(id: string, pack: Pack): AdventureTemplate;
// runtime surface
createEncounterSession(pack: Pack, options: EncounterSessionOptions): EncounterSession;
restoreEncounterSession(pack: Pack, snapshot: unknown): EncounterSession;
createAdventure(pack: Pack, definition: AdventureDefinition, options: AdventureStartOptions): Adventure;
restoreAdventure(pack: Pack, definition: AdventureDefinition, snapshot: unknown): Adventure;
// both facades
view(): EncounterSessionView | AdventureView; // actual facade returns its own variant
serialize(): PlaySessionSnapshot | AdventureSnapshot; // detached object, never string
// dispatch returns that facade's view, journal suffix and optional receipt
// {ok:true,revision,events,view,receipt?} | {ok:false,revision,errors,events:[],view}
advanceSolo(adventure: Adventure, options: { maxSteps: number }): SoloResult;
readNarration(adventure: Adventure): readonly NarrationMessage[];
```

The bundled registry stores immutable recipe literals with the template fields except `pack`. `loadAdventureTemplate(id, pack)` copies one recipe, attaches the explicitly supplied effective pack identity, validates every content/layout/policy reference against that pack, and returns the bound template. It performs no I/O. This refines the proposed new signature because static JSON cannot carry the hash of every possible generated/overridden pack. Host-authored complete templates remain valid inputs. `generateAdventure` refuses a foreign bound template; it never silently rebinds one. Runtime consumes only the resolved definition and never this registry.

Creation/restore failure throws RuntimeRuleError carrying located ErrorCards. Dispatch refusal returns the explicit `ok:false` shape above; it is not a successful transition. No new rule registry entry: shape/ref/economy/spatial errors use existing families, snapshot semantics E-SNAP-01, unsupported snapshot version E-SNAP-02. Each successful mutation increments revision once; idempotent receipt lookup/ack of the already-acknowledged sequence leaves revision and journal unchanged. Validate expectedRevision before considering idempotence; stale retries refuse. All numeric counters are nonnegative safe integers; reject exhaustion rather than overflow.

**Encounter commands:** every variant carries `{sessionId, expectedRevision, type}`. `advance` has no extra fields; `declare` carries `{actor,actionId,options?}` (existing targetId/at/to); `use` carries `{actor,itemId,targetId?}`; `respond` carries `{actor,triggerId,choice:'take'|'decline',targetId?}`; `pass` carries `{actor}`; `finalize` and `abandon` have no extra fields; `next` carries `{setup}`. Actor is `{kind:'member',memberId}` or `{kind:'enemy',enemyId}`. Resolve member to saved combatant binding; enemyId is its stable combatant id. Targets are combatant ids. Only the active actor or the owner of the named offer may act. `advance` performs one needed turn transition, never calls step to refresh an already-started turn. `pass()` is the additive low-level verb, using the existing end-turn path and refusing pending offers/terminal combat.

**Adventure commands:** each carries `{adventureId,expectedRevision,type}`. `choose` adds `{nodeId,choiceId}`; `encounter` adds `{encounterId,command}` where command is a complete encounter command with its expectedRevision; `claim-reward` adds `{nodeId,rewardId,claimId,recipientMemberId?}` (required for a loot-bearing reward, even a no-item roll; forbidden when no loot); `rest` adds `{nodeId}` and applies existing rest to the party once at that node; `prepare` adds `{nodeId,memberId,spellId,slotIndex?}`; `equip` adds `{nodeId,memberId,itemId,slot}`; `unequip` adds `{nodeId,memberId,slot}`; `use-item` adds `{nodeId,memberId,itemId}` for the existing out-of-combat self-use operation; `abandon` adds nothing; `ack-narration` adds `{throughSequence}`. XP amounts, reward outcomes, eligibility, policy and current location are never command authority. Unknown keys/variants refuse. S03 exposes only implemented legal commands; S04 supplies the director and acknowledgement/narration consumers before claiming those capabilities.

**Views:** EncounterSessionView is `{sessionId,revision,phase,members,combat,availableCommands,result,settlement}`. Members are `{memberId,character,combatantId}`; combat is `{state,pendingOffers}` with detached actual CombatState and PendingTrigger data. AdventureView is `{adventureId,revision,phase,nodeId,objective,members,combat,choices,pendingRewards,availableCommands,journalSequence,narrationAck}`. `choices` rows are `{choiceId,text,toNodeId,available,reason}` (reason ErrorCard or null), pendingRewards are `{claimId,nodeId,rewardId,eligibleMemberIds,roll}`. `availableCommands` lists discriminant strings, not fabricated legal targets/actions; S04 adds a pure bounded candidate accessor within the session implementation. During combat views project injury/conditions/remaining resources from raw combat plus original member baseline; serialize preserves both representations in their proper roles. No mutable Character/Combat/Runtime escapes.

**Solo/narration:** SoloResult is `{reason,stepsUsed,events,view}`. Reasons: awaiting-player, awaiting-choice, completed, defeated, **abandoned**, budget-exhausted, stalled. Positive safe maxSteps is an explicit work budget; policy bounds candidates. One attempted automated transition counts one step; pure guards terminate over a finite candidate set. Persist no-progress detection and decision count so splitting budgets cannot change choices. Stop at player-owned turns/offers, routes, recipients and preparation. NarrationMessage is `{messageId,sequence,templateId,event,text}`; one per journal entry after narrationAck, including factual fallback (`templateId:null`). Message id is the canonical JSON tuple `[adventureId,sequence]`. Reads do not draw entropy or acknowledge. `why.rolls` remains existing display strings. Negative damage is healing. Acknowledgement has no journal event of its own (avoids an endless narration acknowledgement cycle); it changes revision/cursor only.

### Data authority, restore and transactions

| Subject | Actual source constraint / mismatch | Required mapping and proof |
|---|---|---|
| Character injury | `snapshots/character.ts` omits hp and reconstructs via reserveValue; profile/equipment use real current HP. Recorded 3/2→27/0 probe contradicts FR-14. | DB adds optional signed current/nonnegative temp; S01 writes/restores exactly, legacy absence unchanged. Before id allocation validate every member. Negative/above-max/temp and second-fight proofs required. |
| Conditions | character `{conditionId,duration}` → snapshot `{id,remaining}` exists; StartCombatRequest currently has no initial conditions. | Optional `conditions` beside profile/balances on each start entry; copy/validate before initiative, then transfer final remaining durations back. Fix item duration before emitting the condition event; no new unit/vocabulary. |
| Raw combat | `serializeCombat` returns array combatants, scalar hp, `slotsUsed` remaining, spend deltas, phase/offeredCount/offers. Restore requires original profiles/balances and current positions/terrain. | Aggregate embeds the raw envelope plus saved restore inputs. It must not serialize live CombatState as CombatSnapshot or reconstruct original balances from settled members. Pairing uses the specific encounter id; exact side/order/instance identity sets must agree. |
| Abandon | Existing settleItemUses/settleSpellCasts refuse before combat-over. | Aggregate abandonment stages validated spend via existing character writers/direct pool and binding settlement rules, plus HP/conditions and an abandonment receipt, without forging combat-over or changing low-level settlement APIs. Keep raw fight snapshot for audit; aggregate phase/result controls terminality. No success rewards. |
| Reward | rollLoot returns TableOutcome `{ok:true,value}` with no per-roll trace; grantLoot refuses flavor. | Stage successful value + tableId + RNG before/after + normalized item/no-item result; never invent dice/entry indices. Use existing grantItem and awardXp against staged members, not grantLoot's rerolling helper. Roll and claim are distinct commits; save before retry. |
| Reward progression side effects — B-RA-XP resolved by approved continuity | `progression.ts:applyProgression` replaces all slot bindings with null and resets current HP; `awardXp` calls it on every positive award, even without a level change. Zero awards refuse. | AR-01/04 and FR-26/27 already require injury/resource continuity. Skip awardXp for zero XP; otherwise stage the real writer, retain its XP/class split/caps/level/saves calculations, preserve exact current/temp HP and existing prepared bindings at their slot levels/indices, and leave newly gained capacity empty. Preserve existing pools/conditions/inventory except the explicit awarded item. Reject the entire transaction if old preparation cannot fit resulting capacity. Low-level awardXp stays unchanged; S03 c3/c4 owns adapter implementation and proof. |
| Movement | resumeMove skips all first-edge checks today, losing a changed threatener. | Optional offeredDepartures records exact edge/reactor tuples, carried through types and raw writer/reader. S04 changes live and restored suppression together; old omission retains documented fallback. |

A facade owns isolated Runtime instances and copied state. Validate command → stage all member/fight/RNG/journal mutations privately → validate result → replace the aggregate once → return committed events. A failed second-member debit publishes no first-member changes, receipt, RNG or event. Low-level rejection events may be observed within staging and returned as ErrorCards, but never appended to the committed journal. No external subscriber runs against staging. Definition/pack digests identify content; they are not cryptographic tamper authentication. Validate cross-field consistency; do not claim protection against an attacker rewriting an entire coherent document.

**Adventure reward adapter (S03 c3/c4).** `claim-reward` in `adventure.ts` passes the saved claim and eligible member set to `rewards.ts`. Capture each staged member's exact HP, slot bindings and resource state before calling real `awardXp` on its isolated Runtime/character. Keep the returned progression calculations and resulting slot capacities, restore current/temp HP without clamping (including negative or above-derived-max current HP), and copy each old non-null binding to the same spell-level/index. If that position no longer exists, refuse the whole claim; never move, truncate or silently discard preparation. Remaining/new slots are null. Pool balances, condition durations, known spells, held feats and equipment stay unchanged; only the explicit saved loot grant may change inventory through real `grantItem`. No implicit rest, preparation, healing or condition tick occurs. Buffer all writer events until every member and the receipt validate, then commit once. On any failure, discard staged mutations/events and retain the pending claim and its already-saved roll. The snapshot writer hashes/serializes the preserved post-adapter members; restore reads those exact HP/bindings/resources with the existing claim/receipt guards, without rerunning reward writers.

**Prior discovery disposition.** The initial Author receipt classified B-RA-XP as R4 and requested a product decision. The source finding above remains valid; lease revision 2 supersedes that classification using the already-approved continuity contract. This is fixed-contract adapter work, not a new approval or a change to direct low-level progression behavior.

Encounter selection calls existing assembly unchanged (12-enemy hard ceiling). Setup declares maxPartySize/maxEnemies and fixed placement arrays; preflight must prove the budget/positive minimum threat cannot generate more than maxEnemies (bounded by 12) and the layout fits maximum party/enemies, then reject a violating actual selection. Do not truncate, reroll, scale by party, silently relocate or alter the low-level heuristic. Allocate party combatant ids `m:<memberId>` and enemy ids `e:<encounterIndex>:<ordinal>` in saved member order and sorted group/instance order. These namespaces are disjoint even if pack/statblock ids collide. Member ids stay independent of reminted Character.id. Encounter id = canonical JSON tuple `[sessionId,encounterIndex]`; `pairsWith` equals it. Keep original character id binding for audit; remap reconstructed Runtime ids to stable subjects for dispatch/journal before publication. Reopening cannot rely on Runtime mint order.

A session retains current encounter entry member snapshots plus raw combat and current spatial state until settlement. Settled member envelopes and a receipt are committed atomically; original inputs stay frozen for audit/restore. The raw combat keeps pre-settlement spend; settlement helpers may clear only staged working copies. `next` requires a settled victorious encounter and starts a new one with the updated party; terminal defeat/abandon cannot be bypassed. Adventure nests the active encounter and retains receipts after leaving it. A ready encounter node cannot resolve without its real terminal result; route traversal does not roll or infer success. Rest policy and reward eligibility come exclusively from the definition and saved progress. The whole JSON save is the unit of storage; older reopened saves are branches.

### Determinism and proof seams

DB fixes canonical seed-domain spellings and all persisted counters/streams. Generation uses bounded authored spine/branch construction, not retry-until-connected. One existing rollTable implementation serves descriptor and loot tables. Integer table weight sums must fit the existing RNG's 2^32 bound; reject larger totals rather than hanging its rejection loop. Runtime never imports compiler/template registry. Candidate preview retains production gate order and never evaluates random validity by drawing a speculative roll; reject unsupported random validity in the new solo policy domain with a located error, preserving low-level behavior.

Required producer/consumer proofs remain S01 c3/c5 (built runtime → combat → JSON reopen → second encounter), S02 c2 (built compiler → exact definition validator, three templates and compatible authored pack), S03 c2/c4 (generated node → real encounter → reward/progression → reopen), S04 c2/c3/c4 (movement resume, real enemy commands, factual journal/ack). Node/browsers/Electron evidence and runtime isolation stay with the planned implementation checkpoints. Author schema conformance does not clear these proofs. No new harness/service is needed: synchronous exported ESM/CJS calls, detached JSON and fresh facade instances are the real transport/restart boundary.

S03 c3/c4 must additionally prove positive XP without a level change preserves exact HP/temp, bindings and resources; level-up retains real XP/split/caps/levels/saves with newly gained slots null; incompatible preparation or a later member's failure commits nothing for any member, receipt, revision, RNG or journal; and JSON reopen/retry preserves both pending rolls and claimed post-adapter state without duplicate awards. Use injured/prepared members and verify low-level awardXp remains unchanged. These are required implementation assertions, not Author verification results.

### Downstream reconciliation required before dispatch

S01/CA-01–02 must adopt exact DB sidecar shapes, original-vs-current member authority, namespace/pairing, raw CombatSnapshot and explicit abandon adapter; low-level settlement cannot implement abandon by itself. S02/CA-03 must consume the same EncounterSetup, finite authored construction, effective-pack identity and canonical digest. S03/CA-04 must use exact claim/receipt subjects, once-staged TableOutcome+RNG, journal and nested encounter validation, plus the resolved B-RA-XP adapter and c3/c4 assertions above; remove the pending-product-decision gate while retaining implementation/proof gates. S04/CA-05 must preserve saved departure tuples, pure shared legality, explicit abandoned yield, director no-progress state and narration acknowledgement; dependent solo reward paths consume the same preservation contract. Reconcile every copied prompt and CA, not only this handoff. Existing PROGRAM-CONFIG/arch/STATE remain read-only here.
