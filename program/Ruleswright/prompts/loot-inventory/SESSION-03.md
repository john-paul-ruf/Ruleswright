# SESSION-03 — Integration Proof + Docs

> **Program:** Ruleswright
> **Feature:** loot-inventory
> **Modules:** M03 (runtime — README-adjacent tests only), M04, M05
> **Depends on:** SESSION-01, SESSION-02
> **Concurrent with:** —
> **Owns:** `tests/proofs/loot-journey.test.ts`, `tests/proofs/docs-run.test.ts`, `README.md`
> **Reads:** `src/runtime/**` (committed), `src/compiler/**` (committed), `src/index.ts`, `package.json`, `tsup.config.ts`, `.github/workflows/ci.yml`, `tests/compiler/themes.test.ts` (S02's committed seam test), `program/Ruleswright/specs/design.md`
> **Resources:** —
> **Checkpoints:** 2

## Module Context
| ID | Module | Read | Why |
|----|--------|------|-----|
| M05 | Root entry + README | yes | The quickstart is an executed+typechecked artifact (docs-run) — extending it re-keys its assertions |
| M03/M04 | Committed surfaces | yes | The journey runs through the built package (`dist/`), per the first-narrow-journey discipline |

## Context
S01 built the character-side inventory; S02 closed the compiler's items gap and
added the wyldwood theme. What no session has yet proven is the **composed
journey through the built package**: theme → generated pack (with items) →
character → loot roll → inventory → snapshot → restore, all through
`dist/` (the artifact a consumer actually installs), plus docs that keep
themselves honest. This is the feature's integration owner. It also carries the
one README change the feature warrants, because `docs-run.test.ts` executes and
typechecks whatever the README claims.

**v1-core lesson applied:** this is deliberately a small session — journey test +
docs only, no engine code — so the S08-style 5-failure dispatch cluster (big
integration sessions) cannot recur. Every fact it needs is in committed source.

## Capabilities
- **CAP-05 — The loot journey (integration):** generate wyldwood with the built
  package → validate → `Runtime` → character → `loot()` → inventory state →
  `serializeCharacter` → `restoreCharacter` → identical stacks. Entry:
  the built package's public exports only. Observable success: deterministic
  grants for the fixed seed; lossless round-trip; `loot:rolled` provenance.
  Integration owner/checkpoint: this session, checkpoint 1.
- **CAP-06 — Docs parity:** the README's loot section runs verbatim and
  compiles under the consumer's strict tsc (the two-pass NFR-DX discipline);
  every output block quotes observed output.

## Contract Agreements
- **CA-01 (recheck at checkpoint 0):** the snapshot fidelity proof is S01's
  committed test — confirm it exists and passes (`npx vitest run
  tests/snapshots/character.test.ts`) before asserting the journey's restore
  leg. Do not re-derive its assertions; cite them.
- **CA-02 (recheck):** the journey's grants must match the committed
  `inventory.ts` mapping — assert the exact stacks the committed convention
  yields for the fixed seed (read S02's themes.test.ts seam test for the
  expected values; if the two disagree, report `blocked` with both lines).
- No new CA: no API changes in this session; a doc edit is not a contract.

## Files to Create/Modify
| File | Action | What Changes |
|---|---|---|
| `tests/proofs/loot-journey.test.ts` | create | The composed end-to-end journey through the built dist |
| `README.md` | modify | A short "loot & inventory" section appended after the combat quickstart block (see constraints) |
| `tests/proofs/docs-run.test.ts` | modify | Blocks-count expectation 3 → 4 + assertions for the new block's outputs |

## Implementation

### Checkpoint 1 — the built-package journey
1. `pnpm build` first (the journey consumes dist, not src — artifact freshness:
   rebuild, then assert against the fresh output). **Record the dist file list
   (count) in the Handoff** — dist identity travels with the journey assertions
   (CAP-05's artifact-freshness evidence).
2. Read `tests/proofs/docs-run.test.ts`'s execution mechanics (the
   `new Function` verbatim-execution pattern) — mirror its discipline for the
   journey test.
3. `tests/proofs/loot-journey.test.ts` — the assertions:
   - Built `ruleswright/compiler` via **direct dist paths** — e.g.
     `import { generateCampaign, loadTheme } from '../../dist/compiler.js';`
     `import { Runtime, grantLoot, serializeCharacter, restoreCharacter } from '../../dist/runtime.js';`
     — and pin the exact resolution you use in the test header. Do NOT follow
     docs-run's SURFACE_MODULES package-specifier style: it maps to `src/`
     (tests/proofs/docs-run.test.ts:43-48) and would prove src, not dist.
     `generateCampaign({ theme: loadTheme('wyldwood'), seed: 42 })` ⇒ manifest
     id `wyldwood`, `content.items` non-empty, ≥2 loot-family tables.
   - `validatePack` zero cards (the dogfood gate, stage 8's own check re-proven
     through dist).
   - `new Runtime(pack)` loads (identity + formulas reserved ids hold).
   - `createCharacter` ⇒ `state.inventory` empty array.
   - `grantLoot(rt, state, '<a loot table>', { seed: 7 })` twice ⇒ identical
     `state.inventory` (CA-02 through real generated data) — assert the exact
     stacks.
   - `loot:rolled` event present, `why.rule` = `tables.<tableId>`;
     `item:granted` events name `content.items.<id>`.
   - `serializeCharacter(rt, state)` ⇒ `state.inventory` exactly the stacks;
     `JSON.parse(JSON.stringify(snap))` ⇒ `restoreCharacter` on a fresh Runtime
     ⇒ `restored.state` deep-equals the original state.
   - Runtime-only-bundle honesty: `generateCampaign` still absent from
     `dist/runtime.js` (re-run `node scripts/check-runtime-isolation.mjs` — a
     check, not an edit; the script is root-owned and unchanged).
4. Note in the test header: this is the feature's first narrow journey proof;
   the S05 ck2 lineage.

**Commit when:** `pnpm build` exit 0; `npx vitest run
tests/proofs/loot-journey.test.ts` green; `pnpm typecheck && pnpm lint && pnpm test`
exit 0. Pathspec: `git add -- tests/proofs/loot-journey.test.ts`.

### Checkpoint 2 — README section + docs re-key
1. Read the README's quickstart section + `docs-run.test.ts` fully before
   editing (the block-extraction regex, the 3-block expectation, the
   typecheck pass's SURFACE_MODULES map, the anatomy pinning assertions).
2. Append a fourth ```ts block + expected-output block to the README:
   ```ts
   import { grantLoot } from 'ruleswright/runtime';

   // Roll a loot table through the pack's own tables, into the character's inventory.
   grantLoot(rt, brynn.state, 'barrow-loot', { seed: 42 });
   console.log(brynn.state.inventory);
   ```
   **Only if dark-fantasy's generated pack contains a grantable
   `barrow-loot` value chain** (verify by reading the theme's tables: it nests
   to common-relics/warded-gear whose values are item ids — it does). The
   producer of the quoted output line is this session's own run (S02's seam
   handoff carries wyldwood seed 7, a different table — S01's Handoff names the
   FIXTURE district-scavenge line, not dark-fantasy's barrow-loot). Run the
   block and quote the **actual** observed output; if seed 42's barrow-loot
   roll lands its weight-1 `nothing` flavor branch (dark-fantasy.json:634) the
   `grantLoot` call rejects (`loot-grants-nothing`) — **pre-verify seed 42's
   barrow-loot path by running it before pinning the block, or use a different
   seed / a no-nothing-branch table; never pin a thrown rejection as docs
   output.** If your run shows different counts than a prior handoff, trust
   your run and say so in the Handoff.
   Constraints: keep the established README voice (short, no marketing, honest
   limits); no new CI claims (the browser leg stays a v1.1 follow-up — the
   anatomy test greps for it); do not reword existing sections (the execution
   pass joins ALL blocks — earlier blocks must keep producing their pinned
   outputs).
3. `docs-run.test.ts`: the `expect(blocks.length).toBe(3)` → `toBe(4)`; extend
   the return object and assertions for the new block (inventory contents for
   the seed; `grantLoot` in the parameter list); the typecheck pass needs no
   loosening — the new block must compile under strict tsc as-is.
4. Re-run the two docs passes; fix the block until both pass.

**Commit when:** typecheck + lint exit 0; `npx vitest run tests/proofs/docs-run.test.ts`
green; whole `pnpm test` green. Pathspec:
`git add -- README.md tests/proofs/docs-run.test.ts`.

## Verification
- Whole-repo gates: `pnpm typecheck && pnpm lint && pnpm test` (baseline at
  plan HEAD: 421/421; expect growth from S01/S02's suites — no regression).
- `pnpm build && node scripts/check-runtime-isolation.mjs && node
  scripts/check-security-lint.mjs` (all three exit 0; the journey re-proved
  bundle isolation against the rebuilt dist).
- Determinism re-proof through dist: the journey test's grants are identical
  across two in-process calls AND a fresh `Runtime` — quote the stacks.
- CI honesty: this session edits no workflow file; assert in the Handoff that
  the ci.yml themes job will pick up wyldwood unchanged (it runs the coverage
  floor over both themes via the test file S02 re-keyed — confirm by reading
  ci.yml's themes step, read-only).

## State Update
Return a Handoff with: status; checkpoint commits; **dist artifact identity
(file count) recorded alongside the journey assertions**; journey proof pointers
(exact assertions that passed); docs block count + the observed output line;
checks run + counts; surprises; followUp (none expected — name any residual
debt explicitly, e.g. a theme-level knob that visibly re-weights loot left
undemonstrated, with an owner).