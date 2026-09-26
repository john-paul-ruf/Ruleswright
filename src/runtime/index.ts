/**
 * M03 runtime surface — the character-side lifecycle facade. Combat
 * (`combat/**`, `encounter.ts`, `bestiary.ts`) lands in S05 under the same
 * module. This barrel is deliberately open for S05's additions.
 */
export { EventStream, type RuntimeEvent, type EventClock, type EventWhy, type EventSeed, type EventSink } from './events';
export {
  Runtime,
  PackLoadError,
  type PackIndex,
  type CharacterCreateRequest,
} from './runtime';
export {
  Character,
  createCharacter,
  reserveValue,
  formulaValue,
  type CharacterState,
  type ActiveCondition,
  type ClassEntry,
  type DerivedStats,
} from './character';
export { CharacterBuildError, validateBuild, levelForXp, xpSplit, levelSet, awardXp } from './progression';
export { spendPool, prepareSpell, castSpell, knownSpells, poolVocabulary, initPools, rest } from './pools';
export {
  matchesRestriction,
  declaredTags,
  isLivePattern,
  applyCondition,
  removeCondition,
  tickConditions,
  isRestricted,
  restrictedIds,
  applyTheme,
  removeTheme,
} from './conditions';
export { RuntimeRuleError, ruleCard } from './errors';
export {
  serializeCharacter,
  serializeParty,
  serializeCombat,
  restoreCharacter,
  restoreParty,
  deserializeCombat,
  type CharacterSnapshot,
  type PartySnapshot,
  type CombatSnapshot,
  type SnapshotPackIdentity,
  type SnapshotCharacterState,
  type SnapshotClassEntry,
  type SnapshotActiveCondition,
  type SnapshotInventoryEntry,
  type SnapshotCombatant,
  type CombatRestoreRequest,
} from './snapshots';