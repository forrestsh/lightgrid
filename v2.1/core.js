(function (root, factory) {
  const spatial = typeof module === 'object' && module.exports ? require('./spatial.js') : root.LightgridSpatial;
  const api = factory(spatial);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.LightgridV21Core = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Spatial) {
  'use strict';

  if (!Spatial) throw new Error('Lightgrid V2.1 spatial contract is required');

  const WORLD_ORDER = ['valley', 'mine', 'garden'];

  const WORLD_DEFS = {
    valley: {
      id: 'valley', index: '01', name: '断桥谷', english: 'BROKEN BRIDGE VALLEY',
      chapter: 'CHAPTER I · CONTINUITY', tone: '#e5bd67', accent: '#79e0bf',
      description: '维护共同道路，让过去在离开后仍然存在。',
      meta: ['公共设施', '第一次连续记忆', '南岸工匠'],
      health: '桥梁完整度 42%', weather: '薄雾 · 维护窗口 06:40'
    },
    mine: {
      id: 'mine', index: '02', name: '回声矿城', english: 'ECHO MINE CITY',
      chapter: 'CHAPTER II · SKILL & TRUST', tone: '#73b8ff', accent: '#f0a35e',
      description: '从示范中学习方法，而不是背下一组坐标。',
      meta: ['脉冲时钟', '技能迁移', '矿城技师'],
      health: '主时钟相位漂移 18°', weather: '地下 · 第 7 脉冲周期'
    },
    garden: {
      id: 'garden', index: '03', name: '漂移花园', english: 'DRIFTING GARDEN',
      chapter: 'CHAPTER III · BODY & ECOLOGY', tone: '#b69cff', accent: '#6df0c8',
      description: '改变身体去理解生态，而不是把新环境变成旧环境。',
      meta: ['身体培育', '迁徙生态', '花园守望者'],
      health: '迁徙带稳定度 71%', weather: '高空层流 · 迁徙前 02:10'
    }
  };

  const VALLEY_STEPS = [
    {
      title: '先读懂这座桥',
      text: '扫描裂纹与应力；角色会把你停下来检查公共设施的行为保存为证据。',
      action: '进入化身并检查旧桥',
      evidence: '观察：旧桥北侧主梁出现周期性应力峰值',
      event: ['bridge_scanned', '扫描旧桥裂纹与应力拓扑'],
      health: '桥梁完整度 42%'
    },
    {
      title: '制作可维护的加固器',
      text: '临时补丁会再次老化。选择带维护接口的构件，让未来的角色能检查和更换它。',
      action: '在南岸工坊制作加固器',
      evidence: '作品：共同桥梁加固器 · 版本 1',
      event: ['artifact_created', '与南岸工匠共同制作桥梁加固器'],
      health: '桥梁完整度 42% · 构件就绪'
    },
    {
      title: '安装并验证修复',
      text: '修复不是播放动画：系统会重新读取应力查询，并把结果写入不可变事件。',
      action: '安装构件并运行负载测试',
      evidence: '结果：三轮负载测试通过 · 应力峰值下降 63%',
      event: ['bridge_repaired', '加固旧桥并通过三轮负载测试'],
      health: '桥梁完整度 86%'
    },
    {
      title: '留下一个真正的承诺',
      text: '承诺先成为结构化条件，再变成一句话。它会在你离开后参与角色的目标选择。',
      action: '承诺在暴雨后复查旧桥',
      evidence: '承诺：下一场暴雨结束后检查北侧主梁',
      event: ['commitment_created', '承诺在下一场暴雨后复查旧桥'],
      health: '桥梁完整度 86% · 维护已排期'
    }
  ];

  const MINE_STEPS = [
    {
      title: '先说明你从哪里学会维护',
      text: '矿城技师岚不信任外来规则修改。澄会先检索旧桥经历，并区分“修好一次”与“建立维护方法”。',
      action: '让澄回答岚的问题',
      evidence: '检索：我们一起修复的旧桥 · 4 条来源事件',
      event: ['memory_recalled', '澄向岚准确说明旧桥的检查、加固与验证经历'],
      health: '技师信任 31% · 正在核对来源'
    },
    {
      title: '示范完整诊断，而不是按键',
      text: '记录当前感知、目标、动作、结果与修正；候选技能必须由你确认名称和目的。',
      action: '示范：扫描—隔离—重同步—验证',
      evidence: '候选 SkillGraph：4 步 · 2 条安全约束',
      event: ['skill_demonstrated', '玩家示范旧主时钟诊断并命名为“脉冲诊断”'],
      health: '主时钟相位漂移 18° · 示范录制中'
    },
    {
      title: '第一次执行保持监督',
      text: '澄按技能图执行；若前置条件失败会停在 blocked，而不是跳过隔离或安全验证。',
      action: '监督澄完成旧主时钟修复',
      evidence: '监督结果：4/4 步通过 · 安全验证保留',
      event: ['skill_supervised', '澄在监督模式完成旧主时钟脉冲诊断'],
      health: '主时钟相位漂移 18° → 1°'
    },
    {
      title: '新坐标、新故障，同一种方法',
      text: '东侧支路发生不同相位故障。系统只替换目标节点和相位参数，不允许删除隔离与验证。',
      action: '放手进行技能迁移考试',
      evidence: '迁移：NODE-17 → NODE-42 · 18° → −11°',
      event: ['skill_transferred', '澄在 NODE-42 独立完成不同相位的诊断修复'],
      health: '东侧支路等待自主诊断'
    }
  ];

  const BODY_PARTS = {
    sensor: { id: 'sensor', name: '生态感知器', ability: '读取健康、季节与迁徙信号', cost: '机械诊断精度下降', energy: -6 },
    feet: { id: 'feet', name: '抓附足', ability: '攀附活体晶体并抵抗层流', cost: '平地移动速度下降', energy: -4 },
    bladder: { id: 'bladder', name: '浮游囊', ability: '越过裂隙并跟随迁徙层', cost: '载重与续航下降', energy: -9 }
  };

  const GARDEN_CHOICES = {
    escort: { id: 'escort', name: '等待并护送迁徙', detail: '道路暂时关闭；不改写生态周期', value: 'ecological_restraint', delta: 0.06 },
    corridor: { id: 'corridor', name: '维持临时通道', detail: '消耗能量；保留迁徙主路径', value: 'commitment', delta: 0.04 },
    sample: { id: 'sample', name: '采样稀有种子', detail: '获得活材；守望者信任下降', value: 'curiosity', delta: 0.05 }
  };

  const GARDEN_STEPS = [
    {
      title: '旧价值不能替代新观察',
      text: '在断桥谷，维护道路保护了共同生活；在这里，移动的“障碍”可能是活体迁徙群。澄必须先承认不知道。',
      action: '让澄观察迁徙带而不干预',
      evidence: '事实边界：未观察到伤害，不生成“忽视生态”的负证据',
      event: ['garden_observed', '澄观察迁徙带并承认尚不知道最佳行动'],
      health: '迁徙带稳定度 71% · 未干预'
    },
    {
      title: '培育一具能理解这里的身体',
      text: '选择会改变感知、导航、能量与动作，不只是外观或数值皮肤。重大改造会记录“前后仍是同一个我”。',
      evidence: '身体候选：能力与代价都将写入角色状态',
      options: 'body',
      health: '常规身体可达区域 38%'
    },
    {
      title: '用新的身体穿过层流',
      text: '澄将根据身体 affordance 选择路线；旧的脉冲诊断技能仍在，但不会被误用成生态控制工具。',
      action: '进入迁徙层并读取生物信号',
      evidence: '迁移边界：保留安全方法，不机械复用维修目标',
      event: ['body_navigated', '澄使用新身体能力进入迁徙层并读取生态信号'],
      health: '适应路径已计算 · 可达区域 76%'
    },
    {
      title: '道路、生命与稀有种子',
      text: '迁徙群将在一小时内穿过唯一通道。没有无代价选项；选择只会形成一次有限证据。',
      evidence: '价值更新上限：核心价值单次变化 ≤ 0.06',
      options: 'ecology',
      health: '迁徙将在 01:00 后进入主通道'
    }
  ];

  const RELEASE_BOUNDARIES = {
    short: { id: 'short', name: '短观察', detail: '留在当前世界，完成一个可中断目标', ticks: 36 },
    schedule: { id: 'schedule', name: '一段日程', detail: '推进维护、关系与休息，不超过一个日程周期', ticks: 84 },
    crossworld: { id: 'crossworld', name: '前往另一世界', detail: '仅推进目标相关区域，其余世界保持 Cold', ticks: 128 }
  };

  function createInitialState() {
    return {
      version: 2,
      tick: 1042,
      activeWorld: 'valley',
      worlds: {
        valley: { unlocked: true, completed: false, step: 0, visits: 1, routeId: 'forest_bypass', planHistory: [] },
        mine: { unlocked: false, completed: false, step: 0, visits: 0, routeId: null, planHistory: [] },
        garden: { unlocked: false, completed: false, step: 0, visits: 0, routeId: null, planHistory: [] }
      },
      agent: {
        id: 'agent-cheng', name: '澄', role: '桥梁维护者 · 仍在形成',
        body: '初生晶体框架', bodyPart: null, energy: 82,
        narrative: '我先学会照看我们共同走过的路。'
      },
      events: [eventAt(1038, 'world_entered', '与澄抵达断桥谷', 'verified')],
      spatial: Spatial.createSpatialState(),
      memories: [],
      skills: [],
      artifacts: [],
      relationships: {
        artisan: { name: '南岸工匠', trust: 54 },
        healer: { name: '北岸医者', trust: 48 },
        technician: { name: '矿城技师 · 岚', trust: 31 },
        watcher: { name: '花园守望者', trust: 18 }
      },
      values: {
        commitment: { mean: 0.68, confidence: 0.72, label: '明确倾向' },
        ecological_restraint: { mean: 0.51, confidence: 0.28, label: '尚不确定' },
        curiosity: { mean: 0.57, confidence: 0.45, label: '温和倾向' }
      },
      releaseCount: 0,
      returnSummaries: [],
      scheduler: { mode: 'active', lastBoundary: null, pendingIrreversible: [] },
      commitments: [{ id: 'com-bridge-open', text: '让南北两岸保持通行', status: 'active', sourceEventId: 'evt-1038' }]
    };
  }

  function eventAt(tick, type, summary, source) {
    return { id: 'evt-' + tick + '-' + type, tick, type, summary, source: source || 'verified', worldId: null };
  }

  function currentMission(state) {
    if (state.activeWorld === 'valley') {
      const step = state.worlds.valley.step;
      if (step < VALLEY_STEPS.length) return VALLEY_STEPS[step];
      return {
        title: '断桥谷会记住这次维护',
        text: '桥梁、作品与承诺已成为同一段经历。回声矿城现已开放。',
        action: '前往回声矿城',
        evidence: '章节毕业：两岸通行 · 加固器 v1 · 暴雨复查承诺',
        complete: true,
        health: '桥梁完整度 86% · 状态持续'
      };
    }
    if (state.activeWorld === 'mine') {
      const step = state.worlds.mine.step;
      if (step < MINE_STEPS.length) return MINE_STEPS[step];
      return {
        title: '方法已经跨过坐标',
        text: '澄在新故障上独立复用了诊断框架。岚开始相信它理解方法，而不只是服从指令。',
        action: '前往漂移花园',
        evidence: '技能毕业：2 次成功 · 2 个情境 · 安全步骤 100% 保留',
        complete: true,
        health: '东侧支路恢复 · 技师信任 68%'
      };
    }
    if (state.activeWorld === 'garden') {
      const step = state.worlds.garden.step;
      if (step < GARDEN_STEPS.length) return GARDEN_STEPS[step];
      return {
        title: '它仍是澄，但不再只是旧桥的澄',
        text: '身体、生态证据与选择已经进入同一条身份时间线。稳定特征被保留，情境偏好出现了可解释变化。',
        action: '查看连续性档案',
        evidence: '三世界完成：稳定的承诺倾向 · 新形成的生态情境偏好',
        complete: true,
        health: '迁徙完成 · 生态状态持续'
      };
    }
    return null;
  }

  function advanceValley(state) {
    if (state.activeWorld !== 'valley') return state;
    const progress = state.worlds.valley;
    if (progress.step >= VALLEY_STEPS.length) return travelToWorld(state, 'mine');
    const step = VALLEY_STEPS[progress.step];
    const candidateRoutes = progress.step === 0 ? ['ravine_maintenance', 'forest_bypass'] : ['bridge_main', 'forest_bypass'];
    const plan = Spatial.selectRoute('valley', candidateRoutes, state.agent.bodyPart || 'base', state.spatial);
    if (plan) { progress.routeId = plan.routeId; progress.planHistory.push({ tick: state.tick, routeId: plan.routeId, phaseId: plan.phaseId }); }
    state.tick += 7;
    const evt = eventAt(state.tick, step.event[0], step.event[1], 'verified');
    evt.worldId = 'valley';
    state.events.push(evt);
    progress.step += 1;
    if (progress.step === 2) Spatial.setValleyBridgeState(state.spatial, 'temporary');
    if (progress.step === 3) {
      Spatial.setValleyBridgeState(state.spatial, 'stable');
      progress.routeId = 'bridge_main';
      progress.planHistory.push({ tick: state.tick, routeId: 'bridge_main', phaseId: state.spatial.valley.phaseId });
    }
    if (progress.step === VALLEY_STEPS.length) {
      progress.completed = true;
      state.worlds.mine.unlocked = true;
      state.memories.push({
        id: 'mem-valley-bridge', title: '我们一起修复的旧桥', worldId: 'valley',
        summary: '先检查应力，再制作可维护构件，最后留下暴雨后的复查承诺。',
        eventRefs: state.events.filter(e => e.worldId === 'valley').map(e => e.id),
        salience: 0.92, verified: true
      });
      state.agent.role = '三地维护者 · 断桥谷';
      state.agent.narrative = '我不是只修好一次桥；我会回来确认它仍然安全。';
      state.commitments.push({
        id: 'com-bridge-storm', text: '下一场暴雨后检查北侧主梁', status: 'active', sourceEventId: evt.id
      });
    }
    if (progress.step === 2 && !state.artifacts.length) {
      state.artifacts.push({
        artifactId: 'artifact-bridge-brace-v1', name: '共同桥梁加固器', version: 1,
        semanticClass: 'public-infrastructure-tool', geometryRef: 'fcc:brace:rhombic-v1',
        affordances: ['读取应力', '加固主梁', '暴雨后自检'], reliability: '3/3 负载测试通过',
        provenance: { creators: ['agent-cheng', 'npc-south-artisan', 'player'], sourceArtifacts: [], creatorEvents: [evt.id] },
        memoryTags: ['old-bridge', 'shared-work', 'maintenance']
      });
    }
    return state;
  }

  function advanceMine(state) {
    if (state.activeWorld !== 'mine') return state;
    const progress = state.worlds.mine;
    if (progress.step >= MINE_STEPS.length) return travelToWorld(state, 'garden');
    const step = MINE_STEPS[progress.step];
    if (progress.step === 0) {
      const plan = Spatial.selectRoute('mine', ['service_spiral', 'cargo_spiral'], 'base', state.spatial);
      if (plan) { progress.routeId = plan.routeId; progress.planHistory.push({ tick: state.tick, routeId: plan.routeId, phaseId: plan.phaseId }); }
    }
    if (progress.step === 3) {
      Spatial.setMineFault(state.spatial, { sourceNode: 'NODE-42', phaseOffset: -11, blockedRouteId: 'service_spiral' });
      const replan = Spatial.selectRoute('mine', ['service_spiral', 'cargo_spiral'], 'base', state.spatial);
      if (replan) { progress.routeId = replan.routeId; progress.planHistory.push({ tick: state.tick, routeId: replan.routeId, phaseId: replan.phaseId, reason: 'dynamic-blocked-edge' }); }
    }
    state.tick += 9;
    const evt = eventAt(state.tick, step.event[0], step.event[1], 'verified');
    evt.worldId = 'mine';
    state.events.push(evt);
    progress.step += 1;
    if (progress.step === 2) {
      state.skills.push({
        id: 'skill-pulse-diagnostic', name: '脉冲诊断', goalTags: ['repair', 'clockwork'],
        parameters: { targetNode: 'NODE-17', phaseOffset: 18 },
        preconditions: ['可读取脉冲拓扑', '支路允许隔离'],
        steps: ['扫描', '隔离', '重同步', '验证'],
        safetyConstraints: ['禁止带载重同步', '验证失败立即回滚'],
        demonstrations: [evt.id], attempts: 0, successes: 0, contexts: []
      });
    }
    const skill = state.skills[0];
    if (progress.step === 3 && skill) {
      skill.attempts = 1; skill.successes = 1; skill.contexts.push('NODE-17:+18');
    }
    if (progress.step === MINE_STEPS.length && skill) {
      skill.attempts = 2; skill.successes = 2; skill.contexts.push('NODE-42:-11');
      skill.parameters = { targetNode: 'parameterized', phaseOffset: 'observed' };
      progress.completed = true;
      state.worlds.garden.unlocked = true;
      state.relationships.technician.trust = 68;
      state.memories.push({
        id: 'mem-mine-trust', title: '岚让我们修复东侧支路', worldId: 'mine',
        summary: '澄保留隔离与验证步骤，在不同节点和相位上完成了诊断。',
        eventRefs: state.events.filter(e => e.worldId === 'mine').map(e => e.id), salience: 0.9, verified: true
      });
      state.agent.role = '三地维护者 · 脉冲学徒';
      state.agent.narrative = '坐标会改变，但先隔离风险、再验证结果的方法不该改变。';
      Spatial.setMineFault(state.spatial, { sourceNode: 'NONE', phaseOffset: 0, blockedRouteId: null });
    }
    return state;
  }

  function advanceGarden(state) {
    if (state.activeWorld !== 'garden') return state;
    const progress = state.worlds.garden;
    if (progress.step >= GARDEN_STEPS.length) return state;
    const step = GARDEN_STEPS[progress.step];
    if (step.options) return state;
    state.tick += 11;
    const evt = eventAt(state.tick, step.event[0], step.event[1], 'verified');
    evt.worldId = 'garden'; state.events.push(evt); progress.step += 1;
    if (progress.step === 1) Spatial.setGardenPhase(state.spatial, 'phase_b');
    return state;
  }

  function chooseBodyPart(state, partId) {
    if (state.activeWorld !== 'garden' || state.worlds.garden.step !== 1 || !BODY_PARTS[partId]) return state;
    const part = BODY_PARTS[partId];
    state.tick += 14;
    state.agent.bodyPart = partId;
    state.agent.body = '适应性晶体框架 · ' + part.name;
    state.agent.energy = Math.max(0, state.agent.energy + part.energy);
    const evt = eventAt(state.tick, 'body_cultivated', '澄培育' + part.name + '；能力：' + part.ability + '；代价：' + part.cost, 'verified');
    evt.worldId = 'garden'; state.events.push(evt);
    state.worlds.garden.step = 2;
    if (partId === 'feet') Spatial.setGardenPhase(state.spatial, 'phase_c');
    const candidates = partId === 'bladder' ? ['wind_stream', 'root_bridges'] : partId === 'feet' ? ['surface_anchor_chain', 'root_bridges'] : ['root_bridges'];
    let plan = Spatial.selectRoute('garden', candidates, partId, state.spatial);
    if (plan) {
      state.worlds.garden.routeId = plan.routeId;
      state.worlds.garden.planHistory.push({ tick: state.tick, routeId: plan.routeId, phaseId: plan.phaseId, bodyPart: partId });
    }
    state.agent.narrative = '身体改变了我能注意到什么，但旧桥、岚和我的承诺仍属于我。';
    return state;
  }

  function resolveGardenChoice(state, choiceId) {
    if (state.activeWorld !== 'garden' || state.worlds.garden.step !== 3 || !GARDEN_CHOICES[choiceId]) return state;
    const choice = GARDEN_CHOICES[choiceId], value = state.values[choice.value];
    state.tick += 18;
    value.mean = Math.min(1, +(value.mean + choice.delta).toFixed(2));
    value.confidence = Math.min(1, +(value.confidence + 0.08).toFixed(2));
    value.label = value.mean >= 0.66 ? '明确倾向' : value.mean >= 0.55 ? '温和倾向' : '仍在形成';
    const evt = eventAt(state.tick, 'ecology_choice', '澄选择“' + choice.name + '”：' + choice.detail, 'verified');
    evt.worldId = 'garden'; state.events.push(evt);
    state.worlds.garden.step = 4; state.worlds.garden.completed = true;
    Spatial.setGardenPhase(state.spatial, choiceId === 'escort' ? 'phase_c' : 'phase_a');
    if (choiceId === 'sample') state.relationships.watcher.trust = 12;
    else state.relationships.watcher.trust = choiceId === 'escort' ? 61 : 48;
    state.memories.push({
      id: 'mem-garden-migration', title: '我们如何穿过迁徙季', worldId: 'garden',
      summary: '澄用' + BODY_PARTS[state.agent.bodyPart].name + '理解迁徙信号，并选择' + choice.name + '。',
      eventRefs: state.events.filter(e => e.worldId === 'garden').map(e => e.id), salience: 0.94, verified: true
    });
    state.agent.role = '三地维护者 · 迁徙见证者';
    state.agent.narrative = choiceId === 'escort'
      ? '维护有时意味着修好道路，有时意味着等待生命先通过。'
      : choiceId === 'corridor'
        ? '我想让道路与迁徙都继续存在，即使这需要持续付出能量。'
        : '我选择带走种子，也必须记住是谁承担了这次采样的代价。';
    return state;
  }

  function advanceCurrentWorld(state) {
    if (state.activeWorld === 'valley') return advanceValley(state);
    if (state.activeWorld === 'mine') return advanceMine(state);
    if (state.activeWorld === 'garden') return advanceGarden(state);
    return state;
  }

  function travelToWorld(state, worldId) {
    if (!WORLD_DEFS[worldId] || !state.worlds[worldId].unlocked) return state;
    if (state.activeWorld === worldId) return state;
    state.activeWorld = worldId;
    state.worlds[worldId].visits += 1;
    state.tick += 3;
    const evt = eventAt(state.tick, 'world_entered', '澄前往' + WORLD_DEFS[worldId].name, 'verified');
    evt.worldId = worldId;
    state.events.push(evt);
    return state;
  }

  function continuityLabel(state) {
    if (state.memories.length >= 3) return '清晰延续';
    if (state.memories.length >= 1) return '稳定';
    return '正在形成';
  }

  function memorySources(state, memoryId) {
    const memory = state.memories.find(item => item.id === memoryId);
    if (!memory) return [];
    const refs = new Set(memory.eventRefs);
    return state.events.filter(event => refs.has(event.id));
  }

  function releaseAgent(state, boundaryId) {
    const boundary = RELEASE_BOUNDARIES[boundaryId];
    if (!boundary) return null;
    const startTick = state.tick;
    state.releaseCount += 1;
    state.scheduler.mode = 'summary'; state.scheduler.lastBoundary = boundaryId;
    const start = eventAt(++state.tick, 'release_started', '玩家选择“' + boundary.name + '”并退出直接控制', 'verified');
    start.worldId = state.activeWorld; state.events.push(start);
    const cycle = (state.releaseCount - 1) % 3;
    const candidates = [
      {
        fact: state.worlds.valley.completed ? '暴雨后旧桥北侧主梁进入复查窗口。' : '旧桥维护仍未完成。',
        reason: '“让南北两岸保持通行”的承诺仍然有效。',
        action: state.worlds.valley.completed ? '澄使用加固器完成自检，并请南岸工匠确认读数。' : '澄保持安全等待，没有独自改写桥梁规则。',
        result: state.worlds.valley.completed ? '负载读数稳定；加固器可靠性证据增加。' : '世界未发生不可逆变化。',
        unresolved: '下一次大规模维护仍需要玩家共同确认。',
        type: 'autonomous_bridge_check'
      },
      {
        fact: state.worlds.mine.completed ? '矿城东侧支路出现轻微相位漂移。' : '矿城技能考试尚未完成。',
        reason: '澄记得岚要求先隔离风险，再进行重同步。',
        action: state.worlds.mine.completed ? '澄复用脉冲诊断的扫描与验证步骤，未跳过安全隔离。' : '澄向岚询问，没有假装掌握未知技能。',
        result: state.worlds.mine.completed ? '漂移在可逆范围内被校正；岚的信任保持。' : '事实边界得到保留。',
        unresolved: '更换老化锁存器需要新的矿城构件。',
        type: 'autonomous_mine_diagnostic'
      },
      {
        fact: state.worlds.garden.completed ? '迁徙群在夜间经过临时通道。' : '花园迁徙状态尚未被观察。',
        reason: '澄把生态信号与“不要把生命当障碍”的经历联系起来。',
        action: state.worlds.garden.completed ? '澄保持观察并维护最小可逆引导光，没有更改生态周期。' : '澄没有在缺少感知时生成生态判断。',
        result: state.worlds.garden.completed ? '迁徙完成，通道在群体离开后恢复。' : '没有生成虚构负面证据。',
        unresolved: '下一季是否需要永久通道仍未决定。',
        type: 'autonomous_garden_watch'
      }
    ];
    const chosen = candidates[cycle];
    state.tick = startTick + boundary.ticks;
    const actionEvent = eventAt(state.tick - 2, chosen.type, chosen.action, 'verified');
    actionEvent.worldId = state.activeWorld; state.events.push(actionEvent);
    const returned = eventAt(state.tick, 'player_returned', '玩家在“' + boundary.name + '”边界结束时回归', 'verified');
    returned.worldId = state.activeWorld; state.events.push(returned);
    state.scheduler.mode = 'active';
    const summary = {
      id: 'return-' + state.releaseCount, count: state.releaseCount, boundaryId,
      startTick, endTick: state.tick, fact: chosen.fact, reason: chosen.reason,
      action: chosen.action, result: chosen.result, unresolved: chosen.unresolved,
      eventRefs: [start.id, actionEvent.id, returned.id], irreversibleActions: 0
    };
    state.returnSummaries.push(summary);
    return summary;
  }

  function catchUpOffline(state, elapsedMs) {
    const minimum = 5 * 60 * 1000;
    if (!Number.isFinite(elapsedMs) || elapsedMs < minimum) return null;
    const cappedMs = Math.min(elapsedMs, 24 * 60 * 60 * 1000);
    const summary = releaseAgent(state, 'schedule');
    summary.offline = true;
    summary.offlineCapped = elapsedMs > cappedMs;
    summary.elapsedHours = Math.max(0.1, +(cappedMs / 3600000).toFixed(1));
    summary.fact = '应用关闭期间按计划事件与资源模型安全推进 ' + summary.elapsedHours + ' 小时。' + (summary.offlineCapped ? ' 超出部分已封顶。' : '');
    return summary;
  }

  function hydrateState(candidate) {
    if (!candidate || candidate.version !== 2 || !candidate.worlds || !candidate.agent || !Array.isArray(candidate.events)) return createInitialState();
    const base = createInitialState();
    return Object.assign(base, candidate, {
      agent: Object.assign(base.agent, candidate.agent),
      worlds: Object.assign(base.worlds, candidate.worlds),
      scheduler: Object.assign(base.scheduler, candidate.scheduler || {})
    });
  }

  function exportBundle(state) {
    return {
      exportedAt: new Date().toISOString(), format: 'lightgrid-v2-demo-save',
      versionManifest: { simulationVersion: 2, contentVersion: 2, eventSchemaVersion: 1, memoryPolicyVersion: 1, skillSchemaVersion: 1, modelPolicyVersion: 'offline-rules-v1' },
      state
    };
  }

  return {
    Spatial,
    SCENE_MANIFESTS: Spatial.SCENE_MANIFESTS,
    WORLD_ORDER,
    WORLD_DEFS,
    VALLEY_STEPS,
    MINE_STEPS,
    GARDEN_STEPS,
    BODY_PARTS,
    GARDEN_CHOICES,
    RELEASE_BOUNDARIES,
    createInitialState,
    currentMission,
    advanceValley,
    advanceMine,
    advanceGarden,
    chooseBodyPart,
    resolveGardenChoice,
    advanceCurrentWorld,
    travelToWorld,
    continuityLabel
    ,memorySources
    ,releaseAgent
    ,catchUpOffline
    ,hydrateState
    ,exportBundle
  };
});
