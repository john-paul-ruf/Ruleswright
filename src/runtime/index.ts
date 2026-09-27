/**
 * M03 runtime surface — the full lifecycle facade: character side (Runtime,
 * Character, progression, pools, conditions, events, errors, snapshots) plus
 * the combat engine (S05: combat loop, action economy, resolution, spatial,
 * triggers) and the bestiary/encounter machinery. The runtime surface never
 * imports the compiler (architecture rule; CI string-checks the bundle).
 */
export {
  EventStream,
  type RuntimeEvent,
  type EventClock,
  type EventWhy,
  type EventSeed,
  type EventSink,
} from './events';
export { Runtime, PackLoadError, type PackIndex, type CharacterCreateRequest } from './runtime';
export {
  Character,
  createCharacter,
  reserveValue,
  formulaValue,
  type CharacterState,
  type ActiveCondition,
  type ClassEntry,
  type InventoryEntry,
  type DerivedStats,
} from './character';
export { CharacterBuildError, validateBuild, levelForXp, xpSplit, levelSet, awardXp } from './progression';
export { spendPool, prepareSpell, castSpell, knownSpells, poolVocabulary, initPools, rest } from './pools';
export { grantItem, dropItem, countItem, rollLoot, grantLoot, type LootOptions } from './inventory';
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
export {
  startCombat,
  displayRoll,
  type Combat,
  type CombatState,
  type CombatantState,
  type CombatPhase,
  type PendingAction,
  type PendingTrigger,
  type DeclareOptions,
  type DeclareRejection,
  type StepOutcome,
  type StartCombatRequest,
} from './combat/combat';
export {
  profileFromStatblock,
  attackBonusAgainst,
  attackRoll,
  defenseValue,
  executeAgainst,
  type CombatantProfile,
  type Side,
  type BoundCombatant,
  type BoundAction,
  type ResolutionVars,
  type MutationRequest,
  type MutationSink,
} from './combat/resolve';
export { profileFromCharacter, type CharacterCombatant } from './character-profile';
export {
  resolveSlotGrants,
  checkCost,
  freshLedger,
  replenish,
  spend,
  type SlotGrants,
  type SlotLedger,
  type EconomyBalances,
  type CostRejection,
  type CostClaim,
} from './combat/action-economy';
export {
  theaterOfMind,
  gridGeometry,
  spatialFromPack,
  packSpatialModel,
  checkReach,
  type Position,
  type SpatialModel,
  type SpatialGeometry,
  type SpatialRejection,
} from './combat/spatial';
export {
  eventMatches,
  reactiveActionsFor,
  offersForEvent,
  emitOffer,
  emitDeclined,
  resolveTriggered,
  type ReactiveAction,
} from './combat/triggers';
export { spawnMonster, bestiaryIds } from './bestiary';
export {
  assembleEncounter,
  spawnEncounter,
  type AssembleEncounterRequest,
  type AssembledGroup,
  type Encounter,
} from './encounter';
