/**
 * CAP-E7 — the equipment & consumables journey through the BUILT package
 * (equipment-consumables' first narrow journey, DD-EG9). Every import is a
 * direct dist path — the artifact a consumer installs — never src/ (the
 * loot-journey form; run `pnpm build` first — test 1 fails on a stale dist).
 *
 * No mocked boundary: the generated packs (seed 42) supply the content, and
 * every step runs through `Runtime`, the character verbs, `Combat`, the
 * settlement verb and the real serializers.
 *
 * zombie-urban leg (sequential — each step builds on the last, as a host's
 * session would): equip → exact ac / might shift → out-of-combat heal (clamp)
 * → `fight.use` (clamp, provenance) → mid-fight snapshot, restored with the
 * character on a fresh runtime → `no-charges` → combat-over → settlement back
 * to the inventory → character snapshot + tamper refusal. med-kit is
 * `heal(2 + vigor)`, and in effect scope the vigor SAVE (0 at level 1) shadows
 * the ability, so it heals 2 (S05's recorded value; kept by Orchestrator).
 *
 * dark-fantasy leg: armorCasting on slot casting — the only theme with slot
 * (vancian) casting (DD-EG5). Resumed legs read a fresh event sink (DD17e).
 */
import { describe, expect, it } from 'vitest';
import { generateCampaign, loadTheme } from '../../dist/compiler.js';
import * as runtimeDist from '../../dist/runtime.js';
import {
  Runtime,
  RuntimeRuleError,
  castSpell,
  deserializeCombat,
  knownSpells,
  profileFromCharacter,
  restoreCharacter,
  serializeCharacter,
  serializeCombat,
  settleItemUses,
  spawnMonster,
  startCombat,
} from '../../dist/runtime.js';
import type { Character, Combat, CombatRestoreRequest, RuntimeEvent } from '../../dist/runtime.js';
import type { Pack } from '../../dist/schema.js';

const SEED = 42;

function packFor(themeId: string): Pack {
  return generateCampaign({ theme: loadTheme(themeId), seed: SEED });
}

/** A fresh sink on one runtime for one leg (declare/use return windows, not the whole trail). */
function capture(rt: Runtime): { events: RuntimeEvent[]; release: () => void } {
  const events: RuntimeEvent[] = [];
  const sink = (event: RuntimeEvent) => events.push(event);
  rt.events.on(sink);
  return { events, release: () => rt.events.off(sink) };
}

/** The refusal cards of a RuntimeRuleError, or a failure when nothing threw. */
function refusal(run: () => unknown): { rule: string; artifactId: string; jsonPath: string }[] {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(RuntimeRuleError);
    return (error as RuntimeRuleError).errors.map(({ rule, artifactId, jsonPath }) => ({
      rule,
      artifactId,
      jsonPath,
    }));
  }
  throw new Error('expected a RuntimeRuleError');
}

/** Drive the fight to combat-over: every turn declares the first accepted action, every offer is declined. */
function fightToTheEnd(fight: Combat): void {
  for (let steps = 0; fight.state.phase !== 'combat-over' && steps < 500; steps += 1) {
    for (const offer of [...fight.pendingTriggers]) fight.respond(offer.triggerId, 'decline');
    if (fight.step().kind !== 'turn-started') continue;
    const active = fight.state.combatants[fight.state.active]!;
    for (const actionId of active.actions) {
      fight.declare(actionId);
      if (fight.state.phase !== 'awaiting-declare') break;
    }
  }
}

describe('CAP-E7 — dist freshness (F-E13)', () => {
  it('the built runtime exports the feature verbs, and the built compiler passes equipSlots through', () => {
    expect(typeof runtimeDist.equipItem).toBe('function');
    expect(typeof runtimeDist.useItem).toBe('function');
    expect(typeof runtimeDist.settleItemUses).toBe('function');
    expect(packFor('zombie-urban').equipSlots).toEqual(['body', 'main-hand']);
  });
});

describe('CAP-E7 — the zombie-urban journey (seed 42): equip → heal → fight.use → snapshot → settle', () => {
  const pack = packFor('zombie-urban');
  let rt: Runtime;
  let survivor: Character;
  let cap: number;
  let baseAc: number;
  let baseMight: number;
  let fight: Combat;
  let restoreRequest: CombatRestoreRequest;
  let resumedRt: Runtime;
  let resumedSurvivor: Character;
  let resumed: Combat;
  let allyId: string;

  it('1 — new Runtime(pack) loads the generated pack', () => {
    expect(() => {
      rt = new Runtime(pack);
    }).not.toThrow();
    expect(rt.pack.manifest.id).toBe('zombie-urban');
  });

  it('2–3 — equip moves ac / might by exactly the grant; unequip restores the base (CA-EG1/EG2)', () => {
    survivor = rt.createCharacter({
      name: 'Rook',
      race: 'mile-born',
      classes: [{ id: 'scavenger', level: 1 }],
    });
    survivor.grant('riot-plate');
    survivor.grant('fire-axe');
    survivor.grant('med-kit', 3);
    cap = survivor.derived().hp;
    baseAc = survivor.derived().ac;
    baseMight = profileFromCharacter(rt, survivor).profile.abilities['might']!;
    expect({ hp: cap, ac: baseAc, might: baseMight }).toEqual({ hp: 27, ac: 11, might: 10 });
    expect(survivor.state.equipped).toBeUndefined();

    survivor.equip('riot-plate', 'body');
    expect(survivor.derived().ac).toBe(baseAc - 1); // descending: `11 - floor(level / 3) - gear-ac`
    survivor.equip('fire-axe', 'main-hand');
    const { profile } = profileFromCharacter(rt, survivor);
    expect(profile.abilities['might']).toBe(baseMight + 1);
    expect(profile.ac).toBe(10);
    expect(profile.maxHp).toBe(27);
    expect(survivor.state.abilities['might']).toBe(baseMight); // the grant composes; state is untouched

    survivor.unequip('body');
    expect(survivor.derived().ac).toBe(baseAc);
    survivor.equip('riot-plate', 'body');
    expect(survivor.derived().ac).toBe(baseAc - 1);
    expect(survivor.derived().hp).toBe(cap); // equipping never heals, gear-hp is 0
  });

  it('4 — useItem(med-kit) heals out of combat, clamped, one unit spent, item:used before damage:applied (CA-EG4/EG5)', () => {
    survivor.state.hp.current = cap - 4;
    const events = survivor.useItem('med-kit');
    expect(events.map((event) => event.type)).toEqual(['item:used', 'damage:applied']);
    expect(events[0]!.payload).toEqual({ itemId: 'med-kit', remaining: 2 });
    expect(events[0]!.why.rule).toBe('content.items.med-kit');
    expect(events[1]!.payload).toEqual({ amount: -2, type: undefined, hp: '23→25' });
    expect(events[1]!.why).toEqual({ rule: 'content.items.med-kit', rolls: ['d0[]-2=-2'] });
    expect(survivor.state.hp.current).toBe(Math.min(cap, cap - 4 + 2));
    expect(survivor.count('med-kit')).toBe(2);
  });

  it('5 — fight.use heals the wounded ally through the combat transport: a charge spent, clamped, the foe untouched (CA-EG4/EG5)', () => {
    survivor.state.hp.current = cap - 1; // one below the cap — the +2 heal must clamp at 27
    allyId = survivor.state.id;
    const ally = profileFromCharacter(rt, survivor);
    expect(ally.balances.items).toEqual({ 'med-kit': 2 });
    const foeProfile = spawnMonster(rt, 'cistern-crawler', 'foe');
    restoreRequest = {
      allies: [{ id: allyId, profile: { ...ally.profile, initiativeBonus: 100 }, balances: ally.balances }],
      enemies: [{ id: 'foe', profile: { ...foeProfile, initiativeBonus: -100 } }],
      positions: { [allyId]: { x: 0, y: 0 }, foe: { x: 1, y: 0 } },
    };
    fight = startCombat(rt, restoreRequest);
    expect(fight.state.active).toBe(allyId);
    expect(fight.state.combatants[allyId]!.maxHp).toBe(27);
    const foeHp = fight.state.combatants['foe']!.hp.current;

    const events = fight.use('med-kit', { target: allyId });
    expect(events.map((event) => event.type)).toEqual(['item:used', 'damage:applied']);
    expect(events[0]!.payload).toEqual({ itemId: 'med-kit', remaining: 1 });
    expect(events[0]!.actor).toBe(allyId);
    expect(events[0]!.target).toBe(allyId);
    const heal = events[1]!;
    expect(heal.target).toBe(allyId);
    expect(heal.payload['amount']).toBe(-2);
    expect(heal.payload['hp']).toBe('26→27');
    expect(heal.why.rule).toBe('content.items.med-kit');
    expect(heal.why.rolls).toContain('d0[]-2=-2');
    expect(fight.state.combatants[allyId]!.hp.current).toBe(27);
    expect(fight.state.combatants[allyId]!.itemsUsed).toEqual({ 'med-kit': 1 });
    expect(fight.state.combatants['foe']!.hp.current).toBe(foeHp);
  });

  it('6 — mid-fight snapshot → fresh runtime: itemsUsed + maxHp carried; the second charge spends, the third is no-charges (CA-EG6)', () => {
    const party = JSON.parse(JSON.stringify(serializeCharacter(rt, survivor.state))) as ReturnType<
      typeof serializeCharacter
    >;
    const snapshot = JSON.parse(
      JSON.stringify(serializeCombat(fight, { pairsWith: 'party-1' })),
    ) as ReturnType<typeof serializeCombat>;
    const frozen = snapshot.combatants.find((combatant) => combatant.id === allyId)!;
    expect(frozen.itemsUsed).toEqual({ 'med-kit': 1 });
    expect(frozen.maxHp).toBe(27);

    resumedRt = new Runtime(packFor('zombie-urban'));
    resumedSurvivor = restoreCharacter(resumedRt, party);
    expect(resumedSurvivor.state.id).toBe(allyId);
    resumed = deserializeCombat(resumedRt, snapshot, restoreRequest);
    expect(resumed.state.combatants[allyId]!.itemsUsed).toEqual({ 'med-kit': 1 });
    expect(resumed.state.combatants[allyId]!.maxHp).toBe(27);
    expect(resumed.state.active).toBe(allyId);

    const leg = capture(resumedRt);
    try {
      resumed.use('med-kit');
      expect(leg.events.map((event) => event.type)).toEqual(['item:used', 'damage:applied']);
      expect(leg.events[0]!.payload).toEqual({ itemId: 'med-kit', remaining: 0 });
      expect(leg.events[1]!.payload['hp']).toBe('27→27'); // at the cap: never above it

      const before = JSON.stringify(resumed.state);
      const third = resumed.use('med-kit');
      expect(third).toHaveLength(1);
      expect(third[0]!.type).toBe('declare:rejected');
      expect(third[0]!.payload['kind']).toBe('no-charges');
      expect(JSON.stringify(resumed.state)).toBe(before);
      expect(leg.events).toHaveLength(3);
    } finally {
      leg.release();
    }
  });

  it('7 — combat-over → settleItemUses writes both combat uses back: 3 granted − 1 − 2 = entry gone; idempotent; use after combat-over throws (CAP-E8, CA-EG5)', () => {
    fightToTheEnd(resumed);
    expect(resumed.state.phase).toBe('combat-over');
    expect(resumedSurvivor.count('med-kit')).toBe(2); // the fight never touches character state

    const events = settleItemUses(resumedRt, resumedSurvivor, resumed);
    expect(events.map((event) => event.type)).toEqual(['item:dropped', 'item:settled']);
    expect(events[1]!.payload).toEqual({ combatantId: allyId, itemId: 'med-kit', qty: 2 });
    expect(resumedSurvivor.state.inventory.find((entry) => entry.id === 'med-kit')).toBeUndefined();
    expect(resumedSurvivor.state.inventory).toEqual([
      { id: 'riot-plate', qty: 1 },
      { id: 'fire-axe', qty: 1 },
    ]);
    expect(settleItemUses(resumedRt, resumedSurvivor, resumed)).toEqual([]);

    const leg = capture(resumedRt);
    try {
      expect(() => resumed.use('med-kit')).toThrow('combat is over');
      expect(leg.events).toEqual([]);
    } finally {
      leg.release();
    }
  });

  it('8 — character snapshot → fresh runtime keeps equipped; a tampered equipped itemId is refused with nothing applied (CA-EG6)', () => {
    const snapshot = JSON.parse(
      JSON.stringify(serializeCharacter(resumedRt, resumedSurvivor.state)),
    ) as ReturnType<typeof serializeCharacter>;
    expect(snapshot.state.equipped).toEqual([
      { slot: 'main-hand', itemId: 'fire-axe' },
      { slot: 'body', itemId: 'riot-plate' },
    ]);
    const restored = restoreCharacter(new Runtime(pack), snapshot);
    expect(restored.state.equipped).toEqual(resumedSurvivor.state.equipped);
    expect(restored.derived().ac).toBe(baseAc - 1);

    const tampered = JSON.parse(JSON.stringify(snapshot)) as typeof snapshot;
    (tampered.state.equipped as { slot: string; itemId: string }[])[0]!.itemId = 'ghost-kit';
    const target = new Runtime(pack);
    const cards = refusal(() => restoreCharacter(target, tampered));
    expect(cards.length).toBeGreaterThan(0);
    expect(cards.every((card) => card.rule === 'E-SNAP-01')).toBe(true);
    expect(cards.map((card) => card.jsonPath)).toContain('state.equipped[0].itemId');
    expect(target.nextCharacterId).toBe(1);
  });
});

describe('CAP-E7 / CAP-E3 — the dark-fantasy armorCasting leg (seed 42): slot casting in armor (CA-EG3)', () => {
  const rt = new Runtime(packFor('dark-fantasy'));

  /** A level-1 caster in warded-mail (kind mail, body) with a level-1 spell bound. */
  function armoredCaster(classId: string): { caster: Character; spellId: string } {
    const caster = rt.createCharacter({
      name: classId,
      race: 'hillfolk',
      classes: [{ id: classId, level: 1 }],
    });
    caster.grant('warded-mail');
    caster.equip('warded-mail', 'body');
    const spellId = knownSpells(rt, caster.state).find(
      (id) => rt.pack.content.spells![id]!.magic.level === 1,
    )!;
    caster.prepare(spellId);
    expect(caster.state.slots['1']![0]).toBe(spellId);
    return { caster, spellId };
  }

  it('9–10 — the hexer (armorCasting [leather]) is refused in mail with the slot still bound; after unequip the cast succeeds', () => {
    expect(rt.pack.content.items!['warded-mail']).toMatchObject({ kind: 'mail', slots: ['body'] });
    expect(rt.pack.content.classes!['hexer']!.armorCasting).toEqual(['leather']);
    const { caster, spellId } = armoredCaster('hexer');
    const leg = capture(rt);
    try {
      expect(refusal(() => castSpell(rt, caster.state, spellId))).toEqual([
        { rule: 'armor-not-castable', artifactId: spellId, jsonPath: 'content.items.warded-mail' },
      ]);
      expect(caster.state.slots['1']![0]).toBe(spellId);
      expect(leg.events).toEqual([]);

      caster.unequip('body');
      const cast = castSpell(rt, caster.state, spellId);
      expect(cast.type).toBe('spell:cast');
      expect(caster.state.slots['1']![0]).toBeNull();
    } finally {
      leg.release();
    }
  });

  it('11 — the warden (armorCasting [mail]) casts while wearing warded-mail', () => {
    expect(rt.pack.content.classes!['warden']!.armorCasting).toEqual(['mail']);
    const { caster, spellId } = armoredCaster('warden');
    expect(caster.state.equipped).toEqual([{ slot: 'body', itemId: 'warded-mail' }]);
    const cast = castSpell(rt, caster.state, spellId);
    expect(cast.type).toBe('spell:cast');
    expect(cast.payload).toEqual({ spellId, slotLevel: '1', slotIndex: 0 });
    expect(caster.state.slots['1']![0]).toBeNull();
  });
});
