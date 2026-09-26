/**
 * M03 — conditions (FR-7): pack-declared status effects with durations,
 * stacking policies, and `restricts` teeth. Application and removal flow
 * through the event system (FR-13) — the engine never mutates condition state
 * silently.
 *
 * Restricts matcher (v1.1 — the contract S05 reuses at declare time):
 *   - A `restricts` entry is a pack string of the form `actions.tagged:<tag>`
 *     or `spells.tagged:<tag>`.
 *   - `<tag>` must reference a tag DECLARED in the pack (v1.1 validator rule
 *     E-REF-01; the matcher treats an undeclared tag as a load-data defect and
 *     rejects the condition at load-time via the schema, at declare-time via
 *     `matchesRestriction` returning false for patterns that name no declared
 *     tag — a pattern can never block more than the pack declared).
 *   - While the condition is active, an action is blocked iff the action's
 *     `tags` include `<tag>`; likewise a spell whose `tags` include `<tag>`.
 *     Tags are matched exactly (case-sensitive kebab ids), never by prefix.
 *   - Fixtures declare tags natively — no override-patch workaround (v1.1).
 *
 * Stacking policies (pack-declared per condition, FR-7):
 *   - `refresh`: reapplying resets the duration to the pack value (no stack
 *     growth, no duplicate entry).
 *   - `stack`: reapplying adds another active entry with the pack duration.
 *   - `ignore`: a reapply while active is a no-op — the first instance keeps
 *     its remaining duration.
 *
 * Durations tick down once per round via `tick()` (the host paces rounds and
 * calls it per combatant turn; round/turn clock is host-owned, FR-8/FR-10).
 */
import type { Runtime } from './runtime';
import type { CharacterState } from './character';
import { RuntimeRuleError, ruleCard } from './errors';
import type { RuntimeEvent } from './events';

/**
 * The v1.1 restricts matcher (see module doc for exact semantics).
 * `kind` selects the action-vs-spell tag map; `tags` are the artifact's
 * declared tags. A pattern whose `<tag>` is not in `declaredTags` matches
 * nothing — a condition cannot block what the pack never declared.
 */
export function matchesRestriction(pattern: string, kind: 'action' | 'spell', tags: readonly string[], declaredTags: ReadonlySet<string>): boolean {
  const prefix = kind === 'action' ? 'actions.tagged:' : 'spells.tagged:';
  if (!pattern.startsWith(prefix)) return false;
  const tag = pattern.slice(prefix.length);
  if (!declaredTags.has(tag)) return false;
  return tags.includes(tag);
}

/** The pack's declared tag vocabulary across actions and spells (v1.1). */
export function declaredTags(runtime: Runtime): ReadonlySet<string> {
  const tags = new Set<string>();
  for (const action of Object.values(runtime.pack.actions)) {
    for (const tag of action.tags ?? []) tags.add(tag);
  }
  for (const spell of Object.values(runtime.pack.content.spells ?? {})) {
    for (const tag of spell.tags ?? []) tags.add(tag);
  }
  return tags;
}

/** Whether a restriction pattern can ever bite in this pack (declare-time reuse for S05). */
export function isLivePattern(runtime: Runtime, pattern: string): boolean {
  const tag = pattern.startsWith('actions.tagged:')
    ? pattern.slice('actions.tagged:'.length)
    : pattern.startsWith('spells.tagged:')
      ? pattern.slice('spells.tagged:'.length)
      : undefined;
  return tag !== undefined && declaredTags(runtime).has(tag);
}

/** FR-7 — apply a pack-declared condition: duration seeds from the pack, stacking per policy. Emits `condition:applied`. */
export function applyCondition(runtime: Runtime, character: CharacterState, conditionId: string): RuntimeEvent {
  const def = runtime.pack.content.conditions?.[conditionId];
  if (def === undefined) {
    throw new RuntimeRuleError([ruleCard('unknown-condition', conditionId, 'conditions', `unknown condition "${conditionId}" — not declared in content.conditions.`)]);
  }
  const existing = character.conditions.filter((active) => active.conditionId === conditionId);
  if (existing.length > 0) {
    switch (def.stacking) {
      case 'refresh': {
        const active = existing[0]!;
        active.duration = def.duration;
        break;
      }
      case 'stack':
        character.conditions.push({ conditionId, duration: def.duration });
        break;
      case 'ignore':
        break;
    }
  } else {
    character.conditions.push({ conditionId, duration: def.duration });
  }
  return runtime.events.emit({
    type: 'condition:applied',
    actor: character.id,
    target: character.id,
    payload: { conditionId, duration: def.duration, stacking: def.stacking, active: character.conditions.filter((active) => active.conditionId === conditionId).length },
    why: { rule: `content.conditions.${conditionId}`, rolls: [] },
  });
}

/** FR-7 — remove every active instance of a condition. Emits `condition:removed`. */
export function removeCondition(runtime: Runtime, character: CharacterState, conditionId: string): RuntimeEvent {
  const before = character.conditions.length;
  character.conditions = character.conditions.filter((active) => active.conditionId !== conditionId);
  const removed = before - character.conditions.length;
  if (removed === 0) {
    throw new RuntimeRuleError([ruleCard('condition-not-active', conditionId, 'conditions', `"${conditionId}" is not active on ${character.id} — nothing to remove.`)]);
  }
  return runtime.events.emit({
    type: 'condition:removed',
    actor: character.id,
    target: character.id,
    payload: { conditionId, removed },
    why: { rule: `content.conditions.${conditionId}`, rolls: [] },
  });
}

/**
 * FR-7 — one round tick: every active duration drops by one; zero-duration
 * instances expire (and emit `condition:removed`). Returns the emitted
 * expiration events (empty when nothing expired).
 */
export function tickConditions(runtime: Runtime, character: CharacterState): readonly RuntimeEvent[] {
  const expired: string[] = [];
  const kept: CharacterState['conditions'] = [];
  for (const active of character.conditions) {
    const remaining = (active as { duration: number }).duration - 1;
    if (remaining <= 0) expired.push(active.conditionId);
    else {
      active.duration = remaining;
      kept.push(active);
    }
  }
  character.conditions = kept;
  return expired.map((conditionId) =>
    runtime.events.emit({
      type: 'condition:removed',
      actor: character.id,
      target: character.id,
      payload: { conditionId, expired: true },
      why: { rule: `content.conditions.${conditionId}`, rolls: [] },
    }),
  );
}

/**
 * FR-7 — the condition's teeth: whether an active restricts pattern blocks
 * this action/spell id right now. Any single active instance's matching
 * pattern blocks. `kind` + artifact id resolve the artifact's declared tags
 * from the pack.
 */
export function isRestricted(runtime: Runtime, character: CharacterState, kind: 'action' | 'spell', artifactId: string): boolean {
  const tags = kind === 'action' ? (runtime.pack.actions[artifactId]?.tags ?? []) : (runtime.pack.content.spells?.[artifactId]?.tags ?? []);
  const declared = declaredTags(runtime);
  for (const active of character.conditions) {
    for (const pattern of runtime.pack.content.conditions?.[active.conditionId]?.restricts ?? []) {
      if (matchesRestriction(pattern, kind, tags, declared)) return true;
    }
  }
  return false;
}

/** The ids of actions/spells currently blocked for this character (declare-time + UI convenience). */
export function restrictedIds(runtime: Runtime, character: CharacterState, kind: 'action' | 'spell'): readonly string[] {
  const ids = kind === 'action' ? Object.keys(runtime.pack.actions) : Object.keys(runtime.pack.content.spells ?? {});
  return ids.filter((id) => isRestricted(runtime, character, kind, id));
}

/**
 * FR-7 — thematic condition application (api-map: char.applyTheme(id)):
 * the pack declares the theme's conditions in its `tables` map
 * (`tables.<id>`, weighted entries whose values are condition ids). Removal
 * clears every instance of every condition the theme table granted.
 */
export function applyTheme(runtime: Runtime, character: CharacterState, themeId: string): readonly RuntimeEvent[] {
  const table = runtime.pack.tables[themeId];
  if (table === undefined) {
    throw new RuntimeRuleError([ruleCard('unknown-theme', themeId, 'tables', `unknown theme "${themeId}" — not declared in tables.`)]);
  }
  const events: RuntimeEvent[] = [];
  for (const entry of table.entries) {
    if (typeof entry.value === 'string' && runtime.pack.content.conditions?.[entry.value] !== undefined) {
      events.push(applyCondition(runtime, character, entry.value));
    }
  }
  if (events.length === 0) {
    throw new RuntimeRuleError([
      ruleCard('theme-grants-nothing', themeId, `tables.${themeId}`, `theme table "${themeId}" grants no declared conditions — themes apply conditions (FR-7).`),
    ]);
  }
  return events;
}

/** FR-7 — remove every condition a theme application granted (api-map: char.removeTheme(id)). */
export function removeTheme(runtime: Runtime, character: CharacterState, themeId: string): readonly RuntimeEvent[] {
  const table = runtime.pack.tables[themeId];
  if (table === undefined) {
    throw new RuntimeRuleError([ruleCard('unknown-theme', themeId, 'tables', `unknown theme "${themeId}" — not declared in tables.`)]);
  }
  const events: RuntimeEvent[] = [];
  for (const entry of table.entries) {
    const conditionId = entry.value;
    if (typeof conditionId === 'string' && character.conditions.some((active) => active.conditionId === conditionId)) {
      events.push(removeCondition(runtime, character, conditionId));
    }
  }
  return events;
}