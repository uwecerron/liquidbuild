// Estimating + project-grounding logic shared by the MCP server and the website.
const company = require('../data/company.json');
const est = require('../data/estimating.json');

const TYPE_ALIASES = {
  home: 'new_custom_home', house: 'new_custom_home', custom_home: 'new_custom_home', new_home: 'new_custom_home',
  renovation: 'whole_home_renovation', remodel: 'whole_home_renovation', kitchen: 'kitchen_remodel', bathroom: 'bathroom_remodel', bath: 'bathroom_remodel',
  windows: 'impact_windows_doors', impact_windows: 'impact_windows_doors', restaurant: 'restaurant_buildout', retail: 'retail_office_ti', office: 'retail_office_ti',
  school: 'school_renovation', charter_school: 'new_school', warehouse: 'warehouse_industrial', industrial: 'warehouse_industrial', datacenter: 'data_center',
  subdivision: 'community_sitework', community: 'community_sitework', sitework: 'community_sitework',
};

// Keyword order matters: specific project types are checked before generic ones like "house".
const KEYWORDS = [
  ['data_center', ['data center', 'datacenter', 'data_center', 'megawatt', ' mw']],
  ['community_sitework', ['subdivision', 'community', 'lots', 'sitework', 'site work', 'plat', 'acres']],
  ['new_school', ['new school', 'charter school', 'build a school', 'school building']],
  ['school_renovation', ['school', 'campus', 'classroom', 'university', 'college']],
  ['restaurant_buildout', ['restaurant', 'cafe', 'café', 'kitchen hood', 'bar ', 'coffee shop']],
  ['warehouse_industrial', ['warehouse', 'industrial', 'factory', 'plant', 'distribution']],
  ['retail_office_ti', ['retail', 'office', 'store', 'tenant improvement', 'buildout', 'build-out']],
  ['addition', ['addition', 'second story', '2nd story', 'add a room', 'add on', 'extension', 'adu', 'in-law']],
  ['kitchen_remodel', ['kitchen']],
  ['bathroom_remodel', ['bathroom', 'bath ']],
  ['pool', ['pool', 'spa']],
  ['impact_windows_doors', ['impact window', 'windows', 'hurricane door', 'impact door', 'shutters']],
  ['whole_home_renovation', ['renovat', 'remodel', 'gut', 'rehab']],
  ['new_custom_home', ['new home', 'custom home', 'build a house', 'build a home', 'house', 'home']],
];

function normType(t) {
  const raw = String(t || '').toLowerCase().trim();
  const k = raw.replace(/[\s-]+/g, '_');
  if (est.types[k]) return k;
  if (TYPE_ALIASES[k]) return TYPE_ALIASES[k];
  const text = ' ' + raw + ' ';
  for (const [type, words] of KEYWORDS) if (words.some((w) => text.includes(w))) return type;
  return null;
}

// Rough county detection from a free-text location.
const COUNTY_HINTS = {
  'miami-dade': ['miami', 'dade', 'hialeah', 'homestead', 'redland', 'key biscayne', 'coral gables', 'doral', 'kendall', 'aventura', 'pinecrest', 'cutler bay', 'palmetto bay', 'sweetwater', 'florida city', 'north miami', 'miami beach', 'surfside', 'bal harbour', 'medley'],
  broward: ['broward', 'fort lauderdale', 'ft lauderdale', 'ft. lauderdale', 'hollywood', 'pembroke', 'miramar', 'davie', 'plantation', 'sunrise', 'weston', 'coral springs', 'pompano', 'deerfield', 'hallandale', 'dania', 'wilton manors', 'lauderhill', 'tamarac', 'margate', 'coconut creek', 'parkland', 'oakland park', 'lighthouse point'],
  'palm beach': ['palm beach', 'boca raton', 'boca', 'delray', 'boynton', 'jupiter', 'wellington', 'lake worth', 'palm beach gardens', 'royal palm', 'lantana', 'greenacres', 'riviera beach', 'tequesta'],
  monroe: ['monroe', 'key west', 'key largo', 'marathon', 'islamorada', 'florida keys', 'the keys'],
};
function countyOf(location) {
  const l = String(location || '').toLowerCase();
  for (const [county, words] of Object.entries(COUNTY_HINTS)) if (words.some((w) => l.includes(w))) return county;
  return null;
}

const fmt = (n) => '$' + Math.round(n).toLocaleString('en-US');
function roundNice(n) { const p = Math.pow(10, Math.max(0, Math.floor(Math.log10(Math.max(1, n))) - 1)); return Math.round(n / p) * p; }

function ballpark({ project_type, size, finish = 'mid', location = '' } = {}) {
  const key = normType(project_type);
  if (!key) {
    return { ok: false, error: `Unknown project_type "${project_type}".`, supported_types: Object.fromEntries(Object.entries(est.types).map(([k, v]) => [k, v.label + ' (' + v.unit + ')'])) };
  }
  const t = est.types[key];
  const tier = t.tiers[String(finish).toLowerCase()] ? String(finish).toLowerCase() : 'mid';
  const [lo, hi] = t.tiers[tier];
  const county = countyOf(location);
  const factor = est.regionFactors[county || 'default'] ?? 1;
  let qty = 1; let qtyLabel = '';
  if (t.unit !== 'flat') {
    qty = Number(size);
    if (!qty || qty <= 0) {
      const need = { per_sqft: 'size in square feet', per_mw: 'size in megawatts of IT load', per_lot: 'number of lots' }[t.unit];
      return { ok: false, error: `Please provide ${need} as "size" for ${t.label}.`, unit: t.unit, unit_rate_range: [fmt(lo * factor), fmt(hi * factor)] };
    }
    qtyLabel = { per_sqft: `${qty.toLocaleString()} sq ft`, per_mw: `${qty} MW`, per_lot: `${qty} lots` }[t.unit];
  }
  const low = roundNice(lo * qty * factor), high = roundNice(hi * qty * factor);
  return {
    ok: true,
    project_type: key, label: t.label, finish: tier, size: qtyLabel || null,
    location: location || null, county: county ? county.replace(/\b\w/g, (c) => c.toUpperCase()) + ' County' : null,
    range_low: low, range_high: high, range_text: `${fmt(low)} to ${fmt(high)}`,
    unit_rate: t.unit === 'flat' ? null : `${fmt(lo * factor)} to ${fmt(hi * factor)} ${t.unit.replace('per_', 'per ').replace('sqft', 'sq ft').replace('mw', 'MW')}`,
    typical_schedule_weeks: t.weeks,
    notes: t.notes || null,
    disclaimer: 'Ballpark planning range only. This is not a bid or quote. Real pricing needs a site visit, plans and scope. Excludes land, design fees (unless design-build), permits/impact fees and owner-furnished items unless stated.',
    next_step: `Call or text ${company.phone}, email ${company.email}, or use the request_quote tool for a real estimate within one business day.`,
  };
}

// ---------- grounding ----------
const COMMON = {
  permits: ['Building permit from the city or county building department (plans signed and sealed by a Florida-licensed architect or engineer when required)', 'Zoning review / site plan approval', 'Notice of Commencement recorded with the county for most permitted jobs'],
  questions: ['Do you control the site (own, under contract or leased)?', 'What is the budget range and target completion date?', 'Do you have a survey, and do you know the FEMA flood zone?', 'Do you already have an architect or engineer, or do you want design-build?'],
};

const PROFILES = {
  residential: {
    match: ['new_custom_home', 'addition', 'whole_home_renovation', 'kitchen_remodel', 'bathroom_remodel', 'pool', 'impact_windows_doors'],
    permits: ['Building permit with sub-permits (electrical, plumbing, mechanical, roofing)', 'Energy code calculations', 'Truss and structural engineering for new structures', 'HOA / architectural review if the property is in an HOA', 'Pool: separate pool permit, barrier/safety requirements'],
    phases: [['Feasibility & budget', '1 to 3 weeks'], ['Design & engineering', '4 to 12 weeks'], ['Permitting', '4 to 16 weeks, varies by city'], ['Construction', 'see schedule'], ['Inspections & CO / final', '1 to 4 weeks']],
    risks: ['Permit review times vary widely by municipality', 'Impact window/door and roofing product lead times', 'Hidden conditions in older homes (termite, wiring, cast-iron plumbing)', 'Weather delays during hurricane season (June to November)'],
    questions: ['How many square feet, bedrooms and bathrooms?', 'Is this your primary residence (owner-builder is allowed for your own home, but you take on contractor liability)?'],
  },
  commercial: {
    match: ['restaurant_buildout', 'retail_office_ti'],
    permits: ['Building permit for tenant improvement', 'Fire department plan review (sprinklers, alarms, egress)', 'Health department plan review for food service', 'Grease trap / utility approvals for restaurants', 'Sign permit', 'Landlord approval of drawings'],
    phases: [['Lease & landlord work letter review', '1 to 3 weeks'], ['Design & brand standards', '4 to 8 weeks'], ['Permitting', '4 to 12 weeks'], ['Build-out', 'see schedule'], ['Health/fire inspections, CO, opening', '1 to 3 weeks']],
    risks: ['The opening date is fixed by the lease, so permit time is usually the squeeze', 'Existing MEP capacity (electrical service, HVAC tonnage, grease trap)', 'ADA accessibility upgrades triggered by the alteration'],
    questions: ['Is the space first- or second-generation (existing kitchen/hood)?', 'What is the rent commencement or target opening date?', 'Does the brand provide prototype drawings?'],
  },
  education: {
    match: ['school_renovation', 'new_school'],
    permits: ['Building permit and fire plan review', 'Confirm which educational-facility standards apply (public, charter and private schools differ) before design', 'Zoning / school-use approval and traffic review for new schools'],
    phases: [['Walkthrough & phasing plan', '1 to 3 weeks'], ['Design', '6 to 16 weeks'], ['Permitting', '6 to 16 weeks'], ['Construction in school-calendar windows', 'see schedule'], ['Inspections & turnover before first bell', '1 to 3 weeks']],
    risks: ['Summer windows are short, so permits must be in hand before school lets out', 'Occupied-building safety and background checks for crews', 'Life-safety upgrades triggered by renovation scope'],
    questions: ['Public, charter or private school?', 'Which dates can the space be unoccupied?', 'Student capacity and grade levels served?'],
  },
  industrial: {
    match: ['warehouse_industrial', 'data_center'],
    permits: ['Site plan approval and building permit', 'Environmental and stormwater permits (e.g., water management district)', 'Utility service / large-load interconnection agreement', 'Air permit for large standby generators (data centers)', 'Fire marshal review (storage, fuel, battery systems)'],
    phases: [['Site & power diligence', '4 to 12 weeks'], ['Entitlements & utility agreements', '3 to 12 months'], ['Design', '3 to 6 months'], ['Sitework & shell', 'see schedule'], ['Electrical/mechanical fit-out & commissioning', '3 to 9 months']],
    risks: ['Utility capacity and time-to-energize usually set the schedule', 'Long-lead equipment: transformers, switchgear, generators (often 12+ months)', 'Flood elevation and stormwater retention on low sites'],
    questions: ['How many MW of IT load (or electrical service size) do you need, and by when?', 'Is there utility capacity at the site today?', 'Shell only, or full fit-out?'],
  },
  development: {
    match: ['community_sitework'],
    permits: ['Rezoning / land-use approvals if needed', 'Plat approval', 'Engineering permits for roads, drainage, water and sewer', 'Water management district environmental resource permit', 'Utility (water/sewer) agreements and impact fees', 'Individual building permits per home'],
    phases: [['Feasibility & yield study', '2 to 6 weeks'], ['Entitlements & plat', '4 to 12 months'], ['Horizontal sitework', 'see schedule'], ['Model homes', '6 to 9 months'], ['Production building & closings', 'ongoing']],
    risks: ['Entitlement timelines and utility capacity', 'Fill costs on low-lying land to meet flood elevations', 'Absorption rate and interest carry'],
    questions: ['How many acres and what is the current zoning?', 'Target lot count and home sizes?', 'Build-to-sell, build-to-rent, or selling finished lots?'],
  },
};

function profileFor(key) {
  for (const [name, p] of Object.entries(PROFILES)) if (p.match.includes(key)) return [name, p];
  return ['residential', PROFILES.residential];
}

function codeNotes(county, key) {
  const n = [];
  if (county === 'miami-dade' || county === 'broward') n.push('Miami-Dade and Broward are in the Florida Building Code High-Velocity Hurricane Zone (HVHZ): windows, doors, roofing and other envelope products need HVHZ-rated approvals (Miami-Dade NOA or equivalent Florida Product Approval).');
  else if (county === 'palm beach') n.push('Palm Beach County is outside the HVHZ but is a wind-borne debris region: openings need impact-rated products or approved shutters, and design wind speeds are high.');
  else if (county === 'monroe') n.push('Monroe County (the Keys) has very high design wind speeds, extensive flood zones and a building-permit allocation system (ROGO/NROGO) that can limit new residential construction.');
  else n.push('South Florida wind design rules apply: expect impact-rated windows/doors or approved shutters and engineered roof attachments.');
  n.push('Check the FEMA flood zone early: in special flood hazard areas the lowest floor must be built at or above the required elevation, and an elevation certificate is needed.');
  if (['whole_home_renovation', 'addition'].includes(key)) n.push('In a flood zone, improvements costing 50% or more of the building\'s market value can require bringing the whole structure up to current flood rules (the FEMA "50% rule").');
  if (key === 'pool') n.push('Florida residential pools need a safety feature (barrier, alarm or approved cover) under the Residential Swimming Pool Safety Act.');
  return n;
}

function ground({ idea = '', project_type = '', location = '', size, budget, timeline, finish = 'mid' } = {}) {
  let key = normType(project_type) || normType(idea);
  if (!key) key = 'new_custom_home';
  const county = countyOf(location || idea);
  const [profileName, p] = profileFor(key);
  const t = est.types[key];
  const estimate = size || t.unit === 'flat' ? ballpark({ project_type: key, size, finish, location: location || idea }) : null;
  const budgetNum = Number(String(budget || '').replace(/[^0-9.]/g, '')) || null;
  let budgetCheck = null;
  if (estimate && estimate.ok && budgetNum) {
    budgetCheck = budgetNum < estimate.range_low ? `Budget (${fmt(budgetNum)}) is below the ballpark range. Consider a smaller scope, a smaller size or a standard finish level.`
      : budgetNum > estimate.range_high ? `Budget (${fmt(budgetNum)}) is above the ballpark range. There is room for higher finishes or a bigger contingency.`
        : `Budget (${fmt(budgetNum)}) falls inside the ballpark range. Keep a 10 to 15% contingency.`;
  }
  return {
    ok: true,
    summary: `${t.label}${location ? ' in ' + location : ''}${county ? ' (' + county.replace(/\b\w/g, (c) => c.toUpperCase()) + ' County)' : ''}.`,
    idea: idea || null,
    category: profileName,
    likely_permits_and_approvals: [...COMMON.permits, ...p.permits],
    south_florida_code_considerations: codeNotes(county, key),
    phases: p.phases.map(([name, dur]) => ({ phase: name, typical_duration: dur === 'see schedule' ? `${t.weeks[0]} to ${t.weeks[1]} weeks` : dur })),
    ballpark_estimate: estimate && estimate.ok ? { range: estimate.range_text, finish: estimate.finish, size: estimate.size, disclaimer: estimate.disclaimer } : 'Provide "size" (and finish level) for a ballpark range.',
    budget_check: budgetCheck,
    timeline_check: timeline ? `Requested timeline: ${timeline}. Typical total for this type, including design and permits, is several months beyond the construction duration of ${t.weeks[0]} to ${t.weeks[1]} weeks.` : null,
    key_risks: p.risks,
    questions_to_answer_next: [...p.questions, ...COMMON.questions],
    how_liquid_build_helps: `${company.name} can take this from idea to keys: feasibility, design-build, permits (with Liquid Permit) and construction. Call or text ${company.phone} or use request_quote.`,
    caveat: 'General guidance for planning, not legal, engineering or code advice. Requirements vary by municipality and change over time; confirm with the local building department and your design professionals.',
  };
}

function companyInfo() {
  return {
    name: company.name, legal_name: company.legalName, website: company.url, description: company.description,
    phone: company.phone, email: company.email, service_area: company.areaServed,
    services: company.services.map((s) => ({ name: s.name, summary: s.summary, url: company.url + '/' + s.slug })),
    track_record: company.track,
    reply_time: 'Within one business day',
    how_to_request_a_quote: 'Use the request_quote tool, call or text ' + company.phone + ', or email ' + company.email + '.',
  };
}

function projects({ type } = {}) {
  const t = String(type || '').toLowerCase();
  return company.projects.filter((p) => !t || (p.type + ' ' + p.name).toLowerCase().includes(t)).map((p) => ({ ...p, image: p.image ? company.url + p.image : null }));
}

module.exports = { ballpark, ground, companyInfo, projects, normType, countyOf, supportedTypes: () => Object.fromEntries(Object.entries(est.types).map(([k, v]) => [k, v.label])) };
