# LIG-6 · OpenRC F1 (fcc-car) as the Lightgrid home page

**Type:** User story
**Mode:** new — fcc-car (OpenRC F1 · Livery / Assembly)
**Status:** Ready for refinement
**References:** [fcc_car.html](../fcc_car.html)

---

## Story

**As a** player,
**I want** fcc-car (OpenRC F1) to be the **home page** of Lightgrid — the first thing that loads at `/`,
**so that** landing on the site drops me straight into painting and assembling the FCC voxel racecar, with Lightgrid and its other games still one tap away.

---

## Background & context

**What fcc-car is.** `fcc_car.html` (untracked in the repo root) is a self-contained 3D toy titled **"OpenRC F1 · 涂装装配" (Livery / Assembly)**: an FCC voxel racecar the player can **paint** and **re-assemble**. It has:

- a **paint mode** — a 10-swatch palette + custom colour picker, and tools **face / cell / part / eyedropper / erase**, with **undo** (40-deep) and a live painted-face count;
- a **move mode** — drag parts to reposition them, snapping to the even-parity FCC sublattice;
- **base colour** toggle (per-part hue vs. plain), **auto-spin**, and **reset paint / reset layout**;
- **persistence** via `window.storage` (`carlivery` = painted faces, `carlayout` = part offsets), so a livery survives reloads in the Claude app;
- touch support already built in (drag to paint · rotate on empty space · two-finger pinch to zoom) and a small `@media (max-width:620px)` rule.

It shares Lightgrid's stack — **Three.js r128 from the same cdnjs URL** — and the Cosmic Grid dark aesthetic, though with its own palette variables and a bottom control panel (not Lightgrid's mode nav).

**Today's routing.** `vercel.json` serves `/` → `lightgrid.html` and `/seed` → `seed_and_crystal_M2.html`. Lightgrid's nav lists eight entries (Seed & Crystal, Deck, Garden, Workshop, World, Logic, Chunks, Roam); the games are sibling pages reached from that nav, each with a "← Lightgrid" back link.

**This story** makes fcc-car the landing page: `/` serves fcc-car, Lightgrid moves to its own clean route, and the two are cross-linked so nothing becomes unreachable. This is a routing + linking change; the car's gameplay is unchanged.

---

## Acceptance criteria

### AC1 — fcc-car is the home page
- **Given** the deployed site,
- **When** I open `/`,
- **Then** fcc-car (OpenRC F1) loads and is fully playable.

### AC2 — fcc-car plays fully
- **Given** the home page,
- **Then** paint mode (palette, custom colour, face/cell/part/eyedropper/erase, undo, painted count), move mode (drag parts, FCC snap), base-colour toggle, auto-spin, reset paint, reset layout, and `window.storage` persistence all work as in the standalone file.

### AC3 — Get to Lightgrid from the car
- **Given** I am on the fcc-car home page,
- **When** I use a visible "Lightgrid" affordance (a link/button in the header area, styled to match),
- **Then** I go to the Lightgrid app.

### AC4 — Lightgrid still reachable and intact
- **Given** the site,
- **Then** Lightgrid is served at a clean route (e.g. `/grid`) and behaves exactly as before — all eight modes, Garden custom seeds (LIG-1) and free rules (LIG-2), and the Seed & Crystal game link.

### AC5 — Get to the car from Lightgrid
- **Given** the Lightgrid app,
- **Then** fcc-car is reachable from it (e.g. an ❖-style nav entry alongside Seed & Crystal, or a link back to `/`), so a player can move car ↔ grid ↔ games without editing the URL.

### AC6 — Existing game back links still work
- **Given** Seed & Crystal (M1/M2) with its "← Lightgrid" back link (`href="lightgrid.html"`),
- **Then** that link still resolves after the routing change (the file stays served at `/lightgrid.html`), so no game is orphaned.

### AC7 — Mobile-friendly as the landing
- **Given** a phone viewport (~375 × 812),
- **Then** fcc-car fills the screen, the bottom control panel is usable (collapsible), and touch paint / rotate / pinch-zoom work — the car ships its own mobile handling, so this is a **verify**, not a rebuild.

### AC8 — Committed, deployed, no regressions
- **Given** the repository,
- **Then** `fcc_car.html` is committed and deploys with the site,
- **And** the `/seed` route, Lightgrid's modes, and the other games are unaffected.

---

## UX / interaction notes

- The car uses a fixed top-left `#label` and top-right `#readout`; the "Lightgrid" link should sit near the brand/label without covering the paint canvas or the readout — a compact pill (matching `.backlink` styling from the games) is enough.
- Keep the change reversible for players: neither app should trap you. Car → Lightgrid via the new link; Lightgrid → car via a nav entry (and every game already returns to Lightgrid).
- Consider whether landing directly in an interactive 3D paint tool (auto-spinning, storage-backed) is the right first impression vs. a title/intro — see open questions.

## Technical notes (implementation pointers)

- **Routing (`vercel.json`):** change `/` → `/fcc_car.html`; add a clean route for Lightgrid, e.g. `/grid` → `/lightgrid.html`. Keep `/seed` → `/seed_and_crystal_M2.html`. Static files (`/lightgrid.html`, `/seed_and_crystal_M2.html`) remain directly served, so existing `href="lightgrid.html"` back links (AC6) keep working.
- **Car → Lightgrid (AC3):** add one `<a>` in `fcc_car.html` (near `#label`), `href="lightgrid.html"` (works locally and on Vercel), styled like the games' `.backlink`.
- **Lightgrid → car (AC5):** add an ❖/🏎-style entry to Lightgrid's nav that does `location.href='fcc_car.html'` (or `/`), mirroring how the Seed & Crystal entry was added — kept out of the active-mode toggle since it navigates away.
- **No engine work:** the car is self-contained (Three.js global build); no importmap or shared-renderer changes.
- **Local dev:** `python3 -m http.server` won't honour the rewrites, so `/` will show a directory listing locally — test via the direct file names (`fcc_car.html`, `lightgrid.html`); the rewrites only take effect on the Vercel deploy.

## Out of scope (future stories)

- English / bilingual UI for fcc-car (currently Chinese), consistent with the other games.
- Sharing / exporting a livery (screenshot, share code, or gallery).
- Porting the car into `lightgrid.html` as a native in-app mode.
- Redesigning fcc-car's controls to Lightgrid's bottom-strip/sheet pattern (LIG-4) — the car has its own panel and is out of scope unless mobile verification (AC7) turns up problems.
- A shared landing/menu that offers car, grid, and games as equal tiles.

## Open questions

- Should `/` land **directly** in the paint tool (as written), or show a brief title/hero for the car first?
- The car's `window.storage` persists a single global livery (`carlivery` / `carlayout`). Fine for one player; do we want named saves or a gallery later? (Tracked as out-of-scope for now.)
- Which route name for Lightgrid — `/grid`, `/lightgrid`, or keep only `/lightgrid.html`?
- Should the Lightgrid nav show fcc-car as a first-class ❖ game entry, or just a subtle "home" link back to `/`?

## Definition of Done

- [ ] AC1–AC8 pass on desktop and at 375 × 812.
- [ ] `/` serves fcc-car and `/grid` (or chosen route) serves Lightgrid on the Vercel deployment; `/seed` unchanged.
- [ ] `fcc_car.html` committed and playable from the deployed site, with working paint/move/persistence.
- [ ] Car ↔ Lightgrid ↔ games all reachable by tapping; no orphaned pages, no broken back links.
- [ ] No console errors on the car or Lightgrid.
