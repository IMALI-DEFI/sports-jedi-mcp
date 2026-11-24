// Routes verified 2026-11-23 against https://api.sportsjedi.com/v1/openapi.json,
// sports-jedi/src/routes/*.js and live calls.
// Keyed (X-API-Key, sj_live_…): /v1/*. Free (no key): the public /api/* routes sportsjedi.com uses.
export const ENDPOINTS = {
  leagues: '/v1/leagues',             // GET  (public)
  games: '/v1/games',                 // GET ?league=&status=&date=
  game: '/v1/games/:id',              // GET
  picks: '/v1/picks',                 // GET ?league=&min_confidence=&limit=
  props: '/v1/props',                 // GET ?league=&player=&limit=
  gradeParlay: '/v1/parlays/analyze', // POST { legs: [{ gameId, pick: "TEAM_ABBR" }] }
  usage: '/v1/usage',                 // GET
  plans: '/v1/plans',                 // GET
};

export const PUBLIC = {
  games: '/api/games',                    // GET ?league=NBA
  game: '/api/games/:id',                 // GET
  analysis: '/api/games/:id/analysis',    // GET  { pick, confidence, homeWinProbability, awayWinProbability, summary }
  gradeParlay: '/api/parlays/analyze',    // POST { legs: [{ confidence }] } -> combinedConfidence, risk
};

// Every link the server hands out is tagged so signups from MCP show up in IMALI's
// marketing_events attribution (utm_source=mcp).
export const LINKS = {
  developers: 'https://sportsjedi.com/developers?utm_source=mcp&utm_medium=sports-jedi-mcp&utm_campaign=api_key',
  pricing: 'https://sportsjedi.com/pricing?utm_source=mcp&utm_medium=sports-jedi-mcp&utm_campaign=free_tier',
};
