# LIG-4 · Mobile-friendly Seed & Crystal

**Type:** User story
**Mode:** Seed & Crystal (M1 page, integrated in LIG-3)
**Status:** Ready for refinement
**Depends on:** LIG-3 (Seed & Crystal as the first game) — merged

---

## Story

**As a** player on a mobile phone,
**I want** Seed & Crystal to adapt its layout and controls to my screen and touch input,
**so that** I can actually see the 3D view and play the full place-keyframes → grow → score loop — today I only see the settings panel and the 3D view is hidden.

---

## Background & context

The M1 prototype ([seed_and_crystal_M1.html](../seed_and_crystal_M1.html)) is desktop-first. Reproduced at a phone viewport (375 × 812):

- The side panel has a **fixed `width:308px`** with `flex-shrink:0`, so on a 375 px screen the 3D viewer is crushed to a **~67 px sliver** — the "3D view is hidden" the player reports.
- The stage overlay card (`max-width:70%` of that sliver) collapses to **one character per line**, unreadable.
- The header hint describes **mouse** controls (左键 rotate · 右键 drag · 滚轮 zoom) — meaningless on touch — and wraps the header to three lines.
- **Zoom is wheel-only**; there is no pinch gesture. Orbit and paint use Pointer Events, so one-finger drag/tap mostly work by accident, but two-finger pinch does nothing.
- The keyframe strip and playbar survive smallish screens, but sliders and buttons are tight for touch.

The main Lightgrid app is already mobile-friendly (bottom control strips, touch handlers with tap/drag thresholds, pinch zoom), so this story brings the M1 page up to the same standard. Lightgrid itself needs no changes.

---

## Acceptance criteria

### AC1 — Viewer first on small screens
- **Given** a phone-sized viewport (~375 × 812, portrait),
- **Then** the 3D viewer is the dominant element — full width and at least ~half the viewport height — and is never clipped or reduced to a sliver.

### AC2 — Controls reachable, nothing lost
- **Given** the small-screen layout,
- **Then** every M1 control remains available: shape stamps, move/mirror, paint mode + layer slider, radius & strategy knobs, ▶ grow, score panel, keyframe strip (add/delete/select), play/stop/scrub/speed.
- **And** they are presented in a mobile pattern (collapsible bottom panel / sheet or accordion sections) instead of the fixed 308 px side column.

### AC3 — Touch gestures
- **Given** a touch device,
- **When** I use one-finger drag / two-finger pinch / tap,
- **Then** the view orbits / zooms / (in paint mode) toggles a voxel, with the same tap-vs-drag threshold feel as the main Lightgrid app.

### AC4 — Touch-appropriate hints
- **Given** a touch device (`pointer: coarse`),
- **Then** the header hint describes touch controls (drag to rotate · pinch to zoom · tap to paint) instead of mouse buttons, and the header fits without wrapping the brand.

### AC5 — Readable overlay
- **Given** the small-screen layout,
- **Then** the stage card (label / title / frame counter) and the colour legend are fully legible — no vertical one-character-per-line collapse.

### AC6 — Full loop playable on mobile
- **Given** a phone,
- **When** I stamp shapes / paint keyframes, press ▶ grow, and watch playback,
- **Then** the whole loop works end-to-end: worker solves, score panel shows F1/FP/FN, playback + scrub run smoothly.

### AC7 — Desktop unchanged
- **Given** a viewport wider than the breakpoint,
- **Then** the current desktop layout (viewer + 308 px side panel + keyframe strip + playbar) is pixel-for-pixel unchanged, and mouse controls behave as before.

---

## UX / interaction notes

- Follow the main app's pattern: canvas on top, controls as compact strips/sheets at the bottom, thumb-reachable.
- Suggested mobile structure (portrait): header (back link + brand) → viewer (flex-1) → keyframe strip → playbar → a collapsible "controls" sheet (editing / knobs / grow / score) that slides over the lower part of the viewer when opened.
- The ▶ grow button and the score should be visible without opening the sheet after a run (score can overlay as a card or toast).
- Keep touch targets ≥ ~40 px; the layer slider and scrub bar full-width.

## Technical notes (implementation pointers)

- **Breakpoint:** a single `@media (max-width: 720px)` (or similar) switching `.body` from row to column and re-homing `.side` content into the bottom sheet; the page already uses `100dvh` and `viewport-fit=cover`, so no meta changes needed.
- **Pinch zoom:** the page already uses Pointer Events with `setPointerCapture`; track a second active pointer and map pointer-distance delta onto `camR` (clamped 8–90 as the wheel handler does). Keep one-finger drag → orbit, tap (below move threshold) → paint.
- **Hint switching:** `matchMedia('(pointer: coarse)')` to choose the hint copy at load.
- **Overlay card:** raise/remove `max-width:70%` under the breakpoint (full-width card at the top of the viewer).
- **No engine changes:** the worker, solver, scoring, and keyframe model are untouched — this is layout + input only.

## Out of scope (future stories)

- Landscape-phone–specific layout (portrait is the target; landscape should merely not break).
- English localisation of the UI (tracked from LIG-3).
- Native-mode port into lightgrid.html (tracked from LIG-3).
- Save/share of keyframe sets from mobile.

## Open questions

- Bottom sheet vs. accordion under the viewer: sheet keeps the viewer maximal but hides controls behind a toggle; accordion keeps everything scrollable but shrinks the viewer. (Story assumes sheet — matches the main app's strip feel.)
- Exact breakpoint (720 px? 640 px?) and whether tablets (768 px portrait) get the mobile or desktop layout.
- Should paint mode get a dedicated mobile toggle button in the playbar area so it's reachable one-handed?

## Definition of Done

- [ ] AC1–AC7 pass at 375 × 812 (portrait phone) and at desktop width.
- [ ] Full loop verified on a touch device or touch emulation: stamp → paint → grow → score → playback.
- [ ] No console errors on either layout; no regression to the desktop experience or to Lightgrid.
- [ ] Screenshot evidence at mobile and desktop widths.
