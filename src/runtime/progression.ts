/**
 * M03 — progression (FR-6): level-set and XP paths that validate identically,
 * multi-class contribution, race caps. Leveling reads entirely from pack
 * tables — the engine has no opinion on their shape:
 *
 * - Class levels come either directly (`createCharacter`/`levelSet`, no XP
 *   simulation) or from XP: the pack may declare `tables.xp` as a ranged
 *   table whose value is the class level for a per-class XP amount; absent
 *   that table the engine's documented fallback is 1000 XP per level
 *   (level = floor(xp / 1000) + 1). The engine never decides awards — hosts
 *   grant XP, the engine reports it (FR-6, FR-13).
 * - XP split across concurrent classes is even (integer division, remainder
 *   to the first class) — the documented v1 default; the schema declares no
 *   split-policy field, so a richer policy is an Author schema event.
 * - Saves are the best value across the character's classes at their levels;
 *   vancian slot counts add across classes (progression.html).
 * - Both paths run the same build validator: a level-N direct set and a
 *   level-N earned set produce identical progression state (FR-5, FR-14).
 * - Feat slots (v1.8, DD-F6): in a feat-slotted pack, a level change that
 *   would leave the held feats over the slots is refused before anything
 *   changes — `levelSet` through the build validator, `awardXp` by computing
 *   its levels before applying them.
 * - XP never lowers a level (v1.9, DD-R4): a level set directly stays until
 *   its XP passes it.
 *
 * Illegal builds throw `CharacterBuildError` carrying ErrorCards with the
 * violated rule named (FR-5): unknown-race, unknown-class, duplicate-class,
 * invalid-level, missing-progression, race-cap-exceeded, feat-slots-exceeded.
 */
import type { ErrorCard } from '../schema/error-card';
import type { ClassEntry } from './character';
import type { CharacterState, Runtime } from './runtime';
import type { RuntimeEvent } from './events';
import { reserveValue } from './character';
import { featSlotTally, featSlotsExceeded } from './feats';
import { initPools } from './pools';
import { Rng } from '../core/rng';

/** Aggregate illegal-build rejection — carries the full ErrorCard list (all-at-once discipline). */
export class CharacterBuildError extends Error {
  readonly errors: readonly ErrorCard[];

  constructor(errors: readonly ErrorCard[]) {
    super(
      `character build rejected with ${errors.length} error card(s) — first: ${errors[0]?.rule} ${errors[0]?.message}`,
    );
    this.name = 'CharacterBuildError';
    this.errors = errors;
  }
}

/**
 * The shared build validator (FR-5/FR-6): every path — direct level-set and
 * earned XP — passes through this before state changes. All cards at once,
 * never partial. `heldFeats` (v1.8, DD-F6) adds `feat-slots-exceeded` when the
 * pack is feat-slotted, the build is otherwise clean, and the held feats
 * outnumber the build's feat slots; omitted, no feat check runs.
 */
export function validateBuild(
  runtime: Runtime,
  race: string,
  entries: readonly ClassEntry[],
  heldFeats: readonly string[] = [],
): ErrorCard[] {
  const cards: ErrorCard[] = [];
  const races = runtime.pack.content.races ?? {};
  if (races[race] === undefined) {
    cards.push({
      severity: 'error',
      artifactId: race,
      jsonPath: 'race',
      rule: 'unknown-race',
      message: `unknown race "${race}" — not declared in content.races.`,
      hint: `known races: ${Object.keys(races).join(', ') || '(none)'}`,
    });
  }
  if (entries.length === 0) {
    cards.push({
      severity: 'error',
      artifactId: '(character)',
      jsonPath: 'classes',
      rule: 'invalid-build',
      message: 'a character needs at least one class.',
    });
  }
  const seen = new Set<string>();
  for (const [index, entry] of entries.entries()) {
    const jsonPath = `classes[${index}]`;
    if (seen.has(entry.id)) {
      cards.push({
        severity: 'error',
        artifactId: entry.id,
        jsonPath,
        rule: 'duplicate-class',
        message: `class "${entry.id}" appears more than once — concurrent classes are distinct entries (FR-6).`,
      });
    }
    seen.add(entry.id);
    const classes = runtime.pack.content.classes ?? {};
    if (classes[entry.id] === undefined) {
      cards.push({
        severity: 'error',
        artifactId: entry.id,
        jsonPath,
        rule: 'unknown-class',
        message: `unknown class "${entry.id}" — not declared in content.classes.`,
        hint: `known classes: ${Object.keys(classes).join(', ') || '(none)'}`,
      });
      continue;
    }
    if (!Number.isInteger(entry.level) || entry.level < 1) {
      cards.push({
        severity: 'error',
        artifactId: entry.id,
        jsonPath: `${jsonPath}.level`,
        rule: 'invalid-level',
        message: `class "${entry.id}" needs an integer level >= 1, got ${entry.level}.`,
      });
      continue;
    }
    const table = runtime.pack.progression[entry.id];
    if (table === undefined) {
      cards.push({
        severity: 'error',
        artifactId: entry.id,
        jsonPath,
        rule: 'missing-progression',
        message: `class "${entry.id}" has no progression.warden-style table — progression is pack data (FR-6).`,
        hint: `declared progression tables: ${Object.keys(runtime.pack.progression).join(', ') || '(none)'}`,
      });
      continue;
    }
    const shortest = Math.min(...Object.values(table.saves).map((values) => values.length));
    if (entry.level > shortest) {
      cards.push({
        severity: 'error',
        artifactId: entry.id,
        jsonPath,
        rule: 'missing-progression',
        message: `progression tables for "${entry.id}" cover ${shortest} level(s); level ${entry.level} is unreadable — extend the pack's tables (FR-6).`,
      });
    }
    const cap = races[race]?.caps?.[entry.id];
    if (cap !== undefined && entry.level > cap) {
      cards.push({
        severity: 'error',
        artifactId: entry.id,
        jsonPath,
        rule: 'race-cap-exceeded',
        message: `level ${entry.level} exceeds the ${race} cap for "${entry.id}" (${cap}) — demihuman caps are pack data (FR-6).`,
      });
    }
  }
  if (cards.length === 0 && heldFeats.length > 0) {
    const tally = featSlotTally(runtime, entries);
    if (tally !== undefined && heldFeats.length > tally.total) {
      cards.push(featSlotsExceeded('(character)', heldFeats.length, tally));
    }
  }
  return cards;
}

/** v1.8 — explicit starting scores must name declared abilities and be integers. */
export function validateAbilityRequest(
  runtime: Runtime,
  abilities: Readonly<Record<string, unknown>> | undefined,
): ErrorCard[] {
  const cards: ErrorCard[] = [];
  if (abilities === undefined) return cards;
  const known = new Set(runtime.pack.stats.abilities);
  for (const [name, score] of Object.entries(abilities)) {
    if (!known.has(name)) {
      cards.push({
        severity: 'error',
        artifactId: name,
        jsonPath: `abilities.${name}`,
        rule: 'unknown-ability',
        message: `unknown ability "${name}" — not declared in stats.abilities.`,
        hint: `known abilities: ${[...known].join(', ')}`,
      });
    } else if (typeof score !== 'number' || !Number.isSafeInteger(score)) {
      cards.push({
        severity: 'error',
        artifactId: name,
        jsonPath: `abilities.${name}`,
        rule: 'invalid-build',
        message: `ability "${name}" must be an integer score.`,
      });
    }
  }
  return cards;
}

/** Build a fresh plain-JSON character state — the single constructor both paths share. */
export function buildCharacter(
  runtime: Runtime,
  request: {
    readonly name: string;
    readonly race: string;
    readonly classes: readonly ClassEntry[];
    readonly abilities?: Readonly<Record<string, number>>;
  },
): CharacterState {
  // Starting scores: the engine default 10, then the first class's declared array
  // (v1.8, content.classes.<id>.abilities), then the request's explicit scores.
  const abilities: Record<string, number> = {};
  const classArray = runtime.pack.content.classes?.[request.classes[0]?.id ?? '']?.abilities ?? {};
  for (const ability of runtime.pack.stats.abilities) {
    abilities[ability] = request.abilities?.[ability] ?? classArray[ability] ?? 10;
  }
  const derived = deriveProgression(runtime, request.classes);
  const level = derived.level;
  const hp = reserveValue(runtime, 'hp', abilities, level, new Rng(0));
  const classXp: Record<string, number> = {};
  for (const entry of request.classes) classXp[entry.id] = 0;
  return {
    id: `char-${runtime.nextCharacterId}`,
    name: request.name,
    race: request.race,
    level,
    xp: 0,
    classes: request.classes.map((entry) => ({ ...entry })),
    classXp,
    abilities,
    saves: derived.saves,
    pools: initPools(runtime, abilities, level),
    slots: derived.slots,
    conditions: [],
    spells: [],
    inventory: [],
    hp: { current: hp, temp: 0 },
  };
}

/** Per-class save values (best across classes) and slot counts (summed across classes), plus total level. */
function deriveProgression(
  runtime: Runtime,
  entries: readonly ClassEntry[],
): { level: number; saves: Record<string, number>; slots: Record<string, (string | null)[]> } {
  const saves: Record<string, number> = {};
  const slots: Record<string, (string | null)[]> = {};
  for (const entry of entries) {
    const table = runtime.pack.progression[entry.id];
    for (const [saveName, values] of Object.entries(table!.saves)) {
      const value = values[entry.level - 1];
      if (value !== undefined && (saves[saveName] === undefined || value > saves[saveName]!))
        saves[saveName] = value;
    }
    for (const [spellLevel, counts] of Object.entries(table!.slots ?? {})) {
      const count = counts[entry.level - 1];
      if (count === undefined || count <= 0) continue;
      const bound = slots[spellLevel] ?? [];
      for (let i = 0; i < count; i += 1) bound.push(null);
      slots[spellLevel] = bound;
    }
  }
  const level = entries.reduce((sum, entry) => sum + entry.level, 0);
  return { level, saves, slots };
}

/** Reapply progression tables to an existing character in place (shared by the XP and level-set paths). */
function applyProgression(runtime: Runtime, character: CharacterState): void {
  const derived = deriveProgression(runtime, character.classes);
  character.saves = derived.saves;
  character.slots = derived.slots;
  character.level = derived.level;
  const hp = reserveValue(runtime, 'hp', character.abilities, derived.level, new Rng(0));
  character.hp.current = hp;
}

/** Class level for a per-class XP amount: pack `tables.xp` (ranged, value = level), else 1000/level fallback. */
export function levelForXp(runtime: Runtime, xp: number): number {
  const table = runtime.pack.tables['xp'];
  if (table !== undefined && table.kind === 'ranged') {
    let fallback: number | undefined;
    for (const entry of table.entries) {
      const min = entry.min ?? 0;
      const max = entry.max ?? Number.MAX_SAFE_INTEGER;
      if (typeof entry.value === 'number') fallback = entry.value;
      if (xp >= min && xp <= max) {
        if (typeof entry.value !== 'number') {
          throw new CharacterBuildError([
            {
              severity: 'error',
              artifactId: 'xp',
              jsonPath: 'tables.xp',
              rule: 'invalid-xp-table',
              message: `tables.xp entry for xp ${xp} must carry a numeric level, got ${JSON.stringify(entry.value)}.`,
            },
          ]);
        }
        return entry.value;
      }
    }
    if (fallback !== undefined) return fallback;
  }
  return Math.floor(xp / 1000) + 1;
}

/** Highest level the pack's progression tables can read for a class (FR-6: tables are the ceiling). */
function tableLevelCeiling(runtime: Runtime, classId: string): number {
  const table = runtime.pack.progression[classId];
  if (table === undefined) return 1;
  return Math.min(...Object.values(table.saves).map((values) => values.length));
}

/** The documented v1 XP split: even shares, remainder to the first class. */
export function xpSplit(total: number, count: number): number[] {
  if (count < 1) return [];
  const base = Math.floor(total / count);
  const shares = Array.from({ length: count }, () => base);
  shares[0] = (shares[0] ?? 0) + (total - base * count);
  return shares;
}

/**
 * FR-6 — the host awards; the engine reports. Accumulates XP, splits it per
 * policy, derives each class's level from pack thresholds (race caps clamp)
 * and keeps the higher of that and the current level — an award never lowers
 * a level (v1.9, DD-R4) — reapplies progression, and emits `xp:awarded`
 * (why: host.grant) followed by `level:reached` per class whose level rose.
 * Returns the emitted events. Computes, checks, then applies: a refusal
 * (`invalid-xp-table`, or `feat-slots-exceeded`, which can then fire only for
 * a character already over its slots) changes nothing.
 */
export function awardXp(
  runtime: Runtime,
  character: CharacterState,
  amount: number,
): readonly RuntimeEvent[] {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new CharacterBuildError([
      {
        severity: 'error',
        artifactId: character.id,
        jsonPath: 'xp',
        rule: 'invalid-xp',
        message: `XP award must be a positive integer, got ${amount}.`,
      },
    ]);
  }
  const shares = xpSplit(amount, character.classes.length);
  const next = character.classes.map((entry, index) => {
    const classXp = (character.classXp[entry.id] ?? 0) + shares[index]!;
    const cap = runtime.pack.content.races?.[character.race]?.caps?.[entry.id];
    const level = Math.max(
      entry.level,
      Math.min(
        levelForXp(runtime, classXp),
        cap ?? Number.MAX_SAFE_INTEGER,
        tableLevelCeiling(runtime, entry.id),
      ),
    );
    return { id: entry.id, level, classXp };
  });
  const held = character.feats?.length ?? 0;
  const tally = featSlotTally(runtime, next);
  if (tally !== undefined && held > tally.total) {
    throw new CharacterBuildError([featSlotsExceeded('(character)', held, tally)]);
  }
  const events: RuntimeEvent[] = [];
  character.xp += amount;
  const reached: Array<{ classId: string; level: number }> = [];
  character.classes.forEach((entry, index) => {
    const { classXp, level } = next[index]!;
    character.classXp[entry.id] = classXp;
    if (level !== entry.level) {
      entry.level = level;
      reached.push({ classId: entry.id, level });
    }
  });
  applyProgression(runtime, character);
  events.push(
    runtime.events.emit({
      type: 'xp:awarded',
      actor: character.id,
      payload: { amount, total: character.xp, classXp: { ...character.classXp } },
      why: { rule: 'host.grant', rolls: [] },
    }),
  );
  for (const entry of reached) {
    events.push(
      runtime.events.emit({
        type: 'level:reached',
        actor: character.id,
        payload: { classId: entry.classId, level: entry.level },
        why: { rule: `progression.${entry.classId}`, rolls: [] },
      }),
    );
  }
  return events;
}

/**
 * FR-6 — direct level-set: the same validation as the XP path (both run
 * `validateBuild`), reapplied to an existing character. Emits `level:reached`
 * per class whose level changed; XP bookkeeping is untouched (a direct set
 * states levels, it does not simulate awards).
 */
export function levelSet(
  runtime: Runtime,
  character: CharacterState,
  entries: readonly ClassEntry[],
): readonly RuntimeEvent[] {
  const errors = validateBuild(runtime, character.race, entries, character.feats);
  if (errors.length > 0) throw new CharacterBuildError(errors);
  const previous = new Map(character.classes.map((entry) => [entry.id, entry.level]));
  character.classes = entries.map((entry) => ({ ...entry }));
  applyProgression(runtime, character);
  const events: RuntimeEvent[] = [];
  for (const entry of character.classes) {
    const before = previous.get(entry.id) ?? 0;
    if (entry.level !== before) {
      events.push(
        runtime.events.emit({
          type: 'level:reached',
          actor: character.id,
          payload: { classId: entry.id, level: entry.level },
          why: { rule: `progression.${entry.id}`, rolls: [] },
        }),
      );
    }
  }
  return events;
}
