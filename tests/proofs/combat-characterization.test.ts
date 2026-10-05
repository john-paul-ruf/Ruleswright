/**
 * combat-decomposition CAP-D1 / CA-D2 — the combat characterization test.
 *
 * BEHAVIOUR PIN. Each leg runs a scripted fight through the public runtime
 * barrel (`src/runtime/index`) on real packs and seeded `Rng` streams, records
 * every event the host's sink sees plus every snapshot produced, asserts the
 * leg's defining events are present, and pins sha256 of the raw (key-order
 * sensitive) `JSON.stringify({ events, snapshots })` — `packContentHash`
 * (canonical, sorted keys) is kept as a second digest. The digests were
 * captured from the unmodified source at combat-decomposition SESSION-01 ck1.
 *
 * Re-key owner: any later feature that intentionally changes combat events
 * (type, order, payload, `why`, `at`) or snapshot output. That feature lists
 * this file in its plan's pin audit (PROGRAM-CONFIG pin-lease convention).
 * A refactor never re-keys it.
 *
 * Setups are copied from the cited suites, re-pointed at `src` (never `dist`).
 */
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { generateCampaign, loadTheme } from '../../src/compiler';
import {
  Runtime,
  deserializeCombat,
  prepareSpell,
  profileFromCharacter,
  profileFromStatblock,
  restoreCharacter,
  restoreParty,
  serializeCharacter,
  serializeCombat,
  serializeParty,
  spawnMonster,
  startCombat,
  type Combat,
  type CombatantProfile,
  type CombatRestoreRequest,
  type CombatSnapshot,
  type Position,
  type RuntimeEvent,
  type StepOutcome,
  type TerrainCell,
} from '../../src/runtime/index';
import { Rng } from '../../src/core/rng';
import { packContentHash } from '../../src/schema/version';
import type { Pack } from '../../src/schema/pack';
import { emberMarchesPack } from '../runtime/fixtures/packs';

const SEED = 42;

interface Recording {
  readonly events: RuntimeEvent[];
  readonly snapshots: unknown[];
}

function generated(themeId: 'dark-fantasy' | 'zombie-urban' | 'wyldwood'): Pack {
  return generateCampaign({ theme: loadTheme(themeId), seed: SEED });
}

function recorded(rt: Runtime): RuntimeEvent[] {
  const events: RuntimeEvent[] = [];
  rt.events.on((event) => {
    events.push(event);
  });
  return events;
}

/** Serialize → JSON text → parse: the between-steps freeze. */
function frozen(fight: Combat): CombatSnapshot {
  return JSON.parse(JSON.stringify(serializeCombat(fight, { pairsWith: 'party-1' }))) as CombatSnapshot;
}

function ofType(events: readonly RuntimeEvent[], type: string): RuntimeEvent[] {
  return events.filter((event) => event.type === type);
}

function digests(recording: Recording): { sha256: string; contentHash: string } {
  const raw = JSON.stringify({ events: recording.events, snapshots: recording.snapshots });
  return {
    sha256: createHash('sha256').update(raw).digest('hex'),
    contentHash: packContentHash(JSON.parse(raw)),
  };
}

/** Step until `id` may declare, skipping other turns with their first action (spatial-triggers.test.ts). */
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

/** spatial-triggers.test.ts `parryFight`, stepped to the wight's claw on brynn: a parry offer is open. */
function parryFight(): { fight: Combat; events: RuntimeEvent[] } {
  const runtime = new Runtime(emberMarchesPack());
  const events = recorded(runtime);
  const parrier: CombatantProfile = {
    ...profileFromStatblock(runtime.pack, runtime.pack.bestiary['barrow-wight']!, 'brynn'),
    actions: ['parry'],
  };
  const attacker: CombatantProfile = {
    ...profileFromStatblock(runtime.pack, runtime.pack.bestiary['barrow-wight']!, 'wight'),
    actions: ['wight-claw'],
  };
  const fight = startCombat(runtime, {
    allies: [{ id: 'brynn', profile: parrier }],
    enemies: [{ id: 'wight', profile: attacker }],
    rng: new Rng('parry'),
  });
  stepToDeclare(fight, 'wight');
  fight.step();
  fight.declare('wight-claw', { targetId: 'brynn' });
  return { fight, events };
}

/** Leg 1 — theater-of-mind exchange: the parry offer taken in one fight, declined in a second. */
function parryLeg(): Recording {
  const answered = (choice: 'take' | 'decline') => {
    const { fight, events } = parryFight();
    fight.respond(fight.pendingTriggers.find((pending) => pending.actionId === 'parry')!.triggerId, choice);
    return { events, snapshot: frozen(fight) };
  };
  const taken = answered('take');
  const declined = answered('decline');
  return { events: [...taken.events, ...declined.events], snapshots: [taken.snapshot, declined.snapshot] };
}

type Sides = Pick<CombatRestoreRequest, 'allies' | 'enemies'>;

/** A level-1 hero of the theme's first class plus one statblock foe (movement-journey.test.ts `duel`). */
function duel(rt: Runtime, statblock: string): Sides {
  const race = Object.keys(rt.pack.content.races ?? {})[0]!;
  const classId = Object.keys(rt.pack.content.classes ?? {})[0]!;
  const hero = rt.createCharacter({ name: 'hero', race, classes: [{ id: classId, level: 1 }] });
  const pair = profileFromCharacter(rt, hero, 'hero');
  return {
    allies: [{ id: 'hero', profile: { ...pair.profile, initiativeBonus: 100 }, balances: pair.balances }],
    enemies: [{ id: 'foe', profile: { ...spawnMonster(rt, statblock, 'foe'), initiativeBonus: -100 } }],
  };
}

const LEAVING_TERRAIN: readonly TerrainCell[] = [{ at: { x: -2, y: 1 }, kind: 'bramble' }];
const DESTINATION = { x: -3, y: 0 };

/**
 * Leg 2 — wyldwood hex glide leaves the thorn-wolf's reach, pauses on
 * `move:leaving-reach`, the offer is taken, the hero's own reaction declined,
 * and the move resumes and arrives (movement-journey.test.ts step 4, fight A).
 * Returns the frozen snapshot taken at the open offer for leg 7.
 */
function leavingReachLeg(): Recording & { readonly paused: CombatSnapshot } {
  const rt = new Runtime(generated('wyldwood'));
  const events = recorded(rt);
  const fight = startCombat(rt, {
    ...duel(rt, 'thorn-wolf'),
    positions: { hero: { x: 0, y: 0 }, foe: { x: 1, y: 0 } },
    terrain: LEAVING_TERRAIN,
    rng: new Rng('leaving-reach'),
  });
  fight.step();
  fight.declare('glide', { to: DESTINATION });
  const paused = frozen(fight);
  fight.respond('foe.bramble-snap', 'take', 'hero');
  fight.respond('hero.ward-step', 'decline');
  return { events, snapshots: [paused, frozen(fight)], paused };
}

/** Leg 7 — the paused snapshot restored on a fresh runtime with its open offer, answered, then stepped on. */
function restoreLeg(paused: CombatSnapshot): Recording {
  const positions: Record<string, Position> = {};
  for (const combatant of paused.combatants) positions[combatant.id] = combatant.position!;
  const rt = new Runtime(generated('wyldwood'));
  const events = recorded(rt);
  const fight = deserializeCombat(rt, paused, {
    ...duel(rt, 'thorn-wolf'),
    positions,
    terrain: LEAVING_TERRAIN,
  });
  const restoredOffers = fight.pendingTriggers.map((offer) => offer.triggerId);
  fight.respond('foe.bramble-snap', 'take', 'hero');
  fight.respond('hero.ward-step', 'decline');
  fight.step();
  fight.step();
  return { events, snapshots: [restoredOffers, frozen(fight)] };
}

/** Leg 3a — vancian ember-bloom centered with `at`, after an out-of-range refusal (spells-journey.test.ts). */
function vancianLeg(): Recording {
  const rt = new Runtime(generated('dark-fantasy'));
  const events = recorded(rt);
  const hexer = rt.createCharacter({ name: 'hexer', race: 'hillfolk', classes: [{ id: 'hexer', level: 3 }] });
  prepareSpell(rt, hexer.state, 'ember-bloom');
  prepareSpell(rt, hexer.state, 'ember-bloom');
  const pair = profileFromCharacter(rt, hexer, 'hexer');
  const fight = startCombat(rt, {
    allies: [{ id: 'hexer', profile: { ...pair.profile, initiativeBonus: 100 }, balances: pair.balances }],
    enemies: [
      { id: 'wight', profile: { ...spawnMonster(rt, 'barrow-wight', 'wight'), initiativeBonus: 0 } },
      {
        id: 'shambles',
        profile: { ...spawnMonster(rt, 'grave-shambles', 'shambles'), initiativeBonus: -100 },
      },
    ],
    positions: { hexer: { x: 0, y: 0 }, wight: { x: 4, y: 0 }, shambles: { x: 10, y: 0 } },
    rng: new Rng(0),
  });
  fight.step();
  fight.declare('ember-bloom', { at: { x: 8, y: 0 } });
  fight.declare('ember-bloom', { at: { x: 4, y: 1 } });
  fight.declare('stride', { to: { x: 0, y: 1 } });
  return { events, snapshots: [frozen(fight)] };
}

/** Leg 3b — point-pool hex-bolt on a wolf (spells-journey.test.ts pool leg). */
function poolLeg(): Recording {
  const rt = new Runtime(generated('wyldwood'));
  const events = recorded(rt);
  const hexer = rt.createCharacter({
    name: 'hexer',
    race: 'verge-born',
    classes: [{ id: 'hexer', level: 3 }],
  });
  const pair = profileFromCharacter(rt, hexer, 'hexer');
  const fight = startCombat(rt, {
    allies: [{ id: 'hexer', profile: { ...pair.profile, initiativeBonus: 100 }, balances: pair.balances }],
    enemies: [
      { id: 'wolf', profile: { ...spawnMonster(rt, 'thorn-wolf', 'wolf'), initiativeBonus: 0 } },
      { id: 'shade', profile: { ...spawnMonster(rt, 'briar-shade', 'shade'), initiativeBonus: -100 } },
    ],
    positions: { hexer: { x: 0, y: 0 }, wolf: { x: 3, y: 0 }, shade: { x: 0, y: 8 } },
    rng: new Rng(0),
  });
  fight.step();
  fight.declare('hex-bolt', { targetId: 'wolf' });
  return { events, snapshots: [frozen(fight)] };
}

/** Leg 4 — `fight.use` of a med-kit on the wounded user, then once more (equipment-journey.test.ts step 5). */
function useLeg(): Recording {
  const rt = new Runtime(generated('zombie-urban'));
  const events = recorded(rt);
  const survivor = rt.createCharacter({
    name: 'Rook',
    race: 'mile-born',
    classes: [{ id: 'scavenger', level: 1 }],
  });
  survivor.grant('riot-plate');
  survivor.grant('fire-axe');
  survivor.grant('med-kit', 3);
  survivor.equip('riot-plate', 'body');
  survivor.equip('fire-axe', 'main-hand');
  survivor.state.hp.current = survivor.derived().hp - 1;
  const allyId = survivor.state.id;
  const ally = profileFromCharacter(rt, survivor);
  const fight = startCombat(rt, {
    allies: [{ id: allyId, profile: { ...ally.profile, initiativeBonus: 100 }, balances: ally.balances }],
    enemies: [
      { id: 'foe', profile: { ...spawnMonster(rt, 'cistern-crawler', 'foe'), initiativeBonus: -100 } },
    ],
    positions: { [allyId]: { x: 0, y: 0 }, foe: { x: 1, y: 0 } },
    rng: new Rng('use'),
  });
  fight.use('med-kit', { target: allyId });
  fight.use('med-kit');
  return { events, snapshots: [frozen(fight)] };
}

/** Leg 5 — grave-gaze offers brynn's held second-gust; taken (feat-triggers.test.ts `featFight`). */
function featLeg(): Recording {
  const runtime = new Runtime(emberMarchesPack());
  const events = recorded(runtime);
  const frame = (id: string, actions: readonly string[], initiativeBonus: number): CombatantProfile => ({
    ...profileFromStatblock(runtime.pack, runtime.pack.bestiary['barrow-wight']!, id),
    actions,
    initiativeBonus,
  });
  const fight = startCombat(runtime, {
    allies: [
      { id: 'brynn', profile: { ...frame('brynn', ['strike'], -100), feats: ['second-gust'] } },
      { id: 'ald', profile: frame('ald', ['strike'], -100) },
    ],
    enemies: [{ id: 'wight', profile: frame('wight', ['grave-gaze'], 100) }],
    rng: new Rng('feats'),
  });
  fight.step();
  fight.declare('grave-gaze', { targetId: 'brynn' });
  fight.respond('brynn.second-gust', 'take');
  return { events, snapshots: [frozen(fight)] };
}

/** Leg 6 — a self action: withdraw naming a wight is refused, then withdraw lands on the warden (self-target-journey.test.ts). */
function selfLeg(): Recording {
  const rt = new Runtime(generated('dark-fantasy'));
  const events = recorded(rt);
  const race = Object.keys(rt.pack.content.races ?? {})[0]!;
  const warden = rt.createCharacter({ name: 'warden', race, classes: [{ id: 'warden', level: 1 }] });
  const pair = profileFromCharacter(rt, warden, 'warden');
  const fight = startCombat(rt, {
    allies: [{ id: 'warden', profile: { ...pair.profile, initiativeBonus: 100 }, balances: pair.balances }],
    enemies: ['wight-1', 'wight-2'].map((id) => ({
      id,
      profile: { ...spawnMonster(rt, 'barrow-wight', id), initiativeBonus: -100 },
    })),
    positions: { warden: { x: 0, y: 0 }, 'wight-1': { x: 6, y: 0 }, 'wight-2': { x: 0, y: 6 } },
    rng: new Rng('self-target-journey'),
  });
  fight.step();
  fight.declare('withdraw', { targetId: 'wight-1' });
  fight.declare('withdraw');
  return { events, snapshots: [frozen(fight)] };
}

/** Leg 8 — one generated character and a party through the character snapshots and back. */
function characterLeg(): Recording {
  const pack = generated('dark-fantasy');
  const rt = new Runtime(pack);
  const events = recorded(rt);
  const hexer = rt.createCharacter({ name: 'hexer', race: 'hillfolk', classes: [{ id: 'hexer', level: 3 }] });
  prepareSpell(rt, hexer.state, 'ember-bloom');
  const characterSnap = JSON.parse(JSON.stringify(serializeCharacter(rt, hexer.state))) as ReturnType<
    typeof serializeCharacter
  >;
  const partySnap = JSON.parse(JSON.stringify(serializeParty(rt, [hexer.state]))) as ReturnType<
    typeof serializeParty
  >;
  const rtCharacter = new Runtime(pack);
  const restored = restoreCharacter(rtCharacter, characterSnap);
  const rtParty = new Runtime(pack);
  const members = restoreParty(rtParty, partySnap);
  return {
    events,
    snapshots: [
      characterSnap,
      serializeCharacter(rtCharacter, restored.state),
      partySnap,
      serializeParty(rtParty, members),
    ],
  };
}

describe('CAP-D1 — combat characterization (behaviour pin)', () => {
  it('leg 1 — theater-of-mind exchange: a reactive offer taken, one declined', () => {
    const leg = parryLeg();
    expect(ofType(leg.events, 'trigger:fired').length).toBeGreaterThanOrEqual(2);
    expect(ofType(leg.events, 'trigger:declined')).toHaveLength(1);
    expect(ofType(leg.events, 'damage:applied').some((event) => event.why.rule === 'actions.parry')).toBe(
      true,
    );
    expect(digests(leg)).toEqual({
      sha256: '3e2e94f0efd5c014c9c5710c3c54844b9fe27098f559b8cac7f42a399d14f6a2',
      contentHash: '1cc2c131',
    });
  });

  it('leg 2 — a hex move pauses on move:leaving-reach, is answered, resumes and arrives', () => {
    const leg = leavingReachLeg();
    expect(ofType(leg.events, 'move:leaving-reach')).toHaveLength(1);
    expect(ofType(leg.events, 'move:ended').map((event) => event.payload['reason'])).toEqual(['arrived']);
    expect(digests(leg)).toEqual({
      sha256: '1bbcd2d2135a93f20c7ec7628fded88e005235cc05c4ec483c4d3262f1c03792',
      contentHash: '6c8558c7',
    });
  });

  it('leg 3a — a vancian slot spell centered with `at`, after an out-of-range refusal', () => {
    const leg = vancianLeg();
    const casts = ofType(leg.events, 'spell:cast');
    expect(casts).toHaveLength(1);
    expect(casts[0]!.payload).toMatchObject({ spellId: 'ember-bloom', at: { x: 4, y: 1 }, slotLevel: '2' });
    expect(ofType(leg.events, 'declare:rejected').map((event) => event.payload['kind'])).toEqual([
      'out-of-range',
      'slot-exhausted',
    ]);
    expect(digests(leg)).toEqual({
      sha256: 'ec107e2f4c5e897e092303c227b3b005fbfec540eaa3a930be7bf0bb80d7f530',
      contentHash: 'd6bc9ea8',
    });
  });

  it('leg 3b — a point-pool spell on a target', () => {
    const leg = poolLeg();
    expect(ofType(leg.events, 'spell:cast').map((event) => event.payload['cost'])).toEqual(['points']);
    expect(digests(leg)).toEqual({
      sha256: 'a3721aa07139037eb1d050aa448cf28c7314bb7cf21882e21c8800b6840361df',
      contentHash: '3a990bff',
    });
  });

  it('leg 4 — a consumable use', () => {
    const leg = useLeg();
    expect(ofType(leg.events, 'item:used')).toHaveLength(2);
    expect(digests(leg)).toEqual({
      sha256: '10fbaf2569c01e2abde962eaffdf9d6c617cd3820f7991f553affe69db32bb2c',
      contentHash: '007b3cc3',
    });
  });

  it('leg 5 — a reactive feat offered and taken', () => {
    const leg = featLeg();
    expect(ofType(leg.events, 'trigger:fired').map((event) => event.payload['source'])).toEqual(['feat']);
    expect(
      ofType(leg.events, 'condition:applied').some((event) => event.why.rule === 'content.feats.second-gust'),
    ).toBe(true);
    expect(digests(leg)).toEqual({
      sha256: '977b2fbeb4cbbd91877deb8eee0e30021a0f7061d341b830b25b0716b6aaeafb',
      contentHash: 'fff7889a',
    });
  });

  it('leg 6 — a self action lands on its actor; naming a foe is refused', () => {
    const leg = selfLeg();
    expect(ofType(leg.events, 'declare:rejected').map((event) => event.payload['kind'])).toEqual([
      'invalid-target',
    ]);
    expect(
      ofType(leg.events, 'condition:applied').map((event) => [event.actor, event.target, event.why.rule]),
    ).toEqual([['warden', 'warden', 'actions.withdraw']]);
    expect(digests(leg)).toEqual({
      sha256: 'f1d8a33ac736f428fab8289b2e727903859cab5ec8305d137aee8718aef631f2',
      contentHash: 'e5e992e2',
    });
  });

  it('leg 7 — a mid-fight snapshot with an open offer → JSON → restore → answered and continued', () => {
    const leg = restoreLeg(leavingReachLeg().paused);
    expect(leg.snapshots[0]).toEqual(['foe.bramble-snap']);
    expect(ofType(leg.events, 'move:ended').map((event) => event.payload['reason'])).toEqual(['arrived']);
    expect(
      ofType(leg.events, 'turn:ended').length + ofType(leg.events, 'turn:started').length,
    ).toBeGreaterThan(0);
    expect(digests(leg)).toEqual({
      sha256: '7ccd2b0dc912971763d72c47ceb5f775e0fd70a03e770df9c7bed4b26bddede4',
      contentHash: 'c0e47550',
    });
  });

  it('leg 8 — a generated character and party through the snapshots and back', () => {
    const leg = characterLeg();
    expect(leg.snapshots).toHaveLength(4);
    expect(leg.snapshots[1]).toEqual(leg.snapshots[0]);
    expect(digests(leg)).toEqual({
      sha256: 'a05217b2d52345424335b4f80e50049261c9eb5f559a6e63593c75a8160c6d84',
      contentHash: 'e2f20ba2',
    });
  });
});
