// Vercel function: CRM API. vercel.json rewrites /api/crm/<path> to /api/crm?path=<path>.
const { handle } = require('../lib/crm');
module.exports = (req, res) => handle(req, res);
