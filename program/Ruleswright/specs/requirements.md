# Requirements — Ruleswright

> **Status:** Revised after the builder walkthrough (Q1–Q5 locked, legal hardening Q8, decision log at bottom).
> Supersedes the initial draft in its entirety. Renamed to **Ruleswright**; expression policy applied (decision log Q6–Q7).
>
> **Governing principle: rules are data.** The engine implements mechanics *generically*;
> packs declare *specifics*. Any feature that can be expressed as pack content must be
> pack content. Engine changes are for new *mechanisms*, never new *rules*.

## Product Definition

A headless TypeScript library that turns a one-line theme — "zombie urban," "dark fantasy" —
into a complete, playable d20-style campaign: a JSON content pack consumed by an embeddable
runtime providing party management, character management, and combat management. Every
rule, skill, feat, spell, save, table, and monster lives in the pack. A theme compiler
expands theme templates into packs deterministically from a seed. The opt-in play layer adds
random encounters, finite pack-bound adventures and offline solo direction (FR-24–29).

---

## Functional Requirements

### A. Runtime Core

### FR-1: Deterministic dice & randomness
- **User story:** As a host-app developer, I want seeded, injectable dice so that sessions are reproducible and combat logic is testable.
- **Acceptance criteria:**
  - [ ] All randomness flows through an injectable RNG; no ambient `Math.random` anywhere in the library.
  - [ ] Rolls return structured results (sides, values, modifiers, total, purpose) — not bare numbers.
  - [ ] Same seed + same call sequence ⇒ identical results on every platform.
  - [ ] RNG state can be exported and reimported (required by FR-14 snapshots).

### FR-2: Pack loading & validation
- **User story:** As a pack author, I want bad content rejected loudly at load so that errors never surface mid-combat.
- **Acceptance criteria:**
  - [ ] Engine loads a pack and validates schema *and* semantics (broken references, bad formulas, duplicate ids) at load time.
  - [ ] Validation errors name the offending artifact's id and JSON path, and state the violated rule.
  - [ ] A pack that fails validation is never partially loaded.
  - [ ] Optional `license` and `attribution` fields in the pack manifest; the engine carries and surfaces them but never enforces or verifies them.

### FR-3: Formula & effect DSL
- **User story:** As a pack author, I want to declare derived stats and effect behavior as data so the engine never hard-codes a rule.
- **Acceptance criteria:**
  - [ ] A small declarative formula DSL computes derived stats (max HP, AC, attack bonus, save targets, pool capacities) from abilities, class, level, and equipment.
  - [ ] A small declarative effect DSL expresses what actions do: attack rolls, saves, damage, condition application, targeting, sequencing (do X, then Y).
  - [ ] Both DSLs are pure data — no dynamic code execution (see NFR-Security).
  - [ ] All combat math flows through pack formulas: the engine's only resolution primitive is `d20 + attackBonus ≥ defenseTarget`, with both sides computed by pack formulas. Ascending AC and descending AC / class attack-table conventions are both expressible; the engine never knows which convention a pack uses.

### FR-4: Generic action economy
- **User story:** As a pack author, I want to declare action types, costs, and slots so combat structure is themeable without engine changes.
- **Acceptance criteria:**
  - [ ] The engine implements a generic slot/points economy; it does not know "standard/move/swift" by name.
  - [ ] Packs declare action types with: cost (slots and/or resources), validity conditions, and an effect-DSL body.
  - [ ] The classic d20 turn structure (standard + move, etc.) is *sample pack content*, not engine code.
  - [ ] Packs may declare **triggered/reactive actions** ("when event X occurs, actor may react") that ride the FR-13 event substrate.

### FR-5: Characters
- **User story:** As a host-app developer, I want fully pack-driven characters with serializable state so sheets persist anywhere.
- **Acceptance criteria:**
  - [ ] Abilities are **name-keyed** (engine stores by string name); the v1 validator enforces the classic six as a convention. Extending the ability set later is a validator relaxation, not an engine change.
  - [ ] Saves are **name-keyed**; the pack declares which saves exist (the classic-CRPG sample ships five named saves; a 3.5-style pack would ship three).
  - [ ] Skills, feats, inventory, and active conditions are all pack-driven character state.
  - [ ] Character state is plain serializable JSON (FR-14) — no class instances, no closures, no hidden state.
  - [ ] Illegal builds (bad multiclass, exceeded skill points, unknown feat) are rejected with the violated rule named.

### FR-6: Progression & multi-class
- **User story:** As a pack author, I want leveling to read from pack tables so any progression scheme works.
- **Acceptance criteria:**
  - [ ] Progression tables in the pack define: HD, attack progression (classic to-hit tables by class/level), save progressions, feat slots, class features, and vancian slot tables.
  - [ ] XP accumulates on the character; the engine emits events and never decides awards — hosts/GMs award XP, including explicit authored adventure rewards (FR-27); threat never implies an award.
  - [ ] Direct level-set is supported for character creation (no XP simulation needed); both paths validate identically.
  - [ ] **Multi-class in v1:** a character may hold multiple concurrent classes with XP split per pack policy; each class contributes its own progression tables (including slot tables for vancian casters).
  - [ ] Race/class restriction matrices and level caps are pack data (classic demihuman caps included).

### FR-7: Conditions
- **User story:** As a pack author, I want conditions as data so status effects are themeable.
- **Acceptance criteria:**
  - [ ] Conditions are pack-declared with durations and pack-declared stacking policy.
  - [ ] Conditions may carry a `restricts` field (e.g., a "Silenced" condition blocks casting from verbal-list spells).
  - [ ] Condition application/removal flows through the event system (FR-13).

### B. Magic & Resources

### FR-8: Resource pools — drain & vancian
- **User story:** As a pack author, I want both mana-style pools and memorized-slot magic so classic and modern casting both work.
- **Acceptance criteria:**
  - [ ] **Drain pools:** capacity from a pack formula; spend points; refill per pack-declared policy.
  - [ ] **Vancian slots:** pack declares a progression table (class level → slots per spell level); character state stores, per spell level, an array of **bindings** — each slot empty or bound to a memorized spell id.
  - [ ] Casting a spell consumes a *bound* slot of the matching level; an empty slot cannot cast.
  - [ ] Rest is a host-emitted event; slot-clearing and pool-refill policies are pack-declared.
  - [ ] All pool and binding state is plain JSON inside character snapshots — snapshot-safe and resumable (FR-14).

### FR-9: Spells as data
- **User story:** As a pack author, I want to add a spell by adding a pack entry so magic scales by authoring, not engineering.
- **Acceptance criteria:**
  - [ ] There is **no magic subsystem**: a spell is an action declaration (FR-4) plus magic metadata (spell level, lists it belongs to) and a cost referencing a pool or slot level.
  - [ ] Characters have a *known spells* list (gated by pack restriction tables) distinct from *prepared slots* (FR-8 bindings).
  - [ ] Memorization is itself a pack-declared action, so house rules (extra slots, swap-on-rest) stay data.
  - [ ] Casting rides the normal action pipeline: validate → consume → resolve effect DSL → emit events.
  - [ ] Effect-DSL **targeting** supports multi-target effects, per-target saves, and mixed outcomes (save for half, save vs. condition).
  - [ ] Spells declare a **range** as pack data. In a pack with a spatial model, a spell whose target (or area center) is farther than its range is rejected declaratively, with no state change. A spell that declares no range reaches as far as its caster's reach. Theater-of-mind packs never consult range.
  - [ ] The class/armor restriction matrix (who may cast in what armor) is pack data.
  - [ ] Adding a new spell to a pack requires zero engine changes (proof test, FR-12).

### C. Combat

### FR-10: Combat engine
- **User story:** As a host-app developer, I want stepwise, resumable combat so I can build any UI or pacing on top.
- **Acceptance criteria:**
  - [ ] Initiative → rounds → turns; a turn is a sequence of pack-declared action slots (FR-4).
  - [ ] Attack rolls, saves, damage, and conditions all resolve through pack formulas and the effect DSL.
  - [ ] Combat advances stepwise (begin turn → declare action → resolve → end turn), so hosts can animate or prompt between steps.
  - [ ] Combat state is snapshot/resume-capable mid-fight (FR-14).

### FR-11: Optional spatial layer
- **User story:** As a pack author, I want optional positions and areas so tactical packs get geometry and theater-of-mind packs don't pay for it.
- **Acceptance criteria:**
  - [ ] Packs may declare a spatial model: positions, adjacency, reach. Packs may declare no spatial model and everything else works.
  - [ ] Melee attacks may require adjacency; reach extends it — all pack-declared.
  - [ ] Area shapes in v1: **single-target** and **radius burst**. Cone and line are explicitly deferred (they are engine geometry and cannot be faked in data).
  - [ ] AoE resolution uses the targeting DSL (FR-9): all entities in shape, per-target saves, mixed outcomes.
  - [ ] An area spell may be **centered on an empty cell**. Every combatant within the shape is affected, on both sides, each with its own save, and an area that catches nobody is still a legal cast.
  - [ ] Packs may declare a **hex** spatial model beside the square grid. Hex positions are axial coordinates, and distance, reach and burst use hex distance.
  - [ ] **Movement is pack data:** a pack declares move actions whose effect is `move(<formula>)`, budgeted by the pack's optional `speed` formula. A move is declared like any action, with a destination. It spends the pack's declared slots and is restricted by conditions like any tagged action (e.g. `rooted` restricts `actions.tagged:move`).
  - [ ] The engine moves along the cheapest legal path. A move that cannot reach its destination within budget is rejected declaratively, with no state change.
  - [ ] **Terrain is pack-declared:** kinds are either blocking or cost-per-cell (difficult). The host places terrain per fight, just as it places positions. The engine never invents a map.
  - [ ] **Leaving reach is an event** (`move:leaving-reach`). Packs may declare reactions to it (opportunity attacks). A move pauses while such offers are open and resumes when they are answered.
  - [ ] Theater-of-mind packs pay nothing: move actions resolve as no-ops, and packs with move content still load without a spatial model.

### FR-12: Rules-are-data proof
- **User story:** As the builder, I want hard proof that new rules don't require engine changes so v2 combat reaches stay cheap.
- **Acceptance criteria:**
  - [ ] CI proof test 1: a test pack adds a **new action type + new condition**; combat behavior changes; zero engine diffs.
  - [ ] CI proof test 2: a test pack declares a **triggered action**; the engine executes it via event hooks; zero engine diffs.
  - [ ] CI proof test 3: a test pack adds a **new spell**; it is memorized, bound, and cast; zero engine diffs.

### D. State, Events, Persistence

### FR-13: Events & provenance
- **User story:** As a host-app developer, I want every mutation to emit a provenanced event so UIs, logs, and replays are all derivable.
- **Acceptance criteria:**
  - [ ] Every state mutation emits an event carrying `why`: the rule/pack id and roll references that caused it.
  - [ ] The event stream is the substrate for triggered actions (FR-4) and reactive feats.
  - [ ] Hosts may subscribe; the engine never requires a subscriber.

### FR-14: Snapshots (save/load)
- **User story:** As a host-app developer, I want lossless snapshots as plain JSON so my app owns storage.
- **Acceptance criteria:**
  - [ ] Snapshots carry **state only**: characters (exact current and temporary HP, abilities, saves, skills, feats, classes + XP split, pools, slot bindings, conditions, inventory), party membership, and combat state (initiative order, round, current turn, per-combatant transients).
  - [ ] Snapshots include **RNG state** — a resumed fight rolls the same future as an uninterrupted one (testable).
  - [ ] Snapshots include **pack identity**: pack id, version, content hash.
  - [ ] On load, the engine verifies pack identity and **refuses loudly on mismatch** — no mangled characters.
  - [ ] No snapshot migration in v1 (documented v2 seam); a schema/content version bump renders old snapshots stale, and the API says so plainly.
  - [ ] New character writers preserve signed integer current HP (including above-derived-max values) and nonnegative integer temporary HP without clamping. Legacy snapshots without HP use the old reconstruction; old readers cannot promise injury preservation. Temporary HP remains bookkeeping, not new absorption mechanics.
  - [ ] Three independent serializers: character, party, combat. A combat snapshot names the party snapshot it pairs with; docs state the pairing.
  - [ ] The engine performs **no I/O of any kind** — no filesystem, no DB, no localStorage, no autosave timers. serializers return plain JSON objects; hosts use `JSON.stringify` for bytes; storage adapters are third-party territory.

### E. Content Tooling

### FR-15: Table engine
- **User story:** As a pack author, I want one table system shared by runtime and compiler so lookup tables are written once.
- **Acceptance criteria:**
  - [ ] Pack-declared tables (weighted entries, ranges, nesting) usable at runtime for loot/encounters and by the compiler for generation.
  - [ ] There is exactly one table engine — the compiler has no private second implementation.
  - [ ] Table rolls use the seeded RNG (FR-1): same seed ⇒ same results.

### FR-16: Bestiary & encounters
- **User story:** As a GM-developer, I want monster statblocks and threat-budget encounter assembly so combat prep is data-driven.
- **Acceptance criteria:**
  - [ ] Monsters are pack statblocks built from the same character machinery (abilities, attack tables, saves, actions).
  - [ ] Encounter assembly takes a threat budget and party composition; output is deterministic per seed.
  - [ ] The assembly heuristic is documented; hosts may override or bypass it.

### FR-17: Campaign generation
- **User story:** As a GM-developer, I want theme → complete pack in one call so starting a campaign is trivial.
- **Acceptance criteria:**
  - [ ] `generateCampaign({ theme, seed, knobs })` returns a complete, valid pack: skills, feats, classes, races, saves, spells, conditions, equipment, bestiary, tables.
  - [ ] Deterministic: same theme + seed + knobs ⇒ byte-identical pack.
  - [ ] Fully offline; no network calls.
  - [ ] Generated output is validated by the runtime's own validator (FR-2) — the compiler dogfoods the engine's validation.

### FR-18: Theme knobs
- **User story:** As a host-app developer, I want knobs declared by the theme so I can render a settings UI from theme data alone.
- **Acceptance criteria:**
  - [ ] Themes declare their knobs: id, type, allowed values or range, default, description.
  - [ ] Knob declarations are machine-readable; a host can build a settings form without knowing the theme.
  - [ ] Knob values feed generation and are recorded in the generated pack's provenance.

### FR-19: Override layer
- **User story:** As a GM, I want to hand-edit any generated artifact without forking the pack.
- **Acceptance criteria:**
  - [ ] Every artifact in a pack is addressable by a stable id.
  - [ ] Overrides merge at load with documented precedence.
  - [ ] Same-seed regeneration reproduces identical packs, so GM edits remain anchorable across regenerations.

### FR-20: Theme composition
- **User story:** As a pack author, I want to compose themes from bases so content scales by reuse.
- **Acceptance criteria:**
  - [ ] A theme may declare a base theme plus patches; merge semantics are documented.
  - [ ] Composition is exercised by tests even though the shipped sample themes stand alone.

### F. Sample Content & Packaging

### FR-21: Sample theme coverage floors
- **User story:** As the builder, I want sample packs sized by coverage so the format is proven without drowning in content.
- **Acceptance criteria:** Each sample pack must be the smallest pack that exercises every capability at least once:
  - [ ] 2+ classes with attack tables, save progressions, HD.
  - [ ] 1+ legal multi-class combo (multiclass must be exercised).
  - [ ] A race with a level cap (classic cap curve).
  - [ ] The full named save set (five for the classic-CRPG-flavored pack).
  - [ ] Working skills and feats, including 1 reactive feat (FR-12 proof 2).
  - [ ] Vancian magic end-to-end: memorize → bind → cast → rest-refill.
  - [ ] Several conditions, including one with `restricts`.
  - [ ] Melee (adjacency), ranged, and 1 burst-area spell.
  - [ ] Encounter/loot tables and knobs that visibly change output.
  - [ ] 1 documented example override.
- **Theme split:**
  - [ ] **Dark fantasy** = vancian showcase: ~3 classes, **~40ish spells across levels 1–3**, full race matrix with demihuman multi-class and level caps.
  - [ ] All spell, class, and save names coined (expression policy, NFR-Legal): no SRD spell names or statblock phrasing even where OGL-licensed names exist — original-only keeps the pack entirely outside the OGL.
  - [ ] **Zombie urban** = drain-pool & table showcase: survivor classes with a stamina/adrenaline pool, skills-heavy (scavenging, fortification, streetwise), table-heavy (infection saves, district loot), no vancian magic (small ritual/psychic list at most).
  - [ ] Progression tables cover levels 1–10; demihuman caps land lower.
  - [ ] Both packs validate cleanly through the runtime validator (FR-2).

### FR-22: Entry points & runtime-only consumption
- **User story:** As a dev embedding combat in my own game, I want the runtime without the compiler so my bundle stays lean.
- **Acceptance criteria:**
  - [ ] Three public surfaces: **runtime**, **pack format/schema**, **compiler** — separately consumable.
  - [ ] The runtime is first-class standalone: it does not import generator code, and a runtime-only browser bundle contains none of it (tree-shakeable).
  - [ ] Packaging mechanism (subpath exports vs. workspace packages) is an architecture-phase decision; *this* requirement is only that runtime-only consumption is first-class.

### FR-23: Schema versioning contract
- **User story:** As a pack author, I want versioning to be a contract so upgrades never surprise me.
- **Acceptance criteria:**
  - [ ] Every pack declares `schemaVersion`; the engine validates compatibility at load.
  - [ ] Major schema bumps are breaking by definition and ship with a written compatibility note.
  - [ ] One versioning discipline across packs, overrides, and snapshots (pairs with FR-14's load refusal).

---

### G. Opt-in Headless Play — approved AR-01–AR-06

These are approved contracts for implementation, not a claim of delivered capabilities. Existing FR-1–23 remain binding. Plan-local RA-01–06/CAP-01–06 map in order to FR-24–29.

### FR-24: Playable random encounters (RA-01 / CAP-01; AR-01/02)
- **User story:** As a host developer, I want to play and resume a random encounter without supplying an application UI or a story.
- **Acceptance criteria:**
  - [ ] Explicit seed, positive finite threat budget, stable session/member ids, participant cap and layout/terrain policy produce an affordable nonempty encounter. Party composition does not implicitly scale the budget.
  - [ ] Detached views expose manual actions, reactions and pass-turn control. Start conditions transfer with their actual remaining round durations; restrictions apply through real combat. Passing advances once and cannot refresh the same turn's resources or bypass an unanswered offer.
  - [ ] One aggregate saves member envelopes, original combat bindings/profiles/balances, selection/enemy ids/sides, raw fight state, current positions/terrain, turn-start control, pending offers/movement, stream states, sequences and settlement receipts. Restore requires only the effective pack plus that document.
  - [ ] Settlement stages every member's HP/conditions/item/pool/slot changes and the subject-bound receipt together. A failure on any member commits nothing. Repeated settlement returns its receipt without re-spending. The next encounter uses the settled party.

### FR-25: Finite portable adventures (RA-02 / CAP-02; AR-01/03)
- **User story:** As a content author, I want authored themed alternatives to generate a finite playable adventure as portable data.
- **Acceptance criteria:**
  - [ ] Separate versioned templates and generated definitions bind effective pack id/schemaVersion/contentHash. Existing Pack, ThemeTemplate and override fields and pack generation bytes remain unchanged.
  - [ ] Templates declare finite node bounds, weighted original descriptor tables, entry/spine/branch/terminal construction, choice text, encounter setups, rest/preparation policy, rewards, director priorities and narration fragments. The bounded generator selects authored alternatives through the existing table engine.
  - [ ] Definitions carry template id/version, pack identity, seed, unique resolved nodes/choices, explicit objective/success terminal, setups/rewards/policy/narrative facts and a canonical content digest excluding itself. No Runtime instances, callbacks or dates.
  - [ ] Every node is reachable; a success route exists; refs, weights, budgets, capacities and nonblocking unique initial positions validate before output. Original templates exercise dark-fantasy, zombie-urban and wyldwood; compatible hand-authored packs are supported without a theme-name dependency.

### FR-26: Manual adventure progression (RA-03 / CAP-03; AR-01/04)
- **User story:** As a player through any host, I want meaningful route choices and real encounters leading to an explicit terminal outcome.
- **Acceptance criteria:**
  - [ ] The immutable definition and saved location/phase/revision determine legal commands and available/unavailable choices with reasons. Caller-supplied eligibility is never authority.
  - [ ] A real settled victory resolves its encounter node; unresolved encounters, pending rewards, claimed rewards, completed, defeated and abandoned remain distinct. Running out of candidates is not success.
  - [ ] Defeat and abandon are terminal without success rewards; actual injury and spend remain saved. No death/injury subsystem, resurrection, travel condition ticks or automatic HP healing is added.
  - [ ] Commands identify the aggregate and expected revision, plus stable member/choice ids where applicable. Wrong identity/revision/phase or illegal action returns an explicit refusal with no committed aggregate state, RNG or journal change. Existing low-level Combat rejection events remain compatible.

### FR-27: Durable rewards, preparation and whole saves (RA-04 / CAP-04; AR-02/04)
- **User story:** As a host developer, I want progression and saves to survive restart without duplicate awards or lost injury.
- **Acceptance criteria:**
  - [ ] Definition reward id + node id + eligible member set authorize nonnegative XP **per member**, then existing awardXp class split/caps/level policy; never derive XP from monster threat or accept an XP amount in a claim command.
  - [ ] Roll a reward table once, persist its exact roll/provenance and staged item or flavor/no-item outcome, then require the host's eligible loot recipient. Apply all XP/inventory changes and receipt atomically. Retry/reopen never rerolls or awards twice within the same history.
  - [ ] Saved node policy controls rest availability. Rest refills declared pools and clears bindings, with no HP heal/resurrection. Preparing, equipping, unequipping and using consumables are explicit player commands; retain current mechanics.
  - [ ] Whole saves include pack/definition identity, stable membership, progress/trail, party/active encounter, separate streams, revision, reward rolls/claims/receipts, event journal/sequence, director policy/state and narration cursor. Validate all structural and cross-field constraints before exposing state.
  - [ ] The whole snapshot is the transaction boundary. Exactly-once receipts cover that history only; reopening an earlier save creates a deliberate replay branch. No external concurrency, database constraint, storage or transport guarantee is implied.

### FR-28: Bounded offline solo direction (RA-05 / CAP-05; AR-05)
- **User story:** As a solo player, I want enemies controlled deterministically while I retain player actions and choices.
- **Acceptance criteria:**
  - [ ] Pure legal-action preview shares production gates and changes no RNG/state/events. Policy orders bounded legal enemy actions, movement, pass and reactions; it invents no monster spells, slots or action names.
  - [ ] An explicit positive maxSteps bounds work and reports player/choice/terminal/budget/stalled yield reasons. Dividing the same work into smaller budgets preserves decisions and results. Player turns, offers, routes, recipients and preparation remain player-controlled.
  - [ ] Paused movement saves offered departures by complete from/to/reactor tuple, including queued offers; resume waits for the queue and suppresses only that tuple. Changed edge/new threatener is checked. Discard records at move end. New writers include the records; legacy omission retains the old first-step suppression and cannot promise the stronger behavior.

### FR-29: Factual offline narration (RA-06 / CAP-06; AR-05/06)
- **User story:** As a host developer, I want structured facts and optional authored narration independent of rendering.
- **Acceptance criteria:**
  - [ ] Pure narration reads committed adventure sequence/journal facts, actor/target bindings and rule/roll provenance. Unknown events retain a factual fallback; negative damage amounts are healing. Prose never drives mechanics.
  - [ ] Stable messages carry source sequence and template identity. Reading consumes no entropy or cursor; explicit acknowledgement is monotonic and cannot exceed the current journal. Restart preserves acknowledged/unacknowledged boundaries.
  - [ ] Encounter/manual/solo DX examples expose exact commands, detached views, refusals and atomic saves, with host-owned storage/presentation. All are offline, with no ambient randomness/time, I/O, player autoplay or provider integration.

---

## Non-Functional Requirements

- **Performance:**
  - Resolve a full combat round, 10 combatants, in < 50 ms (typical laptop).
  - Generate a full campaign pack in < 2 s.
  - Load + validate a sample-sized pack in < 500 ms.
  - Snapshot round-trip (serialize + deserialize, typical party) in < 50 ms.
- **Determinism:** Same seed + same inputs ⇒ byte-identical packs and identical roll sequences on Node, browsers, and Electron.
- **Security:** No dynamic code execution anywhere — no `eval`, no `new Function`, no data-driven imports. Packs are pure data. No network calls, no telemetry.
- **Platform:** Node LTS, evergreen browsers, Electron. ESM primary. Consumable from plain JavaScript with full TypeScript types available.
- **DX:** Full TypeScript types on every public surface. Docs whose examples are runnable code — the quickstart is copy-paste: generate a pack → build a character → run three rounds of combat. Error messages name the artifact, the JSON path, and the violated rule.
- **Dependencies:** Near-zero runtime dependencies; build/dev tooling unconstrained (Architect's call).
- **Legal & Expression:** No third-party product-identity terms in shipped content or public docs. "d20" appears only as a generic descriptive term in body text — never in a title, logo, or system name; the final product name (**Ruleswright**) must remain clear of existing marks in tabletop gaming and developer tooling before any public release — npm availability is not trademark clearance; run a USPTO search (nearest neighbor: Gamewright, a tabletop publisher). Edition-specific mechanics are described in coined terms (e.g., "class attack table," "five named saves"), never by protected product names.

## Constraints

- The library ships **no SRD/OGL text**; the *format* is SRD-shaped, the sample content is original.
- **Classic 1980s-CRPG feel, d20 heart:** attack tables, descending AC (expressible, not hard-coded), five named saves, race/class matrix, level caps, vancian slots. Excluded esoterica (percentile strength, weapon-speed factors, weapon-vs-armor tables, segment initiative) remain *addable as pack data* later.
- Skills exist even though the classic edition had none (builder's founding requirement).
- **Deferred, with seams (not rejections):** cone/line AoE; snapshot migration; 5e-style progression (proficiency bonus); material components; metamagic; spell research; counterspell mechanics beyond the reactive substrate; unbounded/model-generated stories beyond FR-25/29; storage adapters; VTT integration; SRD content packs.
- Themes are trusted developer-authored data, not untrusted user input; validation guards structure, not hostility.

## Dependencies

- None at runtime (goal: near-zero runtime dependencies).
- Build/test tooling: Architect's decision.

## Assumptions

- Hosts own persistence, pacing, and all presentation.
- Hosts supply authored narrative data; the optional generator selects finite routes and fragments, and narration projects committed facts. No provider, prose model or external service is selected.
- One active (possibly merged) pack per game instance; merging is FR-19/FR-20 territory.

## Glossary

- **Pack:** The complete JSON rules + content document the runtime consumes.
- **Theme / theme template:** The generator input that expands into a pack.
- **Knob:** A declared, typed generation setting exposed by a theme.
- **Binding:** A vancian slot's memorized-spell association (empty or spell id).
- **Drain pool:** A spend-points resource (mana-style), as opposed to slots.
- **Coverage floor:** The minimum set of capabilities a sample pack must exercise.
- **Override:** A GM/author patch to a single artifact, merged at load.
- **Classic-CRPG feel:** Classic AD&D-1e-flavored structure (attack tables, descending AC, five saves, race/class limits, vancian magic) without the deep esoterica. Internal shorthand only; public docs use the neutral phrase.
- **Spatial layer:** Optional positions/adjacency/reach model; ignorable by theater-of-mind packs.
- **Provenance:** The rule id and roll references explaining why a mutation happened.
- **License/attribution metadata:** Optional pack-manifest fields declaring a pack's terms; carried and surfaced by the engine, never enforced.

## Decision Log (builder walkthrough)

| # | Decision | Encoded in |
|---|---|---|
| Q1 | Action economy = generic slots/points (Option B); packs declare action types via effect DSL; optional spatial layer in v1; triggered actions ride events | FR-3, FR-4, FR-11, FR-13 |
| Q2 | Name-keyed abilities & saves; derived stats via formula DSL; progression from pack tables; host awards XP; direct level-set; multi-class in v1; classic-CRPG structure (attack tables, descending AC expressible, five saves, race/class matrix, level caps); engine resolution primitive stays generic | FR-3, FR-5, FR-6, FR-10 |
| Q2-magic | No magic subsystem: spells are actions; drain + vancian pools; bindings in snapshots; memorization as pack action; targeting DSL; AoE = single + burst in v1 | FR-8, FR-9, FR-11 |
| Q3 | Coverage floors, not word counts; dark fantasy = vancian showcase (~40ish spells L1–3); zombie urban = drain/table showcase; levels 1–10 | FR-21 |
| Q4 | Snapshots = state only + RNG state + pack identity; loud mismatch refusal; three independent serializers; engine does no I/O; no migration in v1 | FR-14 |
| Q5 | Runtime/format/compiler as separate consumable surfaces; `schemaVersion` contract; DX bar (types + runnable docs) | FR-22, FR-23, NFR-DX |
| Q6 | **Rename to Ruleswright** (legal: "d20 System" is WotC-adjacent; Ruleswright verified available on npm). Final name cleared before public release; `d20-rpg-system` remains internal codename only | Headers, NFR-Legal |
| Q7 | **Expression policy:** original content only; coined terminology for edition-specific mechanics; optional pack `license`/`attribution` metadata (carried, not enforced) | FR-2, NFR-Legal, Constraints |
| Q8 | Legal hardening: coined-names rule bites at the authoring floor, not just globally; clearance scope = existing marks in tabletop gaming and developer tooling; USPTO search required (npm availability ≠ clearance) | FR-21, NFR-Legal |
| 2026-09-29 | grid-movement: movement as pack data (Option B); hex model additive; terrain pack-declared + host-placed; provoke via pack reactions (human) | FR-11 |
| 2026-09-30 | spells-in-combat: spells declare a range (pack data; absent = caster reach); area spells may be centered on an empty cell (human) | FR-9, FR-11 |
| 2026-10-16 | AR-01–AR-06: “start” approved the presented amendments; “i authorize it” authorized deliberate Author re-entry. Exact meanings above are pre-approved; implementation/proof remains with S01–S04. | FR-14, FR-24–29; idea scope; Designer/Architect/DB receipts |
