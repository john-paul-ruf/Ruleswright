/**
 * Stage 7 · tables (generation-pipeline.html: "encounters, loot, flavor"):
 * contributes `tables` + `actions` + the remaining `formulas` + `content.items`
 * from the theme, then proves the table data actually rolls: every table is
 * rolled once through S02's engine (Custom Rule 3 — the compiler has no second
 * table implementation) with the stage's stream, so a malformed/gapped/
 * unresolvable table fails located here instead of at play time.
 */
import type { Stage } from '../stage';
import type { Pack } from '../../schema/pack';
import { rollTable, type TableDef, type TableResolver } from '../../core/tables';
import type { ErrorCard } from '../../schema/error-card';
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
    const itemIds = new Set(Object.keys(ctx.theme.content?.items ?? {}));
    for (const [id, def] of Object.entries(tables)) {
      // CA-02-checkable loot-integrity branches (REPLAN-LOOT-01): every string
      // in a `-loot` table that is not a `tables.`-prefixed reference is
      // FLAVOR — `nothing`, item ids not yet declared, bestiary-style names,
      // prose — never an error (the runtime's loot verb is opt-in per call
      // site). Only two branches are checkable at generation time: an object
      // with an `id` key that is not a declared item id, and a
      // `tables.`-prefixed string whose suffix is not a declared table id
      // (mirrors the load validator's semantic check). Kept to `-loot`-suffixed
      // tables so `wandering-dread`'s bestiary-name values and `weather`'s
      // flavor strings stay out of scope. Checked before the roll so a missed
      // ref fails with the precise E-REF-01 card instead of the engine's
      // E-TBL-01 unresolvable-ref outcome.
      if (id.endsWith('-loot')) {
        const cards: ErrorCard[] = [];
        for (const [index, entry] of def.entries.entries()) {
          const value = entry.value;
          if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
            const itemId = (value as { id?: unknown }).id;
            if (typeof itemId === 'string' && !itemIds.has(itemId)) {
              cards.push(
                themeCard(
                  'E-REF-01',
                  id,
                  `tables.${id}.entries[${index}].value`,
                  `loot table "${id}" entry ${index} grants item "${itemId}", which the theme's content.items do not declare.`,
                ),
              );
            }
          } else if (typeof value === 'string' && value.startsWith('tables.')) {
            const ref = value.slice('tables.'.length);
            if (tables[ref] === undefined) {
              cards.push(
                themeCard(
                  'E-REF-01',
                  id,
                  `tables.${id}.entries[${index}].value`,
                  `loot table "${id}" entry ${index} references table "tables.${ref}", which the theme's tables do not declare.`,
                ),
              );
            }
          }
        }
        if (cards.length > 0) throw new GenerationError(cards);
      }
      const outcome = rollTable(def as TableDef, ctx.stream, {
        jsonPath: `tables.${id}`,
        resolve: resolverOf(tables),
      });
      // A nested roll that lands a bare non-table value ("nothing", prose) is the
      // flavor branch the loot comment above describes, not a broken table: the
      // runtime maps it to a typed no-change rejection at play time (CA-02). Failing
      // generation on it rejected ~1 in 6 seeds of every bundled theme.
      if (
        !outcome.ok &&
        isFlavorLanding(def as TableDef, outcome.failure.reason, outcome.failure.jsonPath, tables)
      ) {
        continue;
      }
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

    // Items are lootable inventory ids (CA-02's grantable vocabulary): stage 7
    // carries the theme's `content.items` into the pack verbatim, guarded like
    // races/conditions — a theme with no items simply contributes nothing.
    const items = ctx.theme.content?.items;
    const content = (ctx.pack['content'] ?? {}) as NonNullable<Pack['content']>;
    if (items !== undefined)
      content['items'] = structuredClone(items) as NonNullable<Pack['content']>['items'];
    if (Object.keys(content).length > 0) ctx.pack['content'] = content;
    ctx.own = {
      tables: ctx.pack['tables'],
      actions: ctx.pack['actions'],
      items: content['items'],
    };
  },
};

/**
 * Nested-table resolver over the theme's own table map. Bare ids only (the
 * theme-space convention — grantLoot's pack-space resolver normalizes both).
 */
/** Whether a failed smoke roll merely landed a flavor value in a nested table. */
function isFlavorLanding(
  root: TableDef,
  reason: string,
  jsonPath: string,
  tables: Record<string, TableDef>,
): boolean {
  if (reason !== 'unresolvable-ref') return false;
  // jsonPath: tables.<id>[->entries[i]]*.entries[j] — walk the hops to the failing entry.
  const hops = [...jsonPath.matchAll(/entries\[(\d+)\]/g)].map((m) => Number(m[1]));
  let table: TableDef | undefined = root;
  for (const [i, index] of hops.entries()) {
    const entry: { value?: unknown } | undefined = table?.entries[index];
    if (entry === undefined) return false;
    if (i === hops.length - 1) {
      const value = entry.value;
      return typeof value === 'string' && !value.startsWith('tables.') && tables[value] === undefined;
    }
    table = typeof entry.value === 'string' ? tables[entry.value.replace(/^tables\./, '')] : undefined;
  }
  return false;
}

function resolverOf(tables: Record<string, TableDef>): TableResolver {
  return (ref: unknown): TableDef | undefined => (typeof ref === 'string' ? tables[ref] : undefined);
}
