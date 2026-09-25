# Design Spec — Ruleswright

> **Status:** v2, draft for builder approval — Designer, phase `design`.
> v1 covered five surfaces; the builder asked for **exhaustive**: every
> functional requirement now has at least one designed surface (18 mocks, one
> hub). Read with `specs/idea.md` and `specs/requirements.md` (approved).
> FR references throughout; the coverage ledger is at the bottom.

## The Adaptation That Governs This Spec

Ruleswright is a **headless library**: it ships no UI, owns no screens, and its
hosts own all presentation. So "design" here is not application UI — it is the
design of the **developer-facing surfaces** the requirements name:

1. **The docs** — the quickstart a developer copy-pastes (NFR-DX).
2. **The data contracts** — the pack document, the combat/event stream, the
   error surface, snapshots, knob declarations, the public API's coverage.

Each mock is therefore a **DX contract, not an implementation target** — no
UI-Coder sessions exist downstream for this product. Coder and Planner read
these mocks as the shape the docs and examples must take; Architect reads them
as constraints on the API and pack schema. Code snippets inside mocks are
marked **API illustrative**: Architect owns final signatures. What is being
specced is the *experience* — what a developer sees, reads, and copies.

## Design Language

Workbench-and-rulebook character: dark-first, warm, mono-forward. A forge for
rules, not a toy.

- **Color palette** (dark-first):
  - Ink `#1A1714` — page ground (warm near-black; never pure black)
  - Surface `#241F1A` — cards, code blocks
  - Surface-raised `#2C261F` — hover/active panels, tabs
  - Line `#3A322A` — borders, dividers
  - Parchment `#E8E2D6` — primary text
  - Faded `#9A8F7E` — secondary text, captions, annotations
  - Ember `#D9843B` — accent: primary actions, keywords, focus
  - Ember-deep `#B45F22` — pressed/active accent
  - Verdigris `#7BA05B` — success, strings, validation pass
  - Kiln `#C4523E` — errors, refusal
  - Steel `#6A93A8` — informational, JSON paths, event metadata
- **Typography** (system stacks only — mocks stay network-light beyond Tailwind):
  - Display: Georgia / Iowan Old Style serif — rulebook voice, headings only
  - Body: system-ui sans, 15–16px
  - Data: ui-monospace / SF Mono / Menlo / Consolas — every JSON, path, roll,
    event line is mono. If it's a contract, it's mono.
  - Scale: 12 / 13 (code) / 14 / 16 / 20 / 28 / 40
- **Spacing:** 4px base; scale 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64
- **Corner radius:** cards & code blocks 6px · buttons/inputs 4px · chips 3px
- **Shadow system:** level 0 none · level 1 `0 1px 3px rgb(0 0 0 / .4)` ·
  level 2 `0 4px 16px rgb(0 0 0 / .5)` · focus is a 2px Ember ring, never a shadow

## Expression Policy in Mock Copy (Q7/Q8)

- All sample content is coined: the six abilities are **might, grace, vigor,
  reason, insight, presence**; the five named saves are **vigor, grace,
  tenacity, reason, presence**; sample classes, races, monsters, spells, and
  conditions are coined (Warden, Hexer, hillfolk, barrow-wight, grave-light,
  sapped). No SRD names or statblock phrasing anywhere in mock copy.
- "d20" appears only in body text as the generic die — never in a title or heading.
- Sample license metadata shows CC-BY-4.0 — carried and surfaced, never enforced (FR-2).
- Ability and save names are used **consistently across all eighteen mocks** —
  v2 swept the v1 drafts for vocabulary drift (`+str` → `+ might`; the error
  gallery now lists all six abilities).

## Component Inventory

| Component | Description | States |
|---|---|---|
| Nav header | Index link · FR-reference chips | — |
| Button | Primary ember / secondary line / ghost | default, hover, active, disabled |
| Code block | Filename tab, language, copy affordance, syntax-tint classes | default, copied |
| Output block | Expected result of a runnable example (verdigris `✓` lines) | — |
| JSON skeleton | Pack document shown section-by-section with annotations | — |
| Error card | Severity stripe · artifact id · JSON path · violated rule · hint | error, warning, refused, pass |
| Callout | Note / warning / success, single-icon lead (✓ ✕ ◈ ▲) | — |
| Event row | Typed combat event with provenance (`why`) | — |
| Contract chip | Small mono FR-numbered tag | — |
| Knob control | Select / range rendered from theme data | default, focus, disabled |
| Stat line | Mono key–value contract line (hash, version) | — |
| Lifecycle strip | Numbered step cards joined by arrows (turn loop, slot loop, stage chain) | — |
| Data table | Pack progression / recipe / policy tables in mono | — |

## Screen Inventory (18 surfaces + hub)

| # | Screen | Mock file | Purpose | FR |
|---|---|---|---|---|
| 01 | Quickstart | `mocks/quickstart.html` | Copy-paste path: generate → character → three rounds | FR-1, FR-17, NFR-DX |
| 02 | Quickstart, annotated | `mocks/quickstart-annotated.html` | Same steps, requirements pinned to each line | NFR-DX |
| 03 | Dice & determinism | `mocks/dice.html` | Injectable seeded RNG; structured rolls; dice recipes; RNG state in snapshots | FR-1, FR-14, NFR-Det. |
| 04 | Stats & abilities | `mocks/pack-stats.html` | Name-keyed abilities/saves; formula DSL; plain-JSON character; illegal builds | FR-5, FR-3, FR-14 |
| 05 | Pack anatomy | `mocks/pack-anatomy.html` | The pack document contract; overrides; schemaVersion | FR-2, FR-19, FR-23 |
| 06 | Progression & multi-class | `mocks/progression.html` | Pack tables; XP events; dual leveling paths; multi-class; caps | FR-6, FR-13, FR-14 |
| 07 | Conditions | `mocks/conditions.html` | Durations, stacking policies, `restricts`; condition events | FR-7, FR-4, FR-13 |
| 08 | Magic — no subsystem | `mocks/magic.html` | Vancian + drain on one engine; slot lifecycle; targeting; restrictions | FR-8, FR-9, FR-11 |
| 09 | Combat loop | `mocks/combat-loop.html` | Stepwise lifecycle; event stream with provenance; snapshots | FR-4, FR-10, FR-13, FR-14 |
| 10 | Spatial layer | `mocks/spatial.html` | Opt-in positions/adjacency/reach; theater-of-mind pays nothing | FR-11, FR-4, FR-7 |
| 11 | Triggered actions | `mocks/triggers.html` | Reactions as data on the event substrate; FR-12 proof 2 | FR-4, FR-12, FR-13 |
| 12 | Snapshots & persistence | `mocks/snapshots.html` | Three serializers; resume test; loud refusal; no-I/O boundary | FR-14, FR-1, FR-23 |
| 13 | Validation errors | `mocks/validation-errors.html` | Error-card gallery: ref, dup, formula, spatial, snapshot mismatch | FR-2, FR-5, FR-14 |
| 14 | Bestiary & encounters | `mocks/bestiary-encounters.html` | Same-machinery statblocks; one table engine; deterministic assembly | FR-15, FR-16 |
| 15 | Generation pipeline | `mocks/generation-pipeline.html` | Named stages; two sample themes; determinism contract | FR-17, FR-15, FR-21 |
| 16 | Theme knobs & composition | `mocks/theme-knobs.html` | Knob declarations → host-neutral form; base + patches | FR-17, FR-18, FR-20 |
| 17 | Packaging & surfaces | `mocks/packaging.html` | Runtime/schema/compiler; runtime-only CI proof; DX; versioning | FR-22, FR-23, NFR-Dep. |
| 18 | API map | `mocks/api-map.html` | Whole public library on one page — coverage, not signatures | all FRs |
| — | Design index / hub | `mocks/index.html` | Grouped links, flows, design-language strip | — |

## User Flows

1. **Primary (docs reader):** quickstart → annotated → dice → combat-loop —
   the copy-paste path from `generateCampaign` to a live, evented, resumable fight.
2. **Pack author:** pack-anatomy → stats → progression → conditions → magic →
   validation-errors — author content; read loud, located errors; never a partial load.
3. **Theme user:** theme-knobs → generation-pipeline → pack-anatomy — render a
   settings form from theme data alone; regenerate byte-identical; override one artifact.
4. **Systems reader:** combat-loop → spatial → triggers → snapshots — the
   combat spine end to end, including the reactive seam.
5. **Evaluator:** packaging → api-map → index coverage ledger — three surfaces,
   one page of API, proof every requirement is exercised.

## FR Coverage Ledger

Every functional requirement is exercised by at least one surface:

FR-1 → 03/09/12 · FR-2 → 05/13 · FR-3 → 04/09 · FR-4 → 07/09/10/11 ·
FR-5 → 04/13 · FR-6 → 06 · FR-7 → 07/10 · FR-8 → 08/12 · FR-9 → 08 ·
FR-10 → 09 · FR-11 → 08/10 · FR-12 → 07/08/11 · FR-13 → 06/07/09/11 ·
FR-14 → 03/04/06/09/12/13 · FR-15 → 14/15 · FR-16 → 14 · FR-17 → 01/15/16 ·
FR-18 → 16 · FR-19 → 05 · FR-20 → 16 · FR-21 → 15 · FR-22 → 17 ·
FR-23 → 05/12/17 · NFR-DX → 01/02/17 · NFR-Determinism → 03/15 ·
NFR-Dependencies → 17 · NFR-Security → 13

## Prototype Phase — Folded

The interactive-prototype phase is folded into `mocks/index.html` (grouped hub
+ cross-links between all eighteen surfaces; every mock links back, and the
footers thread a linear reading order). A separate click-through prototype
adds nothing for a headless product.

## Non-Goals for This Phase

- No game UI, no character-sheet screens, no VTT surfaces — hosts own those.
- No framework code, no build tooling — Tailwind CDN, plain HTML, vanilla JS
  only (all states are visual; buttons are non-functional by contract).