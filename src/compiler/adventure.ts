import type { Pack } from '../schema/pack';
import { validatePack } from '../schema/validate';
import { packContentHash } from '../schema/version';
import { makeErrorCard } from '../schema/error-card';
import {
  validateAdventureTemplate,
  validateAdventureDefinition,
  type AdventureTemplate,
  type AdventureDefinition,
  type AdventureNode,
  type AdventureNodeRecipe,
  type AdventureChoice,
} from '../schema/adventure';
import { Rng } from '../core/rng';
import { rollTable } from '../core/tables';
import { packDslChecker } from '../core/dsl/checker';
import { GenerationError } from './errors';

export interface GenerateAdventureRequest {
  readonly pack: Pack;
  readonly template: AdventureTemplate;
  readonly seed: string | number;
}

/** Resolve the finite authored DAG; generation never assembles or plays a battle. */
export function generateAdventure({ pack, template, seed }: GenerateAdventureRequest): AdventureDefinition {
  const packErrors = validatePack(pack, packDslChecker);
  if (packErrors.length) throw new GenerationError(packErrors);
  const errors = validateAdventureTemplate(pack, template);
  if (typeof seed !== 'string' && !(typeof seed === 'number' && Number.isFinite(seed)))
    errors.push(
      makeErrorCard('E-SCHEMA-01', pack.manifest.id, 'seed', 'Seed must be a string or finite number.'),
    );
  if (errors.length) throw new GenerationError(errors);
  const rng = new Rng(
    JSON.stringify([
      'ruleswright',
      1,
      'adventure-definition',
      template.id,
      template.version,
      packContentHash(template),
      String(seed),
    ]),
  );
  const c = template.construction;
  type Node = Omit<AdventureNode, 'choices'> & { choices: AdventureChoice[] };
  const rollNode = (recipe: AdventureNodeRecipe): Node => {
    const table = template.tables[recipe.tableId]!;
    const result = rollTable({ kind: 'weighted', entries: table.entries.map((e) => ({ ...e })) }, rng, {
      jsonPath: `tables.${recipe.tableId}`,
    });
    if (!result.ok)
      throw new GenerationError([
        makeErrorCard('E-TBL-01', template.id, result.failure.jsonPath, result.failure.message),
      ]);
    return { id: recipe.id, ...structuredClone(template.locations[result.value as string]!), choices: [] };
  };
  const nodes: Node[] = [c.entry, ...c.spine].map(rollNode);
  nodes.push({
    id: c.terminal.id,
    kind: 'success',
    title: c.terminal.title,
    description: c.terminal.description,
    choices: [],
    rewardIds: [],
    rest: 'none',
    preparation: false,
    facts: {},
  });
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const link = (from: Node, toNodeId: string) =>
    from.choices.push({ id: 'continue', text: template.fragments[c.continueTextRef]!, toNodeId });
  for (let i = 0; i < nodes.length - 1; i++) link(nodes[i]!, nodes[i + 1]!.id);
  for (const branch of c.branches) {
    if (branch.omitWeight > 0) {
      const result = rollTable(
        {
          kind: 'weighted',
          entries: [
            { weight: branch.includeWeight, value: true },
            { weight: branch.omitWeight, value: false },
          ],
        },
        rng,
      );
      if (!result.ok)
        throw new GenerationError([
          makeErrorCard('E-TBL-01', template.id, result.failure.jsonPath, result.failure.message),
        ]);
      if (!result.value) continue;
    }
    const detour = branch.nodes.map(rollNode);
    byId
      .get(branch.fromNodeId)!
      .choices.push({
        id: `branch-${branch.id}`,
        text: template.fragments[branch.choiceTextRef]!,
        toNodeId: detour[0]!.id,
      });
    for (let i = 0; i < detour.length; i++) link(detour[i]!, detour[i + 1]?.id ?? branch.toNodeId);
    nodes.push(...detour);
  }
  const body: Omit<AdventureDefinition, 'contentHash'> = {
    kind: 'adventure-definition',
    schemaVersion: 1,
    id: template.id,
    template: { id: template.id, version: template.version },
    pack: structuredClone(template.pack),
    seed: String(seed),
    objective: structuredClone(template.objective),
    startNodeId: c.entry.id,
    successNodeId: c.terminal.id,
    nodes,
    rewards: structuredClone(template.rewards),
    facts: structuredClone(template.facts),
    director: structuredClone(template.director),
    narration: structuredClone(template.narration),
  };
  const definition = { ...body, contentHash: packContentHash(body) };
  const outputErrors = validateAdventureDefinition(pack, definition);
  if (outputErrors.length) throw new GenerationError(outputErrors);
  return definition;
}
