# Final Report — Ruleswright / grid-combat

> Run completed 2025-09-27. Feature `grid-combat` (5 sessions) — engine-enforced grid combat per approved FR-11: packs declare an optional spatial model; positions ride combat state; melee declares fail declaratively when out of reach; burst shapes resolve through the targeting DSL; spatial fights snapshot/resume losslessly; theater-of-mind packs pay nothing.

## Summary

**What was built.** The whole FR-11 integration column: `pack.schema.json` gains the optional `spatial` section (v1.3, mock-verbatim inline reach anatomy) and `E-SPAT-01` joins the DB rule registry; the TS mirror (`Pack.spatial`, `SpatialDef`/`SpatialReach`, `checkSpatial`) mirrors the contract 1:1 with the structural/semantic E-SCHEMA-01/E-SPAT-01 split; the runtime integrates positions (host-declared, fail-closed), the reach gate, one `resolveShape` with three consumers, the declare-time validity gate (`evalValidity` + parse-once `validAsts`), and snapshot position round-trip with fail-closed restore; the compiler passes `spatial` through themes and all three bundled themes declare the model (stage-8 dogfood: zero cards); the grid journey (`tests/proofs/grid-journey.test.ts`, 11 tests) proves the real transport end to end on a generated pack (seed 42) — generate → load → positions → adjacency reject → restore-close distance → burst multi-target with mixed save branches → validity gates → snapshot resume — plus wyldwood theater parity and two-run determinism. README documents the surface (```json snippet, journey cited, NFR-DX held).

**Sessions: 5/5 done** (+1 planning-completeness Archivist, +1 replan worker, +1 owner-correction worker). **Files created/modified:** 2 author artifacts (pack.schema.json, database.md), 9 source files (schema ×4, runtime ×6 incl. the ratified barrel line, core ×1), 3 theme JSONs, 1 fixture file, 7 test files (5 modified, 2 created), README. **Architecture impact:** M01 gains the spatial contract mirror + validator section; M02 gains `evalValidity` (injected-callback isolation held); M03 gains the adapter, positions, reach/validity gates, one shape resolver, snapshot position I/O; M04 gains the spatial pass-through + theme declarations; no new modules; isolation and all architecture guards held (runtime never imports compiler; core stays runtime-ignorant).

**Verification (FINAL, all seven package gates green at `f178c0a`, Orchestrator-run; re-confirmed fresh by the final Archivist pass at `c72908a`):** `pnpm typecheck` 0 · `pnpm lint` 0 · `pnpm test` **564/564 across 35 files** · `pnpm build` 0 (24 dist files) · `check-runtime-isolation` 0 · `check-security-lint` 0 · `pnpm format:check` 0 · plus `pnpm exec vitest run tests/proofs/` 28/28 (ci.yml's exact command). Baseline lineage: 503/503 (loot close) → 513 (S02) → 552/553 (W3) → **564/564** (S05 close).

**Capabilities.** CAP-G1..G7 all **verified** against current sources — CAP-G7 (the first narrow journey) crosses the real transport with no mocked boundary; CA-G1..G5 all legs landed with proofs passed; no required capability remains planned, blocked, or stale.

**Residual gaps (recorded, owners named, none owed by this feature):**
- **Movement verb** (STATE Design Decision 1): still the feature's one open product question for the human; the serialize→restore-with-updated-positions seam (FR-10 between-steps) is the documented v1 answer and is README-documented. An approved `move()` would be an api-map product decision (new feature), not a grid-combat scope adjustment.
- **Burst shape is not combat-declarable from generated packs** (S05's consumer-shape amendment): `declare()` resolves actions only from `pack.actions`; generated packs ship bursts only as `content.spells`. The journey proves bursts through pack data added at test setup (rules-are-data discipline, zero engine diffs). A "spells as combat actions" bridge is an **engine design event** (Author/DB re-entry class) for a future program.
- `evalPackFormula` parse-once debt (Design Decision 10, zero behavior change); per-target save-*modifier* gap in `core/dsl/effect.ts` (save branches are per-target; modifiers are not); browser determinism leg in CI (tracked v1.1 follow-up).
- `pnpm approve-builds` advisory for esbuild/tsup (inherited; CI job catches it on first run).

## Orchestration

**Concurrency:** 3   **Wall clock:** ~4h (first dispatch ~13:00Z to S05 close ~16:52Z local; per-wave durations from recorded launch/receive times below)
**Sessions run:** 5 Planner sessions + 3 workers (1 planning-completeness Archivist, 1 replan, 1 owner correction)
**Checkpoints committed by Coder:** 17 checkpoint/correction commits across the five sessions (2+1corr, 3, 5, 3, 3+1corr) + 1 owner-correction commit + 1 replan commit = **19 worker commits**; plus 4 Orchestrator commits (1 session-end residual format fix, 3 STATE updates) and 5 arch-integration commits; plus the final Archivist synthesis commit (`c72908a`).

### Wave plan as executed
| Wave | Sessions | Notes |
|---|---|---|
| W0 | ARCHIVIST-PREFLIGHT → REPLAN-GC-01 | Planning-completeness review found 4 findings (F-G1..G4); 6 precise fixes landed (949e9dc) before any session dispatch |
| W1 | S01 (h-CCwg/DgVO6, db role) | Contract gate, solo; landed 2/2 + Orchestrator format residual (0ab3622); CA-G1 recheck passed |
| W2 | S02 (h-H-QJ/Ciqwt) | TS mirror + validator + registry re-key, solo; 3/3; baseline 513/513 |
| W3 | S03 ∥ S04 (h-ZL9_/Cvh5O + h-zZq1/CQ2Bw), then OWNER-CP-POSITIONS (h-WiOD/CR2Ih) | Both launched before any await; disjoint leases held; S03 5/5 (one ratified barrel export), S04 3/3; the outside-lease CA-08 seam cleared by the owner correction at wave close |
| W4 | S05 (h-jbQs/C3n8a) | Journey + README, solo; 3/3 (+1 in-lease correction); all seven package gates green; feature closed |
| completion | ARCHIVIST-FINAL (h-bTvU/AbDHp) | Final synthesis: arch across four cycles (incl. v1-shell's first record), registry re-derived, three conventions promoted, log entry; all gates re-run fresh and green |

### Blocked
| S | Reason | Last checkpoint | Dependents stalled |
|---|---|---|---|
| (none — no session ever entered blocked state this run) | — | — | — |

### Blocker escalations
| S | Class | Action / human ask | Disposition |
|---|---|---|---|
| preflight | plan-text contradiction + 2 unowned cross-suite pins (F-G1..G3) + 1 informational | REPLAN-GC-01 (bounded replan worker, prompt files only) | **closed** (949e9dc) — verified diff-by-diff; Human Interruption Gate not triggered (mechanical) |
| 01 | format drift on the committed contract (whole-repo gate red at receive) | Orchestrator session-end residual (prettier on 1 file) | **closed** (0ab3622) — recorded as DD12 |
| 03 | self-reported lease violation (1-line barrel export in `src/runtime/index.ts`, ck1 `0a911b2`) | Ratify-or-revert decision to Orchestrator | **ratified** (Auto-Decision precedence 3 + D16 precedent; recorded as DD14a; counted below) — never amended |
| 03 | outside-lease seam: 6 red CA-08 tests in `character-profile.test.ts` (S04 themes × S03 fail-closed engine) | OWNER-CP-POSITIONS owner-correction worker (standing authority; mechanical; assertions preserved) | **closed** (2f3b1d3) — 20/20; adjacency fallback (distance-3 shape empirically proved a permanent stalemate; no movement mechanic) recorded as DD16 |
| 03→05 | docs-run README block-03 red (planned debt window) | Planned: S05 ck1 pays it first | **paid** (1cb3e70) — `d20[9]=9 < ac12` unchanged, proved by run |
| 05 | consumer-shape amendment need: bursts not combat-declarable from generated packs (in-session adaptation via pack data) | Routed to future-program debt (engine design event — Author/DB re-entry class, not a worker) | **recorded** (DD17a + arch drift note) — no this-feature obligation |

No human interruption was required at any point; every blocker passed the Human Interruption Gate as mechanical.

### Interim Archivist checks
| After wave | Sessions received | Result | Drift found | Actions |
|---|---|---|---|---|
| pre-W1 (planning-completeness) | 0 | done (h-rxH5/AOQID) | 4 findings (F-G1 plan-text contradiction; F-G2/F-G3 unowned pins; F-G4 informational) | REPLAN-GC-01 corrected all before first dispatch |
| completion (final pass) | all | done (h-bTvU/AbDHp, commit `c72908a`) | arch reconciled across four cycles (v1-shell's first record absorbed); module registry re-derived mechanically; three conventions promoted; one record correction (`combat/triggers → combat` cycle is type-only at creation and remains so — resolved against git, not recency) | see Archivist's Note below |

### Lease violations
- **S03 (one, self-reported):** ck1 commit `0a911b2` includes `src/runtime/index.ts` — one-line additive export of the new `packSpatialModel` in the M03 surface barrel, outside the literal write set. The worker self-reported it in the handoff and `needsOwnerCorrection` before Orchestrator's check; ratified under Auto-Decision precedence 3 (narrowest change satisfying the approved checkpoint; the adapter edge's surface export; D16 precedent from v1-core's identical one-block S06 barrel completion). Never amended; recorded here as the run's one lease violation. All other 16 worker commits verified path-by-path inside their leases. The final Archivist pass verified the record is consistent (STATE DD14a + session row + this report).

### Checkpoint shortfalls
None — every session's claimed checkpoint count matched `git log --oneline -- <lease paths>` exactly (2/2+corr, 3/3, 5/5, 3/3, 3/3+corr).

### Wave plan corrections
None — Planner's `Concurrent with` claim (S03 ∥ S04) verified literally path-by-path (zero intersection across all 10 S03-owned and 9 S04-owned paths); all other waves serial as planned. The replan re-ordered S05's checkpoints (2 → 3) without changing wave membership.

### Granularity feedback for Planner
- No session exhausted context mid-checkpoint; every session committed its first checkpoint well before any context pressure. The 5-checkpoint S03 (the heaviest lease) read checkpoint-scoped and never stalled — the promoted checkpoint-by-checkpoint reading discipline (v1-core's RECOVERY-03 lesson) is working.
- One checkpoint boundary was drawn wrong and repaired by replan before dispatch: S05's original 2-checkpoint plan put the docs-run planned-debt payoff inside the README checkpoint, but the debt fires the moment S04 lands and S05's ck2 gate (`tests/proofs/`) would have collected it — REPLAN-GC-01 re-ordered to 3 checkpoints (payoff first). Planner should order planned-debt payoffs strictly before the gate that collects them.
- S05's handoff flagged one harness trap worth a convention: `declare()` returns `events.sinceRound(round)` (the round's window), so journey assertions on resumed legs need a fresh event sink — a future journey-planning note, recorded in STATE DD17e.

### Process effectiveness
- **First-dispatch completion: 5/5** — every session was accepted on its first dispatch without redispatch or unplanned correction (0 recovery workers needed this run, vs 2 in v1-core and 1 in loot-inventory). The promoted checkpoint-scoped reading discipline and small fact-inlined leases (Planner's decomposition lesson) held.
- **Unplanned corrections: 3** — (1) REPLAN-GC-01 (pre-dispatch plan-text corrections; affected CA-G1/CAP-G1 + CAP-G7; prompt-file lease revision, same-context worker); (2) OWNER-CP-POSITIONS (outside-lease fixture seam from an authorized contract change; 1 test file, separate narrow worker); (3) S03's ratified barrel export (recorded, not reverted). Reason classes: 1 planning defect (mock-vs-prompt anatomy contradiction + unowned pins — the preflight review's job, done), 1 cross-session seam (authorized contract change reaching a consumer fixture), 1 worker-judgment deviation (self-reported). No product decisions and no environment failures were implicated.
- **Integration rework: 1** — S05's burst step (journey-blocking producer gap; adapted in-session as pack data; corrective commit `d3db8ea` is an in-lease lint correction, not the rework; the rework is the test-setup adaptation itself). Affected CAP-G7/CA-G4 (amendment need recorded, not a contract change).
- **Wall-clock per wave (from recorded start/receive):** W0+preflight ~35 min; W1 ~25 min; W2 ~30 min; W3 ~80 min (parallel) + correction ~10 min; W4 ~35 min. No invented history — all from ledger timestamps.

### Capability completion
All in-scope required capabilities are **verified against current sources**: CAP-G1..G6 with named producer/proof checkpoints, and CAP-G7 (the first narrow journey) proven end to end on generated content through the real transport with no mocked boundary. No capability remains planned, blocked, or stale. The feature is complete; product completion additionally inherits the prior features' verified capabilities (v1-core, loot-inventory, and now v1-shell recorded; unchanged by this run — no prior surface was modified outside additive contract/schema growth).

### Follow-up closure ledger
| Source | Entry (verbatim summary) | Disposition |
|---|---|---|
| REPLAN-GC-01 `followUp` | (a) recheck CA-G1 mapping vs committed contract before S02 — done, passed at W1 receive; (b) sweep other prompt files for `reach.keys` — done, only intentional replan prose; (c) registry re-key now owned — done, S02 ck2; (d) docs-run planned debt owned by S05 ck1 | **closed** (each with the checkpoint that closed it) |
| S01 `followUp` | S02 mirror paths + E-SPAT-01 registration + structural/semantic split; S03 adapter + E-SPAT-01 two faces | **closed** — S02 `ad3dc5d`/`98e463e`, S03 `0a911b2` |
| S02 `followUp` | S03 consumes `SpatialDef` + adapter + `pendingId`→rule switch; S04 may declare spatial without stage-8 rejections; future proof owners (S03 adapter tests, S03 rejection shape) | **closed** — S03 `0a911b2` (adapter + switch + tests), S04 `f77bb5d`/`bf30863` (stage-8 zero cards) |
| S03 `followUp` | S05 journey compose chain (positions → reach → restore-close → burst → round-trip) + docs-run fix at ck1; save-rolls facts | **closed** — S05 `efdd69c`/`1cb3e70`; save-branch/modifier facts incorporated (modifier gap recorded as residual debt) |
| S03 `surprises` (1) | Lease violation ratified-or-revert decision | **closed** — ratified (DD14a); recorded in §Lease violations |
| S03 `surprises` (2) | character-profile seam | **closed** — OWNER-CP-POSITIONS `2f3b1d3` |
| S03 `surprises` (3) | docs-run red + fix must update README AND test | **closed** — S05 ck1 paid it; docs-run green |
| S03 `surprises` (4) | `npx vitest run` broken → `pnpm exec vitest run` | **closed** — recorded as DD14e; envelopes updated from S05 on; PROGRAM-CONFIG verification row corrected by the Archivist |
| S03 `surprises` (5) | prompt selector matched nonexistent path | **closed** — theater parity run via real path; recorded |
| S03 `surprises` (6,7) | instance-id reach keys; harness mechanics (ScriptedRng, execSave, save-d20s-as-outcomes, empty-allies self-target) | **closed** — consumed by S05's journey (byte-exact assertions) |
| S04 `followUp` | Theme spatial sections for journey assertions; docs-run debt; perf re-run; theater parity note | **closed** — journey pins them (`efdd69c`); perf 4/4 + proofs 28/28 at close |
| S04 `surprises` (a–d) | docs-run exposure carries forward; token-stringify discipline; stages re-collection arithmetic; no token in reach values | **closed** — all recorded (DD15b/c); exposure paid at S05 ck1 |
| S05 `followUp` (a) | Burst-shape consumer amendment: generated packs cannot declare combat actions from spells | **carried** — to future programs (engine design event; Author/DB re-entry class); owner: next feature's planning; recorded in arch drift notes |
| S05 `followUp` (b) | Move verb stays an open product question | **carried** — human decision when/if wanted (api-map product decision; restore-close seam is the documented v1 answer) |
| S05 `followUp` (c) | `evalPackFormula` parse-once debt + per-target save-modifier gap | **carried** — zero-behavior-change debt, future program |
| S05 `followUp` (d) | Browser determinism leg | **carried** — tracked v1.1 follow-up (inherited) |
| S05 `surprises` (2–7) | Harness facts (round-window declare return; reach-neutral skips; ck3 in-lease correction; dist probes; resumed-fight dice; Prettier normalization) | **closed** — recorded (DD17) and consumed by the journey as landed |

No follow-up left the run without a row above.

### Archivist's Note

## Archivist Note

- **role:** archivist
- **registryUpdated:** true
- **reconciled:**
  - `program/Ruleswright/arch/v1-core.md` — one realized-state record at `c2a8fff` across **four feature cycles** (v1-core, v1-shell, loot-inventory, grid-combat); the Orchestrator-integrated feature fragments collapsed into the M01–M05 module sections and surfaces map; grid deltas folded in (`Pack.spatial`/`checkSpatial`, `evalValidity`, the runtime spatial integration, `ThemeTemplate.spatial` + three spatial themes, the grid journey); **v1-shell received its first record** — absorbing the loot-inventory pass's unfinished record-debt (its final Archivist pass aborted on provider capacity, two attempts, zero writes). Record correction resolved against git, not recency: the standing `combat/triggers.ts → combat.ts` "value-import cycle" was **type-only at creation (`6afbe31`) and remains so** (`41a967b` is format-only) — the record now says so; `character ⇄ progression` is real and stays. Verified-by-execution vs verified-by-source distinguished throughout.
  - `program/Ruleswright/PROGRAM-CONFIG.MD` — module registry re-derived mechanically from value imports of every non-test file at `c2a8fff` (validate/ tree, `SpatialDef`, `evalValidity`, `inventory.ts`, `character-profile.ts`, three spatial themes); M02→M01 re-verified **type-only**.
- **conventionsAdded:**
  - **Pin-lease ownership** (2 program cycles, 3 in-cycle instances: loot F-2, grid F-G2/F-G3) — cross-suite pins name their re-key owner and checkpoint in the plan.
  - **Factual-premise verification at planning time** (2 cycles, 4 instances: loot F-1/F-3/F-4 + grid F-G1) — envelope premises checked against artifacts before dispatch; checkpoint-0 rechecks verify, they do not originate premises.
  - **Whole-repo fast gates at role-scoped receives** (3 cycles: OWNER-01-LINT `c5fbb94`, FORMAT-RECONCILE `8b802b7`, grid `0ab3622`) — every role-scoped receive runs the whole-repo fast gates; red gates clear via format-only owner correction.
  - Verification Commands corrected: `npx vitest run` fails here (DD14e) — **`pnpm exec vitest run <path>`** is the lease-scoped gate; Stack/CI rows updated (ESLint 10, lint on Node 22, format:check).
- **proposedForFramework:**
  - CODER.md bound checkpoint-0 read scope for large sessions — cycles 2, in-cycle instances 2 (v1-core; grid: 0, the discipline held).
  - Orchestrator guardrail for subagent tool-input fabrication + document the `run` argv shape — cycles 2, in-cycle instances 8 (v1-core; grid: 0).
  - PLANNER.md name the barrel/surface-completion checkpoint in the last session's lease — cycles 2, in-cycle instances 3 (OWNER-08-BARREL, D20, grid DD14a `0a911b2`).
  - `commit_pathspec` deleted-file handling — cycles 1, instances 1 (no recurrence).
- **logEntry:** 2025-09-27 dated entry appended to `program/Ruleswright/ARCHIVIST-LOG.md`; prior entry byte-verbatim; standing recommendations carried forward with stable IDs (5 carried, 6 minted); cleanup ledger carried (C5 retired, C6 `parsePackEffects` zero-consumer + C7 `WYLDWOOD` added; no brief threshold crossed).

**Corroboration of the FINAL-REPORT — verified by fresh execution:** `pnpm typecheck` 0 · `pnpm lint` 0 · `pnpm test` **564/564 across 35 files** · `pnpm build` 0 (24 dist files) · `check:isolation` 0 · `check:security` 0 · `pnpm format:check` 0 · `pnpm exec vitest run tests/proofs/` **28/28 across 5 files**. Every headline matches; no count discrepancies this cycle.

**Verified by source:** `RULE_IDS` = 15 with `'E-SPAT-01'` last; `pack.schema.json` `$defs/spatial` matches `mocks/spatial.html` field-for-field; all three themes declare spatial with the recorded reach keys; `grid-journey.test.ts` ran 11/11; README Grid combat section with exactly 4 ```ts blocks, ```json snippet, journey cited; README/journey/contract byte-untouched since `f178c0a`; **DD14a/lease-violation record consistent** (STATE session row + DD14a + S03 receive record + FINAL-REPORT §Lease violations: one ratified, self-reported, never amended).

- **cleanupBriefs:** none — no cluster crossed a brief threshold (C6 `parsePackEffects` is high-confidence zero-consumer but its disposition is blocked on the recorded "spells as combat actions" engine design event, not on evidence; the surface-intent cluster C3/C4/C7 is three related low-confidence findings).
- **standingRecommendations:** the full open backlog is carried in the log's latest table (11 rows: 5 open, 3 promoted this pass, 3 new tracked). Top open rows: subagent tool-input fabrication (2 cycles/8 instances), barrel-completeness lease gaps (2 cycles/3 instances, +1 grid), provider stream aborts with tree-resume recovery (2 cycles/4 instances), bare-`npx` gate hazard (2 cycles/3 instances, partially mitigated by the gate-form correction).

*(In-pass anomaly, disclosed in the log: this Archivist's first PROGRAM-CONFIG.MD write produced corrupted content — the same failure class S02 recorded — caught by the post-write re-read discipline, rewritten cleanly, nothing corrupted committed. `PLANNER.md`/`CODER.md`/`UI-CODER.md`/`ORCHESTRATOR.md` are byte-identical to how this pass found them; adoption was checked by content and by git, not assumed.)*

*(Synthesis commit `c72908a`: `program/Ruleswright/{arch/v1-core.md, PROGRAM-CONFIG.MD, ARCHIVIST-LOG.md}` — explicit pathspec, tree clean.)*