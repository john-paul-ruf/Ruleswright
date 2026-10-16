# Ruleswright — Architecture Record

> Realized source: `6d919f3` (random-adventures close). Reconciled on 2026-10-16
> from the Final Report at `b4089b3`, the complete feature STATE, all four session
> prompts, approved sources, source and proof assertions, and VERIFICATION at
> `26510c4`. This is the synthesis after fifteen feature cycles. Earlier deltas
> and detailed decision history remain in git and the feature records.
>
> All six local random-adventures capabilities and CA-01–05 are verified. The
> feature verification has 56 verified rows, with no failed, blocked or
> present-unverified rows **within its declared local scope**. Remote Actions
> evidence B-BD-1 remains unverified; older unused nested loot references remain
> content debt. Neither is silently cleared by the local result.
>
> Execution results below are inherited from the committed receives and feature
> verification, not fresh executions by this documentation pass. Source and
> assertion inspection is distinguished from execution evidence.

## Module registry and dependency boundary

Value edges were derived from every tracked non-test `src/**/*.ts` file with the
TypeScript parser: drop `import type`/`export type` and fully type-only named
clauses, retain mixed/value clauses, resolve relative files and directory indexes,
and treat value `export … from` as imports. At `6d919f3` this covers **93 files**.
A symbol's consumer search is a separate question and was not used to derive edges.

| ID | Area | Path / TypeScript files | Cross-module value imports | Principal implementation |
|---|---|---|---|---|
| M01 | Schema | `src/schema/` / 21 | none | pack/artifacts/errors/version/overrides; `validate/`; `play-session.ts`; `adventure.ts`; barrel; six JSON contracts alongside these files |
| M02 | Core | `src/core/` / 9 | none | rng/dice/tables; `dsl/{shared,registry,formula,effect,checker}.ts`; internal barrel |
| M03 | Runtime | `src/runtime/` / 43 | M01, M02 | runtime/character/progression/pools/conditions/events; inventory/equipment/features/feats; profiles/bestiary/encounter; `combat/`, `snapshots/`, `play/`, `adventure/`; barrel |
| M04 | Compiler | `src/compiler/` / 19 | M01, M02 | campaign pipeline and seven stages; theme loading/composition; `adventure.ts`, `adventure-templates.ts`; bundled theme and adventure-template JSON; barrel |
| M05 | Root | `src/index.ts` / 1 | M01, M03, M04 | three value re-exports, no orchestration logic |

There are seven cross-module value edges. Schema and core are sibling leaves;
core's schema references are type-only. Runtime never imports compiler, and
compiler never imports runtime. Campaign stage 8 is the schema validator with
the core DSL checker. Adventure generation uses the same schema/core boundary.
`scripts/check-runtime-isolation.mjs` checks both built runtime formats for
**both** `generateCampaign` and `generateAdventure`, and requires declarations.
Its ten subprocess self-tests include missing-artifact and forbidden-symbol
negative controls (`09e9766`). No runtime dependency or package entry was added.

Inside M03, composition is explicit:

- `play/session.ts` composes encounter construction, snapshot reconstruction,
  settlement and the real combat engine. `play/snapshot.ts` and
  `play/settlement.ts` reference each other for validation and reconstruction.
- `adventure/adventure.ts` composes the real encounter facade, choices,
  rewards and saved aggregate validation. `adventure/snapshot.ts` reconstructs
  those facts using runtime writers/readers; it is not an independent mock model.
- `adventure/director.ts` consumes the adventure context, bounded encounter
  candidates, geometry and combat previews. `adventure/narration.ts` consumes
  the adventure context and saved journal facts through `choices.ts`.
- `combat/preview.ts` shares legality with `combat.ts` and `triggers.ts`, using
  `declare.ts`, `execute.ts`, `movement.ts` and `combatants.ts`. The combat
  implementation does not import the adventure or play facade.
- Existing `character.ts` ↔ `progression.ts` value references remain lazy;
  `features.ts` has no value imports. `feats.ts`, `pools.ts` and
  `character-profile.ts` consume features. Equipment/condition/display-roll
  helpers retain their existing lower-level responsibilities.

These are intra-module edges, not additional registry modules. The old
pre-preview combat import table and duplicated historical graph fragments have
been replaced by this current composition account.

## Public surfaces and host responsibilities

`package.json` publishes `ruleswright`, `ruleswright/schema`,
`ruleswright/runtime` and `ruleswright/compiler`, as ESM/CJS with declarations.
The root is a dumb re-export of the three subpath barrels. There is **no published
`ruleswright/core` subpath** and the root does not export `Rng`. Engine RNG
injection and serialized RNG state are supported seams; a repo-internal core
import is not a published package entry.

- **Schema:** pack/artifact types, overrides, version/hash/error helpers,
  `validatePack`, spatial/equipment/progression types, portable encounter and
  adventure DTOs, and their located validators. `RULE_IDS` remains 15 entries.
- **Compiler:** `generateCampaign`, theme registry/loading/composition and
  pipeline helpers, `GenerationError`, plus `loadAdventureTemplate(id, pack)`
  and `generateAdventure({pack, template, seed})`.
- **Runtime:** Runtime/Character; progression, pools, preparation/casting,
  inventory/loot, equipment, conditions, features/feats and EventStream;
  profiles/bestiary/encounter assembly; combat, geometry/pathing, triggers and
  snapshots; `createEncounterSession` / `restoreEncounterSession`;
  `createAdventure` / `restoreAdventure`; `advanceSolo`; `readNarration` and
  the corresponding public command, view, result, snapshot and narration types.
  The exact barrel remains `src/runtime/index.ts`; internal helper exports do
  not automatically become public exports.

The library is synchronous and performs no host I/O. It adds no server,
transport, database, UI, persistence adapter or publication action. The real
application boundary for this product is the published callable library entry.
Built ESM/CJS journeys cross that boundary; JSON serialization/reopen is the
proof host's persistence adapter. Hosts atomically persist the **whole aggregate**
and use its identity/revision in commands. An older saved aggregate is an
independent replay branch, not a global exactly-once transaction log.

## M01 — Portable contracts and validation

Approved sources are `program/Ruleswright/specs/{requirements,design,architecture,database}.md`
and `src/schema/contracts/`. The current database contract is **v1.12**, while
`schemaVersion` remains **1** under the approved pre-release revision policy.
The six schemas are `pack`, `snapshots`, `override`, `play-session`, `adventure`
and `adventure-snapshot` (`*.schema.json`). Existing pack identity/hash checks
remain required. New aggregate validation does not weaken independent legacy
snapshot compatibility.

`validate/` retains all-at-once, pure pack validation with the single ErrorCard
shape. The passes check closed shapes, references, DSL, progression, equipment,
spatial data, table bounds and cross-content constraints. The schema layer never
imports runtime or core values; callers supply the core DSL checker where needed.
The core and schema `MAX_TABLE_DEPTH = 8` declarations are intentionally separate
and cross-pinned (`tests/core/tables.test.ts`, `0c56866`), preserving the sibling
boundary. Failure cards distinguish shape, reference, formula/table and spatial
failures; no new rule ID was minted for random-adventures.

`play-session.ts` declares and validates setup/options, member/start/binding/control
records, aggregate snapshots, journal subjects and settlement receipts. Validation
checks spatial capacity and affordable weight bounds before assembly RNG draws.
An encounter setup seed is a string and may be **empty**: the Author correction
`42bad60` preserved the real assembler's existing `""` behavior. Missing or
non-string seeds are distinct from an explicit empty seed.

`adventure.ts` declares finite templates/definitions, identities, graph nodes,
choices, rewards, rest/director/narration policy and start options. Template and
definition validators bind the effective pack, resolve actual content/table
references, reject invalid graph/recipe/policy shapes and bound generation work.
Definition hashing uses the canonical content-hash helper; sparse arrays and
located duplicate failures are covered by S02's `09e9766` corrections.

Character snapshot writers now include exact signed current HP and nonnegative
temporary HP (`e62da2f`). Independent legacy snapshots may omit HP and retain
formula reconstruction. Encounter/adventure members require HP, pools and indexed
prepared slots; they do not reconstruct an injured member as fully healed.
Combatant profiles/start entries optionally carry detached conditions while
preserving the empty-profile shape (`5cc27f4`). Combat snapshot HP remains signed
integer, including negative values (v1.11); the older nonnegative constraint was
already removed by `e815e74`.

`PendingMove.offeredDepartures` contains exact `{from, to, reactorId}` tuples
through combat and both aggregate layers (`9cea9f6`). Missing legacy history
retains the prior first-edge suppression; explicit `[]` checks all departures.
Closed aggregate validators and consumers recognize the field. This closes
R-GM-3 without discarding legacy snapshot compatibility.

## M02 — Deterministic mechanics and DSL

`rng.ts` supplies sfc32 with cyrb128-style seed hashing, four uint32 state words,
state export/import and the minimal `RandomSource.int(maxExclusive)` injection
seam. `dice.ts` and `tables.ts` provide the shared dice/table engines. Weighted,
ranged and nested tables use the same bounded engine in campaign generation,
adventure generation and runtime loot; there is no second reward roller.

The formula/effect DSL is parsed to validated ASTs at load, with a closed function
registry. No eval, dynamic code execution or dynamic module loading is used.
Formula/effect contexts deliberately differ: effect scope may shadow an ability
with a save or derived scalar; `ability(name)` explicitly reads the actor's ability.
Equipment contributes reserved `gear-*` scalars and movement contributes `speed`.
`MAX_TABLE_DEPTH`, reserved grant keys and vocabulary lists have cross-layer pins.

Effects include sequence/target/burst, damage, healing, conditions and movement.
`varsFor` supplies per-target defender values. `damage(half)` is a no-op without a
corresponding failed damage result; existing bundled fail-branch omissions are
content policy debt, not an invented engine fallback. Root `target(self, …)`
actions bind the actor; a nested self inside a sequence does not turn the whole
action into a root self action. Movement is an authored `move(<formula>)` action,
not a special host movement verb. Spells use the action machinery plus metadata.

## M03 — Character, resources and combat

`Runtime` validates the pack and builds parsed indexes. Character construction,
derived stats, progression, racial/class limits, pools, slots, conditions,
inventory and equipment use the corresponding existing writers; facade methods
delegate to them. `awardXp` splits awards according to progression and never
lowers a level. Its low-level progression application can refill HP and clear
prepared bindings; the adventure adapter explicitly preserves continuity around
that writer rather than changing the low-level API (`fcec34d`, `87a571f`).

Feat capacity is the sum of pack-declared per-class/per-level `featSlots`.
`learnFeat`, level changes, XP awards and restore reject over-cap holdings.
`progression.<id>.features` grants feats without a slot and unlocks actions/spells
at the class level. Grants are derived, never stored; a feat learned before a
grant remains held and consumes its slot (no refund). Old
`content.classes.<id>.features` is refused at load, including `new Runtime`
(`tests/runtime/features.test.ts`, `ae5b595`). A feat-slotted predicate keeps the
approved “any class” meaning. There is no public slots-remaining query.

Inventory/loot and equipment use real item writers. Equipment slots and grants
are pack data; equip/unequip validates conflicts, counts and reserved scalars.
Consumable use applies restrictions, consumes an actual item and emits real
resource/effect events. `applyCondition` accepts an effective duration, so item
condition state and the `condition:applied` duration now agree (`5cc27f4`);
the earlier display-duration residual is closed. `settleItemUses` and
`settleSpellCasts` remain terminal-only low-level settlement APIs.

`combat/` divides responsibility among the Combat facade, FightCore, combatant
facts, declare/spend gates, effect execution, movement, triggers, pure previews,
action economy, resolution and geometry. Public `Combat.state` remains an
accessor over FightCore state; pending triggers are the core's array. Combat
supports step/declare/use/respond/pass, serialization and event reads.
`pass()` uses the existing move/end-turn machinery and refuses terminal combat
or open offers. Previews share production legality without spending resources
or consuming entropy; manual random-dependent validity remains supported, while
solo rejects that domain before an automated transition (`e9c2da6`).

Actions apply ownership, restriction, target, validity/spatial and cost checks
before spending. Spells resolve through the same declaration machinery, require
character membership, check range/targeting and bindings, and enforce armorCasting
only for vancian slots. Point-pool casts are not armor-gated. `profileFromCharacter`
composes equipment, unlocked actions, spells and learned/granted reactive feats.
Reactive feat grammar is checked at load; runtime offers retain actor, subject,
clock and provenance. Events use the shared RuntimeEvent/ErrorCard vocabulary.

Grid and axial-hex geometry, terrain costs/blocking, region-bounded exact paths,
occupancy, reach and bursts are pack-driven. A move pauses on surfaced
leaving-reach offers and resumes against current geometry after downed/restricted
checks. Resume suppresses only offered departure tuples, so a new edge or
threatener is checked. Only absent legacy tuple history suppresses the first
resumed edge. Forfeit uses the established move-ended/turn-ended path.
`canReach` still takes `max(per-id reach, defaultReach)`; smaller overrides remain
ineffective by the accepted DD-M14 behavior, including spell fallback.

Independent snapshot code lives in `snapshots/{envelope,character,combat,index}.ts`.
It checks pack identity, resources, positions/terrain, paused movement and offer
provenance, and restores RNG words. The live envelope's explicit phase and
`offeredCount` win; legacy derivation remains only for envelopes lacking the
modern fields. `SnapshotOffer` is still not directly barrel-exported; consumers
can name it through `CombatSnapshot['offers']`.

## M03 — Standalone encounter sessions (CAP-01, CA-01/02)

`play/{session,encounter,settlement,snapshot}.ts` implements the synchronous
`view` / `dispatch` / `serialize` facade. It owns detached pack/member/combat
state and stages each command privately before publishing a new revision.
Commands are advance, declare, use, respond, pass, finalize, abandon and next.
Identity, revision, actor and exact command shape checks precede writes.
Refusal publishes no state, entropy or journal suffix.

Construction uses the real encounter assembler, character profiles, monster
spawning and combat, with separate generation/play/combat streams. Stable
member/enemy combatant IDs and explicit turn-start control survive reopen.
Restore uses current geometry plus original start profiles and resource balances.
Journal entries have command-scoped sequence/revision and event-time subjects.
Opaque host member IDs remain distinct from combatant reference syntax.

Settlement stages the whole party. Terminal settlement reuses the low-level
item/spell writers; active abandonment uses real inventory mutation with validated
pool/indexed-binding settlement, preserving the terminal-only low-level contract.
Exact HP, temporary HP, condition duration, item/pool/slot carryover and a receipt
publish together. Raw combat spend remains frozen. Receipt identity uses
`JSON.stringify([sessionId, encounterId, 'settlement'])`; hashes bind the pack /
encounter and ordered entry/result member snapshots. A current-revision finalize
retry is inert; only a settled victory permits explicit `next` with a new setup.

Source: `e1d8a5f`, `44079b7`, `5ea1b06`. Proofs:
`tests/proofs/encounter-session-journey.test.ts`,
`tests/runtime/play/session.test.ts`, `tests/snapshots/play-session.test.ts` and
contract conformance. They cover built ESM/CJS, wounded/conditioned generated
parties, empty seed continuation, stale/foreign commands, actual settlement,
paused offers and JSON reopen. Final regression source is `6d919f3`.

## M04 — Campaign and adventure generation (CAP-02, CA-03)

The campaign pipeline remains the seven compiler stages plus schema validation:
stats, skills, feats, classes, magic, bestiary and tables, then the shared load
gate. Stage RNG streams are independent; generated packs carry deterministic
identity, manifest and provenance. Theme composition applies declared patches
through the shared patch implementation. The three original themes are
`dark-fantasy`, `zombie-urban` and `wyldwood`; spatial/equipment/progression data
passes through the established pipeline. All nine bundled classes carry feat
slots, and all eighteen bundled class-feature rows resolve.

`adventure-templates.ts` is an explicit static registry of three original recipes.
`loadAdventureTemplate(id, pack)` validates the effective pack and attaches its
identity; `generateAdventure` refuses a foreign binding. `adventure.ts` uses
M02 Rng/rollTable, M01 validators/hash/cards and existing `GenerationError`.
It rolls base recipes, builds the finite spine/terminal structure, then declared
branch inclusion/descriptors; mandatory branches consume no inclusion draw.
Outputs are detached JSON with canonical definition hashes, resolved choices and
exact authored encounter setup seeds, including empty strings. This does not
change the campaign pipeline or old pack identity pins, and introduces no
generator code into the runtime-only bundle.

Source: `a8f1976`, `1f730a1`, `09e9766`. Proofs include schema/compiler tests and
`tests/proofs/adventure-generation-journey.test.ts`; S03's built adventure journey
then consumes these definitions through real play/rewards/reopen. The formerly
optional CAP-F1 compiler malformed-featSlots proof is now committed in
`tests/compiler/coverage-floor.test.ts` (`09e9766`). Older nested loot tables are
not used by these valid recipes; their unresolved references are tracked below.

## M03 — Adventure aggregate and rewards (CAP-03/04, CA-04)

`adventure/{adventure,choices,rewards,snapshot,types}.ts` implements
`createAdventure(pack, definition, options)` and
`restoreAdventure(pack, definition, snapshot)`. The aggregate owns party state,
node/trail, active encounter, settled receipts, saved reward rolls/claims,
journal/subjects, four domain-separated RNG streams, director metadata and the
narration cursor. The facade's phase/read models derive from these saved facts.

Outer adventure and nested encounter revisions are checked independently.
Encounter entry consumes a generation-stream seed, composes the real encounter
session and copies its journal once. Terminal encounters settle automatically,
with authored reward rolls staged in that same transaction; nested `next` is
refused. Choices, rest, preparation, equipment and item commands use authoritative
saved eligibility and the existing writers. No caller-supplied eligibility
replaces the definition/aggregate checks.

Reward staging uses real loot rolls once, saved before a claim. Claims use real
positive `awardXp` and `grantItem`. The adapter preserves exact HP/temp, existing
resources and non-null prepared bindings at their original indices while retaining
real progression changes; incompatible capacity rejects the whole staged party.
A successful earlier member's XP/item writes and events cannot escape a later
member's failure. Current-revision receipt retries are inert; wrong node/reward,
recipient, identity or stale revision cannot award twice. A flavor roll still
needs an eligible recipient; a reward with no loot forbids one.

Restore checks definition/pack identity, graph trail/phase, party identity,
nested pairing, receipt authority and hash continuity, reproducible saved reward
rolls, RNG words and journal provenance/copy prefix. `encounter:settled`,
`reward:claimed` and `members:updated` bind durable transitions to receipts and
before/after hashes. Receipt member IDs are opaque host IDs, even if their text
resembles another combatant reference (`7011064`).

Source: `9d23947`, `fd67be6`, `87a571f`, `b07d41a`, proof correction `7011064`.
`tests/runtime/adventure/rewards.test.ts:170` proves actual first-member XP/item
success before later-member E-VANC-01 failure and byte-identical rollback/reopen.
The built manual journey in `tests/proofs/adventure-journey.test.ts` crosses a
branch, two real fights, level changes and completion, continuously and reopened,
in ESM and CJS. The separate terminal injury/spend assertions added at `7011064`
precede capability acceptance; a green prior test count was not their substitute.

## M03 — Solo director and narration (CAP-05/06, CA-05)

`advanceSolo(adventure, {maxSteps})` uses bounded pure encounter candidates and
the same guarded outer/nested dispatch as manual play. It yields at player turns
and player offers, routes, rewards and preparation. Authored priorities, geometry,
target order and reaction priority select legal commands; lexical ties consume
no entropy, seeded ties draw only when tied. Candidate exhaustion publishes no
partial enumeration or tie draw. Director RNG, decisions and mechanical progress
hash commit with each staged adventure transaction and survive JSON reopen.

The mechanical hash excludes transport revisions, presentation cursors and
entropy, but includes actual combat/control/geometry and reward state. Zero-damage
play is bounded by the budget and does not falsely imply unchanged mechanics.
The `stalled` result is a **defensive restored-state predicate**, not a claim of
naturally reachable stalemate detection. Planner `6f097e2` disproved and retired
Orchestrator's imposed genuine-unchanged-transition fixture. The legitimate proof
remains: a real director turn-start resets restored below-limit nonzero
`stalledSteps`, updates the hash/decision count and reopens exactly
(`tests/runtime/adventure/director.test.ts:294`, `dac01ab`). No new product
behavior or mandatory proof gate was invented to rescue the disproved premise.

`readNarration(adventure)` returns detached messages with exactly `messageId`,
`sequence`, `templateId`, `event`, `text`, projecting committed event-time subjects
and node context. Slots interpolate literal data; absent fields, unknown events
and negative damage use factual fallback (negative damage is healing). Reads
neither acknowledge nor consume entropy. Message identity is `JSON.stringify([adventureId, sequence])`,
and the complete original event remains attached.

`ack-narration` with `throughSequence` is advertised in every phase. Identity and
revision checks precede equal-cursor no-op handling. A new valid acknowledgement
updates only revision/cursor and emits no event, including terminal phases.
Backward/out-of-range/foreign/stale or malformed acknowledgements are refused
without mutation (`tests/runtime/adventure/narration.test.ts:167`).

Source: `e9c2da6`, `9cea9f6`, `178fe54`, `dac01ab`, `6d919f3`.
`tests/proofs/solo-adventure-journey.test.ts` and the shared adventure oracle prove
budget partitioning, real composition, reopen and manual replay equivalence.
S04's final oracle rekeys account for the added available acknowledgement command;
removing that entry reproduces both prior adventure digests. Combat history rekeys
remain attributable to the planned departure-history correction.

## M05 — Packaging and evidence

The package remains zero-runtime-dependency and host-I/O-free. tsup emits the root
and three subpaths as ESM/CJS with declarations. Security and runtime-isolation
gates remain in CI; the latter's explicit absolute `--fixture-dir` supports bounded
subprocess self-tests. Test-only Ajv checks the six committed schemas against named
library outputs after JSON round-trip (62 conformance cases at final source).
These contracts are repository evidence, not additional files in the npm tarball.
Schema acceptance does not by itself prove byte-exact restoration or durable effect.

README examples now execute and typecheck all three host modes: standalone
encounters, manual adventures and solo adventures. `docs-run` has 17 tests with
negative controls; it checks named CI/doc strings and executable examples, not
all prose. The stale “both” labels and “nine combat legs” wording were corrected
at `09e9766` / `6d919f3`; the nine original characterization legs include
character-only `leg-8`. Previously stale spatial phase/API event mock copy and the
architecture overview omissions were closed by the authorized Author commits
`5b88826`, `5b92b52`, `d68f258`.

| Evidence leg | Scope and recorded result |
|---|---|
| Node full suite | 1,447 tests / 73 files at `6d919f3`; independent verification partitions 891/39 + 556/34 cover the same total |
| Electron runtime | full 1,447/73 at S04 close; verifier also ran the recorded 892/40 scoped selection; `ELECTRON_RUN_AS_NODE=1`, not a renderer |
| Chromium / Firefox / WebKit | each 77 tests / 7 files, including shared adventure continuation; Vite transforms `src/`, not `dist/` |
| Built library entries | encounter, manual adventure and solo journeys use fresh ESM/CJS artifacts; source browser proof is not mislabeled packaged proof |
| Fast/build gates | recorded build, typecheck, lint, format, isolation and security exit 0 |
| Clean-copy typecheck | frozen install → build → typecheck outside HOME; 467 local compiler input paths, none resolving outside the copy |
| Feature verification | `26510c4`: 56 verified rows covering FR-24–29 / RA-01–06, 24 acceptance bullets, CAP-01–06 and supporting slices |
| Remote CI | B-BD-1 remains unverified; local Node/Electron/browser results do not certify remote Node18/20/22 jobs |

Final runtime artifacts recorded with source `6d919f3`:
ESM SHA256 `89fedddf712edaa1b8180e5e8251f96145079cd99eb9134a0ae564071f5f84c4`;
CJS SHA256 `4f8c183a724f231cbd1f6b79b77e380f9cafbf2e6753414b0f392e6a82d616a3`.
No source/test/script/README/package/CI change exists between that revision and
report HEAD `b4089b3`. Intermediate private logs locate runs; canonical STATE,
Final Report, VERIFICATION, source and assertions are the durable evidence.

CI retains six jobs: test (Node18/20/22, build before typecheck/test), lint,
package (proofs/isolation/security), themes, browser matrix, electron runtime.
The shared original oracle pins nine characterization legs and three generated
packs; the adventure oracle adds real adventure continuations. A digest change
needs an explained behavior/content change and owned proof; it is not a way to
silence a failure.

## Carried obligations and compatibility limits

| Item | Current fact / owner / resumption |
|---|---|
| B-BD-1 remote Actions | Human publication/push owner, then Orchestrator receives actual test/package/browser/electron results. No push, publication or remote query is claimed by this pass. |
| Older nested loot refs | `barrow-loot`, `district-scavenge`, `glade-loot` each reference absent table `nothing`. Current recipes avoid them and reject invalid reward recipes. Planner/M04 content-validation owner; cleanup campaign C18–C20. Product meaning of “nothing” must be preserved/decided, not guessed by a rename. |
| H11 scratch lint | `eslint.config.mjs` ignores `program/`, not `.program/`; future config owner. Until repaired, keep executable scratch outside the repo. |
| Build/type resolution hazards | Dist journeys require a fresh build; host type/bin lookup can escape the repo. Use the recorded outside-HOME frozen-install proof when relevant. `--preserveSymlinks` is not a valid substitute under pnpm. Do not rerun a documented oversized RNG hang. |
| Smaller reach overrides | DD-M14 max(default, per-id) semantics retained; any change must include action and spell fallback owners. |
| Restricts tag integrity | `spells.tagged:` has no load-time undeclared-tag check. A future restricts feature owns a versioned/product decision; no silent tightening. |
| Out-of-combat point-pool casting | No cast verb; future product/author scope. Existing in-combat points behavior remains supported. |
| Item tags | ItemDef has no tags, so the future-facing use restriction gate cannot match tags. Intentionally retained pending product direction. |
| Half-damage content | Twelve older fail-branch-free sites remain content-owner follow-up, not a new engine behavior. |
| Surface intent | `readPatch` is a public helper used only by tests internally; `WYLDWOOD` has a real theme-loader consumer. EventSeed/EventSink are used by EventStream. External public use cannot be disproved by repo grep. |
| Internal export keywords | Eight combat helpers have no cross-file consumer; low-confidence cleanup C15, no deletion authorized. |
| Renderer-only execution | Electron runtime and Chromium are covered; a real Electron renderer discrepancy would require a future host-specific proof. |
| Host queries / public types | No feat-slots-remaining query; SnapshotOffer is named indirectly. Future surface revision, not a missing approved random-adventures capability. |

The new cleanup ledger carries prior candidates with stable IDs and current
status. Closed duration, movement-history, compiler-proof, mock-copy and docs
residuals are no longer presented as upcoming work.
