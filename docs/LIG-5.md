# LIG-5 · Ship the updated Seed & Crystal (M2) with Turing computation demos

**Type:** User story
**Mode:** Seed & Crystal (standalone page, integrated in LIG-3, mobile-friendly since LIG-4)
**Status:** Ready for refinement
**References:** [seed_and_crystal_M2.html](../seed_and_crystal_M2.html) · [docs/fcc_single_rule_turing.docx](fcc_single_rule_turing.docx) (bundled paper: FCC single-rule Turing completeness + oscillator constructions)

---

## Story

**As a** player,
**I want** Lightgrid to serve the updated Seed & Crystal (M2) — with the new Turing computation demos — as the first game,
**so that** I can play the logic/redstone constructions (gun, NOT/AND/NAND with live truth demos, rotor clocks, the reversible clock gun) alongside the original keyframe-growth sandbox.

---

## Background & context

**What M2 adds.** The M2 prototype (`seed_and_crystal_M2.html`, untracked in the repo root) extends M1 from a single game into three modes:

- **沙盒 Sandbox** — the M1 keyframe-growth loop, unchanged (stamp/paint keyframes → grow → F1/FP/FN score).
- **关卡 Puzzle** — predefined levels (`LEVELS`) with a start and goal frame, waypoint insertion, reset, and level descriptions.
- **逻辑/红石 Logic/redstone** — a fixed-rule autonomous CA running the bundled paper's constructions *at their original coordinates*: the light-speed **Gun**, **NOT / AND / NAND** gate presets with a single-gate **live truth-table demo**, a circuit kit (latch, clock, fanout), the oscillator family (reflector, rotor clocks of period 2/4/6, the in-place **clock gun**, the dual-frequency **clock bank** "digital core"), and two mandala art presets.

The paper ([fcc_single_rule_turing.docx](fcc_single_rule_turing.docx)) proves the FCC 12-direction lattice admits a single bijective non-conservative rule — the 3-cycle `rt[A]=A+B, rt[A+B]=B+C, rt[B+C]=A` — that is Turing complete (gun + composable AND/NOT, NAND verified), which is exactly what the logic mode demonstrates interactively.

**The gap.** M2 was forked from the **pre-LIG-4** M1 file, so as it stands it:

- **lacks the LIG-3 integration** (no "← Lightgrid" back link);
- **lacks all LIG-4 mobile work** — fixed 308 px side panel again (3D view crushed on phones), no bottom sheet, no pinch zoom, no touch hints, no mobile score card;
- still **brands itself "M1"** in the `<title>`, header logo, and version chip.

Lightgrid's nav and the `/seed` rewrite currently point at `seed_and_crystal_M1.html`. This story ships M2 as the version players get, with the LIG-3/LIG-4 work re-applied so nothing regresses.

---

## Acceptance criteria

### AC1 — Nav serves M2
- **Given** I tap the first nav entry (❖ Seed & Crystal) in Lightgrid,
- **Then** the M2 page opens, with the three-mode switch (沙盒 / 关卡 / 逻辑红石) available.

### AC2 — Route serves M2
- **Given** the deployed site,
- **Then** `/seed` serves the M2 page.

### AC3 — Turing demos playable
- **Given** the 逻辑/红石 mode,
- **When** I select each preset (Gun, NOT, AND, NAND, latch, clock, fanout, reflector, rotor 2/4/6, clock gun, dual-frequency clock bank, mandalas),
- **Then** it loads at the paper's coordinates and runs (play/step/reset), with the preset's explanatory note shown,
- **And** the single-gate truth demo lets me set inputs and see the correct gate output live.

### AC4 — Puzzle mode playable
- **Given** the 关卡 mode,
- **Then** I can pick a level, see its description, grow start → goal, insert waypoints, and reset the level.

### AC5 — Sandbox unchanged
- **Given** the 沙盒 mode,
- **Then** the full M1 loop works exactly as before (shapes, paint, move/mirror, knobs, grow, score, keyframes, playback).

### AC6 — LIG-3 integration re-applied
- **Given** the M2 page,
- **Then** it has the "← Lightgrid" back link in the header, styled as in M1.

### AC7 — LIG-4 mobile work re-applied
- **Given** a phone viewport (~375 × 812),
- **Then** the LIG-4 acceptance criteria hold on M2: full-width viewer (no 308 px sliver), controls in the slide-up sheet (including the new mode switch, level and logic sections), ⚙ / ▶ floating buttons, mobile score card, pinch zoom, tap paint, touch hints, readable overlay,
- **And** desktop stays unchanged above the breakpoint.

### AC8 — Branding says M2
- **Given** the M2 page,
- **Then** the `<title>`, header logo roman numeral, and version chip read M2 (and describe the expanded scope).

### AC9 — Docs committed, no regressions
- **Given** the repository,
- **Then** `seed_and_crystal_M2.html` and `docs/fcc_single_rule_turing.docx` are committed,
- **And** Lightgrid's seven in-app modes and the rest of the page are unaffected.

---

## UX / interaction notes

- The mode switch (沙盒/关卡/逻辑红石) lives at the top of the side panel — on mobile it's the first thing in the sheet, so switching modes is one ⚙ tap away.
- Logic mode is autonomous (no grow-solve step): the ▶ floating grow button should map to the logic ▶ run control when logic mode is active, or hide if that's cleaner — pick during implementation.
- Keep the M1 page untouched at its URL for now (see open questions).

## Technical notes (implementation pointers)

- **Re-apply LIG-4 to M2:** the LIG-4 commit (`f5121b5`) is a small, well-anchored diff (CSS block after `.busy`/backlink rules, FAB + mobScore HTML, multi-pointer handlers, sheet wiring before `// init`). M2 kept M1's structure for all those anchors, so the diff should apply nearly cleanly — but M2's side panel has new sections (mode switch, levelBox, logicBox) that live inside `.side` and inherit the sheet behaviour for free. Verify the logic-mode controls are reachable in the sheet.
- **Re-apply LIG-3:** copy the `.backlink` CSS + `<a>` from M1.
- **Pointers:** update the Lightgrid nav button href and the `/seed` rewrite destination to `seed_and_crystal_M2.html`.
- **Mobile grow FAB in logic mode:** logic mode uses its own run/step/reset controls (`logicPlay` etc.); gate the FAB's action (or visibility) on the current mode.
- **No engine work:** sandbox worker, puzzle levels, and the logic CA are all self-contained in the M2 file.

## Out of scope (future stories)

- Merging M1/M2 into one canonical `seed_and_crystal.html` filename (URL scheme decision).
- English localisation; native-mode port into lightgrid.html (tracked since LIG-3).
- New puzzle level content, level progression/saving, or leaderboards (design doc M3).
- Committing `docs/cosmic_grid_fcc_convention.docx` (the direction-convention spec the paper cites) — include here if desired.

## Open questions

- Keep `seed_and_crystal_M1.html` in the repo (reachable by direct URL, zero maintenance) or delete it now that M2 supersedes it? (Story assumes keep.)
- Should `/seed` keep pointing at a milestone-named file, or is this the moment to rename to `seed_and_crystal.html` and make future milestones in-place updates?
- Should the ❖ nav label mention the new content (e.g. "Seed & Crystal II")?

## Definition of Done

- [ ] AC1–AC9 pass on desktop and at 375 × 812.
- [ ] Every logic preset runs without console errors; truth demo outputs match the gate tables.
- [ ] Mobile: full loop in all three modes verified in the sheet layout.
- [ ] `/seed` serves M2 on the Vercel deployment.
