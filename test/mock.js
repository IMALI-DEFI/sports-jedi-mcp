import http from 'node:http';
// Starts a fake API. routes: { 'GET /path': (req, body) => [status, json] }
export async function startMock(routes) {
  const calls = [];
  const srv = http.createServer(async (req, res) => {
    let raw = '';
    for await (const c of req) raw += c;
    const url = new URL(req.url, 'http://x');
    const body = raw ? JSON.parse(raw) : undefined;
    calls.push({ method: req.method, path: url.pathname, query: Object.fromEntries(url.searchParams), body, auth: req.headers.authorization });
    const h = routes[`${req.method} ${url.pathname}`];
    const [status, json] = h ? await h({ url, body }) : [404, { error: 'not found' }];
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(json));
  });
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  return { url: `http://127.0.0.1:${srv.address().port}`, calls, close: () => new Promise(r => srv.close(r)) };
}
