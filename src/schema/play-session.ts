/** Portable AR-02 data contracts. No runtime or core dependency. */

import type { Pack } from './pack';
import { makeErrorCard, type ErrorCard } from './error-card';
import { packContentHash } from './version';

export type PlayPackIdentity = {
  readonly id: string;
  readonly schemaVersion: number;
  readonly contentHash: string;
};

export type PlayRngState = { readonly a: number; readonly b: number; readonly c: number; readonly d: number };

export type PlayCharacterState = {
  readonly name: string;
  readonly race: string;
  readonly classes: readonly { readonly id: string; readonly level: number; readonly xp?: number }[];
  readonly abilities: Readonly<Record<string, number>>;
  readonly skills?: Readonly<Record<string, number>>;
  readonly feats?: readonly string[];
  readonly knownSpells?: readonly string[];
  readonly pools?: Readonly<Record<string, number>>;
  readonly slots?: Readonly<Record<string, readonly (null | string)[]>>;
  readonly conditions: readonly { readonly id: string; readonly remaining: number }[];
  readonly inventory: readonly { readonly id: string; readonly qty: number }[];
  readonly equipped?: readonly { readonly slot: string; readonly itemId: string }[];
  readonly hp?: { readonly current: number; readonly temp: number };
};

export type PlayCharacterSnapshot = {
  readonly kind: 'character';
  readonly snapshotVersion: 1;
  readonly pack: PlayPackIdentity;
  readonly state: PlayCharacterState;
};

export type PlayCombatSnapshot = {
  readonly kind: 'combat';
  readonly snapshotVersion: 1;
  readonly pack: PlayPackIdentity;
  readonly pairsWith: string;
  readonly round: number;
  readonly turn: number;
  readonly order: readonly string[];
  readonly rng: PlayRngState;
  readonly combatants: readonly {
    readonly id: string;
    readonly hp: number;
    readonly slotsUsed?: Readonly<Record<string, number>>;
    readonly conditions?: readonly { readonly id: string; readonly remaining: number }[];
    readonly position?: null | Readonly<Record<string, unknown>>;
    readonly pendingTrigger?: null | string;
    readonly itemsUsed?: Readonly<Record<string, number>>;
    readonly maxHp?: number;
    readonly pendingMove?: {
      readonly actionId: string;
      readonly to: { readonly x: number; readonly y: number };
      readonly remaining: number;
      readonly offeredDepartures?: readonly {
        readonly from: { readonly x: number; readonly y: number };
        readonly to: { readonly x: number; readonly y: number };
        readonly reactorId: string;
      }[];
    };
    readonly poolsSpent?: Readonly<Record<string, number>>;
    readonly slotsCast?: Readonly<Record<string, readonly number[]>>;
  }[];
  readonly phase?: 'awaiting-declare' | 'resolved' | 'awaiting-trigger-response' | 'combat-over';
  readonly offeredCount?: number;
  readonly offers?: readonly {
    readonly actorId: string;
    readonly source: 'action' | 'feat';
    readonly id: string;
    readonly on: string;
  }[];
};

export type PlayId = string;

export type PlayOpaqueId = string;

export type PlayCounter = number;

export type PlayHash = string;

export type PlaySeed = string | number;

export type PlayJsonValue =
  null | boolean | string | number | readonly PlayJsonValue[] | { readonly [key: string]: PlayJsonValue };

export type PlayPosition = { readonly x: number; readonly y: number };

export type PlayTerrainCell = { readonly at: PlayPosition; readonly kind: string };

export type PlayLayout =
  | { readonly kind: 'theater' }
  | {
      readonly kind: 'spatial';
      readonly model: 'grid' | 'hex';
      readonly allies: readonly PlayPosition[];
      readonly enemies: readonly PlayPosition[];
      readonly terrain: readonly PlayTerrainCell[];
    };

export type EncounterSetup = {
  readonly budget: number;
  readonly seed: PlaySeed;
  readonly maxPartySize: number;
  readonly maxEnemies: number;
  readonly layout: PlayLayout;
};

export type PlayMember = {
  readonly memberId: string;
  readonly character: PlayCharacterSnapshot & {
    readonly state: PlayCharacterState & {
      readonly hp: { readonly current: number; readonly temp: number };
      readonly pools: Readonly<Record<string, number>>;
      readonly slots: Readonly<Record<string, readonly (string | null)[]>>;
    };
  };
};

export type PlayMembers = readonly PlayMember[];

export type EncounterSessionOptions = {
  readonly sessionId: string;
  readonly seed: PlaySeed;
  readonly members: PlayMembers;
  readonly setup: EncounterSetup;
};

export type PlayInitialCondition = { readonly conditionId: string; readonly duration: number };

export type PlayProfile = {
  readonly id: string;
  readonly abilities: Readonly<Record<string, number>>;
  readonly saves: Readonly<Record<string, number>>;
  readonly level: number;
  readonly hp: number;
  readonly maxHp?: number;
  readonly ac: number;
  readonly initiativeBonus: number;
  readonly speed?: number;
  readonly actions: readonly string[];
  readonly attackTable?: readonly {
    readonly level: number;
    readonly byDefense: Readonly<Record<string, number>>;
  }[];
  readonly attackBonus?: number;
  readonly spells?: readonly string[];
  readonly castBlockedBy?: string;
  readonly feats?: readonly string[];
};

export type PlayBalances = {
  readonly pools?: Readonly<Record<string, number>>;
  readonly boundSlots?: Readonly<Record<string, number>>;
  readonly items?: Readonly<Record<string, number>>;
  readonly bindings?: Readonly<Record<string, readonly (null | string)[]>>;
};

export type PlayStartEntry = {
  readonly id: string;
  readonly profile: PlayProfile;
  readonly balances: PlayBalances;
  readonly conditions?: readonly PlayInitialCondition[];
};

export type PlayStartInputs = {
  readonly allies: readonly PlayStartEntry[];
  readonly enemies: readonly PlayStartEntry[];
  readonly positions: Readonly<Record<string, PlayPosition>>;
  readonly terrain: readonly PlayTerrainCell[];
};

export type PlaySelection = {
  readonly groups: readonly { readonly id: string; readonly count: number }[];
  readonly threat: number;
  readonly budget: number;
  readonly seedUsed: string;
  readonly heuristic: 'threat-weighted-uniform';
};

export type PlayEnemyInstance = {
  readonly enemyId: string;
  readonly monsterId: string;
  readonly instance: number;
};

export type PlayMemberBinding = {
  readonly memberId: string;
  readonly characterId: string;
  readonly combatantId: string;
};

export type PlayRawCombatSnapshot = Omit<PlayCombatSnapshot, 'combatants'> & {
  readonly phase: NonNullable<PlayCombatSnapshot['phase']>;
  readonly offeredCount: number;
  readonly combatants: readonly (PlayCombatSnapshot['combatants'][number] & {
    readonly maxHp: number;
    readonly slotsUsed: Readonly<Record<string, number>>;
    readonly conditions: readonly { readonly id: string; readonly remaining: number }[];
  })[];
};

export type PlayTurnControl = {
  readonly round: number;
  readonly turn: number;
  readonly activeId: string;
  readonly turnStarted: boolean;
};

export type PlayEncounter = {
  readonly encounterId: string;
  readonly setup: EncounterSetup;
  readonly selection: PlaySelection;
  readonly entryMembers: PlayMembers;
  readonly memberBindings: readonly PlayMemberBinding[];
  readonly enemyInstances: readonly PlayEnemyInstance[];
  readonly start: PlayStartInputs;
  readonly combat: PlayRawCombatSnapshot;
  readonly positions: Readonly<Record<string, PlayPosition>>;
  readonly terrain: readonly PlayTerrainCell[];
  readonly control: PlayTurnControl;
};

export type PlayRuntimeEvent = {
  readonly type: string;
  readonly at: { readonly round: number; readonly turn: number };
  readonly actor?: string;
  readonly target?: string;
  readonly payload: Readonly<Record<string, PlayJsonValue>>;
  readonly why: { readonly rule: string; readonly rolls: readonly string[] };
};

export type PlayEventSubject = { readonly id: string; readonly name: string; readonly memberId?: string };

export type PlayJournalEntry = {
  readonly sequence: number;
  readonly revision: number;
  readonly event: PlayRuntimeEvent;
  readonly subjects: readonly PlayEventSubject[];
};

export type PlaySettlementReceipt = {
  readonly receiptId: string;
  readonly sessionId: string;
  readonly encounterId: string;
  readonly encounterIndex: number;
  readonly revision: number;
  readonly result: 'victory' | 'defeat' | 'abandoned';
  readonly memberIds: readonly string[];
  readonly sourceHash: string;
  readonly beforeMembersHash: string;
  readonly afterMembersHash: string;
};

export type PlaySessionSnapshot = {
  readonly kind: 'play-session';
  readonly snapshotVersion: 1;
  readonly pack: PlayPackIdentity;
  readonly sessionId: string;
  readonly revision: number;
  readonly seed: string;
  readonly members: PlayMembers;
  readonly encounterIndex: number;
  readonly encounter: PlayEncounter;
  readonly phase: 'active' | 'terminal' | 'settled';
  readonly result: null | ('victory' | 'defeat' | 'abandoned');
  readonly rng: { readonly generation: PlayRngState; readonly play: PlayRngState };
  readonly sequence: number;
  readonly journal: readonly PlayJournalEntry[];
  readonly settlements: readonly PlaySettlementReceipt[];
};

// Structural checks collect located failures before semantic code reads a field.
type Check = (value: unknown, path: string, errors: string[]) => void;
const text: Check = (v, p, e) => {
  if (typeof v !== 'string') e.push(p);
};
const nonempty: Check = (v, p, e) => {
  if (typeof v !== 'string' || v.length === 0) e.push(p);
};
const finite: Check = (v, p, e) => {
  if (typeof v !== 'number' || !Number.isFinite(v)) e.push(p);
};
const integer =
  (min = -Number.MAX_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER): Check =>
  (v, p, e) => {
    if (!Number.isSafeInteger(v) || (v as number) < min || (v as number) > max) e.push(p);
  };
const seed: Check = (v, p, e) => {
  if (typeof v !== 'string') finite(v, p, e);
};
const oneOf =
  (...values: unknown[]): Check =>
  (v, p, e) => {
    if (!values.includes(v)) e.push(p);
  };
const array =
  (check: Check, min = 0, max = Infinity): Check =>
  (v, p, e) => {
    if (!Array.isArray(v)) {
      e.push(p);
      return;
    }
    if (v.length < min || v.length > max) e.push(p);
    v.forEach((item, i) => check(item, `${p}[${i}]`, e));
  };
const record =
  (check: Check): Check =>
  (v, p, e) => {
    if (!isPlayRecord(v)) {
      e.push(p);
      return;
    }
    for (const [key, item] of Object.entries(v)) check(item, `${p}.${key}`, e);
  };
const object =
  (required: Record<string, Check>, optional: Record<string, Check> = {}): Check =>
  (v, p, e) => {
    if (!isPlayRecord(v)) {
      e.push(p);
      return;
    }
    for (const [key, check] of Object.entries(required)) check(v[key], p ? `${p}.${key}` : key, e);
    for (const key of Object.keys(v)) {
      if (Object.hasOwnProperty.call(required, key)) continue;
      const at = p ? `${p}.${key}` : key;
      if (Object.hasOwnProperty.call(optional, key)) optional[key]!(v[key], at, e);
      else e.push(at);
    }
  };
const position = object({ x: integer(), y: integer() });
const terrain = object({ at: position, kind: nonempty });
const layout: Check = (v, p, e) => {
  if (isPlayRecord(v) && v['kind'] === 'theater') object({ kind: oneOf('theater') })(v, p, e);
  else
    object({
      kind: oneOf('spatial'),
      model: oneOf('grid', 'hex'),
      allies: array(position, 1),
      enemies: array(position, 1, 12),
      terrain: array(terrain),
    })(v, p, e);
};
const setup = object({ budget: finite, seed, maxPartySize: integer(1), maxEnemies: integer(1, 12), layout });
const identity = object({ id: text, schemaVersion: integer(1), contentHash: nonempty });
const nullableString: Check = (v, p, e) => {
  if (v !== null) text(v, p, e);
};
const characterState = object(
  {
    name: text,
    race: nonempty,
    classes: array(object({ id: nonempty, level: integer(1, 10) }, { xp: integer(0) }), 1),
    abilities: record(integer()),
    conditions: array(object({ id: nonempty, remaining: integer(0) })),
    inventory: array(object({ id: nonempty, qty: integer(1) })),
    hp: object({ current: integer(), temp: integer(0) }),
    pools: record(integer(0)),
    slots: record(array(nullableString)),
  },
  {
    skills: record(integer(0)),
    feats: array(nonempty),
    knownSpells: array(nonempty),
    equipped: array(object({ slot: nonempty, itemId: nonempty })),
  },
);
const character = object({
  kind: oneOf('character'),
  snapshotVersion: oneOf(1),
  pack: identity,
  state: characterState,
});
const member = object({ memberId: nonempty, character });
const options = object({ sessionId: nonempty, seed, members: array(member, 1), setup });

function isPlayRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)
  );
}

function shapeErrors(pack: Pack, value: unknown, check: Check, path: string): ErrorCard[] {
  const paths: string[] = [];
  check(value, path, paths);
  return [...new Set(paths)].map((at) =>
    makeErrorCard('E-SCHEMA-01', pack.manifest.id, at, 'Invalid or unexpected play-session field.'),
  );
}

/** Validate host setup before assembly, including the RNG rejection-loop bound. */
export function validateEncounterSetup(pack: Pack, value: unknown, path = 'setup'): ErrorCard[] {
  const errors = shapeErrors(pack, value, setup, path);
  if (errors.length) return errors;
  const input = value as EncounterSetup;
  const refuse = (field: string, message: string) =>
    errors.push(makeErrorCard('E-SCHEMA-01', pack.manifest.id, `${path}.${field}`, message));
  if (!(input.budget > 0)) refuse('budget', 'Budget must be finite and positive.');
  const threats = Object.values(pack.bestiary).map((entry) => entry.threat);
  if (threats.some((v) => !Number.isFinite(v) || v <= 0))
    refuse('budget', 'Every assembly threat must be finite and positive.');
  const affordable = threats.filter((v) => v > 0 && v <= input.budget + 1e-9);
  if (!affordable.length) refuse('budget', 'At least one monster must be affordable.');
  else {
    const upper = Math.min(12, Math.floor((input.budget + 1e-9) / Math.min(...affordable)));
    if (upper > input.maxEnemies) refuse('maxEnemies', 'The conservative body bound exceeds maxEnemies.');
    const total = affordable.reduce((sum, threat) => sum + Math.max(1, Math.round(threat * 100)), 0);
    if (!Number.isSafeInteger(total) || total < 1 || total > 4294967296)
      refuse('budget', 'Affordable weight total must fit 1..2^32 before drawing.');
  }
  const map = input.layout;
  if (map.kind === 'theater') {
    if (pack.spatial !== undefined) refuse('layout', 'A spatial pack requires a matching spatial layout.');
  } else {
    if (pack.spatial === undefined || pack.spatial.model !== map.model)
      refuse('layout.model', 'Layout must match the pack spatial model.');
    if (map.allies.length < input.maxPartySize || map.enemies.length < input.maxEnemies)
      refuse('layout', 'Placement capacity must cover both declared caps.');
    const cells = [...map.allies, ...map.enemies].map((p) => JSON.stringify([p.x, p.y]));
    if (new Set(cells).size !== cells.length)
      refuse('layout', 'Spawn positions must be unique across both sides.');
    const terrainCells = new Set<string>();
    map.terrain.forEach((cell, i) => {
      const key = JSON.stringify([cell.at.x, cell.at.y]);
      const kind = pack.spatial?.terrain?.[cell.kind];
      if (!kind) refuse(`layout.terrain[${i}].kind`, 'Unknown terrain kind.');
      if (terrainCells.has(key)) refuse(`layout.terrain[${i}]`, 'Duplicate terrain cell.');
      terrainCells.add(key);
      if (kind && 'blocks' in kind && kind.blocks && cells.includes(key))
        refuse(`layout.terrain[${i}]`, 'A blocking cell cannot hold a spawn.');
    });
  }
  return errors;
}

/** Portable creation boundary; runtime additionally validates builds and derived profiles. */
export function validateEncounterSessionOptions(pack: Pack, value: unknown): ErrorCard[] {
  const errors = shapeErrors(pack, value, options, '');
  if (errors.length) return errors;
  const input = value as EncounterSessionOptions;
  errors.push(...validateEncounterSetup(pack, input.setup));
  if (input.members.length > input.setup.maxPartySize)
    errors.push(makeErrorCard('E-SCHEMA-01', pack.manifest.id, 'members', 'Party exceeds maxPartySize.'));
  const ids = new Set<string>();
  const expected = {
    id: pack.manifest.id,
    schemaVersion: pack.manifest.schemaVersion,
    contentHash: packContentHash(pack),
  };
  input.members.forEach((entry, i) => {
    const path = `members[${i}]`;
    if (ids.has(entry.memberId))
      errors.push(
        makeErrorCard('E-DUP-01', entry.memberId, `${path}.memberId`, 'Duplicate member identity.'),
      );
    ids.add(entry.memberId);
    if (packContentHash(entry.character.pack) !== packContentHash(expected))
      errors.push(
        makeErrorCard(
          'E-SNAP-01',
          entry.memberId,
          `${path}.character.pack`,
          'Character belongs to a different effective pack.',
        ),
      );
    const state = entry.character.state;
    const reference = (id: string, exists: boolean, at: string) => {
      if (!exists)
        errors.push(
          makeErrorCard('E-REF-01', id, `${path}.character.state.${at}`, 'Unknown pack reference.'),
        );
    };
    reference(state.race, !!pack.content.races?.[state.race], 'race');
    state.classes.forEach((c, j) => reference(c.id, !!pack.content.classes?.[c.id], `classes[${j}].id`));
    state.conditions.forEach((c, j) =>
      reference(c.id, !!pack.content.conditions?.[c.id], `conditions[${j}].id`),
    );
    state.inventory.forEach((c, j) => reference(c.id, !!pack.content.items?.[c.id], `inventory[${j}].id`));
    (state.knownSpells ?? []).forEach((id, j) =>
      reference(id, !!pack.content.spells?.[id], `knownSpells[${j}]`),
    );
    (state.feats ?? []).forEach((id, j) => reference(id, !!pack.content.feats?.[id], `feats[${j}]`));
    for (const [level, bindings] of Object.entries(state.slots))
      bindings.forEach((id, j) => {
        if (id !== null)
          reference(
            id,
            !!pack.content.spells?.[id] && String(pack.content.spells[id]!.magic.level) === level,
            `slots.${level}[${j}]`,
          );
      });
  });
  return errors;
}

const rngWords = object({
  a: integer(0, 4294967295),
  b: integer(0, 4294967295),
  c: integer(0, 4294967295),
  d: integer(0, 4294967295),
});
const profile = object(
  {
    id: nonempty,
    abilities: record(finite),
    saves: record(finite),
    level: integer(1),
    hp: integer(),
    ac: finite,
    initiativeBonus: finite,
    actions: array(nonempty),
  },
  {
    maxHp: integer(0),
    speed: finite,
    attackTable: array(object({ level: integer(1), byDefense: record(finite) })),
    attackBonus: finite,
    spells: array(nonempty),
    castBlockedBy: nonempty,
    feats: array(nonempty),
  },
);
const balances = object(
  {},
  {
    pools: record(integer(0)),
    boundSlots: record(integer(0)),
    items: record(integer(0)),
    bindings: record(array(nullableString)),
  },
);
const startEntry = object(
  { id: nonempty, profile, balances },
  { conditions: array(object({ conditionId: nonempty, duration: integer(0) })) },
);
const rawCombat = object(
  {
    kind: oneOf('combat'),
    snapshotVersion: oneOf(1),
    pack: identity,
    pairsWith: nonempty,
    round: integer(1),
    turn: integer(0),
    order: array(nonempty, 1),
    rng: rngWords,
    phase: oneOf('awaiting-declare', 'resolved', 'awaiting-trigger-response', 'combat-over'),
    offeredCount: integer(0),
    combatants: array(
      object(
        {
          id: nonempty,
          hp: integer(),
          maxHp: integer(0),
          slotsUsed: record(integer(0)),
          conditions: array(object({ id: nonempty, remaining: integer(0) })),
        },
        {
          position,
          pendingTrigger: nullableString,
          itemsUsed: record(integer(0)),
          poolsSpent: record(integer(0)),
          slotsCast: record(array(integer(0))),
          pendingMove: object({ actionId: nonempty, to: position, remaining: finite }),
        },
      ),
      1,
    ),
  },
  {
    offers: array(object({ actorId: nonempty, source: oneOf('action', 'feat'), id: nonempty, on: nonempty })),
  },
);
const jsonValue: Check = (v, p, e) => {
  if (v === null || typeof v === 'boolean' || typeof v === 'string') return;
  if (typeof v === 'number') return finite(v, p, e);
  if (Array.isArray(v)) return array(jsonValue)(v, p, e);
  record(jsonValue)(v, p, e);
};
const clock = object({ round: integer(0), turn: integer(0) });
const event = object(
  {
    type: nonempty,
    at: clock,
    payload: record(jsonValue),
    why: object({ rule: nonempty, rolls: array(text) }),
  },
  { actor: nonempty, target: nonempty },
);
const receipt = object({
  receiptId: nonempty,
  sessionId: nonempty,
  encounterId: nonempty,
  encounterIndex: integer(0),
  revision: integer(0),
  result: oneOf('victory', 'defeat', 'abandoned'),
  memberIds: array(nonempty, 1),
  sourceHash: nonempty,
  beforeMembersHash: nonempty,
  afterMembersHash: nonempty,
});
const snapshot = object({
  kind: oneOf('play-session'),
  snapshotVersion: oneOf(1),
  pack: identity,
  sessionId: nonempty,
  revision: integer(0),
  seed: text,
  members: array(member, 1),
  encounterIndex: integer(0),
  encounter: object({
    encounterId: nonempty,
    setup,
    selection: object({
      groups: array(object({ id: nonempty, count: integer(1, 12) }), 1),
      threat: finite,
      budget: finite,
      seedUsed: text,
      heuristic: oneOf('threat-weighted-uniform'),
    }),
    entryMembers: array(member, 1),
    memberBindings: array(object({ memberId: nonempty, characterId: nonempty, combatantId: nonempty }), 1),
    enemyInstances: array(object({ enemyId: nonempty, monsterId: nonempty, instance: integer(1) }), 1, 12),
    start: object({
      allies: array(startEntry, 1),
      enemies: array(startEntry, 1, 12),
      positions: record(position),
      terrain: array(terrain),
    }),
    combat: rawCombat,
    positions: record(position),
    terrain: array(terrain),
    control: object({
      round: integer(1),
      turn: integer(0),
      activeId: nonempty,
      turnStarted: oneOf(true, false),
    }),
  }),
  phase: oneOf('active', 'terminal', 'settled'),
  result: oneOf(null, 'victory', 'defeat', 'abandoned'),
  rng: object({ generation: rngWords, play: rngWords }),
  sequence: integer(0),
  journal: array(
    object({
      sequence: integer(1),
      revision: integer(0),
      event,
      subjects: array(object({ id: nonempty, name: text }, { memberId: nonempty })),
    }),
  ),
  settlements: array(receipt),
});

/** Validate the complete portable shape before runtime reconstruction. */
export function validatePlaySessionSnapshot(pack: Pack, value: unknown): ErrorCard[] {
  const errors = shapeErrors(pack, value, snapshot, '').map((card) => ({
    ...card,
    rule: card.jsonPath === 'snapshotVersion' ? 'E-SNAP-02' : 'E-SNAP-01',
  }));
  if (errors.length) return errors;
  const input = value as PlaySessionSnapshot;
  errors.push(
    ...validateEncounterSessionOptions(pack, {
      sessionId: input.sessionId,
      seed: input.seed,
      members: input.members,
      setup: input.encounter.setup,
    }),
  );
  errors.push(
    ...validateEncounterSessionOptions(pack, {
      sessionId: input.sessionId,
      seed: input.seed,
      members: input.encounter.entryMembers,
      setup: input.encounter.setup,
    }),
  );
  return errors;
}
