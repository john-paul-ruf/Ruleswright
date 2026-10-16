# Planning Evidence — Ruleswright / random-adventures

Plan source revision: `c8e526047b8186d35710965d5f210f858ab232a3`. Working tree was clean before planning. Source reads are anchored to this revision unless marked local/ignored. No source/package/Author changes were made by Planner. Artifact identities below reflect a fresh plan-time build; future execution must rebuild its own revised sources.

## Actual observations

- `pnpm build`: exit 0, tsup ESM/CJS/dts outputs. Log `/tmp/ruleswright-random-adventures-build.log` (host-local, not a durable external link).
- `pnpm typecheck`: exit 0 after that build.
- `pnpm exec vitest run tests/snapshots tests/runtime/encounter.test.ts tests/runtime/combat/character-profile.test.ts tests/proofs/contract-conformance.test.ts tests/proofs/combat-characterization.test.ts`: **7 files, 159 tests passed**, exit 0. Selected counts: encounter 8, character snapshots 22, root snapshots 4, combat characterization 9, combat snapshots 37, character-profile 37, conformance 42. Log `/tmp/ruleswright-random-adventures-tests.log`.
- Existing tests being green does not establish general HP losslessness. Direct built API probe: generated dark-fantasy seed 42, legal hillfolk warden, set hp.current=3/hp.temp=2 and applyCondition('sapped'), serializeCharacter, JSON round trip, restoreCharacter on new Runtime. Before `{current:3,temp:2}`, envelope has **no hp**, after `{current:27,temp:0}`. profileFromCharacter → startCombat with explicit adjacent positions gives **[]** conditions while character holds `sapped` duration 3. Source agrees: snapshots/character.ts serializeCharacterState/restoreCharacterState; combat/combat.ts startCombat conditions initialization. These are evidence for AR-02, not a request to change state names to match mechanically.
- Module edges mechanically derived using the installed TypeScript parser across **77 committed non-test src .ts files**, reading import/export declarations, dropping type-only imports and fully type-only named clauses, counting value export-from, resolving local files/index entries. Edges: M03→M01/M02, M04→M01/M02, M05→M01/M03/M04. M01/M02 no internal value imports. This confirms the existing registry at this HEAD; symbol-consumer greps were not used as edge evidence.
- Runtime/state examples were inspected from source, not guessed from mocks: generateCampaign takes a ThemeTemplate (use loadTheme), serializeCharacter takes `(runtime, state)`, serializeParty takes `(runtime, members)`, deserializeCombat needs restated sides/balances/positions/terrain, and low-level serialize methods return plain objects (hosts stringify). preserve the actual source signatures.

## Current symbol/source index

| Existing symbol / fact                                   | Committed source                                 | Planning consequence                                                                                         |
| -------------------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| generateCampaign, GenerateCampaignRequest                | src/compiler/generate.ts                         | template object, seed, optional knobs; separate new generator                                                |
| loadTheme / bundled exports                              | src/compiler/theme-loader.ts, index.ts           | use existing three named themes in proofs                                                                    |
| Runtime constructor, nextCharacterId                     | src/runtime/runtime.ts                           | real validation; restored character ids are not stable member identities                                     |
| CharacterState / createCharacter / derived               | src/runtime/character.ts                         | HP current/temp and public facade are separate from snapshot DTO                                             |
| profileFromCharacter, settleItemUses, settleSpellCasts   | src/runtime/character-profile.ts                 | profile gap; original balances; live-object idempotence only                                                 |
| assembleEncounter, spawnEncounter                        | src/runtime/encounter.ts                         | max bodies 12; party does not scale budget; positive affordable inputs required; wrapper remaps instance ids |
| startCombat, Combat.declare/use/respond/step             | src/runtime/combat/combat.ts                     | actual transport/control; step on awaiting-declare replenishes, not pass                                     |
| StartCombatRequest, DeclareOptions, CombatState          | src/runtime/combat/types.ts                      | optional positions/terrain and no initial conditions today                                                   |
| pass / preview                                           | **Absent at plan HEAD**, planned S01 c2 / S04 c1 | do not call as existing APIs in c0                                                                           |
| restoreCharacter, restoreParty, serializeCharacter/Party | src/runtime/snapshots/character.ts               | exact existing fields and lost HP mapping                                                                    |
| serializeCombat, deserializeCombat, CombatRestoreRequest | src/runtime/snapshots/combat.ts                  | current restore.positions overrides frozen positions; start balance restatement required                     |
| walk/resumeMove                                          | src/runtime/combat/movement.ts                   | R-GM-3 first-step skip; own correction and restart test                                                      |
| awardXp / xpSplit                                        | src/runtime/progression.ts                       | class split/caps/max-level semantics, not party award policy                                                 |
| rollLoot/grantLoot/grantItem                             | src/runtime/inventory.ts                         | flavor may grant nothing; explicit pending reward roll/recipient                                             |
| rest / prepareSpell                                      | src/runtime/pools.ts                             | refill pools, clear slots; no HP heal                                                                        |
| applyCondition / useItem                                 | src/runtime/conditions.ts, equipment.ts          | duration is currently overwritten after event emission                                                       |
| EventStream / RuntimeEvent                               | src/runtime/events.ts                            | at round/turn repeats across fights; cannot supply persistent adventure cursor                               |
| packContentHash                                          | src/schema/version.ts                            | canonical deterministic content identity, not a cryptographic authorization signature                        |
| Rng / RngState / rollTable                               | src/core/rng.ts, tables.ts                       | existing sole randomness/table mechanisms                                                                    |
| RuntimeRuleError / ruleCard / makeErrorCard              | src/runtime/errors.ts, src/schema/error-card.ts  | existing named error surface, no registry expansion needed                                                   |

New paths/types/functions in the session Files tables and code signatures are **proposals owned by named sessions**, with Author-controlled DTOs pending. They are not assertions that matching committed symbols exist. Existing readers/constraints were traced before prescribing their correction.

## Harness inspection

Node Vitest includes tests/**/\*.test.ts and excludes tests/browser/**. Existing built-package journeys directly import dist/runtime.js and dist/compiler.js; they need a fresh build before both test and typecheck. New journeys follow that production path, with CJS smoke. There is no native app bridge or server to launch. Host persistence is detached JSON → discarded objects → new Runtime/facade. This is the real library restart boundary; it makes no claim about a third-party filesystem/cloud adapter.

Browser config uses @vitest/browser with Playwright headless at the existing default server port 63315, source via Vite; screenshotFailures=false prevents unleased screenshot output. New browser tests are automatically discovered by tests/browser/**/*.test.ts. Electron script runs its install.js then ELECTRON_RUN_AS_NODE with a test identity guard; it tests Node/V8, not an Electron renderer. docs-run extracts four ts blocks, strips imports for execution and maps packages to src for typechecking: each changed example owns its extractor/registration changes and behavioral negative controls. Runtime isolation gate currently checks only generateCampaign; S02 owns its expansion and new subprocess self-tests.

No remote CI, browsers or Electron were run during planning. Six prior VERIFICATION files were consulted as historical evidence; the current contract-conformance baseline carries B-BD-1. Full historical raw run logs were not reviewed. Author.md was read in full; execution protocol sections were checked, not executed.

## Tool identities

- Node: `/Users/the.phoenix/.nvm/versions/node/v24.20.0/bin/node`, v24.20.0.
- pnpm: `/Users/the.phoenix/.nvm/versions/node/v24.20.0/bin/pnpm`, 10.15.0.
- Vitest: repository `node_modules/.bin/vitest` wrapper, resolved package in node_modules/.pnpm/vitest@2.1.8_…/node_modules/vitest/package.json, 2.1.8. `pnpm exec vitest --help` inspected for actual run/config/browser/timeouts/output options.
- tsup: repository wrapper → node_modules/.pnpm/tsup@8.5.1_postcss@8.5.28_typescript@5.6.3/node_modules/tsup, 8.5.1.
- TypeScript: node_modules/.pnpm/typescript@5.6.3/node_modules/typescript, 5.6.3.
- Playwright: node_modules/.pnpm/playwright@1.62.1/node_modules/playwright, 1.62.1; installed package identity only, browser executables not probed anew.
- Electron: node_modules/.pnpm/electron@44.7.0/node_modules/electron, 44.7.0; installed package identity only, actual binary not launched anew.
- No new external vendor CLI, daemon endpoint or model protocol is prescribed.

## Source digest manifest

SHA256 of inspected sources at planning. A digest identifies the artifact, not a claim that every line in every historical record was reconciled. Scope is documented in STATE. .program and program-agents are local ignored sources; preserve their content digest alongside committed inputs.

| Path                                                               | SHA256                                                             |
| ------------------------------------------------------------------ | ------------------------------------------------------------------ |
| `program/Ruleswright/PROGRAM-CONFIG.MD`                            | `3562420c23955e7ce7375a3ae2c1598ed3832cced9560b8f108e2916a7d8297c` |
| `program/Ruleswright/specs/idea.md`                                | `43f6f8bca12d15640848393d868646143e2e8a45cbcd16c03679e9b895ba3dd6` |
| `program/Ruleswright/specs/requirements.md`                        | `e77884de09fe5dcd080bf924368927385cefee0a5dbdb065926098d974be7fee` |
| `program/Ruleswright/specs/design.md`                              | `231f9f67daae3ecb455987e9e02228f0eaf1826e38fbe17eb90881641b36853d` |
| `program/Ruleswright/specs/architecture.md`                        | `b93864bede5fba2914a5040984351d4365fbbc370dbb64f2da1f18bfdcd31729` |
| `program/Ruleswright/specs/database.md`                            | `44ec484c9760ba6d411ce63e58386c5f858fd9c38b19699bce53bd5d888185be` |
| `program/Ruleswright/arch/v1-core.md`                              | `2cc454cff3e40ce1c5a83f523a879644be02b9040c2543d92617362fb3cefac8` |
| `program/Ruleswright/ARCHIVIST-LOG.md`                             | `debfe1f30d013afcac06068d753d077edf25143dbd3fc24ad3d017622bf18958` |
| `.program/ledger.md`                                               | `850e960cc46416c067ff48810459b854797dc58916df14072e44aaed63b22229` |
| `.program/blockers.md`                                             | `d2114ae0a8e67555a39a8d2add2b4126e7b878c5a7184d0de4c66645c67d5105` |
| `.program/decisions.md`                                            | `ccafd79cbc868f6e1e5e2fbb13325f580741b6cac8eeedb593941b0d06092fb8` |
| `program-agents/AUTHOR.md`                                         | `503bbf75302a501587c0e3e6a39fe3bf812a7c00867031bafd0eb3392e819d2e` |
| `program-agents/CODER.md`                                          | `681f0c298788d07fda8dc85810c05cf18a693949e1c18c4a5ca7e531925c6564` |
| `program-agents/ORCHESTRATOR.md`                                   | `72cd95c001150958fed780052a4237e658a27d49b58356e984609104872facc2` |
| `program-agents/ARCHIVIST.md`                                      | `36b032ef1bb491aa64a5e8ed8b173d94d05b2c804d1d4ee320f9e45091856f12` |
| `package.json`                                                     | `1388bf62889b623402fa21e02fe287cec83c168acc7ae9ec91e153e75866de40` |
| `pnpm-lock.yaml`                                                   | `75bdb93fb5f6a7dd0325cda0eb522cf4ea798eadb6cd563093f600d1532b9343` |
| `tsconfig.json`                                                    | `b9981f4cc307a52ee50610320a526e627ff9a1fab145a1fb5cbc34e099a2e302` |
| `vitest.config.ts`                                                 | `317f13bd0fc3ec7ad02caac079035d8aa77b594c2f391454c36162833adab984` |
| `vitest.browser.config.ts`                                         | `6a3ac84b93638f45a0cb3b7be37c6687b94ae395e36315264c1a2cc956fce737` |
| `tsup.config.ts`                                                   | `823edbebf1b3ae1e1b4a9c4ee8f0c758e1f3cc1b1fbe4b788faf24c8b57afcb7` |
| `scripts/check-runtime-isolation.mjs`                              | `45443c8299d4249b249092acc0cd4352d147ed8d423a47e58b186a2ca728966b` |
| `scripts/check-security-lint.mjs`                                  | `f677acc6b721431a22d9d82a8c22cb17564851515601f3fd0190c2e6bbd3f057` |
| `.github/workflows/ci.yml`                                         | `697891cb407b38bf23648e67fcdb34270fcf843d404e696f075b10533fb1c018` |
| `src/runtime/character.ts`                                         | `319db54dbd022f91b715458f0276957a24bcf49bb3cdbaa2318000e245de6c09` |
| `src/runtime/character-profile.ts`                                 | `aad97ef767798f96649c67990cfa6d9fc1b2b0acd5978a5970aebfa5e42af363` |
| `src/runtime/snapshots/character.ts`                               | `ba9d8c33835bd77c65198989cd850d3153ae7f21376aa50da4ea8bd890097553` |
| `src/runtime/snapshots/combat.ts`                                  | `c17b4e90728ba753fa0fc2892983811d318770aa8479c7321d8e3affe0ffbe11` |
| `src/runtime/encounter.ts`                                         | `4059a784f6e960c247fee79b9f804d1c51f729c6faccb973fdaf7845ac67cf33` |
| `src/runtime/combat/combat.ts`                                     | `c24bc74ac54ddba48c77ffedaf019ec93dda2327a26ddb897c34d13da525f8ea` |
| `src/runtime/combat/types.ts`                                      | `19ac65ea9a951d9366c37332e14ccfffc6f46ebfabbe6003f20ebe0b2f55aae9` |
| `src/runtime/combat/movement.ts`                                   | `7ae22aa071ca5e4eefaf66fd3a553b72beac1a7e436fbbd7a13b2109450ee3d6` |
| `src/runtime/combat/declare.ts`                                    | `c2e6b5452ff71eedfff545e2d6c86d7a22c032276db581a474335960a081b177` |
| `src/runtime/events.ts`                                            | `1d7141c6184c28210b73edd59215ad90b25674d5447ff5b61d489a22227cccff` |
| `src/runtime/inventory.ts`                                         | `d9d389788767e7303c90fe5d3c16163347eea4e92fc53f5bdd8efffdbc2c08bc` |
| `src/runtime/equipment.ts`                                         | `1954be041a0c6c816cb1c5a542ac4596b550cb72e2c0f61da81ae775538e7add` |
| `src/runtime/conditions.ts`                                        | `39e1c135a9875dfdfa0e70919a52ceff70af9baa2c8f1022248fed35e12b66de` |
| `src/runtime/pools.ts`                                             | `e9ca8260dd03b37929a1a177c0b328a11a4cf73e4f43bffab7788e48d1c92f9d` |
| `src/runtime/progression.ts`                                       | `78d0ea569e27b416f93c355ce9f02f94ecdf792bed120b3e2b04b6dc341a8a6e` |
| `src/schema/version.ts`                                            | `21dfe1acac9f571b5cb8db701af18ba9b244458e7f596c20098ff49364e7105c` |
| `src/schema/contracts/snapshots.schema.json`                       | `b22b80f4d0c98c3ef065ffe9d6ed8d0a2c491be596be003ca7dff6327be94e27` |
| `tests/proofs/docs-run.test.ts`                                    | `6c8d9be6fb7e8fb500bffea5f835c1861215d26dbbf4ca3a81d342b3f32694da` |
| `tests/proofs/determinism-oracle.ts`                               | `fbdb0092cf6788e8787798c4842171562ef157a1192d91d8377d58a5234f659e` |
| `tests/proofs/contract-conformance.test.ts`                        | `3cf6b19626850d00003fe905f35ceb4e876fa739234b44da8b1a6ae570d90702` |
| `tests/runtime/combat/module-surface.test.ts`                      | `a517dc3deb1a4484295dc56e4a346cbd538bc0b041f58cd7b37bfe198732b447` |
| `tests/browser/determinism.test.ts`                                | `d973cf22021fb9edad026fd5f917263ec621fb9864c2023eecbf0c824622830d` |
| `program/Ruleswright/prompts/feat-progression/VERIFICATION.md`     | `8e3a94bd34d1bb443d9fffaf0c8ac62bbc7d5c25432fc1ea912ae50c9bd50035` |
| `program/Ruleswright/prompts/builder-rulings/VERIFICATION.md`      | `0f93ff3919dac9828163726e1f8839a84b8e4b676c7bc9929abffc8627e20636` |
| `program/Ruleswright/prompts/combat-decomposition/VERIFICATION.md` | `2ad4d3401f8ed6f02b19f0ba14eadc4a73bb827980864c1fa361c4085222acd8` |
| `program/Ruleswright/prompts/class-features/VERIFICATION.md`       | `bfeffa20416cc28d5a9d2835d742fe3ac63467a3c2be50c92f2e9c93ad25e9fb` |
| `program/Ruleswright/prompts/browser-determinism/VERIFICATION.md`  | `933c84c5c7e34999ccdfa61e6c7ad0ffb3af6c5900cb414dd4c407d27b6ae6d1` |
| `program/Ruleswright/prompts/contract-conformance/VERIFICATION.md` | `35310b4879305f9fedfd9a29a88e2d93f5c1ba2a0f97c46b4c5907d94b33c8bd` |
| `program/Ruleswright/prompts/contract-conformance/STATE.md`        | `afc00b43380e731f4ab213be3a9c343a435ed531e3f486555bf32af50917047d` |

## Fresh plan-time built artifacts

| Path                | SHA256                                                             |
| ------------------- | ------------------------------------------------------------------ |
| `dist/runtime.js`   | `0e27315a18ccfd54ad03ddb09dcee559d319ff2f90c5964cea9ee0f7a4e80320` |
| `dist/runtime.cjs`  | `67186c97415097cafe133dc271c5d32b856539585dc859ccfa51e4b9543b8298` |
| `dist/compiler.js`  | `46348bc64415d8d5806b84226351657710bdf69d0e70221d6efb75b4f2d9783b` |
| `dist/compiler.cjs` | `cc9be56b667df0bc7465c6c87b5b23e5530fb20fcb58d88f9ea67c208346f661` |
| `dist/schema.js`    | `197066dabd9c700568808096c63217feba0640e232f2001e78f69cca3dc4aab5` |

## Planning artifact checks

The final mechanical audit compared every session's Owns with its Files table, lease-manifest.json and STATE row: 27/16/18/30 exact paths, respectively, with 6/3/5/5 checkpoints. It checked existing versus proposed file actions against committed sources and predecessor outputs, excluded protected Author and shared bookkeeping paths, and checked Markdown links, fenced blocks and the empty execution Handoff Notes section. All sessions are serial; no concurrent lease overlap is declared. Prettier checked the nine planning artifacts. These checks validate planning structure, not future implementation, contract agreement or Archivist's planning-completeness verdict.
