# Author Re-entry — Ruleswright / random-adventures

Planning input, not an implementation lease. No SESSION-NN Owns includes specs, mocks or src/schema/contracts. Planner has not edited them. Existing PROGRAM-CONFIG.MD and its Rules 1–6 remain authoritative except for the user's explicit expansion of adventure/narrative scope.

## Authorization and routing

The user asked: “I want this to be able to play random adventures with this library regardless of ui.” After being offered (1) complete headless adventure loop, (2) random encounter sessions and (3) solo director with automated enemies and narration, the user answered **“plan all three”**. This authorizes planning all three; it is not an instruction to execute this plan, publish, or silently edit Author artifacts.

Orchestrator must route the concrete packets below through Author before dependent Coder dispatch. Requirements/schema/design changes are the human-routed Author classes in the supplied Planner Step 0c; missing new DX surface description is design-fill. The current request settles the scope question, so do not ask “which of the three?” again. Any remaining Author approval must present these specific amendments, not repeat the broad request. Once the builder authorizes execution/amendments, preserve that answer verbatim in STATE and the Author envelope. No Coder may use an unresolved proposal as a committed schema.

All proposed names/paths below are **new**. Author may refine exact schema spelling while preserving the requested meaning; Orchestrator must amend every affected prompt and CA before dispatch, not relay incompatible mappings only in followUp.

## AR-01 — Requirements and architecture scope

**Class/owner:** requirements-change → Spec, with Architect for the composition description. **Blocks:** S01–S04 until approved meaning is recorded. **Input:** requirements.md FR-1/5/6/7/10/13–23, its Constraints/Assumptions, idea.md Non-Goals, architecture.md module boundaries; current inline request.

Concrete amendment:

1. Add an opt-in, headless play layer. Encounter-only mode assembles and plays a random encounter, exposes manual choices/events and atomically saves/resumes the whole session. It may start the next encounter from the settled party without owning a story.
2. Add a finite generated adventure document: original themed locations, meaningful route choices, encounter setups, explicit objective/terminal states and authored rewards. An adventure runtime tracks progress and provides available commands. Existing packs need no new fields: definition/template are separately validated, versioned documents bound to the effective pack identity.
3. Add an optional deterministic offline solo director: control enemy turns and enemy reactions, yield for player commands/choices, and narrate actual events using authored fragments. Preserve no network, no ambient time/randomness, zero engine I/O, host-owned presentation/storage and rules-as-data. No AI vendor is selected. Optional provider integration would be a separate product decision; it is not needed for this plan.
4. Adventure rewards are explicit definition data and use existing awardXp/class split/caps and inventory. The engine does not infer XP from threat. Party XP is explicitly per-member; loot requires an eligible recipient chosen by the host/player. A flavor-only loot roll produces a recorded no-item result. Save the roll once; do not reroll on retry.
5. Rest follows current pools.rest: refill declared pools, clear bindings, no automatic HP healing, resurrection or travel-based condition ticking. Preparation/equipment/consumables remain explicit player commands. Defeat/abandon are terminal outcomes, never success/reward. No new death/injury system.
6. Commands carry expected revision and stable member/choice ids. Wrong identity, stale revision, wrong phase or illegal action rejects without committed aggregate state/RNG/event changes. Low-level Combat may still return its existing rejection event; the aggregate reports that refusal explicitly without a successful transition.
7. A whole-snapshot save is the transaction boundary. Exactly-once receipts apply inside that aggregate's history; independently reopening an earlier save is a deliberate replay branch, not protected cross-device persistence. No database/SQL constraints or application transport exists beyond library calls.

Architect integrates the new subdirectories into existing M01/M03/M04 (no new top-level module or package). Runtime never imports compiler. Preserve all existing low-level APIs and three public subpaths. Review architecture's inherited overview omissions and 'both packs' wording while touching that protected document; this is the existing Architect residual, not a Coder task.

**Receipt:** approved requirement references for CAP-01..06, compatibility note, exact public data boundaries; no model/provider decision unresolved. If the builder changes any behavior above, revise only its dependent CAP/CA/leases before execution.

## AR-02 — Lossless HP and atomic encounter snapshot

**Class/owner:** schema-change → DB. **Blocks:** S01 c1 and its dependents. **Files requested from DB:** specs/database.md, existing src/schema/contracts/snapshots.schema.json, proposed src/schema/contracts/play-session.schema.json. Existing pack/override contracts remain unchanged.

**Demonstrated mismatch:** at plan HEAD, CharacterState.hp is `{current,temp}`, profileFromCharacter uses current HP, and equipment.useItem mutates it. serializeCharacterState omits it; restoreCharacterState reconstructs current from reserveValue and sets temp=0. Plan probe of a wounded dark-fantasy warden: `{current:3,temp:2}` → no saved hp → `{current:27,temp:0}`. FR-14 lossless state and consecutive adventure encounters cannot tolerate this. The character and combat representations describe the same persistent injury, unlike legitimately different enum subjects.

Proposed correction: optional character-state `hp:{current:integer,temp:integer>=0}`; writers emit exact values, including negative current and current above derived max; absence follows the old restore calculation for legacy compatibility. No temp-HP damage mechanics are introduced. Old readers may ignore the new field; document that they cannot preserve the new guarantee. Keep pack schemaVersion and existing snapshotVersion unless DB's compatibility review requires a versioned new file. Do not remove old schema fields or migrate old snapshots.

New play-session envelope must fully carry:

- kind/version; effective pack identity `{id,schemaVersion,contentHash}`; session identity and command revision;
- members `{memberId, character:<character envelope>}` with unique stable member ids, independent of Runtime's minted character ids;
- EncounterSetup: finite positive threat budget, explicit placement/terrain policy, seed inputs; max participants/placement capacity; no implicit scaling by party (assembleEncounter currently ignores party mechanically);
- encounter id/selection, deterministic enemy instance mapping, side membership, fight-start profiles/balances/bindings, original member binding;
- active CombatSnapshot plus **current** spatial positions, terrain, turn-start control state, pending offers/movement (existing nested combat fields), generation/play RNG states and all saved sequence/cursor fields;
- terminal result and subject-bound settlement receipt; current member state and receipt updated atomically.

Existing combat snapshots remain usable with host-restated inputs. The aggregate is the new owner of those formerly external inputs. It must reject wrong pack/hash, duplicate members, inconsistent sides/order, insufficient balances, malformed hp, non-uint32 RNG (2**32 excluded), foreign receipt, and a fight paired with another session. It may not silently combine a current party with an old fight. JSON Schema validates shape; runtime validates cross-field/pack constraints before mutation.

DB also records initial-condition transfer as an opt-in StartCombatRequest addition and the explicit pass-turn operation. Character conditions already have a legal durable encoding; no new condition vocabulary or duration unit is necessary. Rounds remain rounds.

**Proof owner:** S01 c1/c3/c5. HP round-trip, conditioned real action rejection, JSON reopening mid-fight, failed second-member settlement with no first-member debit, repeated receipt with no re-spend, and real second-fight continuity.

## AR-03 — Adventure template and generated definition

**Class/owner:** schema-change → DB. **Blocks:** S02 c1. **Proposed files:** src/schema/contracts/adventure.schema.json (template/definition variants), specs/database.md. The template is separate from current ThemeTemplate and Pack; don't silently add closed pack fields.

Contract content: versioned template identity, finite node bounds; original weighted descriptor tables; explicit entry/spine/branch/terminal construction policy; location/choice text fragments and references; EncounterSetup matching AR-02; allowed rest/preparation points; explicit reward ids, per-member XP and loot table/recipient policy; director priority policy and narration templates. Generated definition carries template identity/version, pack identity, seed, generated node/choice ids and objective, exact resolved graph/encounter/reward data, declared narrative/policy data, and content digest (computed over the definition excluding its own digest). It carries no callbacks, Date values or Runtime instances.

Semantic constraints: unique ids; all references resolve; start and success terminal present; every generated node reachable and at least one success route; finite nonempty table weights; legal threat budgets; encounter layouts sized for the declared participant cap, no duplicate/blocking initial positions; reward items/tables exist; narrative slots refer to declared facts. Generation chooses among explicit authored alternatives; it does not interpret prose as commands or assume all packs share action/table names.

**Proof owners:** S02 c1/c2 generator/schema conformance; S03 c2 real play consumer; S04 c3/c4 policy/narration consumer. These CAs stay provisional until each producer checkpoint lands.

## AR-04 — Whole-adventure save and reward authority

**Class/owner:** schema-change → DB. **Blocks:** S03 c1. **Proposed file:** src/schema/contracts/adventure-snapshot.schema.json; specs/database.md.

Envelope: kind/version, pack and definition identity, stable adventure/member ids, current location/phase, visited and resolved locations, selected choice trail, party snapshots, active encounter aggregate, separate stream states, revision, exact reward rolls/pending claims/committed receipts, adventure-scoped event sequence/journal, director policy identity/state and narration acknowledgement cursor. Distinguish unresolved encounter, pending reward, claimed reward, completed, defeated and abandoned; do not collapse unavailable into completed. Runtime validates legal combinations and refuses tampering before constructing observable state.

Reward mapping: definition reward id+node id+eligible recipient set → one staged roll/claim → actual awardXp/grantItem mutation → receipt in same aggregate. Class XP split is already pack policy; loot recipient is an explicit command argument validated against stored membership. Rest eligibility is stored node policy, never caller-declared. Reopen must preserve ready choices, rewards, HP/resources, identities, RNG, pending player offers and journal cursor.

**Proof owner:** S03 c3/c4; S04 c4 for narration. Completion of S01 snapshot work alone cannot clear this agreement.

## AR-05 — Once-only movement reactions and solo control meaning

**Class/owner:** DB/Spec if a stored contract or behavior note must change; Architect for internal control factoring. **Blocks:** S04 c2 if the receipt isn't resolved. This is not authorization to change unrelated movement rules.

Inherited R-GM-3: movement.walk skips the first leaving-reach check on resumed walks. If replanning changes that step, a different threatener is skipped. Required meaning is already FR-11: leaving reach emits an event; per-call offers are once-only. Preserve suppression for the departure already answered, but enforce a new threatener on the replanned edge. Concrete proposal for DB: add optional pendingMove.offeredDepartures, an array of {from:{x,y}, to:{x,y}, reactorId}, unique by the complete tuple, written whenever a new move pauses. It records departures whose events have already been offered, including offers still waiting in the saved queue. Only resume after that queue is answered. On resume suppress the exact tuple, check a new threatener or changed edge, and discard records when the move ends. Existing snapshots without the field retain the documented legacy first-step suppression; new writers always provide it for paused moves. This preserves old inputs without claiming the stronger fix for old incomplete snapshots. DB must record the compatibility caveat and all cross-field constraints (actor exists, opponent identity, integer positions, no duplicate tuples) in snapshots.schema.json/database.md before S04 dispatch. The correction cannot live in unsaved private state. S04 owns combat/types.ts, snapshots/combat.ts, both exact pendingMove tests, movement journey and the paused-move characterization re-key together.

Solo policy uses existing legal actions, no invented monster spells/slots. maxSteps bounds execution and returns a reason; player offers/choices are not auto-selected. Narration is derived from committed facts; acknowledging sequence n is a command and must reject beyond current journal. No network, external identity/security policy or wall-clock authority applies.

**Proof owner:** S04 c2/c3/c4; consumers blocked: solo movement/control/resume and narrated journal continuation. Proposed code change is not readiness evidence.

## AR-06 — Developer-facing design fill and existing design changes

**Owner:** Designer. **Design-fill:** scoped new random-encounters, random-adventures and solo-director DX surfaces (proposed mocks/random-encounters.html, random-adventures.html, solo-director.html) after AR-01 approval; no application screens. **Design-change:** existing snapshots.html/api-map.html/combat-loop.html descriptions of serializer coverage/HP and new public APIs, and existing spatial.html derived-phase wording (C-S01-1). Protected mocks are never Coder leases.

Specify exact copy-paste flows, choice/command/view/event shapes, save atomicity, refusal display and offline narration anatomy. Missing new descriptions are Orchestrator's design-fill seam and need no fresh product choice; changes to existing behavior follow the human-routed Author path. Existing illustration signatures are illustrative; final data/signatures must match the Architect/DB receipt. Include api-map's carried missing pool:settled/slot:settled/feat:learned entries while revising that map.

**Blocks:** documentation checkpoints S01 c6, S02 c3, S03 c5, S04 c5 where the relevant DX source is missing or contradictory. It does not justify a UI implementation session. Orchestrator may clear design-fill before those checkpoints while unrelated approved implementation proceeds.

## Receive and recheck

Author returns committed exact paths, source revision, structured R1–R4 deviations (or “not a deviation”), approved meaning, compatibility consequences and verification performed. Orchestrator runs whole-repo fast gates at receive, assigns mechanical corrections, then updates CA text and every copied session assumption. Archive historical evidence; do not edit it to make the new decision appear old. Request a scoped Archivist planning-completeness review at the first quiet boundary before dependent execution. This handoff is a concrete planning prerequisite, not a verification-only Coder session.
