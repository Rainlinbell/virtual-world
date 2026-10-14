// 世界线推进引擎：prompt 组装 → AI 调用 → 解析容错 → 状态合并
const aiClient = require('./aiClient');
const { extractJson, coerceAdvanceResult } = require('./jsonUtils');
const store = require('./store');

const SYSTEM_PROMPT = `你是一个虚拟世界的叙事引擎（游戏主持人 GM），负责连载一部网络小说。你的任务是根据给定的世界观、剧情大纲、人物当前状态和历史章节，将世界线推进到下一个阶段，并写出下一章小说正文。

规则：
1. 叙事必须严格符合世界观设定，延续既有历史，不得自相矛盾，不得重复描写已发生的事。
2. 人物的生死、状态、位置等既有事实必须被尊重；只有合理的剧情才能改变它们。
3. 若提供了【导演指令】，本次推进必须优先贯彻该指令；没有则按剧情大纲自然推进。
4. 本次输出是一整章网络小说：中文、第三人称，文风贴近网络小说（场景与氛围描写、人物对话、节奏张弛、章末留下悬念钩子）。正文 2000~3000 字（不得少于 2000 字），自然段之间用 \\n\\n 分隔。
5. 世界时间推进要合理（可以是一夜、数月或数年），并给出推进后的完整世界时间。
6. 为本章取一个网络小说风格的章节标题（4~20 字，如「血染青云」「夜袭黑风寨」），放入 chapterTitle 字段；标题中不要出现「第 N 章」字样，章节号由系统生成。
7. 输出格式：只输出一个合法的 JSON 对象。不要输出任何解释性文字，不要用 Markdown 代码块包裹，不要输出 JSON 之外的任何内容。

JSON 结构定义（所有字符串值均为中文）：
{
  "chapterTitle": "本章标题",
  "narrative": "本章小说正文，自然段之间用 \\n\\n 分隔",
  "events": ["关键事件1（一句话）", "关键事件2"],
  "timeAdvanced": "本次时间推进量，如：三个月后",
  "worldTime": "推进后的世界时间（完整表述）",
  "worldStatus": "推进后的世界局势一句话概括",
  "characterUpdates": [
    { "id": "人物id（若已知）", "name": "人物名", "alive": true,
      "condition": "最新状态（若有变化）", "location": "最新位置（若有变化）",
      "abilities": "能力变化（若有）", "notes": "其他值得记录的变化（若有）" }
  ],
  "newCharacters": [
    { "name": "新登场人物名", "role": "定位", "description": "简介",
      "condition": "当前状态", "location": "当前位置" }
  ],
  "relationshipUpdates": [
    { "fromName": "人物甲", "toName": "人物乙", "type": "enemy", "label": "关系描述", "action": "add" }
  ],
  "outlineUpdate": { "completedNodeId": "本阶段完成的大纲节点id", "currentNodeId": "当前进行到的大纲节点id" }
}

注意：characterUpdates 只包含本次状态发生变化的人物；新登场人物放入 newCharacters；relationshipUpdates 的 type 必须是 ally(盟友)/enemy(敌对)/kin(亲缘)/lover(情缘)/master(师徒)/other(其他) 之一，action 必须是 add(新增)/update(变化)/remove(解除) 之一，仅当本次推演中人物关系发生变化时才输出；只有当本次推进完成或推进了某个大纲节点时才输出 outlineUpdate（否则省略整个 outlineUpdate 字段）。`;

const STATUS_LABEL = { condition: '状态', location: '位置', abilities: '能力', notes: '备注' };
const REL_TYPE_LABEL = { ally: '盟友', enemy: '敌对', kin: '亲缘', lover: '情缘', master: '师徒', other: '其他' };

// 推进锁（防同一世界重复提交）
const advancing = new Set();
function isAdvancing(id) { return advancing.has(id); }
function markAdvancing(id) { advancing.add(id); }
function unmarkAdvancing(id) { advancing.delete(id); }

// 组装用户消息
function buildPrompt(file, settings, directorNote) {
  const { world, characters, outline, timeline } = file;
  const parts = [];

  parts.push(`【世界观】\n${world.worldview || '（暂无设定）'}`);

  if (outline.length) {
    const mark = { pending: '○', active: '▶', done: '✓', skipped: '-' };
    const nodes = outline.slice().sort((a, b) => (a.order || 0) - (b.order || 0));
    const lines = nodes.map((n, i) =>
      `${i + 1}. [id:${n.id}][${mark[n.status] || '○'}] ${n.title} —— 要点：${n.content || '（无）'}`);
    parts.push(`【剧情大纲】（○未开始 ▶进行中 ✓已完成 -已跳过）\n${lines.join('\n')}`);
  }

  if (characters.length) {
    const lines = characters.map(c => {
      const s = c.status;
      let line = `- [id:${c.id}] ${c.name}（${c.role || '未定位'}）｜${s.alive ? '存活' : '已死亡'}｜状态：${s.condition || '正常'}｜位置：${s.location || '未知'}｜能力：${s.abilities || '未知'}`;
      if (s.notes) line += `｜备注：${s.notes}`;
      if (c.description) line += `｜设定：${c.description}`;
      return line;
    });
    parts.push(`【人物当前状态】\n${lines.join('\n')}`);
  }

  if (file.relationships && file.relationships.length && characters.length) {
    const nameOf = (id) => {
      const c = characters.find(x => x.id === id);
      return c ? c.name : '未知人物';
    };
    const lines = file.relationships.map(r =>
      `- ${nameOf(r.fromId)} —[${r.label || REL_TYPE_LABEL[r.type] || '其他'}]— ${nameOf(r.toId)}`);
    parts.push(`【人物关系】\n${lines.join('\n')}`);
  }

  const recent = timeline.slice(-(settings.advance.recentTimelineCount || 20));
  if (recent.length) {
    const lines = recent.map(e =>
      `第${e.chapterNo || e.seq}章${e.chapterTitle ? '《' + e.chapterTitle + '》' : ''} [${e.worldTime}] ${e.events.join('；')}`);
    parts.push(`【历史章节概要】（最近 ${recent.length} 章，最旧在前）\n${lines.join('\n')}`);
  }

  const last = timeline[timeline.length - 1];
  if (last) {
    parts.push(`【上一章全文】\n${last.narrative}`);
  }

  const nextChapter = last ? last.seq + 1 : 1;
  parts.push(`【导演指令】\n${directorNote && directorNote.trim() ? directorNote.trim() : '（无，请按大纲自然推进）'}`);
  parts.push(`请写下第 ${nextChapter} 章（正文 2000~3000 字，不得少于 2000 字），只输出 JSON。`);
  return parts.join('\n\n');
}

// 章节正文字数要求：2000~3000 字，不足 2000 字视为不合格并回喂重试
const MIN_CHAPTER_CHARS = 2000;
const charCount = (s) => s.replace(/\s/g, '').length;

// 执行推进：调 AI → 解析容错 → 合并，返回 { entry, worldFile }
async function runAdvance(file, directorNote, settings) {
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: buildPrompt(file, settings, directorNote) }
  ];
  const maxAttempts = (settings.advance.maxRetries || 0) + 1;
  let result = null;
  let lastErr = null;
  let lastRaw = '';

  for (let i = 0; i < maxAttempts; i++) {
    const raw = await aiClient.chatCompletion(messages, settings.ai);
    lastRaw = raw;
    try {
      const r = coerceAdvanceResult(extractJson(raw));
      const chars = charCount(r.narrative);
      if (chars < MIN_CHAPTER_CHARS && i < maxAttempts - 1) {
        lastErr = new Error(`正文仅 ${chars} 字，少于 ${MIN_CHAPTER_CHARS} 字`);
        messages.push({ role: 'assistant', content: raw.slice(0, 2000) });
        messages.push({
          role: 'user',
          content: `你输出的正文只有 ${chars} 字。本章要求 2000~3000 字（不得少于 2000 字）。请扩写正文后重新输出完整的 JSON 对象，不要任何多余文本。`
        });
        continue;
      }
      result = r;
      break;
    } catch (e) {
      lastErr = e;
      if (i < maxAttempts - 1) {
        messages.push({ role: 'assistant', content: raw.slice(0, 2000) });
        messages.push({
          role: 'user',
          content: `你上次的输出无法解析为合法 JSON（错误：${e.message}）。请重新输出，只输出一个合法的 JSON 对象，不要任何多余文本。`
        });
      }
    }
  }

  if (!result) {
    const err = new Error(`AI 输出解析失败：${lastErr ? lastErr.message : '未知错误'}。原始输出摘录：${lastRaw.slice(0, 500)}`);
    err.status = 502;
    throw err;
  }

  return mergeResult(file, result, directorNote);
}

// 将推进结果合并进世界状态（就地修改 file）
function mergeResult(file, result, directorNote) {
  const warnings = [];
  const characterChanges = [];
  const now = new Date().toISOString();

  const findChar = (u) => {
    if (u.id) {
      const byId = file.characters.find(c => c.id === u.id);
      if (byId) return byId;
    }
    const name = String(u.name || '').trim();
    if (!name) return null;
    return file.characters.find(c => c.name.trim() === name);
  };

  // 已有人物更新（先按 id 匹配，再按名字匹配）
  for (const u of result.characterUpdates) {
    const ch = findChar(u);
    if (!ch) {
      warnings.push(`AI 提到的人物「${u.name || u.id}」未匹配到已有角色，已忽略`);
      continue;
    }
    const changes = {};
    if (typeof u.alive === 'boolean' && u.alive !== ch.status.alive) {
      changes['存活'] = `${ch.status.alive ? '存活' : '死亡'} → ${u.alive ? '存活' : '死亡'}`;
      ch.status.alive = u.alive;
    }
    for (const key of ['condition', 'location', 'abilities', 'notes']) {
      const v = u[key];
      if (typeof v === 'string' && v && v !== ch.status[key]) {
        changes[STATUS_LABEL[key]] = ch.status[key] ? `${ch.status[key]} → ${v}` : v;
        ch.status[key] = v;
      }
    }
    if (Object.keys(changes).length) {
      characterChanges.push({ characterId: ch.id, name: ch.name, changes });
      ch.updatedAt = now;
    }
  }

  // 新人物登场
  for (const nc of result.newCharacters) {
    const dup = file.characters.find(c => c.name.trim() === nc.name);
    if (dup) {
      warnings.push(`新人物「${nc.name}」与已有角色重名，已忽略`);
      continue;
    }
    const ch = {
      id: store.genId('c_'),
      name: nc.name,
      role: nc.role || '配角',
      description: nc.description || '',
      status: { alive: true, condition: nc.condition || '', location: nc.location || '', abilities: '', notes: '' },
      updatedAt: now
    };
    file.characters.push(ch);
    characterChanges.push({
      characterId: ch.id,
      name: ch.name,
      changes: { '登场': nc.role ? `新人物（${nc.role}）` : '新人物' }
    });
  }

  // 人物关系变化（先按 id 匹配，再按名字匹配）
  const relChanges = [];
  const findCharFor = (id, name) => {
    if (id) {
      const byId = file.characters.find(c => c.id === id);
      if (byId) return byId;
    }
    return file.characters.find(c => c.name.trim() === String(name || '').trim());
  };
  for (const ru of result.relationshipUpdates) {
    const from = findCharFor(ru.fromId, ru.fromName);
    const to = findCharFor(ru.toId, ru.toName);
    if (!from || !to) {
      warnings.push(`AI 提到的人物「${!from ? ru.fromName : ru.toName}」未匹配到已有角色，关系变化已忽略`);
      continue;
    }
    if (from.id === to.id) continue;
    const idx = file.relationships.findIndex(r =>
      (r.fromId === from.id && r.toId === to.id) ||
      (r.fromId === to.id && r.toId === from.id));
    if (ru.action === 'remove') {
      if (idx !== -1) {
        const [old] = file.relationships.splice(idx, 1);
        relChanges.push({ action: 'remove', from: from.name, to: to.name, type: old.type, label: old.label });
      }
    } else if (idx !== -1) {
      const rel = file.relationships[idx];
      rel.type = ru.type;
      if (ru.label) rel.label = ru.label;
      relChanges.push({ action: 'update', from: from.name, to: to.name, type: rel.type, label: rel.label });
    } else {
      const rel = { id: store.genId('r_'), fromId: from.id, toId: to.id, type: ru.type, label: ru.label || '' };
      file.relationships.push(rel);
      relChanges.push({ action: 'add', from: from.name, to: to.name, type: rel.type, label: rel.label });
    }
  }

  // 大纲状态流转
  if (result.outlineUpdate) {
    const { completedNodeId, currentNodeId } = result.outlineUpdate;
    if (completedNodeId) {
      const node = file.outline.find(n => n.id === completedNodeId);
      if (node) node.status = 'done';
      else warnings.push(`AI 指定完成的大纲节点 ${completedNodeId} 不存在，已忽略`);
    }
    if (currentNodeId !== undefined) {
      if (currentNodeId === null) {
        file.world.currentState.outlineCursorId = null;
      } else {
        const node = file.outline.find(n => n.id === currentNodeId);
        if (node) {
          node.status = 'active';
          file.world.currentState.outlineCursorId = currentNodeId;
        } else {
          warnings.push(`AI 指定的大纲节点 ${currentNodeId} 不存在，已忽略`);
        }
      }
    }
  }

  // 章节条目
  const seq = file.timeline.length ? file.timeline[file.timeline.length - 1].seq + 1 : 1;
  const chars = charCount(result.narrative);
  if (chars < MIN_CHAPTER_CHARS) {
    warnings.push(`本章正文仅 ${chars} 字（目标 2000~3000 字），可在导演指令中要求扩写`);
  }
  const entry = {
    id: store.genId('t_'),
    seq,
    chapterNo: seq,
    chapterTitle: result.chapterTitle || '',
    worldTime: result.worldTime,
    timeAdvanced: result.timeAdvanced,
    narrative: result.narrative,
    events: result.events,
    characterChanges,
    relationshipChanges: relChanges,
    directorNote: directorNote || '',
    warnings,
    createdAt: now
  };
  file.timeline.push(entry);
  file.world.currentState.worldTime = result.worldTime;
  if (result.worldStatus) file.world.currentState.worldStatus = result.worldStatus;
  file.world.updatedAt = now;
  return { entry, worldFile: file };
}

module.exports = { runAdvance, buildPrompt, isAdvancing, markAdvancing, unmarkAdvancing };
