# Design Spec — Ruleswright

> **Status:** draft for builder approval — Designer, phase `design`.
> Read with `specs/idea.md` and `specs/requirements.md` (approved). FR references throughout.

## The Adaptation That Governs This Spec

Ruleswright is a **headless library**: it ships no UI, owns no screens, and its
hosts own all presentation. So "design" here is not application UI — it is the
design of the **developer-facing surfaces** the requirements name:

1. **The docs** — the quickstart a developer copy-pastes (NFR-DX).
2. **The data contracts** — the pack document (FR-2/19/23), the combat/event
   stream (FR-4/10/13/14), the error surface (FR-2), and knob declarations
   (FR-17/18/20).

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

- All sample content is coined: the five named saves are **Vigor, Grace,
  Tenacity, Reason, Presence**; sample classes, races, and monsters are coined
  (Warden, Hexer, hillfolk, barrow-wight). No SRD names or statblock phrasing.
- "d20" appears only in body text as the generic die — never in a title or heading.
- Sample license metadata shows CC-BY-4.0 — carried and surfaced, never enforced (FR-2).

## Component Inventory

| Component | Description | States |
|---|---|---|
| Nav header | Index link · FR-reference chips | — |
| Button | Primary ember / secondary line / ghost | default, hover, active, disabled |
| Code block | Filename tab, language, copy affordance | default, copied |
| Output block | Expected result of a runnable example (verdigris `✓` lines) | — |
| JSON skeleton | Pack document shown section-by-section with annotations | — |
| Error card | Severity stripe · artifact id · JSON path · violated rule · hint | error, warning, info |
| Callout | Note / warning / success, single-icon lead | — |
| Event row | Typed combat event with provenance (`why`) | — |
| Contract chip | Small mono FR-numbered tag | — |
| Knob control | Select / range rendered from theme data | default, focus, disabled |
| Stat line | Mono key–value contract line (hash, version) | — |

## Screen Inventory

| Screen | Mock file | Purpose | FR |
|---|---|---|---|
| Design index / prototype hub | `mocks/index.html` | Links all surfaces; design-language strip; adaptation note | — |
| Quickstart | `mocks/quickstart.html` | Copy-paste path: generate → character → three rounds | FR-1, FR-17, NFR-DX |
| Pack anatomy | `mocks/pack-anatomy.html` | The pack document contract; overrides; schemaVersion | FR-2, FR-19, FR-23 |
| Combat loop | `mocks/combat-loop.html` | Stepwise lifecycle; event stream with provenance; snapshots | FR-4, FR-10, FR-13, FR-14 |
| Validation errors | `mocks/validation-errors.html` | Error-card gallery: reference, duplicate, formula, mismatch | FR-2, FR-14 |
| Theme knobs | `mocks/theme-knobs.html` | Knob declarations → host-rendered settings form; composition | FR-17, FR-18, FR-20 |

## User Flows

1. **Primary (docs reader):** index → quickstart → combat-loop — the
   copy-paste path from `generateCampaign` to a live, evented, resumable fight.
2. **Pack author:** index → pack-anatomy → validation-errors — author content;
   read loud, located errors; never a partial load.
3. **Theme user:** index → theme-knobs → pack-anatomy — render a settings form
   from theme data alone; regenerate byte-identical; override one artifact.

## Prototype Phase — Folded

The interactive-prototype phase is folded into `mocks/index.html` (hub +
cross-links between all five surfaces; every mock links back). A separate
click-through prototype adds nothing for a headless product.

## Non-Goals for This Phase

- No game UI, no character-sheet screens, no VTT surfaces — hosts own those.
- No framework code, no build tooling — Tailwind CDN, plain HTML, no JS beyond
  nothing (all states are visual; buttons are non-functional by contract).