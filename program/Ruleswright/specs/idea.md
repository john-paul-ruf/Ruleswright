# Idea — Ruleswright

> **Status:** approved by builder (phase gate passed). Revised: product renamed to **Ruleswright**; expression policy applied.
> **Author re-entry, 2026-10-16:** AR-01–AR-06 approved by “start” and “i authorize it”; this amendment describes contracts to implement, not delivered runtime capability.
> Internal repo codename: `d20-rpg-system` — internal paths are not published use.

## One-Sentence Summary

**Ruleswright is a headless TypeScript library that turns a one-line theme — "zombie urban," "dark fantasy" — into a complete, playable d20-style campaign, emitted as a JSON content pack consumed by an embeddable party / character / combat runtime.**

## Problem

Anyone who wants to run or embed a d20 tabletop game hits the same wall: the rules engine and the content are welded together. Commercial VTTs lock you into their ruleset and their UI; open rules repos are either SRD-scale text dumps with no runtime, or game-specific code where "zombie apocalypse" and "dark fantasy" require forking the source. The machinery of d20 — dice, characters, parties, combat rounds, saves, conditions — is identical across themes; only the content differs. Today, standing up a themed campaign means weeks of hand-authoring skills, feats, monsters, and tables before the first session, and every new theme pays that cost again.

## Vision

The product retains three independent layers and adds an opt-in play composition:

1. **Runtime engine** — theme-agnostic d20 machinery: seeded dice, character creation and progression, party management, and combat (initiative, action economy, attack rolls, saves, damage, conditions). It consumes a content pack; it has never heard of zombies.
2. **Content pack format** — a versioned JSON schema for everything the engine reads: skills, feats, classes and progressions, conditions, equipment, bestiary, lookup tables.
3. **Theme compiler** (the "mad lib" engine) — takes a *theme template* (itself JSON), generation knobs (threat level, tech level, tone), and a seed, and deterministically expands them into a complete content pack. `generateCampaign({ theme: "zombie-urban", seed: 42 })` yields Scavenging, Zombie Lore, Headshot, Infected, shambler bestiary entries, district encounter tables, and radio-broadcast flavor fragments. The same call with `dark-fantasy` yields Arcana, Hexcraft, cursed-item tables, omen tables, fae. Themes are data — the two sample themes shipped in v1 exist to prove the format, not as hard-coded features.

4. **Headless play composition** — random encounter sessions, finite generated adventures with explicit routes/objectives/rewards, and an optional offline solo director. Hosts choose player actions and loot recipients; deterministic enemies and factual narration use authored data. Whole-session saves preserve injuries, conditions, resources, pending decisions and receipts without engine I/O. Adventure templates and definitions are separate pack-bound documents; existing packs need no new fields.

The design principle that makes everything else cheap: **rules are data.** Combat actions, maneuvers, conditions, and damage types live in the pack, not in engine code. The engine is a rules *interpreter*; the compiler is a content *generator*; both are extended by writing JSON.

Every generated artifact is plain JSON the host can inspect, hand-edit, or layer overrides onto — the GM always has the last word, and regeneration is deterministic per seed. The library computes and validates; the host app owns storage and UI.

## Target User

- **Primary:** GM-developers (starting with the builder) who want to spin up themed d20 campaigns and run them inside their own apps — web, Electron, or Node tools.
- **Secondary:** Developers who want just the runtime engine and will hand-author their own content packs.
- **Tertiary:** Toolmakers building digital tabletops, character builders, or campaign managers on top of a rules runtime they don't have to maintain.

## Key Features (high-level)

1. **Headless runtime engine** — seeded dice, character management (creation, progression, inventory), party management (composition, shared state), combat management (initiative, turns, action economy, attack/save/damage resolution, conditions), all theme-agnostic and event-emitting.
2. **Content pack format** — one versioned JSON schema covering rules content, bestiary, and tables; hand-authored packs are first-class citizens.
3. **Theme compiler** — JSON theme templates + knobs + seed → full deterministic pack, via a pluggable generation pipeline.
4. **Campaign bootstrap** — one call from theme to playable campaign pack.
5. **Override layers** — generated content can be inspected, edited, and layered over by host or GM without forking anything.
6. **Random adventures without a UI** — manually drive an encounter or an entire finite adventure, optionally let a bounded solo director handle enemies, and resume a whole aggregate from JSON.
7. **Extensibility by construction** — the v2 reaches below are deferred, not rejected; v1 ships the seams they will grow through (see Extension Commitments).

## Non-Goals (v1) — deferred, not rejected

- **Unbounded or model-generated stories** remain deferred. The approved random-adventures scope adds finite authored graph construction and offline event narration; it selects authored alternatives, never interprets prose as rules. No model/provider integration is selected.
- **Additional combat mechanisms** beyond the approved pack-driven core remain deferred. Existing movement reactions, single/burst targeting and grid/hex support remain intact; this amendment adds no death/injury system or automatic healing.
- **No UI, no persistence** — the library computes, validates, and serializes state; the host app stores it and renders it.
- **No SRD text shipped** — the pack format is SRD-*shaped* so SRD-style content can be authored into it; the sample themes ship original content only.
- **No VTT integration** — host applications integrate on their own terms via the library's API and events.

## Extension Commitments

These are v1 design commitments, made so the v2 reaches are content and schema work rather than rewrites:

1. **Rules are data.** Action economy, maneuvers, conditions, and damage types are defined in the content pack. New combat behaviors are new pack entries (plus, at most, schema extensions) — never engine rewrites.
2. **Versioned pack schema with a migration path.** v2 schema evolution must not strand v1 packs.
3. **Pluggable generator stages.** The compiler is a pipeline of named stages (skills → feats → bestiary → tables → flavor → …) behind a stable interface, so a future narrative/campaign-structure stage slots in without touching existing stages.
4. **Themes compose.** Themes can inherit and merge from other themes; a new theme is JSON, not code.
5. **Evented runtime.** Combat and party operations emit typed events, so future consumers (narrative directors, UIs, analytics, replays) observe the game without forking the engine.

## Open Questions (for requirements)

- How granular is the v1 JSON action economy (fixed slot types vs. fully generic action definitions)?
- Character model depth in v1: classes + levels only, or background/origin hooks too?
- How large do the two sample themes need to be to prove the format without bloating v1?
- Exact shape of the serialized state contract the host persists (save/load boundary).
- Packaging/distribution shape: one package vs. split runtime / compiler / sample packs.
- Seeded RNG and the primary-user framing are encoded as proposed in this draft — confirm or object.

---

*Phase gate: passed — builder approved; the requirements phase has consumed these questions.*
