/**
 * M03 — feats a character holds (FR-5, DD-S11). It value-imports only
 * `./errors` and the class-features leaf `./features` (type imports only),
 * plus types. v1.8 caps learning by feat slots when the pack declares
 * them (`progression.<id>.featSlots`, summed across classes, DD-F1…F3); a pack
 * declaring none has no cap, and the host decides when a character learns.
 * `CharacterState.feats` stays absent until the first learn (the `equipped`
 * presence rule), so characters that never learned round-trip byte-exact.
 * v1.10 (DD-C2): a feat a class feature grants is held but not learned — it is
 * derived, never stored, uses no slot (the tally counts learned feats only),
 * and `learnFeat` refuses it `feat-known`.
 */
import type { ErrorCard } from '../schema/error-card';
import type { Runtime } from './runtime';
import type { CharacterState, ClassEntry } from './character';
import type { RuntimeEvent } from './events';
import { RuntimeRuleError, ruleCard } from './errors';
import { grantedFeats } from './features';

/** DD-F1…F3 — a character's feat slots (summed across classes), or undefined when the pack declares none (no cap). */
export interface FeatSlotTally {
  readonly total: number;
  readonly hint: string;
}

export function featSlotTally(runtime: Runtime, classes: readonly ClassEntry[]): FeatSlotTally | undefined {
  const tables = runtime.pack.progression;
  if (!Object.values(tables).some((table) => table.featSlots !== undefined)) return undefined;
  let total = 0;
  const parts: string[] = [];
  for (const entry of classes) {
    const slots = tables[entry.id]?.featSlots?.[entry.level - 1] ?? 0;
    total += slots;
    parts.push(`${entry.id} ${entry.level} → ${slots}`);
  }
  return { total, hint: `feat slots by class: ${parts.join(', ')}` };
}

/** DD-F6 — the one refusal card: `feat-slots-exceeded` at `feats`. */
export function featSlotsExceeded(artifactId: string, held: number, tally: FeatSlotTally): ErrorCard {
  return ruleCard(
    'feat-slots-exceeded',
    artifactId,
    'feats',
    `holding ${held} feat(s) needs ${held} feat slot(s); the character's classes grant ${tally.total} (FR-6).`,
    tally.hint,
  );
}

/** Learn a pack-declared feat: `unknown-feat` / `feat-known` (held or granted) / `feat-slots-exceeded` refuse with nothing changed; else emits `feat:learned`. */
export function learnFeat(runtime: Runtime, character: CharacterState, featId: string): RuntimeEvent {
  if (runtime.pack.content.feats?.[featId] === undefined) {
    throw new RuntimeRuleError([
      ruleCard('unknown-feat', featId, 'feats', `unknown feat "${featId}" — not declared in content.feats.`),
    ]);
  }
  if (character.feats?.includes(featId) === true) {
    throw new RuntimeRuleError([
      ruleCard('feat-known', featId, 'feats', `"${character.id}" already holds feat "${featId}".`),
    ]);
  }
  if (grantedFeats(runtime, character.classes).includes(featId)) {
    throw new RuntimeRuleError([
      ruleCard(
        'feat-known',
        featId,
        'feats',
        `"${character.id}" is granted feat "${featId}" by a class feature (FR-6).`,
      ),
    ]);
  }
  const held = character.feats?.length ?? 0;
  const tally = featSlotTally(runtime, character.classes);
  if (tally !== undefined && held + 1 > tally.total) {
    throw new RuntimeRuleError([featSlotsExceeded(featId, held + 1, tally)]);
  }
  character.feats = [...(character.feats ?? []), featId];
  return runtime.events.emit({
    type: 'feat:learned',
    actor: character.id,
    payload: { featId },
    why: { rule: `content.feats.${featId}`, rolls: [] },
  });
}
