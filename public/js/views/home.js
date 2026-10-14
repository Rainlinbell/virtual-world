// 首页：白色简洁 + 世界线交汇分散视觉
const Home = {
  async render(container) {
    let worlds = [];
    try {
      worlds = await api.get('/api/worlds');
    } catch {}

    const charCount = worlds.reduce((s, w) => s + (w.characterCount || 0), 0);
    const advCount = worlds.reduce((s, w) => s + (w.advanceCount || 0), 0);
    const recent = worlds.slice(0, 4);

    container.innerHTML = `
      <div class="home">
        <div class="home-eyebrow">Worldline Engine</div>
        <h1 class="home-title">万千世界线，在此交汇</h1>
        <p class="home-sub">定义世界观、人物与大纲，由 AI 推演每一程世界线的走向——交汇、离散、生生不息。</p>

        <div class="home-visual" id="home-visual"></div>

        <div class="home-cta">
          <a class="btn btn-primary btn-lg" href="#/worlds">进入世界列表</a>
          <button class="btn btn-lg" id="home-create-btn">＋ 创建新世界</button>
        </div>

        <div class="home-stats">${worlds.length} 个世界 · ${charCount} 位人物 · ${advCount} 章故事</div>

        ${recent.length ? `
        <div class="home-worlds">
          ${recent.map(w => `
            <a class="home-world-chip" href="#/worlds/${esc(w.id)}?tab=overview">
              ${esc(w.name)}${w.worldTime ? ' · ' + esc(w.worldTime) : ''}
            </a>`).join('')}
        </div>` : ''}

        <div class="home-steps">
          <div class="home-step">
            <span class="home-step-num">1</span><b>构筑世界</b><span>世界观与规则</span>
          </div>
          <div class="home-step">
            <span class="home-step-num">2</span><b>设定众生</b><span>人物与剧情大纲</span>
          </div>
          <div class="home-step">
            <span class="home-step-num">3</span><b>推演世界线</b><span>AI 演绎世界走向</span>
          </div>
        </div>
      </div>`;

    container.querySelector('#home-create-btn').addEventListener('click', () => WorldList.openCreateModal());
    this.buildWorldLines(container.querySelector('#home-visual'));
  },

  // 生成「世界线交汇分散」SVG：左侧发散 → 中央汇聚 → 右侧再分散
  buildWorldLines(el) {
    const W = 1200, H = 520, CX = 600, CY = 265, N = 36;
    const rand = (a, b) => a + Math.random() * (b - a);
    const palette = ['#6e7ff3', '#8b5cf6', '#a78bfa', '#5b6ee0', '#7c8cf8', '#9d7bf5', '#4f6af0'];
    const accents = ['#34c3a6', '#f0a92e', '#f26d8d', '#5aa2f0'];
    let strands = '';
    let comets = '';

    for (let i = 0; i < N; i++) {
      const y0 = 42 + (H - 84) * (i / (N - 1)) + rand(-7, 7);
      const ym = CY + rand(-22, 22);          // 汇聚束内的通道
      const xm = CX + rand(-34, 34);
      // 打乱左右端点的对应关系，体现「交汇后散向不同的世界线」
      const t = (i + Math.round(rand(-7, 7)) + N) % N;
      const y2 = 42 + (H - 84) * (t / (N - 1)) + rand(-7, 7);
      const d = `M 0 ${y0.toFixed(1)} C 250 ${y0.toFixed(1)}, ${(xm - 250).toFixed(1)} ${ym.toFixed(1)}, ${xm.toFixed(1)} ${ym.toFixed(1)} C ${(xm + 250).toFixed(1)} ${ym.toFixed(1)}, 950 ${y2.toFixed(1)}, 1200 ${y2.toFixed(1)}`;

      const isAccent = Math.random() < 0.18;
      const color = isAccent
        ? accents[Math.floor(Math.random() * accents.length)]
        : palette[Math.floor(Math.random() * palette.length)];
      const isHero = !isAccent && Math.random() < 0.16;
      const baseOpacity = isHero ? rand(0.55, 0.8) : rand(0.1, 0.3);
      const baseWidth = isHero ? rand(1.6, 2.2) : rand(0.7, 1.4);
      const inDelay = (i * 0.028).toFixed(2);
      const tag = '世界线 #' + Math.floor(Math.random() * 0xfff).toString(16).padStart(3, '0').toUpperCase();

      strands += `<path class="wl-line" d="${d}" fill="none" stroke="${color}" stroke-width="${baseWidth.toFixed(1)}" stroke-opacity="${baseOpacity.toFixed(2)}" style="--in-delay:${inDelay}s"><title>${tag}</title></path>`;

      // 部分线条叠加流动光点
      if (isHero || Math.random() < 0.45) {
        comets += `<path class="wl-comet" d="${d}" fill="none" stroke="${color}" stroke-width="${(baseWidth + 0.3).toFixed(1)}" stroke-linecap="round" style="--d:${rand(3.5, 8).toFixed(1)}s;--delay:${(-rand(0, 8)).toFixed(1)}s;--in-delay:${(i * 0.028 + 0.3).toFixed(2)}s"><title>${tag}</title></path>`;
      }
    }

    el.innerHTML = `
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="世界线交汇与分散示意图">
        <defs>
          <radialGradient id="wl-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#6e7ff3" stop-opacity="0.10"/>
            <stop offset="100%" stop-color="#6e7ff3" stop-opacity="0"/>
          </radialGradient>
          <radialGradient id="wl-node" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#8b5cf6"/>
            <stop offset="100%" stop-color="#6e7ff3"/>
          </radialGradient>
        </defs>
        <circle cx="${CX}" cy="${CY}" r="130" fill="url(#wl-glow)"/>
        <g>${strands}</g>
        <g>${comets}</g>
        <circle class="wl-ring" cx="${CX}" cy="${CY}" r="6" fill="none" stroke="#6e7ff3" stroke-width="1.2"/>
        <circle class="wl-ring wl-ring-2" cx="${CX}" cy="${CY}" r="6" fill="none" stroke="#8b5cf6" stroke-width="1.2"/>
        <circle class="wl-node" cx="${CX}" cy="${CY}" r="5.5" fill="url(#wl-node)"/>
      </svg>`;
  }
};
