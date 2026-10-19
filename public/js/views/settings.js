// 设置页：AI 服务配置 + 推演参数
const SettingsView = {
  async render(container) {
    const s = await api.get('/api/settings');

    container.innerHTML = `
      <div class="page">
        <div class="page-head"><h1>设置</h1></div>
        <div class="settings-grid">
          <div class="panel">
            <div class="panel-title">AI 服务（OpenAI 兼容接口）</div>
            <div class="field">
              <label>接口地址 baseUrl</label>
              <input type="text" id="set-baseurl" value="${esc(s.ai.baseUrl)}"
                placeholder="如 https://api.openai.com/v1 或 http://localhost:11434/v1">
              <div class="field-hint">支持 OpenAI / GLM / DeepSeek / Kimi / 本地 Ollama 等兼容接口</div>
            </div>
            <div class="field">
              <label>API Key（本地服务可留空）</label>
              <input type="password" id="set-apikey" value="${esc(s.ai.apiKey)}" placeholder="sk-..." autocomplete="off">
            </div>
            <div class="field">
              <label>模型名称</label>
              <input type="text" id="set-model" value="${esc(s.ai.model)}"
                placeholder="如 glm-4.6 / deepseek-chat / qwen2.5:14b">
            </div>
            <div class="field-row">
              <div class="field">
                <label>温度 temperature（0~2，越高越有创造性）</label>
                <input type="number" id="set-temp" value="${s.ai.temperature}" step="0.1" min="0" max="2">
              </div>
              <div class="field">
                <label>输出上限 max_tokens</label>
                <input type="number" id="set-maxtokens" value="${s.ai.maxTokens}" min="256" max="131072">
                <div class="field-hint">每章正文 2000~3000 字，建议 ≥ 6000；过小会导致章节被截断或过短</div>
              </div>
            </div>
            <div class="field">
              <label>请求超时（毫秒）</label>
              <input type="number" id="set-timeout" value="${s.ai.timeoutMs}" min="5000" max="600000" step="1000">
            </div>
          </div>
          <div class="panel">
            <div class="panel-title">推演参数</div>
            <div class="field">
              <label>编年史回溯条数</label>
              <input type="number" id="set-recent" value="${s.advance.recentTimelineCount}" min="1" max="200">
              <div class="field-hint">注入 prompt 的最近编年史记录数</div>
            </div>
            <div class="field">
              <label>JSON 解析失败重试次数</label>
              <input type="number" id="set-retries" value="${s.advance.maxRetries}" min="0" max="5">
              <div class="field-hint">解析失败或正文字数不足 2000 字时自动重试</div>
            </div>
            <div class="field">
              <label>推进时注入的人物数量上限</label>
              <input type="number" id="set-charlimit" value="${s.advance.charPromptLimit}" min="0" max="300">
              <div class="field-hint">人物过多时会按「重要角色优先」截断注入 prompt；0 表示不限制</div>
            </div>
          </div>
        </div>
        <div class="settings-actions">
          <button class="btn" id="test-btn">测试连通性</button>
          <button class="btn btn-primary" id="save-btn">保存设置</button>
        </div>
        <div id="test-result"></div>
      </div>`;

    const readForm = () => ({
      ai: {
        baseUrl: document.getElementById('set-baseurl').value.trim(),
        apiKey: document.getElementById('set-apikey').value.trim(),
        model: document.getElementById('set-model').value.trim(),
        temperature: Number(document.getElementById('set-temp').value) || 0.8,
        maxTokens: Number(document.getElementById('set-maxtokens').value) || 8192,
        timeoutMs: Number(document.getElementById('set-timeout').value) || 240000
      },
      advance: {
        recentTimelineCount: Number(document.getElementById('set-recent').value) || 20,
        maxRetries: Number(document.getElementById('set-retries').value) || 0,
        charPromptLimit: Number(document.getElementById('set-charlimit').value) || 0
      }
    });

    container.querySelector('#test-btn').addEventListener('click', async () => {
      const out = container.querySelector('#test-result');
      const btn = container.querySelector('#test-btn');
      btn.disabled = true;
      btn.textContent = '测试中…';
      out.innerHTML = '';
      try {
        const r = await api.post('/api/settings/test', readForm().ai);
        if (r.ok) {
          let modelInfo = '';
          if (r.modelExists === true) modelInfo = '，模型可用';
          else if (r.modelExists === false) modelInfo = '，但模型列表中未找到该模型（请检查模型名）';
          out.innerHTML = `<div class="test-result test-ok">✓ ${esc(r.message)}（延迟 ${r.latencyMs}ms，${r.modelCount} 个模型${modelInfo}）</div>`;
        } else {
          out.innerHTML = `<div class="test-result test-fail">✗ ${esc(r.message)}</div>`;
        }
      } catch (e) {
        out.innerHTML = `<div class="test-result test-fail">✗ ${esc(e.message)}</div>`;
      } finally {
        btn.disabled = false;
        btn.textContent = '测试连通性';
      }
    });

    container.querySelector('#save-btn').addEventListener('click', async () => {
      try {
        await api.put('/api/settings', readForm());
        toast('设置已保存', 'success');
      } catch (e) {
        toast(e.message, 'error');
      }
    });
  }
};
