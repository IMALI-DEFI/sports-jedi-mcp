import { z } from 'zod';
import { ENDPOINTS } from './endpoints.js';

export const LEAGUES = ['nfl', 'ncaaf', 'nba', 'mlb']; // from GET /v1/leagues
// Sports Jedi only makes its own player props for NBA and NFL. No college props.
export const PROP_LEAGUES = ['nba', 'nfl'];

export const DISCLAIMER =
  'Sports Jedi picks are analysis, not betting advice. No outcome is guaranteed. 21+. ' +
  'If gambling stops being fun, call 1-800-GAMBLER.';

const UPGRADE =
  'This needs a Sports Jedi API key (or a bigger plan). Get one at https://sportsjedi.com/developers, ' +
  'then set SPORTS_JEDI_API_KEY in your MCP client config.';

const text = (data, { disclaimer = true } = {}) => ({
  content: [{
    type: 'text',
    text: (typeof data === 'string' ? data : JSON.stringify(data, null, 2)) + (disclaimer ? `\n\n${DISCLAIMER}` : ''),
  }],
});

const fail = e => ({
  content: [{ type: 'text', text: [401, 402, 403, 429].includes(e?.status) ? `${e.message}\n\n${UPGRADE}` : `Error: ${e?.message || e}` }],
  isError: true,
});

const league = z.enum(LEAGUES).describe('League: ' + LEAGUES.join(', '));
const up = l => l && l.toUpperCase();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe('Game date YYYY-MM-DD (default today, US Eastern)');
const limit = z.number().int().min(1).max(50).optional().describe('Max results (default 10)');

// The API decides what each plan can access; this server just passes the key
// and turns 401/402/403/429 into an "upgrade at sportsjedi.com/developers" message.
export function buildTools({ client }) {
  return [
    {
      name: 'grade_parlay',
      description:
        'Grade a parlay with the Sports Jedi Parlay Grader: combined confidence per leg and overall. ' +
        'Each leg is a game id plus the team abbreviation picked to win. Call get_games first to find the ' +
        'game ids and team abbreviations for the matchups the user named.',
      shape: {
        legs: z.array(z.object({
          gameId: z.string().min(1).describe('Game id from get_games'),
          pick: z.string().min(2).max(6).describe('Team abbreviation picked to win, e.g. "KC" or "LAL"'),
        })).min(1).max(15),
      },
      handler: async ({ legs }) => text(await client.post(ENDPOINTS.gradeParlay, { legs: legs.map(l => ({ gameId: l.gameId, pick: l.pick.toUpperCase() })) })),
    },
    {
      name: 'list_leagues',
      description: 'Leagues Sports Jedi covers.',
      shape: {},
      handler: async () => text(await client.get(ENDPOINTS.leagues), { disclaimer: false }),
    },
    {
      name: 'get_games',
      description: 'Games for a league and date, with game ids, team abbreviations and lines. Use the ids for grade_parlay.',
      shape: { league, date, status: z.string().optional().describe('Optional game status filter') },
      handler: async ({ league, date, status }) => text(await client.get(ENDPOINTS.games, { league: up(league), date, status }), { disclaimer: false }),
    },
    {
      name: 'get_game',
      description: 'One game in detail, including the Sports Jedi analysis for it.',
      shape: { id: z.string().min(1).describe('Game id from get_games') },
      handler: async ({ id }) => text(await client.get(ENDPOINTS.game.replace(':id', encodeURIComponent(id)))),
    },
    {
      name: 'get_picks',
      description: "Sports Jedi's model picks for a league, with confidence and reasoning.",
      shape: { league, min_confidence: z.number().min(0).max(100).optional().describe('Only picks at or above this confidence %'), limit },
      handler: async ({ league, min_confidence, limit = 10 }) => text(await client.get(ENDPOINTS.picks, { league: up(league), min_confidence, limit })),
    },
    {
      name: 'get_player_props',
      description:
        "Sports Jedi's own player props (its own projections, not copied sportsbook lines). NBA and NFL only — no college player props.",
      shape: {
        league: z.enum(PROP_LEAGUES).describe('nba or nfl'),
        player: z.string().optional().describe('Filter to one player'),
        limit,
      },
      handler: async ({ league, player, limit = 10 }) =>
        text(await client.get(ENDPOINTS.props, { league: up(league), player, limit })),
    },
    {
      name: 'my_usage',
      description: "The caller's Sports Jedi API plan and how many requests are left today.",
      shape: {},
      handler: async () => text(await client.get(ENDPOINTS.usage), { disclaimer: false }),
    },
    {
      name: 'api_plans',
      description: 'Sports Jedi developer API plans and limits.',
      shape: {},
      handler: async () => text(await client.get(ENDPOINTS.plans), { disclaimer: false }),
    },
  ].map(t => ({ ...t, handler: wrap(t.handler) }));
}

function wrap(handler) {
  return async args => {
    try { return await handler(args); } catch (e) { return fail(e); }
  };
}
