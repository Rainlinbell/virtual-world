// JSON 提取与类型矫正（纯函数）
const STATUS_KEYS = ['condition', 'location', 'abilities', 'notes'];
const REL_TYPES = ['ally', 'enemy', 'kin', 'lover', 'master', 'other'];
const REL_ACTIONS = ['add', 'update', 'remove'];

// 从 AI 原始输出中提取 JSON 对象（容忍围栏包裹与前后杂文）
function extractJson(raw) {
  if (typeof raw !== 'string' || !raw.trim()) throw new Error('AI 输出为空');
  const text = raw.trim();
  // 1. 直接解析
  try { return JSON.parse(text); } catch {}
  // 2. 剥离 markdown 代码围栏
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fence) {
    try { return JSON.parse(fence[1]); } catch {}
  }
  // 3. 截取首个 { 到最后一个 }
  const s = text.indexOf('{');
  const e = text.lastIndexOf('}');
  if (s !== -1 && e > s) {
    try { return JSON.parse(text.slice(s, e + 1)); } catch {}
  }
  throw new Error('无法从输出中提取 JSON');
}

// 清洗章节标题：去引号与「第N章」前缀，限长
function cleanChapterTitle(v) {
  if (typeof v !== 'string') return '';
  let t = v.trim().replace(/^[「『“"'（(]+|[」』”"'）)]+$/g, '').trim();
  t = t.replace(/^第\s*[0-9０-９一二三四五六七八九十百千]+\s*[章回节卷]\s*/, '');
  return t.slice(0, 40);
}

// 校验并矫正推进结果，失败抛错（触发重试）
function coerceAdvanceResult(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    throw new Error('输出不是 JSON 对象');
  }
  if (typeof obj.narrative !== 'string' || !obj.narrative.trim()) {
    throw new Error('narrative 缺失或为空');
  }
  if (typeof obj.worldTime !== 'string' || !obj.worldTime.trim()) {
    throw new Error('worldTime 缺失或为空');
  }

  const result = {
    chapterTitle: cleanChapterTitle(obj.chapterTitle),
    narrative: obj.narrative.trim(),
    events: Array.isArray(obj.events)
      ? obj.events.filter(x => typeof x === 'string' && x.trim()).map(x => x.trim())
      : [],
    timeAdvanced: typeof obj.timeAdvanced === 'string' ? obj.timeAdvanced.trim() : '',
    worldTime: obj.worldTime.trim(),
    worldStatus: typeof obj.worldStatus === 'string' ? obj.worldStatus.trim() : '',
    characterUpdates: [],
    newCharacters: [],
    relationshipUpdates: [],
    outlineUpdate: null
  };

  if (Array.isArray(obj.characterUpdates)) {
    for (const u of obj.characterUpdates) {
      if (!u || typeof u !== 'object') continue;
      const name = typeof u.name === 'string' ? u.name.trim() : '';
      if (!name && !u.id) continue;
      const upd = { name };
      if (typeof u.id === 'string' && u.id.trim()) upd.id = u.id.trim();
      if (typeof u.alive === 'boolean') upd.alive = u.alive;
      else if (u.alive === 'true') upd.alive = true;
      else if (u.alive === 'false') upd.alive = false;
      for (const k of STATUS_KEYS) {
        if (typeof u[k] === 'string' && u[k].trim()) upd[k] = u[k].trim();
      }
      result.characterUpdates.push(upd);
    }
  }

  if (Array.isArray(obj.newCharacters)) {
    for (const c of obj.newCharacters) {
      if (!c || typeof c !== 'object') continue;
      const name = typeof c.name === 'string' ? c.name.trim() : '';
      if (!name) continue;
      result.newCharacters.push({
        name,
        role: typeof c.role === 'string' ? c.role.trim() : '',
        description: typeof c.description === 'string' ? c.description.trim() : '',
        condition: typeof c.condition === 'string' ? c.condition.trim() : '',
        location: typeof c.location === 'string' ? c.location.trim() : ''
      });
    }
  }

  if (Array.isArray(obj.relationshipUpdates)) {
    for (const ru of obj.relationshipUpdates) {
      if (!ru || typeof ru !== 'object') continue;
      const fromName = typeof ru.fromName === 'string' ? ru.fromName.trim() : '';
      const toName = typeof ru.toName === 'string' ? ru.toName.trim() : '';
      if (!fromName || !toName || fromName === toName) continue;
      const item = { fromName, toName };
      if (typeof ru.fromId === 'string' && ru.fromId.trim()) item.fromId = ru.fromId.trim();
      if (typeof ru.toId === 'string' && ru.toId.trim()) item.toId = ru.toId.trim();
      item.action = REL_ACTIONS.includes(ru.action) ? ru.action : 'add';
      item.type = REL_TYPES.includes(ru.type) ? ru.type : 'other';
      if (typeof ru.label === 'string' && ru.label.trim()) item.label = ru.label.trim();
      result.relationshipUpdates.push(item);
    }
  }

  if (obj.outlineUpdate && typeof obj.outlineUpdate === 'object') {
    const ou = {};
    if (typeof obj.outlineUpdate.completedNodeId === 'string' && obj.outlineUpdate.completedNodeId.trim()) {
      ou.completedNodeId = obj.outlineUpdate.completedNodeId.trim();
    }
    const cn = obj.outlineUpdate.currentNodeId;
    if (cn === null) ou.currentNodeId = null;
    else if (typeof cn === 'string' && cn.trim()) ou.currentNodeId = cn.trim();
    if (Object.keys(ou).length) result.outlineUpdate = ou;
  }

  return result;
}

module.exports = { extractJson, coerceAdvanceResult };
