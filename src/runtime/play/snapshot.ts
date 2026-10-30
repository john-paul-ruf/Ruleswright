import type { Pack } from '../../schema/pack';
import type {
  PlayEncounter,
  PlayEventSubject,
  PlayMembers,
  PlayRawCombatSnapshot,
  PlaySessionSnapshot,
} from '../../schema/play-session';
import { packContentHash } from '../../schema/version';
import { validatePlaySessionSnapshot } from '../../schema/play-session';
import { Runtime } from '../runtime';
import { RuntimeRuleError, ruleCard } from '../errors';
import { serializeCombat, deserializeCombat } from '../snapshots/combat';
import { isRecord, packIdentity } from '../snapshots/envelope';
import { settleEncounter } from './settlement';
import { moveBudgetAst, type Combat } from '../combat/combat';
import { restoreCharacter } from '../snapshots/character';
import { poolVocabulary } from '../pools';
import { profileFromCharacter } from '../character-profile';
import { spawnEncounter } from '../encounter';
import { resolveSlotGrants } from '../combat/action-economy';
import { frozenJsonCopy, markJsonClean } from '../../schema/json-memo';

export function detached<T>(value: T): T {
  return markJsonClean(JSON.parse(JSON.stringify(value)) as T);
}
export function same(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((v, i) => same(v, b[i]));
  if (isRecord(a) && isRecord(b)) {
    const keys = Object.keys(a);
    return (
      keys.length === Object.keys(b).length &&
      keys.every((key) => Object.hasOwnProperty.call(b, key) && same(a[key], b[key]))
    );
  }
  return false;
}
export function requireSnapshot(ok: boolean, path: string, message: string): void {
  if (!ok) throw new RuntimeRuleError([ruleCard('E-SNAP-01', '(play-session)', path, message)]);
}

export function freezeFight(
  fight: Combat,
  encounterId: string,
  turnStarted: boolean,
): Pick<PlayEncounter, 'combat' | 'positions' | 'terrain' | 'control'> {
  const { round, turn, active, combatants, terrain } = fight.state;
  return {
    combat: serializeCombat(fight, { pairsWith: encounterId }) as PlayRawCombatSnapshot,
    positions: Object.fromEntries(
      Object.values(combatants).flatMap((c) => (c.position ? [[c.id, { ...c.position }]] : [])),
    ),
    terrain: detached(terrain),
    control: { round, turn, activeId: active, turnStarted },
  };
}

export function hydrateFight(pack: Pack, saved: PlaySessionSnapshot) {
  const runtime = new Runtime(frozenJsonCopy(pack));
  const encounter = saved.encounter;
  const fight = deserializeCombat(runtime, encounter.combat, {
    ...encounter.start,
    positions: encounter.positions,
    terrain: encounter.terrain,
  });
  return { runtime, fight };
}

export function projectMembers(saved: PlaySessionSnapshot): PlayMembers {
  if (saved.phase === 'settled') return detached(saved.members);
  return saved.encounter.entryMembers.map((member) => {
    const raw = saved.encounter.combat.combatants.find((c) => c.id === `m:${member.memberId}`)!;
    const state = member.character.state;
    return {
      ...member,
      character: {
        ...member.character,
        state: {
          ...state,
          hp: { current: raw.hp, temp: state.hp.temp },
          conditions: raw.conditions.map((c) => ({ id: c.id, remaining: c.remaining })),
          inventory: state.inventory
            .map((item) => ({ ...item, qty: item.qty - (raw.itemsUsed?.[item.id] ?? 0) }))
            .filter((item) => item.qty > 0),
          pools: Object.fromEntries(
            Object.entries(state.pools).map(([id, amount]) => [id, amount - (raw.poolsSpent?.[id] ?? 0)]),
          ),
          slots: Object.fromEntries(
            Object.entries(state.slots).map(([level, bindings]) => [
              level,
              bindings.map((spell, i) => (raw.slotsCast?.[level]?.includes(i) ? null : spell)),
            ]),
          ),
        },
      },
    };
  });
}

export function readSnapshot(pack: Pack, input: unknown): PlaySessionSnapshot {
  const errors = validatePlaySessionSnapshot(pack, input);
  if (errors.length) throw new RuntimeRuleError(errors);
  const saved = detached(input as PlaySessionSnapshot);
  const e = saved.encounter;
  requireSnapshot(
    same(saved.pack, packIdentity(pack)) && same(e.combat.pack, saved.pack),
    'pack',
    'Pack identity differs.',
  );
  requireSnapshot(
    e.encounterId === JSON.stringify([saved.sessionId, saved.encounterIndex]) &&
      e.combat.pairsWith === e.encounterId,
    'encounter.encounterId',
    'Encounter pairing differs.',
  );
  requireSnapshot(
    same(e.terrain, e.start.terrain),
    'encounter.terrain',
    'Terrain differs from the original start.',
  );
  requireSnapshot(
    e.control.round === e.combat.round &&
      e.control.turn === e.combat.turn &&
      e.control.activeId === e.combat.order[e.combat.turn],
    'encounter.control',
    'Turn control differs from raw combat.',
  );
  validateEncounterFacts(pack, saved);
  validateJournal(pack, saved);
  if (saved.phase === 'settled') {
    const receipt = saved.settlements.find((r) => r.encounterId === e.encounterId);
    requireSnapshot(
      receipt !== undefined && saved.result !== null,
      'settlements',
      'Current settlement receipt is missing.',
    );
    const staged = settleEncounter(pack, saved, saved.result!, receipt!.revision);
    requireSnapshot(
      same(staged.receipt, receipt) && same(staged.members, saved.members),
      'settlements',
      'Settlement receipt or member projection differs.',
    );
  } else
    requireSnapshot(
      same(saved.members, e.entryMembers),
      'members',
      'Unsettled members differ from encounter baseline.',
    );
  const { fight } = hydrateFight(pack, saved);
  requireSnapshot(
    same(freezeFight(fight, e.encounterId, e.control.turnStarted).combat, e.combat),
    'encounter.combat',
    'Combat does not round trip.',
  );
  return saved;
}

function validateEncounterFacts(pack: Pack, saved: PlaySessionSnapshot): void {
  const e = saved.encounter,
    raw = e.combat;
  const memberIds = saved.members.map((m) => m.memberId);
  requireSnapshot(
    same(
      memberIds,
      e.entryMembers.map((m) => m.memberId),
    ) &&
      same(
        memberIds,
        e.memberBindings.map((b) => b.memberId),
      ),
    'encounter.memberBindings',
    'Ordered member sets differ.',
  );
  requireSnapshot(
    new Set(e.memberBindings.map((b) => b.characterId)).size === memberIds.length &&
      e.memberBindings.every((b) => b.combatantId === `m:${b.memberId}`),
    'encounter.memberBindings',
    'Original character ids must be unique and combatant ids stable.',
  );
  const runtime = new Runtime(frozenJsonCopy(pack));
  const pools = poolVocabulary(runtime);
  for (const [i, member] of e.entryMembers.entries())
    requireSnapshot(
      Object.keys(member.character.state.pools).every((pool) => pools.includes(pool)),
      `encounter.entryMembers[${i}].character.state.pools`,
      'Unknown original pool.',
    );
  const allies = e.entryMembers.map((member) => ({
    id: `m:${member.memberId}`,
    ...profileFromCharacter(runtime, restoreCharacter(runtime, member.character), `m:${member.memberId}`),
  }));
  requireSnapshot(
    same(detached(allies), e.start.allies),
    'encounter.start.allies',
    'Original profiles, conditions or balances differ from entry members.',
  );
  const groups = e.selection.groups;
  let count = 0,
    threat = 0;
  for (const [i, group] of groups.entries()) {
    const monster = pack.bestiary[group.id];
    requireSnapshot(
      monster !== undefined && (i === 0 || groups[i - 1]!.id < group.id),
      'encounter.selection.groups',
      'Selection must contain unique sorted declared monsters.',
    );
    count += group.count;
    threat += monster!.threat * group.count;
  }
  requireSnapshot(
    count <= e.setup.maxEnemies &&
      Math.abs(threat - e.selection.threat) <= 1e-9 &&
      threat <= e.setup.budget + 1e-9 &&
      e.selection.budget === e.setup.budget &&
      e.selection.seedUsed === String(e.setup.seed),
    'encounter.selection',
    'Selection budget, threat, capacity or seed differs.',
  );
  const instances = groups
    .flatMap((group) =>
      Array.from({ length: group.count }, (_, i) => ({ monsterId: group.id, instance: i + 1 })),
    )
    .map((entry, i) => ({ ...entry, enemyId: `e:${saved.encounterIndex}:${i + 1}` }));
  requireSnapshot(
    same(instances, e.enemyInstances),
    'encounter.enemyInstances',
    'Enemy instances differ from selection.',
  );
  const enemies = spawnEncounter(runtime, e.selection).map((profile, i) => ({
    id: instances[i]!.enemyId,
    profile: { ...profile, id: instances[i]!.enemyId },
    balances: {},
  }));
  requireSnapshot(
    same(detached(enemies), e.start.enemies),
    'encounter.start.enemies',
    'Enemy start profiles differ from actual statblocks.',
  );
  const ids = [...allies, ...enemies].map((c) => c.id);
  requireSnapshot(
    raw.order.length === ids.length &&
      new Set(raw.order).size === ids.length &&
      raw.order.every((id) => ids.includes(id)) &&
      same(
        raw.order,
        raw.combatants.map((c) => c.id),
      ),
    'encounter.combat.order',
    'Raw combat ids/order do not exactly cover the original sides.',
  );
  const positions = Object.fromEntries(
    ids.flatMap((id, i) =>
      e.setup.layout.kind === 'theater'
        ? []
        : [[id, i < allies.length ? e.setup.layout.allies[i]! : e.setup.layout.enemies[i - allies.length]!]],
    ),
  );
  requireSnapshot(
    same(positions, e.start.positions) &&
      same(e.start.terrain, e.setup.layout.kind === 'theater' ? [] : e.setup.layout.terrain),
    'encounter.start.positions',
    'Original geometry differs from host setup.',
  );
  requireSnapshot(
    same(
      e.positions,
      Object.fromEntries(raw.combatants.flatMap((c) => (c.position ? [[c.id, c.position]] : []))),
    ),
    'encounter.positions',
    'Current positions differ from raw combat.',
  );
  requireSnapshot(
    e.setup.layout.kind === 'theater'
      ? Object.keys(e.positions).length === 0
      : Object.keys(e.positions).length === ids.length,
    'encounter.positions',
    'Current geometry does not cover the combatants.',
  );
  const grants = resolveSlotGrants(pack).slots;
  for (const [index, c] of raw.combatants.entries()) {
    const start = [...e.start.allies, ...e.start.enemies].find((entry) => entry.id === c.id)!;
    const at = `encounter.combat.combatants[${index}]`;
    requireSnapshot(
      c.maxHp === (start.profile.maxHp ?? Math.max(0, start.profile.hp)),
      `${at}.maxHp`,
      'Original heal cap differs.',
    );
    requireSnapshot(
      c.conditions.every((condition) => pack.content.conditions?.[condition.id] !== undefined),
      `${at}.conditions`,
      'Unknown condition.',
    );
    requireSnapshot(
      same(Object.keys(c.slotsUsed).sort(), Object.keys(grants).sort()) &&
        Object.entries(c.slotsUsed).every(([slot, amount]) => amount <= grants[slot]!),
      `${at}.slotsUsed`,
      'Turn slots exceed or differ from pack grants.',
    );
    for (const [field, balance] of [
      ['itemsUsed', start.balances.items ?? {}],
      ['poolsSpent', start.balances.pools ?? {}],
    ] as const) {
      requireSnapshot(
        Object.entries(c[field] ?? {}).every(
          ([id, amount]) => Object.hasOwnProperty.call(balance, id) && amount <= balance[id]!,
        ),
        `${at}.${field}`,
        'Spend exceeds the original balance or names an unknown resource.',
      );
    }
    for (const [level, indices] of Object.entries(c.slotsCast ?? {})) {
      const bindings = start.balances.bindings?.[level];
      requireSnapshot(
        bindings !== undefined &&
          new Set(indices).size === indices.length &&
          indices.every((i) => bindings[i] != null),
        `${at}.slotsCast.${level}`,
        'Cast indices must name distinct original bound slots.',
      );
    }
    if (c.pendingMove)
      requireSnapshot(
        c.id === e.control.activeId &&
          moveBudgetAst(runtime, c.pendingMove.actionId) !== undefined &&
          c.pendingMove.remaining >= 0 &&
          e.control.turnStarted &&
          (raw.offers?.length ?? 0) > 0,
        `${at}.pendingMove`,
        'Paused movement has no active mover or unanswered offer.',
      );
  }
  const down = (side: readonly { id: string }[]) =>
    side.every((entry) => raw.combatants.find((c) => c.id === entry.id)!.hp <= 0);
  const result = down(allies) ? 'defeat' : down(enemies) ? 'victory' : null;
  requireSnapshot(
    (raw.phase === 'combat-over') === (result !== null),
    'encounter.combat.phase',
    'Combat phase contradicts standing sides.',
  );
  requireSnapshot(
    saved.phase === 'active'
      ? saved.result === null && result === null
      : saved.phase === 'terminal'
        ? saved.result === result && result !== null
        : saved.result === 'abandoned'
          ? result === null
          : saved.result === result && result !== null,
    'phase',
    'Session phase/result contradicts the actual fight.',
  );
  requireSnapshot(
    (raw.offers?.length ?? 0) <= raw.offeredCount &&
      ((raw.offers?.length ?? 0) === 0 || e.control.turnStarted),
    'encounter.combat.offers',
    'Offer count or turn control is inconsistent.',
  );
  for (const [i, offer] of (raw.offers ?? []).entries()) {
    const definition = offer.source === 'action' ? pack.actions[offer.id] : pack.content.feats?.[offer.id];
    requireSnapshot(
      definition?.trigger?.on.split('[')[0] === offer.on,
      `encounter.combat.offers[${i}].on`,
      'Offer provenance differs from its trigger.',
    );
  }
  let previousIndex = -1,
    previousRevision = -1;
  for (const [i, receipt] of saved.settlements.entries()) {
    const expectedId = JSON.stringify([saved.sessionId, receipt.encounterIndex]);
    requireSnapshot(
      receipt.sessionId === saved.sessionId &&
        receipt.encounterId === expectedId &&
        receipt.receiptId === JSON.stringify([saved.sessionId, expectedId, 'settlement']) &&
        receipt.encounterIndex > previousIndex &&
        receipt.encounterIndex <= saved.encounterIndex &&
        receipt.revision > previousRevision &&
        receipt.revision <= saved.revision &&
        same(receipt.memberIds, memberIds) &&
        [receipt.sourceHash, receipt.beforeMembersHash, receipt.afterMembersHash].every((hash) =>
          /^[0-9a-f]{8}$/.test(hash),
        ),
      `settlements[${i}]`,
      'Receipt identity, order, members, revision or hashes are inconsistent.',
    );
    requireSnapshot(
      receipt.encounterIndex < saved.encounterIndex
        ? receipt.result === 'victory'
        : saved.phase === 'settled' && receipt.result === saved.result,
      `settlements[${i}].result`,
      'Only settled victory permits a later encounter.',
    );
    if (i > 0)
      requireSnapshot(
        saved.settlements[i - 1]!.afterMembersHash === receipt.beforeMembersHash,
        `settlements[${i}].beforeMembersHash`,
        'Receipt member hashes do not form a continuation.',
      );
    if (receipt.encounterIndex === saved.encounterIndex)
      requireSnapshot(
        receipt.revision === saved.revision,
        `settlements[${i}].revision`,
        'Current receipt must match the settled revision.',
      );
    if (receipt.encounterIndex === saved.encounterIndex - 1)
      requireSnapshot(
        receipt.afterMembersHash === packContentHash(e.entryMembers),
        `settlements[${i}].afterMembersHash`,
        'Current entry party differs from the previous settlement.',
      );
    previousIndex = receipt.encounterIndex;
    previousRevision = receipt.revision;
  }
  requireSnapshot(
    saved.settlements.length === saved.encounterIndex + (saved.phase === 'settled' ? 1 : 0),
    'settlements',
    'Every prior encounter must have exactly one receipt.',
  );
}

function validateJournal(pack: Pack, saved: PlaySessionSnapshot): void {
  requireSnapshot(
    saved.sequence === saved.journal.length,
    'sequence',
    'Journal cursor differs from its contiguous entries.',
  );
  const subjects = new Map<string, PlayEventSubject>(
    saved.members.map((m) => [
      `m:${m.memberId}`,
      { id: `m:${m.memberId}`, name: m.character.state.name, memberId: m.memberId },
    ]),
  );
  for (const enemy of saved.encounter.enemyInstances)
    subjects.set(enemy.enemyId, { id: enemy.enemyId, name: pack.bestiary[enemy.monsterId]!.name });
  let revision = 0,
    started = false,
    encounterIndex = -1;
  for (const [i, entry] of saved.journal.entries()) {
    const at = `journal[${i}]`;
    requireSnapshot(
      entry.sequence === i + 1 && entry.revision >= revision && entry.revision <= saved.revision,
      at,
      'Journal sequence or revision is inconsistent.',
    );
    revision = entry.revision;
    if (entry.event.type === 'combat:start') {
      encounterIndex++;
      started = false;
    }
    if (entry.event.type === 'turn:began') started = true;
    if (entry.event.type === 'turn:ended' || entry.event.type === 'round:completed') started = false;
    const referenced = new Set<string>();
    const visit = (value: unknown): void => {
      if (typeof value === 'string') referenced.add(value);
      else if (Array.isArray(value)) value.forEach(visit);
      else if (isRecord(value)) Object.values(value).forEach(visit);
    };
    visit(entry.event);
    requireSnapshot(
      new Set(entry.subjects.map((subject) => subject.id)).size === entry.subjects.length,
      `${at}.subjects`,
      'Duplicate journal subjects.',
    );
    for (const subject of entry.subjects) {
      if (subject.id.startsWith('e:'))
        requireSnapshot(
          subject.id.split(':')[1] === String(encounterIndex),
          `${at}.subjects`,
          'Enemy subject belongs to a different encounter.',
        );
      const known = subjects.get(subject.id);
      if (known) requireSnapshot(same(known, subject), `${at}.subjects`, 'Subject identity or name differs.');
      else {
        const match = /^e:(0|[1-9]\d*):([1-9]\d*)$/.exec(subject.id);
        requireSnapshot(
          match !== null &&
            Number(match[1]) <= saved.encounterIndex &&
            Number(match[1]) === encounterIndex &&
            Number(match[2]) <= 12 &&
            subject.memberId === undefined &&
            Object.values(pack.bestiary).some((monster) => monster.name === subject.name),
          `${at}.subjects`,
          'Unknown event-time subject.',
        );
        subjects.set(subject.id, subject);
      }
      requireSnapshot(
        referenced.has(subject.id),
        `${at}.subjects`,
        'Subject is not referenced by this event.',
      );
    }
    for (const id of [entry.event.actor, entry.event.target])
      if (id !== undefined)
        requireSnapshot(
          entry.subjects.some((subject) => subject.id === id),
          `${at}.subjects`,
          'Actor/target is missing its event-time subject.',
        );
    for (const id of referenced)
      if (subjects.has(id))
        requireSnapshot(
          entry.subjects.some((subject) => subject.id === id),
          `${at}.subjects`,
          'Referenced subject is missing.',
        );
  }
  requireSnapshot(
    encounterIndex === saved.encounterIndex && started === saved.encounter.control.turnStarted,
    'encounter.control',
    'Journal turn lifecycle differs from the saved control.',
  );
}
