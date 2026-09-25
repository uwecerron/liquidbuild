// Vercel function: MCP server for AI agents at /api/mcp (Streamable HTTP, stateless).
const { handleHttp } = require('../lib/mcp');

module.exports = async (req, res) => {
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  const out = await handleHttp({ method: req.method, headers: req.headers, body: req.body, ip });
  for (const [k, v] of Object.entries(out.headers || {})) res.setHeader(k, v);
  res.statusCode = out.status;
  res.end(out.body || '');
};
