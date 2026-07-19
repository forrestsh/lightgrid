'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Core = require('../v2/core.js');

function finishValley(state) {
  for (let i = 0; i < Core.VALLEY_STEPS.length; i += 1) Core.advanceCurrentWorld(state);
}

function finishMine(state) {
  Core.advanceCurrentWorld(state); // travel from the completed valley
  for (let i = 0; i < Core.MINE_STEPS.length; i += 1) Core.advanceCurrentWorld(state);
}

function finishGarden(state, bodyPart = 'sensor', ecologyChoice = 'escort') {
  Core.advanceCurrentWorld(state); // travel from the completed mine
  Core.advanceCurrentWorld(state); // observe before intervening
  Core.chooseBodyPart(state, bodyPart);
  Core.advanceCurrentWorld(state); // navigate with the cultivated body
  Core.resolveGardenChoice(state, ecologyChoice);
}

function completeThreeWorlds(bodyPart, ecologyChoice) {
  const state = Core.createInitialState();
  finishValley(state);
  finishMine(state);
  finishGarden(state, bodyPart, ecologyChoice);
  return state;
}

test('initial state exposes one agent and only the valley', () => {
  const state = Core.createInitialState();
  assert.equal(state.agent.id, 'agent-cheng');
  assert.equal(state.worlds.valley.unlocked, true);
  assert.equal(state.worlds.mine.unlocked, false);
  assert.equal(state.worlds.garden.unlocked, false);
});

test('valley completion creates a sourced memory, artifact and mine unlock', () => {
  const state = Core.createInitialState();
  finishValley(state);
  assert.equal(state.worlds.valley.completed, true);
  assert.equal(state.worlds.mine.unlocked, true);
  assert.equal(state.artifacts[0].name, '共同桥梁加固器');
  assert.equal(Core.memorySources(state, 'mem-valley-bridge').length, 4);
});

test('mine transfer parameterizes the target while preserving all safety steps', () => {
  const state = Core.createInitialState();
  finishValley(state); finishMine(state);
  const skill = state.skills[0];
  assert.deepEqual(skill.steps, ['扫描', '隔离', '重同步', '验证']);
  assert.deepEqual(skill.contexts, ['NODE-17:+18', 'NODE-42:-11']);
  assert.equal(skill.successes, 2);
  assert.equal(state.relationships.technician.trust, 68);
  assert.equal(state.worlds.garden.unlocked, true);
});

test('garden body changes capability and a single value event stays bounded', () => {
  const state = completeThreeWorlds('bladder', 'escort');
  assert.match(state.agent.body, /浮游囊/);
  assert.equal(state.agent.energy, 73);
  assert.equal(state.worlds.garden.completed, true);
  assert.ok(state.values.ecological_restraint.mean - 0.51 <= 0.06);
  assert.equal(state.memories.length, 3);
  assert.equal(Core.continuityLabel(state), '清晰延续');
});

test('all three garden choices produce explainable but limited trajectories', () => {
  const outcomes = Object.keys(Core.GARDEN_CHOICES).map(choice => completeThreeWorlds('feet', choice));
  for (const state of outcomes) {
    assert.equal(state.worlds.garden.completed, true);
    assert.equal(state.memories[2].verified, true);
    assert.ok(Math.max(...Object.values(state.values).map(value => value.mean)) < 0.8);
  }
  assert.notEqual(outcomes[0].agent.narrative, outcomes[2].agent.narrative);
});

test('three release cycles stay reversible and source every return summary', () => {
  const state = completeThreeWorlds('sensor', 'corridor');
  ['short', 'schedule', 'crossworld'].forEach(boundary => Core.releaseAgent(state, boundary));
  assert.equal(state.releaseCount, 3);
  assert.equal(state.returnSummaries.length, 3);
  for (const summary of state.returnSummaries) {
    assert.equal(summary.irreversibleActions, 0);
    assert.equal(summary.eventRefs.length, 3);
    assert.ok(summary.fact && summary.reason && summary.action && summary.result && summary.unresolved);
  }
});

test('offline catch-up is skipped under five minutes and capped after 24 hours', () => {
  const recent = Core.createInitialState();
  assert.equal(Core.catchUpOffline(recent, 4 * 60 * 1000), null);
  const long = completeThreeWorlds('sensor', 'escort');
  const summary = Core.catchUpOffline(long, 72 * 60 * 60 * 1000);
  assert.equal(summary.offlineCapped, true);
  assert.equal(summary.elapsedHours, 24);
  assert.equal(summary.irreversibleActions, 0);
});

test('save hydration rejects incompatible input and preserves a valid journey', () => {
  const invalid = Core.hydrateState({ version: 999 });
  assert.equal(invalid.tick, 1042);
  const original = completeThreeWorlds('feet', 'corridor');
  const restored = Core.hydrateState(JSON.parse(JSON.stringify(original)));
  assert.equal(restored.agent.id, original.agent.id);
  assert.equal(restored.memories.length, 3);
  assert.equal(restored.skills[0].successes, 2);
});

test('export bundle declares offline model policy and stable version matrix', () => {
  const bundle = Core.exportBundle(completeThreeWorlds('sensor', 'escort'));
  assert.equal(bundle.format, 'lightgrid-v2-demo-save');
  assert.equal(bundle.versionManifest.modelPolicyVersion, 'offline-rules-v1');
  assert.equal(bundle.state.agent.id, 'agent-cheng');
});
