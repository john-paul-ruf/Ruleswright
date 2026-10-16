import type { Pack } from '../schema/pack';
import { packContentHash } from '../schema/version';
import { validatePack } from '../schema/validate';
import { makeErrorCard } from '../schema/error-card';
import { validateAdventureTemplate, type AdventureTemplate } from '../schema/adventure';
import { packDslChecker } from '../core/dsl/checker';
import { GenerationError } from './errors';
import darkFantasy from './adventure-templates/dark-fantasy.json';
import zombieUrban from './adventure-templates/zombie-urban.json';
import wyldwood from './adventure-templates/wyldwood.json';

const recipes: Readonly<Record<string, unknown>> = {
  'dark-fantasy': darkFantasy,
  'zombie-urban': zombieUrban,
  wyldwood,
};

/** Explicitly bind a detached bundled recipe to the host's effective pack. */
export function loadAdventureTemplate(id: string, pack: Pack): AdventureTemplate {
  const errors = validatePack(pack, packDslChecker);
  if (errors.length) throw new GenerationError(errors);
  if (!Object.prototype.hasOwnProperty.call(recipes, id))
    throw new GenerationError([makeErrorCard('E-REF-01', id, 'id', 'Unknown bundled adventure template.')]);
  const recipe = structuredClone(recipes[id]) as Omit<AdventureTemplate, 'pack'>;
  const template: AdventureTemplate = {
    ...recipe,
    pack: {
      id: pack.manifest.id,
      schemaVersion: pack.manifest.schemaVersion,
      contentHash: packContentHash(pack),
    },
  };
  const templateErrors = validateAdventureTemplate(pack, template);
  if (templateErrors.length) throw new GenerationError(templateErrors);
  return template;
}
