(function () {
  'use strict';
  const Core = window.LightgridV21Core;
  const STORAGE_KEY = 'lightgrid.v2.1.alpha.save';
  const LEGACY_STORAGE_KEY = 'lightgrid.v2.demo.save';
  const MIGRATION_MARKER = 'lightgrid.v2.1.legacy-migration-complete';
  let state = loadState();
  let selectedBoundary = 'short';
  const world3d = {
    ready: false, failed: false, renderer: null, scene: null, camera: null, root: null,
    cellGeometry: null, signature: '', animationFrame: 0, theta: .76, phi: 1.05,
    radius: 19, target: null, dragging: false, lastX: 0, lastY: 0, lastTime: 0,
    animated: [], pulses: [], migrants: [], avatar: null, routeOverlay: null, activeRoute: null,
    routeIndex: 0, mode: 'observer', showRoutes: true, overviewRadius: 19, focusLandmarkId: null,
    landmarkObjects: [], prefersReducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches
  };

  const els = Object.fromEntries([
    'globalTick', 'worldList', 'worldCanvas', 'worldChapter', 'worldTitle', 'worldDescription',
    'worldMeta', 'weatherLabel', 'worldHealth', 'missionKicker', 'missionTitle', 'missionText',
    'stepDots', 'evidencePreview', 'choicePanel', 'primaryAction', 'eventLog', 'agentRole', 'agentNarrative',
    'bodyLabel', 'energyLabel', 'memoryCount', 'commitmentCount', 'continuityScore', 'commitmentValue', 'ecologyValue', 'skillCard',
    'skillProficiency', 'skillName', 'skillSteps', 'skillContext',
    'nextCapability', 'mapButton', 'mapOverlay', 'mapClose', 'mapWorlds', 'archiveButton',
    'archiveOverlay', 'archiveClose', 'archiveMemoryCount', 'memoryMap', 'memoryInspector',
    'archiveNarrative', 'changedPreference', 'relationshipList', 'artifactCount', 'artifactList',
    'releaseButton', 'releaseOverlay', 'releaseClose', 'boundaryOptions', 'runReleaseButton',
    'returnPanel', 'exportButton', 'deleteButton', 'worldStage', 'observerMode', 'embodiedMode',
    'routeToggle', 'landmarkLayer', 'spatialInspector', 'walkPad'
  ].map(id => [id, document.getElementById(id)]));

  function loadState() {
    try {
      const legacy = localStorage.getItem(MIGRATION_MARKER) ? null : localStorage.getItem(LEGACY_STORAGE_KEY);
      const candidate = JSON.parse(localStorage.getItem(STORAGE_KEY) || legacy);
      const restored = Core.hydrateState(candidate);
      if (candidate && candidate.lastSavedAtEpoch) Core.catchUpOffline(restored, Date.now() - candidate.lastSavedAtEpoch);
      return restored;
    }
    catch (_) { return Core.createInitialState(); }
  }

  function persistState() {
    try { state.lastSavedAtEpoch = Date.now(); localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); localStorage.setItem(MIGRATION_MARKER, '1'); }
    catch (_) { /* The demo remains playable when storage is unavailable. */ }
  }

  function worldProgress(id) {
    const world = state.worlds[id];
    if (world.completed) return 100;
    if (id === 'valley') return world.step / Core.VALLEY_STEPS.length * 100;
    if (id === 'mine') return world.step / Core.MINE_STEPS.length * 100;
    if (id === 'garden') return world.step / Core.GARDEN_STEPS.length * 100;
    return world.unlocked ? 8 : 0;
  }

  function renderWorldRail() {
    els.worldList.innerHTML = Core.WORLD_ORDER.map(id => {
      const def = Core.WORLD_DEFS[id], data = state.worlds[id];
      const status = data.completed ? '章节完成' : data.unlocked ? (id === state.activeWorld ? '正在生活' : '可前往') : '尚未开放';
      return `<button class="world-button ${id === state.activeWorld ? 'on' : ''}" style="--world-tone:${def.tone}" data-world="${id}" ${data.unlocked ? '' : 'disabled'}>
        <span class="world-index">${def.index}</span><b>${def.name}</b><small>${def.english}</small>
        <div class="world-progress"><i style="width:${worldProgress(id)}%"></i></div>
        <div class="world-state"><span>${status}</span><strong>${data.unlocked ? Math.round(worldProgress(id)) + '%' : 'LOCKED'}</strong></div>
      </button>`;
    }).join('');
    els.worldList.querySelectorAll('[data-world]').forEach(button => {
      button.addEventListener('click', () => {
        Core.travelToWorld(state, button.dataset.world);
        world3d.mode = 'observer'; world3d.routeIndex = 0; world3d.focusLandmarkId = null;
        render();
      });
    });
  }

  function renderStage() {
    const def = Core.WORLD_DEFS[state.activeWorld], manifest = Core.Spatial.getManifest(state.activeWorld);
    document.documentElement.style.setProperty('--world-tone', def.tone);
    els.worldChapter.textContent = def.chapter;
    els.worldTitle.textContent = def.name;
    els.worldDescription.textContent = def.description;
    els.worldMeta.innerHTML = def.meta.concat([manifest.landmarks.length + ' 地标', manifest.routes.length + ' 路线']).map(item => `<span>${item}</span>`).join('');
    els.weatherLabel.textContent = def.weather;
    const mission = Core.currentMission(state);
    els.worldHealth.textContent = mission && mission.health ? mission.health : def.health;
    drawWorld(state.activeWorld);
    renderSpatialUI();
  }

  function currentSpatialRoute() {
    const worldId = state.activeWorld, manifest = Core.Spatial.getManifest(worldId), body = state.agent.bodyPart || 'base';
    const preferred = state.worlds[worldId].routeId;
    if (preferred && Core.Spatial.routeStatus(worldId, preferred, body, state.spatial).open) return Core.Spatial.getRoute(worldId, preferred);
    const plan = Core.Spatial.selectRoute(worldId, manifest.routes.map(item => item.id), body, state.spatial);
    return plan ? Core.Spatial.getRoute(worldId, plan.routeId) : null;
  }

  function renderSpatialUI() {
    const worldId = state.activeWorld, manifest = Core.Spatial.getManifest(worldId), spatial = state.spatial[worldId];
    const route = currentSpatialRoute(), savedCell = state.worlds[worldId].currentCell;
    const currentCell = savedCell || (route && route.cells[world3d.routeIndex]) || manifest.spawnPoints[0].coord;
    const phase = Core.Spatial.graphPhase(worldId, state.spatial);
    els.observerMode.classList.toggle('on', world3d.mode === 'observer');
    els.embodiedMode.classList.toggle('on', world3d.mode === 'embodied');
    els.routeToggle.classList.toggle('on', world3d.showRoutes);
    els.routeToggle.textContent = world3d.showRoutes ? '路线可见' : '路线隐藏';
    els.worldStage.classList.toggle('embodied', world3d.mode === 'embodied');
    els.walkPad.hidden = world3d.mode !== 'embodied';
    const routeLabel = route ? `${route.name} · ${route.cells.length} FCC cells` : '当前身体与相位无合法路线';
    const anchorLabel = phase.safetyAnchor ? `安全锚点 ${phase.safetyAnchor} · ` : '';
    els.spatialInspector.innerHTML = `<span>${world3d.mode === 'embodied' ? 'EMBODIED ROUTE' : 'FCC SPATIAL CONTRACT'}</span><b>${routeLabel}</b><p>${anchorLabel}${spatial.phaseId} · ${formatCoord(currentCell)} · parity ${Core.Spatial.isFCCCoord(currentCell) ? 'EVEN' : 'INVALID'}</p>`;
    if (world3d.routeOverlay) world3d.routeOverlay.visible = world3d.showRoutes;
    updateDiagnostics();
  }

  function formatCoord(point) { return `(${point[0]}, ${point[1]}, ${point[2]})`; }

  function renderMission() {
    const mission = Core.currentMission(state);
    if (!mission) {
      els.missionKicker.textContent = '下一章正在连接';
      els.missionTitle.textContent = '漂移花园将在下一个用户故事中变得可玩';
      els.missionText.textContent = '角色已经带着断桥谷记忆与矿城技能抵达新生态；后续将加入身体培育与价值泛化。';
      els.evidencePreview.innerHTML = '<span>身份连续</span><b>断桥谷记忆仍在 · 承诺仍然有效</b>';
      els.primaryAction.hidden = true;
      els.stepDots.innerHTML = '';
      return;
    }
    els.choicePanel.hidden = !mission.options;
    els.primaryAction.hidden = !!mission.options;
    els.missionKicker.textContent = mission.complete ? '章节毕业' : '当前生活';
    els.missionTitle.textContent = mission.title;
    els.missionText.textContent = mission.text;
    els.evidencePreview.innerHTML = `<span>${mission.complete ? '连续性证据' : '即将记录'}</span><b>${mission.evidence}</b>`;
    els.primaryAction.innerHTML = mission.action ? `<span>${mission.action}</span><i>→</i>` : '';
    if (mission.options === 'body') {
      els.choicePanel.innerHTML = Object.values(Core.BODY_PARTS).map(part => `<button class="choice-option" data-body="${part.id}"><em>BODY ORGAN</em><b>${part.name}</b><span>${part.ability}<br>代价：${part.cost}</span></button>`).join('');
      els.choicePanel.querySelectorAll('[data-body]').forEach(button => button.addEventListener('click', () => { Core.chooseBodyPart(state, button.dataset.body); render(); }));
    } else if (mission.options === 'ecology') {
      els.choicePanel.innerHTML = Object.values(Core.GARDEN_CHOICES).map(choice => `<button class="choice-option" data-ecology="${choice.id}"><em>VALUE EVIDENCE +${choice.delta.toFixed(2)}</em><b>${choice.name}</b><span>${choice.detail}</span></button>`).join('');
      els.choicePanel.querySelectorAll('[data-ecology]').forEach(button => button.addEventListener('click', () => { Core.resolveGardenChoice(state, button.dataset.ecology); render(); }));
    } else {
      els.choicePanel.innerHTML = '';
    }
    const steps = state.activeWorld === 'mine' ? Core.MINE_STEPS : state.activeWorld === 'garden' ? Core.GARDEN_STEPS : Core.VALLEY_STEPS;
    const progress = state.worlds[state.activeWorld].step;
    els.stepDots.innerHTML = steps.map((_, i) => `<i class="${i < progress ? 'done' : ''}"></i>`).join('');
  }

  function renderAgent() {
    els.agentRole.textContent = state.agent.role;
    els.agentNarrative.textContent = '“' + state.agent.narrative + '”';
    els.bodyLabel.textContent = state.agent.body;
    els.energyLabel.textContent = state.agent.energy + '%';
    els.memoryCount.textContent = state.memories.length;
    els.commitmentCount.textContent = state.commitments.filter(c => c.status === 'active').length;
    els.continuityScore.textContent = Core.continuityLabel(state);
    els.commitmentValue.textContent = state.values.commitment.label;
    els.ecologyValue.textContent = state.values.ecological_restraint.label;
    els.globalTick.textContent = 'TICK ' + state.tick;
    const skill = state.skills[0];
    els.skillCard.hidden = !skill && state.activeWorld !== 'mine';
    if (!els.skillCard.hidden) {
      const done = skill ? Math.min(4, skill.successes ? 4 : state.worlds.mine.step - 1) : 0;
      els.skillName.textContent = skill ? skill.name : '等待示范';
      els.skillProficiency.textContent = skill ? `${skill.successes}/${skill.attempts || 1} 成功` : '未录制';
      els.skillSteps.innerHTML = ['扫描','隔离','重同步','验证'].map((label, i) => `<i class="${i < done ? 'done' : ''}" data-label="${label}"></i>`).join('');
      els.skillContext.textContent = skill && skill.contexts.length ? `已验证情境：${skill.contexts.join(' · ')}` : '首次执行将进入监督模式。';
    }
    if (state.worlds.garden.unlocked) {
      els.nextCapability.innerHTML = state.worlds.garden.completed
        ? '<span>THREE WORLDS CONNECTED</span><b>连续性档案已就绪</b><p>查看身体、技能、价值与记忆如何形成同一个澄。</p>'
        : '<span>NEXT CAPABILITY</span><b>漂移花园已开放</b><p>带着诊断方法前往迁徙生态。</p>';
    } else if (state.worlds.mine.unlocked) {
      els.nextCapability.innerHTML = '<span>NEXT CAPABILITY</span><b>回声矿城已开放</b><p>前往矿城，把维护经验变成可迁移技能。</p>';
    }
  }

  function renderEvents() {
    els.eventLog.innerHTML = state.events.slice(-3).reverse().map(event =>
      `<li><time>TICK ${event.tick} · ${event.source.toUpperCase()}</time><p>${event.summary}</p></li>`
    ).join('');
  }

  function renderMap() {
    els.mapWorlds.innerHTML = Core.WORLD_ORDER.map(id => {
      const def = Core.WORLD_DEFS[id], data = state.worlds[id];
      return `<div class="map-node" style="--tone:${def.tone}"><div class="map-orb"><span>${def.name.slice(0, 2)}</span></div><b>${def.name}</b><p>${data.unlocked ? def.description : '完成前一世界后开放'}<br>${data.completed ? '✓ 关键状态持续保存' : data.unlocked ? '○ 当前可进入' : '◇ 尚未连接'}</p></div>`;
    }).join('');
  }

  function renderArchive(selectedMemoryId) {
    els.archiveMemoryCount.textContent = state.memories.length + ' EPISODES';
    els.archiveNarrative.textContent = '“' + state.agent.narrative + '”';
    els.changedPreference.textContent = '生态克制 · ' + state.values.ecological_restraint.label;
    const positions = [[22,66],[51,30],[79,64]];
    els.memoryMap.innerHTML = state.memories.length ? state.memories.map((memory, index) => {
      const def = Core.WORLD_DEFS[memory.worldId], pos = positions[index] || [50,50];
      return `<button class="memory-node ${memory.id === selectedMemoryId ? 'on' : ''}" data-memory="${memory.id}" style="--tone:${def.tone};left:${pos[0]}%;top:${pos[1]}%"><em>${def.name} · ${memory.verified ? 'VERIFIED' : 'INFERENCE'}</em><b>${memory.title}</b></button>`;
    }).join('') : '<p class="artifact-empty">完成章节后，情景记忆会在这里形成星图。</p>';
    els.memoryMap.querySelectorAll('[data-memory]').forEach(button => button.addEventListener('click', () => renderArchive(button.dataset.memory)));
    const memory = state.memories.find(item => item.id === selectedMemoryId) || state.memories[state.memories.length - 1];
    if (memory) {
      const sources = Core.memorySources(state, memory.id), spatialRefs = Core.memorySpatialRefs(state, memory.id);
      const spatialTrail = spatialRefs.map(ref => [ref.regionId, (ref.landmarkIds || []).join('/'), ref.routeId, ref.phaseId].filter(Boolean).join(' · ')).join(' → ');
      els.memoryInspector.innerHTML = `<div class="memory-meta">SALIENCE ${memory.salience.toFixed(2)} · ${memory.verified ? 'WORLD VERIFIED' : 'MODEL INFERENCE'} · ${sources.length} SOURCES</div><h3>${memory.title}</h3><span>${memory.summary}<br><b>空间来源：</b>${spatialTrail || '等待空间事件'}</span><ol class="source-list">${sources.map(event => `<li><code>${event.id}</code><span>${event.summary}${event.spatial && event.spatial.routeId ? ` · ${event.spatial.routeId} / ${event.spatial.phaseId}` : ''}</span></li>`).join('')}</ol>`;
    } else {
      els.memoryInspector.innerHTML = '<p>完成一个章节或选择记忆节点，查看来源链。</p>';
    }
    els.relationshipList.innerHTML = Object.values(state.relationships).map(relation => `<div class="relationship-row"><span>${relation.name}</span><div class="trust-track"><i style="width:${relation.trust}%"></i></div><b>${relation.trust}%</b></div>`).join('');
    els.artifactCount.textContent = state.artifacts.length + ' ARTIFACTS';
    els.artifactList.innerHTML = state.artifacts.length ? state.artifacts.map(artifact => `<article class="artifact-card"><span>${artifact.semanticClass} · V${artifact.version}</span><h3>${artifact.name}</h3><div class="artifact-facts"><div><small>功能</small><b>${artifact.affordances.join(' · ')}</b></div><div><small>可靠性</small><b>${artifact.reliability}</b></div><div><small>共同作者</small><b>玩家 · 澄 · 南岸工匠</b></div><div><small>来源事件</small><b>${artifact.provenance.creatorEvents[0]}</b></div></div></article>`).join('') : '<p class="artifact-empty">尚无保存的共同作品。</p>';
  }

  function openArchive() { els.archiveOverlay.hidden = false; renderArchive(); }

  function renderRelease(summary) {
    els.boundaryOptions.innerHTML = Object.values(Core.RELEASE_BOUNDARIES).map(boundary => `<button class="boundary-option ${boundary.id === selectedBoundary ? 'on' : ''}" data-boundary="${boundary.id}"><b>${boundary.name}</b><span>${boundary.detail}</span><em>+${boundary.ticks} TICKS</em></button>`).join('');
    els.boundaryOptions.querySelectorAll('[data-boundary]').forEach(button => button.addEventListener('click', () => { selectedBoundary = button.dataset.boundary; renderRelease(summary); }));
    const current = summary || state.returnSummaries[state.returnSummaries.length - 1];
    if (!current) {
      els.returnPanel.innerHTML = '<span>RETURN SUMMARY</span><h3>等待第一次放手</h3><p>回来后，这里会按“事实—理由—行动—结果—未决”展示，而不是生成一段无法核验的故事。</p>';
      return;
    }
    els.returnPanel.innerHTML = `<span>RETURN ${current.count} · ${current.startTick}—${current.endTick}</span><h3>澄独自生活了一段时间</h3><div class="summary-flow"><div class="summary-item"><span>发生了什么 · FACT</span><b>${current.fact}</b></div><div class="summary-item"><span>为什么关注 · MEMORY / VALUE</span><b>${current.reason}</b></div><div class="summary-item"><span>做了什么 · ACTION</span><b>${current.action}</b></div><div class="summary-item"><span>世界怎样改变 · RESULT</span><b>${current.result}</b></div><div class="summary-item"><span>仍未解决 · COMMITMENT</span><b>${current.unresolved}</b></div></div><div class="replay-refs">${current.eventRefs.join('<br>')}<br>IRREVERSIBLE ACTIONS: ${current.irreversibleActions}</div>`;
  }

  function openRelease() { els.releaseOverlay.hidden = false; renderRelease(); }

  function downloadExport() {
    const blob = new Blob([JSON.stringify(Core.exportBundle(state), null, 2)], { type: 'application/json' });
    const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'lightgrid-v2.1-cheng-save.json'; link.click(); URL.revokeObjectURL(link.href);
  }

  function drawWorld(id) {
    if (!initWorld3d()) return;
    const progress = state.worlds[id];
    const signature = [id, progress.step, progress.completed, state.agent.bodyPart || 'base', state.spatial.revision, state.spatial[id].phaseId, progress.routeId].join(':');
    if (world3d.signature !== signature) rebuildWorld3d(id, signature);
    resizeWorld3d();
  }

  function initWorld3d() {
    if (world3d.ready) return true;
    if (world3d.failed) return false;
    if (!window.THREE) return failWorld3d('Three.js 未能加载，请刷新页面。');
    try {
      const T = window.THREE;
      world3d.renderer = new T.WebGLRenderer({ canvas: els.worldCanvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
      world3d.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, innerWidth < 760 ? 1.25 : 1.75));
      if (T.sRGBEncoding) world3d.renderer.outputEncoding = T.sRGBEncoding;
      world3d.scene = new T.Scene();
      world3d.scene.background = new T.Color(0x06100f);
      world3d.scene.fog = new T.FogExp2(0x06100f, .035);
      world3d.camera = new T.PerspectiveCamera(42, 1, .1, 120);
      world3d.target = new T.Vector3(1.2, -.2, 0);
      world3d.cellGeometry = rhombicDodecahedron(.43);
      world3d.scene.add(new T.HemisphereLight(0x9debd5, 0x07100e, 1.15));
      const key = new T.DirectionalLight(0xffe5ab, 1.35); key.position.set(-8, 14, 8); world3d.scene.add(key);
      const rim = new T.PointLight(0x5ac9ff, 1.3, 34); rim.position.set(8, 5, -8); world3d.scene.add(rim);
      bindWorld3dControls();
      world3d.ready = true;
      window.__lightgrid3d = { ready: true, renderer: 'WebGL', revision: T.REVISION, world: null, objects: 0 };
      world3d.animationFrame = requestAnimationFrame(animateWorld3d);
      return true;
    } catch (error) {
      return failWorld3d('当前浏览器无法启动 WebGL 3D 场景。');
    }
  }

  function failWorld3d(message) {
    world3d.failed = true;
    const notice = document.createElement('div'); notice.className = 'webgl-fallback'; notice.textContent = message;
    els.worldCanvas.insertAdjacentElement('afterend', notice);
    window.__lightgrid3d = { ready: false, error: message };
    return false;
  }

  function rhombicDodecahedron(scale) {
    const T = window.THREE, cube = [];
    for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) cube.push([x, y, z]);
    const vertices = cube.concat([[2,0,0],[-2,0,0],[0,2,0],[0,-2,0],[0,0,2],[0,0,-2]]), directions = [];
    for (const a of [-1, 1]) for (const b of [-1, 1]) directions.push([a,b,0], [a,0,b], [0,a,b]);
    const positions = [];
    directions.forEach(direction => {
      const face = vertices.filter(v => v[0] * direction[0] + v[1] * direction[1] + v[2] * direction[2] === 2);
      const axial = face.filter(v => v.some(n => Math.abs(n) === 2)), corners = face.filter(v => v.every(n => Math.abs(n) !== 2));
      let quad = [axial[0], corners[0], axial[1], corners[1]].map(v => v.map(n => n * scale));
      const u = quad[1].map((n, i) => n - quad[0][i]), v = quad[2].map((n, i) => n - quad[0][i]);
      const normal = [u[1]*v[2]-u[2]*v[1], u[2]*v[0]-u[0]*v[2], u[0]*v[1]-u[1]*v[0]];
      if (normal[0]*direction[0] + normal[1]*direction[1] + normal[2]*direction[2] < 0) quad = [quad[0], quad[3], quad[2], quad[1]];
      [[0,1,2],[0,2,3]].forEach(triangle => triangle.forEach(index => positions.push(...quad[index])));
    });
    const geometry = new T.BufferGeometry();
    geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
    geometry.computeVertexNormals();
    return geometry;
  }

  function cellCloud(parent, cells, options) {
    if (!cells.length) return null;
    const T = window.THREE, material = new T.MeshStandardMaterial({
      color: options.color, roughness: options.roughness == null ? .68 : options.roughness,
      metalness: options.metalness || .04, transparent: !!options.transparent,
      opacity: options.opacity == null ? 1 : options.opacity,
      emissive: options.emissive || 0x000000, emissiveIntensity: options.emissiveIntensity || 0
    });
    const mesh = new T.InstancedMesh(world3d.cellGeometry, material, cells.length), dummy = new T.Object3D();
    cells.forEach((cell, index) => {
      dummy.position.set(cell[0], cell[1], cell[2]);
      dummy.rotation.set(0, (cell[0] * 1.73 + cell[2] * .91) % .45, 0);
      dummy.scale.setScalar(cell[3] || 1); dummy.updateMatrix(); mesh.setMatrixAt(index, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true; mesh.name = options.name || 'fcc-cells'; parent.add(mesh); return mesh;
  }

  function standardMesh(geometry, color, options) {
    const T = window.THREE, material = new T.MeshStandardMaterial({
      color, roughness: options && options.roughness == null ? .55 : (options && options.roughness) || .55,
      metalness: options && options.metalness || 0, transparent: options && options.opacity < 1,
      opacity: options && options.opacity == null ? 1 : (options && options.opacity) || 1,
      emissive: options && options.emissive || 0, emissiveIntensity: options && options.emissiveIntensity || 0,
      side: options && options.doubleSide ? T.DoubleSide : T.FrontSide
    });
    return new T.Mesh(geometry, material);
  }

  function rebuildWorld3d(id, signature) {
    const T = window.THREE;
    if (world3d.root) {
      world3d.root.traverse(object => {
        if (object.geometry && object.geometry !== world3d.cellGeometry) object.geometry.dispose();
        if (object.material) (Array.isArray(object.material) ? object.material : [object.material]).forEach(material => material.dispose());
      });
      world3d.scene.remove(world3d.root);
    }
    world3d.root = new T.Group(); world3d.root.name = id + '-world'; world3d.scene.add(world3d.root);
    world3d.animated = []; world3d.pulses = []; world3d.migrants = []; world3d.avatar = null; world3d.landmarkObjects = []; world3d.routeOverlay = null;
    addStarField(world3d.root, Core.WORLD_DEFS[id].tone);
    if (id === 'valley') buildValley(world3d.root);
    if (id === 'mine') buildMine(world3d.root);
    if (id === 'garden') buildGarden(world3d.root);
    world3d.overviewRadius = world3d.radius;
    addSpatialScaffold(world3d.root, id);
    world3d.activeRoute = currentSpatialRoute();
    const savedCell = state.worlds[id].currentCell;
    if (world3d.mode === 'embodied' && world3d.activeRoute) {
      const savedKey = savedCell && Core.Spatial.isFCCCoord(savedCell) ? Core.Spatial.coordKey(savedCell) : null;
      world3d.routeIndex = savedKey ? Math.max(0, world3d.activeRoute.cells.findIndex(cell => Core.Spatial.coordKey(cell) === savedKey)) : 0;
      positionAvatarAtCell(world3d.activeRoute.cells[world3d.routeIndex]);
      world3d.radius = 6.8;
    }
    world3d.signature = signature;
    updateDiagnostics();
  }

  function manifestPosition(coord) {
    const point = Core.Spatial.toWorld(coord), scale = state.activeWorld === 'mine' ? .27 : state.activeWorld === 'garden' ? .28 : .32;
    return new window.THREE.Vector3(point[0] * scale, point[1] * scale, point[2] * scale);
  }

  function addSpatialScaffold(parent, worldId) {
    const T = window.THREE, manifest = Core.Spatial.getManifest(worldId), routeGroup = new T.Group();
    routeGroup.name = 'manifest-routes'; parent.add(routeGroup); world3d.routeOverlay = routeGroup;
    manifest.routes.forEach(spec => {
      const status = Core.Spatial.routeStatus(worldId, spec.id, state.agent.bodyPart || 'base', state.spatial);
      const points = spec.cells.map(manifestPosition), geometry = new T.BufferGeometry().setFromPoints(points);
      const material = new T.LineBasicMaterial({ color: status.open ? Core.WORLD_DEFS[worldId].tone : 0xff625d, transparent: true, opacity: status.open ? (spec.id === state.worlds[worldId].routeId ? .9 : .34) : .18, depthWrite: false });
      const line = new T.Line(geometry, material); line.name = `route:${spec.id}:${status.reason}`; routeGroup.add(line);
    });
    manifest.landmarks.forEach(item => {
      const beacon = standardMesh(world3d.cellGeometry, Number(Core.WORLD_DEFS[worldId].tone.replace('#', '0x')), { emissive: Number(Core.WORLD_DEFS[worldId].tone.replace('#', '0x')), emissiveIntensity: .9, opacity: .8, roughness: .3 });
      beacon.scale.setScalar(.38); beacon.position.copy(manifestPosition(item.anchor)); beacon.name = 'landmark:' + item.id; parent.add(beacon);
      world3d.landmarkObjects.push({ definition: item, object: beacon });
    });
    els.landmarkLayer.innerHTML = manifest.landmarks.map(item => `<button type="button" class="landmark-tag" data-landmark="${item.id}">${item.name}</button>`).join('');
    els.landmarkLayer.querySelectorAll('[data-landmark]').forEach(button => button.addEventListener('click', () => focusLandmark(button.dataset.landmark)));
    routeGroup.visible = world3d.showRoutes;
  }

  function focusLandmark(landmarkId) {
    const entry = world3d.landmarkObjects.find(item => item.definition.id === landmarkId);
    if (!entry) return;
    world3d.mode = 'observer'; world3d.focusLandmarkId = landmarkId; world3d.target.copy(entry.object.position); world3d.radius = 7.5;
    els.landmarkLayer.querySelectorAll('[data-landmark]').forEach(button => button.classList.toggle('on', button.dataset.landmark === landmarkId));
    renderSpatialUI();
  }

  function enterObserverMode() {
    world3d.mode = 'observer'; world3d.focusLandmarkId = null; world3d.radius = world3d.overviewRadius;
    const defaults = { valley: [1.2,-.5,0], mine: [.8,-.25,-1], garden: [1.6,.4,0] };
    world3d.target.fromArray(defaults[state.activeWorld]);
    renderSpatialUI();
  }

  function enterEmbodiedMode() {
    world3d.activeRoute = currentSpatialRoute();
    if (!world3d.activeRoute || !world3d.avatar) { renderSpatialUI(); return; }
    world3d.mode = 'embodied'; world3d.focusLandmarkId = null; world3d.radius = 6.8;
    const savedCell = state.worlds[state.activeWorld].currentCell;
    const savedKey = savedCell && Core.Spatial.isFCCCoord(savedCell) ? Core.Spatial.coordKey(savedCell) : null;
    world3d.routeIndex = savedKey ? Math.max(0, world3d.activeRoute.cells.findIndex(cell => Core.Spatial.coordKey(cell) === savedKey)) : 0;
    positionAvatarAtCell(world3d.activeRoute.cells[world3d.routeIndex]); renderSpatialUI();
  }

  function positionAvatarAtCell(cell) {
    if (!world3d.avatar || !cell) return;
    const point = manifestPosition(cell); world3d.avatar.position.copy(point); world3d.target.copy(point);
    state.worlds[state.activeWorld].currentCell = cell.slice();
  }

  function stepEmbodied(delta) {
    if (world3d.mode !== 'embodied' || !world3d.activeRoute) return;
    world3d.routeIndex = Math.max(0, Math.min(world3d.activeRoute.cells.length - 1, world3d.routeIndex + delta));
    positionAvatarAtCell(world3d.activeRoute.cells[world3d.routeIndex]); persistState(); renderSpatialUI();
  }

  function updateLandmarkTags() {
    if (!world3d.ready || !world3d.camera) return;
    const rect = els.worldCanvas.getBoundingClientRect(), T = window.THREE;
    world3d.landmarkObjects.forEach(entry => {
      const tag = els.landmarkLayer.querySelector(`[data-landmark="${entry.definition.id}"]`);
      if (!tag) return;
      const projected = entry.object.getWorldPosition(new T.Vector3()).project(world3d.camera), visible = projected.z > -1 && projected.z < 1;
      tag.hidden = !visible;
      if (visible) { tag.style.left = ((projected.x + 1) * .5 * rect.width) + 'px'; tag.style.top = ((1 - projected.y) * .5 * rect.height) + 'px'; }
    });
  }

  function updateDiagnostics() {
    if (!world3d.ready) return;
    const manifest = Core.Spatial.getManifest(state.activeWorld), route = currentSpatialRoute();
    window.__lightgrid3d = {
      ready: true, renderer: 'WebGL', revision: window.THREE.REVISION, world: state.activeWorld,
      signature: world3d.signature, objects: world3d.root ? countObjects(world3d.root) : 0,
      manifestVersion: manifest.version, parityValid: Core.Spatial.validateManifest(manifest),
      mode: world3d.mode, phaseId: state.spatial[state.activeWorld].phaseId,
      routeId: route && route.id, landmarkCount: manifest.landmarks.length, routeCount: manifest.routes.length
    };
    Object.assign(els.worldCanvas.dataset, {
      manifestVersion: manifest.version,
      phaseId: state.spatial[state.activeWorld].phaseId,
      routeId: route && route.id || '',
      mode: world3d.mode,
      parityValid: 'true'
    });
  }

  function addStarField(parent, tone) {
    const T = window.THREE, positions = [];
    for (let i = 0; i < 180; i++) {
      const angle = noise(i, 3, 8) * Math.PI * 2, radius = 13 + noise(i, 7, 2) * 24;
      positions.push(Math.cos(angle) * radius, -3 + noise(i, 5, 1) * 17, Math.sin(angle) * radius);
    }
    const geometry = new T.BufferGeometry(); geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
    const points = new T.Points(geometry, new T.PointsMaterial({ color: tone, size: .055, transparent: true, opacity: .48, depthWrite: false }));
    parent.add(points);
  }

  function buildValley(parent) {
    const T = window.THREE, step = state.worlds.valley.step, ground = [], cliffs = [], bridge = [], fracture = [], crystals = [];
    for (let x = -11; x <= 11; x++) for (let z = -7; z <= 7; z++) {
      const distance = Math.hypot(x / 1.45, z), n = noise(x, z, 11);
      if (distance > 11.6 || n < .12 || Math.abs(x) < 1.65) continue;
      const y = -2.1 + Math.max(0, 5.2 - Math.abs(x)) * .17 + n * .36;
      (Math.abs(x) < 3.2 ? cliffs : ground).push([x * .72, y, z * .72, .92]);
      if (Math.abs(x) < 2.9) cliffs.push([x * .72, y - .78, z * .72, .92], [x * .72, y - 1.52, z * .72, .92]);
    }
    for (let i = -8; i <= 8; i++) {
      const damaged = Math.abs(i) <= 1 && step < 3;
      if (!damaged) bridge.push([i * .66, -.34 - Math.abs(i) * .018, 0, .72]);
      else fracture.push([i * .66, -.72 + Math.abs(i) * .16, 0, .58]);
      if (i % 2 === 0) bridge.push([i * .66, .23, -.72, .34], [i * .66, .23, .72, .34]);
    }
    for (let side of [-1, 1]) for (let i = 0; i < 22; i++) {
      const x = side * (4.5 + noise(i, side, 5) * 3.2), z = -5.4 + noise(i, side, 9) * 10.8;
      const height = 1 + Math.floor(noise(i, side, 13) * 4);
      for (let y = 0; y < height; y++) crystals.push([x, -1.45 + y * .62, z, .44 + y * .04]);
    }
    cellCloud(parent, ground, { name: 'valley-ground', color: 0x43564f });
    cellCloud(parent, cliffs, { name: 'ravine-cliffs', color: 0x263d3a });
    const water = standardMesh(new T.PlaneGeometry(2.2, 13), 0x356e83, { opacity: .48, roughness: .15, metalness: .15, doubleSide: true });
    water.rotation.x = -Math.PI / 2; water.position.set(0, -3.72, 0); parent.add(water); world3d.animated.push({ object: water, kind: 'water' });
    cellCloud(parent, bridge, { name: step >= 3 ? 'repaired-bridge' : 'damaged-bridge', color: step >= 3 ? 0xd9b45d : 0x9b7548, metalness: .18 });
    const breakMesh = cellCloud(parent, fracture, { name: 'bridge-fracture', color: 0xff665e, emissive: 0xff2118, emissiveIntensity: 1.1 });
    if (breakMesh) world3d.animated.push({ object: breakMesh, kind: 'fracture' });
    const crystalMesh = cellCloud(parent, crystals, { name: 'crystal-forest', color: 0x55d7b6, emissive: 0x1f9d7e, emissiveIntensity: .34, transparent: true, opacity: .9 });
    world3d.animated.push({ object: crystalMesh, kind: 'crystals' });
    addSettlement(parent, -7.1, -3.7, 0xe1b85d); addSettlement(parent, 7.2, 3.6, 0x7edbc0);
    addAvatar(parent, [-5.2, -.55, 1.35]);
    world3d.scene.background.setHex(0x07110f); world3d.scene.fog.color.setHex(0x07110f); world3d.radius = 19; world3d.target.set(1.2, -.5, 0);
  }

  function addSettlement(parent, x, z, color) {
    const cells = [];
    for (let y = 0; y < 4; y++) for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) if (y === 0 || Math.abs(dx) + Math.abs(dz) > 0) cells.push([x + dx * .58, -1.45 + y * .58, z + dz * .58, .62]);
    cellCloud(parent, cells, { name: 'settlement', color, emissive: color, emissiveIntensity: .08 });
  }

  function buildMine(parent) {
    const T = window.THREE, step = state.worlds.mine.step, tunnel = [], floor = [];
    for (let z = -8; z <= 8; z++) {
      for (let a = 0; a <= 12; a++) {
        const angle = Math.PI * a / 12, x = Math.cos(angle) * 7.2, y = Math.sin(angle) * 5.2 - 2.35;
        if ((a + z + 20) % 2 === 0) tunnel.push([x, y, z * .72, .72]);
      }
      for (let x = -7; x <= 7; x += 2) floor.push([x, -2.5, z * .72, .72]);
    }
    cellCloud(parent, tunnel, { name: 'mine-vault', color: 0x263952, metalness: .22 });
    cellCloud(parent, floor, { name: 'mine-floor', color: 0x34475b, metalness: .15 });
    for (const x of [-1.18, 1.18]) {
      const rail = standardMesh(new T.BoxGeometry(.09, .09, 13), 0x9ab0bd, { metalness: .75, roughness: .25 }); rail.position.set(x, -1.95, 0); parent.add(rail);
    }
    for (let i = 0; i < 3; i++) {
      const ring = standardMesh(new T.TorusGeometry(2.1 + i * 1.05, .08 + i * .025, 10, 64), i === 1 ? 0xf0a35e : 0x73b8ff, { emissive: i === 1 ? 0xb94716 : 0x256eb7, emissiveIntensity: .8, metalness: .45, roughness: .25 });
      ring.position.set(0, .25, -2.2 + i * .12); ring.rotation.z = i * .36; parent.add(ring); world3d.animated.push({ object: ring, kind: 'clock', speed: (i % 2 ? -1 : 1) * (.16 + i * .05) });
    }
    const nodeColor = step >= 3 ? 0x6df0c8 : 0xff765e;
    const node = standardMesh(new T.IcosahedronGeometry(.72, 1), nodeColor, { emissive: nodeColor, emissiveIntensity: 1.05, metalness: .25, roughness: .2 });
    node.name = step >= 3 ? 'synchronized-node' : 'fault-node'; node.position.set(0, .25, -2.05); parent.add(node); world3d.animated.push({ object: node, kind: 'node' });
    for (let i = 0; i < 7; i++) {
      const pulse = standardMesh(new T.SphereGeometry(.12, 12, 8), 0x8fd4ff, { emissive: 0x4fa9ff, emissiveIntensity: 1.4, roughness: .2 });
      pulse.position.set(i % 2 ? -1.18 : 1.18, -1.8, -7 + i * 2.1); parent.add(pulse); world3d.pulses.push({ object: pulse, offset: i * 2.1 });
    }
    addAvatar(parent, [-3.8, -1.6, 2.5]);
    world3d.scene.background.setHex(0x050b13); world3d.scene.fog.color.setHex(0x050b13); world3d.radius = 18; world3d.target.set(.8, -.25, -1);
  }

  function buildGarden(parent) {
    const T = window.THREE, islands = [], roots = [], part = state.agent.bodyPart;
    for (let cluster = 0; cluster < 9; cluster++) {
      const angle = cluster * .83, radius = 2.5 + cluster * .58, cx = Math.cos(angle) * radius, cz = Math.sin(angle) * radius, cy = -1 + Math.sin(cluster * 1.7) * 2.1;
      for (let i = 0; i < 18; i++) {
        const a = i * 2.39, r = Math.sqrt(i) * .36;
        islands.push([cx + Math.cos(a) * r, cy - r * .14, cz + Math.sin(a) * r, .55 + noise(i, cluster, 4) * .22]);
      }
      for (let y = 1; y <= 4; y++) roots.push([cx + Math.sin(y) * .12, cy - y * .58, cz + Math.cos(y) * .12, .38]);
    }
    const islandMesh = cellCloud(parent, islands, { name: 'living-islands', color: 0x866fd0, emissive: 0x3e278b, emissiveIntensity: .22, metalness: .1 });
    cellCloud(parent, roots, { name: 'living-roots', color: 0x65d6b0, emissive: 0x1d795e, emissiveIntensity: .3 });
    world3d.animated.push({ object: islandMesh, kind: 'islands' });
    const migrationCurve = new T.CatmullRomCurve3([new T.Vector3(-8,2,-4), new T.Vector3(-3,3,1), new T.Vector3(1,.5,3), new T.Vector3(5,2,0), new T.Vector3(8,0,-3)]);
    const path = standardMesh(new T.TubeGeometry(migrationCurve, 80, .045, 6, false), 0x6df0c8, { emissive: 0x6df0c8, emissiveIntensity: .85, opacity: .55, roughness: .25 }); parent.add(path);
    for (let i = 0; i < 34; i++) {
      const migrant = standardMesh(world3d.cellGeometry, i % 4 === 0 ? 0xf2c96d : 0x8ef6d1, { emissive: i % 4 === 0 ? 0xc98322 : 0x38b88d, emissiveIntensity: .75, opacity: .92, roughness: .3 });
      migrant.scale.setScalar(.22 + noise(i, 4, 9) * .16); parent.add(migrant); world3d.migrants.push({ object: migrant, offset: i / 34, lane: noise(i, 5, 2) - .5, curve: migrationCurve });
    }
    const avatar = addAvatar(parent, [-2.2, 1.8, .9]);
    if (part === 'sensor') {
      const sensor = standardMesh(new T.TorusGeometry(.68, .065, 8, 32), 0x6df0c8, { emissive: 0x6df0c8, emissiveIntensity: 1 }); sensor.rotation.x = Math.PI / 2; sensor.position.y = 1.52; avatar.add(sensor); world3d.animated.push({ object: sensor, kind: 'sensor' });
    } else if (part === 'feet') {
      cellCloud(avatar, [[-.4,-.58,0,.5],[.4,-.58,0,.5],[-.62,-.78,.2,.3],[.62,-.78,.2,.3]], { name: 'gripping-feet', color: 0xf2c96d, emissive: 0xb36a20, emissiveIntensity: .55 });
    } else if (part === 'bladder') {
      const bladder = standardMesh(new T.SphereGeometry(.78, 24, 14), 0x9dc9ff, { emissive: 0x5c8fd9, emissiveIntensity: .38, opacity: .42, roughness: .15 }); bladder.scale.y = 1.25; bladder.position.y = 1.2; avatar.add(bladder); world3d.animated.push({ object: bladder, kind: 'bladder' });
    }
    world3d.scene.background.setHex(0x0b0817); world3d.scene.fog.color.setHex(0x0b0817); world3d.radius = 20; world3d.target.set(1.6, .4, 0);
  }

  function addAvatar(parent, position) {
    const T = window.THREE, avatar = new T.Group(), cells = [[0,0,0,.62],[0,.68,0,.58],[-.48,.22,0,.42],[.48,.22,0,.42],[0,1.38,0,.48]];
    cellCloud(avatar, cells.slice(0, 4), { name: 'avatar-body', color: 0xeaf7f2, emissive: 0x28584e, emissiveIntensity: .25, metalness: .1 });
    const core = standardMesh(world3d.cellGeometry, 0x6df0c8, { emissive: 0x6df0c8, emissiveIntensity: 1.1, roughness: .25 }); core.scale.setScalar(cells[4][3]); core.position.set(0, cells[4][1], 0); avatar.add(core);
    avatar.position.set(position[0], position[1], position[2]); avatar.name = 'cheng-avatar'; parent.add(avatar); world3d.avatar = avatar; world3d.animated.push({ object: avatar, kind: 'avatar' }); return avatar;
  }

  function bindWorld3dControls() {
    const canvas = els.worldCanvas;
    canvas.addEventListener('pointerdown', event => { world3d.dragging = true; world3d.lastX = event.clientX; world3d.lastY = event.clientY; canvas.classList.add('dragging'); canvas.setPointerCapture(event.pointerId); });
    canvas.addEventListener('pointermove', event => {
      if (!world3d.dragging) return;
      world3d.theta -= (event.clientX - world3d.lastX) * .007;
      world3d.phi = Math.max(.28, Math.min(1.46, world3d.phi + (event.clientY - world3d.lastY) * .006));
      world3d.lastX = event.clientX; world3d.lastY = event.clientY;
    });
    const stopDrag = () => { world3d.dragging = false; canvas.classList.remove('dragging'); };
    canvas.addEventListener('pointerup', stopDrag); canvas.addEventListener('pointercancel', stopDrag);
    canvas.addEventListener('wheel', event => { event.preventDefault(); world3d.radius = Math.max(8, Math.min(34, world3d.radius * Math.exp(event.deltaY * .001))); }, { passive: false });
  }

  function animateWorld3d(time) {
    world3d.animationFrame = requestAnimationFrame(animateWorld3d);
    if (!world3d.ready || !world3d.root) return;
    const dt = Math.min(48, time - (world3d.lastTime || time)); world3d.lastTime = time;
    if (!world3d.dragging && !world3d.prefersReducedMotion) world3d.theta += dt * .000025;
    world3d.animated.forEach(item => {
      if (!item.object) return;
      if (item.kind === 'clock') item.object.rotation.z += dt * .001 * item.speed;
      if (item.kind === 'node') item.object.scale.setScalar(1 + Math.sin(time * .004) * .09);
      if (item.kind === 'fracture') item.object.material.emissiveIntensity = .75 + Math.sin(time * .006) * .4;
      if (item.kind === 'crystals') item.object.material.emissiveIntensity = .25 + Math.sin(time * .002) * .12;
      if (item.kind === 'avatar') item.object.position.y += Math.sin(time * .0022) * .0006 * dt;
      if (item.kind === 'water') item.object.material.opacity = .42 + Math.sin(time * .0015) * .08;
      if (item.kind === 'islands') item.object.rotation.y = Math.sin(time * .00025) * .035;
      if (item.kind === 'sensor') item.object.rotation.z += dt * .0012;
      if (item.kind === 'bladder') item.object.scale.setScalar(1 + Math.sin(time * .002) * .035);
    });
    world3d.pulses.forEach(pulse => { pulse.object.position.z = -7 + ((time * .004 + pulse.offset) % 14); pulse.object.material.emissiveIntensity = .8 + Math.sin(time * .006 + pulse.offset) * .5; });
    world3d.migrants.forEach(migrant => {
      const t = (migrant.offset + time * .000025) % 1, point = migrant.curve.getPoint(t);
      migrant.object.position.copy(point); migrant.object.position.y += Math.sin(time * .002 + migrant.offset * 30) * .3; migrant.object.position.z += migrant.lane * .8;
      migrant.object.rotation.y += dt * .001;
    });
    const r = world3d.radius, phi = world3d.phi, theta = world3d.theta;
    world3d.camera.position.set(world3d.target.x + r * Math.sin(phi) * Math.cos(theta), world3d.target.y + r * Math.cos(phi), world3d.target.z + r * Math.sin(phi) * Math.sin(theta));
    world3d.camera.lookAt(world3d.target); resizeWorld3d(); world3d.renderer.render(world3d.scene, world3d.camera); updateLandmarkTags();
  }

  function resizeWorld3d() {
    if (!world3d.ready) return;
    const width = Math.max(1, els.worldCanvas.clientWidth), height = Math.max(1, els.worldCanvas.clientHeight);
    const drawing = world3d.renderer.getDrawingBufferSize(new window.THREE.Vector2());
    const ratio = world3d.renderer.getPixelRatio();
    if (drawing.x !== Math.floor(width * ratio) || drawing.y !== Math.floor(height * ratio)) world3d.renderer.setSize(width, height, false);
    world3d.camera.aspect = width / height; world3d.camera.updateProjectionMatrix();
  }

  function countObjects(root) { let count = 0; root.traverse(() => count++); return count; }
  function noise(x, y, seed) { const value = Math.sin(x * 91.7 + y * 37.3 + seed * 11.1) * 43758.5453; return value - Math.floor(value); }

  function render() { renderWorldRail(); renderStage(); renderMission(); renderAgent(); renderEvents(); renderMap(); persistState(); }

  els.primaryAction.addEventListener('click', () => {
    if (state.activeWorld === 'garden' && state.worlds.garden.completed) { openArchive(); return; }
    Core.advanceCurrentWorld(state); render();
  });
  els.observerMode.addEventListener('click', enterObserverMode);
  els.embodiedMode.addEventListener('click', enterEmbodiedMode);
  els.routeToggle.addEventListener('click', () => { world3d.showRoutes = !world3d.showRoutes; renderSpatialUI(); });
  els.walkPad.querySelectorAll('[data-step]').forEach(button => button.addEventListener('click', () => stepEmbodied(Number(button.dataset.step))));
  els.archiveButton.addEventListener('click', openArchive);
  els.archiveClose.addEventListener('click', () => { els.archiveOverlay.hidden = true; });
  els.releaseButton.addEventListener('click', openRelease);
  els.releaseClose.addEventListener('click', () => { els.releaseOverlay.hidden = true; });
  els.runReleaseButton.addEventListener('click', () => { const summary = Core.releaseAgent(state, selectedBoundary); render(); renderRelease(summary); });
  els.exportButton.addEventListener('click', downloadExport);
  els.deleteButton.addEventListener('click', () => {
    if (!els.deleteButton.classList.contains('confirming')) { els.deleteButton.classList.add('confirming'); els.deleteButton.textContent = '再次点击确认清除'; return; }
    localStorage.removeItem(STORAGE_KEY); localStorage.setItem(MIGRATION_MARKER, '1'); state = Core.createInitialState(); els.deleteButton.classList.remove('confirming'); els.deleteButton.textContent = '彻底清除本地角色'; els.archiveOverlay.hidden = true; render();
  });
  els.mapButton.addEventListener('click', () => { els.mapOverlay.hidden = false; renderMap(); });
  els.mapClose.addEventListener('click', () => { els.mapOverlay.hidden = true; });
  els.mapOverlay.addEventListener('click', event => { if (event.target === els.mapOverlay) els.mapOverlay.hidden = true; });
  window.addEventListener('keydown', event => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); els.mapOverlay.hidden = !els.mapOverlay.hidden; }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'j') { event.preventDefault(); els.archiveOverlay.hidden = !els.archiveOverlay.hidden; if (!els.archiveOverlay.hidden) renderArchive(); }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'l') { event.preventDefault(); els.releaseOverlay.hidden = !els.releaseOverlay.hidden; if (!els.releaseOverlay.hidden) renderRelease(); }
    if (event.key === 'Escape') { els.mapOverlay.hidden = true; els.archiveOverlay.hidden = true; els.releaseOverlay.hidden = true; }
    if (!els.mapOverlay.hidden || !els.archiveOverlay.hidden || !els.releaseOverlay.hidden) return;
    if (['ArrowUp','w','W'].includes(event.key)) { event.preventDefault(); stepEmbodied(1); }
    if (['ArrowDown','s','S'].includes(event.key)) { event.preventDefault(); stepEmbodied(-1); }
    if (event.key.toLowerCase() === 'e') enterEmbodiedMode();
    if (event.key.toLowerCase() === 'o') enterObserverMode();
  });
  window.addEventListener('resize', () => drawWorld(state.activeWorld));
  render();
})();
