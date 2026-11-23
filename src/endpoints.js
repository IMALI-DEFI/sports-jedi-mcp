// Routes verified 2026-11-23 against https://api.sportsjedi.com/v1/openapi.json
// and sports-jedi/src/routes/v1.js. Auth header: X-API-Key (keys look like sj_live_…).
export const ENDPOINTS = {
  leagues: '/v1/leagues',             // GET  (public)
  games: '/v1/games',                 // GET ?league=&status=&date=
  game: '/v1/games/:id',              // GET
  picks: '/v1/picks',                 // GET ?league=&min_confidence=&limit=
  props: '/v1/props',                 // GET ?league=&player=&limit=   (key required)
  gradeParlay: '/v1/parlays/analyze', // POST { legs: [{ gameId, pick: "TEAM_ABBR" }] }
  usage: '/v1/usage',                 // GET
  plans: '/v1/plans',                 // GET  (key required)
};
