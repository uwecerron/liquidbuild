// Vercel serverless function: GET /api/config
const { config } = require('../lib/lead');

module.exports = (req, res) => {
  res.setHeader('Cache-Control', 's-maxage=300');
  res.status(200).json(config());
};
