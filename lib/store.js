// 存储层：JSON 文件持久化（原子写 + 推进前备份）
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '..', 'data');
const WORLDS_DIR = path.join(DATA_DIR, 'worlds');
const BACKUPS_DIR = path.join(DATA_DIR, 'backups');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

const DEFAULT_SETTINGS = {
  ai: {
    baseUrl: '',
    apiKey: '',
    model: '',
    temperature: 0.8,
    maxTokens: 8192,
    timeoutMs: 240000
  },
  advance: {
    recentTimelineCount: 20,
    maxRetries: 1,
    charPromptLimit: 80
  }
};

function ensureDirs() {
  for (const d of [DATA_DIR, WORLDS_DIR, BACKUPS_DIR]) fs.mkdirSync(d, { recursive: true });
}

function genId(prefix) {
  return prefix + crypto.randomBytes(4).toString('hex');
}

function isValidId(id) {
  return typeof id === 'string' && /^[A-Za-z0-9_-]+$/.test(id);
}

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

function atomicWrite(file, data) {
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, file);
}

// ---------- 设置 ----------
function loadSettings() {
  let saved = {};
  try {
    saved = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
  } catch { /* 首次运行，使用默认值 */ }
  const s = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  if (saved.ai && typeof saved.ai === 'object') Object.assign(s.ai, saved.ai);
  if (saved.advance && typeof saved.advance === 'object') Object.assign(s.advance, saved.advance);
  s.ai.baseUrl = String(s.ai.baseUrl || '');
  s.ai.apiKey = String(s.ai.apiKey || '');
  s.ai.model = String(s.ai.model || '');
  s.ai.temperature = clamp(Number(s.ai.temperature) || 0.8, 0, 2);
  s.ai.maxTokens = clamp(Number(s.ai.maxTokens) || 8192, 256, 131072);
  s.ai.timeoutMs = clamp(Number(s.ai.timeoutMs) || 240000, 5000, 600000);
  s.advance.recentTimelineCount = clamp(Number(s.advance.recentTimelineCount) || 20, 1, 200);
  s.advance.maxRetries = clamp(Number(s.advance.maxRetries) || 0, 0, 5);
  s.advance.charPromptLimit = clamp(Number(s.advance.charPromptLimit) || 0, 0, 300);
  return s;
}

function saveSettings(s) {
  ensureDirs();
  atomicWrite(SETTINGS_FILE, s);
}

// ---------- 世界 ----------
function worldPath(id) {
  return path.join(WORLDS_DIR, id + '.json');
}

// 老版本(v1)迁移：把顶层 timeline/characters/outline/relationships 收进「主线」世界线
function migrateWorldFile(file) {
  if (file.version === 2 && Array.isArray(file.worldlines) && file.worldlines.length) return false;
  const trunk = {
    id: genId('l_'),
    name: '主线',
    parentId: null,
    branchFromSeq: null,
    createdAt: (file.world && file.world.createdAt) || new Date().toISOString(),
    updatedAt: (file.world && file.world.updatedAt) || '',
    currentState: JSON.parse(JSON.stringify(
      (file.world && file.world.currentState) || { worldTime: '', worldStatus: '', outlineCursorId: null }
    )),
    characters: Array.isArray(file.characters) ? file.characters : [],
    outline: Array.isArray(file.outline) ? file.outline : [],
    relationships: Array.isArray(file.relationships) ? file.relationships : [],
    timeline: Array.isArray(file.timeline) ? file.timeline : []
  };
  file.worldlines = [trunk];
  file.version = 2;
  delete file.characters;
  delete file.outline;
  delete file.relationships;
  delete file.timeline;
  if (file.world) delete file.world.currentState;
  return true;
}

function getWorldFile(id) {
  if (!isValidId(id)) return null;
  let file;
  try {
    file = JSON.parse(fs.readFileSync(worldPath(id), 'utf8'));
  } catch {
    return null;
  }
  const migrated = migrateWorldFile(file);
  for (const wl of file.worldlines || []) {
    if (!wl.currentState || typeof wl.currentState !== 'object') {
      wl.currentState = { worldTime: '', worldStatus: '', outlineCursorId: null };
    }
    if (!Array.isArray(wl.characters)) wl.characters = [];
    if (!Array.isArray(wl.outline)) wl.outline = [];
    if (!Array.isArray(wl.relationships)) wl.relationships = [];
    if (!Array.isArray(wl.timeline)) wl.timeline = [];
  }
  let writeBack = migrated;
  // 为缺少快照的最新一章回填状态快照；更早的历史章节没有快照，分支时会回退到当前状态
  for (const wl of file.worldlines || []) {
    if (!wl.timeline.length) continue;
    const last = wl.timeline[wl.timeline.length - 1];
    if (!last.snapshot) {
      last.snapshot = {
        characters: JSON.parse(JSON.stringify(wl.characters)),
        relationships: JSON.parse(JSON.stringify(wl.relationships)),
        outline: JSON.parse(JSON.stringify(wl.outline)),
        currentState: JSON.parse(JSON.stringify(wl.currentState))
      };
      writeBack = true;
    }
  }
  if (writeBack) saveWorldFile(file);
  return file;
}

function saveWorldFile(file) {
  ensureDirs();
  atomicWrite(worldPath(file.world.id), file);
}

function listWorlds() {
  ensureDirs();
  let names = [];
  try {
    names = fs.readdirSync(WORLDS_DIR);
  } catch {}
  const worlds = [];
  for (const name of names) {
    if (!name.endsWith('.json')) continue;
    try {
      const f = JSON.parse(fs.readFileSync(path.join(WORLDS_DIR, name), 'utf8'));
      const trunk = Array.isArray(f.worldlines) ? f.worldlines[0] : null;
      const chars = trunk ? (trunk.characters || []) : (f.characters || []);
      const timeline = trunk ? (trunk.timeline || []) : (f.timeline || []);
      const state = trunk ? (trunk.currentState || {}) : ((f.world && f.world.currentState) || {});
      worlds.push({
        id: f.world.id,
        name: f.world.name,
        worldTime: state.worldTime || '',
        worldStatus: state.worldStatus || '',
        characterCount: chars.length,
        advanceCount: timeline.length,
        updatedAt: f.world.updatedAt || ''
      });
    } catch {}
  }
  worlds.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  return worlds;
}

function createWorld({ name, worldview }) {
  const now = new Date().toISOString();
  return {
    version: 2,
    world: {
      id: genId('w_'),
      name,
      worldview: worldview || '',
      createdAt: now,
      updatedAt: now
    },
    worldlines: [{
      id: genId('l_'),
      name: '主线',
      parentId: null,
      branchFromSeq: null,
      createdAt: now,
      updatedAt: now,
      currentState: { worldTime: '', worldStatus: '', outlineCursorId: null },
      characters: [],
      outline: [],
      relationships: [],
      timeline: []
    }]
  };
}

function deleteWorld(id) {
  if (!isValidId(id)) return;
  try {
    fs.unlinkSync(worldPath(id));
  } catch {}
  let names = [];
  try {
    names = fs.readdirSync(BACKUPS_DIR);
  } catch {}
  for (const n of names) {
    if (n.startsWith(id + '_')) {
      try { fs.unlinkSync(path.join(BACKUPS_DIR, n)); } catch {}
    }
  }
}

// 推进前备份（每个世界保留最近 10 份）
function backupWorld(file) {
  ensureDirs();
  // 序号取所有世界线的最大章节数 + 1，避免分支推进与主线推进的备份名碰撞
  let maxLen = 0;
  if (Array.isArray(file.worldlines) && file.worldlines.length) {
    maxLen = Math.max(...file.worldlines.map(w => (w.timeline || []).length));
  } else {
    maxLen = (file.timeline || []).length;
  }
  const seq = maxLen + 1;
  try {
    atomicWrite(path.join(BACKUPS_DIR, `${file.world.id}_${seq}.json`), file);
  } catch (e) {
    console.error('[store] 备份失败:', e.message);
  }
  let names = [];
  try {
    names = fs.readdirSync(BACKUPS_DIR);
  } catch {}
  const mine = names
    .filter(n => n.startsWith(file.world.id + '_'))
    .sort((a, b) => {
      const na = Number((a.match(/_(\d+)\.json$/) || [])[1] || 0);
      const nb = Number((b.match(/_(\d+)\.json$/) || [])[1] || 0);
      return nb - na;
    });
  for (const n of mine.slice(10)) {
    try { fs.unlinkSync(path.join(BACKUPS_DIR, n)); } catch {}
  }
}

module.exports = {
  ensureDirs, genId, isValidId,
  loadSettings, saveSettings,
  getWorldFile, saveWorldFile, listWorlds, createWorld, deleteWorld, backupWorld
};
