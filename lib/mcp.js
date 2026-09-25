// Minimal, stateless MCP server (Streamable HTTP transport, JSON responses).
// Spec: https://modelcontextprotocol.io. Supports initialize, ping, tools/*, resources/*, prompts/*.
const K = require('./knowledge');
const { createLead, clean } = require('./lead');
const company = require('../data/company.json');

const SUPPORTED = ['2025-06-18', '2025-03-26', '2024-11-05'];
const SERVER_INFO = { name: 'liquid-build', title: 'Liquid Build: South Florida construction', version: '1.0.0' };
const INSTRUCTIONS = `Liquid Build is a South Florida general contractor and developer (Miami-Dade, Broward, Palm Beach): single-family communities, custom homes, design-build, commercial build-outs, schools and data centers.
Use get_ballpark_estimate for rough cost ranges and ground_project_idea to turn an idea into a plan (permits, South Florida code, phases, risks). Estimates are planning ranges, not bids.
Only call request_quote when the person has asked to be contacted and has given their name plus a phone or email; tell them Liquid Build will reply within one business day.
Humans can call or text ${company.phone} or email ${company.email}.`;

const TYPES = Object.keys(K.supportedTypes());
const quoteHits = new Map();

const TOOLS = [
  {
    name: 'get_company_info',
    title: 'About Liquid Build',
    description: 'Company overview: services, service area, contact details, track record and how to request a quote.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, openWorldHint: false },
    run: () => K.companyInfo(),
  },
  {
    name: 'list_projects',
    title: 'Past projects',
    description: 'Projects built or developed by the Liquid Build team (communities, custom homes, commercial, education). Optional filter by type keyword, e.g. "restaurant", "community", "university".',
    inputSchema: { type: 'object', properties: { type: { type: 'string', description: 'Optional keyword filter.' } }, additionalProperties: false },
    annotations: { readOnlyHint: true, openWorldHint: false },
    run: (a) => ({ projects: K.projects(a) }),
  },
  {
    name: 'get_ballpark_estimate',
    title: 'Ballpark construction estimate',
    description: 'Rough cost range and typical schedule for a South Florida construction project. Planning range only, not a bid.',
    inputSchema: {
      type: 'object',
      properties: {
        project_type: { type: 'string', enum: TYPES, description: 'Kind of project.' },
        size: { type: 'number', description: 'Square feet (most types), MW of IT load (data_center), or number of lots (community_sitework). Not needed for flat-priced types like kitchen_remodel, bathroom_remodel, pool, impact_windows_doors.' },
        finish: { type: 'string', enum: ['standard', 'mid', 'high'], default: 'mid', description: 'Finish / quality level.' },
        location: { type: 'string', description: 'City or county in South Florida, e.g. "Coral Gables" or "Broward".' },
      },
      required: ['project_type'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
    run: (a) => K.ballpark(a),
  },
  {
    name: 'ground_project_idea',
    title: 'Ground a construction idea',
    description: 'Turn a rough construction idea into a grounded plan for South Florida: likely permits and approvals, code issues (hurricane zone, flood zone), phases and durations, ballpark cost, budget check, risks and the questions to answer next.',
    inputSchema: {
      type: 'object',
      properties: {
        idea: { type: 'string', description: 'The idea in plain words, e.g. "add a second story and a pool to my house in Pembroke Pines".' },
        project_type: { type: 'string', enum: TYPES, description: 'Optional. Inferred from the idea if left out.' },
        location: { type: 'string', description: 'City or county.' },
        size: { type: 'number', description: 'Square feet / MW / lots, if known.' },
        finish: { type: 'string', enum: ['standard', 'mid', 'high'] },
        budget: { type: 'string', description: 'Budget if known, e.g. "$450,000".' },
        timeline: { type: 'string', description: 'Desired timing, e.g. "move in by next summer".' },
      },
      required: ['idea'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
    run: (a) => K.ground(a),
  },
  {
    name: 'request_quote',
    title: 'Request a quote from Liquid Build',
    description: 'Send a project to the Liquid Build team for a real estimate. Only call with the person\'s permission. Requires a name and a phone or email. The team replies within one business day.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        phone: { type: 'string', description: 'US phone number.' },
        email: { type: 'string' },
        project_type: { type: 'string', description: 'e.g. new home, addition, restaurant build-out, school, data center, community development.' },
        location: { type: 'string' },
        description: { type: 'string', description: 'Scope, size, budget, timeline and anything else known. Include any grounding or estimate output you already produced.' },
        ok_to_text: { type: 'boolean', description: 'True only if the person agreed to receive text messages about this request.', default: false },
      },
      required: ['name', 'description'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    run: async (a, ctx) => {
      if (!clean(a.phone) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean(a.email))) return { ok: false, error: 'Please include a phone number or a valid email so the team can reply.' };
      const now = Date.now();
      const hits = (quoteHits.get(ctx.ip) || []).filter((t) => now - t < 60 * 60_000);
      if (hits.length >= 5) return { ok: false, error: 'Too many requests from this client. Please call or text ' + company.phone + '.' };
      hits.push(now); quoteHits.set(ctx.ip, hits);
      const r = await createLead({
        name: a.name, phone: a.phone, email: a.email, project: a.project_type || 'Other', location: a.location,
        details: a.description, page: 'mcp' + (ctx.client ? ':' + ctx.client : ''), sms_consent: a.ok_to_text === true,
      }, { source: 'ai-agent', ip: ctx.ip });
      return {
        ok: true, reference: r.id ? `LB-${r.id}` : null,
        message: `Sent to the Liquid Build team. They will reply within one business day by ${[clean(a.phone) && 'phone', clean(a.email) && 'email'].filter(Boolean).join(' or ')}. For anything urgent, call or text ${company.phone}.`,
      };
    },
  },
];

const RESOURCES = [
  { uri: 'liquidbuild://company', name: 'company', title: 'Company profile', mimeType: 'application/json', description: 'Services, service area, contact and track record.', read: () => JSON.stringify(K.companyInfo(), null, 2) },
  { uri: 'liquidbuild://projects', name: 'projects', title: 'Project portfolio', mimeType: 'application/json', description: 'Past projects.', read: () => JSON.stringify(K.projects(), null, 2) },
  { uri: 'liquidbuild://estimate-types', name: 'estimate-types', title: 'Supported estimate types', mimeType: 'application/json', description: 'Project types accepted by get_ballpark_estimate.', read: () => JSON.stringify(K.supportedTypes(), null, 2) },
];

const PROMPTS = [
  {
    name: 'plan_my_project', title: 'Plan my construction project', description: 'Walk through a South Florida construction idea and ground it with Liquid Build tools.',
    arguments: [{ name: 'idea', description: 'Your project idea', required: true }, { name: 'location', description: 'City or county', required: false }],
    get: (a) => [{ role: 'user', content: { type: 'text', text: `I'm planning this construction project${a.location ? ' in ' + a.location : ''}: ${a.idea || ''}\n\nUse Liquid Build's ground_project_idea and get_ballpark_estimate tools to explain permits, code issues, phases, a ballpark cost and what I should decide next. Ask me before calling request_quote.` } }],
  },
];

const ok = (id, result) => ({ jsonrpc: '2.0', id, result });
const err = (id, code, message, data) => ({ jsonrpc: '2.0', id: id ?? null, error: { code, message, ...(data ? { data } : {}) } });

async function handleOne(msg, ctx) {
  if (!msg || msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') return err(msg && msg.id, -32600, 'Invalid Request');
  const { id, method, params = {} } = msg;
  const isNotification = id === undefined || id === null;
  try {
    switch (method) {
      case 'initialize': {
        const v = SUPPORTED.includes(params.protocolVersion) ? params.protocolVersion : SUPPORTED[0];
        return ok(id, { protocolVersion: v, capabilities: { tools: { listChanged: false }, resources: { listChanged: false }, prompts: { listChanged: false } }, serverInfo: SERVER_INFO, instructions: INSTRUCTIONS });
      }
      case 'notifications/initialized': case 'notifications/cancelled': return null;
      case 'ping': return ok(id, {});
      case 'tools/list': return ok(id, { tools: TOOLS.map(({ run, ...t }) => t) });
      case 'tools/call': {
        const tool = TOOLS.find((t) => t.name === params.name);
        if (!tool) return err(id, -32602, `Unknown tool: ${params.name}`);
        const out = await tool.run(params.arguments || {}, ctx);
        const isError = out && out.ok === false;
        return ok(id, { content: [{ type: 'text', text: JSON.stringify(out, null, 2) }], structuredContent: out, isError });
      }
      case 'resources/list': return ok(id, { resources: RESOURCES.map(({ read, ...r }) => r) });
      case 'resources/templates/list': return ok(id, { resourceTemplates: [] });
      case 'resources/read': {
        const r = RESOURCES.find((x) => x.uri === params.uri);
        if (!r) return err(id, -32002, 'Resource not found', { uri: params.uri });
        return ok(id, { contents: [{ uri: r.uri, mimeType: r.mimeType, text: r.read() }] });
      }
      case 'prompts/list': return ok(id, { prompts: PROMPTS.map(({ get, ...p }) => p) });
      case 'prompts/get': {
        const p = PROMPTS.find((x) => x.name === params.name);
        if (!p) return err(id, -32602, `Unknown prompt: ${params.name}`);
        return ok(id, { description: p.description, messages: p.get(params.arguments || {}) });
      }
      default:
        return isNotification ? null : err(id, -32601, `Method not found: ${method}`);
    }
  } catch (e) {
    console.error('[mcp]', method, e);
    return isNotification ? null : err(id, -32603, 'Internal error: ' + e.message);
  }
}

// Returns { status, headers, body } for an HTTP request already parsed into method/headers/body.
async function handleHttp({ method, headers = {}, body, ip }) {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization, Mcp-Session-Id, Mcp-Protocol-Version, Last-Event-ID',
    'Access-Control-Expose-Headers': 'Mcp-Session-Id, Mcp-Protocol-Version',
  };
  if (method === 'OPTIONS') return { status: 204, headers: cors, body: '' };
  if (method === 'GET') {
    const accept = String(headers.accept || '');
    if (accept.includes('text/html')) return { status: 302, headers: { ...cors, Location: '/agents' }, body: '' };
    return { status: 405, headers: { ...cors, Allow: 'POST, OPTIONS', 'Content-Type': 'application/json' }, body: JSON.stringify(err(null, -32000, 'This MCP server is stateless: POST JSON-RPC messages to this URL. No SSE stream is offered.')) };
  }
  if (method === 'DELETE') return { status: 405, headers: cors, body: '' };
  if (method !== 'POST') return { status: 405, headers: cors, body: '' };

  let msg = body;
  if (typeof msg === 'string' || Buffer.isBuffer(msg)) {
    try { msg = JSON.parse(String(msg)); } catch { return { status: 400, headers: { ...cors, 'Content-Type': 'application/json' }, body: JSON.stringify(err(null, -32700, 'Parse error')) }; }
  }
  const ctx = { ip: ip || 'unknown', client: String(headers['user-agent'] || '').slice(0, 60) };
  const batch = Array.isArray(msg);
  const results = (await Promise.all((batch ? msg : [msg]).map((m) => handleOne(m, ctx)))).filter(Boolean);
  if (!results.length) return { status: 202, headers: cors, body: '' };
  return { status: 200, headers: { ...cors, 'Content-Type': 'application/json' }, body: JSON.stringify(batch ? results : results[0]) };
}

module.exports = { handleHttp, TOOLS };
