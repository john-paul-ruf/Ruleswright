# Ruleswright

Headless TypeScript library: a one-line theme becomes a complete, playable d20-style
campaign pack — consumed by an embeddable party / character / combat runtime.

**Rules are data.** The engine implements mechanics generically; packs declare specifics.
No magic subsystem, no hardcoded action slots, no second table engine — packs declare
specifics, the engine interprets them.

- Zero runtime dependencies. Engine performs no I/O — hosts own storage, pacing, and UI.
- Deterministic to the byte: same theme + seed + knobs ⇒ byte-identical packs; same seed +
  same call sequence ⇒ identical rolls on Node, browsers, and Electron.
- Three surfaces: `ruleswright/runtime` (dice, characters, combat, snapshots, events),
  `ruleswright/schema` (the pack format, validator, version contract), and
  `ruleswright/compiler` (theme → pack generation, knobs, stage pipeline).

## Quickstart

Every line below is copy-paste runnable and every step shows its expected output
(NFR-DX; executed by `tests/proofs/docs-run.test.ts`).

### 01 — Generate a campaign

```ts
import { generateCampaign } from "ruleswright/compiler";
import { loadTheme } from "ruleswright/compiler";

// Theme + seed + knobs → complete pack. Fully offline.
const pack = generateCampaign({
  theme: loadTheme("dark-fantasy"),
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
import { Runtime } from "ruleswright/runtime";

const rt = new Runtime(pack);

const brynn = rt.createCharacter({
  name: "Brynn",
  race: "hillfolk",
  classes: [{ id: "warden", level: 1 }],
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
import { startCombat, spawnMonster, profileFromCharacter } from "ruleswright/runtime";

const events = [];
rt.events.on((event) => events.push(event));

// Brynn herself fights: her profile + pool/slot balances, actions from her class.
const fight = startCombat(rt, {
  allies: [{ id: "brynn", ...profileFromCharacter(rt, brynn) }],
  enemies: [{ id: "wight", profile: spawnMonster(rt, "barrow-wight", "wight") }],
});

while (!fight.roundComplete) {
  if (fight.state.phase === "awaiting-declare") {
    const active = fight.state.combatants[fight.state.active]!;
    fight.declare(active.actions[0]!);
  }
  fight.step(); // begin → declare → resolve → end
}

const attack = rt.events.sinceRound(1).find((event) => event.type === "attack:rolled");
console.log(attack.why.rolls[0], attack.why.rule);
```

Expected output (seed 42 — the wight wins initiative and its first attack misses
Brynn's own pack-derived ac 12; the damage event still carries its provenance):

```
d20[9]=9 < ac12 actions.cut-down.attackBonus
```

- `profileFromCharacter(rt, character, id?)` returns `{ profile, balances }`: current
  hp, `derived()` ac/attack bonus, the pack's `initiative` formula, the union of the
  character's class `actions` (pack v1.2), and its pool points + bound spell slots.
  A class with no `actions` cannot fight (`no-combat-actions`).
- The fight ends by one engine rule (`combat.sideDefeated`): after any resolution, once every
  combatant on one side is at hp ≤ 0, `fight.state.phase` becomes `combat-over`, one `combat:ended`
  event names `{ winner, defeated }`, and `step()` returns `{ kind: "combat-over" }` from then on.
  Downed combatants (hp ≤ 0) skip their turns and are offered no triggers. A combat snapshot
  taken at the end restores as `combat-over`.
- v1 limits: active conditions are not carried into the fight; a multiclass character
  on the attack-table convention uses the row of its highest-level table class, at
  that class's level, re-keyed to the character's total level.

- The engine performed **no I/O** anywhere above — `serialize()` hands you JSON;
  your app owns storage (FR-14).
- Same theme + seed + knobs ⇒ byte-identical pack; same seed + same call sequence
  ⇒ identical rolls on Node, browsers, Electron (FR-1, FR-17; the cross-runtime
  browser matrix runs in CI).

## Development

```sh
pnpm install
pnpm typecheck        # tsc --noEmit over src/ + tests/
pnpm lint             # ESLint, including the engine hygiene rules (no Math.random/eval/Date.now under src/)
pnpm test             # Vitest (node environment)
pnpm build            # tsup — dual ESM/CJS + dts, per-entry
pnpm check:isolation  # the runtime-only bundle contains no compiler strings (FR-22)
pnpm check:security   # no eval/new Function/Math.random/Date.now in src/ + dist/
pnpm verify:package   # build + both checks
```

Engine determinism contract: all randomness flows through the seeded, injectable RNG
(`core/rng`) whose state serializes as four uint32 words — snapshots carry it so a
resumed fight rolls the same future as an uninterrupted one.

CI (`.github/workflows/ci.yml`) runs the matrix (Node 18/20/22), the FR-12
proof trio (rules-are-data: zero engine diffs), the FR-21 coverage floor for both
sample themes, and the bundle-isolation + security-sweep gates on every push.