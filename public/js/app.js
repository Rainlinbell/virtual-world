// hash 路由
const appEl = document.getElementById('app');
let renderTimer = null;

function parseHash() {
  const h = location.hash;
  let m;
  if (!h || h === '#/' || h === '#/home') return { view: 'home' };
  if ((m = h.match(/^#\/worlds\/([^?/]+)(?:\?(.*))?$/))) {
    const qs = new URLSearchParams(m[2] || '');
    return { view: 'worldDetail', id: decodeURIComponent(m[1]), tab: qs.get('tab') || 'overview' };
  }
  if (h === '#/settings') return { view: 'settings' };
  if (h === '#/worlds') return { view: 'worldList' };
  return { view: 'home' };
}

async function render() {
  const route = parseHash();
  document.querySelectorAll('.topbar nav a').forEach(a => {
    const active = a.dataset.nav === route.view ||
      (route.view === 'worldDetail' && a.dataset.nav === 'worlds');
    a.classList.toggle('active', active);
  });
  try {
    if (route.view === 'home') await Home.render(appEl);
    else if (route.view === 'worldDetail') await WorldDetail.render(appEl, route.id, route.tab);
    else if (route.view === 'settings') await SettingsView.render(appEl);
    else await WorldList.render(appEl);
  } catch (e) {
    appEl.innerHTML = `
      <div class="page">
        <div class="page-error">⚠️ ${esc(e.message)}<br><br><a href="#/worlds">← 返回世界列表</a></div>
      </div>`;
  }
  window.scrollTo(0, 0);
}

function scheduleRender() {
  if (renderTimer) clearTimeout(renderTimer);
  renderTimer = setTimeout(render, 0);
}

// 供视图在 hash 未变化时强制刷新
window.appRerender = scheduleRender;

window.addEventListener('hashchange', scheduleRender);
scheduleRender();
