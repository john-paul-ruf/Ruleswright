/**
 * M03 — plain-JSON character state (FR-5/FR-14) and its factory. Every field
 * is serializable data: no class instances, no closures, no hidden state.
 * Derived stats resolve exclusively through the pack's reserved formula ids
 * (`hp`/`ac`, CA-6) — never hardcoded math. Illegal-build rejection and the
 * progression paths land in progression.ts (checkpoint 2); pools/slots
 * vocabulary and conditions in pools.ts/conditions.ts (checkpoint 3).
 */
import { evalFormula, valueOfFormula } from '../core/dsl/formula';
import { Rng } from '../core/rng';
import type { CharacterCreateRequest, Runtime } from './runtime';

/** FR-7 — one active condition on a character: plain data, duration in rounds. */
export interface ActiveCondition {
  readonly conditionId: string;
  /** Rounds remaining; the pack's duration is the initial value. */
  readonly duration: number;
}

/** Plain-JSON character state (FR-5/FR-14). */
export interface CharacterState {
  readonly id: string;
  readonly name: string;
  readonly race: string;
  readonly level: number;
  readonly xp: number;
  readonly classes: readonly string[];
  /** Ability name → value, defaulted from the pack (FR-5). */
  readonly abilities: Readonly<Record<string, number>>;
  /** Save name → value, from progression tables (FR-6; filled by progression.ts). */
  readonly saves: Readonly<Record<string, number>>;
  /** Pack-declared pool ids → current points (FR-8; vocabulary from pools.ts). */
  readonly pools: Readonly<Record<string, number>>;
  /** Slot level ("1") → bound slot refs — null = empty, string = bound spell id (FR-8). */
  readonly slots: Readonly<Record<string, readonly (string | null)[]>>;
  readonly conditions: readonly ActiveCondition[];
  readonly spells: readonly string[];
  /** HP bookkeeping: the reserved formula's value is the cap; `current` starts at it. */
  hp: { current: number; temp: number };
}

/**
 * FR-5 — build a character from the pack: abilities default to 10 per
 * `stats.abilities`, hp initializes from the reserved formula (CA-6), and the
 * creation emits `character:created` (CA-3 named non-combat event).
 */
export function createCharacter(runtime: Runtime, request: CharacterCreateRequest): CharacterState {
  const level = request.level ?? 1;
  const rng = request.rng ?? new Rng(0);
  const abilities: Record<string, number> = {};
  for (const ability of runtime.pack.stats.abilities) abilities[ability] = 10;

  const hp = reserveValue(runtime, 'hp', abilities, level, rng);
  const id = `char-${runtime.nextCharacterId}`;
  runtime.nextCharacterId += 1;

  const state: CharacterState = {
    id,
    name: request.name,
    race: request.race,
    level,
    xp: 0,
    classes: [...request.classes],
    abilities,
    saves: {},
    pools: {},
    slots: {},
    conditions: [],
    spells: [],
    hp: { current: hp, temp: 0 },
  };

  runtime.events.emit({
    type: 'character:created',
    actor: state.id,
    payload: { id: state.id, name: state.name, race: state.race, classes: [...state.classes], level },
    why: { rule: `content.races.${state.race}`, rolls: [] },
  });
  return state;
}

/**
 * CA-6 — the only door to a derived stat: resolve the pack's reserved formula
 * id against the character's scalars (abilities + level). The load-time
 * recheck in Runtime guarantees the id exists.
 */
export function reserveValue(runtime: Runtime, reservedId: 'hp' | 'ac', abilities: Readonly<Record<string, number>>, level: number, rng: Rng): number {
  const ast = runtime.index.formulaAsts[reservedId];
  if (ast === undefined) {
    throw new Error(`reserved formula "${reservedId}" missing at play time — Runtime load should have rejected the pack (E-REF-01)`);
  }
  return valueOfFormula(evalFormula(ast, { ...abilities, level }, rng));
}