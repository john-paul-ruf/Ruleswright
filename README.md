# Ruleswright

Headless TypeScript library: a one-line theme becomes a complete, playable d20-style
campaign pack — consumed by an embeddable party / character / combat runtime.

**Rules are data.** The engine implements mechanics generically; packs declare specifics.
No magic subsystem, no hardcoded action slots, no second table engine — packs declare
specifics, the engine interprets them.

- Zero runtime dependencies. Engine performs no I/O — hosts own storage, pacing, and UI.
- Determinism to the byte: same theme + seed + knobs ⇒ byte-identical packs; same seed +
  same call sequence ⇒ identical rolls. Verified in CI on the Node 18/20/22 matrix, in
  Chromium, Firefox and WebKit (Vitest browser mode), and under Electron's runtime.
- Three surfaces: `ruleswright/runtime` (dice, characters, combat, snapshots, events),
  `ruleswright/schema` (the pack format, validator, version contract), and
  `ruleswright/compiler` (theme → pack generation, knobs, stage pipeline).

## Quickstart

Every line below is copy-paste runnable and every step shows its expected output
(NFR-DX; executed AND typechecked by `tests/proofs/docs-run.test.ts`).

### 01 — Generate a campaign

```ts
import { generateCampaign, loadTheme } from 'ruleswright/compiler';

// Theme + seed + knobs → complete pack. Fully offline.
const pack = generateCampaign({
  theme: loadTheme('dark-fantasy'),
  seed: 42,
});
```

Expected output:

```
✓ dark-fantasy · schemaVersion 1 · validated by the runtime's own validator
  3 classes · 33 spells (levels 1–3) · 5 named saves · 4 bestiary entries
  (generated in ~6 ms — the < 2 s budget is generous by design)
```

### 02 — Build a character

```ts
import { Runtime } from 'ruleswright/runtime';

const rt = new Runtime(pack);

const brynn = rt.createCharacter({
  name: 'Brynn',
  race: 'hillfolk',
  classes: [{ id: 'warden', level: 1 }],
});

console.log(brynn.derived());
```

Expected output (stats resolve through the pack's own formulas — the engine
never hardcodes hp/ac math; the descending-AC convention is the pack's, not
the engine's):

```
{ hp: 27, ac: 12, saves: { vigor: 0, grace: 0, tenacity: 0, reason: 0, presence: 0 } }
```

### 03 — Run a round of combat

Combat advances stepwise (`step()` between any two host actions), every mutation
emits a provenanced event (`why.rule` names the pack artifact, `why.rolls` quote
the dice), and triggers ride the event substrate.

```ts
import { startCombat, spawnMonster, profileFromCharacter } from 'ruleswright/runtime';

const events = [];
rt.events.on((event) => events.push(event));

// Brynn herself fights: her profile + pool/slot balances, actions from her class.
const fight = startCombat(rt, {
  allies: [{ id: 'brynn', ...profileFromCharacter(rt, brynn) }],
  enemies: [{ id: 'wight', profile: spawnMonster(rt, 'barrow-wight', 'wight') }],
  // The generated pack declares a grid (FR-11): every combatant states its
  // position. One step apart — adjacent, so the melee actions still resolve.
  positions: { brynn: { x: 0, y: 0 }, wight: { x: 1, y: 0 } },
});

while (!fight.roundComplete) {
  if (fight.state.phase === 'awaiting-declare') {
    const active = fight.state.combatants[fight.state.active]!;
    fight.declare(active.actions[0]!);
  }
  fight.step(); // begin → declare → resolve → end
}

const attack = rt.events.sinceRound(1).find((event) => event.type === 'attack:rolled');
if (attack === undefined)
  throw new Error(
    'no attack:rolled event was emitted — a fight where nobody attacks is a bug, not a quickstart state',
  );
console.log(attack.why.rolls[0], attack.why.rule);
```

Expected output (seed 42 — the wight wins initiative and its first attack misses
Brynn's own pack-derived ac 12; the damage event still carries its provenance):

```
d20[9]=9 < ac12 actions.cut-down.attackBonus
```

### 04 — Roll loot into the inventory

Characters hold pack-declared items as `{ id, qty }` stacks. `grantLoot` rolls a
pack table through the one table engine and maps what it lands into the
character's inventory; every step emits its provenanced event.

```ts
import { grantLoot } from 'ruleswright/runtime';

// Roll a loot table through the pack's own tables, into the character's inventory.
grantLoot(rt, brynn.state, 'barrow-loot', { seed: 42 });
console.log(brynn.state.inventory);
```

Expected output (seed 42 — `barrow-loot` recurses into the pack's own
`common-relics`/`warded-gear` tables and lands a real item; a seed whose roll
lands the table's flavor branches grants nothing and rejects loudly instead of
inventing loot):

```
[{ id: 'grave-ward', qty: 1 }]
```

Items are `{ id, qty }` stacks keyed by id: the same table rolled again with the
same seed stacks (qty 2); ids must resolve in the pack's `content.items` at
grant time — unknown ids are named rejections, never silent. Loot rolls are
deterministic per seed, like everything else (FR-1).

- `profileFromCharacter(rt, character, id?)` returns `{ profile, balances }`: current
  hp, `derived()` ac/attack bonus, the pack's `initiative` formula, the union of the
  character's class `actions` (pack v1.2) followed by the actions its class features
  unlock (v1.10), its pool points + bound spell slots, the spells it knows, its slot
  bindings, any armor that blocks slot casting, and its reactive feats (learned, then
  granted by class features).
  A character with no class `actions` and no unlocked action cannot fight
  (`no-combat-actions`).
- The fight ends by one engine rule (`combat.sideDefeated`): after any resolution, once every
  combatant on one side is at hp ≤ 0, `fight.state.phase` becomes `combat-over`, one `combat:ended`
  event names `{ winner, defeated }`, and `step()` returns `{ kind: "combat-over" }` from then on.
  Downed combatants (hp ≤ 0) skip their turns and are offered no triggers. A combat snapshot
  taken at the end restores as `combat-over`. Damage is not floored: a downed combatant's hp
  can be negative, and the combat snapshot stores it as-is (snapshot contract v1.11).
- v1 limits: active conditions are not carried into the fight; a multiclass character
  on the attack-table convention uses the row of its highest-level table class, at
  that class's level, re-keyed to the character's total level.

## Grid combat

Every theme generated by the compiler declares an optional spatial model
(FR-11) — the pack's own `spatial` section, not an engine setting. When it is
present, combat is positional; when it is absent, the same fight runs as
theater of mind and the engine pays nothing:

```json
{
  "spatial": {
    "model": "grid",
    "reach": { "default": 1, "barrow-wight": 2 },
    "shapes": ["single", "burst"],
    "terrain": { "rubble": { "cost": 2 }, "pillar": { "blocks": true } }
  }
}
```

The host declares a grid position for every combatant at `startCombat`
(`positions`) — the engine never invents a grid, and a spatial pack refuses a
positionless fight loudly rather than guessing. Dark-fantasy's grid is square: distance is
Chebyshev, melee reach is measured in grid steps, and a per-id reach override
(`"barrow-wight": 2`) extends that combatant's adjacency while everyone else
uses the default. An out-of-reach declare is refused declaratively — one
`declare:rejected` event, rule `E-SPAT-01`, no state change — and an action
whose `valid` clause says `hasTarget(adjacent)` fails the same way when no
combatant resolves for the shape. Burst spells (`target(burst-N, …)`) are declared like
actions — `fight.declare('ember-bloom', { targetId })` — and resolve
every combatant within Chebyshev radius N of the _declared target_, on both
sides, each taking its own save; a pool-based theme casts with no binding,
while a vancian theme (dark-fantasy) must prepare the spell into a slot first —
an empty slot cannot cast (`E-VANC-01`).

An action whose effect is wrapped in `target(self, …)` is a _self action_: it acts on
whoever uses it. Dark-fantasy's `withdraw` (`target(self, applyCondition(braced, 2))`),
`brace` and `ward-glint`, zombie-urban's `fall-back`, `barricade`, `dodge-roll` and
`adrenal-spike`, and wyldwood's `fall-back`, `circle-path` and `ward-step` all work this
way. A self action needs no target and has no reach gate. It works with any number of
opponents at any distance, on a grid, a hex map or in theater of mind, and a taken self
reaction lands on the reactor. Naming anyone else, as in
`fight.declare('withdraw', { targetId: 'wight-1' })`, is refused as `invalid-target`
(rule `E-REF-01`) and changes nothing. Restrictions still apply, so a warden rooted by its
own `brace` cannot `stride`. Spells are not self actions: a caster wards itself by naming
its own id as the `targetId`.

### Movement, hex and terrain

Movement is pack data, not an engine verb. A pack declares a move action whose
effect is `move(<formula>)`, budgeted by the optional reserved `speed` formula
(evaluated like `initiative` onto every combatant profile). Every bundled theme
ships one — dark-fantasy's `stride`, zombie-urban's `hustle`, wyldwood's
`glide` — at the end of every class and every statblock action list, so heroes
and monsters alike can close distance:

```json
{
  "actions": {
    "stride": { "cost": { "slots": { "move": 1 } }, "effect": "move(speed)", "tags": ["move"] }
  },
  "formulas": { "speed": { "expr": "4 + floor(grace / 4)" } }
}
```

A move is declared like any action, with a destination:
`fight.declare('stride', { to: { x: 3, y: 3 } })`. The engine walks the
cheapest legal path within the budget (deterministic: a fixed neighbor order
breaks ties), spends the move slot, and emits `move:advanced {from, to, path,
cost, remaining}` then `move:ended {reason, at}`; unspent budget is lost. The
`rooted` condition restricts `actions.tagged:move`, so a rooted combatant's
move is refused (`restricted`) with no engine special case.

**Geometry.** `grid` is the square grid: Chebyshev distance, 8 neighbors, a
diagonal step costs 1. `hex` (wyldwood) reuses the same `{x, y}` positions as
axial `{q, r}`: distance is `(|dq| + |dr| + |dq + dr|) / 2`, with 6 neighbors.
Reach, `adjacent` and burst all use the pack's distance.

**Terrain.** The pack declares the vocabulary; the host places cells per fight
(`startCombat({ …, positions, terrain: [{ at: { x, y }, kind }] })`) and
re-states them on restore — the engine never invents a map. From the generated
wyldwood pack (seed 42):

```json
{
  "spatial": {
    "model": "hex",
    "reach": { "default": 1, "hollow-wight": 2 },
    "shapes": ["single", "burst"],
    "terrain": { "bramble": { "cost": 2 }, "standing-stone": { "blocks": true } }
  }
}
```

Entering a cell costs its kind's `cost` (plain cells cost 1); a `blocks` cell
can never be entered. `startCombat` refuses an unknown kind, a cell placed
twice, or a combatant standing on a blocking cell — one `E-SPAT-01` aggregate,
nothing built — and restore applies the same refusals.

**Occupancy and rejections.** A move cannot end on a cell held by a standing
combatant, the mover's own cell included; it may pass through standing allies
but not standing enemies, and downed combatants never block. A move that
cannot be made is one `declare:rejected`, rule `E-SPAT-01`, and nothing changes
— no slot spent, no dice drawn, no ledger entry:

```text
no-destination   a move action declared without `to`
blocked          the destination is a blocking terrain cell
occupied         a standing combatant holds the destination (the mover included)
unreachable      no legal path exists at any cost
out-of-range     a legal path exists, but its cheapest cost exceeds the budget
```

**Leaving reach.** Before each step, if the mover stands within reach of a
standing opponent and the next cell does not, the engine emits
`move:leaving-reach` (actor = the mover, target = the threatener, payload
`{at, next}`). Opportunity attacks are pack data: each theme ships a reaction on
`move:leaving-reach[target=self]` — `opportunist`, `cheap-shot`, `bramble-snap`
— whose effect is the theme's own melee attack. An offer pauses the move: the
mover carries `pendingMove {actionId, to, remaining}` until the host has
answered every open offer, then the move re-plans from where it stands with the
remaining budget:

```text
fight.declare('glide', { to: { x: -3, y: 0 } })
  move:leaving-reach  hero ← foe · at (0,0) next (-1,0)
  // offer foe.bramble-snap — the move pauses at (0,0)
fight.respond('foe.bramble-snap', 'take', 'hero')   // pass the mover as the target
  trigger:fired · attack:rolled · damage:applied
  // every offer answered (take or decline) → the move resumes
  move:advanced · move:ended arrived @ (-3,0)
```

Offers are per call: a `declare`, `respond` or `use` raises offers only for the
events it emitted, and each matching (reactor, event) pair is offered exactly
once. `step()` while a move is paused forfeits it (`move:ended` reason
`forfeited`). A paused move survives a snapshot: `pendingMove` rides in the
combat envelope, and a restore (positions and terrain re-stated) resumes in the
`resolved` phase, so the restored fight answers — or forfeits — exactly as the
uninterrupted one would.

Moves outside the rules stay the host's: at the between-steps boundary (FR-10)
`serializeCombat` hands you the whole fight as JSON, and `deserializeCombat`
with updated `positions` re-states everyone where they stand — the restored
fight re-enforces the same gates (an out-of-reach declare still refuses) and
resumes mid-round with the snapshot's dice-stream state, so the next roll
equals the uninterrupted fight's next roll. The engine never requires positions
on a non-spatial pack: there, positions and terrain ride along but are never
consulted, `hasTarget(adjacent)` passes, a burst resolves to its bound target
only, and a move action is a no-op success.

The whole journey — generate → load → position → the reach gate's rejection →
restore-close distance → a burst with per-target saves → snapshot round-trip —
runs in `tests/proofs/grid-journey.test.ts` against the real generated
dark-fantasy pack (seed 42); this example is executed by that test (NFR-DX).
The movement journey — a hex glide around a standing-stone wall and through
bramble, the five rejection kinds, an opportunity attack that pauses a move
across a JSON snapshot and resumes identically, square-grid parity, the
theater-of-mind no-op, and a 2-vs-2 fight in which monsters close the gap —
runs in `tests/proofs/movement-journey.test.ts` against the generated wyldwood
and dark-fantasy packs (seed 42).

- The engine performed **no I/O** anywhere above — `serialize()` hands you JSON;
  your app owns storage (FR-14).
- Same theme + seed + knobs ⇒ byte-identical pack; same seed + same call sequence
  ⇒ identical rolls on Node, browsers, Electron (FR-1, FR-17; verified in CI on the
  Node 18/20/22 matrix, in Chromium, Firefox and WebKit, and under Electron's runtime).

## Spells and feats in combat

A spell is declared like an action, by id, on the caster's turn:
`fight.declare('ember-bloom', { targetId: 'wight' })`. The caster must know it —
`profileFromCharacter` carries the character's known spells (its classes' spell
lists plus any spell a class feature unlocks), slot bindings and pool points.
The gates run in a fixed order, and each refusal is one `declare:rejected` with
nothing spent: the spell is known (`no-action`) → no
active condition restricts it (`restricted`; dark-fantasy's `hexbound` restricts
`spells.tagged:casting`) → the target resolves and the spell's `valid` clause
passes → range (`out-of-range`, `E-SPAT-01`) → equipped armor the caster's classes
cannot cast in blocks a slot (vancian) spell (`armor-not-castable`) → the cost
(turn slots, pool points) → a vancian spell needs an uncast slot bound to it
(`E-VANC-01`). Out of combat, `isRestricted(rt, state, 'spell', id)` and
`restrictedIds` apply the same rule as a combat declare: a spell is blocked by
`actions.tagged:` or `spells.tagged:` (an action only by `actions.tagged:`).

- **Targeting.** A spell may target any combatant, ally or enemy, within its
  `targeting.range` (default: the caster's reach). A burst may be centered on an
  empty cell instead: `fight.declare('ember-bloom', { at: { x: 4, y: 1 } })`.
- **Healing spells.** zombie-urban `bind-the-bite` and the `warden`'s
  `bind-wound` in dark-fantasy and wyldwood heal: `heal(1d8 + ability(vigor))`,
  read from the caster's vigor ability, never above the target's `maxHp`. Name
  the ally (`{ targetId }`); a spell declared with no target picks the only
  opponent.
- **Cost.** In the sample themes a spell costs the whole turn (`main` + `move`);
  the reaction slot stays free.
- **Snapshot spend.** The fight never writes to the character. A combat snapshot
  carries each caster's `poolsSpent` and `slotsCast`, and restore continues the
  spend against the re-stated fight-start balances.
- **Settlement.** Once the fight is `combat-over`,
  `settleSpellCasts(rt, character, fight, combatantId)` drops the spent pool
  points (`pool:settled`) and empties the cast slots (`slot:settled`) on the
  character; a second call returns `[]`.
- **Feats.** `character.learnFeat(featId)` (or `learnFeat(rt, state, featId)`)
  adds a pack-declared feat (`feat:learned`; `unknown-feat` and `feat-known`
  refuse, and `feat-known` also refuses a feat a class feature grants). The
  character snapshot keeps the learned `feats`.
- **Feat slots.** A pack's progression may declare `featSlots` per class per
  level; a character's slots add across its classes, and `learnFeat`,
  `levelSet`, `awardXp` and snapshot restore refuse a character holding more
  feats than its slots (`feat-slots-exceeded`). The sample themes grant 1 feat
  at level 1, 2 at level 3, 3 at level 6 and 4 at level 9. An XP award never
  lowers a level: a character set directly to level 3 keeps level 3 until its
  XP reaches level 4.
- **Reactive feats.** A held or granted feat with a `trigger` is offered like a reaction
  (`trigger:fired` with `source: 'feat'`) and answered with `fight.respond`. It
  is free (no slot), acts on its holder, and never chains: taking it raises no
  new offer. A combat snapshot keeps every open offer (`offers`), the offer
  counter (`offeredCount`) and the live `phase`.
- **The trigger grammar.** `trigger.on` is `<event>` or
  `<event>[target|actor=self|<id>]`, for example
  `condition:applied[target=self]`. A pattern that can never fire is refused at
  load (`E-FORM-01`).

From the generated dark-fantasy pack (seed 42): a hexer holding `second-gust` is
gazed at by an adjacent barrow-wight, the fight is frozen and restored, and the
hexer takes the feat:

```text
fight.declare('grave-gaze', { targetId: 'hexer' })            // the wight's turn
  condition:applied  wight → hexer {conditionId: 'hexbound'}   actions.grave-gaze
  action:resolved    {actionId: 'grave-gaze', targetId: 'hexer'}
  trigger:fired      hexer {triggerId: 'hexer.second-gust', actionId: 'second-gust',
                     source: 'feat', on: 'condition:applied', offerIndex: 0}
                     content.feats.second-gust.trigger
serialize → JSON → restore    phase 'resolved' · offeredCount 1 · offers [second-gust]
restored.respond('hexer.second-gust', 'take')
  condition:applied  hexer → hexer {conditionId: 'braced', duration: 2}
                     content.feats.second-gust
  // no second trigger:fired (a taken feat never chains)
step() · step()                turn:ended wight · turn:began hexer
restored.declare('ember-bloom', { targetId: 'wight' })
  declare:rejected   {kind: 'restricted', resource: 'casting'}   // hexbound; nothing spent
```

The feat-slot cap is pack data: a pack that declares no `featSlots` leaves
feats uncapped (a character may learn any number of them). Once any class
declares `featSlots`, a class that declares none grants 0 — including a class
only statblocks use, since the pack has no player/monster class distinction.
Slot every class a character may take.

The spells journey — vancian and point-pool legs, plus the feat leg above — runs
in `tests/proofs/spells-journey.test.ts` against the built package and the real
generated packs (seed 42).

## Class features

A pack's progression may declare class features: `progression.<id>.features`, a
list of `{ level, ref }`. The `ref` names exactly one pack artifact, and the map
that declares it decides what the feature does while the character's level in
that class is at least `level`:

- a feat in `content.feats` is **granted**: the character holds it;
- an action in `actions` is **unlocked**: the character may declare it in combat;
- a spell in `content.spells` is **unlocked**: the character knows it.

The generated dark-fantasy pack's crypt-warden (its other progression fields
left out):

```json
"progression": {
  "crypt-warden": {
    "features": [
      { "level": 2, "ref": "barrow-rite" },
      { "level": 3, "ref": "crypt-vigil" }
    ]
  }
}
```

The pack is refused at load, with every card at once, when a `ref` names nothing
(`E-REF-01`, with a did-you-mean hint), when an unlock is one the class already
has — an action in its `actions`, a spell its `spellLists` already know
(`E-REF-01`) — when a `ref` repeats within one class or a `level` lies outside
1..the class's level ceiling (`E-SCHEMA-01`). `content.classes.<id>.features` is
not a field (`E-SCHEMA-02`).

- **Granted is not learned.** A granted feat is worked out from the character's
  classes. It is never written to the character's `feats`, never stored in a
  snapshot, and uses no feat slot; `learnFeat` refuses it (`feat-known`). A feat
  learned before a class feature grants it stays learned and keeps its slot.
  Lowering a class level with `levelSet` drops the grant; no event besides
  `level:reached` is emitted.
- **Unlocks ride the normal pipeline.** `profileFromCharacter` appends unlocked
  actions after the class `actions` and granted reactive feats after the learned
  ones; `knownSpells` — and so `prepareSpell` and the combat declare — includes
  unlocked spells, in pack order. Restrictions, range, costs, `armorCasting` and
  slot or pool spend apply unchanged. Below the level, the declare is refused
  `no-action` with nothing spent.
- **Characters only.** A statblock keeps its own `actions` list, even when it
  borrows a class's `attackTable`.
- **The host query.** `classFeatures(rt, character.state)` lists every feature
  of the character's classes as `{ classId, level, ref, kind, active }` — class
  order, then feature order, inactive (future) features included.

The sample themes ship features on every class. In dark-fantasy a crypt-warden
unlocks the action `barrow-rite` at level 2 and is granted the reactive feat
`crypt-vigil` at level 3: when a condition lands on it, it may take `braced`. In
zombie-urban a medic unlocks the fixer-list spell `rot-read` at level 3. The
journey runs in `tests/proofs/class-features-journey.test.ts` from source,
against the generated packs (seed 42).

## Equipment & consumables

Equipment is pack data too. A pack declares its own slot vocabulary
(`equipSlots`), and each item says which slots it may occupy, what it grants
while equipped, and — for a consumable — what using it does. From the generated
zombie-urban pack (seed 42):

```json
{
  "equipSlots": ["body", "main-hand"],
  "formulas": { "ac": "11 - floor(level / 3) - gear-ac" },
  "content": {
    "items": {
      "riot-plate": { "kind": "armor", "slots": ["body"], "grants": { "ac": 1, "armor": 1 } },
      "fire-axe": { "kind": "weapon", "slots": ["main-hand"], "grants": { "might": 1 } },
      "med-kit": { "kind": "consumable", "use": "heal(2 + ability(vigor))" }
    }
  }
}
```

- **Equip / unequip.** `character.equip(itemId, slot)` places one held unit in one
  declared slot; `character.unequip(slot)` frees it. One item per slot, and a
  refusal is named (`not-equippable`, `unknown-slot`, `slot-not-allowed`,
  `slot-occupied`, `item-not-held`). An equipped unit cannot be dropped
  (`item-equipped`).
- **Grants.** Ability and save grants add to the base stat while equipped. The
  reserved keys `hp` / `ac` / `initiative` / `armor` never touch a stat directly:
  they are summed over equipped items and exposed to the pack's `formulas` as
  `gear-hp` / `gear-ac` / `gear-initiative` / `gear-armor` (0 when nothing is
  equipped). The formula decides the direction — all three bundled themes use
  descending AC, so riot-plate moves ac 11 → 10. Equipping never heals and
  unequipping never clamps.
- **armorCasting.** An item is armor when it grants `armor`. A slot (vancian)
  cast while wearing armor needs a class whose `armorCasting` lists the armor's
  `kind`; otherwise it is refused `armor-not-castable` with the slot still bound.
  In dark-fantasy the warden (`["mail"]`) casts in warded-mail and the hexer
  (`["leather"]`) must unequip first. armorCasting covers slot casting only:
  point-pool spells are cast in combat and are never armor-gated.
- **Consumables.** `character.useItem(itemId)` (or `useItem(rt, state, itemId)`)
  spends one unit out of combat; `fight.use(itemId, { target })` spends one charge
  in combat (the active combatant, default target itself). Charges are the held
  quantity at `profileFromCharacter`; `no-charges` refuses the next one. After
  `combat-over`, `fight.use` throws like `declare`. A heal never raises hp above
  the cap (`derived().hp`, or the combatant's `maxHp` in a fight) and never
  lowers hp already above it. `item:used` precedes the effect's
  `damage:applied`, whose negative `amount` and `before→after` show the heal.
  An effect reads a bare name like `vigor` as the save when a save shares the
  ability's name; `ability(name)` (legal only in effects and item `use`) reads
  the user's ability instead, equipment grants included.
- **Settlement.** The fight never writes to the character. Once the fight is
  `combat-over`, `settleItemUses(rt, character, fight)` drops the units spent in
  it from the inventory (`item:dropped` + `item:settled`); a second call returns
  `[]`.
- **Snapshots.** A character snapshot carries `equipped` (restore refuses an
  unknown item, slot, or ineligible entry with E-SNAP-01 and applies nothing); a
  combat snapshot carries each combatant's `maxHp` and `itemsUsed` (units spent),
  and the host re-states fight-start balances on restore.

Expected output of the journey (zombie-urban, seed 42, a level-1 mile-born
scavenger holding riot-plate, fire-axe and 3 med-kits). At level 1 `med-kit`
heals 12: `ability(vigor)` reads the vigor ability, 10, not the same-named save
(0 at level 1).

```
base                     hp 27 · ac 11 · might 10
riot-plate + fire-axe    ac 10 · might 11 · maxHp 27
useItem('med-kit')       item:used { remaining: 2 } → damage:applied { amount: -12, hp: '23→27' }
                         why.rolls ['d0[]-12=-12'] · why.rule 'content.items.med-kit'
fight.use('med-kit')     damage:applied { amount: -12, hp: '26→27' }   (clamped at maxHp 27)
snapshot → restore       itemsUsed { 'med-kit': 1 } · maxHp 27
second use / third use   hp '27→27' / declare:rejected { kind: 'no-charges' }
settleItemUses           item:dropped + item:settled { qty: 2 } → med-kit gone (3 − 1 − 2)
```

v1 limits:

- **Settle each fight once.** Settlement is idempotent per live fight object
  only: a combat snapshot taken before settlement still carries the spend, so
  restoring it and settling again drops the same units twice.
- **An abandoned fight does not settle.** `settleItemUses` requires
  `combat-over`; for a fight abandoned earlier, the host drops the units itself.

The whole journey — generate → equip → heal → `fight.use` → mid-fight snapshot →
`no-charges` → settlement → character snapshot and tamper refusal, plus the
dark-fantasy armorCasting leg — runs in `tests/proofs/equipment-journey.test.ts`
against the built package and the real generated packs (seed 42); the values
above are the ones it asserts (NFR-DX).

## Development

```sh
pnpm install
pnpm typecheck        # tsc --noEmit over src/ + tests/
pnpm lint             # ESLint, including the engine hygiene rules (no Math.random/eval/Date.now under src/)
pnpm format           # Prettier --write over the whole repo (.prettierrc)
pnpm format:check     # Prettier --check; CI enforces it
pnpm test             # Vitest (node environment)
pnpm test --coverage  # Vitest + v8 coverage (summary at the end of the run)
pnpm test:browser     # determinism oracle + pure suites in Chromium, Firefox, WebKit (first run: pnpm exec playwright install chromium firefox webkit)
pnpm test:electron    # the whole suite under Electron's runtime (run pnpm build first)
pnpm build            # tsup — dual ESM/CJS + dts, per-entry
pnpm check:isolation  # the runtime-only bundle contains no compiler strings (FR-22)
pnpm check:security   # no eval/new Function/Math.random/Date.now in src/ + dist/
pnpm verify:package   # build + both checks
```

Engine determinism contract: all randomness flows through the seeded, injectable RNG
(`core/rng`) whose state serializes as four uint32 words — snapshots carry it so a
resumed fight rolls the same future as an uninterrupted one.

CI (`.github/workflows/ci.yml`) runs the Node matrix (18/20/22 — the whole suite,
so same-seed ⇒ identical rolls is proven on all three lines), the FR-12 proof trio
(rules-are-data: zero engine diffs), the FR-21 coverage floor for all three sample
themes, the bundle-isolation + security-sweep gates, and the lint + Prettier format checks on every push (lint runs on Node 22 — ESLint 10's floor is above the Node 18 matrix leg).
`tests/proofs/contract-conformance.test.ts` checks the three bundled themes' generated packs
(seed 42), the seven fixture packs, the snapshot envelopes from the determinism oracle's nine
combat legs plus a level-1 character and party per theme, and two override documents against
the JSON Schema contracts in `src/schema/contracts/` (repository files, not shipped in the npm
package), with an independent validator (Ajv, a dev dependency only); it runs in the Node matrix
and in the package job.

Two more jobs carry the cross-runtime determinism proof. The `browser` job runs the
shared oracle (`tests/proofs/determinism-oracle.ts`: Node-pinned digests of nine combat
legs and three generated packs) plus the pure core/schema/theme suites in Chromium,
Firefox and WebKit (`vitest.browser.config.ts`); it runs `src/` transformed by Vite,
not the shipped `dist/` bundle, which the Node and Electron legs exercise through the
`dist/` journeys. The `electron` job runs the whole suite under Electron's own Node/V8
runtime (`pnpm test:electron`); Electron's renderer engine is Chromium, covered by the
Chromium leg, and no test runs inside an Electron renderer process. `docs-run` checks
that the README names `pnpm test:browser`, `pnpm test:electron` and the conformance test file,
that `ci.yml` runs the browser matrix, the Electron job, `pnpm test` and `tests/proofs/` as `run`
steps, that the conformance test file exists, and that the retired browser follow-up wording is
gone; it does not check the rest of this prose.
