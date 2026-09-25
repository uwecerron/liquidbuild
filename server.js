// Local preview server (no dependencies): `npm run dev`, then open http://localhost:3000
// On Vercel this file is not used — Vercel serves ./public and runs ./api/*.js.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { processLead, config } = require('./lib/lead');

const PORT = process.env.PORT || 3000;
const PUBLIC = path.join(__dirname, 'public');
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.txt': 'text/plain', '.xml': 'application/xml',
};

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0;
    req.on('data', (c) => { size += c.length; if (size > 50_000) { req.destroy(); reject(new Error('too large')); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/api/quote' && req.method === 'POST') {
    const raw = await readBody(req).catch(() => '');
    let data; try { data = JSON.parse(raw); } catch { data = Object.fromEntries(new URLSearchParams(raw)); }
    const { status, json } = await processLead(data, req.socket.remoteAddress || 'local');
    if (!(req.headers.accept || '').includes('application/json') && json.ok) { res.writeHead(303, { Location: '/thanks' }); return res.end(); }
    res.writeHead(status, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify(json));
  }
  if (url.pathname === '/api/config') { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify(config())); }

  let p = decodeURIComponent(url.pathname);
  if (p.endsWith('/')) p += 'index.html';
  if (!path.extname(p)) p += '.html';
  const file = path.normalize(path.join(PUBLIC, p));
  if (!file.startsWith(PUBLIC)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404, { 'Content-Type': TYPES['.html'] }); return res.end(fs.readFileSync(path.join(PUBLIC, '404.html'))); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' }); res.end(buf);
  });
}).listen(PORT, () => console.log(`liquid build preview on http://localhost:${PORT}`));
