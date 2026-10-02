/**
 * CAP-A1 / CAP-A2 / CAP-A3 — the self-targeting journey on generated content
 * (v1.7, DD-A1/A2/A3): `generateCampaign({theme, seed: 42})` → `new
 * Runtime(pack)` → `createCharacter` → `profileFromCharacter` / `spawnMonster`
 * → `startCombat` → `declare` / `respond` → the condition lands on the actor →
 * `serializeCombat` → JSON → `deserializeCombat` on a fresh Runtime.
 *
 * No fixture stands in for production data: every pack is generated, every
 * fight runs on a fresh Runtime and a seeded `Rng`. Heroes act first
 * (`initiativeBonus` +100), foes last (−100), except in the reaction leg.
 * The move-cost self actions (`withdraw`, `brace`, `fall-back`, `circle-path`,
 * `barricade`) spend the move slot, so each leg declares in a fresh fight.
 */
import { describe, expect, it } from 'vitest';
import { generateCampaign, loadTheme } from '../../src/compiler';
import {
  Runtime,
  profileFromCharacter,
  spawnMonster,
  deserializeCombat,
  serializeCombat,
  startCombat,
  type Combat,
  type CombatRestoreRequest,
  type Position,
  type RuntimeEvent,
} from '../../src/runtime';
import { Rng } from '../../src/core/rng';
import type { Pack } from '../../src/schema/pack';

type ThemeId = 'dark-fantasy' | 'zombie-urban' | 'wyldwood';

const SEED = 42;

function generated(themeId: ThemeId): Pack {
  return generateCampaign({ theme: loadTheme(themeId), seed: SEED });
}

/** The same generated pack, theater-of-mind: remove the optional spatial section. */
function stripSpatial(base: Pack): Pack {
  const stripped: Pack = { ...base };
  delete stripped.spatial;
  return stripped;
}

type Sides = Pick<CombatRestoreRequest, 'allies' | 'enemies'>;

/** A level-1 hero of `classId` acting first, against statblock foes acting last. */
function sides(
  rt: Runtime,
  hero: { id: string; classId: string; initiativeBonus?: number },
  foes: readonly { id: string; statblock: string }[],
  foeInitiative = -100,
): Sides {
  const race = Object.keys(rt.pack.content.races ?? {})[0]!;
  const character = rt.createCharacter({ name: hero.id, race, classes: [{ id: hero.classId, level: 1 }] });
  const pair = profileFromCharacter(rt, character, hero.id);
  return {
    allies: [
      {
        id: hero.id,
        profile: { ...pair.profile, initiativeBonus: hero.initiativeBonus ?? 100 },
        balances: pair.balances,
      },
    ],
    enemies: foes.map((foe) => ({
      id: foe.id,
      profile: { ...spawnMonster(rt, foe.statblock, foe.id), initiativeBonus: foeInitiative },
    })),
  };
}

interface Fight {
  readonly rt: Runtime;
  readonly fight: Combat;
  readonly events: RuntimeEvent[];
}

function recorded(rt: Runtime): RuntimeEvent[] {
  const events: RuntimeEvent[] = [];
  rt.events.on((event) => {
    events.push(event);
  });
  return events;
}

/** Start a fight on a generated pack; the first combatant's turn has begun. */
function begin(
  pack: Pack,
  build: (rt: Runtime) => Sides,
  positions?: Readonly<Record<string, Position>>,
): Fight {
  const rt = new Runtime(pack);
  const events = recorded(rt);
  const fight = startCombat(rt, {
    ...build(rt),
    ...(positions !== undefined && pack.spatial !== undefined ? { positions } : {}),
    rng: new Rng('self-target-journey'),
  });
  fight.step();
  return { rt, fight, events };
}

function ofType(events: readonly RuntimeEvent[], type: string): RuntimeEvent[] {
  return events.filter((event) => event.type === type);
}

/** The self action's events: one condition on the actor by the actor, then `action:resolved` naming the actor. */
function expectOnActor(
  events: readonly RuntimeEvent[],
  actorId: string,
  actionId: string,
  conditionId: string,
): void {
  expect(ofType(events, 'declare:rejected')).toEqual([]);
  expect(
    ofType(events, 'condition:applied').map((event) => [
      event.actor,
      event.target,
      event.payload['conditionId'],
      event.why.rule,
    ]),
  ).toEqual([[actorId, actorId, conditionId, `actions.${actionId}`]]);
  expect(ofType(events, 'action:resolved').map((event) => event.payload)).toEqual([
    { actionId, targetId: actorId },
  ]);
}

/** A dark-fantasy warden at (0,0); two wights at (6,0) and (0,6), out of everyone's reach. */
const WIGHTS = [
  { id: 'wight-1', statblock: 'barrow-wight' },
  { id: 'wight-2', statblock: 'barrow-wight' },
] as const;
const FAR: Readonly<Record<string, Position>> = {
  warden: { x: 0, y: 0 },
  'wight-1': { x: 6, y: 0 },
  'wight-2': { x: 0, y: 6 },
};
const wardenVsWights = (pack: Pack): Fight =>
  begin(pack, (rt) => sides(rt, { id: 'warden', classId: 'warden' }, WIGHTS), FAR);

describe('CAP-A1/A3 — dark-fantasy self actions act on their user (seed 42)', () => {
  it('step 1 — withdraw with two wights out of reach, no target → braced on the warden; move slot spent', () => {
    const pack = generated('dark-fantasy');
    expect(pack.spatial?.model).toBe('grid');
    expect(pack.actions['withdraw']!.effect).toBe('target(self, applyCondition(braced, 2))');
    const { fight, events } = wardenVsWights(pack);
    expect(fight.state.active).toBe('warden');
    fight.declare('withdraw');
    expectOnActor(events, 'warden', 'withdraw', 'braced');
    expect(fight.state.combatants['warden']!.conditions.map((c) => c.conditionId)).toEqual(['braced']);
    expect(fight.state.combatants['wight-1']!.conditions).toEqual([]);
    expect(fight.state.combatants['wight-2']!.conditions).toEqual([]);
    expect(fight.state.combatants['warden']!.slots.remaining['move']).toBe(0);
  });

  it('step 2 — brace roots its user (B-AT-1 item 3): then stride is refused restricted', () => {
    const { fight, events } = wardenVsWights(generated('dark-fantasy'));
    fight.declare('brace');
    expectOnActor(events, 'warden', 'brace', 'rooted');
    const before = fight.serialize();
    const answer = fight.declare('stride', { to: { x: 1, y: 0 } });
    expect(answer[answer.length - 1]).toMatchObject({
      type: 'declare:rejected',
      actor: 'warden',
      payload: { kind: 'restricted', resource: 'move' },
    });
    expect(fight.serialize()).toEqual(before);
  });

  it('step 3 — ward-glint (CAP-A2): the foe cuts the hexer down → offer → take → warded on the hexer', () => {
    const pack = generated('dark-fantasy');
    const { fight, events } = begin(
      pack,
      (rt) =>
        sides(
          rt,
          { id: 'hexer', classId: 'hexer', initiativeBonus: -100 },
          [{ id: 'foe', statblock: 'barrow-wight' }],
          100,
        ),
      { foe: { x: 0, y: 0 }, hexer: { x: 1, y: 0 } },
    );
    expect(fight.state.active).toBe('foe');
    fight.declare('cut-down', { targetId: 'hexer' });
    expect(ofType(events, 'attack:rolled').map((event) => event.target)).toEqual(['hexer']);
    expect(fight.pendingTriggers.map((offer) => offer.triggerId)).toEqual(['hexer.ward-glint']);
    const answered = fight.respond('hexer.ward-glint', 'take');
    expect(ofType(answered, 'declare:rejected')).toEqual([]);
    expect(
      ofType(events, 'condition:applied').map((event) => [
        event.actor,
        event.target,
        event.payload['conditionId'],
      ]),
    ).toEqual([['hexer', 'hexer', 'warded']]);
    expect(fight.state.combatants['foe']!.conditions).toEqual([]);
  });

  it('step 4 — snapshot → JSON → restore on a fresh Runtime: the warden is still braced', () => {
    const pack = generated('dark-fantasy');
    const a = wardenVsWights(pack);
    a.fight.declare('withdraw');
    const snap = JSON.parse(JSON.stringify(serializeCombat(a.fight, { pairsWith: 'party-1' }))) as ReturnType<
      typeof serializeCombat
    >;
    const rtB = new Runtime(pack);
    const restored = deserializeCombat(rtB, snap, {
      ...sides(rtB, { id: 'warden', classId: 'warden' }, WIGHTS),
      positions: FAR,
    });
    expect(restored.state.combatants['warden']!.conditions).toEqual(
      a.fight.state.combatants['warden']!.conditions,
    );
    expect(restored.state.combatants['warden']!.conditions.map((c) => c.conditionId)).toContain('braced');
    expect(restored.state.combatants['wight-1']!.conditions).toEqual([]);
  });

  it('step 5 — theater-of-mind (spatial removed): withdraw lands on the warden', () => {
    const pack = stripSpatial(generated('dark-fantasy'));
    expect(pack.spatial).toBeUndefined();
    const { fight, events } = wardenVsWights(pack);
    fight.declare('withdraw');
    expectOnActor(events, 'warden', 'withdraw', 'braced');
    expect(fight.state.combatants['wight-1']!.conditions).toEqual([]);
  });

  it('step 7 — withdraw naming a wight → invalid-target E-REF-01; nothing changes', () => {
    const { fight, events } = wardenVsWights(generated('dark-fantasy'));
    const before = fight.serialize();
    const answer = fight.declare('withdraw', { targetId: 'wight-1' });
    expect(answer[answer.length - 1]).toMatchObject({
      type: 'declare:rejected',
      actor: 'warden',
      payload: { kind: 'invalid-target', resource: 'wight-1' },
      why: { rule: 'E-REF-01' },
    });
    expect(ofType(events, 'condition:applied')).toEqual([]);
    expect(fight.serialize()).toEqual(before);
  });
});

/** DD-A3: each retargeted action, the class that lists it, and the condition it applies. */
const SMOKE: readonly {
  theme: ThemeId;
  classId: string;
  actionId: string;
  conditionId: string;
  foe: string;
}[] = [
  {
    theme: 'zombie-urban',
    classId: 'scavenger',
    actionId: 'fall-back',
    conditionId: 'braced',
    foe: 'grave-shambler',
  },
  {
    theme: 'zombie-urban',
    classId: 'scavenger',
    actionId: 'dodge-roll',
    conditionId: 'braced',
    foe: 'grave-shambler',
  },
  {
    theme: 'zombie-urban',
    classId: 'fixer',
    actionId: 'barricade',
    conditionId: 'fortified',
    foe: 'grave-shambler',
  },
  {
    theme: 'zombie-urban',
    classId: 'fixer',
    actionId: 'adrenal-spike',
    conditionId: 'spiked',
    foe: 'grave-shambler',
  },
  { theme: 'wyldwood', classId: 'warden', actionId: 'fall-back', conditionId: 'braced', foe: 'thorn-wolf' },
  { theme: 'wyldwood', classId: 'warden', actionId: 'circle-path', conditionId: 'warded', foe: 'thorn-wolf' },
  { theme: 'wyldwood', classId: 'warden', actionId: 'ward-step', conditionId: 'warded', foe: 'thorn-wolf' },
];

describe('CAP-A3 — step 6, zombie-urban and wyldwood smoke (seed 42)', () => {
  it.each(SMOKE)('$theme $classId declares $actionId → $conditionId on the declarer', (row) => {
    const pack = generated(row.theme);
    expect(pack.content.classes?.[row.classId]?.actions).toContain(row.actionId);
    expect(pack.actions[row.actionId]!.effect).toMatch(
      new RegExp(`^target\\(self, applyCondition\\(${row.conditionId}, \\d+\\)\\)$`),
    );
    const { fight, events } = begin(
      pack,
      (rt) =>
        sides(rt, { id: 'hero', classId: row.classId }, [
          { id: 'foe-1', statblock: row.foe },
          { id: 'foe-2', statblock: row.foe },
        ]),
      { hero: { x: 0, y: 0 }, 'foe-1': { x: 6, y: 0 }, 'foe-2': { x: 0, y: 6 } },
    );
    fight.declare(row.actionId);
    expectOnActor(events, 'hero', row.actionId, row.conditionId);
    expect(fight.state.combatants['foe-1']!.conditions).toEqual([]);
    expect(fight.state.combatants['foe-2']!.conditions).toEqual([]);
  });
});
