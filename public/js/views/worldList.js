// 世界列表页
const WorldList = {
  async render(container) {
    const worlds = await api.get('/api/worlds');

    const cards = worlds.map(w => `
      <div class="world-card" data-id="${esc(w.id)}">
        <div class="world-card-head">
          <h3>${esc(w.name)}</h3>
          <button class="btn-icon danger" data-del="${esc(w.id)}" title="删除世界">✕</button>
        </div>
        <div class="world-card-time">时间 · ${esc(w.worldTime || '未定')}</div>
        <div class="world-card-status">${esc(w.worldStatus || '尚无局势记录')}</div>
        <div class="world-card-meta">
          <span>${w.characterCount} 人物</span>
          <span>${w.advanceCount} 次推进</span>
          <span>${fmtRel(w.updatedAt)}</span>
        </div>
      </div>`).join('');

    container.innerHTML = `
      <div class="page">
        <div class="page-head">
          <h1>我的世界</h1>
          <button class="btn btn-primary" id="create-world-btn">＋ 创建新世界</button>
        </div>
        <div class="world-grid">
          ${cards}
          <div class="world-card world-card-new" id="new-world-card">
            <div class="new-icon">＋</div>
            <div>创建新世界</div>
          </div>
        </div>
        ${worlds.length ? '' : '<div class="empty-hint">还没有任何世界。创建第一个世界，写下它的世界观吧。</div>'}
      </div>`;

    container.querySelectorAll('.world-card:not(.world-card-new)').forEach(card => {
      card.addEventListener('click', e => {
        if (e.target.closest('[data-del]')) return;
        location.hash = `#/worlds/${card.dataset.id}?tab=overview`;
      });
    });

    container.querySelectorAll('[data-del]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.del;
        const w = worlds.find(x => x.id === id);
        const ok = await confirmModal(
          `确定删除世界「${w ? w.name : id}」？\n其所有人物、大纲与编年史将一并删除，且无法恢复。`,
          { danger: true, okText: '删除' }
        );
        if (!ok) return;
        try {
          await api.del('/api/worlds/' + id);
          toast('世界已删除', 'success');
          this.render(container);
        } catch (e) {
          toast(e.message, 'error');
        }
      });
    });

    const create = () => this.openCreateModal();
    container.querySelector('#create-world-btn').addEventListener('click', create);
    container.querySelector('#new-world-card').addEventListener('click', create);
  },

  openCreateModal() {
    openModal({
      title: '创建新世界',
      bodyHTML: `
        <div class="field">
          <label>世界名称 *</label>
          <input type="text" id="nw-name" placeholder="如：九州修真界" maxlength="50">
        </div>
        <div class="field">
          <label>世界观设定（可稍后编辑）</label>
          <textarea id="nw-worldview" rows="8" placeholder="描述这个世界的时代背景、地理、势力、规则体系（修真 / 魔法 / 科技）……"></textarea>
        </div>`,
      okText: '创建',
      onOk: async () => {
        const name = document.getElementById('nw-name').value.trim();
        if (!name) {
          toast('请填写世界名称', 'error');
          return false;
        }
        const worldview = document.getElementById('nw-worldview').value.trim();
        const file = await api.post('/api/worlds', { name, worldview });
        location.hash = `#/worlds/${file.world.id}?tab=worldview`;
      }
    });
  }
};
