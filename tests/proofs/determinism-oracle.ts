/**
 * The cross-engine determinism oracle (FR-1, FR-17, NFR-Determinism) and the
 * home of the combat-characterization behaviour pin (combat-decomposition
 * CAP-D1 / CA-D2).
 *
 * Each leg runs a scripted fight through the public runtime barrel
 * (`src/runtime/index`) on real packs and seeded `Rng` streams and records
 * every event the host's sink sees plus every snapshot produced. Two digests
 * are pinned per subject: sha256 of the raw (key-order sensitive) JSON text,
 * and `packContentHash` (canonical, sorted keys, pure-JS FNV-1a). The leg
 * digests were captured from the unmodified source at combat-decomposition
 * SESSION-01 ck1; the pack digests (seed 42, default knobs) at
 * browser-determinism SESSION-01 ck1. Node, browsers and Electron must all
 * reproduce them — this module imports no `node:*` and never reads `process`,
 * so every engine runs the same subjects; each consumer brings its own sha256.
 *
 * Re-key owner: any later feature that intentionally changes combat events
 * (type, order, payload, `why`, `at`) or snapshot output. That feature lists
 * this file in its plan's pin audit (PROGRAM-CONFIG pin-lease convention).
 * A refactor never re-keys it. `PACK_DIGESTS` re-keys whenever a bundled
 * theme or the compiler output changes, by the same rule.
 *
 * Setups are copied from the cited suites, re-pointed at `src` (never `dist`).
 */
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

export interface Recording {
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

export function ofType(events: readonly RuntimeEvent[], type: string): RuntimeEvent[] {
  return events.filter((event) => event.type === type);
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
export function parryLeg(): Recording {
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
export function leavingReachLeg(): Recording & { readonly paused: CombatSnapshot } {
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
export function restoreLeg(paused: CombatSnapshot): Recording {
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
export function vancianLeg(): Recording {
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
export function poolLeg(): Recording {
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
export function useLeg(): Recording {
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
export function featLeg(): Recording {
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
export function selfLeg(): Recording {
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
export function characterLeg(): Recording {
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

export type LegId = 'leg-1' | 'leg-2' | 'leg-3a' | 'leg-3b' | 'leg-4' | 'leg-5' | 'leg-6' | 'leg-7' | 'leg-8';

export interface Digest {
  readonly sha256: string;
  readonly contentHash: string;
}

export const LEG_RUNS: Readonly<Record<LegId, () => Recording>> = {
  'leg-1': parryLeg,
  'leg-2': leavingReachLeg,
  'leg-3a': vancianLeg,
  'leg-3b': poolLeg,
  'leg-4': useLeg,
  'leg-5': featLeg,
  'leg-6': selfLeg,
  'leg-7': () => restoreLeg(leavingReachLeg().paused),
  'leg-8': characterLeg,
};

/** Raw, key-order-sensitive text the sha256 half is taken over. */
export function recordingRaw(recording: Recording): string {
  return JSON.stringify({ events: recording.events, snapshots: recording.snapshots });
}

/** The canonical half: `packContentHash` over the parsed raw text. */
export function contentHashOfRaw(raw: string): string {
  return packContentHash(JSON.parse(raw));
}

export const CHARACTERIZATION_DIGESTS: Readonly<Record<LegId, Digest>> = {
  'leg-1': {
    sha256: '3e2e94f0efd5c014c9c5710c3c54844b9fe27098f559b8cac7f42a399d14f6a2',
    contentHash: '1cc2c131',
  },
  'leg-2': {
    sha256: '007a55676e14a8bc7f971d68ae98c7491b62d850be829fcbcfd0ea81ec76be1f',
    contentHash: '28ee4afb',
  },
  'leg-3a': {
    sha256: '6356cff8a590fda756e96f4db7360ec235c73487fa951da33661ecf153ca0b2c',
    contentHash: '002ae008',
  },
  'leg-3b': {
    sha256: '82597d99afa70698d78b1ced872b1fa165beaafc2edcd3604d0e172715c5916f',
    contentHash: 'ccd332b0',
  },
  'leg-4': {
    sha256: 'b47296c747ca1a230ad23fb7d19453a4f06dcdd38a02ff49b984f0758ede2552',
    contentHash: '73fe4790',
  },
  'leg-5': {
    sha256: '977b2fbeb4cbbd91877deb8eee0e30021a0f7061d341b830b25b0716b6aaeafb',
    contentHash: 'fff7889a',
  },
  'leg-6': {
    sha256: '11f27e47119db53712f5e8bf61bc6360c0a02cc550baf992d8554c8f4acb6b86',
    contentHash: '23ab3692',
  },
  'leg-7': {
    sha256: '650be77640b5c1aa6461eabe08c18ebdbc9766295ccc35a5446676a4aa845607',
    contentHash: 'f8690e3f',
  },
  'leg-8': {
    sha256: '23a287f174b5da23e962c6bacd9f0022cb1923280298941858be9390ba5e01a5',
    contentHash: '7f898d06',
  },
};

export const PACK_THEMES = ['dark-fantasy', 'zombie-urban', 'wyldwood'] as const;

export type PackTheme = (typeof PACK_THEMES)[number];

/** The generated pack (seed 42, default knobs) as raw JSON text. */
export function packRaw(theme: PackTheme): string {
  return JSON.stringify(generated(theme));
}

export const PACK_DIGESTS: Readonly<Record<PackTheme, Digest>> = {
  'dark-fantasy': {
    sha256: '6f87f212e259460c1f0a464c277583102e7bead07ae8f01d3b95cf7cb57e1f3e',
    contentHash: '21f4de6d',
  },
  'zombie-urban': {
    sha256: 'fc80c83d7160ac147b00bf00341a6b1b5c8ea9c2bdf95f4094a036516b0cafe4',
    contentHash: 'c2bbbd7b',
  },
  wyldwood: {
    sha256: 'fc31b3a2c78f676c8307c208fc7543aac816bfacdb165084afc5f29e094bb190',
    contentHash: '273468f5',
  },
};
