# LIG-1 · Author custom seeds in the Garden

**Type:** User story
**Mode:** Garden (forward growth-form explorer)
**Status:** Ready for refinement

---

## Story

**As a** player,
**I want to** build my own seed in the Garden by placing (adding) and digging (deleting) individual cells, then choose any **Birth / Survival** rule to grow it,
**so that** I can explore what 3D forms emerge from shapes I design myself — not just the six preset forms and the fixed seed catalogue.

---

## Background & context

Today the Garden grows from a fixed **seed catalogue** (`point`, `dipole`, `triple`, `axial`, `ring`, `plate`) plus deterministic *random* seeds, selected in the design studio (✎). The player picks a seed and a Birth/Survival rule, and the lattice grows and classifies the form.

Separately, the **World / Chunks / Roam** modes already have a **place / dig** tool built on face-pick raycasting (`pickFace`) and a sparse edit overlay (`editPlacedByChunk` / `editRemoved`). This story brings that authoring interaction into the Garden so the *seed itself* becomes editable, closing the loop between "design a shape" and "design a rule".

The growth engine (`growFormFrames`), morphology classifier (`classifyForm`), and CG3 share codes already exist and are unchanged by this story — only the **seed** becomes player-authored.

---

## Acceptance criteria

### AC1 — Enter seed-editing mode
- **Given** I am in the Garden,
- **When** I open the design studio and choose **"custom seed"** (a new option alongside the preset seed chips),
- **Then** the view shows an editable seed canvas: the current seed cells are drawn, on an empty FCC lattice, paused (not growing).

### AC2 — Place a cell (add)
- **Given** I am editing a custom seed with the **place** tool active,
- **When** I tap a face of an existing cell (or the origin cell when the seed is empty),
- **Then** a new matter cell is added at the neighbouring FCC site through that face, and it appears immediately in the seed.

### AC3 — Dig a cell (delete)
- **Given** I am editing a custom seed with the **dig** tool active,
- **When** I tap a cell,
- **Then** that cell is removed from the seed immediately.
- **And** the seed is never allowed to become empty — digging the last remaining cell is a no-op (or re-seeds the origin), so growth always has something to start from.

### AC4 — Only valid FCC sites
- **Given** I am placing cells,
- **When** a candidate site is off the even-parity FCC sublattice ((x+y+z) is odd),
- **Then** it cannot be placed (face-pick only ever offers the 12 valid neighbours), so every authored seed is a legal FCC configuration.

### AC5 — Choose Birth / Survival and grow
- **Given** I have authored a custom seed,
- **When** I set a Birth rule and a Survival rule (the existing B/S k-grids) and press **grow**,
- **Then** the Garden runs `growFormFrames` on **my seed** with the chosen rule, plays the generations, and the morphology classifier names the resulting form — exactly as it does for preset seeds.

### AC6 — Determinism & reproducibility
- **Given** the same authored seed + the same B/S rule,
- **When** I grow it more than once,
- **Then** I get the identical sequence of frames and the identical classified form (the run is deterministic).

### AC7 — Edit ↔ grow round trip
- **Given** I have grown a custom seed,
- **When** I return to seed editing,
- **Then** my authored seed is preserved (not reset to a preset), and I can continue to place/dig and re-grow.

### AC8 — Discard / reset
- **Given** I am editing a custom seed,
- **When** I choose **clear seed**,
- **Then** the seed resets to a single origin cell, ready to build again.

---

## UX / interaction notes

- Reuse the established gestures: **drag** orbit · **pinch/wheel** zoom · **tap a block face** runs the active tool. Distinguish tap from drag with the existing movement/duration thresholds.
- Reuse the World mode **tool chips** (`place`, `dig`) and their active-state styling; the Garden gains a **"custom seed"** entry in the studio's seed row that switches strip A into place/dig mode.
- While editing, keep playback **paused** and auto-rotate on (or a gentle idle spin) so the player can inspect the seed from all sides.
- Render authored seed cells with the Garden's gold/`matGarden` body so editing reads visually the same as the grown result.
- Show a live cell count of the authored seed (e.g. in the meta row) so the player knows the seed size.

---

## Technical notes (implementation pointers)

- **Seed source:** add a `custom` seed code so `seedCellsOf('custom')` returns the player-authored cell list (a `Set<cellKey>` kept in module state), alongside the existing `SEEDS` catalogue and `r<base36>` random seeds.
- **Editing:** reuse `pickFace` for the raycast + 12-direction face match; add cells with the neighbour site, remove with the picked cell. A small dedicated matter store (or the existing `matter` set, scoped/cleared on entry) can back the editable seed; render via the existing ghost/instanced path.
- **Growth:** unchanged — `growFormFrames(B, S, steps, [...customSeedCells])` then `classifyForm(...)`. No engine changes required.
- **Parity guard:** face-pick already yields only `(±1,±1,0)`-type neighbours, so authored cells stay on the FCC sublattice automatically (AC4).
- **Non-empty guard:** dig checks `size > 1` before deleting (AC3).

---

## Out of scope (future stories)

- Encoding a custom seed into a **CG3 share code** / library save (the code format currently carries only catalogue + `r`-random seeds). Track separately.
- Undo/redo history for seed edits.
- Symmetry helpers (mirror-brush, radial stamping) while authoring.
- Importing a grown result back as a new seed.

## Open questions

- Should "custom seed" persist across mode switches within a session, or reset when leaving the Garden?
- Do we want a max seed-size cap to keep growth bounded, and if so what value?
- Should the growth-front **signals** arrows be shown during seed editing, or only after growing?

## Definition of Done

- [ ] AC1–AC8 pass in the Garden across desktop (mouse) and touch.
- [ ] No regression to preset seeds or the six form presets.
- [ ] Growth of an authored seed is deterministic (reproducible frames + classification).
- [ ] Verified in the browser preview; no console errors.
