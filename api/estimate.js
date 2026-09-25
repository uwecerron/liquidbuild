// Vercel function: GET or POST /api/estimate for the website's ballpark tool.
const { ballpark } = require('../lib/knowledge');

module.exports = (req, res) => {
  const input = req.method === 'POST' ? (typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}) : req.query || {};
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json(ballpark({ project_type: input.project_type, size: input.size, finish: input.finish, location: input.location }));
};
