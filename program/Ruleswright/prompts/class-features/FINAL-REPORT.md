# Final Report — Ruleswright / class-features

## Summary

FR-6's last open item, **class features**, is built. Contract **v1.10** (a pre-release, in-place revision; `schemaVersion` stays 1; compatibility caveat (g)) moves a class feature `{level, ref}` to `progression.<classId>.features`. The `ref` names exactly one pack id:
- a **feat** is *granted* while the class level ≥ `level`. It is derived, never stored, uses no feat slot, and is offered in combat when reactive. `learnFeat` refuses it with `feat-known`.
- an **action** is *unlocked*: it can be declared in combat from that class level on.
- a **spell** is *unlocked*: it is known from that class level on.

The old location `content.classes.<id>.features` now fails with `E-SCHEMA-02`. Unresolved or redundant refs fail with `E-REF-01`. Every bundled ref now resolves: 18 feature rows across the three themes, with new feats and actions. The host can list a character's features with `classFeatures(runtime, character)`.

Human answers on record (2026-10-04): "1 a,b 2 no 3 move it, fix packs, 4 fix the broken packs, 5 you have my auth for whatever you need" (DD-C1, DD-C2, DD-C3, DD-C10). No new product question came up during the run, and nothing was escalated to the human.

**Sessions done: 5 / 5:**
- S01: DB re-entry.
- S03: schema mirror, validator, themes, fixtures, characterization re-key.
- S04: runtime and README.
- S05: Designer re-entry.
- S02: Architect re-entry.

**Required capabilities:** CAP-C1…C7 are verified against current sources (STATE *Capability Readiness*; VERIFICATION.md 12/12 verified).

## Files created and modified

`git diff --name-status f36d4ae..5c53524` (end SHA = VERIFICATION.md, the last commit before this report): **41 files** (11 added, 30 modified), +2934 / −202.

| Group | Files | A | M | Paths |
|---|---:|---:|---:|---|
| `src/schema` (M01) | 7 | 0 | 7 | `artifacts.ts`, `error-card.ts`, `contracts/pack.schema.json`, `validate/index.ts`, `validate/sections/{content,cross,progression}.ts` |
| `src/runtime` (M03) | 5 | 1 | 4 | `features.ts` (A), `feats.ts`, `pools.ts`, `character-profile.ts`, `index.ts` |
| `src/compiler/themes` (M04) | 3 | 0 | 3 | `dark-fantasy.json`, `zombie-urban.json`, `wyldwood.json` |
| `tests` | 13 | 2 | 11 | `proofs/class-features-journey.test.ts` (A), `runtime/features.test.ts` (A), `proofs/{combat-characterization,docs-run,feat-slots-journey}.test.ts`, `runtime/{feats,pools}.test.ts`, `runtime/combat/{character-profile,module-surface}.test.ts`, `runtime/fixtures/pack.ts`, `schema/{fixtures.ts,validate.test.ts}`, `compiler/coverage-floor.test.ts` |
| Docs / Author / arch | 5 | 0 | 5 | `README.md`, `specs/database.md`, `specs/architecture.md`, `mocks/progression.html`, `arch/v1-core.md` |
| Plan (gitignored, force-added) | 8 | 8 | 0 | `prompts/class-features/{MASTER,STATE,VERIFICATION,SESSION-01..05}.md` |
| **Total** | **41** | **11** | **30** | |

## Architecture impact

Value imports below are derived per statement; `import type` is excluded.
- **New leaf `src/runtime/features.ts`.** It has no value imports. Its type imports are `../schema/pack`, `./runtime` and `./character`.
- **New intra-M03 value edges:**
  - `feats.ts:18` → `./features` (`grantedFeats`). `feats.ts` is no longer a leaf: it now imports `./errors` and `./features`.
  - `pools.ts:27` → `./features` (`unlockedSpells`). `pools.ts` now value-imports two leaves: `./equipment` and `./features`.
  - `character-profile.ts:28` → `./features` (`grantedFeats`, `unlockedActions`).
  - `index.ts` re-exports `classFeatures` and the type `ClassFeatureView` from `./features`.

  `features.ts` imports nothing back, so these edges add no cycle.
- **No change to cross-module edges.** M03 → M01 stays type-only for the new file. `src/runtime/combat/**` and `src/runtime/snapshots/**` are untouched (`git diff --quiet c0a23b1 -- …`), and so is `snapshots.schema.json`.
- **M01:**
  - `ClassDef.features` is removed and `ClassProgression.features?: ClassFeature[]` is added.
  - `progression.ts` gains `checkFeatures` and `levelCeiling`. The ceiling helper is now shared with the v1.8 `featSlots` rule, with unchanged behaviour (S03 R1 deviation).
  - `cross.ts` gains `checkClassFeatures`, called from `validate/index.ts` after `checkProgressionPairing`.
- **M04:** theme content only. The compiler passes it through unchanged.
- **Barrel:** the runtime value list gains `classFeatures`, pinned in `module-surface.test.ts`.
- **Arch record:**
  - Orchestrator appended the S03 delta (`c7d517f`) and the S04 delta (`de67360`).
  - It retired the "class features unbuilt" lines (`arch/v1-core.md:29`, `:1392`) and replaced the stale paragraph at `:1411-1413` (ARCH-PRE F-C11).
  - Synthesis is left to the final Archivist.

## Verification

### Gates

| Gate | Base `f1fa3f9` | End `b8973ec` / `69acc7a` |
|---|---|---|
| V1 `pnpm typecheck` | 0 | 0 |
| V2 `pnpm lint` | 0 | 0 |
| V3 `pnpm format:check` | 0 | 0 |
| V4 `pnpm build` | 0 | 0 |
| V5 `pnpm test` (after build, H1) | 52 files, **938/938** (N₀) | 54 files, **970/970** (N) |
| V6 `pnpm check:isolation` | 0 | 0 |
| V7 `pnpm check:security` | 0 (observed, not inherited) | 0 |

N₀ 938 → 970 (+32):
- S03 +13: ck1 +5, ck2 +8.
- S04 +19: ck1 +7, ck2 +7, ck3 +4, ck4 +1.

Orchestrator ran V1–V7 itself at every Coder receive, and V1–V3 at the Author receives.

### CA-C5 digest re-keys

These were done only in S03, under the normalized-dump proof. At both checkpoints, `cmp` found all 9 normalized leg dumps byte-equal before vs after, with every `contentHash` masked. Only the 7 bundled-theme legs were re-keyed. Legs 1 and 5 run on `emberMarchesPack` and did not change.

| Leg | base | ck1 `c3fc398` | ck2 `c0a23b1` |
|---|---|---|---|
| 2 | `b7c89ee4…f6b1` | `1bbcd2d2…3792` | `007a5567…be1f` |
| 3a | `4b79a4d1…e5ad` | `ec107e2f…f530` | `6356cff8…0b2c` |
| 3b | `49fed1e8…7c6c` | `a3721aa0…61df` | `82597d99…916f` |
| 4 | `1f015930…bcfb` | `10fbaf25…bb2c` | `b47296c7…2552` |
| 6 | `d1b501cd…7c3377` | `f1d8a33a…31f2` | `11f27e47…6b86` |
| 7 | `f2f4a205…fc00` | `7ccd2b0d…dde4` | `650be776…5607` |
| 8 | `62468c03…17fa` | `a05217b2…6d84` | `23a287f1…01a5` |

S04 left all 9 digests unchanged. `tests/proofs/combat-characterization.test.ts` has been unchanged since `c0a23b1`.

### Negative controls

All were scratch edits, reverted and confirmed with `cmp`:
- **S03 ck2:** the bundled ref `oath-of-the-wardenx` → `E-REF-01` at `progression.warden.features[0].ref`, with did-you-mean `oath-of-the-warden`. The prescribed `oath-of-the-wardenX` gives `E-SCHEMA-01`, as DD-C4 requires (disproved premise; see Granularity feedback).
- **S04:** removing the granted-feats line in `profileFromCharacter` makes journey leg 1 fail. Disabling the `learnFeat` grant check makes leg 4 and the `feats.test.ts` granted case fail.

**Feature Verification pass:** 12/12 verified (see `## Verification` below).

## Residual gaps (carried)

- **`spells.tagged:` load integrity** is carried as before, outside FR-6 scope and not disproved. Owner: the next content/validator feature.
- **The carried ledger in `arch/v1-core.md`** (v1.1 follow-ups, the `damage(half)` sites, CAP-F1 compiler leg, a host "slots remaining" query) is unchanged by this feature.
- **DB delta from STATE:** none. S01 changed no CA or DD meaning. Its precision additions are listed in its Handoff Notes `deviations`.
- **No refund on grant (v1, documented):** a feat learned before its class grants it stays held and keeps its slot (DD-C2).

## Follow-up

See *Follow-up closure ledger* under Orchestration.

## Verification

**Feature Verification pass:** one envelope, 2026-10-05. Source: `program/Ruleswright/prompts/class-features/VERIFICATION.md`, committed at `5c53524`. The verifier wrote the file; Orchestrator committed it unchanged with `git add -f`, because the path is gitignored.

**Rows:** 12 verified · 0 present-unverified · 0 failed (all routed) · 0 blocked.

### Behavior unverified — human review required (0 rows)
| ID | Exists | What is unproven | Why it could not be proved here |
|---|---|---|---|

none. The pass returned no `present-unverified` row.

Disclosure, not a verdict change:
- CAP-C7 (docs) rests on the verifier's text review plus two behavioural probes (P1, P2). No test pins the class-features prose.
- DD-C3's `new Runtime` refusal path is covered by probe P1 plus the shared `validatePack`, not by a dedicated repo test.

## Orchestration

**Concurrency:** 3 (Native binding: `mcp__demiurge__spawn_subagent` / `await_subagent_result`). The plan's dependency graph allowed at most 2 workers at once (W3).

**Wall clock:** about 45 min, 2026-10-05 03:05 → 03:50. Base gates ran at ~03:07, the first dispatch was at 03:08, and VERIFICATION.md landed at 03:49.

**Sessions run:** 5 plan sessions, plus ARCH-PRE (planning completeness) and VERIFY-01 (feature verification). The final Archivist follows this report.

**Checkpoints committed by workers:** 12, from `git log`:

| Session | Checkpoints | Commits |
|---|---:|---|
| S01 | 2 | `8d5828c`, `efa971d` |
| S03 | 2 | `c3fc398`, `c0a23b1` |
| S04 | 4 | `3a49d9f`, `dd70d3e`, `32eaa35`, `64a3231` |
| S05 | 2 | `e5850e2`, `7298b73` |
| S02 | 2 | `4eb8402`, `b8973ec` |

Each count matches the handoff's `checkpoint`.

### Wave plan as executed
| Wave | Sessions | Notes |
|---|---|---|
| W0 | ARCH-PRE (Archivist) | Planning completeness: D3 and D4 failed, both via F-C1. The fails reached W2 only; W1 was unblocked. Two await idle timeouts were re-awaited (H7). |
| W1 | S01 (DB) | Done 2/2. CA-C1/CA-C2 promoted from provisional against `efa971d`. |
| W2 | S03 | Lease rev 2 (F-C1). Done 2/2; CA-C5 proven. One await idle timeout was re-awaited. |
| W3 | S04 ∥ S05 | Launched together, with disjoint `Owns`. S04 was received first, with S05's commits interleaved. One await idle timeout was re-awaited. |
| W4 | S02 (Architect) | Rolling refill: launched right after S04's receive and before S05 was collected, overlapping S05 as the Wave Plan allows. |
| — | VERIFY-01 | One pass. |

### Blocked
none.

### Blocker escalations
| S | Class | Action / human ask | Disposition |
|---|---|---|---|
| S03 (via ARCH-PRE F-C1) | mechanical owner seam (lease gap) | Controlled lease revision S03 rev 1 → rev 2, adding `tests/proofs/feat-slots-journey.test.ts`. The ck2 edit filters leg 9 to learnable feats and stays forward-compatible with S04 ck3. | Cleared before dispatch. The closing assertion held after S03 ck2 and after S04 ck3, with S04 making no edit. |
| VERIFY-01 | mechanical owner seam | `commit_pathspec` cannot stage the gitignored VERIFICATION.md. Orchestrator committed it unchanged with `git add -f` and an explicit pathspec. | Cleared (`5c53524`). |

No human interruption: nothing reached the Human Interruption Gate.

### Interim Archivist checks
| After wave | Sessions received | Result | Drift found | Actions |
|---|---|---|---|---|
| — | — | Not run: 5 sessions, under the 16-session interim threshold. Only the ARCH-PRE planning-completeness pass and the final Archivist ran. | — | — |

### Lease violations
none. Every worker commit was checked with `git show --name-only --format=` against its lease (S03 against rev 2). S03 recorded one R1 deviation, on an in-lease path. S04 and S05 commits interleaved in W3, each inside its own lease.

### Checkpoint shortfalls
none.

### Wave plan corrections
none. Planner's concurrent pairs, S04 ∥ S05 and S02 ∥ S05, have disjoint `Owns`.

### Granularity feedback for Planner

Every session committed every checkpoint, none ran out of context, and no handoff said a checkpoint boundary was drawn wrong. Five planning premises were disproved and corrected before or during dispatch:
- **F-C1 (missed pin):** the pin audit grepped for the moved field (`features`), not for tests that count or iterate maps the feature *adds to*. `feat-slots-journey` leg 9 counted `content.feats`. ARCH-PRE proposed a content-delta grep for the framework.
- **F-C2 (count):** the ref probe said "13 refs / 11 unresolved"; the true figures are 12 / 10.
- **F-C3 (journey setup):** `step()` does not declare for the monster; the host must call `declare('grave-gaze')`.
- **F-C4:** the vancian-unlock case named a points spell.
- **S03 negative-control value:** `oath-of-the-wardenX` (uppercase) tests the id-format rule, not ref resolution.

F-C1, F-C2 and F-C3 would each have cost a worker return if they had not been caught before dispatch.

### Process effectiveness

**First-dispatch completion: 5/5.** Every session was accepted on its first dispatch, with no redispatch and no recovery worker.

**Unplanned corrections: 1.** This was the S03 lease revision (F-C1; CAP-C2, CA-C3). It was handled as a same-context lease amendment before dispatch, not with a separate owner worker.

**Integration rework: 0.** No corrective commit followed any acceptance.

**Envelope amendments:** ARCH-PRE produced 12 findings (F-C1…F-C12), all dispositioned before the affected session dispatched:
- S01: F-C2, F-C6, F-C7, F-C12.
- S03: F-C1, F-C2.
- S04: F-C3, F-C4, F-C5, F-C9.
- S02: F-C8.
- Orchestrator: F-C10, F-C11.

**Await idle timeouts:** 4, all re-awaited on the same handle (H7). These are environmental, not planning defects.

**Durations** (dispatch → receive, from commit and launch times):
- S01 ~14 min
- S03 ~9 min
- S04 ~10 min
- S05 ~10 min (buffered behind S04)
- S02 ~2 min

### Capability completion

CAP-C1…C7 are all **verified** against current sources, and none is planned, blocked or stale:
- CAP-C1, CAP-C2: S03 `c0a23b1`.
- CAP-C3…C6: S04 `3a49d9f`…`64a3231`.
- CAP-C7: S01, S04, S05 and S02.

CA-C1…C5 are all proven (STATE *Contract Agreements*). VERIFY-01 independently found 12/12 verified.

### Follow-up closure ledger
| Source | Item (verbatim / condensed from receive records) | Disposition |
|---|---|---|
| S01 followUp | "Orchestrator should re-check CA-C1 and CA-C2 against `efa971d` and promote them from provisional before dispatching S03." | **closed**: done at S01 receive (`9615043`) |
| S01 followUp | "S03 mirrors the contract (`artifacts.ts`, `progression.ts`, `cross.ts` `checkClassFeatures`)." | **closed**: S03 `c3fc398`, `c0a23b1` |
| S01 followUp | "Archivist owns `arch/v1-core.md` and the PROGRAM-CONFIG notes." | **carried**: final Archivist (this run) |
| S01 surprises | A non-kebab `ref` → `E-SCHEMA-01`; S03 should mirror it. | **closed**: S03 ck1 `checkFeatures` `ID_PATTERN` |
| S03 followUp | S04 consumes `ClassProgression.features`, the DD-C10 ids and the fixture feat; leg 9 should stay green after S04 ck3. | **closed**: S04 confirmed `feat-slots-journey` 8/8, unedited |
| S03 followUp | CAP-C3..C6 proofs remain with S04. | **closed**: S04 |
| S03 followUp | S05 can quote the dark-fantasy features. | **closed**: S05 `7298b73` |
| S03 followUp | `arch/v1-core.md` "class features unbuilt" lines; PROGRAM-CONFIG M01/M04 key-file notes. | **closed** (arch lines: `de67360`); **carried** (PROGRAM-CONFIG key files): final Archivist |
| S03 followUp / surprise 1 | SESSION-03.md's negative-control value needs a lowercase-hyphenated id. | **retired**: plan files are history once the feature closes. Recorded as Planner granularity feedback above. |
| S03 surprises 2–5 | error-card line as cited; wording chosen for the uniqueness message; non-integer level skips the ceiling check; lease rev 2 used. | **retired**: informational, no action |
| S04 followUp | S02 (Architect) can name `src/runtime/features.ts` and its consumers. | **closed**: S02 `4eb8402` |
| S04 followUp | Retire the "unbuilt" lines and replace l.1411-1413 (F-C11). | **closed**: `de67360` |
| S04 followUp | PROGRAM-CONFIG M03 key files: the `features.ts` leaf, `feats.ts` no longer a leaf, the `pools.ts` value-import note, M03 edges `{feats, pools, character-profile, index} → features`. | **carried**: final Archivist (this run) |
| S04 followUp | The `progression.html` panel can quote the README section. | **retired**: S05 quoted `database.md`/DD-C7 directly, which is consistent |
| S04 surprises | `prepareSpell` message and doc gain the class-feature wording; README *Reactive feats* bullet now says "held or granted". | **retired**: in-lease wording, verified by VERIFY-01 (CAP-C7) |
| S05 followUp | "The final Archivist records F-R6 as closed." | **carried**: final Archivist (this run) |
| S05 followUp | The ◈ callout uses the short name `classFeatures(rt, character)`. | **retired**: consistent with DD-C7 and the landed signature |
| S05 surprises | The callout now cites FR-6, not FR-14; a "ref resolves in" column was added; `id="class-features"` anchor. | **retired**: Designer-scope choices that restate DD-C1, with no new behaviour |
| S02 followUp | Runtime files still missing from the `architecture.md` tree (`feats.ts`, `inventory.ts`, `equipment.ts`, `character-profile.ts`, `display-roll.ts`, `errors.ts`, `index.ts`), and `validate/` helpers (`collect.ts`, `context.ts`, `dsl.ts`, `helpers.ts`). | **carried**: next Architect re-entry (owner: Architect; an overview-completeness choice, not drift) |
| S02 followUp | The `character.ts` line still says "inventory"; l.~220 "both FR-21 packs" (three themes now). | **carried**: next Architect re-entry (owner: Architect) |
| S02 followUp | "The final Archivist can record F-D8 as closed." | **carried**: final Archivist (this run) |
| VERIFY-01 followUp | Optional hardening: a repo test for `new Runtime` rejecting `content.classes.<id>.features`. | **carried**: next feature touching `tests/runtime` (owner: Planner to schedule; optional) |
| ARCH-PRE proposedForFramework | Pin audits should include a content-delta grep for maps a session adds to. | **carried**: final Archivist (convention promotion) |

### Archivist's Note
The final pass is committed at `bd904e9`. Every Final Report figure reproduces, and a fresh gate run at `c915610` is green:
- build, typecheck, lint, format:check, security and isolation all exit 0;
- `pnpm test` passes 970/970 across 54 files;
- `pnpm exec vitest run tests/proofs` passes 99/99 across 13 files.

- **role:** archivist
- **registryUpdated:** true
- **reconciled:**
  - `program/Ruleswright/arch/v1-core.md`
    - **Deltas collapsed:** the S03 and S04 sections (`c7d517f`, `de67360`) are folded into the M01, M03 character-side, M04 and M05 sections, *Cross-cutting decisions* (DD-C1..C13), Surfaces and the module map. The markers are gone and the historical-delta comment cites `c915610` for the original text.
    - **Orchestrator's retirement edits:** former l.29 and l.1411-1413 read correctly. Former l.1392 pointed at markers that no longer exist, so it now points at the decisions paragraph and the M01/M03/M04 sections.
    - **Closures recorded:**
      - F-FP2 / F-P5;
      - F-R6 (S05 `e5850e2`, `progression.html:115-128`);
      - F-D8 with ARCH-PRE F-C8 (S02 `4eb8402`/`b8973ec`: `architecture.md:123` lists wyldwood, l.86-87 attributes known spells to `pools.ts`);
      - the `database.md` seed-data drift (S01 `8d5828c`, now l.786).
    - **Architect-owned observations:** recorded in the arch drift section and carried to the next Architect re-entry. `specs/` is not edited.
  - `program/Ruleswright/PROGRAM-CONFIG.MD`
    - The realized-state note now covers twelve cycles; Custom Rule 1 now runs through v1.10, caveat (g) and Version Registry row 11.
    - **M01 *Key Files*:** `ClassProgression.features?` replaces `ClassDef.features`; `cross.ts` `checkClassFeatures`; `progression.ts` `checkFeatures` and the shared `levelCeiling`.
    - **M03 *Key Files*:** the `features.ts` leaf; `feats.ts` is no longer a leaf; `pools.ts` and `character-profile.ts` notes.
    - **M04:** the 18 feature rows.
    - **Intra-module edges, re-derived per statement** at `f36d4ae` and `5c53524`: only five files changed. `feats.ts:18`, `pools.ts:27` and `character-profile.ts:28` now import `./features`, `index.ts:29` re-exports it, and `features.ts` imports nothing. There is no cross-module edge, no new module ID and no rule id.
  - `program/Ruleswright/ARCHIVIST-LOG.md`
- **conventionsAdded:**
  - None minted.
  - **Pin-lease rule sharpened** (now 7 cycles · 9 instances, F-C1): it gains one sentence on content-delta pins. When a session adds entries to a map, the pin audit also greps for tests that count or iterate that map, not only for the field being moved.
  - **Factual-premise rule sharpened** (now 10 cycles · 45 instances): it gains one clause. A prescribed negative-control value is a premise, so probe that it reaches the rule under test rather than an earlier check (S03's `oath-of-the-wardenX` hit the id-format rule first).
  - Evidence notes updated on four more conventions: Author re-entry, idle timeout, VERIFICATION.md forced commit and derived Final Report facts.
- **proposedForFramework:**
  - **New, 1 cycle · 1 instance:** the Final Report carries two `## Verification` sections, and the first refers to the second as "below". ORCHESTRATOR.md's template should give the FR-17 block its own name.
  - **Pin audits, 7 cycles · 9 instances:** PLANNER.md's pin-audit step should name all four pin kinds, including the content-delta grep ARCH-PRE proposed.
  - **Factual premises, 10 cycles · 45 instances:** PLANNER.md should treat journey test-setup values and negative-control values as premises to probe.
  - **Idle timeout, 7 cycles · 15 instances:** ORCHESTRATOR.md should say "re-await the same handle".
  - **VERIFICATION.md under a gitignored path, 4 cycles · 4 instances:** give `commit_pathspec` a force option limited to the write set, or have ORCHESTRATOR.md say Orchestrator force-adds the file.
  - **Author re-entry wording, 8 cycles · 10 instances:** the role docs say Author roles are never spawned, while plans dispatch them on recorded authorization.
  - **Author deviations unclassified, 2 cycles · 3 instances:** the S01 and S02 deviations carried no R1–R4 rule.
  - **Adoption check:** the four role-doc sha1s and mtimes match the prior pass, so no row is adopted.
- **logEntry:** dated entry "2026-10-05 — final pass, cycle `class-features`" appended to ARCHIVIST-LOG.md.
  - **Final Report facts reproduce:** 41 paths (11 A + 30 M), +2934/−202, groups 7+5+3+13+5+8, 12 checkpoints, 938 → 970 tests, and every value-import line citation.
  - **Contract Agreements and Capability Readiness:** CA-C1..C5 match source, and CAP-C1..C7 agree with VERIFICATION.md (12 of 12 rows verified). There is no drift and no counterevidence.
  - **Deviations by rule:**
    - R1: 1 (S03 `levelCeiling`, in-lease);
    - R2: 0;
    - R3: 0;
    - R4: 0;
    - unclassified: 2 (S01, S02).

### cleanupBriefs

[] — the scout found no new candidate and no campaign crosses a threshold. C3, C4, C7, C10 and C15 remain under tracking.

### standingRecommendations

| id | pattern (short) | cycles | instances | firstSeen | status |
|---|---|---:|---:|---|---|
| b32fc8d0c8c92d52 | Checkpoint-0 read sweeps exhaust context | 2 | 2 | v1-core | open |
| f57dbe4d010638fe | Subagent fabricates tool inputs | 2 | 8 | v1-core | open |
| b85c8f3e113a6764 | Barrel completeness gaps found at integration | 2 | 3 | v1-core | open |
| c1ed872bea557b96 | run tool argv misrouting | 2 | 3 | v1-core | open |
| 3658f327cc9cff2f | Single-command commits fail on deleted files | 2 | 2 | v1-core | open |
| 1cc46f93038f1d9a | Cross-suite pins land without an owner | 7 | 9 | loot-inventory | promoted; framework wording open |
| 576a281656f83b23 | Envelope factual premises unverified | 10 | 45 | loot-inventory | promoted; framework wording open |
| 854ceecd39d4b0d3 | Whole-repo fast gates red at role-scoped receives | 4 | 4 | v1-core | promoted |
| 17f4803c1b08da77 | Provider aborts kill subagents mid-session | 3 | 5 | loot-inventory | open |
| 6f6b491bdbe37bf0 | Bare npx misresolves | 3 | 4 | loot-inventory | open |
| 1d910de11732c6c4 | Aborted final pass leaves a double synthesis | 2 | 2 | loot-inventory | open |
| c172cd30e8dfc756 | Plan-time base SHA goes stale after replan | 1 | 1 | equipment-consumables | open |
| cecd211504587426 | Host await idle timeout | 7 | 15 | equipment-consumables | promoted; framework wording open |
| f68c42a3f6224eb1 | Final Report facts transcribed, not derived | 4 | 4 | v1-core | promoted; framework wording open |
| a368039028d463d6 | "Never spawned" vs orchestrated Author re-entry | 8 | 10 | grid-combat | promoted; framework wording open |
| 3983f8eb6d18a5f2 | STATE row matcher hits a CA-ID column | 1 | 2 | grid-movement | open |
| f4621ac12fba3456 | Pin audits miss behaviour pins | 3 | 4 | grid-combat | open |
| 760b67f17edbd346 | New execution path exposes latent content hazards | 2 | 2 | spells-in-combat | open |
| 82b4e0abbda105d6 | Concurrent sessions share one working tree | 1 | 2 | spells-in-combat | open (narrowed) |
| c3c94358b35f8316 | Final Report cites `..HEAD`, then its own commit moves HEAD | 1 | 1 | action-targeting | open |
| c187bed6bb5132a7 | VERIFICATION.md gitignored vs `commit_pathspec` | 4 | 4 | feat-progression | promoted; framework wording open |
| 8039d6869169267c | Plan artifacts internally inconsistent | 1 | 2 | feat-progression | open |
| d2415cb4497e0049 | Author handoff deviations carry no R1–R4 rule | 2 | 3 | feat-progression | open |
| 3092a46b564d1d36 | Baseline "Hazards: none" despite known hazards | 1 | 1 | combat-decomposition | open |
| 2674d8c2f948ae0a | Line-based derivations miss multi-line statements | 1 | 1 | combat-decomposition | open |
| 0880dd5734025fd4 | Negative control perturbs an out-of-lease file | 1 | 1 | combat-decomposition | open |
| 318c816b6920dd3d | Final Report has two `## Verification` sections | 1 | 1 | class-features | open |
