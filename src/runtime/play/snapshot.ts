import type { Pack } from '../../schema/pack';
import type {
  PlayEncounter,
  PlayMembers,
  PlayRawCombatSnapshot,
  PlaySessionSnapshot,
} from '../../schema/play-session';
import { validatePlaySessionSnapshot } from '../../schema/play-session';
import { Runtime } from '../runtime';
import { RuntimeRuleError, ruleCard } from '../errors';
import { serializeCombat, deserializeCombat } from '../snapshots/combat';
import { isRecord, packIdentity } from '../snapshots/envelope';
import type { Combat } from '../combat/combat';

export function detached<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
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
  const runtime = new Runtime(detached(pack));
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
  requireSnapshot(
    saved.phase !== 'settled',
    'phase',
    'Settlement restore is not available until the settlement boundary is implemented.',
  );
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
