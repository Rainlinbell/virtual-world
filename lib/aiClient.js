// OpenAI 兼容 API 客户端（GLM / DeepSeek / OpenAI / Ollama 等）
function baseUrl(aiConf) {
  return String(aiConf.baseUrl || '').replace(/\/+$/, '');
}

function buildHeaders(aiConf) {
  const headers = { 'Content-Type': 'application/json' };
  if (aiConf.apiKey) headers['Authorization'] = `Bearer ${aiConf.apiKey}`;
  return headers;
}

function aiError(message) {
  const err = new Error(message);
  err.status = 502;
  return err;
}

// 调用 /chat/completions，返回文本内容
async function chatCompletion(messages, aiConf) {
  const url = baseUrl(aiConf) + '/chat/completions';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), aiConf.timeoutMs || 240000);
  let resp;
  try {
    resp = await fetch(url, {
      method: 'POST',
      headers: buildHeaders(aiConf),
      body: JSON.stringify({
        model: aiConf.model,
        messages,
        temperature: aiConf.temperature ?? 0.8,
        max_tokens: aiConf.maxTokens || 8192
      }),
      signal: controller.signal
    });
  } catch (e) {
    if (e.name === 'AbortError') {
      throw aiError(`AI 接口请求超时（${Math.round((aiConf.timeoutMs || 240000) / 1000)} 秒），可在设置中调大超时时间`);
    }
    throw aiError(`无法连接 AI 接口：${e.cause?.message || e.message}`);
  } finally {
    clearTimeout(timer);
  }

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    let hint = '';
    if (resp.status === 401 || resp.status === 403) hint = '（apiKey 可能无效）';
    if (resp.status === 404) hint = '（请检查 baseUrl 是否正确，通常以 /v1 结尾）';
    throw aiError(`AI 接口返回 ${resp.status}${hint}：${text.slice(0, 300)}`);
  }

  const data = await resp.json().catch(() => null);
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) {
    throw aiError('AI 返回内容为空');
  }
  return content;
}

// 连通性测试：GET /models，检查延迟与模型是否存在
async function testConnection(aiConf) {
  const start = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const resp = await fetch(baseUrl(aiConf) + '/models', {
      headers: buildHeaders(aiConf),
      signal: controller.signal
    });
    const latencyMs = Date.now() - start;
    if (!resp.ok) {
      let hint = '';
      if (resp.status === 401 || resp.status === 403) hint = '（apiKey 可能无效）';
      return { ok: false, latencyMs, message: `接口返回 ${resp.status}${hint}` };
    }
    const data = await resp.json().catch(() => null);
    const models = Array.isArray(data?.data) ? data.data.map(m => m.id).filter(Boolean) : [];
    return {
      ok: true,
      latencyMs,
      modelCount: models.length,
      modelExists: models.length ? models.includes(aiConf.model) : null,
      message: '连接成功'
    };
  } catch (e) {
    if (e.name === 'AbortError') return { ok: false, message: '连接超时（15 秒）' };
    return { ok: false, message: `连接失败：${e.cause?.message || e.message}` };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { chatCompletion, testConnection };
