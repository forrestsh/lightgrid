# LIG-2 · Full-freedom Birth / Survival rules in the Garden

**Type:** User story
**Mode:** Garden (forward growth-form explorer)
**Status:** Ready for refinement
**Depends on:** LIG-1 (custom seeds) — merged

---

## Story

**As a** player,
**I want to** set **any combination** of Birth and Survival values (k = 0…12) when I grow a seed — including rules where **k = 1 is not in B or S** —
**so that** I can explore the full rule space, especially now that custom seeds (LIG-1) make rules without k = 1 genuinely productive.

---

## Background & context

The studio's rule editor presents **k = 1 as mandatory** in both the Birth and Survival grids:

- The **k = 1 chip is permanently outlined** in green (`.kc.one`) in both grids, reading as "locked on / required".
- The helper text under the Birth grid says *"A lone seed sees k = 1 occupied neighbour, so a point can only grow if 1 ∈ B."*
- The **🎲 random rule** button always forces `1 ∈ B` (`new Set([1])` before the random fill).
- All six form presets include 1 in B, so the player never sees a counter-example.
- With the default **point** seed, a rule without `1 ∈ B` silently grows nothing — which teaches the player that k = 1 is required.

Technically the toggles are already free — clicking k = 1 off works, the CG3 code encodes it (masks cover the full 0–8191 range), and `growFormFrames` runs fine (verified: `CG3-C-3G-PL-14`, B = {2,3}, grows to peak 1,868). The k = 1 "requirement" is an **affordance and guidance problem**, not an engine limitation. This story makes full-freedom rule authoring a first-class, clearly communicated capability instead of something that only works if you ignore what the UI tells you.

The reason this matters *now*: a lone point offers only k = 1 sites, but a **custom seed** (LIG-1) — or any multi-cell preset (`dipole`, `ring`, `plate`…) — offers sites with k ≥ 2, so rules without k = 1 produce real, distinct growth forms that are currently discouraged by the UI.

---

## Acceptance criteria

### AC1 — Any combination is settable
- **Given** the Garden design studio is open,
- **When** I toggle any cell k = 0…12 in the Birth grid or the Survival grid,
- **Then** it toggles freely — including turning **k = 1 off** in either grid — with no locked cells and no forced re-adding.

### AC2 — k = 1 is not presented as mandatory
- **Given** I look at the rule grids,
- **Then** the k = 1 chip has **no permanent "required" outline**; it looks and behaves like every other k chip.
- **And** the helper text is reworded as a *tip*, not a rule — e.g. "Tip: a lone point seed only offers k = 1 sites, so a single-cell seed needs 1 ∈ B to sprout. Bigger seeds don't."

### AC3 — Random rule covers the full space
- **Given** I press **🎲 random rule**,
- **Then** the roll may produce rules with or without 1 ∈ B and with or without 1 ∈ S — k = 1 is sampled like every other k, no forced injection.

### AC4 — Empty sets are legal
- **Given** I clear the Birth grid entirely (B = ∅) or the Survival grid entirely (S = ∅),
- **When** I grow,
- **Then** the run executes deterministically and shows the honest outcome (B = ∅ → the seed only survives/decays; S = ∅ → every generation is reborn from scratch), without errors or a frozen UI.

### AC5 — Guidance instead of silent failure
- **Given** my chosen rule cannot grow from my chosen seed (e.g. point seed with 1 ∉ B, so generation 1 is already empty or static),
- **When** I grow,
- **Then** the studio (or the growth card) tells me *why* — e.g. "this seed offers no site with k ∈ B — try a bigger seed or add lower k values" — instead of silently showing nothing.

### AC6 — Share codes round-trip everything
- **Given** any B/S combination (including without k = 1, including ∅),
- **When** I copy the CG3 code and load it back (or someone else loads it),
- **Then** the exact rule is restored and grows identically. `parseCG3` already accepts masks 0–8191; no code format change.

### AC7 — Custom seeds exercise the freedom
- **Given** an authored custom seed (LIG-1) with cells offering k ≥ 2 sites,
- **When** I grow it with a rule where 1 ∉ B,
- **Then** it grows and is classified by the morphology classifier exactly like any preset-seed run.

### AC8 — No regressions
- **Given** the six form presets and the seed catalogue,
- **Then** they load, grow, and classify exactly as before (all presets happen to include 1 ∈ B and are unaffected).

---

## UX / interaction notes

- Remove the `.kc.one` special styling (`.kc.one{box-shadow:…}`) or repurpose it as a **contextual hint**: only highlight k = 1 when the selected seed is a single cell *and* 1 ∉ B, as a "this won't sprout" nudge.
- Consider a small live "will it sprout?" indicator next to the seed note: compute the k-values the current seed's empty neighbours actually see and show whether any of them are in B. This is cheap (one neighbourhood pass over the seed cells).
- Keep the physics lesson — it's good content — but move it from "rule" phrasing to "tip" phrasing (see AC2).

---

## Technical notes (implementation pointers)

- **Grids:** `gBuildKGrid` already toggles freely — remove the `k===1 ? ' one' : ''` class assignment (and the CSS rule) or make it dynamic per AC2/UX note.
- **Random roll:** in the `gRollRule` handler, replace `const B=new Set([1])` with an unbiased sample over k = 0…12 (Birth k = 0 may deserve exclusion or special handling — see open questions).
- **Engine:** `growFormFrames` needs no changes; it already builds `Bmask`/`Smask` from whatever arrays it receives. Verify the existing safety caps (`pop > 2500 || mr > 34` in search paths, `popCap`/`rCap` in growth) still bound pathological rules like B = {0}.
- **Sprout check (AC5):** for each empty neighbour site of the seed, count occupied FCC neighbours; the rule can sprout iff some count ∈ B (or, with B = ∅, iff some seed cell's own count ∈ S). Surface the result in `gUpdateSeedNote` / the grow card.
- **Codes:** `makeCG3`/`parseCG3` untouched — masks already cover all 8192 combinations per grid.

---

## Out of scope (future stories)

- Rule-space browsing / cataloguing (e.g. "show me all rules that grow from this seed").
- Extending the CG3 code to carry custom seed geometry (tracked from LIG-1).
- Deck / Workshop rule editors — this story is Garden-only.

## Open questions

- **B with k = 0:** "an empty cell with zero occupied neighbours is born" means spontaneous birth everywhere in the (infinite) lattice. Do we exclude k = 0 from the Birth grid, or allow it and rely on the population/radius caps to keep it bounded? (Survival k = 0 is fine — an isolated live cell survives.)
- Should the 🎲 random rule keep a *bias* toward sproutable rules when the current seed is a single point, purely so the button feels rewarding — or be fully uniform?
- Where should the AC5 guidance live: in the studio modal (before growing) or on the growth card (after)?

## Definition of Done

- [ ] AC1–AC8 pass on desktop (mouse) and touch.
- [ ] No regression to the six form presets, the seed catalogue, or LIG-1 custom-seed authoring.
- [ ] A rule without k = 1 grown from a multi-cell seed is reproducible via its CG3 code.
- [ ] Verified in the browser preview; no console errors (including B = ∅ and S = ∅ runs).
