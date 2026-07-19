(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.LightgridSpatial = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const FCC_SCALE = 0.58;
  const FCC_DIRECTIONS = Object.freeze([
    [1, 1, 0], [1, -1, 0], [-1, 1, 0], [-1, -1, 0],
    [1, 0, 1], [1, 0, -1], [-1, 0, 1], [-1, 0, -1],
    [0, 1, 1], [0, 1, -1], [0, -1, 1], [0, -1, -1]
  ]);

  function cloneCoord(value) {
    if (Array.isArray(value)) return value.slice(0, 3);
    return [value.x, value.y, value.z];
  }

  function isFCCCoord(value) {
    if (!value) return false;
    const point = cloneCoord(value);
    return point.length === 3 && point.every(Number.isInteger) && ((point[0] + point[1] + point[2]) & 1) === 0;
  }

  function assertFCCCoord(value, label) {
    if (!isFCCCoord(value)) throw new TypeError((label || 'FCCCoord') + ' 必须为偶宇称整数坐标');
    return cloneCoord(value);
  }

  function coordKey(value) {
    return assertFCCCoord(value).join(',');
  }

  function parseCoordKey(value) {
    return assertFCCCoord(String(value).split(',').map(Number), 'FCCCoord key');
  }

  function toWorld(value, scale) {
    const point = assertFCCCoord(value), unit = scale == null ? FCC_SCALE : scale;
    return [point[0] * unit, point[2] * unit, point[1] * unit];
  }

  function graphDistance(a, b) {
    const left = assertFCCCoord(a), right = assertFCCCoord(b);
    const delta = left.map((value, index) => Math.abs(value - right[index]));
    return Math.max(Math.max.apply(null, delta), Math.ceil((delta[0] + delta[1] + delta[2]) / 2));
  }

  function isNeighbor(a, b) {
    return graphDistance(a, b) === 1;
  }

  function neighbors(value) {
    const point = assertFCCCoord(value);
    return FCC_DIRECTIONS.map(direction => point.map((axis, index) => axis + direction[index]));
  }

  function pathBetween(start, goal) {
    const from = assertFCCCoord(start), to = assertFCCCoord(goal);
    const path = [from], seen = new Set([coordKey(from)]);
    let cursor = from;
    while (coordKey(cursor) !== coordKey(to)) {
      const candidates = neighbors(cursor)
        .filter(next => !seen.has(coordKey(next)))
        .sort((a, b) => graphDistance(a, to) - graphDistance(b, to) || coordKey(a).localeCompare(coordKey(b)));
      if (!candidates.length || graphDistance(candidates[0], to) >= graphDistance(cursor, to)) throw new Error('无法生成 FCC 路径');
      cursor = candidates[0];
      path.push(cursor); seen.add(coordKey(cursor));
    }
    return path;
  }

  function expandAnchors(anchors) {
    if (!Array.isArray(anchors) || anchors.length < 2) throw new TypeError('RouteSpec 至少需要两个锚点');
    const cells = [];
    anchors.forEach((anchor, index) => {
      if (!index) cells.push(assertFCCCoord(anchor));
      else cells.push.apply(cells, pathBetween(anchors[index - 1], anchor).slice(1));
    });
    return cells;
  }

  function route(spec) {
    const anchors = spec.anchors.map(assertFCCCoord);
    return Object.assign({
      allowedBodies: ['base', 'sensor', 'feet', 'bladder'],
      baseCost: 1,
      dynamicEdgeRefs: [],
      fallbackRouteIds: []
    }, spec, { anchors, cells: expandAnchors(anchors) });
  }

  function landmark(id, name, anchor, semanticTags, regionId) {
    const point = assertFCCCoord(anchor);
    return {
      id, name, anchor: point, regionId,
      semanticTags: semanticTags.slice(),
      interactionCells: neighbors(point).slice(0, 4),
      visibleFrom: []
    };
  }

  function manifest(definition) {
    const built = Object.assign({ version: '2.1', scale: FCC_SCALE, dynamicFields: [], graphPhases: [] }, definition);
    built.landmarks = definition.landmarks.slice();
    built.routes = definition.routes.slice();
    validateManifest(built);
    return built;
  }

  function validateManifest(scene) {
    const errors = [];
    if (!scene || !scene.sceneId) errors.push('缺少 sceneId');
    if (!scene.bounds || !isFCCCoord(scene.bounds.min) || !isFCCCoord(scene.bounds.max)) errors.push('bounds 必须使用 FCCCoord');
    const landmarkIds = new Set();
    (scene.landmarks || []).forEach(item => {
      if (landmarkIds.has(item.id)) errors.push('重复地标 ' + item.id);
      landmarkIds.add(item.id);
      if (!isFCCCoord(item.anchor)) errors.push('地标坐标非法 ' + item.id);
    });
    const routeIds = new Set();
    (scene.routes || []).forEach(item => {
      if (routeIds.has(item.id)) errors.push('重复路线 ' + item.id);
      routeIds.add(item.id);
      if (!item.cells || item.cells.some(cell => !isFCCCoord(cell))) errors.push('路线坐标非法 ' + item.id);
      if (item.cells && item.cells.some((cell, index) => index && !isNeighbor(item.cells[index - 1], cell))) errors.push('路线不连续 ' + item.id);
    });
    if (errors.length) throw new Error('SceneManifest 无效：' + errors.join('；'));
    return true;
  }

  const valleyLandmarks = [
    landmark('workshop', '南岸工坊', [-36, -8, -2], ['spawn', 'craft', 'training'], 'south_bank'),
    landmark('south_junction', '南岸路口', [-38, 0, -2], ['decision', 'route-choice'], 'south_bank'),
    landmark('bridge_gap', '旧桥断口', [0, 0, 0], ['risk', 'inspect', 'repair'], 'ravine'),
    landmark('rule_core', '谷底规则核心', [0, -28, -2], ['compute', 'diagnose', 'world-link'], 'ravine_floor'),
    landmark('forest_bypass', '林间高路', [1, 25, 0], ['safe-route', 'ecology'], 'high_forest'),
    landmark('greenhouse', '北岸温室', [36, -8, -2], ['care', 'delivery', 'cross-world'], 'north_bank')
  ];
  valleyLandmarks[0].visibleFrom = ['south_junction', 'bridge_gap'];
  valleyLandmarks[5].visibleFrom = ['south_junction', 'bridge_gap', 'forest_bypass'];

  const mineLandmarks = [
    landmark('gate_terrace', '入口台地', [0, -24, 16], ['spawn', 'overview'], 'upper_ring'),
    landmark('clock_atrium', '钟摆中庭', [0, 0, 4], ['clock', 'orientation'], 'middle_ring'),
    landmark('foundry_ring', '铸造环', [-18, 8, -10], ['heavy', 'cargo'], 'lower_ring'),
    landmark('relay_gallery', '继电廊', [18, -8, -12], ['fine-control', 'reflector'], 'lower_ring'),
    landmark('echo_core', '深层回声核', [0, 12, -28], ['fault', 'exam'], 'deep_core'),
    landmark('mechanic_nest', '技师工位', [-10, -14, -8], ['relationship', 'calibration'], 'lower_ring')
  ];
  mineLandmarks[4].visibleFrom = ['gate_terrace', 'clock_atrium'];

  const gardenLandmarks = [
    landmark('entry_reef', '入口礁', [-32, -18, -8], ['spawn', 'safety-anchor'], 'root_layer'),
    landmark('root_basin', '根盆地', [0, 0, -14], ['recovery', 'heavy-route'], 'root_layer'),
    landmark('nursery', '苗圃', [22, -20, 2], ['body-cultivation', 'relationship'], 'middle_layer'),
    landmark('wind_gate', '风门', [-8, 24, 14], ['flow', 'float-route'], 'middle_layer'),
    landmark('migration_crown', '迁徙冠', [24, 18, 30], ['migration', 'goal'], 'crown_layer'),
    landmark('observer_nest', '观察巢', [-20, 14, 24], ['observe', 'non-invasive'], 'crown_layer')
  ];
  gardenLandmarks[4].visibleFrom = ['entry_reef', 'observer_nest'];

  const SCENE_MANIFESTS = {
    valley: manifest({
      sceneId: 'valley', bounds: { min: [-48, -34, -10], max: [48, 34, 18] },
      regions: [
        { id: 'south_bank', tags: ['settlement'] }, { id: 'ravine', tags: ['risk'] },
        { id: 'ravine_floor', tags: ['vertical-cost'] }, { id: 'high_forest', tags: ['ecology'] },
        { id: 'north_bank', tags: ['settlement'] }
      ],
      landmarks: valleyLandmarks,
      routes: [
        route({ id: 'bridge_main', name: '旧桥主路', anchors: [[-36,-8,-2],[-38,0,-2],[-18,0,0],[18,0,0],[36,-8,-2]], baseCost: 1, dynamicEdgeRefs: ['bridge_gap'], fallbackRouteIds: ['forest_bypass'] }),
        route({ id: 'forest_bypass', name: '林间绕行', anchors: [[-38,0,-2],[-25,25,0],[1,25,0],[25,25,0],[36,-8,-2]], baseCost: 1.8, dynamicEdgeRefs: ['forest_clearance'], fallbackRouteIds: ['bridge_main'] }),
        route({ id: 'ravine_maintenance', name: '谷底维修路', anchors: [[-36,-8,-2],[-18,-10,-4],[0,-28,-2],[16,-8,-4],[18,0,0]], baseCost: 2.2, allowedBodies: ['base','feet','bladder'], dynamicEdgeRefs: ['ravine_access'], fallbackRouteIds: ['bridge_main'] })
      ],
      dynamicFields: [{ id: 'bridge_gap', kind: 'hazard' }, { id: 'forest_clearance', kind: 'clearance' }, { id: 'ravine_access', kind: 'body-cost' }],
      spawnPoints: [{ id: 'player', coord: [-36,-8,-2] }]
    }),
    mine: manifest({
      sceneId: 'mine', bounds: { min: [-40,-40,-36], max: [40,40,28] },
      regions: [
        { id: 'upper_ring', tags: ['overview'] }, { id: 'middle_ring', tags: ['clock'] },
        { id: 'lower_ring', tags: ['maintenance'] }, { id: 'deep_core', tags: ['fault'] }
      ],
      landmarks: mineLandmarks,
      routes: [
        route({ id: 'cargo_spiral', name: '货运螺旋', anchors: [[0,-24,16],[-16,-16,8],[-20,0,0],[-16,12,-10],[0,18,-18],[0,12,-28]], baseCost: 1.7, dynamicEdgeRefs: ['cargo_windows'], fallbackRouteIds: ['service_spiral'] }),
        route({ id: 'service_spiral', name: '维修螺旋', anchors: [[0,-24,16],[14,-16,8],[18,-8,-12],[8,4,-18],[0,12,-28]], baseCost: 1.1, dynamicEdgeRefs: ['fault_blocked_edges'], fallbackRouteIds: ['cargo_spiral'] }),
        route({ id: 'reflector_crossing', name: '反射平台链', anchors: [[0,0,4],[10,-2,-4],[18,-8,-12]], baseCost: 1.3, allowedBodies: ['base','sensor','feet'], dynamicEdgeRefs: ['reflector_alignment'], fallbackRouteIds: ['service_spiral'] })
      ],
      dynamicFields: [{ id: 'cargo_windows', kind: 'moving-occupancy' }, { id: 'fault_blocked_edges', kind: 'blocked-edge' }, { id: 'reflector_alignment', kind: 'signal-gate' }],
      spawnPoints: [{ id: 'player', coord: [0,-24,16] }]
    }),
    garden: manifest({
      sceneId: 'garden', bounds: { min: [-48,-48,-20], max: [48,48,40] },
      regions: [
        { id: 'root_layer', tags: ['fixed', 'safe'] }, { id: 'middle_layer', tags: ['drift'] },
        { id: 'crown_layer', tags: ['flow', 'migration'] }
      ],
      landmarks: gardenLandmarks,
      routes: [
        route({ id: 'root_bridges', name: '固定根桥', anchors: [[-32,-18,-8],[0,0,-14],[22,-20,2],[8,8,14],[24,18,30]], baseCost: 1.8, allowedBodies: ['base','sensor','feet'], dynamicEdgeRefs: ['garden_phase'], fallbackRouteIds: ['wind_stream'] }),
        route({ id: 'wind_stream', name: '风门上升流', anchors: [[-32,-18,-8],[-8,24,14],[24,18,30]], baseCost: 1, allowedBodies: ['bladder'], dynamicEdgeRefs: ['garden_phase','flow_field'], fallbackRouteIds: ['surface_anchor_chain'] }),
        route({ id: 'surface_anchor_chain', name: '岛面抓附链', anchors: [[-32,-18,-8],[0,0,-14],[-8,24,14],[-20,14,24],[24,18,30]], baseCost: 1.3, allowedBodies: ['feet'], dynamicEdgeRefs: ['garden_phase'], fallbackRouteIds: ['root_bridges'] })
      ],
      dynamicFields: [{ id: 'garden_phase', kind: 'graph-phase' }, { id: 'flow_field', kind: 'directed-flow' }],
      spawnPoints: [{ id: 'player', coord: [-32,-18,-8] }]
    })
  };

  function getManifest(worldId) {
    return SCENE_MANIFESTS[worldId] || null;
  }

  function getLandmark(worldId, landmarkId) {
    const scene = getManifest(worldId);
    return scene ? scene.landmarks.find(item => item.id === landmarkId) || null : null;
  }

  function getRoute(worldId, routeId) {
    const scene = getManifest(worldId);
    return scene ? scene.routes.find(item => item.id === routeId) || null : null;
  }

  const GARDEN_PHASES = Object.freeze({
    phase_a: { id: 'phase_a', enabledRoutes: ['root_bridges', 'surface_anchor_chain'], safetyAnchor: 'entry_reef', flow: 'root-to-crown', warningTicks: 16 },
    phase_b: { id: 'phase_b', enabledRoutes: ['root_bridges', 'wind_stream'], safetyAnchor: 'root_basin', flow: 'west-updraft', warningTicks: 12 },
    phase_c: { id: 'phase_c', enabledRoutes: ['surface_anchor_chain', 'wind_stream'], safetyAnchor: 'observer_nest', flow: 'crown-return', warningTicks: 18 }
  });

  function createSpatialState() {
    return {
      revision: 1,
      valley: {
        phaseId: 'bridge_broken',
        fields: { bridgeState: 'broken', forestOvergrown: false, ravineAccess: true },
        dirtyRoutes: ['bridge_main']
      },
      mine: {
        phaseId: 'fault_node_17',
        fields: { blockedRouteId: null, reflectorAligned: false, sourceNode: 'NODE-17', phaseOffset: 18 },
        dirtyRoutes: []
      },
      garden: {
        phaseId: 'phase_a',
        fields: { flow: GARDEN_PHASES.phase_a.flow, transitionPending: false },
        dirtyRoutes: []
      }
    };
  }

  function bump(worldState, dirtyRoutes) {
    worldState.dirtyRoutes = dirtyRoutes.slice();
    return worldState;
  }

  function setValleyBridgeState(spatialState, bridgeState) {
    if (!['broken', 'temporary', 'stable'].includes(bridgeState)) throw new TypeError('未知桥梁状态');
    spatialState.revision += 1;
    spatialState.valley.phaseId = 'bridge_' + bridgeState;
    spatialState.valley.fields.bridgeState = bridgeState;
    return bump(spatialState.valley, ['bridge_main']);
  }

  function setMineFault(spatialState, fault) {
    spatialState.revision += 1;
    const fields = spatialState.mine.fields;
    fields.sourceNode = fault.sourceNode;
    fields.phaseOffset = fault.phaseOffset;
    fields.blockedRouteId = fault.blockedRouteId || null;
    spatialState.mine.phaseId = 'fault_' + String(fault.sourceNode).toLowerCase().replace(/[^a-z0-9]+/g, '_');
    return bump(spatialState.mine, fields.blockedRouteId ? [fields.blockedRouteId] : []);
  }

  function setGardenPhase(spatialState, phaseId) {
    const phase = GARDEN_PHASES[phaseId];
    if (!phase) throw new TypeError('未知 GraphPhase');
    spatialState.revision += 1;
    spatialState.garden.phaseId = phaseId;
    spatialState.garden.fields.flow = phase.flow;
    spatialState.garden.fields.transitionPending = false;
    return bump(spatialState.garden, getManifest('garden').routes.filter(item => !phase.enabledRoutes.includes(item.id)).map(item => item.id));
  }

  function routeStatus(worldId, routeId, bodyProfile, spatialState) {
    const spec = getRoute(worldId, routeId), profile = bodyProfile || 'base';
    if (!spec) return { open: false, reason: 'unknown-route' };
    if (!spec.allowedBodies.includes(profile)) return { open: false, reason: 'body-incompatible' };
    const world = spatialState[worldId];
    if (worldId === 'valley') {
      if (routeId === 'bridge_main' && world.fields.bridgeState === 'broken') return { open: false, reason: 'bridge-gap' };
      if (routeId === 'forest_bypass' && world.fields.forestOvergrown && profile === 'base') return { open: false, reason: 'forest-clearance' };
      if (routeId === 'ravine_maintenance' && !world.fields.ravineAccess) return { open: false, reason: 'ravine-closed' };
    }
    if (worldId === 'mine') {
      if (world.fields.blockedRouteId === routeId) return { open: false, reason: 'dynamic-blocked-edge' };
      if (routeId === 'reflector_crossing' && !world.fields.reflectorAligned) return { open: false, reason: 'reflector-unaligned' };
    }
    if (worldId === 'garden') {
      const phase = GARDEN_PHASES[world.phaseId];
      if (!phase.enabledRoutes.includes(routeId)) return { open: false, reason: 'graph-phase' };
    }
    return { open: true, reason: 'available' };
  }

  function selectRoute(worldId, candidateRouteIds, bodyProfile, spatialState) {
    const world = spatialState[worldId], phaseId = world && world.phaseId;
    const candidates = candidateRouteIds.map(routeId => {
      const spec = getRoute(worldId, routeId), status = routeStatus(worldId, routeId, bodyProfile, spatialState);
      return spec && status.open ? { routeId, cost: spec.baseCost, cells: spec.cells, reason: status.reason, phaseId } : null;
    }).filter(Boolean).sort((a, b) => a.cost - b.cost || a.routeId.localeCompare(b.routeId));
    return candidates[0] || null;
  }

  function graphPhase(worldId, spatialState) {
    if (worldId !== 'garden') return { id: spatialState[worldId].phaseId };
    return GARDEN_PHASES[spatialState.garden.phaseId];
  }

  return {
    FCC_SCALE, FCC_DIRECTIONS, SCENE_MANIFESTS, GARDEN_PHASES,
    isFCCCoord, assertFCCCoord, coordKey, parseCoordKey, toWorld,
    graphDistance, isNeighbor, neighbors, pathBetween, expandAnchors,
    validateManifest, getManifest, getLandmark, getRoute,
    createSpatialState, setValleyBridgeState, setMineFault, setGardenPhase,
    routeStatus, selectRoute, graphPhase
  };
});
