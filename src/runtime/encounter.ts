/**
 * Threat-budget encounter assembly (FR-16): budget + party → statblock
 * selection, deterministic per seed. The heuristic is documented, not sacred
 * (bestiary-encounters.html) — hosts may override or bypass it entirely.
 *
 * THE HEURISTIC (documented per FR-16):
 *  1. Menu = the pack's bestiary, sorted by id; each entry weighted by threat.
 *  2. While budget remains: draw one monster uniformly over total threat
 *     (all-integer arithmetic over threat×10 — threats may be fractional like
 *     the classic 1.5), using the seeded RNG (FR-1: same seed ⇒ same picks).
 *  3. Stop when the highest-threat affordable pick exceeds the remainder, or
 *     when the encounter already holds 12 bodies (bounded work — the same
 *     discipline as the DSL's depth bounds).
 *  4. Bypass: hosts that want exactly their own monsters call `startCombat`
 *     directly — `assembleEncounter` is a convenience, never a gate.
 */
import type { Runtime } from './runtime';
import { bestiaryIds } from './bestiary';
import type { CombatantProfile } from './combat/resolve';
import { spawnMonster } from './bestiary';
import { Rng, type RandomSource } from '../core/rng';

export interface AssembleEncounterRequest {
  readonly budget: number;
  /** Party size scales nothing mechanically (FR-16 leaves pacing to hosts) but is the documented input. */
  readonly party?: readonly unknown[];
  readonly seed?: number | string;
  /** A host-injected stream replaces the seed-derived one (FR-1 injection). */
  readonly rng?: RandomSource;
}

/** One assembled group: monster id, instance count, and the spent budget. */
export interface AssembledGroup {
  readonly id: string;
  readonly count: number;
}

export interface Encounter {
  readonly groups: readonly AssembledGroup[];
  readonly threat: number;
  readonly budget: number;
  readonly seedUsed: string;
  /** The documented heuristic's name — hosts reading the output know what ruled. */
  readonly heuristic: 'threat-weighted-uniform';
}

const MAX_ENCOUNTER_BODIES = 12;

/** FR-16: deterministic per seed; hosts may bypass via startCombat. */
export function assembleEncounter(runtime: Runtime, request: AssembleEncounterRequest): Encounter {
  const menu = bestiaryIds(runtime);
  if (menu.length === 0) {
    throw new Error('encounter assembly needs at least one bestiary statblock (FR-16).');
  }
  const key = request.seed === undefined ? 'encounter' : String(request.seed);
  const rng = request.rng ?? new Rng(key);
  const threatOf = (id: string): number => runtime.pack.bestiary[id]!.threat;

  let remaining = request.budget;
  const counts = new Map<string, number>();
  let bodies = 0;
  while (remaining > 0 && bodies < MAX_ENCOUNTER_BODIES) {
    // Affordable menu, ascending by threat — the greedy core of the documented heuristic.
    const affordable = menu.filter((id) => threatOf(id) <= remaining + 1e-9);
    if (affordable.length === 0) break;
    // Weighted draw over threat ×100 (integer arithmetic, determinism discipline).
    const weights = affordable.map((id) => Math.max(1, Math.round(threatOf(id) * 100)));
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    let draw = rng.int(total);
    let chosen = affordable[affordable.length - 1]!;
    for (const [index, weight] of weights.entries()) {
      draw -= weight;
      if (draw < 0) {
        chosen = affordable[index]!;
        break;
      }
    }
    counts.set(chosen, (counts.get(chosen) ?? 0) + 1);
    remaining -= threatOf(chosen);
    bodies += 1;
  }

  const groups: AssembledGroup[] = [...counts.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([id, count]) => ({ id, count }));
  const threat = request.budget - remaining;
  return { groups, threat, budget: request.budget, seedUsed: key, heuristic: 'threat-weighted-uniform' };
}

/** Spawn every member of an assembled encounter as same-machinery combatants (FR-16). */
export function spawnEncounter(runtime: Runtime, encounter: Encounter): readonly CombatantProfile[] {
  const combatants: CombatantProfile[] = [];
  for (const group of encounter.groups) {
    for (let index = 1; index <= group.count; index += 1) {
      const instanceId = group.count === 1 ? group.id : `${group.id}-${index}`;
      combatants.push(spawnMonster(runtime, group.id, instanceId));
    }
  }
  return combatants;
}
