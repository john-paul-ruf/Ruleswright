/**
 * FR-12 — rules-are-data (CA with the builder): three proof tests. Each proof
 * derives a mutated pack from a fixture template (DATA, not engine), drives the
 * PUBLIC runtime surface only, and asserts behavior changed against the same
 * fixture unmutated. The engine is never touched — every proof names the engine
 * files it does NOT modify, and no test writes to `src/` (FR-12's zero-diff
 * discipline: the trio IS the proof that the delta is data, not code).
 *
 * declare() discipline (verified against combat.ts): an invalid declare returns
 * a typed rejection event (declare:rejected), it does not throw; prepareSpell
 * on an unknown spell THROWS (RuntimeRuleError). The proofs assert each path
 * the way its machinery actually behaves.
 */
import { describe, expect, it } from 'vitest';
import { Rng } from '../../src/core/rng';
import { validatePack } from '../../src/schema/validate';
import { packDslChecker } from '../../src/core/dsl/checker';
import { Runtime } from '../../src/runtime/runtime';
import { knownSpells, prepareSpell, castSpell } from '../../src/runtime/pools';
import { profileFromStatblock, type CombatantProfile } from '../../src/runtime/combat/resolve';
import { profileFromCharacter } from '../../src/runtime/character-profile';
import { startCombat, type Combat, type StepOutcome } from '../../src/runtime/combat/combat';
import type { RuntimeEvent } from '../../src/runtime/events';
import type { Pack } from '../../src/schema/pack';
import { emberMarchesPack } from '../runtime/fixtures/packs';

/** The engine files the trio does not modify — the diff-discipline comment in test form. */
const ENGINE_FILES_UNMODIFIED = [
  'src/runtime/runtime.ts',
  'src/runtime/character.ts',
  'src/runtime/progression.ts',
  'src/runtime/pools.ts',
  'src/runtime/conditions.ts',
  'src/runtime/events.ts',
  'src/runtime/combat/combat.ts',
  'src/runtime/combat/resolve.ts',
  'src/runtime/combat/action-economy.ts',
  'src/runtime/combat/triggers.ts',
  'src/runtime/combat/spatial.ts',
  'src/runtime/bestiary.ts',
  'src/runtime/encounter.ts',
  'src/runtime/snapshots.ts',
  'src/compiler/**',
  'src/core/**',
  'src/schema/**',
];

function fixturePack(): Pack {
  return structuredClone(emberMarchesPack());
}

function runFight(
  pack: Pack,
  seed: string,
  allyActions: string[],
): { fight: Combat; events: RuntimeEvent[] } {
  const runtime = new Runtime(pack);
  const seen: RuntimeEvent[] = [];
  runtime.events.on((event) => seen.push(event));
  const brynn: CombatantProfile = {
    ...profileFromStatblock(runtime.pack, runtime.pack.bestiary['barrow-wight']!, 'brynn'),
    actions: allyActions,
  };
  const wight: CombatantProfile = {
    ...profileFromStatblock(runtime.pack, runtime.pack.bestiary['barrow-wight']!, 'wight'),
    actions: ['wight-claw'],
  };
  const fight = startCombat(runtime, {
    allies: [{ id: 'brynn', profile: brynn }],
    enemies: [{ id: 'wight', profile: wight }],
    rng: new Rng(seed),
  });
  return { fight, events: seen };
}

/** Step until `id` may declare, skipping other turns with their first action. */
function stepToDeclare(fight: Combat, id: string, skipWith = 'withdraw'): void {
  for (let guard = 0; guard < 20; guard += 1) {
    if (fight.state.phase === 'awaiting-declare' && fight.state.active === id) return;
    if (fight.state.phase === 'awaiting-declare') {
      fight.declare(skipWith);
    }
    const outcome: StepOutcome = fight.step();
    if (outcome.kind === 'combat-over') throw new Error('combat ended before the awaited turn');
  }
  throw new Error(
    `never reached ${id}'s declare phase (phase=${fight.state.phase}, active=${fight.state.active})`,
  );
}

describe('FR-12 trio — rules are data (zero engine diffs)', () => {
  it('proof 1: a new action + a new condition change combat behavior — pack data only', () => {
    // DATA delta: a new condition that blocks main-slot actions, and an action carrying it.
    const pack = fixturePack();
    (pack.content.conditions ??= {})['frostbitten'] = {
      name: 'Frostbitten',
      duration: 2,
      stacking: 'refresh',
      restricts: ['actions.tagged:main'],
    };
    pack.actions['crushing-blow'] = {
      cost: { slots: { main: 1 } },
      effect: 'sequence(attack(ac, might), damage(2d6, bludgeon), applyCondition(frostbitten, 2))',
      tags: ['main'],
    };
    // The mutated pack validates through the same public validator (FR-2).
    expect(validatePack(structuredClone(pack), packDslChecker)).toEqual([]);

    // Baseline counterfactual (unmutated pack): the new action is not pack data —
    // declare() emits a typed rejection (E-REF-01 no-action), it does not throw.
    const base = runFight(fixturePack(), 'proof1', ['strike']);
    stepToDeclare(base.fight, 'brynn');
    base.fight.step();
    const baseEvents = base.fight.declare('crushing-blow');
    expect(baseEvents.some((event) => event.type === 'declare:rejected')).toBe(true);

    // With the pack mutation (no engine change): the new action declares,
    // resolves, and its new condition lands through the same pipeline.
    const withNew = runFight(pack, 'proof1', ['crushing-blow']);
    stepToDeclare(withNew.fight, 'brynn');
    withNew.fight.step();
    withNew.fight.declare('crushing-blow', { targetId: 'wight' });
    expect(withNew.events.some((event) => event.type === 'damage:applied')).toBe(true);
    // The new condition's provenance names the ACTION that carries it (the
    // combat emitter's rule base is `actions.<actionId>` — pack data naming).
    const applied = withNew.events.filter((event) => event.type === 'condition:applied');
    expect(applied.length).toBeGreaterThanOrEqual(1);
    expect(applied.some((event) => event.why.rule.startsWith('actions.crushing-blow'))).toBe(true);
    // The restricts machinery (unchanged engine, new condition data) now blocks
    // a main-tagged declare while frostbitten is active:
    const blocked = withNew.fight.declare('strike', { targetId: 'brynn' });
    expect(blocked.some((event) => event.type === 'declare:rejected')).toBe(true);
    void ENGINE_FILES_UNMODIFIED;
  });

  it('proof 2: a triggered/reactive action executes via event hooks — pack-declared parry', () => {
    // The fixture already declares `parry` with trigger.on 'attack:rolled[target=self]'
    // (pack data). Engine is untouched; the event substrate offers + resolves it.
    const { fight, events } = runFight(fixturePack(), 'proof2', ['parry']);
    stepToDeclare(fight, 'wight');
    fight.step();
    fight.declare('wight-claw', { targetId: 'brynn' });
    const offer = fight.pendingTriggers.find((pending) => pending.actionId === 'parry');
    expect(offer).toBeDefined();
    expect(offer!.actorId).toBe('brynn');
    expect(offer!.matchingEvent).toBe('attack:rolled');
    const fired = events.find((event) => event.type === 'trigger:fired');
    expect(fired).toBeDefined();
    expect(fired!.actor).toBe('brynn');
    expect(fired!.why.rule).toBe('actions.parry.trigger');
    // The host takes it — the reactive action rides the same resolution pipeline.
    fight.respond(offer!.triggerId, 'take');
    const parryDamage = events.filter((event) => event.type === 'damage:applied' && event.actor === 'brynn');
    expect(parryDamage.length).toBeGreaterThanOrEqual(1);
    expect(parryDamage[parryDamage.length - 1]!.why.rule).toBe('actions.parry');
    // The reaction consumed a declared slot (FR-12 proof 2: reaction economy).
    expect(fight.state.combatants['brynn']!.slots.remaining['reaction']).toBe(0);
    void eventMatchesProbe;
  });

  it('proof 2 (feat leg): a reactive feat held by a character fires via the same event hooks — pack data only', () => {
    // DATA delta: combat actions for the fixture warden class (a v1.2 class
    // field; profileFromCharacter needs one). The fixture already declares
    // `second-gust` (condition:applied[target=self] → applyCondition(braced, 2))
    // and `grave-gaze` (hexbound on either save branch). A statblock holds no
    // feats (DD-S2), so the holder is a character.
    const pack = fixturePack();
    pack.content.classes!['warden']!.actions = ['strike'];
    expect(validatePack(structuredClone(pack), packDslChecker)).toEqual([]);

    const gazeAtBrynn = (learnsFeat: boolean): { fight: Combat; events: RuntimeEvent[] } => {
      const runtime = new Runtime(pack);
      const events: RuntimeEvent[] = [];
      runtime.events.on((event) => events.push(event));
      const character = runtime.createCharacter({
        name: 'Brynn',
        race: 'ashling',
        classes: [{ id: 'warden', level: 1 }],
      });
      if (learnsFeat) character.learnFeat('second-gust');
      const brynn = profileFromCharacter(runtime, character, 'brynn');
      const fight = startCombat(runtime, {
        allies: [
          { id: 'brynn', profile: { ...brynn.profile, initiativeBonus: -100 }, balances: brynn.balances },
        ],
        enemies: [
          {
            id: 'wight',
            profile: {
              ...profileFromStatblock(runtime.pack, runtime.pack.bestiary['barrow-wight']!, 'wight'),
              actions: ['grave-gaze'],
              initiativeBonus: 100,
            },
          },
        ],
      });
      fight.step();
      expect(fight.state.active).toBe('wight');
      fight.declare('grave-gaze', { targetId: 'brynn' });
      return { fight, events };
    };

    // The held feat is offered through the unchanged trigger substrate, after the hexbound it reacts to.
    const { fight, events } = gazeAtBrynn(true);
    const hexbound = events.findIndex(
      (event) =>
        event.type === 'condition:applied' &&
        event.target === 'brynn' &&
        event.payload['conditionId'] === 'hexbound',
    );
    const fired = events.filter((event) => event.type === 'trigger:fired');
    expect(hexbound).toBeGreaterThanOrEqual(0);
    expect(fired).toHaveLength(1);
    expect(events.indexOf(fired[0]!)).toBeGreaterThan(hexbound);
    expect(fired[0]!.payload).toMatchObject({ source: 'feat', actionId: 'second-gust' });
    // Taking it applies braced on the holder under the feat's own rule, and never chains.
    const taken = fight.respond('brynn.second-gust', 'take');
    expect(
      taken.map((event) => [event.type, event.target, event.payload['conditionId'], event.why.rule]),
    ).toEqual([['condition:applied', 'brynn', 'braced', 'content.feats.second-gust']]);
    expect(events.filter((event) => event.type === 'trigger:fired')).toHaveLength(1);

    // Baseline: the same pack and fight, with a character that never learned the feat — no offer.
    const baseline = gazeAtBrynn(false);
    expect(baseline.events.some((event) => event.type === 'condition:applied')).toBe(true);
    expect(baseline.events.filter((event) => event.type === 'trigger:fired')).toEqual([]);
    expect(baseline.fight.pendingTriggers).toEqual([]);
  });

  it('proof 3: a new spell is memorized → bound → cast, out of combat and in a fight — pack data only', () => {
    // DATA delta: one new spell on the hexer list, and combat actions for the
    // fixture hexer class (a v1.2 class field; `strike` is a fixture action) so
    // the character can stand in a fight at all (profileFromCharacter needs one).
    const pack = fixturePack();
    pack.content.classes!['hexer']!.actions = ['strike'];
    (pack.content.spells ??= {})['wither-light'] = {
      name: 'Wither Light',
      magic: { level: 1, lists: ['hexer'] },
      cost: { vancian: 1 },
      effect: 'sequence(damage(1d6, grave-touch), applyCondition(shaken, 1))',
      tags: ['casting'],
    };
    expect(validatePack(structuredClone(pack), packDslChecker)).toEqual([]);

    const runtime = new Runtime(pack);
    const hexer = runtime.createCharacter({
      name: 'Vex',
      race: 'ashling',
      classes: [{ id: 'hexer', level: 1 }],
    });
    const state = hexer.state;
    // The new spell is KNOWN purely from pack data (the unchanged gating machinery).
    expect(knownSpells(runtime, state)).toContain('wither-light');
    // memorize → bind → cast through the unchanged pool machinery.
    prepareSpell(runtime, state, 'wither-light');
    expect(state.slots['1']).toEqual(['wither-light', null]);
    const before = structuredClone(state);
    castSpell(runtime, state, 'wither-light');
    expect(state.slots['1']).toEqual([null, null]);
    expect(JSON.stringify(state) !== JSON.stringify(before)).toBe(true);
    // Baseline counterfactual: the unmutated fixture has no wither-light —
    // prepareSpell throws (RuntimeRuleError unknown-spell), the durable state
    // is untouched.
    const baseRuntime = new Runtime(fixturePack());
    const baseChar = baseRuntime.createCharacter({
      name: 'Plain',
      race: 'ashling',
      classes: [{ id: 'hexer', level: 1 }],
    });
    expect(knownSpells(baseRuntime, baseChar.state)).not.toContain('wither-light');
    expect(() => prepareSpell(baseRuntime, baseChar.state, 'wither-light')).toThrow();

    // Combat leg (v1.6, FR-9): the same new spell is declared in a fight
    // through the unchanged pipeline. The out-of-combat cast emptied the slot,
    // so bind it again; the caster leads (+100, the grid-journey idiom).
    prepareSpell(runtime, state, 'wither-light');
    const castIn = (rt: Runtime, character: typeof hexer) => {
      const pair = profileFromCharacter(rt, character, 'hexer');
      const fight = startCombat(rt, {
        allies: [
          { id: 'hexer', profile: { ...pair.profile, initiativeBonus: 100 }, balances: pair.balances },
        ],
        enemies: [
          {
            id: 'wight',
            profile: {
              ...profileFromStatblock(rt.pack, rt.pack.bestiary['barrow-wight']!, 'wight'),
              actions: ['wight-claw'],
            },
          },
        ],
        rng: new Rng('proof3'),
      });
      expect(fight.state.active).toBe('hexer');
      return fight.declare('wither-light', { targetId: 'wight' });
    };
    const cast = castIn(runtime, hexer).find((event) => event.type === 'spell:cast');
    expect(cast).toBeDefined();
    expect(cast!.why.rule).toBe('content.spells.wither-light');
    // Baseline: the class-actions line alone (no wither-light) — the id is no pack data, no-action.
    const actionsOnly = fixturePack();
    actionsOnly.content.classes!['hexer']!.actions = ['strike'];
    const plainRuntime = new Runtime(actionsOnly);
    const plain = plainRuntime.createCharacter({
      name: 'Plain',
      race: 'ashling',
      classes: [{ id: 'hexer', level: 1 }],
    });
    const refused = castIn(plainRuntime, plain).filter((event) => event.type === 'declare:rejected');
    expect(refused.map((event) => event.payload['kind'])).toEqual(['no-action']);
  });
});

function eventMatchesProbe(): void {}
