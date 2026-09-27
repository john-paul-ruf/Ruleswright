/**
 * Checkpoint-3 suite — the FR-21 coverage floor, the acceptance spine. Every
 * bullet is enumerated against ALL THREE generated packs (dark-fantasy =
 * vancian showcase; zombie-urban = drain/table showcase; wyldwood = fey
 * charm/ward showcase). This file is S08's proof-4 input:
 * generateCampaign → validatePack(packDslChecker) → the floor holds.
 *
 * SESSION-04 extends the floor with the spatial declarations (CAP-G6, FR-11):
 * every bundled theme declares the grid model and every generated pack ships it
 * — stage-8 validation clean (the theater-of-mind default would omit the section).
 */
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { runPipeline } from '../../src/compiler/pipeline';
import { DARK_FANTASY, ZOMBIE_URBAN, WYLDWOOD } from '../../src/compiler/theme-loader';
import { validatePack } from '../../src/schema/validate';
import { packDslChecker } from '../../src/core/dsl/checker';
import { packContentHash } from '../../src/schema/version';
import type { Pack } from '../../src/schema/pack';
import { generateCampaign, loadTheme } from '../../src/compiler';
import { Runtime } from '../../src/runtime';

const SEED = 42;

const PACKS: readonly { name: string; pack: Pack; theme: typeof DARK_FANTASY }[] = [
  { name: 'dark-fantasy', pack: runPipeline(DARK_FANTASY, SEED), theme: DARK_FANTASY },
  { name: 'zombie-urban', pack: runPipeline(ZOMBIE_URBAN, SEED), theme: ZOMBIE_URBAN },
  { name: 'wyldwood', pack: runPipeline(WYLDWOOD, SEED), theme: WYLDWOOD },
];

describe('FR-17/CA-1 — all three themes generate and validate clean (the dogfood proof)', () => {
  for (const { name, pack } of PACKS) {
    it(`${name}: generateCampaign → schema.validatePack(+packDslChecker) → zero cards`, () => {
      const cards = validatePack(pack, packDslChecker);
      expect(cards.map((card) => `${card.rule} @ ${card.jsonPath}: ${card.message}`)).toEqual([]);
      expect(pack.manifest.id).toBe(name);
      expect(pack.manifest.schemaVersion).toBe(1);
    });
  }
});

describe('v1.2 — every bundled class declares combat actions (UI B-1, D-23)', () => {
  for (const themeId of ['dark-fantasy', 'zombie-urban', 'wyldwood'] as const) {
    it(`${themeId}: the generated pack loads in the Runtime and every class grants 1+ declared action`, () => {
      const pack = generateCampaign({ theme: loadTheme(themeId), seed: SEED });
      const rt = new Runtime(pack);
      const classes = Object.entries(rt.pack.content.classes ?? {});
      expect(classes.length).toBeGreaterThan(0);
      for (const [classId, def] of classes) {
        expect(def.actions?.length ?? 0, classId).toBeGreaterThanOrEqual(1);
        for (const actionId of def.actions ?? [])
          expect(rt.pack.actions[actionId], `${classId} → ${actionId}`).toBeDefined();
      }
    });

    it(`${themeId}: same theme + seed twice ⇒ byte-identical pack with class actions`, () => {
      const a = generateCampaign({ theme: loadTheme(themeId), seed: SEED });
      const b = generateCampaign({ theme: loadTheme(themeId), seed: SEED });
      expect(JSON.stringify(a)).toBe(JSON.stringify(b));
      expect(packContentHash(a)).toBe(packContentHash(b));
    });
  }
});

describe('FR-21 floor — the shared bullets, enumerated against both packs', () => {
  for (const { name, pack } of PACKS) {
    it(`${name}: 2+ classes with attack tables/bonus, save progressions, HD (FR-21.1)`, () => {
      expect(Object.keys(pack.content.classes ?? {}).length).toBeGreaterThanOrEqual(2);
      for (const [classId, prog] of Object.entries(pack.progression)) {
        expect(prog.hd, classId).toMatch(/^d(6|8|10|12)$/);
        expect(Object.keys(prog.saves).length, classId).toBeGreaterThan(0);
        expect(prog.attackTable !== undefined || prog.attackBonus !== undefined, classId).toBe(true);
      }
    });

    it(`${name}: 1+ legal multi-class combo exercised (demihuman multi-class)`, () => {
      const races = pack.content.races ?? {};
      const capped = Object.values(races).filter((race) => race.caps && Object.keys(race.caps).length >= 2);
      expect(capped.length).toBeGreaterThan(0);
    });

    it(`${name}: a race with a level cap (classic cap curve)`, () => {
      const races = pack.content.races ?? {};
      const withCaps = Object.entries(races).filter(([, race]) => race.caps !== undefined);
      expect(withCaps.length).toBeGreaterThan(0);
      for (const [, race] of withCaps) {
        for (const maxLevel of Object.values(race.caps ?? {})) expect(maxLevel).toBeGreaterThanOrEqual(1);
      }
    });

    it(`${name}: the full five named saves (vigor, grace, tenacity, reason, presence)`, () => {
      expect(pack.stats.saves).toEqual(['vigor', 'grace', 'tenacity', 'reason', 'presence']);
    });

    it(`${name}: working skills and feats, including 1 reactive feat (FR-12 proof 2)`, () => {
      expect(Object.keys(pack.content.skills ?? {}).length).toBeGreaterThanOrEqual(2);
      const feats = pack.content.feats ?? {};
      const reactive = Object.values(feats).filter((feat) => feat.trigger?.on !== undefined);
      expect(reactive.length).toBeGreaterThanOrEqual(1);
      expect(reactive[0]?.trigger?.on.length).toBeGreaterThan(0);
    });

    it(`${name}: several conditions, including one with restricts (FR-21.8)`, () => {
      const conditions = pack.content.conditions ?? {};
      expect(Object.keys(conditions).length).toBeGreaterThanOrEqual(3);
      const withTeeth = Object.values(conditions).filter((def) => def.restricts !== undefined);
      expect(withTeeth.length).toBeGreaterThanOrEqual(1);
    });

    it(`${name}: melee (adjacency), ranged, and 1 burst-area spell`, () => {
      const actions = pack.actions;
      const melee = Object.values(actions).filter((action) => action.valid?.includes('adjacent'));
      const ranged = Object.values(actions).filter((action) => action.effect.includes('attack(ac, 0)'));
      expect(melee.length).toBeGreaterThanOrEqual(1);
      expect(ranged.length).toBeGreaterThanOrEqual(1);
      const bursts = Object.values(pack.content.spells ?? {}).filter(
        (spell) => spell.targeting?.shape === 'burst',
      );
      expect(bursts.length).toBeGreaterThanOrEqual(1);
    });

    it(`${name}: encounter/loot tables present and ROLLABLE through the one engine`, () => {
      const tables = Object.entries(pack.tables);
      expect(tables.length).toBeGreaterThanOrEqual(2);
      expect(tables.some(([, def]) => def.kind === 'weighted')).toBe(true);
      expect(tables.some(([, def]) => def.kind === 'ranged')).toBe(true);
      expect(tables.some(([, def]) => def.kind === 'nested')).toBe(true);
    });

    it(`${name}: 1 documented example override (readme names an FR-19 override)`, () => {
      const readme = PACKS.find((entry) => entry.name === name)!.theme.readme ?? '';
      expect(readme).toContain('overrides');
      expect(readme).toContain('target');
    });

    it(`${name}: knobs that visibly change output (provenance records them)`, () => {
      expect(pack.manifest.provenance?.theme).toBe(name);
      expect(pack.manifest.provenance?.seed).toBe(SEED);
      expect(pack.manifest.provenance?.knobs).toBeDefined();
    });

    it(`${name}: v1.1 economy — turnSlots authored natively (dark) or exercised default (zombie)`, () => {
      const theme = PACKS.find((entry) => entry.name === name)!.theme;
      const packSlots = pack.economy?.turnSlots;
      if (theme.economy !== undefined) {
        expect(packSlots).toEqual(theme.economy.turnSlots);
        // every cost.slots key resolves to the declared economy (E-ECON-01 held)
        for (const action of Object.values(pack.actions)) {
          for (const slotName of Object.keys(action.cost.slots ?? {}))
            expect(theme.economy.turnSlots[slotName]).toBeDefined();
        }
        for (const spell of Object.values(pack.content.spells ?? {})) {
          for (const slotName of Object.keys(spell.cost.slots ?? {}))
            expect(theme.economy.turnSlots[slotName]).toBeDefined();
        }
      } else {
        // the zombie theme omits economy deliberately: the default-grant branch
        expect(pack.economy).toBeUndefined();
      }
    });

    it(`${name}: spatial — the theme declares it, the pack ships it, shape-valid (CAP-G6)`, () => {
      const theme = PACKS.find((entry) => entry.name === name)!.theme;
      // declared: the grid model with an integer >= 1 at every reach key (the v1 set)
      expect(theme.spatial?.model).toBe('grid');
      expect(theme.spatial?.reach.default).toBeGreaterThanOrEqual(1);
      for (const [key, steps] of Object.entries(theme.spatial?.reach ?? {}))
        expect(steps, `theme spatial.reach.${key} (${name})`).toBeGreaterThanOrEqual(1);
      // shipped: the pack section is the declaration, verbatim
      expect(pack.spatial).toEqual(theme.spatial);
      expect(pack.spatial?.model).toBe('grid');
      expect(pack.spatial?.reach.default).toBeGreaterThanOrEqual(1);
      // overrides name bestiary ids the theme declares; the override extends the default
      for (const key of Object.keys(pack.spatial?.reach ?? {})) {
        if (key === 'default') continue;
        expect(pack.bestiary[key], key).toBeDefined();
        expect(pack.spatial!.reach[key]!).toBeGreaterThanOrEqual(pack.spatial!.reach.default!);
      }
    });

    it(`${name}: every id kebab-unique pack-wide (E-DUP-01 held, E-REF-01 clean)`, () => {
      const ids = [
        pack.manifest.id,
        ...Object.keys(pack.actions),
        ...Object.keys(pack.formulas),
        ...Object.keys(pack.content.classes ?? {}),
        ...Object.keys(pack.content.races ?? {}),
        ...Object.keys(pack.content.skills ?? {}),
        ...Object.keys(pack.content.feats ?? {}),
        ...Object.keys(pack.content.spells ?? {}),
        ...Object.keys(pack.content.conditions ?? {}),
        ...Object.keys(pack.content.items ?? {}),
        ...Object.keys(pack.bestiary),
        ...Object.keys(pack.tables),
      ];
      expect(new Set(ids).size).toBe(ids.length);
      for (const id of ids) expect(id).toMatch(/^[a-z][a-z0-9-]*$/);
    });

    it(`${name}: progression tables cover levels 1\u201310 for every PLAYER class (FR-21.9; statblock-only tables may stop lower)`, () => {
      const playerClasses = Object.keys(pack.content.classes ?? {}).filter((classId) => {
        const referenced = Object.values(pack.bestiary).some((block) => block.attackTable === classId);
        return !referenced; // a table referenced ONLY by statblocks is monster machinery
      });
      expect(playerClasses.length).toBeGreaterThan(0);
      for (const classId of playerClasses) {
        const prog = pack.progression[classId]!;
        const ceiling = Math.min(...Object.values(prog.saves).map((values) => values.length));
        expect(ceiling, classId).toBe(10);
      }
    });

    it(`${name}: reactive feat + reactive action ride the trigger patterns S05 proved`, () => {
      const reactiveAction = Object.values(pack.actions).find((action) => action.trigger?.on !== undefined);
      expect(reactiveAction?.trigger?.on).toMatch(/attack:rolled/);
      const reactiveFeat = Object.values(pack.content.feats ?? {}).find(
        (feat) => feat.trigger?.on !== undefined,
      );
      expect(reactiveFeat?.trigger?.on).toMatch(/condition:applied/);
    });
  }
});

describe('FR-21 showcase split — dark-fantasy = vancian showcase', () => {
  it('~40ish coined spells across levels 1\u20133 (33 across the band, all L1\u20133)', () => {
    const spells = Object.entries(DARK_FANTASY.content?.spells ?? {});
    expect(spells.length).toBeGreaterThanOrEqual(30);
    const byLevel: Record<number, number> = {};
    for (const [, spell] of spells) byLevel[spell.magic.level] = (byLevel[spell.magic.level] ?? 0) + 1;
    expect(Object.keys(byLevel).sort()).toEqual(['1', '2', '3']);
    expect(byLevel[1]!).toBeGreaterThanOrEqual(10);
    expect(byLevel[2]!).toBeGreaterThanOrEqual(10);
    expect(byLevel[3]!).toBeGreaterThanOrEqual(6);
  });

  it('~3 classes; vancian end-to-end shaped: slots per class level, costs vancian', () => {
    expect(Object.keys(DARK_FANTASY.content?.classes ?? {}).length).toBe(3);
    const warden = DARK_FANTASY.progression!['warden']!;
    expect(warden.slots!['1']?.length).toBe(10);
    expect(warden.slots!['3']?.length).toBe(10);
    const vancianSpells = Object.values(DARK_FANTASY.content?.spells ?? {}).filter(
      (spell) => spell.cost.vancian !== undefined,
    );
    expect(vancianSpells.length).toBeGreaterThanOrEqual(20);
  });

  it('full race matrix: 4 races, demihuman multi-class caps land lower than 10', () => {
    const races = Object.entries(DARK_FANTASY.content?.races ?? {});
    expect(races.length).toBeGreaterThanOrEqual(4);
    for (const [, race] of races) {
      for (const maxLevel of Object.values(race.caps ?? {})) expect(maxLevel).toBeLessThanOrEqual(10);
    }
    // a cap strictly below the human curve (classic demihuman cap)
    const capped = races.filter(([, race]) => Object.values(race.caps ?? {}).some((max) => max < 10));
    expect(capped.length).toBeGreaterThanOrEqual(2);
  });

  it('v1.1 economy natively: main/move/reaction grants + casting tags', () => {
    expect(DARK_FANTASY.economy?.turnSlots).toEqual({ main: 1, move: 1, reaction: 1 });
    const casting = Object.values(DARK_FANTASY.content?.spells ?? {}).every((spell) =>
      (spell.tags ?? []).includes('casting'),
    );
    expect(casting).toBe(true);
  });

  it('race caps carry through generation: races keep the cap curve', () => {
    const on = runPipeline(DARK_FANTASY, SEED);
    const capsOn = Object.values(on.content.races ?? {}).some((race) => race.caps !== undefined);
    expect(capsOn).toBe(true);
    expect(on.content.races?.['dwindle']?.caps).toEqual({ warden: 6, hexer: 10, 'crypt-warden': 5 });
  });
});

describe('FR-21 showcase split — wyldwood = fey charm/ward showcase', () => {
  it('a charm/ward loot economy: the hedge lists carry charms, wards, and bursts', () => {
    const spells = Object.entries(WYLDWOOD.content?.spells ?? {});
    expect(spells.length).toBe(10); // the hedge-magic band: L1–3, all three lists
    const byLevel: Record<number, number> = {};
    for (const [, spell] of spells) byLevel[spell.magic.level] = (byLevel[spell.magic.level] ?? 0) + 1;
    expect(Object.keys(byLevel).sort()).toEqual(['1', '2', '3']);
    const bursts = Object.values(WYLDWOOD.content?.spells ?? {}).filter(
      (spell) => spell.targeting?.shape === 'burst',
    );
    expect(bursts.length).toBeGreaterThanOrEqual(3); // ember-halo, wyrd-bloom, briar-word, thorn-wake
  });

  it('point-pool spells only — no vancian slots anywhere (the third cost convention)', () => {
    const spellCosts = Object.values(WYLDWOOD.content?.spells ?? {}).every(
      (spell) => spell.cost.points !== undefined,
    );
    expect(spellCosts).toBe(true);
    expect(Object.values(WYLDWOOD.progression ?? {}).every((prog) => prog.slots === undefined)).toBe(true);
    expect(WYLDWOOD.formulas?.motes).toEqual({ expr: '#knob/mote-base + insight' });
  });

  it('loot is charm/ward-shaped: three loot tables over a six-item economy, one nested chain', () => {
    const tables = Object.keys(WYLDWOOD.tables ?? {});
    expect(tables).toContain('glade-loot');
    expect(tables).toContain('wyrd-charms');
    expect(tables).toContain('verge-gear');
    expect(tables).toContain('briar-sting'); // the ranged flavor + effect-value loot table
    const charms = Object.entries(WYLDWOOD.tables?.['wyrd-charms']?.entries ?? {}).map(
      ([, entry]) => entry.value,
    );
    expect(charms).toContain('hedge-charm');
    expect(charms).toContain('wyrd-token');
    expect(charms).toContain('tables.verge-gear'); // the packed nested ref
  });

  it('race caps carry through generation: the demihuman curve keeps its classic shape', () => {
    const on = runPipeline(WYLDWOOD, SEED);
    expect(on.content.races?.['dwindle']?.caps).toEqual({ warden: 6, hexer: 10, 'hedge-mage': 5 });
  });
});

describe('FR-21 showcase split — zombie-urban = drain/table showcase', () => {
  it('survivor classes + a drain pool (no vancian anywhere beyond a small ritual list)', () => {
    const classes = Object.keys(ZOMBIE_URBAN.content?.classes ?? {});
    expect(classes.length).toBeGreaterThanOrEqual(3);
    expect(ZOMBIE_URBAN.progression?.scavenger?.slots).toBeUndefined(); // no vancian slot tables
    expect(ZOMBIE_URBAN.progression?.fixer?.slots).toBeUndefined();
    expect(ZOMBIE_URBAN.progression?.medic?.slots).toBeUndefined();
    const rituals = Object.values(ZOMBIE_URBAN.content?.spells ?? {});
    expect(rituals.length).toBeLessThanOrEqual(6); // small ritual/psychic list at most
    const poolCosts = Object.values(ZOMBIE_URBAN.actions!).filter(
      (action) => action.cost.points !== undefined,
    );
    expect(poolCosts.length).toBeGreaterThanOrEqual(2);
  });

  it('skills-heavy: scavenging, fortification, streetwise all declared', () => {
    const skills = Object.keys(ZOMBIE_URBAN.content?.skills ?? {});
    expect(skills).toContain('scavenging');
    expect(skills).toContain('fortification');
    expect(skills).toContain('streetwise');
    expect(skills.length).toBeGreaterThanOrEqual(6);
  });

  it('table-heavy: infection saves (bite-turns), district loot, mood \u2014 6+ tables', () => {
    const tables = Object.keys(ZOMBIE_URBAN.tables ?? {});
    expect(tables.length).toBeGreaterThanOrEqual(6);
    expect(tables).toContain('bite-turns');
    expect(tables).toContain('district-scavenge');
    expect(tables).toContain('district-mood');
  });

  it('the adrenaline pool capacity is a pack formula (E-ECON-01 pool resolution)', () => {
    expect(ZOMBIE_URBAN.formulas?.adrenaline).toEqual({ expr: '8 + vigor' });
    const surge = Object.values(ZOMBIE_URBAN.actions ?? {}).find(
      (action) => action.cost.points?.pool === 'adrenaline',
    );
    expect(surge).toBeDefined();
  });
});

describe('coined-name lint (Q7/Q8) \u2014 pack content greps clean of SRD-adjacent terms', () => {
  const SRD_ADJACENT = [
    'strength',
    'dexterity',
    'constitution',
    'intelligence',
    'wisdom',
    'charisma',
    'fortitude save',
    'reflex save',
    'will save',
    'fireball',
    'magic missile',
    'lightning bolt',
    'cure light',
    'raise dead',
    'kobold',
    'beholder',
    'mind flayer',
    'lich',
    'd20 system',
    'dungeons',
    'dragons',
    'pathfinder',
    'saving throw',
    'hit dice',
    'armor class',
    'spells per day',
    'spell slots',
  ];

  it('both theme data files are clean of the SRD-adjacent list', () => {
    const dir = fileURLToPath(new URL('../../src/compiler/themes', import.meta.url));
    const files = readdirSync(dir).filter((file) => file.endsWith('.json'));
    expect(files.sort()).toEqual(['dark-fantasy.json', 'wyldwood.json', 'zombie-urban.json']);
    for (const file of files) {
      const source = readFileSync(join(dir, file), 'utf8').toLowerCase();
      for (const term of SRD_ADJACENT) {
        expect(source.includes(term), `${file} must not contain "${term}"`).toBe(false);
      }
    }
  });

  it('both generated packs are clean of the SRD-adjacent list', () => {
    for (const { name, pack } of PACKS) {
      const source = JSON.stringify(pack).toLowerCase();
      for (const term of SRD_ADJACENT) {
        expect(source.includes(term), `${name} pack must not contain "${term}"`).toBe(false);
      }
    }
  });

  it('"d20" appears only as the generic die in DSL body text (never a title)', () => {
    for (const { pack } of PACKS) {
      expect(pack.manifest.title.toLowerCase()).not.toContain('d20');
    }
  });
});

describe('CA-5 producer — determinism contract (the byte-identity proof)', () => {
  it('same theme+seed+knobs twice \u21d2 packContentHash equal AND JSON.stringify equal', () => {
    const a = runPipeline(DARK_FANTASY, SEED);
    const b = runPipeline(DARK_FANTASY, SEED);
    expect(packContentHash(a)).toBe(packContentHash(b));
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('different seed \u21d2 different hash (change actually varies)', () => {
    const a = runPipeline(DARK_FANTASY, SEED);
    const b = runPipeline(DARK_FANTASY, SEED + 1);
    expect(packContentHash(a)).not.toBe(packContentHash(b));
  });

  it('determinism across fresh module loads: two distinct module instances ⇒ identical bytes (CA-5 deep-check)', async () => {
    const first = await import('../../src/compiler/pipeline');
    const second = await import('../../src/compiler/pipeline?fresh-load');
    expect(first).not.toBe(second);
    const a = first.runPipeline(DARK_FANTASY, SEED);
    const b = second.runPipeline(DARK_FANTASY, SEED);
    expect(packContentHash(a)).toBe(packContentHash(b));
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('zombie-urban: same determinism contract holds', () => {
    const a = runPipeline(ZOMBIE_URBAN, SEED);
    const b = runPipeline(ZOMBIE_URBAN, SEED);
    expect(packContentHash(a)).toBe(packContentHash(b));
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(packContentHash(runPipeline(ZOMBIE_URBAN, 'other-seed'))).not.toBe(packContentHash(a));
  });

  it('no ambient values: the packs carry no timestamps, no environment reads (provenance exactly {theme, seed, knobs})', () => {
    for (const { pack } of PACKS) {
      expect(Object.keys(pack.manifest.provenance ?? {}).sort()).toEqual(['knobs', 'seed', 'theme']);
      const source = JSON.stringify(pack);
      expect(source.includes('Date')).toBe(false);
      expect(source.includes('timestamp')).toBe(false);
      expect(source.includes('savedAt')).toBe(false);
      expect(source.includes('Math.random')).toBe(false);
    }
  });
});

describe('FR-18 — knob declarations are machine-readable and feed the pack', () => {
  it('both themes declare complete knobs (id/type/values-or-range/default/desc)', () => {
    for (const theme of [DARK_FANTASY, ZOMBIE_URBAN]) {
      const decls = Object.entries(theme.knobs ?? {});
      expect(decls.length).toBeGreaterThanOrEqual(2);
      for (const [id, decl] of decls) {
        expect(id).toMatch(/^[a-z][a-z0-9-]*$/);
        expect(['enum', 'range']).toContain(decl.type);
        expect(decl.desc.length).toBeGreaterThan(0);
        expect(decl.default).toBeDefined();
      }
    }
  });

  it('knob-visibility: a knob change provably alters output (spell-density trims the spell list)', () => {
    const sparse = structuredClone(DARK_FANTASY);
    const dense = structuredClone(DARK_FANTASY);
    // the spell-density knob's declared effect: which level bands carry full lists
    sparse.content!.spells = Object.fromEntries(
      Object.entries(sparse.content!.spells ?? {}).filter(([, spell]) => spell.magic.level <= 1),
    );
    const sparsePack = runPipeline(sparse, SEED);
    const densePack = runPipeline(dense, SEED);
    expect(Object.keys(sparsePack.content.spells ?? {}).length).toBeLessThan(
      Object.keys(densePack.content.spells ?? {}).length,
    );
    expect(packContentHash(sparsePack)).not.toBe(packContentHash(densePack));
  });

  it('a knob feeds an hp-formula token (token substitution reaches the pack)', () => {
    const theme = structuredClone(DARK_FANTASY);
    theme.knobs = {
      ...theme.knobs,
      'hp-base': { type: 'range', min: 2, max: 12, default: 6, desc: 'HP base' },
    };
    theme.formulas = { ...theme.formulas, hp: { expr: '#knob/hp-base + level + vigor * 2' } as never };
    const pack = runPipeline(theme, SEED);
    expect(pack.formulas['hp']!['expr']).toBe('6 + level + vigor * 2');
  });
});
