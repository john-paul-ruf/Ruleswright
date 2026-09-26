/**
 * The bestiary facade (FR-16): monsters are pack statblocks built from the
 * SAME character machinery — abilities (with overrides), saves (with
 * overrides), the referenced attack table, and the shared action list. There
 * is no second combatant code path: `spawnMonster` produces a
 * `CombatantProfile` that `startCombat` treats exactly like a character-side
 * profile (bestiary-encounters.html: "it fights in the same loop, emits the
 * same events, and snapshots the same way").
 */
import type { Runtime } from './runtime';
import { profileFromStatblock, type CombatantProfile } from './combat/resolve';

/** api-map: rt.spawnMonster(id) → a same-machinery combatant. */
export function spawnMonster(runtime: Runtime, id: string, instanceId = id): CombatantProfile {
  const block = runtime.pack.bestiary[id];
  if (block === undefined) {
    throw new Error(`bestiary has no statblock "${id}" — FR-16 spawns only declared monsters (E-REF-01 territory).`);
  }
  return profileFromStatblock(runtime.pack, block, instanceId);
}

/** Every statblock id in the pack, sorted — the encounter assembler's menu. */
export function bestiaryIds(runtime: Runtime): readonly string[] {
  return Object.keys(runtime.pack.bestiary).sort();
}