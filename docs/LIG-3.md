# LIG-3 · Integrate Seed & Crystal (M1) as the first game

**Type:** User story
**Mode:** new — Seed & Crystal (keyframe-growth prototype M1)
**Status:** Ready for refinement
**References:** [seed_and_crystal_M1.html](../seed_and_crystal_M1.html) · [docs/seed_and_crystal_design.docx](seed_and_crystal_design.docx) (design doc v0.1)

---

## Story

**As a** player,
**I want** Lightgrid to integrate the **Seed & Crystal M1** prototype as the **first game** in the app,
**so that** I can try the keyframe-growth game (place sparse voxel keyframes → the engine grows one into the next via a solved rule sequence → get scored) alongside the existing modes.

---

## Background & context

**Seed & Crystal** is the playable M1 milestone of the "种子与晶体" design doc: the player places 2+ sparse FCC voxel keyframes; a Web-Worker engine solves a translation-invariant emission-rule sequence per keyframe pair and *grows* the previous frame into the next, cellular-automaton style. Scoring follows the design doc's formula (Σ F1 − heavy FP penalty − light FN penalty − keyframe count − receptive-field tier), with the radius-1/radius-2 × precise/majority knobs as the "precision ↔ emergence" mechanic.

Today it lives as a standalone single-file prototype (`seed_and_crystal_M1.html`, untracked in the repo root) with its own layout: 3D viewer + side panel (keyframe editor, engine knobs, grow button, score panel) + keyframe strip + playbar. It shares Lightgrid's visual language (Cosmic Grid dark theme, same CSS variables) and the **same Three.js r128 from cdnjs** (global build; Lightgrid uses the module build via importmap).

Lightgrid is itself one file (`lightgrid.html`, served at `/` by a Vercel rewrite) with seven modes in a nav strip: Deck · Garden · Workshop · World · Logic · Chunks · Roam. The M1 prototype's desktop side-panel layout and Web Worker do **not** fit Lightgrid's mode/HUD architecture, so this story integrates it as a **linked standalone page** — first entry in the nav — rather than porting it to an eighth in-page mode (that port is a future story).

---

## Acceptance criteria

### AC1 — First position in the nav
- **Given** I open Lightgrid,
- **Then** the mode nav shows **Seed & Crystal** as the **first** entry, before Deck, with its own glyph (e.g. ❖),
- **And** the existing seven modes keep their order after it.

### AC2 — Entering the game
- **Given** I tap **Seed & Crystal** in the nav,
- **Then** the Seed & Crystal M1 page opens and is fully playable: shape stamps (ball / rod / L / torus / blob), paint mode with layer slider, move/mirror, keyframe strip (add / delete / select), radius & strategy knobs, ▶ grow (worker solve), score panel (F1 / FP / FN / keyframes / steps), and playback with scrub + speed.

### AC3 — Way back
- **Given** I am in Seed & Crystal,
- **When** I use its back affordance (a "← Lightgrid" link in the header),
- **Then** I return to Lightgrid.

### AC4 — Direct URL
- **Given** the deployed site,
- **Then** the game is reachable at a clean route (e.g. `/seed`) via a Vercel rewrite, so the game can be linked/shared directly, and `/` still serves Lightgrid.

### AC5 — Repo & deploy
- **Given** the repository,
- **Then** `seed_and_crystal_M1.html` is committed (it is currently untracked) and deploys with the site; the design doc stays in `docs/`.

### AC6 — Prototype behaviour unchanged
- **Given** the integrated page,
- **Then** the M1 gameplay is byte-for-byte the prototype's behaviour except for the added back affordance — same engine (radius-1/2, precise/majority), same scoring formula, same default two-ball demo keyframes.

### AC7 — No regression to Lightgrid
- **Given** the nav change,
- **Then** all seven existing modes still load and behave as before (including Garden custom seeds from LIG-1 and free rules from LIG-2), on desktop and touch.

---

## UX / interaction notes

- Nav entry styled like the other mode buttons (glyph + label) so it reads as a peer game, not an external link; since it navigates away, it should **not** show as an "active mode" state.
- Add the "← Lightgrid" back link in the M1 header bar (there is free space next to the brand/hint), styled with the shared Cosmic Grid look.
- Warn-free navigation: leaving Lightgrid drops in-memory session state (e.g. an unshared Garden custom seed). Acceptable for M1 — see open questions.

## Technical notes (implementation pointers)

- **Nav:** the mode buttons are built in Lightgrid's nav strip; prepend a button whose handler does `location.href='/seed'` (or the file name locally) instead of `switchMode(...)`. Keep it out of the active-mode toggle logic.
- **Routing:** extend `vercel.json` rewrites: `{ "source": "/seed", "destination": "/seed_and_crystal_M1.html" }` alongside the existing `/` → `lightgrid.html`. Local dev (`python3 -m http.server`) can use the direct file name — the nav link should work in both (relative link `seed_and_crystal_M1.html` works everywhere; `/seed` only on Vercel — prefer the relative link).
- **Back link:** one `<a>` in the M1 `.head`, `href="./"` (serves Lightgrid on Vercel; directory listing locally is acceptable, or point at `lightgrid.html`).
- **No engine/UI merge:** Three.js stays duplicated (global r128 in M1, module r128 in Lightgrid) — they are separate pages; no importmap work needed.
- **External deps of M1:** Google Fonts + cdnjs, same class of dependency Lightgrid already has.

## Out of scope (future stories)

- Porting Seed & Crystal into `lightgrid.html` as a native eighth mode (shared renderer/HUD).
- English localisation of the M1 UI (currently Chinese) / bilingual toggle.
- Mobile layout for the M1 side panel (fixed 308 px side column; desktop-first prototype).
- Puzzle level packs, sandbox GIF export, daily-challenge ladder (design doc M2/M3).
- Share codes / serialization of keyframe sets.

## Open questions

- Should Seed & Crystal also be the **default landing view** at `/`, or only the first nav entry? (Story assumes first-nav-entry only; `/` keeps serving Lightgrid.)
- Rename the file to drop the `_M1` suffix (`seed_and_crystal.html`) now, or keep the milestone name until M2?
- Is losing Lightgrid's in-memory state (unshared custom seed, current run) on navigation acceptable, or should the nav entry open the game in a new tab?
- Should the nav label be English ("Seed & Crystal"), Chinese ("种子与晶体"), or both?

## Definition of Done

- [ ] AC1–AC7 pass on desktop (mouse) and touch.
- [ ] `/seed` route works on the Vercel deployment; `/` unchanged.
- [ ] `seed_and_crystal_M1.html` committed and playable from the deployed site.
- [ ] No console errors on either page; no regression to the seven Lightgrid modes.
