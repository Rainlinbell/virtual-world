// 设置路由：读写 + 连通性测试
const express = require('express');
const store = require('../lib/store');
const aiClient = require('../lib/aiClient');

const router = express.Router();

router.get('/', (req, res) => {
  res.json(store.loadSettings());
});

router.put('/', (req, res) => {
  const s = store.loadSettings();
  const b = req.body || {};
  if (b.ai && typeof b.ai === 'object') {
    for (const k of ['baseUrl', 'apiKey', 'model']) {
      if (b.ai[k] !== undefined) s.ai[k] = String(b.ai[k]).trim();
    }
    for (const k of ['temperature', 'maxTokens', 'timeoutMs']) {
      if (b.ai[k] !== undefined && b.ai[k] !== '') s.ai[k] = Number(b.ai[k]);
    }
  }
  if (b.advance && typeof b.advance === 'object') {
    for (const k of ['recentTimelineCount', 'maxRetries']) {
      if (b.advance[k] !== undefined && b.advance[k] !== '') s.advance[k] = Number(b.advance[k]);
    }
  }
  store.saveSettings(s);
  res.json(s);
});

// 测试连通性：可传未保存的表单值，也可测已保存配置
router.post('/test', async (req, res) => {
  const saved = store.loadSettings();
  const b = req.body || {};
  const conf = { ...saved.ai };
  if (b.baseUrl !== undefined) conf.baseUrl = String(b.baseUrl).trim();
  if (b.apiKey !== undefined) conf.apiKey = String(b.apiKey).trim();
  if (b.model !== undefined) conf.model = String(b.model).trim();
  if (!conf.baseUrl || !conf.model) {
    return res.json({ ok: false, message: '请先填写接口地址（baseUrl）和模型名称（model）' });
  }
  const result = await aiClient.testConnection(conf);
  res.json(result);
});

module.exports = router;
