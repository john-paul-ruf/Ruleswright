/**
 * M03 — feats a character holds (FR-5, DD-S11). A leaf: it imports only
 * `./errors` plus types. v1 has no feat-slot cap (progression declares no
 * feat-slot field — the FR-6 gap); the host decides when a character learns.
 * `CharacterState.feats` stays absent until the first learn (the `equipped`
 * presence rule), so characters that never learned round-trip byte-exact.
 */
import type { Runtime } from './runtime';
import type { CharacterState } from './character';
import type { RuntimeEvent } from './events';
import { RuntimeRuleError, ruleCard } from './errors';

/** Learn a pack-declared feat: `unknown-feat` / `feat-known` refuse with nothing changed; else emits `feat:learned`. */
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
  character.feats = [...(character.feats ?? []), featId];
  return runtime.events.emit({
    type: 'feat:learned',
    actor: character.id,
    payload: { featId },
    why: { rule: `content.feats.${featId}`, rolls: [] },
  });
}
