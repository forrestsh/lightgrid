'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Core = require('../v2.1/core.js');
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

test('AC-V21-01 broken valley exposes landmarks and two legal FCC alternatives', () => {
  const state = Core.createInitialState(), manifest = Spatial.getManifest('valley');
  assert.equal(Spatial.routeStatus('valley', 'bridge_main', 'base', state.spatial).open, false);
  assert.equal(Spatial.routeStatus('valley', 'forest_bypass', 'base', state.spatial).open, true);
  assert.equal(Spatial.routeStatus('valley', 'ravine_maintenance', 'base', state.spatial).open, true);
  assert.deepEqual(['bridge_gap','forest_bypass','greenhouse'].map(id => !!Spatial.getLandmark('valley', id)), [true,true,true]);
  assert.equal(manifest.routes.every(route => route.cells.every(Spatial.isFCCCoord)), true);
  assert.equal(manifest.routes.every(route => route.cells.every((cell, index) => !index || Spatial.isNeighbor(route.cells[index - 1], cell))), true);
});

test('AC-V21-02 stable bridge updates one route and becomes sourced shared-work memory', () => {
  const state = Core.createInitialState(); finishValley(state);
  assert.equal(state.spatial.valley.phaseId, 'bridge_stable');
  assert.deepEqual(state.spatial.valley.dirtyRoutes, ['bridge_main']);
  assert.equal(state.worlds.valley.routeId, 'bridge_main');
  assert.ok(state.memories[0].routeIds.includes('bridge_main'));
  assert.equal(state.artifacts[0].semanticClass, 'public-infrastructure-tool');
});

test('AC-V21-03 mine exam replans around blocked service spiral without dropping safety steps', () => {
  const state = Core.createInitialState(); finishValley(state); finishMine(state);
  assert.deepEqual(state.skills[0].steps, ['扫描','隔离','重同步','验证']);
  assert.deepEqual(state.skills[0].contexts, ['NODE-17:+18', 'NODE-42:-11']);
  const replan = state.worlds.mine.planHistory.find(item => item.reason === 'dynamic-blocked-edge');
  assert.equal(replan.routeId, 'cargo_spiral');
  assert.ok(state.memories[1].routeIds.includes('service_spiral') && state.memories[1].routeIds.includes('cargo_spiral'));
});

test('AC-V21-04 mine visibility is distinct from graph reachability', () => {
  const clock = Spatial.getLandmark('mine', 'clock_atrium'), core = Spatial.getLandmark('mine', 'echo_core');
  assert.ok(core.visibleFrom.includes('clock_atrium'));
  assert.ok(Spatial.graphDistance(clock.anchor, core.anchor) > 1);
  assert.ok(Spatial.getRoute('mine', 'service_spiral').cells.length > Spatial.graphDistance(clock.anchor, core.anchor));
});

test('AC-V21-05 garden phase and occupied safe cell survive save hydration', () => {
  const state = Core.createInitialState(); finishValley(state); finishMine(state); enterGarden(state);
  Spatial.setGardenPhase(state.spatial, 'phase_b');
  state.worlds.garden.currentCell = Spatial.getLandmark('garden', 'root_basin').anchor.slice();
  const restored = Core.hydrateState(JSON.parse(JSON.stringify(state)));
  assert.equal(restored.spatial.garden.phaseId, 'phase_b');
  assert.deepEqual(restored.worlds.garden.currentCell, state.worlds.garden.currentCell);
  assert.equal(Spatial.graphPhase('garden', restored.spatial).safetyAnchor, 'root_basin');
});

test('AC-V21-06 gripping feet and float bladder complete through different non-dead-end routes', () => {
  const feet = completeThreeWorlds('feet', 'corridor'), bladder = completeThreeWorlds('bladder', 'corridor');
  assert.equal(feet.worlds.garden.completed, true);
  assert.equal(bladder.worlds.garden.completed, true);
  assert.equal(feet.worlds.garden.routeId, 'surface_anchor_chain');
  assert.equal(bladder.worlds.garden.routeId, 'wind_stream');
  assert.notEqual(Spatial.getRoute('garden', feet.worlds.garden.routeId).baseCost, Spatial.getRoute('garden', bladder.worlds.garden.routeId).baseCost);
});

test('AC-V21-07 mine recall only cites the correct valley places, routes and results', () => {
  const state = Core.createInitialState(); finishValley(state); Core.advanceCurrentWorld(state); Core.advanceCurrentWorld(state);
  const memory = state.memories.find(item => item.id === 'mem-valley-bridge');
  const sources = Core.memorySources(state, memory.id);
  assert.ok(memory.landmarkIds.includes('bridge_gap') && memory.routeIds.includes('bridge_main'));
  assert.equal(sources.every(event => event.worldId === 'valley'), true);
  assert.equal(sources.some(event => event.type === 'bridge_repaired'), true);
});

test('AC-V21-08 one strong ecology event cannot flip a core value', () => {
  const state = completeThreeWorlds('sensor', 'escort');
  assert.ok(state.values.ecological_restraint.mean - 0.51 <= 0.06);
  assert.ok(state.values.ecological_restraint.mean < 0.66);
});

test('AC-V21-09 observation without harm creates no fabricated negative evidence', () => {
  const state = Core.createInitialState(); finishValley(state); finishMine(state); enterGarden(state);
  const gardenEvents = state.events.filter(event => event.worldId === 'garden');
  assert.ok(gardenEvents.some(event => event.type === 'garden_observed'));
  assert.equal(gardenEvents.some(event => /忽视生态|生态伤害/.test(event.summary)), false);
});

test('AC-V21-10 all main paths and three releases run without online models', () => {
  const state = completeThreeWorlds('bladder', 'escort');
  ['short','schedule','crossworld'].forEach(boundary => Core.releaseAgent(state, boundary));
  assert.equal(state.releaseCount, 3);
  assert.equal(state.worlds.garden.completed, true);
  assert.equal(Core.exportBundle(state).versionManifest.modelPolicyVersion, 'offline-rules-v1');
});

test('AC-V21-11 twelve-hour catch-up keeps topology reversible and GraphPhase stable', () => {
  const state = completeThreeWorlds('feet', 'escort'), before = JSON.parse(JSON.stringify(state.spatial));
  const summary = Core.catchUpOffline(state, 12 * 60 * 60 * 1000);
  assert.equal(summary.irreversibleActions, 0);
  assert.equal(summary.elapsedHours, 12);
  assert.deepEqual(state.spatial, before);
});

test('AC-V21-12 previous schema migration retains artifact, commitment and spatial references', () => {
  const source = completeThreeWorlds('sensor', 'corridor');
  const previous = JSON.parse(JSON.stringify(source)); previous.version = 2;
  const restored = Core.hydrateState(previous);
  assert.equal(restored.version, '2.1');
  assert.equal(restored.artifacts[0].artifactId, source.artifacts[0].artifactId);
  assert.equal(restored.commitments[0].id, source.commitments[0].id);
  assert.deepEqual(restored.memories[0].eventRefs, source.memories[0].eventRefs);
  assert.ok(restored.events.some(event => event.spatial.landmarkIds.length && event.spatial.routeId && event.spatial.entityIds.length));
});

test('AC-V21-13 three releases explain decisions with place, route and identity commitment evidence', () => {
  const state = completeThreeWorlds('sensor', 'corridor');
  ['short','schedule','crossworld'].forEach(boundary => Core.releaseAgent(state, boundary));
  assert.equal(state.returnSummaries.length, 3);
  state.returnSummaries.forEach(summary => {
    assert.ok(summary.spatialEvidence.worldId && summary.spatialEvidence.regionId && summary.spatialEvidence.routeId);
    assert.ok(summary.spatialEvidence.landmarkIds.length > 0);
    assert.equal(summary.spatialEvidence.identityCommitmentId, 'com-bridge-open');
    const referenced = state.events.filter(event => summary.eventRefs.includes(event.id));
    assert.ok(referenced.some(event => event.spatial && event.spatial.routeId === summary.spatialEvidence.routeId));
  });
});

test('deployment entry is local-only and routes both /v2.1 spellings', () => {
  const html = fs.readFileSync(path.join(__dirname, '../v2.1/index.html'), 'utf8');
  const vercel = JSON.parse(fs.readFileSync(path.join(__dirname, '../vercel.json'), 'utf8'));
  assert.equal(/https?:\/\//.test(html), false);
  assert.ok(html.indexOf('../vendor/three.min.js') < html.indexOf('./spatial.js'));
  assert.ok(html.indexOf('./spatial.js') < html.indexOf('./core.js'));
  assert.ok(html.indexOf('./core.js') < html.indexOf('./app.js'));
  const routes = Object.fromEntries(vercel.rewrites.map(item => [item.source, item.destination]));
  assert.equal(routes['/v2.1'], '/v2.1/index.html');
  assert.equal(routes['/v2.1/'], '/v2.1/index.html');
});
