/**
 * M03 runtime surface — the character-side lifecycle facade. Combat
 * (`combat/**`, `encounter.ts`, `bestiary.ts`) lands in S05 under the same
 * module; progression/pools/conditions join this barrel at their checkpoints.
 */
export { EventStream, type RuntimeEvent, type EventClock, type EventWhy, type EventSeed, type EventSink } from './events';
export {
  Runtime,
  PackLoadError,
  type PackIndex,
  type CharacterCreateRequest,
  type CharacterState,
  type ActiveCondition,
} from './runtime';