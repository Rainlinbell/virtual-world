// 世界 / 人物 / 大纲路由 + 世界线推进
const express = require('express');
const store = require('../lib/store');
const advance = require('../lib/advance');

const router = express.Router();
const OUTLINE_STATUS = ['pending', 'active', 'done', 'skipped'];

function notFound(res) {
  res.status(404).json({ error: '世界不存在' });
  return null;
}

function touch(file) {
  file.world.updatedAt = new Date().toISOString();
}

// ---------- 世界 ----------
router.get('/', (req, res) => {
  res.json(store.listWorlds());
});

router.post('/', (req, res) => {
  const name = String((req.body || {}).name || '').trim();
  if (!name) return res.status(400).json({ error: '世界名称不能为空' });
  const file = store.createWorld({
    name,
    worldview: String((req.body || {}).worldview || '')
  });
  store.saveWorldFile(file);
  res.status(201).json(file);
});

router.get('/:id', (req, res) => {
  const file = store.getWorldFile(req.params.id);
  if (!file) return notFound(res);
  res.json(file);
});

router.put('/:id', (req, res) => {
  const file = store.getWorldFile(req.params.id);
  if (!file) return notFound(res);
  const b = req.body || {};
  if (b.name !== undefined) {
    const name = String(b.name).trim();
    if (!name) return res.status(400).json({ error: '世界名称不能为空' });
    file.world.name = name;
  }
  if (b.worldview !== undefined) file.world.worldview = String(b.worldview);
  if (b.currentState && typeof b.currentState === 'object') {
    if (b.currentState.worldTime !== undefined) {
      file.world.currentState.worldTime = String(b.currentState.worldTime);
    }
    if (b.currentState.worldStatus !== undefined) {
      file.world.currentState.worldStatus = String(b.currentState.worldStatus);
    }
  }
  touch(file);
  store.saveWorldFile(file);
  res.json(file);
});

router.delete('/:id', (req, res) => {
  const file = store.getWorldFile(req.params.id);
  if (!file) return notFound(res);
  store.deleteWorld(file.world.id);
  res.json({ ok: true });
});

// ---------- 人物 ----------
router.post('/:id/characters', (req, res) => {
  const file = store.getWorldFile(req.params.id);
  if (!file) return notFound(res);
  const b = req.body || {};
  const name = String(b.name || '').trim();
  if (!name) return res.status(400).json({ error: '人物名称不能为空' });
  const s = b.status || {};
  const ch = {
    id: store.genId('c_'),
    name,
    role: String(b.role || '').trim(),
    description: String(b.description || ''),
    status: {
      alive: s.alive !== false,
      condition: String(s.condition || ''),
      location: String(s.location || ''),
      abilities: String(s.abilities || ''),
      notes: String(s.notes || '')
    },
    updatedAt: new Date().toISOString()
  };
  file.characters.push(ch);
  touch(file);
  store.saveWorldFile(file);
  res.status(201).json(ch);
});

router.put('/:id/characters/:cid', (req, res) => {
  const file = store.getWorldFile(req.params.id);
  if (!file) return notFound(res);
  const ch = file.characters.find(c => c.id === req.params.cid);
  if (!ch) return res.status(404).json({ error: '人物不存在' });
  const b = req.body || {};
  if (b.name !== undefined) {
    const name = String(b.name).trim();
    if (!name) return res.status(400).json({ error: '人物名称不能为空' });
    ch.name = name;
  }
  if (b.role !== undefined) ch.role = String(b.role).trim();
  if (b.description !== undefined) ch.description = String(b.description);
  if (b.status && typeof b.status === 'object') {
    const s = b.status;
    if (s.alive !== undefined) ch.status.alive = s.alive === true || s.alive === 'true';
    for (const k of ['condition', 'location', 'abilities', 'notes']) {
      if (s[k] !== undefined) ch.status[k] = String(s[k]);
    }
  }
  ch.updatedAt = new Date().toISOString();
  touch(file);
  store.saveWorldFile(file);
  res.json(ch);
});

router.delete('/:id/characters/:cid', (req, res) => {
  const file = store.getWorldFile(req.params.id);
  if (!file) return notFound(res);
  const i = file.characters.findIndex(c => c.id === req.params.cid);
  if (i === -1) return res.status(404).json({ error: '人物不存在' });
  file.characters.splice(i, 1);
  touch(file);
  store.saveWorldFile(file);
  res.json({ ok: true });
});

// ---------- 大纲 ----------
function normalizeOutline(file) {
  file.outline.sort((a, b) => (a.order || 0) - (b.order || 0));
  file.outline.forEach((n, i) => { n.order = i + 1; });
}

router.post('/:id/outline', (req, res) => {
  const file = store.getWorldFile(req.params.id);
  if (!file) return notFound(res);
  const b = req.body || {};
  const title = String(b.title || '').trim();
  if (!title) return res.status(400).json({ error: '大纲标题不能为空' });
  const afterIdx = b.afterId ? file.outline.findIndex(n => n.id === b.afterId) : -1;
  const node = {
    id: store.genId('n_'),
    order: afterIdx >= 0 ? afterIdx + 2 : file.outline.length + 1,
    title,
    content: String(b.content || ''),
    status: 'pending'
  };
  if (afterIdx >= 0) file.outline.splice(afterIdx + 1, 0, node);
  else file.outline.push(node);
  normalizeOutline(file);
  touch(file);
  store.saveWorldFile(file);
  res.status(201).json(node);
});

router.put('/:id/outline/:nid', (req, res) => {
  const file = store.getWorldFile(req.params.id);
  if (!file) return notFound(res);
  const node = file.outline.find(n => n.id === req.params.nid);
  if (!node) return res.status(404).json({ error: '大纲节点不存在' });
  const b = req.body || {};
  if (b.title !== undefined) {
    const title = String(b.title).trim();
    if (!title) return res.status(400).json({ error: '大纲标题不能为空' });
    node.title = title;
  }
  if (b.content !== undefined) node.content = String(b.content);
  if (b.status !== undefined) {
    if (!OUTLINE_STATUS.includes(b.status)) return res.status(400).json({ error: '无效的大纲状态' });
    node.status = b.status;
  }
  touch(file);
  store.saveWorldFile(file);
  res.json(node);
});

router.delete('/:id/outline/:nid', (req, res) => {
  const file = store.getWorldFile(req.params.id);
  if (!file) return notFound(res);
  const i = file.outline.findIndex(n => n.id === req.params.nid);
  if (i === -1) return res.status(404).json({ error: '大纲节点不存在' });
  file.outline.splice(i, 1);
  normalizeOutline(file);
  if (file.world.currentState.outlineCursorId === req.params.nid) {
    file.world.currentState.outlineCursorId = null;
  }
  touch(file);
  store.saveWorldFile(file);
  res.json({ ok: true });
});

// ---------- 人物关系 ----------
const REL_TYPES = ['ally', 'enemy', 'kin', 'lover', 'master', 'other'];

function validateRelTargets(file, fromId, toId, res) {
  if (!fromId || !toId) {
    res.status(400).json({ error: '请选择两个人物' });
    return false;
  }
  if (fromId === toId) {
    res.status(400).json({ error: '不能与自身建立关系' });
    return false;
  }
  if (!file.characters.some(c => c.id === fromId) ||
      !file.characters.some(c => c.id === toId)) {
    res.status(400).json({ error: '所选人物不存在' });
    return false;
  }
  return true;
}

router.post('/:id/relationships', (req, res) => {
  const file = store.getWorldFile(req.params.id);
  if (!file) return notFound(res);
  const b = req.body || {};
  if (!validateRelTargets(file, b.fromId, b.toId, res)) return;
  const dup = file.relationships.find(r =>
    (r.fromId === b.fromId && r.toId === b.toId) ||
    (r.fromId === b.toId && r.toId === b.fromId));
  if (dup) return res.status(400).json({ error: '这两个人物之间已存在关系，请直接编辑' });
  const rel = {
    id: store.genId('r_'),
    fromId: b.fromId,
    toId: b.toId,
    type: REL_TYPES.includes(b.type) ? b.type : 'other',
    label: String(b.label || '').trim()
  };
  file.relationships.push(rel);
  touch(file);
  store.saveWorldFile(file);
  res.status(201).json(rel);
});

router.put('/:id/relationships/:rid', (req, res) => {
  const file = store.getWorldFile(req.params.id);
  if (!file) return notFound(res);
  const rel = file.relationships.find(r => r.id === req.params.rid);
  if (!rel) return res.status(404).json({ error: '关系不存在' });
  const b = req.body || {};
  const fromId = b.fromId !== undefined ? b.fromId : rel.fromId;
  const toId = b.toId !== undefined ? b.toId : rel.toId;
  if (!validateRelTargets(file, fromId, toId, res)) return;
  const dup = file.relationships.find(r => r.id !== rel.id &&
    ((r.fromId === fromId && r.toId === toId) || (r.fromId === toId && r.toId === fromId)));
  if (dup) return res.status(400).json({ error: '这两个人物之间已存在其他关系' });
  rel.fromId = fromId;
  rel.toId = toId;
  if (b.type !== undefined) {
    if (!REL_TYPES.includes(b.type)) return res.status(400).json({ error: '无效的关系类型' });
    rel.type = b.type;
  }
  if (b.label !== undefined) rel.label = String(b.label).trim();
  touch(file);
  store.saveWorldFile(file);
  res.json(rel);
});

router.delete('/:id/relationships/:rid', (req, res) => {
  const file = store.getWorldFile(req.params.id);
  if (!file) return notFound(res);
  const i = file.relationships.findIndex(r => r.id === req.params.rid);
  if (i === -1) return res.status(404).json({ error: '关系不存在' });
  file.relationships.splice(i, 1);
  touch(file);
  store.saveWorldFile(file);
  res.json({ ok: true });
});

// ---------- 世界线推进 ----------
router.post('/:id/advance', async (req, res) => {
  const file = store.getWorldFile(req.params.id);
  if (!file) return notFound(res);

  const settings = store.loadSettings();
  if (!settings.ai.baseUrl || !settings.ai.model) {
    return res.status(400).json({ error: '尚未配置 AI 服务，请先到设置页完成配置' });
  }
  if (advance.isAdvancing(file.world.id)) {
    return res.status(409).json({ error: '该世界正在推进中，请等待本次推演完成' });
  }

  advance.markAdvancing(file.world.id);
  try {
    const directorNote = String((req.body || {}).directorNote || '').trim();
    store.backupWorld(file); // 推进前快照
    const result = await advance.runAdvance(file, directorNote, settings);
    store.saveWorldFile(result.worldFile);
    res.json(result);
  } catch (e) {
    console.error('[advance] 推进失败:', e.message);
    res.status(e.status || 500).json({ error: e.message });
  } finally {
    advance.unmarkAdvancing(file.world.id);
  }
});

module.exports = router;
