// 世界详情页：总览 / 世界观 / 人物 / 关系 / 大纲 / 章节（多世界线支持）
const WorldDetail = {
  TABS: [
    ['overview', '总览'],
    ['worldview', '世界观'],
    ['characters', '人物'],
    ['relations', '关系'],
    ['outline', '大纲'],
    ['timeline', '章节'],
    ['quests', '支线任务']
  ],
  OUTLINE_STATUS_META: {
    pending: ['○', '未开始', 'badge-soft'],
    active: ['▶', '进行中', 'badge-active'],
    done: ['✓', '已完成', 'badge-done'],
    skipped: ['-', '已跳过', 'badge-soft']
  },
  REL_META: {
    ally: { name: '盟友', color: '#2f9e5e' },
    enemy: { name: '敌对', color: '#e5484d' },
    kin: { name: '亲缘', color: '#c77f0a' },
    lover: { name: '情缘', color: '#e0619a' },
    master: { name: '师徒', color: '#4f8af0' },
    other: { name: '其他', color: '#8d97ac' }
  },
  REL_ACTION_NAME: { add: '新增', update: '变化', remove: '解除' },

  // 带世界线参数的详情页地址
  hashTo(worldId, tab, wlId) {
    const q = new URLSearchParams();
    if (tab) q.set('tab', tab);
    if (wlId) q.set('wl', wlId);
    return `#/worlds/${worldId}?${q.toString()}`;
  },

  async render(container, worldId, tab, wlId) {
    let file;
    try {
      file = await api.get('/api/worlds/' + worldId);
    } catch (e) {
      container.innerHTML = `
        <div class="page">
          <div class="page-error">⚠️ ${esc(e.message)}<br><br><a href="#/worlds">← 返回世界列表</a></div>
        </div>`;
      return;
    }
    if (!Array.isArray(file.worldlines) || !file.worldlines.length) {
      container.innerHTML = `
        <div class="page">
          <div class="page-error">⚠️ 该世界数据缺少世界线，无法显示。<br><br><a href="#/worlds">← 返回世界列表</a></div>
        </div>`;
      return;
    }
    if (!this.TABS.some(([t]) => t === tab)) tab = 'overview';
    const wl = file.worldlines.find(x => x.id === wlId) || file.worldlines[0];
    const w = file.world;
    const ctx = { file, worldId, wl, tab };

    const wlOptions = file.worldlines.map(x => {
      const depth = this.wlDepth(file, x);
      return `<option value="${esc(x.id)}" ${x.id === wl.id ? 'selected' : ''}>${'　'.repeat(depth)}${esc(x.name)}（${x.timeline.length}章）</option>`;
    }).join('');

    container.innerHTML = `
      <div class="page">
        <div class="detail-head">
          <div class="detail-title-row">
            <a class="back-link" href="#/worlds" title="返回列表">←</a>
            <h1>${esc(w.name)}</h1>
            <button class="btn-icon" id="rename-btn" title="重命名">✎</button>
          </div>
          <div class="detail-meta">
            <span class="badge badge-time">时间 · ${esc(wl.currentState.worldTime || '未定')}</span>
            <span class="detail-status">${esc(wl.currentState.worldStatus || '')}</span>
          </div>
          <div class="detail-actions">
            <button class="btn btn-primary btn-lg" id="advance-btn">⚡ 推进世界线</button>
          </div>
        </div>
        <div class="wl-bar">
          <label for="wl-select">当前世界线</label>
          <select id="wl-select">${wlOptions}</select>
          <button class="btn" id="wl-branch-btn" title="以当前世界线为基础开一条新分支">⤴ 创建分支</button>
          <span class="dim wl-hint">分支会复制该世界线的设定与所选分支点之前的章节历史，之后独立演化、互不影响</span>
        </div>
        <nav class="tabs">
          ${this.TABS.map(([t, label]) =>
            `<a class="tab ${t === tab ? 'active' : ''}" data-tab="${t}">${label}</a>`).join('')}
        </nav>
        <div id="tab-body"></div>
      </div>`;

    container.querySelector('#rename-btn').addEventListener('click', () => this.renameModal(ctx));
    container.querySelector('#advance-btn').addEventListener('click', () => this.advanceFlow(ctx));
    container.querySelector('#wl-select').addEventListener('change', e => {
      location.hash = this.hashTo(worldId, tab, e.target.value);
    });
    container.querySelector('#wl-branch-btn').addEventListener('click', () => this.branchModal(ctx, wl, null));
    container.querySelectorAll('.tab').forEach(el => {
      el.addEventListener('click', () => {
        location.hash = this.hashTo(worldId, el.dataset.tab, wl.id);
      });
    });

    const body = container.querySelector('#tab-body');
    await this['render_' + tab](body, ctx);
  },

  reload(ctx, tab) {
    location.hash = this.hashTo(ctx.worldId, tab || ctx.tab, ctx.wl.id);
    appRerender();
  },

  // 世界线在分支树中的深度（用于缩进显示）
  wlDepth(file, wl) {
    let d = 0;
    let cur = wl;
    let guard = 0;
    while (cur && cur.parentId && guard++ < 50) {
      const p = file.worldlines.find(x => x.id === cur.parentId);
      if (!p) break;
      cur = p;
      d++;
    }
    return d;
  },

  wlName(file, id) {
    const x = file.worldlines.find(w => w.id === id);
    return x ? x.name : '未知';
  },

  // ---------- 总览 ----------
  async render_overview(el, ctx) {
    const { file, worldId, wl } = ctx;
    const w = file.world;
    const currentNode = wl.outline.find(n => n.id === wl.currentState.outlineCursorId);
    const doneCount = wl.outline.filter(n => n.status === 'done').length;
    const last = wl.timeline[wl.timeline.length - 1];

    if (!wl.characters.length && !wl.outline.length && !last) {
      el.innerHTML = `
        <div class="guide">
          <h2>世界初开</h2>
          <p>按以下三步启动你的世界：</p>
          <div class="guide-steps">
            <a class="guide-step" href="${this.hashTo(worldId, 'worldview', wl.id)}">
              <span class="step-num">1</span><b>完善世界观</b>
              <span>时代背景、势力、规则体系</span>
            </a>
            <a class="guide-step" href="${this.hashTo(worldId, 'characters', wl.id)}">
              <span class="step-num">2</span><b>添加主要人物</b>
              <span>主角、反派、配角的设定与初始状态</span>
            </a>
            <a class="guide-step" href="${this.hashTo(worldId, 'outline', wl.id)}">
              <span class="step-num">3</span><b>编写剧情大纲</b>
              <span>世界线推进的阶段性目标</span>
            </a>
          </div>
          <p class="guide-end">完成后点击上方「推进世界线」，由 AI 演绎世界接下来的走向。</p>
        </div>`;
      return;
    }

    el.innerHTML = `
      <div class="ov-grid">
        <div class="panel">
          <div class="panel-title">世界局势</div>
          <div class="ov-status">${esc(wl.currentState.worldStatus || '尚无局势记录')}</div>
          <div class="ov-time">当前时间：${esc(wl.currentState.worldTime || '未定')}</div>
        </div>
        <div class="panel">
          <div class="panel-title">大纲进度</div>
          ${wl.outline.length ? `
            <div class="ov-outline-progress">${doneCount} / ${wl.outline.length} 节点已完成</div>
            ${currentNode
              ? `<div class="ov-current-node"><span class="badge badge-active">进行中</span>${esc(currentNode.title)}</div>`
              : '<div class="dim">当前无进行中的大纲节点</div>'}`
            : `<div class="dim">尚未编写大纲，<a href="${this.hashTo(worldId, 'outline', wl.id)}">去添加</a></div>`}
        </div>
      </div>
      <div class="panel">
        <div class="panel-title">
          <span>世界线（${file.worldlines.length}）</span>
          <button class="btn btn-sm" id="ov-wl-branch-btn">＋ 创建分支</button>
        </div>
        ${file.worldlines.map(x => {
          const cur = x.id === wl.id;
          const depth = this.wlDepth(file, x);
          return `
          <div class="wl-row${cur ? ' wl-current' : ''}">
            <a href="${this.hashTo(worldId, 'overview', x.id)}" title="切换到这条世界线">${'　'.repeat(depth)}${esc(x.name)}</a>
            <span class="badge badge-soft">${x.parentId ? '分支' : '主线'}</span>
            ${x.parentId ? `<span class="dim">自「${esc(this.wlName(file, x.parentId))}」第${x.branchFromSeq || 0}章</span>` : ''}
            <span class="dim">${x.timeline.length} 章</span>
            <span style="flex:1"></span>
            <button class="btn btn-sm" data-wl-branch="${x.id}">⤴ 分支</button>
          </div>`;
        }).join('')}
        <div class="dim" style="margin-top:6px;font-size:12px;">切换世界线会同步切换人物、关系、大纲与章节；各世界线独立演化，推进互不影响。</div>
      </div>
      <div class="panel">
        <div class="panel-title">人物速览（${wl.characters.length}）</div>
        ${wl.characters.length ? `
          <div class="ov-chars">
            ${wl.characters.map(c => `
              <div class="char-chip ${c.status.alive ? '' : 'char-dead'}">
                <div style="display:flex;align-items:center;gap:6px;">${avatarHtml(c.name, true)}<b>${esc(c.name)}</b></div>
                <span class="dim">${esc(c.role || '')}</span>
                <span>${c.status.alive ? esc(c.status.location || '位置未知') : '已死亡'}</span>
              </div>`).join('')}
          </div>` : `<div class="dim">还没有人物，<a href="${this.hashTo(worldId, 'characters', wl.id)}">去添加</a></div>`}
      </div>
      ${last ? `
      <div class="panel">
        <div class="panel-title">最新章节 <span class="dim">第${last.chapterNo || last.seq}章${last.chapterTitle ? ' · ' + esc(last.chapterTitle) : ''} · ${esc(last.worldTime)}</span></div>
        <div class="narrative">${narrativeHtml(last.narrative)}</div>
        ${last.events.length ? `<ul class="tl-events">${last.events.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
        <div style="margin-top:10px;"><a href="${this.hashTo(worldId, 'timeline', wl.id)}">阅读全文 →</a></div>
      </div>` : ''}`;

    el.querySelector('#ov-wl-branch-btn').addEventListener('click', () => this.branchModal(ctx, wl, null));
    el.querySelectorAll('[data-wl-branch]').forEach(b => {
      b.addEventListener('click', () => {
        const t = file.worldlines.find(x => x.id === b.dataset.wlBranch);
        if (t) this.branchModal(ctx, t, null);
      });
    });
  },

  // ---------- 世界观 ----------
  async render_worldview(el, ctx) {
    const { worldId } = ctx;
    el.innerHTML = `
      <div class="panel">
        <div class="panel-title">世界观设定</div>
        <textarea id="worldview-editor" rows="18" placeholder="描述这个世界的时代背景、地理、势力、规则体系……">${esc(ctx.file.world.worldview)}</textarea>
        <div class="editor-foot">
          <span class="dim" id="wv-count"></span>
          <button class="btn btn-primary" id="save-worldview">保存</button>
        </div>
      </div>`;
    const ta = el.querySelector('#worldview-editor');
    const count = el.querySelector('#wv-count');
    const updateCount = () => { count.textContent = `${ta.value.length} 字`; };
    updateCount();
    ta.addEventListener('input', updateCount);
    el.querySelector('#save-worldview').addEventListener('click', async () => {
      try {
        await api.put('/api/worlds/' + worldId, { worldview: ta.value });
        toast('世界观已保存', 'success');
      } catch (e) {
        toast(e.message, 'error');
      }
    });
  },

  // ---------- 人物 ----------
  async render_characters(el, ctx) {
    const wl = ctx.wl;
    el.innerHTML = `
      <div class="panel">
        <div class="panel-title">
          <span>人物（${wl.characters.length}）</span>
          <button class="btn btn-sm" id="add-char-btn">＋ 新增人物</button>
        </div>
        ${wl.characters.length ? `
          <div class="char-grid">${wl.characters.map(c => this.charCard(c)).join('')}</div>`
        : '<div class="empty-hint">还没有人物。添加主角、反派与关键配角，AI 将围绕他们演绎故事。</div>'}
      </div>`;

    el.querySelector('#add-char-btn').addEventListener('click', () => this.charModal(ctx, null));
    el.querySelectorAll('[data-edit-char]').forEach(b => {
      b.addEventListener('click', () => {
        const c = wl.characters.find(x => x.id === b.dataset.editChar);
        if (c) this.charModal(ctx, c);
      });
    });
    el.querySelectorAll('[data-del-char]').forEach(b => {
      b.addEventListener('click', async () => {
        const c = wl.characters.find(x => x.id === b.dataset.delChar);
        const ok = await confirmModal(`确定删除人物「${c ? c.name : ''}」？`, { danger: true, okText: '删除' });
        if (!ok) return;
        try {
          await api.del(`/api/worlds/${ctx.worldId}/characters/${b.dataset.delChar}?worldline=${wl.id}`);
          toast('人物已删除', 'success');
          this.reload(ctx, 'characters');
        } catch (e) {
          toast(e.message, 'error');
        }
      });
    });
  },

  charCard(c) {
    const s = c.status;
    return `
      <div class="char-card ${s.alive ? '' : 'char-card-dead'}">
        <div class="char-card-head">
          <div style="display:flex;align-items:center;gap:8px;min-width:0;">
            ${avatarHtml(c.name)}
            <span class="char-name">${esc(c.name)}</span>
            ${c.role ? `<span class="badge badge-soft">${esc(c.role)}</span>` : ''}
          </div>
          <div>
            <button class="btn-icon" data-edit-char="${c.id}" title="编辑">✎</button>
            <button class="btn-icon danger" data-del-char="${c.id}" title="删除">✕</button>
          </div>
        </div>
        ${c.description ? `<div class="char-desc">${esc(c.description)}</div>` : ''}
        <div class="char-status">
          <span class="${s.alive ? 'alive' : 'dead'}"><span class="dot ${s.alive ? 'dot-ok' : 'dot-dead'}"></span>${s.alive ? '存活' : '已死亡'}</span>
          ${s.condition ? `<span>状态：${esc(s.condition)}</span>` : ''}
          ${s.location ? `<span>位置：${esc(s.location)}</span>` : ''}
          ${s.abilities ? `<span>能力：${esc(s.abilities)}</span>` : ''}
          ${s.notes ? `<span>备注：${esc(s.notes)}</span>` : ''}
        </div>
      </div>`;
  },

  charModal(ctx, existing) {
    const c = existing;
    const s = c ? c.status : {};
    const { worldId, wl } = ctx;
    openModal({
      title: c ? `编辑人物：${c.name}` : '新增人物',
      bodyHTML: `
        <div class="field"><label>姓名 *</label>
          <input type="text" id="ch-name" value="${esc(c ? c.name : '')}" maxlength="30"></div>
        <div class="field"><label>定位（主角 / 反派 / 配角 / 势力…）</label>
          <input type="text" id="ch-role" value="${esc(c ? c.role : '')}" maxlength="20"></div>
        <div class="field"><label>设定（外貌、性格、背景）</label>
          <textarea id="ch-desc" rows="4">${esc(c ? c.description : '')}</textarea></div>
        <div class="field"><label>当前状态</label>
          <input type="text" id="ch-condition" value="${esc(s.condition || '')}" placeholder="如：重伤昏迷"></div>
        <div class="field"><label>所在位置</label>
          <input type="text" id="ch-location" value="${esc(s.location || '')}"></div>
        <div class="field"><label>能力 / 修为</label>
          <input type="text" id="ch-abilities" value="${esc(s.abilities || '')}"></div>
        <div class="field"><label>备注</label>
          <input type="text" id="ch-notes" value="${esc(s.notes || '')}"></div>
        <div class="field field-inline">
          <label class="chk"><input type="checkbox" id="ch-important" ${c && c.important ? 'checked' : ''}> 重要角色（推进时优先注入 AI 上下文）</label></div>
        ${c ? `<div class="field field-inline">
          <label class="chk"><input type="checkbox" id="ch-alive" ${s.alive ? 'checked' : ''}> 存活</label></div>` : ''}`,
      okText: c ? '保存' : '添加',
      onOk: async () => {
        const name = document.getElementById('ch-name').value.trim();
        if (!name) {
          toast('请填写人物姓名', 'error');
          return false;
        }
        const status = {
          condition: document.getElementById('ch-condition').value.trim(),
          location: document.getElementById('ch-location').value.trim(),
          abilities: document.getElementById('ch-abilities').value.trim(),
          notes: document.getElementById('ch-notes').value.trim()
        };
        const body = {
          name,
          role: document.getElementById('ch-role').value.trim(),
          description: document.getElementById('ch-desc').value.trim(),
          important: document.getElementById('ch-important').checked,
          status
        };
        if (c) {
          status.alive = document.getElementById('ch-alive').checked;
          await api.put(`/api/worlds/${worldId}/characters/${c.id}?worldline=${wl.id}`, body);
          toast('人物已更新', 'success');
        } else {
          await api.post(`/api/worlds/${worldId}/characters?worldline=${wl.id}`, body);
          toast('人物已添加', 'success');
        }
        this.reload(ctx, 'characters');
      }
    });
  },

  // ---------- 人物关系图 ----------
  async render_relations(el, ctx) {
    const chars = ctx.wl.characters;
    const rels = ctx.wl.relationships || [];
    const nameOf = (id) => {
      const c = chars.find(x => x.id === id);
      return c ? c.name : '？';
    };
    const canGraph = chars.length >= 2;

    el.innerHTML = `
      <div class="panel">
        <div class="panel-title">
          <span>人物关系图（${rels.length} 条关系）</span>
          <button class="btn btn-sm" id="add-rel-btn">＋ 添加关系</button>
        </div>
        ${canGraph ? `
        <div class="rel-legend">
          ${Object.entries(this.REL_META).map(([k, m]) => `
            <span class="rel-legend-item">
              <span class="rel-legend-line" style="background:${m.color}"></span>${m.name}
            </span>`).join('')}
          <span class="rel-legend-item dim" style="margin-left:auto">悬停节点查看关系 · 点击节点查看人物简介 · 拖动节点调整布局</span>
        </div>
        <div class="rel-graph" id="rel-graph"></div>` : `
        <div class="empty-hint">至少需要 2 个人物才能构建关系图，请先到「人物」页签添加。</div>`}
        ${rels.length ? `
        <div class="rel-list">
          ${rels.map(r => {
            const m = this.REL_META[r.type] || this.REL_META.other;
            return `
            <div class="rel-row">
              ${avatarHtml(nameOf(r.fromId), true)}
              <b>${esc(nameOf(r.fromId))}</b>
              <span class="badge" style="color:${m.color};border-color:${m.color}66;background:${m.color}11">${esc(r.label || m.name)}</span>
              <b>${esc(nameOf(r.toId))}</b>
              ${avatarHtml(nameOf(r.toId), true)}
              ${r.description ? `<span class="rel-desc" title="${esc(r.description)}">${esc(r.description)}</span>` : ''}
              <span style="flex:1"></span>
              <button class="btn-icon" data-edit-rel="${r.id}" title="编辑">✎</button>
              <button class="btn-icon danger" data-del-rel="${r.id}" title="删除">✕</button>
            </div>`;
          }).join('')}
        </div>` : (canGraph ? '<div class="empty-hint">还没有关系记录。点击「添加关系」连接人物，或由 AI 在推演中自动建立。</div>' : '')}
      </div>`;

    if (canGraph) this.drawRelationGraph(el.querySelector('#rel-graph'), chars, rels);

    el.querySelector('#add-rel-btn').addEventListener('click', () => {
      if (chars.length < 2) {
        toast('至少需要 2 个人物才能建立关系', 'error');
        return;
      }
      this.relModal(ctx, null);
    });
    el.querySelectorAll('[data-edit-rel]').forEach(b => {
      b.addEventListener('click', () => {
        const rel = rels.find(r => r.id === b.dataset.editRel);
        if (rel) this.relModal(ctx, rel);
      });
    });
    el.querySelectorAll('[data-del-rel]').forEach(b => {
      b.addEventListener('click', async () => {
        const ok = await confirmModal('确定删除这条人物关系？', { danger: true, okText: '删除' });
        if (!ok) return;
        try {
          await api.del(`/api/worlds/${ctx.worldId}/relationships/${b.dataset.delRel}?worldline=${ctx.wl.id}`);
          toast('关系已删除', 'success');
          this.reload(ctx, 'relations');
        } catch (e) {
          toast(e.message, 'error');
        }
      });
    });
  },

  // 力导向连线图：节点=人物，连线=关系
  drawRelationGraph(container, chars, rels) {
    const W = Math.max(container.clientWidth || 640, 320);
    const H = 440;
    const ns = 'http://www.w3.org/2000/svg';

    // 初始环形布局
    const nodes = chars.map((c, i) => {
      const ang = (2 * Math.PI * i) / chars.length - Math.PI / 2;
      const R = Math.min(W, H) * 0.32;
      return {
        char: c,
        x: W / 2 + Math.cos(ang) * R + (Math.random() - 0.5) * 8,
        y: H / 2 + Math.sin(ang) * R + (Math.random() - 0.5) * 8,
        vx: 0, vy: 0, fixed: false
      };
    });
    const byId = new Map(nodes.map(n => [n.char.id, n]));
    const edges = rels
      .map(r => ({ rel: r, a: byId.get(r.fromId), b: byId.get(r.toId) }))
      .filter(e => e.a && e.b);

    // 连线数决定节点大小
    const deg = new Map();
    for (const e of edges) {
      deg.set(e.a, (deg.get(e.a) || 0) + 1);
      deg.set(e.b, (deg.get(e.b) || 0) + 1);
    }
    nodes.forEach(n => { n.r = 19 + Math.min(deg.get(n) || 0, 5) * 1.6; });

    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.classList.add('rel-svg');
    container.appendChild(svg);
    const edgeG = document.createElementNS(ns, 'g');
    const labelG = document.createElementNS(ns, 'g');
    const nodeG = document.createElementNS(ns, 'g');
    svg.append(edgeG, labelG, nodeG);

    const edgeEls = edges.map(e => {
      const m = this.REL_META[e.rel.type] || this.REL_META.other;
      const line = document.createElementNS(ns, 'line');
      line.setAttribute('stroke', m.color);
      line.setAttribute('stroke-width', '1.6');
      line.classList.add('rel-edge');
      line.dataset.pair = `${e.a.char.id}|${e.b.char.id}`;
      edgeG.appendChild(line);
      const text = document.createElementNS(ns, 'text');
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('dy', '-5');
      text.setAttribute('fill', m.color);
      text.classList.add('rel-edge-label');
      text.textContent = e.rel.label || m.name;
      labelG.appendChild(text);
      return { line, text, e };
    });

    const nodeEls = nodes.map(n => {
      const g = document.createElementNS(ns, 'g');
      g.classList.add('rel-node');
      g.dataset.id = n.char.id;
      if (!n.char.status.alive) g.classList.add('rel-node-dead');
      const circle = document.createElementNS(ns, 'circle');
      circle.setAttribute('r', n.r);
      circle.setAttribute('fill', avatarColor(n.char.name));
      const initial = document.createElementNS(ns, 'text');
      initial.setAttribute('text-anchor', 'middle');
      initial.setAttribute('dy', '0.35em');
      initial.classList.add('rel-node-initial');
      initial.textContent = n.char.name.slice(0, 1);
      const name = document.createElementNS(ns, 'text');
      name.setAttribute('text-anchor', 'middle');
      name.setAttribute('y', n.r + 14);
      name.classList.add('rel-node-name');
      name.textContent = n.char.name;
      const title = document.createElementNS(ns, 'title');
      title.textContent = `${n.char.name}（${n.char.role || '未定位'}）`;
      g.append(circle, initial, name, title);
      g.addEventListener('mouseenter', () => this.highlightRelations(svg, n.char.id, true));
      g.addEventListener('mouseleave', () => this.highlightRelations(svg, n.char.id, false));
      g.addEventListener('click', (evt) => {
        evt.stopPropagation();
        this.showCharPopover(n.char, evt.clientX, evt.clientY);
      });
      nodeG.appendChild(g);
      return { g, n };
    });

    // 力导向模拟：斥力 + 弹簧 + 向心力，逐步冷却稳定
    let alpha = 1;
    const step = () => {
      // 节点间斥力
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i], b = nodes[j];
          let dx = b.x - a.x, dy = b.y - a.y;
          let d2 = dx * dx + dy * dy;
          if (d2 < 1) {
            d2 = 1;
            dx = Math.random() - 0.5;
            dy = Math.random() - 0.5;
          }
          const d = Math.sqrt(d2);
          const f = 14000 / d2;
          const fx = (dx / d) * f, fy = (dy / d) * f;
          a.vx -= fx; a.vy -= fy;
          b.vx += fx; b.vy += fy;
        }
      }
      // 连线弹簧
      for (const { e } of edgeEls) {
        const a = e.a, b = e.b;
        const dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        const f = (d - 140) * 0.04;
        const fx = (dx / d) * f, fy = (dy / d) * f;
        a.vx += fx; a.vy += fy;
        b.vx -= fx; b.vy -= fy;
      }
      // 向心力 + 阻尼积分
      for (const n of nodes) {
        n.vx += (W / 2 - n.x) * 0.006;
        n.vy += (H / 2 - n.y) * 0.006;
        if (n.fixed) { n.vx = 0; n.vy = 0; continue; }
        n.vx *= 0.82; n.vy *= 0.82;
        n.x += Math.max(-10, Math.min(10, n.vx));
        n.y += Math.max(-10, Math.min(10, n.vy));
        const pad = n.r + 6;
        n.x = Math.max(pad, Math.min(W - pad, n.x));
        n.y = Math.max(pad + 4, Math.min(H - pad - 12, n.y));
      }
      for (const { line, text, e } of edgeEls) {
        line.setAttribute('x1', e.a.x); line.setAttribute('y1', e.a.y);
        line.setAttribute('x2', e.b.x); line.setAttribute('y2', e.b.y);
        text.setAttribute('x', (e.a.x + e.b.x) / 2);
        text.setAttribute('y', (e.a.y + e.b.y) / 2);
      }
      for (const { g, n } of nodeEls) {
        g.setAttribute('transform', `translate(${n.x},${n.y})`);
      }
      alpha *= 0.992;
      if (alpha > 0.02) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);

    // 拖拽节点
    const toLocal = (evt) => {
      const rect = svg.getBoundingClientRect();
      return {
        x: (evt.clientX - rect.left) * (W / rect.width),
        y: (evt.clientY - rect.top) * (H / rect.height)
      };
    };
    let dragNode = null;
    svg.addEventListener('pointerdown', (evt) => {
      const g = evt.target.closest('.rel-node');
      if (!g) return;
      const item = nodeEls.find(x => x.g === g);
      if (!item) return;
      dragNode = item.n;
      dragNode.fixed = true;
      alpha = 0.5;
      svg.setPointerCapture(evt.pointerId);
      evt.preventDefault();
    });
    svg.addEventListener('pointermove', (evt) => {
      if (!dragNode) return;
      const p = toLocal(evt);
      dragNode.x = Math.max(dragNode.r, Math.min(W - dragNode.r, p.x));
      dragNode.y = Math.max(dragNode.r, Math.min(H - dragNode.r, p.y));
      dragNode.vx = 0;
      dragNode.vy = 0;
    });
    const endDrag = () => { dragNode = null; };
    svg.addEventListener('pointerup', endDrag);
    svg.addEventListener('pointercancel', endDrag);
  },

  // 点击关系图节点：在节点旁显示人物简介悬浮小窗
  showCharPopover(char, x, y) {
    this.hideCharPopover();
    const s = char.status || {};
    const el = document.createElement('div');
    el.className = 'char-popover';
    el.innerHTML = `
      <div class="cp-top">
        ${avatarHtml(char.name, true)}
        <div class="cp-name">${esc(char.name)}${char.important ? ' <span class="badge badge-active">重要</span>' : ''}</div>
        <div class="cp-role">${esc(char.role || '')}</div>
      </div>
      ${char.description ? `<div class="cp-desc">${esc(char.description)}</div>` : ''}
      <div class="cp-status">
        <span class="cp-alive ${s.alive ? 'ok' : 'dead'}">${s.alive ? '存活' : '已死亡'}</span>
        ${s.condition ? `<span><b>状态</b>${esc(s.condition)}</span>` : ''}
        ${s.location ? `<span><b>位置</b>${esc(s.location)}</span>` : ''}
        ${s.abilities ? `<span><b>能力</b>${esc(s.abilities)}</span>` : ''}
        ${s.notes ? `<span><b>备注</b>${esc(s.notes)}</span>` : ''}
      </div>`;
    el.addEventListener('pointerdown', e => e.stopPropagation());
    document.body.appendChild(el);
    // 定位并做视口边界裁剪
    const pw = el.offsetWidth, ph = el.offsetHeight;
    const left = Math.max(8, Math.min(x + 14, window.innerWidth - pw - 8));
    const top = Math.max(8, Math.min(y + 12, window.innerHeight - ph - 8));
    el.style.left = left + 'px';
    el.style.top = top + 'px';

    if (!this._popoverBound) {
      this._popoverBound = true;
      const closeOutside = (e) => {
        const p = document.querySelector('.char-popover');
        if (!p) return;
        if (p.contains(e.target)) return;
        if (e.target.closest && e.target.closest('.rel-node')) return;
        p.remove();
      };
      document.addEventListener('pointerdown', closeOutside);
      document.addEventListener('click', closeOutside);
      document.addEventListener('keydown', e => {
        if (e.key === 'Escape') document.querySelector('.char-popover')?.remove();
      });
    }
  },

  hideCharPopover() {
    document.querySelector('.char-popover')?.remove();
  },

  // 悬停高亮：聚焦该节点及其连线，压暗其余部分
  highlightRelations(svg, charId, on) {
    svg.classList.toggle('rel-focus', on);
    const connected = new Set([charId]);
    svg.querySelectorAll('.rel-edge').forEach(line => {
      const pair = (line.dataset.pair || '').split('|');
      const hit = pair.includes(charId);
      if (hit) pair.forEach(id => connected.add(id));
      line.classList.toggle('rel-edge-dim', on && !hit);
    });
    svg.querySelectorAll('.rel-node').forEach(g => {
      g.classList.toggle('rel-node-dim', on && !connected.has(g.dataset.id));
    });
  },

  relModal(ctx, existing) {
    const chars = ctx.wl.characters;
    const { worldId, wl } = ctx;
    const charOpts = (sel) => chars.map(c =>
      `<option value="${esc(c.id)}" ${existing && existing.fromId === c.id || sel === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('');
    const toSel = existing ? existing.toId : (chars[1] ? chars[1].id : '');
    openModal({
      title: existing ? '编辑关系' : '添加关系',
      bodyHTML: `
        <div class="field"><label>人物甲 *</label>
          <select id="rel-from">${charOpts(existing ? existing.fromId : (chars[0] ? chars[0].id : ''))}</select></div>
        <div class="field"><label>关系类型</label>
          <select id="rel-type">
            ${Object.entries(this.REL_META).map(([k, m]) =>
              `<option value="${k}" ${existing && existing.type === k ? 'selected' : ''}>${m.name}</option>`).join('')}
          </select></div>
        <div class="field"><label>人物乙 *</label>
          <select id="rel-to">${charOpts(toSel)}</select></div>
        <div class="field"><label>关系描述（可选）</label>
          <input type="text" id="rel-label" value="${esc(existing ? existing.label : '')}" placeholder="如：宿敌、结拜姐妹、师徒、暗恋" maxlength="20"></div>
        <div class="field"><label>关系简介（可选）</label>
          <textarea id="rel-desc" rows="2" placeholder="一两句介绍这层关系的来龙去脉，关系图点击人物悬浮窗和列表会展示……">${esc(existing ? (existing.description || '') : '')}</textarea></div>`,
      okText: existing ? '保存' : '添加',
      onOk: async () => {
        const fromId = document.getElementById('rel-from').value;
        const toId = document.getElementById('rel-to').value;
        if (fromId === toId) {
          toast('请选择两个不同的人物', 'error');
          return false;
        }
        const body = {
          fromId,
          toId,
          type: document.getElementById('rel-type').value,
          label: document.getElementById('rel-label').value.trim(),
          description: document.getElementById('rel-desc').value.trim()
        };
        if (existing) {
          await api.put(`/api/worlds/${worldId}/relationships/${existing.id}?worldline=${wl.id}`, body);
          toast('关系已更新', 'success');
        } else {
          await api.post(`/api/worlds/${worldId}/relationships?worldline=${wl.id}`, body);
          toast('关系已添加', 'success');
        }
        this.reload(ctx, 'relations');
      }
    });
  },

  // ---------- 大纲 ----------
  async render_outline(el, ctx) {
    const wl = ctx.wl;
    const nodes = wl.outline.slice().sort((a, b) => (a.order || 0) - (b.order || 0));
    el.innerHTML = `
      <div class="panel">
        <div class="panel-title">
          <span>剧情大纲（${nodes.length}）</span>
          <button class="btn btn-sm" id="add-node-btn">＋ 添加节点</button>
        </div>
        ${nodes.length ? `
          <div class="outline-list">
            ${nodes.map((n, i) => {
              const [icon, label, cls] = this.OUTLINE_STATUS_META[n.status] || this.OUTLINE_STATUS_META.pending;
              return `
              <div class="outline-item ${n.status === 'done' ? 'outline-done' : ''}">
                <span class="outline-order">${i + 1}</span>
                <button class="badge ${cls} outline-status" data-cycle="${n.id}" title="点击切换状态">${icon} ${label}</button>
                <div class="outline-content">
                  <b>${esc(n.title)}</b>
                  ${n.content ? `<div class="outline-text">${esc(n.content)}</div>` : ''}
                </div>
                <div class="outline-ops">
                  <button class="btn-icon" data-edit-node="${n.id}" title="编辑">✎</button>
                  <button class="btn-icon danger" data-del-node="${n.id}" title="删除">✕</button>
                </div>
              </div>`;
            }).join('')}
          </div>`
        : '<div class="empty-hint">还没有大纲。添加阶段性剧情节点，为世界线推进指引方向。</div>'}
      </div>`;

    el.querySelector('#add-node-btn').addEventListener('click', () => this.nodeModal(ctx, null));

    const order = ['pending', 'active', 'done', 'skipped'];
    el.querySelectorAll('[data-cycle]').forEach(b => {
      b.addEventListener('click', async () => {
        const node = wl.outline.find(n => n.id === b.dataset.cycle);
        if (!node) return;
        const next = order[(order.indexOf(node.status) + 1) % order.length];
        try {
          await api.put(`/api/worlds/${ctx.worldId}/outline/${node.id}?worldline=${wl.id}`, { status: next });
          this.reload(ctx, 'outline');
        } catch (e) {
          toast(e.message, 'error');
        }
      });
    });

    el.querySelectorAll('[data-edit-node]').forEach(b => {
      b.addEventListener('click', () => {
        const n = wl.outline.find(x => x.id === b.dataset.editNode);
        if (n) this.nodeModal(ctx, n);
      });
    });

    el.querySelectorAll('[data-del-node]').forEach(b => {
      b.addEventListener('click', async () => {
        const n = wl.outline.find(x => x.id === b.dataset.delNode);
        const ok = await confirmModal(`确定删除大纲节点「${n ? n.title : ''}」？`, { danger: true, okText: '删除' });
        if (!ok) return;
        try {
          await api.del(`/api/worlds/${ctx.worldId}/outline/${b.dataset.delNode}?worldline=${wl.id}`);
          toast('节点已删除', 'success');
          this.reload(ctx, 'outline');
        } catch (e) {
          toast(e.message, 'error');
        }
      });
    });
  },

  nodeModal(ctx, existing) {
    const n = existing;
    const { worldId, wl } = ctx;
    openModal({
      title: n ? '编辑大纲节点' : '添加大纲节点',
      bodyHTML: `
        <div class="field"><label>标题 *</label>
          <input type="text" id="nd-title" value="${esc(n ? n.title : '')}" placeholder="如：第一章：宗门大比" maxlength="60"></div>
        <div class="field"><label>剧情要点</label>
          <textarea id="nd-content" rows="5" placeholder="这一阶段应当发生什么、达到什么目标……">${esc(n ? n.content : '')}</textarea></div>`,
      okText: n ? '保存' : '添加',
      onOk: async () => {
        const title = document.getElementById('nd-title').value.trim();
        if (!title) {
          toast('请填写标题', 'error');
          return false;
        }
        const content = document.getElementById('nd-content').value.trim();
        if (n) {
          await api.put(`/api/worlds/${worldId}/outline/${n.id}?worldline=${wl.id}`, { title, content });
          toast('节点已更新', 'success');
        } else {
          await api.post(`/api/worlds/${worldId}/outline?worldline=${wl.id}`, { title, content });
          toast('节点已添加', 'success');
        }
        this.reload(ctx, 'outline');
      }
    });
  },

  // ---------- 章节（网络小说式阅读视图） ----------
  async render_timeline(el, ctx) {
    const wl = ctx.wl;
    if (!wl.timeline.length) {
      el.innerHTML = `
        <div class="panel">
          <div class="empty-hint" style="padding: 40px 0;">
            章节空空如也。<br>点击上方「⚡ 推进世界线」，由 AI 写下这条世界线的「第一章」。
          </div>
        </div>`;
      return;
    }

    const entries = wl.timeline.slice(); // 正序：第一章在上，符合小说阅读习惯
    el.innerHTML = `
      <div class="chapters">
        ${entries.map(e => {
          const no = e.chapterNo || e.seq;
          const chars = e.narrative.replace(/\s/g, '').length;
          return `
          <div class="chapter" id="chapter-${no}">
            <h2 class="chapter-title">第${no}章${e.chapterTitle ? '　' + esc(e.chapterTitle) : ''}</h2>
            <div class="chapter-meta">
              <span class="badge badge-time">${esc(e.worldTime)}</span>
              ${e.timeAdvanced ? `<span class="badge badge-soft">+ ${esc(e.timeAdvanced)}</span>` : ''}
              <span>约 ${chars} 字</span>
              <span>${fmtDate(e.createdAt)}</span>
              <button class="btn btn-sm chapter-branch" data-branch-chapter="${no}" title="从这一章之后开一条新世界线">⤴ 在此分支</button>
            </div>
            <div class="narrative chapter-body">${narrativeHtml(e.narrative)}</div>
            <details class="chapter-notes">
              <summary>本章纪要</summary>
              ${e.directorNote ? `<div class="tl-note">导演指令：${esc(e.directorNote)}</div>` : ''}
              ${e.events.length ? `<ul class="tl-events">${e.events.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
              ${e.characterChanges.length ? `
                <div class="tl-changes">
                  ${e.characterChanges.map(c => `
                    <span class="change-chip"><b>${esc(c.name)}</b>：
                      ${Object.entries(c.changes).map(([k, v]) => `${esc(k)} ${esc(v)}`).join('；')}
                    </span>`).join('')}
                </div>` : ''}
              ${e.relationshipChanges && e.relationshipChanges.length ? `
                <div class="tl-changes">
                  ${e.relationshipChanges.map(rc => {
                    const m = this.REL_META[rc.type] || this.REL_META.other;
                    return `<span class="change-chip" style="border-color:${m.color}66;color:${m.color}">
                      <b>${esc(rc.from)} ⇄ ${esc(rc.to)}</b>：${esc(rc.label || m.name)}（${this.REL_ACTION_NAME[rc.action] || rc.action}）
                    </span>`;
                  }).join('')}
                </div>` : ''}
              ${e.warnings.length ? `
                <div class="tl-warnings"><span class="dot dot-warn"></span>${e.warnings.map(esc).join('；')}</div>` : ''}
            </details>
          </div>`;
        }).join('')}
      </div>`;

    el.querySelectorAll('[data-branch-chapter]').forEach(b => {
      b.addEventListener('click', () => {
        this.branchModal(ctx, wl, Number(b.dataset.branchChapter));
      });
    });

    // 从推进流程跳转过来时，滚动到最新一章
    const target = window.__scrollToChapter;
    if (target) {
      window.__scrollToChapter = null;
      const node = el.querySelector('#chapter-' + target);
      if (node) node.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  },

  // ---------- 支线与任务档案（传说任务 / 邀约事件 / 世界任务 / 间章） ----------
  async render_quests(el, ctx) {
    const qs = Array.isArray(ctx.wl.quests) ? ctx.wl.quests : [];
    const CATS = { story: '传说任务', hangout: '邀约事件', world: '世界任务', interlude: '间章' };
    const CAT_BADGE = { story: 'badge-active', hangout: 'badge-soft', world: 'badge-done', interlude: 'badge-soft' };
    let cat = 'all';
    let region = 'all';

    el.innerHTML = `
      <div class="panel">
        <div class="panel-title"><span>支线与任务档案（${qs.length}）</span></div>
        <div class="quest-filters">
          ${['all', 'story', 'hangout', 'world', 'interlude'].map(k => `
            <button class="btn btn-sm quest-chip${k === cat ? ' quest-chip-on' : ''}" data-cat="${k}">${k === 'all' ? '全部' : CATS[k]}</button>`).join('')}
          <select id="quest-region">
            <option value="all">全部地区</option>
            ${[...new Set(qs.map(q => q.region).filter(Boolean))].map(r => `<option value="${esc(r)}">${esc(r)}</option>`).join('')}
          </select>
        </div>
        <div id="quest-list"></div>
      </div>`;

    const paint = () => {
      const list = qs.filter(q =>
        (cat === 'all' || q.category === cat) && (region === 'all' || q.region === region));
      const byRegion = new Map();
      for (const q of list) {
        if (!byRegion.has(q.region)) byRegion.set(q.region, []);
        byRegion.get(q.region).push(q);
      }
      el.querySelector('#quest-list').innerHTML = list.length
        ? [...byRegion.entries()].map(([reg, items]) => `
          <div class="quest-group">
            <div class="quest-region">${esc(reg || '跨区域')} <span class="dim">（${items.length}）</span></div>
            ${items.map(q => `
              <div class="quest-item">
                <span class="badge ${CAT_BADGE[q.category] || 'badge-soft'}">${esc(CATS[q.category] || q.category)}</span>
                <b>${esc(q.title)}</b>
                ${q.summary ? `<div class="quest-summary">${esc(q.summary)}</div>` : ''}
              </div>`).join('')}
          </div>`).join('')
        : '<div class="empty-hint">没有符合筛选条件的任务记录。</div>';
    };

    el.querySelectorAll('[data-cat]').forEach(b => {
      b.addEventListener('click', () => {
        cat = b.dataset.cat;
        el.querySelectorAll('[data-cat]').forEach(x => x.classList.toggle('quest-chip-on', x === b));
        paint();
      });
    });
    el.querySelector('#quest-region').addEventListener('change', e => { region = e.target.value; paint(); });
    paint();
  },

  // ---------- 重命名 ----------
  renameModal(ctx) {
    const { worldId } = ctx;
    openModal({
      title: '重命名世界',
      bodyHTML: `
        <div class="field">
          <label>世界名称</label>
          <input type="text" id="rn-name" value="${esc(ctx.file.world.name)}" maxlength="50">
        </div>`,
      okText: '保存',
      onOk: async () => {
        const name = document.getElementById('rn-name').value.trim();
        if (!name) {
          toast('名称不能为空', 'error');
          return false;
        }
        await api.put('/api/worlds/' + worldId, { name });
        toast('已重命名', 'success');
        this.reload(ctx);
      }
    });
  },

  // ---------- 创建世界线分支 ----------
  // fromWl: 分支来源世界线（默认当前世界线）；presetSeq: 预选的分支点章节号（默认最新一章）
  branchModal(ctx, fromWl, presetSeq) {
    const { file, worldId } = ctx;
    const src = fromWl || ctx.wl;
    const chapters = src.timeline;
    const maxSeq = chapters.length ? chapters[chapters.length - 1].seq : 0;
    const defSeq = presetSeq && chapters.some(c => c.seq === presetSeq) ? presetSeq : maxSeq;
    let selectedSeq = defSeq;

    openModal({
      title: `创建分支 · ${src.name}`,
      bodyHTML: `
        <p class="modal-hint">新世界线将复制「${esc(src.name)}」在所选章节结束时的人物、关系与大纲状态，以及该章节之前的历史；之后独立演化，与其他世界线互不影响。${chapters.length ? '' : '该世界线还没有章节，分支将直接复制当前设定。'}</p>
        <div class="field"><label>分支名称 *</label>
          <input type="text" id="br-name" value="${esc(src.name + '·分支')}" maxlength="30"></div>
        ${chapters.length ? `
        <div class="field"><label>分支点（点击某一章，从该章之后开始分支）</label>
          <div class="branch-picker" id="br-picker">
            ${chapters.map(c => `
              <div class="branch-node${c.seq === defSeq ? ' selected' : ''}" data-seq="${c.seq}">
                <span class="branch-dot"></span>
                <span class="branch-body">
                  <span class="branch-main">第${c.chapterNo || c.seq}章${c.chapterTitle ? ' · ' + esc(c.chapterTitle) : ''}</span>
                  <span class="branch-sub">${esc(c.worldTime) || '时间未定'}</span>
                </span>
              </div>`).join('')}
          </div>
          <div class="field-hint" id="br-hint"></div></div>` : ''}`,
      okText: '创建分支',
      onOk: async () => {
        const name = document.getElementById('br-name').value.trim();
        if (!name) {
          toast('请填写分支名称', 'error');
          return false;
        }
        const body = { name, parentId: src.id };
        if (chapters.length) body.branchFromSeq = selectedSeq;
        let resp;
        try {
          resp = await api.post(`/api/worlds/${worldId}/worldlines`, body);
        } catch (e) {
          toast(e.message, 'error');
          return false;
        }
        toast(`世界线「${name}」已创建`, 'success');
        if (resp.fallbackToCurrent) {
          toast('注意：所选章节为历史数据、无状态快照，分支使用了世界线当前最新状态（可能包含后续章节的影响）');
        }
        location.hash = this.hashTo(worldId, ctx.tab, resp.worldline.id);
        appRerender();
      }
    });

    const picker = document.getElementById('br-picker');
    if (picker) {
      const hint = document.getElementById('br-hint');
      const updateHint = () => {
        const c = chapters.find(x => x.seq === selectedSeq);
        if (!c) { hint.textContent = ''; return; }
        hint.textContent = c.snapshot
          ? '该分支将从所选章节结束时的状态继续演化'
          : '⚠ 该章为历史数据、无状态快照，分支将复制世界线当前最新状态（可能包含后续章节的影响）';
      };
      picker.querySelectorAll('.branch-node').forEach(n => {
        n.addEventListener('click', () => {
          picker.querySelectorAll('.branch-node').forEach(x => x.classList.remove('selected'));
          n.classList.add('selected');
          selectedSeq = Number(n.dataset.seq);
          updateHint();
        });
      });
      updateHint();
      const sel = picker.querySelector('.branch-node.selected');
      if (sel) picker.scrollTop = Math.max(0, sel.offsetTop - picker.clientHeight / 2 + sel.offsetHeight / 2);
    }
  },

  // ---------- 推进世界线 ----------
  async advanceFlow(ctx) {
    const { worldId, wl } = ctx;
    let settings;
    try {
      settings = await api.get('/api/settings');
    } catch (e) {
      toast(e.message, 'error');
      return;
    }
    if (!settings.ai.baseUrl || !settings.ai.model) {
      const go = await confirmModal('尚未配置 AI 服务，无法推进世界线。是否前往设置页配置？', { okText: '前往设置' });
      if (go) location.hash = '#/settings';
      return;
    }

    openModal({
      title: `推进世界线 · ${wl.name}`,
      bodyHTML: `
        <p class="modal-hint">将在世界线「${esc(wl.name)}」上推进。填写导演指令可以引导本次剧情走向；留空则由 AI 按大纲与当前局势自然推进。每次推进生成一章网络小说（2000~3000 字），推演约需 1~3 分钟，请耐心等待。</p>
        <div class="field">
          <textarea id="director-note" rows="4" placeholder="例：主角与反派初次正面交锋，主角落败重伤"></textarea>
        </div>`,
      okText: '⚡ 开始推演',
      onOk: () => {
        const directorNote = document.getElementById('director-note').value.trim();
        // 异步执行：立即关闭弹窗，用全屏遮罩等待
        (async () => {
          showOverlay('AI 正在推演世界线，请耐心等待…');
          try {
            const result = await api.post(`/api/worlds/${worldId}/advance`, { directorNote, worldlineId: wl.id });
            hideOverlay();
            window.__scrollToChapter = result.entry.chapterNo || result.entry.seq;
            toast(`第${result.entry.chapterNo || result.entry.seq}章 已生成${result.entry.chapterTitle ? '：' + result.entry.chapterTitle : ''}`, 'success');
            this.reload(ctx, 'timeline');
          } catch (e) {
            hideOverlay();
            toast(e.message, 'error');
          }
        })();
      }
    });
  }
};
