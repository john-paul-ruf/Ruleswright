/**
 * combat-decomposition CAP-D3 / CA-D1 / CA-D4 — module-surface pins.
 *
 * Value exports of the runtime barrel, `combat/combat` and `snapshots` are
 * pinned exactly: tests and `snapshots.ts` import from these paths directly,
 * so moving a symbol into another file must leave a re-export behind.
 * `combat/triggers` is pinned as a floor (new internal exports may join it).
 *
 * The CA-2 discipline sweep widens `combat-spatial.test.ts`'s "the combat loop
 * never parses at play time" to every file the loop spans.
 *
 * Behaviour pin: its re-key owner is any later feature that intentionally
 * changes these surfaces, which lists it in its plan's pin audit.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import * as runtimeSurface from '../../../src/runtime/index';
import * as combatModule from '../../../src/runtime/combat/combat';
import * as snapshotsModule from '../../../src/runtime/snapshots';
import * as triggersModule from '../../../src/runtime/combat/triggers';

describe('module surfaces (CA-D1)', () => {
  it('the runtime barrel exports exactly these values', () => {
    expect(Object.keys(runtimeSurface).sort()).toEqual([
      'Character',
      'CharacterBuildError',
      'Combat',
      'EventStream',
      'PackLoadError',
      'Rng',
      'Runtime',
      'RuntimeRuleError',
      'advanceSolo',
      'applyCondition',
      'applyTheme',
      'armorBlockingCast',
      'assembleEncounter',
      'attackBonusAgainst',
      'attackRoll',
      'awardXp',
      'bestiaryIds',
      'castSpell',
      'checkCost',
      'checkReach',
      'classFeatures',
      'countItem',
      'createAdventure',
      'createCharacter',
      'createEncounterSession',
      'declaredTags',
      'defenseValue',
      'deserializeCombat',
      'displayRoll',
      'dropItem',
      'emitDeclined',
      'emitOffer',
      'entryCost',
      'equipItem',
      'equipmentScope',
      'equipmentView',
      'equippedGrants',
      'equippedUnits',
      'eventMatches',
      'executeAgainst',
      'findPath',
      'formulaValue',
      'freshLedger',
      'grantItem',
      'grantLoot',
      'gridGeometry',
      'hexGeometry',
      'initPools',
      'isLivePattern',
      'isRestricted',
      'knownSpells',
      'learnFeat',
      'levelForXp',
      'levelSet',
      'matchesRestriction',
      'offersForEvent',
      'packSpatialModel',
      'poolVocabulary',
      'prepareSpell',
      'profileFromCharacter',
      'profileFromStatblock',
      'reactiveActionsFor',
      'reactiveFeatsFor',
      'readNarration',
      'removeCondition',
      'removeTheme',
      'replenish',
      'reserveValue',
      'resolveSlotGrants',
      'resolveTriggered',
      'rest',
      'restoreAdventure',
      'restoreCharacter',
      'restoreEncounterSession',
      'restoreParty',
      'restrictedIds',
      'rollLoot',
      'ruleCard',
      'serializeCharacter',
      'serializeCombat',
      'serializeParty',
      'settleItemUses',
      'settleSpellCasts',
      'spatialFromPack',
      'spawnEncounter',
      'spawnMonster',
      'spend',
      'spendPool',
      'startCombat',
      'terrainAt',
      'theaterOfMind',
      'tickConditions',
      'unequipItem',
      'useItem',
      'validateBuild',
      'xpSplit',
    ]);
  });

  it('combat/combat exports exactly these values', () => {
    expect(Object.keys(combatModule).sort()).toEqual([
      'Combat',
      'combatantFeats',
      'copyBindings',
      'copyTerrain',
      'defeatedSide',
      'displayRoll',
      'isDowned',
      'isSelfAction',
      'moveBudgetAst',
      'replenish',
      'startCombat',
      'terrainRefusals',
    ]);
  });

  it('snapshots exports exactly these values', () => {
    expect(Object.keys(snapshotsModule).sort()).toEqual([
      'deserializeCombat',
      'restoreCharacter',
      'restoreParty',
      'serializeCharacter',
      'serializeCombat',
      'serializeParty',
    ]);
  });

  it('combat/triggers keeps its seven values', () => {
    expect(Object.keys(triggersModule)).toEqual(
      expect.arrayContaining([
        'eventMatches',
        'reactiveActionsFor',
        'reactiveFeatsFor',
        'offersForEvent',
        'emitOffer',
        'emitDeclined',
        'resolveTriggered',
      ]),
    );
  });
});

describe('CA-2 discipline across the combat files (CA-D4)', () => {
  it('no combat file except resolve.ts names parseFormula or parseEffect', () => {
    const dir = fileURLToPath(new URL('../../../src/runtime/combat', import.meta.url));
    const files = readdirSync(dir).filter((name) => name.endsWith('.ts') && name !== 'resolve.ts');
    expect(files).toContain('combat.ts');
    for (const name of files) {
      const source = readFileSync(join(dir, name), 'utf8');
      expect(source, `${name} must not parse at play time`).not.toMatch(/parseFormula|parseEffect/);
    }
  });
});
