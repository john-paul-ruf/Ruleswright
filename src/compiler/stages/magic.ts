/**
 * Stage 5 · magic (generation-pipeline.html: "spells, pools, slots"):
 * contributes `content.spells` + `economy` (the v1.1 turn-economy declaration,
 * FR-4) + the pool formulas the spells' point costs draw from. There is no
 * magic subsystem (FR-9): spells ride the normal action pipeline; the stage
 * contributes magic metadata + costs as data. A theme with no `economy` and no
 * spell costs keeps the documented engine default (the zombie theme's drain
 * branch may omit it deliberately — S05's both-branches proof).
 */
import type { Stage } from '../stage';
import type { Pack } from '../../schema/pack';
import { GenerationError, themeCard } from '../errors';

const MAX_SPELL_LEVEL = 9;

export const magicStage: Stage = {
  name: 'magic',
  run(ctx) {
    const spells = ctx.theme.content?.spells;
    const content = (ctx.pack['content'] ?? {}) as NonNullable<Pack['content']>;
    if (spells !== undefined) {
      for (const [id, spell] of Object.entries(spells)) {
        if (spell.magic.level < 1 || spell.magic.level > MAX_SPELL_LEVEL) {
          throw new GenerationError([
            themeCard(
              'E-SCHEMA-01',
              id,
              `content.spells.${id}.magic.level`,
              `spell "${id}" declares level ${spell.magic.level} — magic.level must be an integer in 1..${MAX_SPELL_LEVEL}.`,
            ),
          ]);
        }
        for (const list of spell.magic.lists) {
          if (ctx.theme.content?.classes?.[list] === undefined) {
            throw new GenerationError([
              themeCard(
                'E-REF-01',
                id,
                `content.spells.${id}.magic.lists`,
                `spell "${id}" claims list membership in class "${list}", which the theme does not declare.`,
              ),
            ]);
          }
        }
      }
      content['spells'] = structuredClone(spells) as NonNullable<Pack['content']>['spells'];
    }
    if (ctx.theme.economy !== undefined) {
      ctx.pack['economy'] = structuredClone(ctx.theme.economy) as Pack['economy'];
    }
    const formulas = (ctx.pack['formulas'] ?? {}) as NonNullable<Pack['formulas']>;
    const spellPools = spellPoolsOf(spells);
    for (const pool of spellPools) {
      const capacity = ctx.theme.formulas?.[pool];
      if (capacity === undefined) {
        throw new GenerationError([
          themeCard(
            'E-ECON-01',
            pool,
            `formulas.${pool}`,
            `a spell's point cost draws from pool "${pool}", but the theme declares no capacity formula for it (a drain pool's capacity is a pack formula, FR-3/FR-8).`,
          ),
        ]);
      }
      formulas[pool] = structuredClone(capacity);
    }
    if (Object.keys(formulas).length > 0) ctx.pack['formulas'] = formulas;
    ctx.pack['content'] = content;
    ctx.own = { spells: content['spells'], economy: ctx.pack['economy'], pools: spellPools };
  },
};

/** The pool ids any spell point cost names, in theme declaration order (CA-4 vocabulary). */
function spellPoolsOf(
  spells: Record<string, { cost: { points?: { pool: string } } }> | undefined,
): readonly string[] {
  const pools: string[] = [];
  if (spells === undefined) return pools;
  for (const spell of Object.values(spells)) {
    if (spell.cost.points !== undefined && !pools.includes(spell.cost.points.pool))
      pools.push(spell.cost.points.pool);
  }
  return pools;
}
