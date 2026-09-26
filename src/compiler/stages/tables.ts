/**
 * Stage 7 · tables (generation-pipeline.html: "encounters, loot, flavor"):
 * contributes `tables` + `actions` + the remaining `formulas` from the theme,
 * then proves the table data actually rolls: every table is rolled once
 * through S02's engine (Custom Rule 3 — the compiler has no second table
 * implementation) with the stage's stream, so a malformed/gapped/unresolvable
 * table fails located here instead of at play time.
 */
import type { Stage } from '../stage';
import type { Pack } from '../../schema/pack';
import { rollTable, type TableDef, type TableResolver } from '../../core/tables';
import { GenerationError, themeCard } from '../errors';

export const tablesStage: Stage = {
  name: 'tables',
  run(ctx) {
    const tables = ctx.theme.tables;
    const actions = ctx.theme.actions;
    if (tables === undefined) {
      throw new GenerationError([
        themeCard(
          'E-SCHEMA-01',
          'tables',
          'tables',
          'the theme declares no tables — stage 7 needs encounter/loot tables.',
        ),
      ]);
    }
    if (actions === undefined) {
      throw new GenerationError([
        themeCard(
          'E-SCHEMA-01',
          'actions',
          'actions',
          'the theme declares no actions — stage 7 needs action declarations.',
        ),
      ]);
    }
    for (const [id, def] of Object.entries(tables)) {
      const outcome = rollTable(def as TableDef, ctx.stream, {
        jsonPath: `tables.${id}`,
        resolve: resolverOf(tables),
      });
      if (!outcome.ok) {
        throw new GenerationError([
          themeCard(
            'E-TBL-01',
            id,
            outcome.failure.jsonPath,
            `table "${id}" does not roll: ${outcome.failure.message} (one table engine, FR-15).`,
          ),
        ]);
      }
    }
    ctx.pack['tables'] = structuredClone(tables) as Pack['tables'];
    ctx.pack['actions'] = structuredClone(actions) as Pack['actions'];
    const formulas = (ctx.pack['formulas'] ?? {}) as NonNullable<Pack['formulas']>;
    for (const [id, def] of Object.entries(ctx.theme.formulas ?? {})) {
      if (formulas[id] === undefined) formulas[id] = structuredClone(def);
    }
    if (Object.keys(formulas).length > 0) ctx.pack['formulas'] = formulas;
    ctx.own = { tables: ctx.pack['tables'], actions: ctx.pack['actions'] };
  },
};

/** Nested-table resolver over the theme's own table map. */
function resolverOf(tables: Record<string, TableDef>): TableResolver {
  return (ref: unknown): TableDef | undefined => (typeof ref === 'string' ? tables[ref] : undefined);
}
