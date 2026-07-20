'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Core = require('../v2.2/core.js');
const Spatial = Core.Spatial;

function finishValley(state) {
  for (let index = 0; index < Core.VALLEY_STEPS.length; index += 1) Core.advanceCurrentWorld(state);
}

function finishMine(state) {
  Core.advanceCurrentWorld(state);
  for (let index = 0; index < Core.MINE_STEPS.length; index += 1) Core.advanceCurrentWorld(state);
}

function enterGarden(state) {
  Core.advanceCurrentWorld(state);
  Core.advanceCurrentWorld(state);
}

function finishGarden(state, bodyPart, ecologyChoice) {
  enterGarden(state);
  Core.chooseBodyPart(state, bodyPart);
  Core.advanceCurrentWorld(state);
  Core.resolveGardenChoice(state, ecologyChoice);
}

function completeThreeWorlds(bodyPart = 'sensor', ecologyChoice = 'escort') {
  const state = Core.createInitialState();
  finishValley(state); finishMine(state); finishGarden(state, bodyPart, ecologyChoice);
  return state;
}

test('AC-V22-01 full-bleed canvas owns the viewport without layout rails', () => {
  const html = fs.readFileSync(path.join(__dirname, '../v2.2/index.html'), 'utf8');
  const css = fs.readFileSync(path.join(__dirname, '../v2.2/styles.css'), 'utf8');
  assert.ok(html.indexOf('id="worldCanvas"') < html.indexOf('class="context-hud"'));
  assert.doesNotMatch(html, /app-shell|main-stage|world-rail|agent-rail/);
  assert.match(css, /html, body, #app, #worldStage \{ width: 100%; height: 100%; margin: 0; overflow: hidden; \}/);
  assert.match(css, /#worldCanvas \{ position: fixed; inset: 0; width: 100dvw; height: 100dvh; display: block;/);
  assert.match(css, /body \{ min-width: 320px; min-height: 100dvh;/);
});

test('AC-V22-02 resize, DPR and Fullscreen API update display without resetting state', () => {
  const app = fs.readFileSync(path.join(__dirname, '../v2.2/app.js'), 'utf8');
  const html = fs.readFileSync(path.join(__dirname, '../v2.2/index.html'), 'utf8');
  assert.match(html, /id="fullscreenButton"/);
  assert.match(app, /requestFullscreen/);
  assert.match(app, /fullscreenchange/);
  assert.match(app, /targetDpr = Math\.min\(devicePixelRatio/);
  assert.match(app, /camera\.aspect = width \/ height/);
  assert.match(app, /window\.addEventListener\('resize'/);
});

test('AC-V22-03 embodied HUD closes drawers and preserves a clear central action frame', () => {
  const app = fs.readFileSync(path.join(__dirname, '../v2.2/app.js'), 'utf8');
  const css = fs.readFileSync(path.join(__dirname, '../v2.2/styles.css'), 'utf8');
  assert.match(app, /closeDrawers\(\); setHudMode\('embodied'\)/);
  assert.match(css, /\.safe-frame \{ position: fixed; left: 20%; right: 20%; top: 20%; bottom: 20%/);
  assert.match(css, /body\.hud-embodied \.stage-copy/);
  assert.match(css, /\.mission-card \{ position: fixed;[\s\S]*width: min\(360px/);
});

test('AC-V22-04 display scaling reports viewport fill independently from logical simulation', () => {
  const app = fs.readFileSync(path.join(__dirname, '../v2.2/app.js'), 'utf8');
  assert.match(app, /viewportFillRatio/);
  assert.match(app, /renderer\.setPixelRatio\(targetDpr\)/);
  assert.match(app, /labelBudget: innerWidth <= 600 \? 2 : 3/);
  assert.doesNotMatch(JSON.stringify(Core.createInitialState()), /renderScale/);
});

test('AC-V22-05 broken valley exposes bridge, high-road landmarks and legal FCC alternatives', () => {
  const state = Core.createInitialState(), manifest = Spatial.getManifest('valley');
  assert.equal(Spatial.routeStatus('valley', 'bridge_main', 'base', state.spatial).open, false);
  assert.equal(Spatial.routeStatus('valley', 'forest_bypass', 'base', state.spatial).open, true);
  assert.equal(Spatial.routeStatus('valley', 'ravine_maintenance', 'base', state.spatial).open, true);
  assert.deepEqual(['bridge_gap','forest_bypass','greenhouse'].map(id => !!Spatial.getLandmark('valley', id)), [true,true,true]);
  assert.equal(manifest.routes.every(route => route.cells.every(Spatial.isFCCCoord)), true);
  assert.equal(manifest.routes.every(route => route.cells.every((cell, index) => !index || Spatial.isNeighbor(route.cells[index - 1], cell))), true);
});

test('AC-V22-06 stable bridge dirties one route and becomes sourced shared-work memory', () => {
  const state = Core.createInitialState(); finishValley(state);
  assert.equal(state.spatial.valley.phaseId, 'bridge_stable');
  assert.deepEqual(state.spatial.valley.dirtyRoutes, ['bridge_main']);
  assert.equal(state.worlds.valley.routeId, 'bridge_main');
  assert.ok(state.memories[0].routeIds.includes('bridge_main'));
  assert.equal(state.artifacts[0].semanticClass, 'public-infrastructure-tool');
});

test('AC-V22-07 mine exam replans via cargo spiral without dropping safe skill steps', () => {
  const state = Core.createInitialState(); finishValley(state); finishMine(state);
  assert.deepEqual(state.skills[0].steps, ['扫描','隔离','重同步','验证']);
  assert.deepEqual(state.skills[0].contexts, ['NODE-17:+18', 'NODE-42:-11']);
  const replan = state.worlds.mine.planHistory.find(item => item.reason === 'dynamic-blocked-edge');
  assert.equal(replan.routeId, 'cargo_spiral');
  assert.ok(state.memories[1].routeIds.includes('service_spiral') && state.memories[1].routeIds.includes('cargo_spiral'));
});

test('AC-V22-08 mine distinguishes visible depth from FCC graph reachability', () => {
  const clock = Spatial.getLandmark('mine', 'clock_atrium'), core = Spatial.getLandmark('mine', 'echo_core');
  assert.ok(core.visibleFrom.includes('clock_atrium'));
  assert.ok(Spatial.graphDistance(clock.anchor, core.anchor) > 1);
  assert.ok(Spatial.getRoute('mine', 'service_spiral').cells.length > Spatial.graphDistance(clock.anchor, core.anchor));
  assert.match(fs.readFileSync(path.join(__dirname, '../v2.2/app.js'), 'utf8'), /可见\/需经路线/);
});

test('AC-V22-09 garden GraphPhase and occupied safety cell survive hydration', () => {
  const state = Core.createInitialState(); finishValley(state); finishMine(state); enterGarden(state);
  Spatial.setGardenPhase(state.spatial, 'phase_b');
  state.worlds.garden.currentCell = Spatial.getLandmark('garden', 'root_basin').anchor.slice();
  const restored = Core.hydrateState(JSON.parse(JSON.stringify(state)));
  assert.equal(restored.spatial.garden.phaseId, 'phase_b');
  assert.deepEqual(restored.worlds.garden.currentCell, state.worlds.garden.currentCell);
  assert.equal(Spatial.graphPhase('garden', restored.spatial).safetyAnchor, 'root_basin');
});

test('AC-V22-10 gripping feet and float bladder use different complete garden routes', () => {
  const feet = completeThreeWorlds('feet', 'corridor'), bladder = completeThreeWorlds('bladder', 'corridor');
  assert.equal(feet.worlds.garden.completed, true);
  assert.equal(bladder.worlds.garden.completed, true);
  assert.equal(feet.worlds.garden.routeId, 'surface_anchor_chain');
  assert.equal(bladder.worlds.garden.routeId, 'wind_stream');
  assert.notEqual(Spatial.getRoute('garden', feet.worlds.garden.routeId).baseCost, Spatial.getRoute('garden', bladder.worlds.garden.routeId).baseCost);
});

test('AC-V22-11 mine recall cites the correct valley places, routes and result', () => {
  const state = Core.createInitialState(); finishValley(state); Core.advanceCurrentWorld(state); Core.advanceCurrentWorld(state);
  const memory = state.memories.find(item => item.id === 'mem-valley-bridge'), sources = Core.memorySources(state, memory.id);
  assert.ok(memory.landmarkIds.includes('bridge_gap') && memory.routeIds.includes('bridge_main'));
  assert.equal(sources.every(event => event.worldId === 'valley'), true);
  assert.equal(sources.some(event => event.type === 'bridge_repaired'), true);
});

test('AC-V22-12 all three worlds and releases complete with offline rules only', () => {
  const state = completeThreeWorlds('bladder', 'escort');
  ['short','schedule','crossworld'].forEach(boundary => Core.releaseAgent(state, boundary));
  assert.equal(state.releaseCount, 3);
  assert.equal(state.worlds.garden.completed, true);
  assert.equal(Core.exportBundle(state).versionManifest.modelPolicyVersion, 'offline-rules-v1');
});

test('AC-V22-13 twelve-hour catch-up keeps topology reversible and GraphPhase stable', () => {
  const state = completeThreeWorlds('feet', 'escort'), before = JSON.parse(JSON.stringify(state.spatial));
  const summary = Core.catchUpOffline(state, 12 * 60 * 60 * 1000);
  assert.equal(summary.irreversibleActions, 0);
  assert.equal(summary.elapsedHours, 12);
  assert.deepEqual(state.spatial, before);
});

test('AC-V22-14 V1 behavior imports as sourced spatial memory without overwriting V2.2', () => {
  const v1 = { version: 1, bridgeSeen: true, bridgeInspected: true, bridgePassed: false, coreChoice: 'maintain', events: [{ type: 'bridge_inspected', text: '主动停下检查旧桥裂纹' }, { type: 'rule_core_choice', text: '建设维护器' }] };
  const restored = Core.hydrateState(v1);
  assert.equal(restored.version, '2.2');
  assert.equal(restored.migration.source, 'broken_bridge_valley_v1');
  assert.equal(restored.memories[0].sourceVersion, 1);
  assert.ok(restored.memories[0].routeIds.includes('ravine_maintenance'));
  assert.ok(Core.memorySources(restored, 'mem-v1-import').every(event => event.source === 'legacy-import' && event.spatial.landmarkIds.length));
});

test('AC-V22-15 three releases retain place, route and identity commitment evidence', () => {
  const state = completeThreeWorlds('sensor', 'corridor');
  ['short','schedule','crossworld'].forEach(boundary => Core.releaseAgent(state, boundary));
  assert.equal(state.returnSummaries.length, 3);
  state.returnSummaries.forEach(summary => {
    assert.ok(summary.spatialEvidence.worldId && summary.spatialEvidence.regionId && summary.spatialEvidence.routeId);
    assert.ok(summary.spatialEvidence.landmarkIds.length > 0);
    assert.equal(summary.spatialEvidence.identityCommitmentId, 'com-bridge-open');
  });
  assert.ok(state.transfers.every(transfer => transfer.status === 'committed' && transfer.entityId === 'agent-cheng'));
  assert.match(Core.exportBundle(state).integrityHash, /^fnv1a32:[0-9a-f]{8}$/);
});

test('deployment is local-only and routes both /v2.2 spellings', () => {
  const html = fs.readFileSync(path.join(__dirname, '../v2.2/index.html'), 'utf8');
  const vercel = JSON.parse(fs.readFileSync(path.join(__dirname, '../vercel.json'), 'utf8'));
  assert.equal(/https?:\/\//.test(html), false);
  assert.match(html, /href="\/v2\.2\/styles\.css"/);
  assert.ok(html.indexOf('/vendor/three.min.js') < html.indexOf('/v2.2/spatial.js'));
  assert.ok(html.indexOf('/v2.2/spatial.js') < html.indexOf('/v2.2/core.js'));
  assert.ok(html.indexOf('/v2.2/core.js') < html.indexOf('/v2.2/app.js'));
  const routes = Object.fromEntries(vercel.rewrites.map(item => [item.source, item.destination]));
  assert.equal(routes['/v2.2'], '/v2.2/index.html');
  assert.equal(routes['/v2.2/'], '/v2.2/index.html');
});
