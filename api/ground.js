// POST /api/ground: turns a visitor's idea into a quick plan (permits, phases, ballpark, next questions) on the quote form.
const K = require('../lib/knowledge');

const BY_PROJECT = {
  'Renovation / remodel': 'whole_home_renovation', 'Addition / second story': 'addition', 'New custom home': 'new_custom_home',
  'Commercial build-out': 'retail_office_ti', 'Land / home development': 'community_sitework', 'School / education': 'school_renovation',
  'Data center / industrial': 'data_center',
};

function sizeFrom(text) {
  const m = String(text || '').replace(/,/g, '').match(/(\d{3,6})\s*(sq\.?\s*ft|square\s*feet|sqft|sf|pies)/i);
  return m ? Number(m[1]) : undefined;
}

module.exports = (req, res) => {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ ok: false }); }
  let b = req.body || {};
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch { b = {}; } }
  const idea = String(b.idea || '').slice(0, 2000);
  if (idea.trim().length < 8) return res.status(400).json({ ok: false, error: 'Tell us a bit more about the idea.' });
  const type = K.normType(idea) || BY_PROJECT[b.project] || 'new_custom_home';
  const size = Number(b.size) || sizeFrom(idea);
  const out = K.ground({ idea, project_type: type, location: String(b.location || '').slice(0, 200), size, budget: b.budget_amount, timeline: b.timeline });
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json(out);
};
