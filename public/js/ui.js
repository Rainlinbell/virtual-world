// UI 工具：转义 / 弹窗 / toast / 遮罩
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return isNaN(d) ? '' : d.toLocaleString('zh-CN', { hour12: false });
}

function fmtRel(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  if (isNaN(diff)) return '';
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return Math.floor(diff / 60000) + ' 分钟前';
  if (diff < 86400000) return Math.floor(diff / 3600000) + ' 小时前';
  return Math.floor(diff / 86400000) + ' 天前';
}

function toast(msg, type = 'info') {
  const c = document.getElementById('toast-container');
  const t = document.createElement('div');
  t.className = 'toast toast-' + type;
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => {
    t.classList.add('out');
    setTimeout(() => t.remove(), 350);
  }, 4200);
}

// 通用弹窗：onOk 返回 false 则保持打开；抛错则提示并保持打开
function openModal({ title, bodyHTML, okText = '确定', cancelText = '取消', onOk, onCancel, okClass = 'btn-primary' }) {
  const root = document.getElementById('modal-root');
  root.innerHTML = `
    <div class="modal-mask">
      <div class="modal">
        <div class="modal-head">
          <h3>${esc(title)}</h3>
          <button class="modal-close" title="关闭">×</button>
        </div>
        <div class="modal-body">${bodyHTML}</div>
        <div class="modal-foot">
          <button class="btn" data-role="cancel">${esc(cancelText)}</button>
          ${onOk ? `<button class="btn ${okClass}" data-role="ok">${esc(okText)}</button>` : ''}
        </div>
      </div>
    </div>`;

  const mask = root.querySelector('.modal-mask');
  const close = (cancelled) => {
    root.innerHTML = '';
    if (cancelled && onCancel) onCancel();
  };

  root.querySelector('.modal-close').addEventListener('click', () => close(true));
  root.querySelector('[data-role="cancel"]').addEventListener('click', () => close(true));
  mask.addEventListener('click', e => { if (e.target === mask) close(true); });

  const okBtn = root.querySelector('[data-role="ok"]');
  if (okBtn) {
    okBtn.addEventListener('click', async () => {
      okBtn.disabled = true;
      try {
        const r = await onOk(close);
        if (r === false) { okBtn.disabled = false; return; }
        close(false);
      } catch (e) {
        okBtn.disabled = false;
        toast(e.message, 'error');
      }
    });
  }

  const first = root.querySelector('input, textarea, select');
  if (first) first.focus();

  return close;
}

// 确认弹窗，返回 Promise<boolean>
function confirmModal(message, opts = {}) {
  const { okText = '确定', danger = false } = opts;
  return new Promise(resolve => {
    openModal({
      title: '请确认',
      bodyHTML: `<p class="confirm-msg">${esc(message)}</p>`,
      okText,
      okClass: danger ? 'btn-danger' : 'btn-primary',
      onOk: () => resolve(true),
      onCancel: () => resolve(false)
    });
  });
}

// 全局遮罩（AI 推演等待）
function showOverlay(text) {
  let ov = document.getElementById('global-overlay');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'global-overlay';
    ov.innerHTML = `<div class="overlay-box"><div class="spinner"></div><div id="overlay-text"></div></div>`;
    document.body.appendChild(ov);
  }
  document.getElementById('overlay-text').textContent = text;
  ov.classList.add('show');
}

function hideOverlay() {
  const ov = document.getElementById('global-overlay');
  if (ov) ov.classList.remove('show');
}

// 叙事文本 → 段落 HTML
function narrativeHtml(text) {
  return String(text || '')
    .split(/\n{2,}/)
    .filter(p => p.trim())
    .map(p => `<p>${esc(p)}</p>`)
    .join('');
}

// 人物头像：按名字生成稳定的颜色 + 首字
const AVATAR_COLORS = [
  '#6e7ff3', '#8b5cf6', '#e0619a', '#ef7d43', '#c98f14',
  '#3fae7a', '#2fb3c1', '#4f8af0', '#c95d9e', '#7a8ba6'
];

function avatarColor(name) {
  let h = 0;
  const s = String(name || '');
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

function avatarHtml(name, sm) {
  return `<span class="avatar${sm ? ' avatar-sm' : ''}" style="background:${avatarColor(name)}">${esc(String(name || '?').slice(0, 1))}</span>`;
}
