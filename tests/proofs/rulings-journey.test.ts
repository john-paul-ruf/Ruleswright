/**
 * CAP-R1 / CAP-R2 / CAP-R3 — the builder-rulings journey on generated content
 * (v1.9, DD-R1/R3/R4; CA-R1, CA-R2, CA-R4): `generateCampaign({theme, seed: 42})`
 * → `new Runtime(pack)` → `createCharacter` → (`prepareSpell` for the vancian
 * theme) → `profileFromCharacter` → `startCombat` → `fight.declare(spellId,
 * { targetId: ally })` → a negative `damage:applied` on the ally.
 *
 * No fixture stands in for production data: every pack is generated, every leg
 * runs on a fresh Runtime and a seeded `Rng`. The caster acts first
 * (`initiativeBonus` +100), the ally next (0), the foe last (−100). All three
 * packs are spatial, so positions are explicit: caster (0,0), ally (1,0), foe
 * (5,0) — inside the spells' range 6.
 */
import { describe, expect, it } from 'vitest';
import { generateCampaign, loadTheme } from '../../src/compiler';
import {
  Runtime,
  applyCondition,
  isRestricted,
  prepareSpell,
  profileFromCharacter,
  restrictedIds,
  spawnMonster,
  startCombat,
  type Combat,
  type RuntimeEvent,
} from '../../src/runtime';
import { Rng } from '../../src/core/rng';
import type { Pack } from '../../src/schema/pack';

type ThemeId = 'dark-fantasy' | 'zombie-urban' | 'wyldwood';

const SEED = 42;

function generated(themeId: ThemeId): Pack {
  return generateCampaign({ theme: loadTheme(themeId), seed: SEED });
}

/** One healing spell per theme: who casts it, on whom, against which foe, at what cost. */
interface HealRow {
  readonly theme: ThemeId;
  readonly spellId: string;
  readonly casterClass: string;
  readonly allyClass: string;
  readonly foe: string;
  /** The points pool and amount, or `undefined` for the vancian theme (a bound slot). */
  readonly pool?: { readonly id: string; readonly amount: number };
}

const HEALS: readonly HealRow[] = [
  {
    theme: 'zombie-urban',
    spellId: 'bind-the-bite',
    casterClass: 'medic',
    allyClass: 'scavenger',
    foe: 'grave-shambler',
    pool: { id: 'adrenaline', amount: 4 },
  },
  {
    theme: 'dark-fantasy',
    spellId: 'bind-wound',
    casterClass: 'warden',
    allyClass: 'warden',
    foe: 'barrow-wight',
  },
  {
    theme: 'wyldwood',
    spellId: 'bind-wound',
    casterClass: 'warden',
    allyClass: 'warden',
    foe: 'thorn-wolf',
    pool: { id: 'motes', amount: 2 },
  },
];

const POSITIONS = { caster: { x: 0, y: 0 }, ally: { x: 1, y: 0 }, foe: { x: 5, y: 0 } } as const;

/** The events one call emitted. */
function during(rt: Runtime, work: () => unknown): RuntimeEvent[] {
  const events: RuntimeEvent[] = [];
  const sink = (event: RuntimeEvent) => events.push(event);
  rt.events.on(sink);
  try {
    work();
  } finally {
    rt.events.off(sink);
  }
  return events;
}

interface HealFight {
  readonly rt: Runtime;
  readonly fight: Combat;
  readonly casterVigor: number;
}

/** A level-1 caster and a level-1 ally (`wound` hp below its maxHp) against one statblock foe; the caster's turn has begun. */
function healFight(
  row: HealRow,
  wound: number,
  conditionOnCaster?: string,
  pack = generated(row.theme),
): HealFight {
  const rt = new Runtime(pack);
  const race = Object.keys(pack.content.races ?? {})[0]!;
  const caster = rt.createCharacter({ name: 'caster', race, classes: [{ id: row.casterClass, level: 1 }] });
  if (row.pool === undefined) prepareSpell(rt, caster.state, row.spellId);
  const ally = rt.createCharacter({ name: 'ally', race, classes: [{ id: row.allyClass, level: 1 }] });
  const casterPair = profileFromCharacter(rt, caster, 'caster');
  const allyPair = profileFromCharacter(rt, ally, 'ally');
  const fight = startCombat(rt, {
    allies: [
      {
        id: 'caster',
        profile: { ...casterPair.profile, initiativeBonus: 100 },
        balances: casterPair.balances,
      },
      {
        id: 'ally',
        profile: { ...allyPair.profile, hp: allyPair.profile.maxHp! - wound, initiativeBonus: 0 },
        balances: allyPair.balances,
      },
    ],
    enemies: [{ id: 'foe', profile: { ...spawnMonster(rt, row.foe, 'foe'), initiativeBonus: -100 } }],
    positions: POSITIONS,
    rng: new Rng('rulings-journey'),
  });
  fight.step();
  expect(fight.state.active).toBe('caster');
  if (conditionOnCaster !== undefined) {
    fight.state.combatants['caster']!.conditions.push({ conditionId: conditionOnCaster, duration: 2 });
  }
  return { rt, fight, casterVigor: casterPair.profile.abilities['vigor']! };
}

/** `before→after` of a `damage:applied` hp payload. */
function hpOf(event: RuntimeEvent): [number, number] {
  const [before, after] = String(event.payload['hp']).split('→').map(Number);
  return [before!, after!];
}

/** Cast the heal at the ally and assert the CA-R4 meaning; returns the heal event. */
function castHeal(row: HealRow, wound: number): { heal: RuntimeEvent; maxHp: number; fight: Combat } {
  const { rt, fight, casterVigor } = healFight(row, wound);
  const caster = fight.state.combatants['caster']!;
  const poolBefore = row.pool === undefined ? undefined : caster.pools[row.pool.id]!;
  const foeHp = fight.state.combatants['foe']!.hp.current;
  const events = during(rt, () => fight.declare(row.spellId, { targetId: 'ally' }));

  expect(events.filter((event) => event.type === 'declare:rejected')).toEqual([]);
  expect(events[0]!.type).toBe('spell:cast');
  const damage = events.filter((event) => event.type === 'damage:applied');
  expect(damage).toHaveLength(1);
  const heal = damage[0]!;
  expect(events.indexOf(heal)).toBeGreaterThan(0);
  expect(heal.target).toBe('ally');
  expect(heal.why.rule).toBe(`content.spells.${row.spellId}`);

  // CA-R4: amount = −(1d8 + the caster's vigor ability); the face is in why.rolls[0], e.g. "d8[-2]-10=-12".
  const amount = heal.payload['amount'] as number;
  const face = /^d8\[(-?\d+)\]/.exec(String(heal.why.rolls[0]));
  expect(face, String(heal.why.rolls[0])).not.toBeNull();
  const dice = Math.abs(Number(face![1]));
  expect(dice).toBeGreaterThanOrEqual(1);
  expect(dice).toBeLessThanOrEqual(8);
  expect(casterVigor).toBe(10);
  expect(amount).toBe(-(dice + casterVigor));
  expect(amount).toBeGreaterThanOrEqual(-18);
  expect(amount).toBeLessThanOrEqual(-11);

  expect(fight.state.combatants['foe']!.hp.current).toBe(foeHp);
  if (row.pool === undefined) {
    expect(events[0]!.payload).toMatchObject({ cost: 'vancian', slotLevel: '1', slotIndex: 0 });
    expect(caster.slotsCast).toEqual({ '1': [0] });
    expect(caster.poolsSpent).toEqual({});
  } else {
    expect(events[0]!.payload).toMatchObject({ cost: 'points', pool: row.pool.id, amount: row.pool.amount });
    expect(caster.pools[row.pool.id]).toBe(poolBefore! - row.pool.amount);
    expect(caster.poolsSpent).toEqual({ [row.pool.id]: row.pool.amount });
  }
  return { heal, maxHp: fight.state.combatants['ally']!.maxHp, fight };
}

describe('CAP-R1 — legs 1–3: the mending spells heal a wounded ally (DD-R1, CA-R4; seed 42)', () => {
  it.each(HEALS)('$theme $casterClass casts $spellId on a wounded $allyClass', (row) => {
    const pack = generated(row.theme);
    expect(pack.content.spells?.[row.spellId]?.effect).toBe('heal(1d8 + ability(vigor))');
    const { heal, maxHp, fight } = castHeal(row, 20);
    const amount = heal.payload['amount'] as number;
    const [before, after] = hpOf(heal);
    expect(before).toBe(maxHp - 20);
    // the uncapped branch: a wound of 20 exceeds the largest heal (18)
    expect(after).toBe(before - amount);
    expect(after).toBeLessThan(maxHp);
    expect(fight.state.combatants['ally']!.hp.current).toBe(after);
  });
});

describe('CAP-R1 — leg 4: a heal never lifts hp above maxHp', () => {
  it.each(HEALS)('$theme $spellId on an unwounded ally reads maxHp→maxHp', (row) => {
    const { heal, maxHp, fight } = castHeal(row, 0);
    expect(heal.payload['hp']).toBe(`${maxHp}→${maxHp}`);
    expect(fight.state.combatants['ally']!.hp.current).toBe(maxHp);
  });
});

describe('CAP-R2 — leg 5: symmetric restricts on a generated pack (DD-R3, CA-R1)', () => {
  /** dark-fantasy plus a test-setup condition (pack data; no engine change). */
  function silencedPack(): Pack {
    const pack = generated('dark-fantasy');
    pack.content.conditions = {
      ...pack.content.conditions,
      silenced: { name: 'Silenced', duration: 2, stacking: 'refresh', restricts: ['actions.tagged:casting'] },
    };
    return pack;
  }

  it('out of combat: an actions.tagged:casting condition blocks every casting spell, never strike', () => {
    const pack = silencedPack();
    const rt = new Runtime(pack);
    const state = rt.createCharacter({
      name: 'warden',
      race: 'hillfolk',
      classes: [{ id: 'warden', level: 1 }],
    }).state;
    applyCondition(rt, state, 'silenced');
    expect(isRestricted(rt, state, 'spell', 'bind-wound')).toBe(true);
    const casting = Object.entries(pack.content.spells ?? {})
      .filter(([, spell]) => (spell.tags ?? []).includes('casting'))
      .map(([id]) => id);
    expect(casting.length).toBeGreaterThan(0);
    expect(restrictedIds(rt, state, 'spell')).toEqual(casting);
    expect(isRestricted(rt, state, 'action', 'strike')).toBe(false);
  });

  it('in combat: the same condition on the warden rejects bind-wound restricted; nothing is spent', () => {
    const row = HEALS[1]!;
    const { rt, fight } = healFight(row, 20, 'silenced', silencedPack());
    const before = fight.serialize();
    const events = during(rt, () => fight.declare('bind-wound', { targetId: 'ally' }));
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: 'declare:rejected',
      payload: { kind: 'restricted', resource: 'casting' },
    });
    expect(fight.serialize()).toEqual(before);
  });
});

describe('CAP-R3 — leg 6: an XP award never lowers a level on a generated pack (DD-R4, CA-R2)', () => {
  it('dark-fantasy hillfolk warden set to level 3 keeps it, then rises at 6000 class XP', () => {
    const rt = new Runtime(generated('dark-fantasy'));
    const c = rt.createCharacter({ name: 'Brynn', race: 'hillfolk', classes: [{ id: 'warden', level: 3 }] });
    c.learnFeat('ironhide');
    c.learnFeat('steady-hands');

    expect(rt.awardXp(c, 100).map((event) => event.type)).toEqual(['xp:awarded']);
    expect(c.state.xp).toBe(100);
    expect(c.state.classes).toEqual([{ id: 'warden', level: 3 }]);
    expect(c.state.feats).toEqual(['ironhide', 'steady-hands']);

    const events = rt.awardXp(c, 5900);
    expect(events.map((event) => event.type)).toEqual(['xp:awarded', 'level:reached']);
    expect(events[1]!.payload).toEqual({ classId: 'warden', level: 4 });
    expect(c.state.classXp).toEqual({ warden: 6000 });
    expect(c.state.classes).toEqual([{ id: 'warden', level: 4 }]);
  });
});
