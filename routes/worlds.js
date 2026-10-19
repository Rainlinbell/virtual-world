// 世界 / 人物 / 大纲 / 世界线路由 + 世界线推进
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

// 解析 ?worldline= 参数：缺省取主线（第一条），显式传了但找不到时 404
function getWorldline(file, id, res) {
  const wls = file.worldlines || [];
  if (!id) return wls[0] || null;
  const wl = wls.find(w => w.id === id);
  if (!wl && res) res.status(404).json({ error: '世界线不存在' });
  return wl || null;
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

// ---------- 人物（作用于指定世界线，?worldline= 缺省为主线） ----------
router.post('/:id/characters', (req, res) => {
  const file = store.getWorldFile(req.params.id);
  if (!file) return notFound(res);
  const wl = getWorldline(file, req.query.worldline, res);
  if (!wl) return;
  const b = req.body || {};
  const name = String(b.name || '').trim();
  if (!name) return res.status(400).json({ error: '人物名称不能为空' });
  const s = b.status || {};
  const ch = {
    id: store.genId('c_'),
    name,
    role: String(b.role || '').trim(),
    description: String(b.description || ''),
    important: b.important === true || b.important === 'true',
    status: {
      alive: s.alive !== false,
      condition: String(s.condition || ''),
      location: String(s.location || ''),
      abilities: String(s.abilities || ''),
      notes: String(s.notes || '')
    },
    updatedAt: new Date().toISOString()
  };
  wl.characters.push(ch);
  touch(file);
  store.saveWorldFile(file);
  res.status(201).json(ch);
});

router.put('/:id/characters/:cid', (req, res) => {
  const file = store.getWorldFile(req.params.id);
  if (!file) return notFound(res);
  const wl = getWorldline(file, req.query.worldline, res);
  if (!wl) return;
  const ch = wl.characters.find(c => c.id === req.params.cid);
  if (!ch) return res.status(404).json({ error: '人物不存在' });
  const b = req.body || {};
  if (b.name !== undefined) {
    const name = String(b.name).trim();
    if (!name) return res.status(400).json({ error: '人物名称不能为空' });
    ch.name = name;
  }
  if (b.role !== undefined) ch.role = String(b.role).trim();
  if (b.description !== undefined) ch.description = String(b.description);
  if (b.important !== undefined) ch.important = b.important === true || b.important === 'true';
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
  const wl = getWorldline(file, req.query.worldline, res);
  if (!wl) return;
  const i = wl.characters.findIndex(c => c.id === req.params.cid);
  if (i === -1) return res.status(404).json({ error: '人物不存在' });
  wl.characters.splice(i, 1);
  touch(file);
  store.saveWorldFile(file);
  res.json({ ok: true });
});

// ---------- 大纲（作用于指定世界线） ----------
function normalizeOutline(wl) {
  wl.outline.sort((a, b) => (a.order || 0) - (b.order || 0));
  wl.outline.forEach((n, i) => { n.order = i + 1; });
}

router.post('/:id/outline', (req, res) => {
  const file = store.getWorldFile(req.params.id);
  if (!file) return notFound(res);
  const wl = getWorldline(file, req.query.worldline, res);
  if (!wl) return;
  const b = req.body || {};
  const title = String(b.title || '').trim();
  if (!title) return res.status(400).json({ error: '大纲标题不能为空' });
  const afterIdx = b.afterId ? wl.outline.findIndex(n => n.id === b.afterId) : -1;
  const node = {
    id: store.genId('n_'),
    order: afterIdx >= 0 ? afterIdx + 2 : wl.outline.length + 1,
    title,
    content: String(b.content || ''),
    status: 'pending'
  };
  if (afterIdx >= 0) wl.outline.splice(afterIdx + 1, 0, node);
  else wl.outline.push(node);
  normalizeOutline(wl);
  touch(file);
  store.saveWorldFile(file);
  res.status(201).json(node);
});

router.put('/:id/outline/:nid', (req, res) => {
  const file = store.getWorldFile(req.params.id);
  if (!file) return notFound(res);
  const wl = getWorldline(file, req.query.worldline, res);
  if (!wl) return;
  const node = wl.outline.find(n => n.id === req.params.nid);
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
  const wl = getWorldline(file, req.query.worldline, res);
  if (!wl) return;
  const i = wl.outline.findIndex(n => n.id === req.params.nid);
  if (i === -1) return res.status(404).json({ error: '大纲节点不存在' });
  wl.outline.splice(i, 1);
  normalizeOutline(wl);
  if (wl.currentState.outlineCursorId === req.params.nid) {
    wl.currentState.outlineCursorId = null;
  }
  touch(file);
  store.saveWorldFile(file);
  res.json({ ok: true });
});

// ---------- 人物关系（作用于指定世界线） ----------
const REL_TYPES = ['ally', 'enemy', 'kin', 'lover', 'master', 'other'];

function validateRelTargets(wl, fromId, toId, res) {
  if (!fromId || !toId) {
    res.status(400).json({ error: '请选择两个人物' });
    return false;
  }
  if (fromId === toId) {
    res.status(400).json({ error: '不能与自身建立关系' });
    return false;
  }
  if (!wl.characters.some(c => c.id === fromId) ||
      !wl.characters.some(c => c.id === toId)) {
    res.status(400).json({ error: '所选人物不存在' });
    return false;
  }
  return true;
}

router.post('/:id/relationships', (req, res) => {
  const file = store.getWorldFile(req.params.id);
  if (!file) return notFound(res);
  const wl = getWorldline(file, req.query.worldline, res);
  if (!wl) return;
  const b = req.body || {};
  if (!validateRelTargets(wl, b.fromId, b.toId, res)) return;
  const dup = wl.relationships.find(r =>
    (r.fromId === b.fromId && r.toId === b.toId) ||
    (r.fromId === b.toId && r.toId === b.fromId));
  if (dup) return res.status(400).json({ error: '这两个人物之间已存在关系，请直接编辑' });
  const rel = {
    id: store.genId('r_'),
    fromId: b.fromId,
    toId: b.toId,
    type: REL_TYPES.includes(b.type) ? b.type : 'other',
    label: String(b.label || '').trim(),
    description: String(b.description || '').trim()
  };
  wl.relationships.push(rel);
  touch(file);
  store.saveWorldFile(file);
  res.status(201).json(rel);
});

router.put('/:id/relationships/:rid', (req, res) => {
  const file = store.getWorldFile(req.params.id);
  if (!file) return notFound(res);
  const wl = getWorldline(file, req.query.worldline, res);
  if (!wl) return;
  const rel = wl.relationships.find(r => r.id === req.params.rid);
  if (!rel) return res.status(404).json({ error: '关系不存在' });
  const b = req.body || {};
  const fromId = b.fromId !== undefined ? b.fromId : rel.fromId;
  const toId = b.toId !== undefined ? b.toId : rel.toId;
  if (!validateRelTargets(wl, fromId, toId, res)) return;
  const dup = wl.relationships.find(r => r.id !== rel.id &&
    ((r.fromId === fromId && r.toId === toId) || (r.fromId === toId && r.toId === fromId)));
  if (dup) return res.status(400).json({ error: '这两个人物之间已存在其他关系' });
  rel.fromId = fromId;
  rel.toId = toId;
  if (b.type !== undefined) {
    if (!REL_TYPES.includes(b.type)) return res.status(400).json({ error: '无效的关系类型' });
    rel.type = b.type;
  }
  if (b.label !== undefined) rel.label = String(b.label).trim();
  if (b.description !== undefined) rel.description = String(b.description).trim();
  touch(file);
  store.saveWorldFile(file);
  res.json(rel);
});

router.delete('/:id/relationships/:rid', (req, res) => {
  const file = store.getWorldFile(req.params.id);
  if (!file) return notFound(res);
  const wl = getWorldline(file, req.query.worldline, res);
  if (!wl) return;
  const i = wl.relationships.findIndex(r => r.id === req.params.rid);
  if (i === -1) return res.status(404).json({ error: '关系不存在' });
  wl.relationships.splice(i, 1);
  touch(file);
  store.saveWorldFile(file);
  res.json({ ok: true });
});

// ---------- 世界线（多线分支） ----------
// 创建分支：复制父世界线截至分支点的章节历史 + 当前人物/关系/大纲状态
router.post('/:id/worldlines', (req, res) => {
  const file = store.getWorldFile(req.params.id);
  if (!file) return notFound(res);
  const b = req.body || {};
  let parent;
  if (b.parentId) {
    // 显式指定父世界线：查不到时 getWorldline 已回 404，直接结束
    parent = getWorldline(file, b.parentId, res);
    if (!parent) return;
  } else {
    parent = (file.worldlines || [])[0];
  }
  if (!parent) return res.status(404).json({ error: '世界线不存在' });
  const name = String(b.name || '').trim();
  if (!name) return res.status(400).json({ error: '世界线名称不能为空' });
  if (file.worldlines.some(w => w.name === name)) {
    return res.status(400).json({ error: '已存在同名世界线，请换一个名称' });
  }
  const maxSeq = parent.timeline.length ? parent.timeline[parent.timeline.length - 1].seq : 0;
  let branchFromSeq = Number(b.branchFromSeq);
  if (!Number.isInteger(branchFromSeq) || branchFromSeq < 1) branchFromSeq = maxSeq;
  if (branchFromSeq > maxSeq) branchFromSeq = maxSeq;
  // 分支继承「分支点章节结束时」的状态：从该章快照回取人物/关系/大纲/局势；
  // 历史章节无快照时回退到世界线当前最新状态（响应中 fallbackToCurrent=true 供前端提示）
  const point = branchFromSeq > 0 ? parent.timeline.find(e => e.seq === branchFromSeq) : null;
  const snap = point && point.snapshot &&
    Array.isArray(point.snapshot.characters) &&
    Array.isArray(point.snapshot.relationships) &&
    Array.isArray(point.snapshot.outline) &&
    point.snapshot.currentState ? point.snapshot : null;
  const base = snap || parent;
  const now = new Date().toISOString();
  const wl = {
    id: store.genId('l_'),
    name,
    parentId: parent.id,
    branchFromSeq: maxSeq > 0 ? branchFromSeq : null,
    createdAt: now,
    updatedAt: now,
    currentState: JSON.parse(JSON.stringify(base.currentState)),
    characters: JSON.parse(JSON.stringify(base.characters)),
    relationships: JSON.parse(JSON.stringify(base.relationships)),
    outline: JSON.parse(JSON.stringify(base.outline)),
    timeline: parent.timeline.filter(e => e.seq <= branchFromSeq).map(e => JSON.parse(JSON.stringify(e)))
  };
  file.worldlines.push(wl);
  touch(file);
  store.saveWorldFile(file);
  res.status(201).json({ worldline: wl, usedSnapshot: !!snap, fallbackToCurrent: !!point && !snap });
});

// 重命名世界线
router.put('/:id/worldlines/:lid', (req, res) => {
  const file = store.getWorldFile(req.params.id);
  if (!file) return notFound(res);
  const wl = (file.worldlines || []).find(w => w.id === req.params.lid);
  if (!wl) return res.status(404).json({ error: '世界线不存在' });
  const b = req.body || {};
  if (b.name !== undefined) {
    const name = String(b.name).trim();
    if (!name) return res.status(400).json({ error: '世界线名称不能为空' });
    if (file.worldlines.some(w => w.id !== wl.id && w.name === name)) {
      return res.status(400).json({ error: '已存在同名世界线，请换一个名称' });
    }
    wl.name = name;
  }
  wl.updatedAt = new Date().toISOString();
  touch(file);
  store.saveWorldFile(file);
  res.json(wl);
});

// 删除分支世界线（主线不可删；有衍生分支时不可删）
router.delete('/:id/worldlines/:lid', (req, res) => {
  const file = store.getWorldFile(req.params.id);
  if (!file) return notFound(res);
  if (!file.worldlines || !file.worldlines.length) {
    return res.status(404).json({ error: '世界线不存在' });
  }
  if (file.worldlines[0].id === req.params.lid) {
    return res.status(400).json({ error: '主线世界线不可删除' });
  }
  const i = file.worldlines.findIndex(w => w.id === req.params.lid);
  if (i === -1) return res.status(404).json({ error: '世界线不存在' });
  if (file.worldlines.some(w => w.parentId === req.params.lid)) {
    return res.status(400).json({ error: '该世界线存在衍生分支，请先删除其分支世界线' });
  }
  file.worldlines.splice(i, 1);
  touch(file);
  store.saveWorldFile(file);
  res.json({ ok: true });
});

// ---------- 世界线推进（在指定世界线上推进，?body.worldlineId 缺省为主线） ----------
router.post('/:id/advance', async (req, res) => {
  const file = store.getWorldFile(req.params.id);
  if (!file) return notFound(res);
  const wl = getWorldline(file, (req.body || {}).worldlineId, res);
  if (!wl) return;

  const settings = store.loadSettings();
  if (!settings.ai.baseUrl || !settings.ai.model) {
    return res.status(400).json({ error: '尚未配置 AI 服务，请先到设置页完成配置' });
  }
  if (advance.isAdvancing(file.world.id)) {
    return res.status(409).json({ error: '该世界正在推进中，请等待本次推演完成' });
  }

  // 世界线视图：推进引擎就地修改 wl 内的数组与 currentState
  const view = {
    world: file.world,
    currentState: wl.currentState,
    characters: wl.characters,
    outline: wl.outline,
    relationships: wl.relationships,
    timeline: wl.timeline
  };

  advance.markAdvancing(file.world.id);
  try {
    const directorNote = String((req.body || {}).directorNote || '').trim();
    store.backupWorld(file); // 推进前快照
    const result = await advance.runAdvance(view, directorNote, settings);
    wl.updatedAt = new Date().toISOString();
    store.saveWorldFile(file);
    res.json({ entry: result.entry, worldFile: file });
  } catch (e) {
    console.error('[advance] 推进失败:', e.message);
    res.status(e.status || 500).json({ error: e.message });
  } finally {
    advance.unmarkAdvancing(file.world.id);
  }
});

module.exports = router;
