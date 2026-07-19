(function () {
  'use strict';
  const Core = window.LightgridV2Core;
  let state = Core.createInitialState();

  const els = Object.fromEntries([
    'globalTick', 'worldList', 'worldCanvas', 'worldChapter', 'worldTitle', 'worldDescription',
    'worldMeta', 'weatherLabel', 'worldHealth', 'missionKicker', 'missionTitle', 'missionText',
    'stepDots', 'evidencePreview', 'primaryAction', 'eventLog', 'agentRole', 'agentNarrative',
    'bodyLabel', 'energyLabel', 'memoryCount', 'commitmentCount', 'continuityScore', 'skillCard',
    'skillProficiency', 'skillName', 'skillSteps', 'skillContext',
    'nextCapability', 'mapButton', 'mapOverlay', 'mapClose', 'mapWorlds'
  ].map(id => [id, document.getElementById(id)]));

  function worldProgress(id) {
    const world = state.worlds[id];
    if (world.completed) return 100;
    if (id === 'valley') return world.step / Core.VALLEY_STEPS.length * 100;
    if (id === 'mine') return world.step / Core.MINE_STEPS.length * 100;
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
        render();
      });
    });
  }

  function renderStage() {
    const def = Core.WORLD_DEFS[state.activeWorld];
    document.documentElement.style.setProperty('--world-tone', def.tone);
    els.worldChapter.textContent = def.chapter;
    els.worldTitle.textContent = def.name;
    els.worldDescription.textContent = def.description;
    els.worldMeta.innerHTML = def.meta.map(item => `<span>${item}</span>`).join('');
    els.weatherLabel.textContent = def.weather;
    const mission = Core.currentMission(state);
    els.worldHealth.textContent = mission && mission.health ? mission.health : def.health;
    drawWorld(state.activeWorld);
  }

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
    els.primaryAction.hidden = false;
    els.missionKicker.textContent = mission.complete ? '章节毕业' : '当前生活';
    els.missionTitle.textContent = mission.title;
    els.missionText.textContent = mission.text;
    els.evidencePreview.innerHTML = `<span>${mission.complete ? '连续性证据' : '即将记录'}</span><b>${mission.evidence}</b>`;
    els.primaryAction.innerHTML = `<span>${mission.action}</span><i>→</i>`;
    const steps = state.activeWorld === 'mine' ? Core.MINE_STEPS : Core.VALLEY_STEPS;
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
      els.nextCapability.innerHTML = '<span>NEXT CAPABILITY</span><b>漂移花园已开放</b><p>带着诊断方法前往迁徙生态。</p>';
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

  function drawWorld(id) {
    const canvas = els.worldCanvas, rect = canvas.getBoundingClientRect();
    const ratio = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.floor(rect.width * ratio));
    canvas.height = Math.max(1, Math.floor(rect.height * ratio));
    const ctx = canvas.getContext('2d');
    ctx.scale(ratio, ratio);
    const w = rect.width, h = rect.height, def = Core.WORLD_DEFS[id];
    const bg = ctx.createRadialGradient(w * .68, h * .35, 10, w * .68, h * .35, w * .72);
    bg.addColorStop(0, hexAlpha(def.tone, .18)); bg.addColorStop(.5, '#0a1715'); bg.addColorStop(1, '#040a09');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
    ctx.save(); ctx.translate(w * .66, h * .54);
    const cell = Math.max(14, Math.min(27, w / 32));
    for (let y = -8; y <= 8; y++) for (let x = -12; x <= 12; x++) {
      const px = (x - y) * cell * .82, py = (x + y) * cell * .32;
      const d = Math.hypot(x / 1.2, y);
      if (d > 12 || noise(x, y, id.length) < .27) continue;
      let lift = Math.max(0, 4.5 - d) * cell * .18;
      if (id === 'valley') lift += Math.abs(x + y) < 2 ? -cell * 1.4 : 0;
      if (id === 'mine') lift += ((x + y + 20) % 4 === 0) ? cell * .55 : 0;
      if (id === 'garden') lift += Math.sin(x * .7 + y) * cell * .6;
      drawDiamond(ctx, px, py - lift, cell * .76, def.tone, .12 + Math.max(0, 1 - d / 13) * .3);
    }
    drawLandmark(ctx, id, cell, def);
    ctx.restore();
  }

  function drawDiamond(ctx, x, y, size, color, alpha) {
    ctx.beginPath(); ctx.moveTo(x, y - size * .52); ctx.lineTo(x + size, y); ctx.lineTo(x, y + size * .52); ctx.lineTo(x - size, y); ctx.closePath();
    ctx.fillStyle = hexAlpha(color, alpha); ctx.fill(); ctx.strokeStyle = hexAlpha(color, alpha + .16); ctx.lineWidth = .65; ctx.stroke();
  }

  function drawLandmark(ctx, id, cell, def) {
    ctx.save(); ctx.shadowColor = def.tone; ctx.shadowBlur = 22; ctx.strokeStyle = def.tone; ctx.fillStyle = hexAlpha(def.tone, .18); ctx.lineWidth = 1.2;
    if (id === 'valley') {
      ctx.beginPath(); ctx.moveTo(-cell * 5, -cell * .1); ctx.lineTo(cell * 5, -cell * .1); ctx.stroke();
      for (let i = -5; i <= 5; i++) drawDiamond(ctx, i * cell, -Math.abs(i) * 1.2, cell * .48, def.tone, i === 0 ? .7 : .35);
    } else if (id === 'mine') {
      for (let r = 1; r < 5; r++) { ctx.beginPath(); ctx.arc(0, 0, cell * r, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke(); }
      ctx.beginPath(); ctx.moveTo(-cell * 5, 0); ctx.lineTo(cell * 5, 0); ctx.stroke();
    } else {
      for (let i = 0; i < 10; i++) { const a = i * .86, r = cell * (1.4 + i * .32); drawDiamond(ctx, Math.cos(a) * r, Math.sin(a) * r * .45, cell * (.42 + i * .025), def.tone, .28); }
    }
    ctx.restore();
  }

  function noise(x, y, seed) { const v = Math.sin(x * 91.7 + y * 37.3 + seed * 11.1) * 43758.5453; return v - Math.floor(v); }
  function hexAlpha(hex, alpha) { const value = hex.replace('#', ''); const n = parseInt(value, 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${alpha})`; }

  function render() { renderWorldRail(); renderStage(); renderMission(); renderAgent(); renderEvents(); renderMap(); }

  els.primaryAction.addEventListener('click', () => { Core.advanceCurrentWorld(state); render(); });
  els.mapButton.addEventListener('click', () => { els.mapOverlay.hidden = false; renderMap(); });
  els.mapClose.addEventListener('click', () => { els.mapOverlay.hidden = true; });
  els.mapOverlay.addEventListener('click', event => { if (event.target === els.mapOverlay) els.mapOverlay.hidden = true; });
  window.addEventListener('keydown', event => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); els.mapOverlay.hidden = !els.mapOverlay.hidden; }
    if (event.key === 'Escape') els.mapOverlay.hidden = true;
  });
  window.addEventListener('resize', () => drawWorld(state.activeWorld));
  render();
})();
