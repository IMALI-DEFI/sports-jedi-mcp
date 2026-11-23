// Small JSON HTTP client shared (by copy) across the three MCP servers.
// Each package keeps its own copy in src/client.js so it can be published alone.
export function createClient({ baseUrl, apiKey, getToken, onAuthFail, timeoutMs = 15000, userAgent = 'imali-mcp' }) {
  if (!baseUrl) throw new Error('API base URL is not set');
  const root = baseUrl.replace(/\/+$/, '');

  async function request(method, path, { query, body } = {}, retried = false) {
    const url = new URL(root + path);
    for (const [k, v] of Object.entries(query || {})) {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
    }
    const headers = { Accept: 'application/json', 'User-Agent': userAgent };
    const key = getToken ? await getToken() : apiKey;
    if (key) { headers.Authorization = `Bearer ${key}`; headers['x-api-key'] = key; }
    if (body !== undefined) headers['Content-Type'] = 'application/json';

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    let res;
    try {
      res = await fetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: ctrl.signal });
    } catch (e) {
      throw new Error(e.name === 'AbortError' ? `Request timed out after ${timeoutMs}ms` : `Could not reach API: ${e.message}`);
    } finally {
      clearTimeout(timer);
    }
    const text = await res.text();
    let data;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    if ((res.status === 401 || res.status === 403) && onAuthFail && !retried) {
      await onAuthFail();
      return request(method, path, { query, body }, true);
    }
    if (!res.ok) {
      const msg = (data && (data.error || data.message)) || res.statusText;
      const err = new Error(`API ${res.status}: ${typeof msg === 'string' ? msg : JSON.stringify(msg)}`);
      err.status = res.status;
      throw err;
    }
    return data;
  }

  return {
    get: (path, query) => request('GET', path, { query }),
    post: (path, body) => request('POST', path, { body }),
  };
}
