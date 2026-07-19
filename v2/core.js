(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.LightgridV2Core = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

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

  function createInitialState() {
    return {
      version: 2,
      tick: 1042,
      activeWorld: 'valley',
      worlds: {
        valley: { unlocked: true, completed: false, step: 0, visits: 1 },
        mine: { unlocked: false, completed: false, step: 0, visits: 0 },
        garden: { unlocked: false, completed: false, step: 0, visits: 0 }
      },
      agent: {
        id: 'agent-cheng', name: '澄', role: '桥梁维护者 · 仍在形成',
        body: '初生晶体框架', energy: 82,
        narrative: '我先学会照看我们共同走过的路。'
      },
      events: [eventAt(1038, 'world_entered', '与澄抵达断桥谷', 'verified')],
      memories: [],
      commitments: [{ id: 'com-bridge-open', text: '让南北两岸保持通行', status: 'active', sourceEventId: 'evt-1038' }]
    };
  }

  function eventAt(tick, type, summary, source) {
    return { id: 'evt-' + tick + '-' + type, tick, type, summary, source: source || 'verified', worldId: null };
  }

  function currentMission(state) {
    if (state.activeWorld !== 'valley') return null;
    const step = state.worlds.valley.step;
    if (step >= VALLEY_STEPS.length) {
      return {
        title: '断桥谷会记住这次维护',
        text: '桥梁、作品与承诺已成为同一段经历。回声矿城现已开放。',
        action: '前往回声矿城',
        evidence: '章节毕业：两岸通行 · 加固器 v1 · 暴雨复查承诺',
        complete: true,
        health: '桥梁完整度 86% · 状态持续'
      };
    }
    return VALLEY_STEPS[step];
  }

  function advanceValley(state) {
    if (state.activeWorld !== 'valley') return state;
    const progress = state.worlds.valley;
    if (progress.step >= VALLEY_STEPS.length) return travelToWorld(state, 'mine');
    const step = VALLEY_STEPS[progress.step];
    state.tick += 7;
    const evt = eventAt(state.tick, step.event[0], step.event[1], 'verified');
    evt.worldId = 'valley';
    state.events.push(evt);
    progress.step += 1;
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

  return {
    WORLD_ORDER,
    WORLD_DEFS,
    VALLEY_STEPS,
    createInitialState,
    currentMission,
    advanceValley,
    travelToWorld,
    continuityLabel
  };
});
