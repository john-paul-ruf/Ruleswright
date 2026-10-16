import type { EncounterSetup, PlayEncounter, PlayMembers, PlayRngState } from '../../schema/play-session';
import { Rng } from '../../core/rng';
import type { Runtime } from '../runtime';
import { restoreCharacter } from '../snapshots/character';
import { profileFromCharacter } from '../character-profile';
import { assembleEncounter, spawnEncounter } from '../encounter';
import { startCombat } from '../combat/combat';
import { detached, freezeFight } from './snapshot';

export function streamKey(tag: string, ...parts: (string | number)[]): string {
  return JSON.stringify(['ruleswright', 1, tag, ...parts]);
}

export function beginEncounter(
  runtime: Runtime,
  sessionId: string,
  seed: string,
  index: number,
  members: PlayMembers,
  setup: EncounterSetup,
  playState?: PlayRngState,
) {
  const generation = new Rng(streamKey('encounter-generation', sessionId, seed, index, String(setup.seed)));
  const play = new Rng(playState ?? streamKey('encounter-play', sessionId, seed));
  const characters = members.map((member) => restoreCharacter(runtime, member.character));
  const memberBindings = members.map((member, i) => ({
    memberId: member.memberId,
    characterId: characters[i]!.state.id,
    combatantId: `m:${member.memberId}`,
  }));
  const allies = characters.map((character, i) => ({
    id: memberBindings[i]!.combatantId,
    ...profileFromCharacter(runtime, character, memberBindings[i]!.combatantId),
  }));
  const selection = assembleEncounter(runtime, {
    budget: setup.budget,
    party: characters,
    seed: String(setup.seed),
    rng: generation,
  });
  const enemyInstances = selection.groups
    .flatMap((group) =>
      Array.from({ length: group.count }, (_, i) => ({ monsterId: group.id, instance: i + 1 })),
    )
    .map((entry, i) => ({ ...entry, enemyId: `e:${index}:${i + 1}` }));
  const enemies = spawnEncounter(runtime, selection).map((profile, i) => ({
    id: enemyInstances[i]!.enemyId,
    profile: { ...profile, id: enemyInstances[i]!.enemyId },
    balances: {},
  }));
  const positions = Object.fromEntries(
    [...allies, ...enemies].flatMap((entry, i) =>
      setup.layout.kind === 'theater'
        ? []
        : [
            [
              entry.id,
              i < allies.length ? setup.layout.allies[i]! : setup.layout.enemies[i - allies.length]!,
            ],
          ],
    ),
  );
  const terrain = setup.layout.kind === 'theater' ? [] : setup.layout.terrain;
  const start = detached({ allies, enemies, positions, terrain });
  const fight = startCombat(runtime, {
    ...start,
    rng: new Rng(streamKey('combat', sessionId, index, String(setup.seed), play.int(4294967296))),
  });
  const encounterId = JSON.stringify([sessionId, index]);
  const encounter: PlayEncounter = {
    encounterId,
    setup,
    selection,
    entryMembers: members,
    memberBindings,
    enemyInstances,
    start,
    ...freezeFight(fight, encounterId, false),
  };
  return { encounter, rng: { generation: generation.getState(), play: play.getState() }, fight };
}
