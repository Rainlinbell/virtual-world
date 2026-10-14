// 世界详情页：总览 / 世界观 / 人物 / 关系 / 大纲 / 章节
const WorldDetail = {
  TABS: [
    ['overview', '总览'],
    ['worldview', '世界观'],
    ['characters', '人物'],
    ['relations', '关系'],
    ['outline', '大纲'],
    ['timeline', '章节']
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

  async render(container, worldId, tab) {
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
    if (!this.TABS.some(([t]) => t === tab)) tab = 'overview';
    const w = file.world;

    container.innerHTML = `
      <div class="page">
        <div class="detail-head">
          <div class="detail-title-row">
            <a class="back-link" href="#/worlds" title="返回列表">←</a>
            <h1>${esc(w.name)}</h1>
            <button class="btn-icon" id="rename-btn" title="重命名">✎</button>
          </div>
          <div class="detail-meta">
            <span class="badge badge-time">时间 · ${esc(w.currentState.worldTime || '未定')}</span>
            <span class="detail-status">${esc(w.currentState.worldStatus || '')}</span>
          </div>
          <div class="detail-actions">
            <button class="btn btn-primary btn-lg" id="advance-btn">⚡ 推进世界线</button>
          </div>
        </div>
        <nav class="tabs">
          ${this.TABS.map(([t, label]) =>
            `<a class="tab ${t === tab ? 'active' : ''}" data-tab="${t}">${label}</a>`).join('')}
        </nav>
        <div id="tab-body"></div>
      </div>`;

    container.querySelector('#rename-btn').addEventListener('click', () => this.renameModal(file, tab));
    container.querySelector('#advance-btn').addEventListener('click', () => this.advanceFlow(file));
    container.querySelectorAll('.tab').forEach(el => {
      el.addEventListener('click', () => {
        location.hash = `#/worlds/${worldId}?tab=${el.dataset.tab}`;
      });
    });

    const body = container.querySelector('#tab-body');
    await this['render_' + tab](body, file, worldId);
  },

  reload(worldId, tab) {
    location.hash = `#/worlds/${worldId}?tab=${tab}`;
    appRerender();
  },

  // ---------- 总览 ----------
  async render_overview(el, file, worldId) {
    const w = file.world;
    const currentNode = file.outline.find(n => n.id === w.currentState.outlineCursorId);
    const doneCount = file.outline.filter(n => n.status === 'done').length;
    const last = file.timeline[file.timeline.length - 1];

    if (!file.characters.length && !file.outline.length && !last) {
      el.innerHTML = `
        <div class="guide">
          <h2>世界初开</h2>
          <p>按以下三步启动你的世界：</p>
          <div class="guide-steps">
            <a class="guide-step" href="#/worlds/${worldId}?tab=worldview">
              <span class="step-num">1</span><b>完善世界观</b>
              <span>时代背景、势力、规则体系</span>
            </a>
            <a class="guide-step" href="#/worlds/${worldId}?tab=characters">
              <span class="step-num">2</span><b>添加主要人物</b>
              <span>主角、反派、配角的设定与初始状态</span>
            </a>
            <a class="guide-step" href="#/worlds/${worldId}?tab=outline">
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
          <div class="ov-status">${esc(w.currentState.worldStatus || '尚无局势记录')}</div>
          <div class="ov-time">当前时间：${esc(w.currentState.worldTime || '未定')}</div>
        </div>
        <div class="panel">
          <div class="panel-title">大纲进度</div>
          ${file.outline.length ? `
            <div class="ov-outline-progress">${doneCount} / ${file.outline.length} 节点已完成</div>
            ${currentNode
              ? `<div class="ov-current-node"><span class="badge badge-active">进行中</span>${esc(currentNode.title)}</div>`
              : '<div class="dim">当前无进行中的大纲节点</div>'}`
            : `<div class="dim">尚未编写大纲，<a href="#/worlds/${worldId}?tab=outline">去添加</a></div>`}
        </div>
      </div>
      <div class="panel">
        <div class="panel-title">人物速览（${file.characters.length}）</div>
        ${file.characters.length ? `
          <div class="ov-chars">
            ${file.characters.map(c => `
              <div class="char-chip ${c.status.alive ? '' : 'char-dead'}">
                <div style="display:flex;align-items:center;gap:6px;">${avatarHtml(c.name, true)}<b>${esc(c.name)}</b></div>
                <span class="dim">${esc(c.role || '')}</span>
                <span>${c.status.alive ? esc(c.status.location || '位置未知') : '已死亡'}</span>
              </div>`).join('')}
          </div>` : `<div class="dim">还没有人物，<a href="#/worlds/${worldId}?tab=characters">去添加</a></div>`}
      </div>
      ${last ? `
      <div class="panel">
        <div class="panel-title">最新章节 <span class="dim">第${last.chapterNo || last.seq}章${last.chapterTitle ? ' · ' + esc(last.chapterTitle) : ''} · ${esc(last.worldTime)}</span></div>
        <div class="narrative">${narrativeHtml(last.narrative)}</div>
        ${last.events.length ? `<ul class="tl-events">${last.events.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
        <div style="margin-top:10px;"><a href="#/worlds/${worldId}?tab=timeline">阅读全文 →</a></div>
      </div>` : ''}`;
  },

  // ---------- 世界观 ----------
  async render_worldview(el, file, worldId) {
    el.innerHTML = `
      <div class="panel">
        <div class="panel-title">世界观设定</div>
        <textarea id="worldview-editor" rows="18" placeholder="描述这个世界的时代背景、地理、势力、规则体系……">${esc(file.world.worldview)}</textarea>
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
  async render_characters(el, file, worldId) {
    el.innerHTML = `
      <div class="panel">
        <div class="panel-title">
          <span>人物（${file.characters.length}）</span>
          <button class="btn btn-sm" id="add-char-btn">＋ 新增人物</button>
        </div>
        ${file.characters.length ? `
          <div class="char-grid">${file.characters.map(c => this.charCard(c)).join('')}</div>`
        : '<div class="empty-hint">还没有人物。添加主角、反派与关键配角，AI 将围绕他们演绎故事。</div>'}
      </div>`;

    el.querySelector('#add-char-btn').addEventListener('click', () => this.charModal(worldId, null));
    el.querySelectorAll('[data-edit-char]').forEach(b => {
      b.addEventListener('click', () => {
        const c = file.characters.find(x => x.id === b.dataset.editChar);
        if (c) this.charModal(worldId, c);
      });
    });
    el.querySelectorAll('[data-del-char]').forEach(b => {
      b.addEventListener('click', async () => {
        const c = file.characters.find(x => x.id === b.dataset.delChar);
        const ok = await confirmModal(`确定删除人物「${c ? c.name : ''}」？`, { danger: true, okText: '删除' });
        if (!ok) return;
        try {
          await api.del(`/api/worlds/${worldId}/characters/${b.dataset.delChar}`);
          toast('人物已删除', 'success');
          this.reload(worldId, 'characters');
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

  charModal(worldId, existing) {
    const c = existing;
    const s = c ? c.status : {};
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
          status
        };
        if (c) {
          status.alive = document.getElementById('ch-alive').checked;
          await api.put(`/api/worlds/${worldId}/characters/${c.id}`, body);
          toast('人物已更新', 'success');
        } else {
          await api.post(`/api/worlds/${worldId}/characters`, body);
          toast('人物已添加', 'success');
        }
        this.reload(worldId, 'characters');
      }
    });
  },

  // ---------- 人物关系图 ----------
  async render_relations(el, file, worldId) {
    const chars = file.characters;
    const rels = file.relationships || [];
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
          <span class="rel-legend-item dim" style="margin-left:auto">悬停节点查看关系 · 拖动节点调整布局</span>
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
      this.relModal(worldId, chars, null);
    });
    el.querySelectorAll('[data-edit-rel]').forEach(b => {
      b.addEventListener('click', () => {
        const rel = rels.find(r => r.id === b.dataset.editRel);
        if (rel) this.relModal(worldId, chars, rel);
      });
    });
    el.querySelectorAll('[data-del-rel]').forEach(b => {
      b.addEventListener('click', async () => {
        const ok = await confirmModal('确定删除这条人物关系？', { danger: true, okText: '删除' });
        if (!ok) return;
        try {
          await api.del(`/api/worlds/${worldId}/relationships/${b.dataset.delRel}`);
          toast('关系已删除', 'success');
          this.reload(worldId, 'relations');
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

  relModal(worldId, chars, existing) {
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
          <input type="text" id="rel-label" value="${esc(existing ? existing.label : '')}" placeholder="如：宿敌、结拜姐妹、师徒、暗恋" maxlength="20"></div>`,
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
          label: document.getElementById('rel-label').value.trim()
        };
        if (existing) {
          await api.put(`/api/worlds/${worldId}/relationships/${existing.id}`, body);
          toast('关系已更新', 'success');
        } else {
          await api.post(`/api/worlds/${worldId}/relationships`, body);
          toast('关系已添加', 'success');
        }
        this.reload(worldId, 'relations');
      }
    });
  },

  // ---------- 大纲 ----------
  async render_outline(el, file, worldId) {
    const nodes = file.outline.slice().sort((a, b) => (a.order || 0) - (b.order || 0));
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

    el.querySelector('#add-node-btn').addEventListener('click', () => this.nodeModal(worldId, null));

    const order = ['pending', 'active', 'done', 'skipped'];
    el.querySelectorAll('[data-cycle]').forEach(b => {
      b.addEventListener('click', async () => {
        const node = file.outline.find(n => n.id === b.dataset.cycle);
        if (!node) return;
        const next = order[(order.indexOf(node.status) + 1) % order.length];
        try {
          await api.put(`/api/worlds/${worldId}/outline/${node.id}`, { status: next });
          this.reload(worldId, 'outline');
        } catch (e) {
          toast(e.message, 'error');
        }
      });
    });

    el.querySelectorAll('[data-edit-node]').forEach(b => {
      b.addEventListener('click', () => {
        const n = file.outline.find(x => x.id === b.dataset.editNode);
        if (n) this.nodeModal(worldId, n);
      });
    });

    el.querySelectorAll('[data-del-node]').forEach(b => {
      b.addEventListener('click', async () => {
        const n = file.outline.find(x => x.id === b.dataset.delNode);
        const ok = await confirmModal(`确定删除大纲节点「${n ? n.title : ''}」？`, { danger: true, okText: '删除' });
        if (!ok) return;
        try {
          await api.del(`/api/worlds/${worldId}/outline/${b.dataset.delNode}`);
          toast('节点已删除', 'success');
          this.reload(worldId, 'outline');
        } catch (e) {
          toast(e.message, 'error');
        }
      });
    });
  },

  nodeModal(worldId, existing) {
    const n = existing;
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
          await api.put(`/api/worlds/${worldId}/outline/${n.id}`, { title, content });
          toast('节点已更新', 'success');
        } else {
          await api.post(`/api/worlds/${worldId}/outline`, { title, content });
          toast('节点已添加', 'success');
        }
        this.reload(worldId, 'outline');
      }
    });
  },

  // ---------- 章节（网络小说式阅读视图） ----------
  async render_timeline(el, file) {
    if (!file.timeline.length) {
      el.innerHTML = `
        <div class="panel">
          <div class="empty-hint" style="padding: 40px 0;">
            章节空空如也。<br>点击上方「⚡ 推进世界线」，由 AI 写下这个世界的「第一章」。
          </div>
        </div>`;
      return;
    }

    const entries = file.timeline.slice(); // 正序：第一章在上，符合小说阅读习惯
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

    // 从推进流程跳转过来时，滚动到最新一章
    const target = window.__scrollToChapter;
    if (target) {
      window.__scrollToChapter = null;
      const node = el.querySelector('#chapter-' + target);
      if (node) node.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  },

  // ---------- 重命名 ----------
  renameModal(file, currentTab) {
    const worldId = file.world.id;
    openModal({
      title: '重命名世界',
      bodyHTML: `
        <div class="field">
          <label>世界名称</label>
          <input type="text" id="rn-name" value="${esc(file.world.name)}" maxlength="50">
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
        this.reload(worldId, currentTab);
      }
    });
  },

  // ---------- 推进世界线 ----------
  async advanceFlow(file) {
    const worldId = file.world.id;
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
      title: '推进世界线',
      bodyHTML: `
        <p class="modal-hint">填写导演指令可以引导本次剧情走向；留空则由 AI 按大纲与当前局势自然推进。每次推进生成一章网络小说（2000~3000 字），推演约需 1~3 分钟，请耐心等待。</p>
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
            const result = await api.post(`/api/worlds/${worldId}/advance`, { directorNote });
            hideOverlay();
            window.__scrollToChapter = result.entry.chapterNo || result.entry.seq;
            toast(`第${result.entry.chapterNo || result.entry.seq}章 已生成${result.entry.chapterTitle ? '：' + result.entry.chapterTitle : ''}`, 'success');
            this.reload(worldId, 'timeline');
          } catch (e) {
            hideOverlay();
            toast(e.message, 'error');
          }
        })();
      }
    });
  }
};
