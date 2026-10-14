// 轻量 API 封装
const api = {
  async request(method, url, body) {
    const opts = { method, headers: {} };
    if (body !== undefined) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    let resp;
    try {
      resp = await fetch(url, opts);
    } catch (e) {
      throw new Error('无法连接服务器：' + e.message);
    }
    let data = null;
    try { data = await resp.json(); } catch {}
    if (!resp.ok) throw new Error((data && data.error) || `请求失败（${resp.status}）`);
    return data;
  },
  get(url) { return this.request('GET', url); },
  post(url, body) { return this.request('POST', url, body); },
  put(url, body) { return this.request('PUT', url, body); },
  del(url) { return this.request('DELETE', url); }
};
