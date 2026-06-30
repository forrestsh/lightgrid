# Lightgrid — Game & Visual Specification

> *one rule, twelve directions*

**For:** Claude Code (implementation reference)
**Project:** Cosmic Grid (宇宙格点) — interactive layer · title **Lightgrid** (光格)
**Author:** Forrest Shen, with Claude · 2026
**Status:** Working prototypes exist as single-file HTML artifacts (observation deck, world layer, logic bench, chunked world, infinite roam). This document is the canonical spec to consolidate them into one coherent, modular codebase.

> One sentence: a 3D voxel sandbox on a face-centered-cubic lattice where **everything is a rule sequence acting on a shape** — you place a *seed* (noun) and apply a *verb* (a sequence of bijective rules) to grow, move, compute, or carve it into a product. Matter, light, motion, logic, and crafting are all expressions of `R∘T` on a 13-bit cell.

---

## 0. Vision & pillars

The world is the Cosmic Grid: a discrete FCC lattice. The player is the operator **above** the lattice — they inject and edit; the rule does the rest. Five hooks no other voxel game can give, in priority order. **The centerpiece is #1 (crafting); computation is just one verb inside it.**

1. **Verb × noun crafting (the core loop).** You place a *seed* (a shape = **noun**) and apply a *verb* (a **rule sequence**) to it; the result is a crafted product. Recipes are compositions of rule sequences; a "DNA strand" (verb) decoded by an interpretation table φ yields different products in different contexts. This is original gameplay drawn straight from the verb/noun separability research, and **nothing else on the market has it.** Fully specified in §3.
2. **Real, provable computation (one of the verbs).** The `compute` verb is `rt_FCC` — its gun / AND / NOT constructions are mathematically verified (Shen 2026). A seed under the compute verb *becomes* a provably universal computer. No voxel game has a computation layer built on a clean bijective automaton — but here it's one verb among grow / move / carve, not the whole pitch.
3. **Rhombic-dodecahedron world.** 12 neighbours, not 6. Denser, more organic, instantly distinct from cubic voxels.
4. **Gliders are creatures/machines; guns are factories.** Spaceship I/II, the screw glider, and glider guns are *content*. A gun is an infinite resource generator; conservation laws (popcount under PC rules) are the economy.
5. **The player is the external injector.** The metaphysics — a creator injecting signal from above the lattice — is the literal control scheme. Crafting *is* the player injecting a verb onto a noun from outside the grid.

One rule, literally: the base dynamics is the single 4096-entry table `rt_FCC` with three non-trivial entries; build, dig, mirror, gun, gate are all *placements* that let it do different things. Verbs layer time-varying rule sequences on top (§3.5) without ever abandoning `R∘T`.

Non-negotiable: the visual language (§5) is shared across *every* mode so the deck, the workshop, the world, the gates, and the infinite roam all read as one thing.

---

## 1. The model — exact constants

### 1.1 Lattice & directions

FCC nearest neighbours = the 12 permutations of `(±1,±1,0)`. The game's canonical direction array (index = bit index):

```js
// index:   0       1       2        3        4        5
//          A       B       C        D        E        F
// 6..11 are the exact opposites of 0..5 (a,b,c,d,e,f)
const DIRS = [
  [0, 1, 1], [1, 0, 1], [1, 1, 0],   // A B C
  [0,-1, 1], [1, 0,-1], [-1,1, 0],   // D E F
  [0,-1,-1], [-1,0,-1], [-1,-1,0],   // a b c   (= -A,-B,-C)
  [0, 1,-1], [-1,0, 1], [1,-1, 0],   // d e f   (= -D,-E,-F)
];
const opp = i => (i < 6 ? i + 6 : i - 6);   // opposite direction (used by reflect)
```

`A=(0,1,1)`, `B=(1,0,1)`, `C=(1,1,0)` are bit-for-bit identical to the convention in Shen (2026); the rule and all gates depend only on these three, so they are **fixed**. `D,E,F` labels are an internal convention and may differ from the paper's D,E,F — that is fine, nothing depends on it.

### 1.2 Cell state (13 bits)

```
bit 12  = SELF  (1<<12 = 4096)  → rest matter, velocity 0
bit 0..11                        → a signal present in that direction
state space = 2^13 = 8192
```

A lone `SELF` is static mass. A lone direction bit is a photon moving at `c`. `SELF | dir` is mass + radiation.

### 1.3 Evolution `step = R ∘ T`

- **Transport `T`** — every direction bit hops to its neighbour keeping its index; `SELF` stays put (this *is* rest mass, discretely).
- **Routing `R`** — one lookup table applied per cell to the aggregated post-transport state.

### 1.4 The single rule `rt_FCC`

```
rt[1] = 3   // A     → A·B    (1<<0           → 1<<0 | 1<<1)
rt[3] = 6   // A·B   → B·C
rt[6] = 1   // B·C   → A
rt[s] = s   // all other 4093 states are fixed points
```

Bijective, non-popcount-conserving (`pc: 1→2→2→1`), perturbation count k=3. From a single `A` seed in free space it is a **light-speed gun**: signal population grows linearly, **slope = 1.0000, R² = 1.0000** (verified to 500 ticks). The 11 non-`A` single-bit states are stable *wires*.

### 1.5 Speed & metric

Graph distance on FCC:

```js
const gdist = (x,y,z) => Math.max(Math.abs(x), Math.abs(y), Math.abs(z),
                                  Math.ceil((Math.abs(x)+Math.abs(y)+Math.abs(z))/2));
```

Every direction hop has graph distance 1, so `v ≤ c = 1` by construction. Speeds are reported in graph distance per tick. (Euclidean distance is a coordinate artifact and must not be used for physics readouts.)

---

## 2. Engine architecture

### 2.1 Separated stores (the scalability key)

Matter and signals live in **different stores**. The vast static world never enters the per-tick loop; only the sparse signals are stepped. This is what makes large/infinite worlds tractable.

```
matter        : Set<cellKey>            // O(1) collision lookup
chunkCells    : Map<chunkKey, Set<cellKey>>   // for meshing only
dirty         : Set<chunkKey>           // chunks needing re-mesh
signals       : Map<cellKey, dir12>     // the ONLY thing stepped
trailSet      : Set<cellKey>            // capped history for the trail view
```

`cellKey = "x,y,z"` (string). Use integer lattice coords throughout.

### 2.2 The step (canonical, separated form)

```js
function stepSignals() {
  const agg = new Map();                       // T: transport dir bits
  for (const [k, dir] of signals) {
    const [x,y,z] = parse(k);
    for (let i = 0; i < 12; i++) if (dir & (1<<i)) {
      const d = DIRS[i];
      const nk = key(x+d[0], y+d[1], z+d[2]);
      agg.set(nk, (agg.get(nk)||0) | (1<<i));
    }
  }
  const next = new Map();                       // R: route, with matter interaction
  for (const [k, dir] of agg) {
    if (matter.has(k)) {                        // matter = mirror / target
      next.set(k, opts.reflect ? reflectBits(dir) : dir);
    } else if (opts.gun && (dir===1 || dir===3 || dir===6)) {
      next.set(k, dir===1 ? 3 : dir===3 ? 6 : 1);   // gun rule
    } else if (opts.deposit) {
      addMatter(k);                             // freeze signal → matter (build by beam)
    } else {
      next.set(k, dir);                         // free flight (identity)
    }
  }
  signals = next; tick++;
  for (const [k,d] of signals) if (d) trailSet.add(k);
  if (trailSet.size > 5000) trailSet.clear();
}

function reflectBits(dir){ let r=0; for(let i=0;i<12;i++) if(dir&(1<<i)) r|=(1<<opp(i)); return r; }
```

`opts = { reflect, gun, deposit }` are independent toggles. With `gun` on and `reflect`/`deposit` off, the engine reproduces `rt_FCC` exactly in the signal domain — so gates work with no special code.

### 2.3 Interaction primitives (all are the one rule)

| Primitive | Mechanism | Player meaning |
|---|---|---|
| **reflect** | at a matter cell `SELF·dir → SELF·opp(dir)` | terrain is a mirror / wall |
| **gun** | on empty: `1→3→6→1` | a lone `A` becomes a light-speed beam (clock / wire source) |
| **deposit** | on empty: `dir → SELF` | a flying signal freezes into a block (build by beam) |
| **place / dig** | player sets / clears `SELF` (injection) | edit terrain |
| **spark** | player injects an `A` signal | fire a beam |

### 2.4 Verified logic gates (exact configs — do not alter)

All gates are *pure initial conditions* in the signal domain (no scheduler). `B=2, C=4, A=1`.

- **Gun (source):** `A` at `(0,0,0)`. Head `A·B` at `(0,t,t)`, sheds one `B` wire per tick.
- **AND(B,C):** `B` at `(-5,0,-5)`, `C` at `(-5,-5,0)` → meet at `(0,0,0)` at `t=5` → `B·C=6 → rt→1=A` → gun ignites.
  Truth table (signal pop at `t=30`): `(0,0)→0, (1,0)→1, (0,1)→1, (1,1)→26`.
- **NOT(kill):** gun `A` at `(0,0,0)`; kill wire `B` at `(-8,8,0)` reaches the head `(0,8,8)` at `t=8` → `A·B=3 → rt→6` → gun dies. Output = NOT(kill): unkilled grows (≈ t+1), killed freezes (~9).
- **NAND (composition demo):** AND seeds + downstream kill `B` at `(-15,10,-5)` reaching `(0,10,10)` at `t=15`. `(1,1)+kill → 11` (ignited then killed); `(1,1)` no-kill → grows. *(This demonstrates composability; a full single-line NAND output is an open construction — see §10.)*

---

## 3. The crafting system — verb × noun (the core loop)

Lightgrid's signature, and its deepest tie to the research (verb/noun separability, DNA-as-rule-sequence, the grow→carve duality). One sentence: **place a shape, apply a rule sequence, get a thing.**

### 3.1 The two ingredients

- **Noun = a seed.** A small placed configuration of cells (matter and/or signal bits) — a *shape*. Nouns are the materials. Catalogue (verified specimens): the solid-crystal seeds (population `1, 13, 49, 141, …`), Spaceship I (period 4, c/4), Spaceship II (period 3, c/3), the C3 screw glider (0.75c, mirror-reverses), particle-spectrum shapes, the gun seed (`A`).
- **Verb = a rule sequence.** An ordered list of routing tables `[R₀, R₁, …, R_{p−1}]` applied per tick and cycled by phase. A verb is the *action/tool*. The base world runs the single `rt_FCC`; a verb temporarily replaces it over a tagged region (§3.5).

**Craft = apply a verb to a noun** for the verb's duration → a **product** (a new structure / creature / machine). **Recipe = a composition of verbs** (and intermediate carves) — a build tree.

### 3.2 The four verb families — the arc grow → move → compute → carve

| Verb | does | research anchor |
|---|---|---|
| **grow** (长什么) | expands a seed into a larger structure | morphogenesis: solid-crystal sequence, growth rules |
| **move** (会动) | propels / translates a structure | gliders, screw glider, spaceships |
| **compute** (会算) | the seed *becomes* a computer | `rt_FCC` gun / gates — **hook #2 is exactly this one verb** |
| **carve** (分左右 · apoptosis) | sculpts cells away toward a target | grow→carve duality: same classes, opposite activation |

**Manufacturing loop = grow then carve.** Grow rough mass from a seed, then carve to a precise target (a *blueprint*). The grow→carve duality means both phases use the same rule family with opposite activation — this maps directly to biological apoptosis and is the clean way to make exact products.

### 3.3 The φ interpretation layer (DNA framing)

A verb is a **strand** — DNA *is* a rule sequence. An **interpretation table φ** decodes a strand into the actual per-tick routing. **Same strand + different φ = different product** ("cell types = different φ decoding the same DNA"). This is the depth/progression system: collect strands and φ-tables; their combinations unlock the craft tree. Differentiation = moving through φ-space; the key variable the player manipulates is **φ structure, not the seed**.

### 3.4 Separability is partial — and that *is* the game

Honest finding from the research, do **not** paper over it: verb and noun do not cleanly separate.

- **radius-2 verbs are body-specific** — a verb tuned to one noun fails on a different noun (it "memorised the body"; near-zero transfer).
- **radius-1 verbs transfer only rigid translation.**
- A frozen sequence run on its original body still collapses (F1 ≈ 0.28); a generalising emitter reaches only F1 ≈ 0.76 across bodies.

In-game consequence: **a verb works cleanly on its noun-class, not on arbitrary nouns.** Apply the wrong verb and you get a degenerate/partial product. So **recipe discovery — which verb fits which noun — is the core progression loop**, and it is literally the open research question turned into play. Never ship "any verb on any noun just works"; curated verb–noun pairs are the recipes.

Precision constraint: a clean carve requires per-cell target information — zero-false-positive carving is *structural*, not a capacity limit. So a recipe is **seed + grow-verb + carve-blueprint**, and the blueprint (the per-cell target) is itself a craftable/collectable item.

### 3.5 Engine extension — the verb track

The base engine (§2) applies one rule. Crafting layers a **verb track** on top, fully consistent with `R∘T`:

- A region may be tagged `{verb V, phase p₀, t₀, duration}`. Each tick, cells in that region route by `V.sequence[(tick − t₀) mod V.period]` instead of the base rule; everything outside uses `rt_FCC`.
- After the duration the region returns to the base rule; the product is whatever cells remain.
- Keep verb rules **bijective** so growth/carve are reversible where intended, and design which verbs conserve popcount (that's the economy, §3.6).

Runtime is **explicit rule sequences — no neural net required.** The research's learned emitter / grow-then-carve predictor is an *offline authoring tool* (to discover and compress multi-step verbs into compact strands), never a runtime dependency.

### 3.6 Economy & resources

A gun (the `compute` verb on the `A` seed) is an **infinite resource generator** — its endless shed stream is a renewable material. Conserved quantities are **currency**: a popcount-conserving verb neither creates nor destroys "mass," so trades are zero-sum; non-conserving verbs (like `rt_FCC`) are the energy sources that let the economy grow. Designers tune which verbs conserve to balance it.

---

## 4. World systems

### 3.1 Chunking

```
CS = 8                                   // chunk edge in lattice units
chunkKey(x,y,z) = `${x>>3},${y>>3},${z>>3}`   // >>3 floors correctly for negatives
chunkCenter(c)  = c*8 + 3.5  (per axis)
```

- One **InstancedMesh per chunk**, instances positioned *relative to chunk center*; `mesh.position = chunkCenter`.
- Shared RD geometry with a **chunk-sized bounding sphere** so frustum culling is correct: `geometry.boundingSphere = Sphere(origin, CS*0.95)` and `mesh.frustumCulled = true`.
- **Dirty re-mesh only:** `place`/`dig`/`deposit` add the touched chunk to `dirty`; each frame `flushDirty()` re-meshes just those chunks. Editing stays instant at any world size.
- Re-mesh capacity grows on demand (start ~560 instances/chunk; recreate mesh if a chunk exceeds capacity).

### 3.2 Streaming (infinite roam)

Deterministic procedural terrain — chunks are generated on approach and freed on exit; memory stays flat.

```js
const FLOOR = -8, RD = 3;                 // render distance in chunks (7×7×2 ≈ 98 chunks loaded)
function height(x,z){
  return Math.min(6, Math.round(
    2.6*Math.sin(x*0.17)*Math.cos(z*0.15) + 1.4*Math.sin((x+z)*0.09) + 1.0));
}
// genChunk(c): for each (x,z) in chunk, for y in [FLOOR..height(x,z)] on the FCC sublattice
//   ((x+y+z)&1)===0, skip editRemoved keys, addMatter; then apply editPlaced for this chunk.
// streamAround(): when the focus chunk (round(camC.x)>>3, round(camC.z)>>3) changes,
//   load chunks within RD not yet loaded, unload loaded chunks now outside RD.
```

Vertical range `FLOOR=-8..height≤6` spans exactly chunk layers `cy ∈ {-1, 0}` — load both per horizontal column.

**Determinism is required:** re-entering a region must rebuild it identically (verified: identical cell sets after unload/reload). The height field is the single source of truth; never store generated terrain globally.

### 3.3 Edit persistence overlay

Player edits are a sparse overlay applied on top of procedural gen, so they survive unload/reload:

```
editRemoved        : Set<cellKey>                 // dug cells (skipped during gen)
editPlacedByChunk  : Map<chunkKey, Set<cellKey>>  // placed cells (re-added after gen)
```

`place → addMatter + mark placed (and un-remove)`; `dig → delMatter + mark removed (and un-place)`. (Verified: placed blocks survive a round trip; dug blocks stay gone.) For larger builds, this overlay is the natural thing to serialize to `window.storage` for save/load.

---

## 5. Visual language — "Crystal Garden" (shared by all modes)

### 4.1 Cell geometry — rhombic dodecahedron (RD)

The RD is the Voronoi cell of FCC; its **12 rhombic faces point exactly at the 12 neighbours**, so signals can be drawn as arrows leaving through the correct face.

Construct (unit cell, then scale): 6 octahedral vertices at `(±1,0,0),(0,±1,0),(0,0,±1)` + 8 cube vertices at `(±0.5,±0.5,±0.5)`; 12 rhombic faces (split each into 2 triangles), `computeVertexNormals()`. Render scale `VOX = 0.9`. A flat baked `position`/`index` pair exists in the prototypes; either is acceptable as long as faces align with `DIRS`.

Face-pick for editing: raycast the chunk mesh, take `intersection.face.normal`, match to the nearest of the 12 normalized `DIRS` (max dot product) → that gives the neighbour cell to place into.

### 4.2 Colour

```
matter / self  #e3c264  (gold)
photon (1 dir) #6df0c8  (green)
composite/gun  #f3a953  (amber)
mass+radiation #ff9d5c  (orange)
```

Arrow palette (shaft and head coloured independently):

```
const _R=0xe8443a, _Y=0xe8c23a, _B=0x3a82e8, _W=0xffffff,    // A=red B=gold C=blue, white
      _r=0xf2a39d, _y=0xf2e3a0, _b=0xa8c4f2;                 // pale variants
ASHAFT_COL = [_R,_Y,_B,_W,_W,_W,_R,_Y,_B,_r,_y,_b];  // A B C  D E F(⟂→white shaft)  a b c(→) d e f
AHEAD_COL  = [_R,_Y,_B,_R,_Y,_B,_W,_W,_W,_r,_y,_b];
```

Reading: solid R/Y/B = the primary axes A,B,C; white shaft = the ⟂ trio D,E,F; white head = opposites a,b,c; pale = d,e,f.

### 4.3 Materials & render layers

| Layer | Material | Notes |
|---|---|---|
| matter (solid voxel view) | `MeshLambert`, instanceColor = gold ± slight L variation | lit, reads as terrain |
| matter (signal view) | `MeshLambert`, transparent, opacity ~0.30, `depthWrite:false` | the deck's translucent gold self-shell |
| signal arrows | shaft `Cylinder(0.058,0.058,ASHAFT)`, head `Cone(0.14,AHEAD)`, `MeshBasic` instanceColor | unlit = self-lit; one shaft+head per active bit |
| signal voxels | `MeshBasic` RD@0.5, green/amber by popcount | used when signal view = off |
| trail | `MeshLambert` `#9a8048`, opacity ~0.12, `depthWrite:false` | faint ghosts of visited signal cells |
| grid | two `Points` clouds: active `#ffffff`, neighbours `#9aa3b0` | reachable FCC neighbour cloud |

Arrow geometry maths: `faceLen0 = 0.5*VOX*√2 ≈ 0.636`; `ALEN = faceLen0*0.97`; `AHEAD = ALEN*0.42`; `ASHAFT = ALEN-AHEAD`; orient each arrow by a quaternion mapping `+Y → normalize(DIRS[i])`; shaft at `center + n*(ASHAFT/2)`, head at `center + n*(ASHAFT + AHEAD/2)`.

### 4.4 View modes (toggles, present in every scene)

- **signals** — on: translucent self-shells + arrows (full-signal view); off: solid voxels.
- **trail** — fading ghosts of where signals have been.
- **grid** — the reachable-neighbour point cloud.

### 4.5 Chrome / UI

Design tokens (CSS `:root`):

```
--bg-deep:#04050a; --bg-0:#07090f; --bg-1:#0c1019; --bg-2:#131826;
--line:#1e2638; --line-2:#2f3a52;
--fg-0:#ebeef5; --fg-1:#b9bfcc; --fg-2:#6e7588; --fg-3:#3b4254;
--green:#6df0c8; --red:#ee6868; --amber:#f3a953; --indigo:#6cb8ff; --gold:#e3c264;
```

Typography: **Fraunces** (serif, display — titles, big readouts) + **JetBrains Mono** (all UI text, tabular numerals). Body background = two faint radial gradients (gold top-left, green bottom-right) over `--bg-deep`.

Standard overlay furniture: a **stage-card** top-left (label / title / sub-line), a **vel-badge / HUD** top-right (one big serif number + small mono sub-line), a **tools** row, a **transport** bar, and a scrollable **toggle** bar. Buttons are 1px-border mono chips; active = gold tint; toggles colour by family (rule = amber/green, view = indigo). Keep this furniture identical across modes.

### 4.6 Lighting & camera

```
AmbientLight       #ffffff 0.6
key DirectionalLight #ffd9c0 0.6  @ (14,22,16)
fill DirectionalLight #9cc4ff 0.3 @ (-14,-6,-10)
under DirectionalLight #6df0c8 0.18 @ (0,-18,6)     // signature green under-light
FogExp2 #04050a  density 0.008–0.012
PerspectiveCamera fov 42–50
```

Camera is a **manual orbit** (spherical `theta/phi/radius` around a focus point `camC`, `lookAt(camC)`). Three.js r128's bundled build has **no OrbitControls** — implement orbit by hand. Gentle auto-rotate when idle (disable in roam mode).

---

## 6. Controls & input (mobile-first)

- **drag** (1 finger / mouse) → orbit.
- **pinch** (2 fingers) / wheel → zoom (clamp radius).
- **two-finger tap** → snap/reset view.
- **tap a block face** → tool action (place / dig / spark); distinguish from drag by movement < ~4px and duration < 300ms.
- **roam mode only:** on-screen **joystick** (bottom-left, own pointer capture, `touch-action:none`) translates the focus `camC` along camera-relative forward/right on the ground plane; focus `y` smoothly follows `height(x,z)`.

Keyboard (desktop): space = play/pause, arrows = step / scene nav where relevant.

---

## 7. Experiences (modes)

All share §1–§6. The modes ship under one title — **Lightgrid — Deck / Workshop / World / Logic / Chunks / Roam** — as selectable scenes within one app.

1. **Observation deck** (Crystal Garden) — non-interactive specimen viewer: the 211-particle spectrum (`v = m/N`), the gun, photon, rest matter, gliders; a rule studio (edit the 13-bit table, auto-search for movers/guns). The reference aesthetic; the other modes inherit from it.
2. **Workshop** (the centerpiece, §3) — the verb × noun crafting bench: pick a noun (a seed from the catalogue), apply a verb (a rule sequence) with a chosen φ, and watch it grow / move / compute / carve into a product. Discover which verbs fit which nouns (separability is partial — §3.4); chain verbs into recipes; grow→carve to a blueprint to manufacture exact shapes.
3. **World layer** — terrain + `place`/`dig`/`spark` tools + `gun`/`reflect`/`deposit` rule toggles. Signals bounce off built terrain.
4. **Logic bench** — verified placeable gates (Gun / AND / NOT / NAND) with input toggles + live truth-table readout; plus a free "build" mode placing A-gun / B-src / C-src emitters. (This is the `compute` verb made explicit.)
5. **Chunked world** — big bounded terrain; separated stores, per-chunk dirty re-mesh, frustum culling, draw-call HUD.
6. **Infinite roam** — joystick locomotion, deterministic streaming load/unload, edit-persistence overlay; memory flat at any distance.

---

## 8. Tech stack & suggested structure

- **Three.js r128** (global build from cdnjs). Constraints: no `OrbitControls`, no `CapsuleGeometry` (r142+); use `Cylinder`/`Cone`/`Sphere`. **No `localStorage`/`sessionStorage`** inside the chat-artifact sandbox — use in-memory state (or `window.storage` if running in the Claude app).
- Prototypes are single-file HTML. For the real build, split:

```
/src
  fcc.js         DIRS, opp, key/parse, gdist, reflectBits, rt_FCC
  engine.js      matter/signals stores, stepSignals, addMatter/delMatter, opts
  craft.js       verb (rule-sequence) track, φ tables, noun catalogue, recipes, grow→carve
  chunks.js      chunkKey, chunkCenter, remeshChunk, flushDirty, frustum sphere
  stream.js      height(), genChunk, unloadChunk, streamAround, edit overlay
  gates.js       verified gate presets + truth-table verdict (the compute verb)
  render.js      RD geometry, materials, arrow builder, signal/trail/grid passes
  ui.js          chrome, tools, toggles, joystick, HUD
  camera.js      manual orbit + tap-to-act raycast + face-pick
  scenes.js      the 6 modes
/index.html
```

- Performance budget: 60fps on a mid phone with ~10k visible matter cells across ~100 chunk draws; signal pass O(active signals), typically < a few thousand bits.

---

## 9. Acceptance invariants (regression tests — must hold)

Implement these as headless checks (Node, no Three.js needed) on the pure engine:

1. **Gun linearity.** Single `A` seed, `gun` on: signal popcount fit over t∈[10,500] → **slope = 1.0000, R² = 1.0000**.
2. **AND truth table.** Seeds per §2.4, pop at t=30 → `0,0→0 · 1,0→1 · 0,1→1 · 1,1→26`.
3. **NOT.** gun + kill: unkilled grows (≈ t+1); killed freezes (constant ~9 from t=8).
4. **NAND composition.** `(1,1)+kill → 11` (frozen); `(1,1)` no-kill → grows large.
5. **Reflect.** A signal fired at a wall returns along the opposite direction through its origin.
6. **Deposit.** A flying signal converts to exactly one matter cell and marks the correct chunk dirty.
7. **Chunk floor.** `chunkKey` floors correctly for negative coords (`-9>>3 === -2`).
8. **Streaming bounded.** Loaded chunk count is constant (≈ `(2·RD+1)²·2`) regardless of distance travelled.
9. **Determinism.** A chunk's cell set is identical after unload → reload.
10. **Edit persistence.** Placed blocks survive unload/reload; dug blocks stay gone.
11. **Craft reproducibility.** A given `(noun, verb, φ)` triple always yields the identical product (the verb track is deterministic).
12. **Separability is honest.** A verb applied to a noun *outside* its noun-class yields a degenerate/partial product, never the matching-class product by accident — i.e. wrong verb ≠ silently-correct.

(1)–(4) reproduce Shen (2026) exactly. (5)–(10) were verified for the prototype engine. (11)–(12) encode the crafting contract of §3.

---

## 10. Non-goals & open problems (do not fake these)

- **Arbitrary verb ↔ noun transfer.** Separability is partial (§3.4): a verb is tuned to a noun-class. Do **not** promise that any verb works on any noun, or auto-suggest crafts that haven't been authored/verified for that pairing. Curated recipes only; discovery is the loop.
- **Neural emitter at runtime.** The learned grow-then-carve / emitter models are an *offline* authoring tool for discovering and compressing verbs into strands. The game runtime runs explicit rule sequences; never ship a neural net in the hot path.
- **Wire turning / fan-out.** Routing a wire around a 90° corner, and duplicating a signal, are **open research** on FCC. Do not ship a general auto-router that pretends arbitrary gate cascades work. Free placement may let players cross streams; clean multi-gate circuits beyond the verified primitives are not guaranteed.
- **Single-line NAND.** The bench shows AND→NOT *composability* (a gun killed). A true single-output NAND needs a standing default-on output gun that the AND-gun kills — a specific construction not yet built/verified. Mark any NAND as "composition demo" until built and added to §9.
- **Async chunk generation.** Streaming is currently synchronous; fast travel can hitch when many chunks generate in one frame. Budget generation across frames (a queue) before claiming smooth infinite flight.
- **Edit overlay growth & save.** The overlay is unbounded in heavy building and is not yet serialized. Add chunk-scoped serialization for real save/load.
- **Particle–particle scattering with momentum transfer**, multi-shell (>12) directions, and Lorentz/dispersion claims belong to the research papers, not the game; don't assert them in-game UI.

Honesty rule for this project: a negative or unbuilt result is stated plainly, never papered over with a plausible-looking visual.

---

## 11. Provenance

- 13-bit cell model: Cosmic Grid ch.5.
- **Verb × noun crafting, separability, DNA-as-rule-sequence, grow→carve duality: the walker / morphogenesis research** — *《种子与晶体》 / A Seed and a Crystal*, and the verb/noun separability studies (radius-2 body-specificity; radius-1 rigid-translation transfer; neural emitter LOO F1 ≈ 0.76; frozen-sequence collapse F1 ≈ 0.28; zero-FP carve is structural). The `compute` verb and §2 gates: **Shen (2026), "FCC 12-direction single-rule Turing completeness."**
- Single-rule Turing completeness, the gun, AND/NOT/NAND constructions, truth tables: **Shen (2026).** `rt_FCC = {1→3, 3→6, 6→1}`.
- Graph-distance metric and emergent velocity: Shen (2026f).
- Particle spectrum `v = m/N`: *A New Kind of Physics*, ch.24.

Credit line for builds: *Forrest Shen, with Claude · 2026.*
