// Local preview server: `npm run dev`, then open http://localhost:3000
// On Vercel this file is not used. Vercel serves ./public and runs ./api/*.js.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { processLead, config } = require('./lib/lead');
const { handleHttp } = require('./lib/mcp');
const { handle: crm } = require('./lib/crm');
const { handleInbound } = require('./lib/sms-inbound');
const { ballpark } = require('./lib/knowledge');

const PORT = process.env.PORT || 3000;
const PUBLIC = path.join(__dirname, 'public');
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml',
};

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0;
    req.on('data', (c) => { size += c.length; if (size > 200_000) { req.destroy(); reject(new Error('too large')); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}
const parse = (raw, type = '') => { if (String(type).includes('json')) { try { return JSON.parse(raw || '{}'); } catch { return raw; } } return Object.fromEntries(new URLSearchParams(raw)); };

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const p = url.pathname;
  try {
    if (p === '/api/quote' && req.method === 'POST') {
      const data = parse(await readBody(req), req.headers['content-type']);
      const { status, json } = await processLead(data, req.socket.remoteAddress || 'local');
      if (!(req.headers.accept || '').includes('application/json') && json.ok) { res.writeHead(303, { Location: '/thanks' }); return res.end(); }
      res.writeHead(status, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify(json));
    }
    if (p === '/api/estimate') {
      const data = req.method === 'POST' ? parse(await readBody(req), req.headers['content-type']) : Object.fromEntries(url.searchParams);
      res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify(ballpark(data)));
    }
    if (['/api/ground', '/api/upload', '/api/file'].includes(p)) {
      req.body = req.method === 'POST' ? parse(await readBody(req), req.headers['content-type']) : {};
      req.query = Object.fromEntries(url.searchParams);
      res.status = (c) => { res.statusCode = c; return res; };
      res.json = (o) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(o)); };
      res.send = (t) => res.end(String(t));
      return require('./api' + p.slice(4) + '.js')(req, res);
    }
    if (p === '/api/config') { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify(config())); }
    if (p === '/api/mcp' || p === '/mcp') {
      const raw = req.method === 'POST' ? await readBody(req) : '';
      const out = await handleHttp({ method: req.method, headers: req.headers, body: raw, ip: req.socket.remoteAddress });
      res.writeHead(out.status, out.headers); return res.end(out.body);
    }
    if (p.startsWith('/api/crm')) {
      req.body = req.method === 'GET' ? {} : parse(await readBody(req), req.headers['content-type']);
      return crm(req, res);
    }
    if (p === '/api/sms' && req.method === 'POST') {
      const params = parse(await readBody(req), req.headers['content-type']);
      const out = await handleInbound({ url: `http://localhost:${PORT}/api/sms`, params, signature: req.headers['x-twilio-signature'] });
      res.writeHead(out.status, { 'Content-Type': out.type }); return res.end(out.body);
    }
    let f = decodeURIComponent(p === '/.well-known/mcp' ? '/.well-known/mcp.json' : p);
    if (f.endsWith('/')) f += 'index.html';
    if (!path.extname(f)) f += '.html';
    const file = path.normalize(path.join(PUBLIC, f));
    if (!file.startsWith(PUBLIC)) { res.writeHead(403); return res.end(); }
    fs.readFile(file, (err, buf) => {
      if (err) { res.writeHead(404, { 'Content-Type': TYPES['.html'] }); return res.end(fs.readFileSync(path.join(PUBLIC, '404.html'))); }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' }); res.end(buf);
    });
  } catch (e) {
    console.error(e); res.writeHead(500); res.end('Server error');
  }
}).listen(PORT, () => console.log(`Liquid Build preview on http://localhost:${PORT}`));
