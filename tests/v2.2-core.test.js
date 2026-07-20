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

test('LIG-42 first embodied objective has a reachable inspection route and explicit action gate', () => {
  const state = Core.createInitialState(), mission = Core.currentMission(state);
  const target = Spatial.getLandmark('valley', mission.interaction.landmarkId);
  const route = Spatial.getRoute('valley', mission.interaction.routeId);
  const bypass = Spatial.getRoute('valley', 'forest_bypass');
  assert.equal(state.worlds.valley.routeId, 'bridge_inspection');
  assert.equal(mission.interaction.action, '检查旧桥');
  assert.equal(Spatial.routeStatus('valley', route.id, 'base', state.spatial).open, true);
  assert.ok(Math.min(...route.cells.map(cell => Spatial.graphDistance(cell, target.anchor))) <= mission.interaction.radius);
  assert.ok(Math.min(...bypass.cells.map(cell => Spatial.graphDistance(cell, target.anchor))) > mission.interaction.radius);
});

test('LIG-42 embodied HUD explains direction, distance and the contextual inspection control', () => {
  const html = fs.readFileSync(path.join(__dirname, '../v2.2/index.html'), 'utf8');
  const app = fs.readFileSync(path.join(__dirname, '../v2.2/app.js'), 'utf8');
  const css = fs.readFileSync(path.join(__dirname, '../v2.2/styles.css'), 'utf8');
  assert.match(html, /id="objectiveGuide"[\s\S]*id="objectiveDistance"/);
  assert.match(html, /<span>后退<\/span><kbd>S \/ ↓<\/kbd>/);
  assert.match(html, /<span>前进<\/span><kbd>W \/ ↑<\/kbd>/);
  assert.match(app, /还需\$\{status\.direction\} \$\{status\.remainingSteps\} 步/);
  assert.match(app, /els\.primaryAction\.disabled = !interactionObjective\.ready/);
  assert.match(app, /event\.code === 'Space'/);
  assert.match(css, /\.landmark-tag\.mission-target/);
  assert.match(css, /\.walk-pad button\.recommended/);
});

test('LIG-43 every autonomous release exposes a playable three-stage spatial action', () => {
  const state = completeThreeWorlds('sensor', 'escort');
  ['short', 'schedule', 'crossworld'].forEach(boundary => {
    const summary = Core.releaseAgent(state, boundary), playback = summary.playback;
    const route = Spatial.getRoute(playback.worldId, playback.routeId);
    const target = Spatial.getLandmark(playback.worldId, playback.targetLandmarkId);
    assert.deepEqual(playback.stages.map(stage => stage.id), ['travel', 'act', 'verify']);
    assert.deepEqual(playback.stages.map(stage => stage.endAt), [.62, .84, 1]);
    assert.ok(route && target);
    assert.ok(Math.min(...route.cells.map(cell => Spatial.graphDistance(cell, target.anchor))) <= 1);
    assert.equal(playback.stages[1].detail, summary.action);
    assert.equal(playback.stages[2].detail, summary.result);
  });
});

test('LIG-43 release starts a skippable 3D playback before showing the return summary', () => {
  const html = fs.readFileSync(path.join(__dirname, '../v2.2/index.html'), 'utf8');
  const app = fs.readFileSync(path.join(__dirname, '../v2.2/app.js'), 'utf8');
  const css = fs.readFileSync(path.join(__dirname, '../v2.2/styles.css'), 'utf8');
  assert.match(html, /id="releasePlayback"[\s\S]*id="skipReleasePlayback"/);
  assert.match(app, /function startReleasePlayback\(\)/);
  assert.match(app, /function updateReleasePlayback\(time\)/);
  assert.match(app, /world3d\.avatar\.position\.copy\(left\)\.lerp\(right, blend\)/);
  assert.match(app, /playback\.effect\.visible = stageIndex > 0/);
  assert.match(app, /els\.runReleaseButton\.addEventListener\('click', startReleasePlayback\)/);
  assert.match(app, /els\.skipReleasePlayback\.addEventListener\('click', finishReleasePlayback\)/);
  assert.match(css, /body\.release-playing/);
});

test('LIG-44 every valley interaction offers three non-dead-end approaches', () => {
  const baseline = Core.createInitialState();
  Core.VALLEY_STEPS.forEach((_, stepIndex) => {
    const mission = Core.currentMission(baseline), choices = mission.interaction.choices;
    assert.equal(choices.length, 3);
    assert.equal(new Set(choices.map(choice => choice.id)).size, 3);
    choices.forEach(choice => {
      const candidate = Core.hydrateState(JSON.parse(JSON.stringify(baseline)));
      Core.advanceCurrentWorld(candidate, choice.id);
      assert.equal(candidate.worlds.valley.step, stepIndex + 1);
      assert.equal(candidate.worlds.valley.choices.at(-1).choiceId, choice.id);
    });
    Core.advanceCurrentWorld(baseline, choices[0].id);
  });
  assert.equal(baseline.worlds.valley.completed, true);
});

test('LIG-44 alternative choices change resources, ownership, trust and commitment evidence', () => {
  const state = Core.createInitialState();
  ['inspect_together', 'borrow_standard', 'delegate_and_verify', 'shared_roster'].forEach(choice => Core.advanceCurrentWorld(state, choice));
  assert.equal(state.worlds.valley.completed, true);
  assert.deepEqual(state.worlds.valley.choices.map(item => item.choiceId), ['inspect_together', 'borrow_standard', 'delegate_and_verify', 'shared_roster']);
  assert.equal(state.agent.energy, 80);
  assert.equal(state.relationships.artisan.trust, 69);
  assert.equal(state.artifacts[0].ownership, 'borrowed');
  assert.deepEqual(state.artifacts[0].provenance.creators, ['npc-south-artisan']);
  assert.equal(state.artifacts[0].reliability, '3/3 监督验收通过');
  assert.match(state.commitments.at(-1).text, /共同复查/);
  assert.match(state.memories[0].summary, /不制作，借用标准构件/);
});

test('LIG-44 embodied choice UI supports click, A-D, number keys and space confirmation', () => {
  const app = fs.readFileSync(path.join(__dirname, '../v2.2/app.js'), 'utf8');
  const css = fs.readFileSync(path.join(__dirname, '../v2.2/styles.css'), 'utf8');
  assert.match(app, /function cycleInteractionChoice\(delta\)/);
  assert.match(app, /data-interaction-choice/);
  assert.match(app, /\['ArrowLeft','a','A'\]/);
  assert.match(app, /\['ArrowRight','d','D'\]/);
  assert.match(app, /\/\^\[1-3\]\$\//);
  assert.match(app, /Core\.advanceCurrentWorld\(state, choice && choice\.id\)/);
  assert.match(css, /\.mission-card\.has-interaction-choices/);
  assert.match(css, /\.choice-option\.on/);
});
