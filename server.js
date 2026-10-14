// 世界线收束器 — 服务入口
const express = require('express');
const path = require('path');
const store = require('./lib/store');

const app = express();
store.ensureDirs();

app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/worlds', require('./routes/worlds'));

app.use('/api', (req, res) => res.status(404).json({ error: '接口不存在' }));

app.use(express.static(path.join(__dirname, 'public')));

// 统一错误处理
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: '请求体不是合法 JSON' });
  }
  console.error('[server]', err);
  res.status(500).json({ error: '服务器内部错误：' + err.message });
});

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  console.log(`世界线收束器已启动: http://localhost:${PORT}`);
});

// 世界线推进是长请求（AI 生成可能超过 5 分钟），关闭默认 300s 请求超时
server.requestTimeout = 0;
