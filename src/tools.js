import { z } from 'zod';
import { ENDPOINTS, PUBLIC, LINKS } from './endpoints.js';
import { normalizeMarket, priceLineLeg } from './legPricing.js';

export const LEAGUES = ['nfl', 'ncaaf', 'nba', 'mlb']; // from GET /v1/leagues
// Sports Jedi only makes its own player props for NBA and NFL. No college props.
export const PROP_LEAGUES = ['nba', 'nfl'];

export const DISCLAIMER =
  'Sports Jedi picks are analysis, not betting advice. No outcome is guaranteed. 21+. ' +
  'If gambling stops being fun, call 1-800-GAMBLER.';

const UPGRADE =
  `This needs a Sports Jedi API key (or a bigger plan). Get one at ${LINKS.developers} ` +
  'then set SPORTS_JEDI_API_KEY in your MCP client config.';

const FREE_NOTE =
  `Free mode (no API key). Model picks and Sports Jedi's own player props are on a paid plan: ${LINKS.pricing}`;

const text = (data, { disclaimer = true, note } = {}) => ({
  content: [{
    type: 'text',
    text: (typeof data === 'string' ? data : JSON.stringify(data, null, 2)) + (note ? `\n\n${note}` : '') + (disclaimer ? `\n\n${DISCLAIMER}` : ''),
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
const unwrap = r => (r && typeof r === 'object' && 'data' in r ? r.data : r);
const idPath = (p, id) => p.replace(':id', encodeURIComponent(id));

// Confidence for one leg, the same way /v1/parlays/analyze prices it:
// the Jedi pick's confidence if the user picked that side, otherwise 100 minus it.
export function legConfidence(game, analysis, pick) {
  const P = String(pick).toUpperCase();
  const home = game?.home || {}, away = game?.away || {};
  const sides = [home.abbr, away.abbr].filter(Boolean).map(s => String(s).toUpperCase());
  if (sides.length && !sides.includes(P)) {
    return { error: `pick must be ${sides.join(' or ')} for this game` };
  }
  const names = s => [s.abbr, s.name].filter(Boolean).map(x => String(x).toUpperCase());
  const jediPick = analysis?.pick ? String(analysis.pick).toUpperCase() : null;
  const conf = Number(analysis?.confidence);
  if (jediPick && conf > 0) {
    const pickedTeam = [home, away].find(t => names(t).includes(P)) || {};
    const agrees = names(pickedTeam).includes(jediPick) || jediPick === P;
    return { confidence: Math.round((agrees ? conf : 100 - conf) * 10) / 10, jedi_pick: analysis.pick, agrees };
  }
  const isHome = String(home.abbr || '').toUpperCase() === P;
  const prob = Number(isHome ? analysis?.homeWinProbability : analysis?.awayWinProbability);
  if (prob > 0) return { confidence: Math.round((prob <= 1 ? prob * 100 : prob) * 10) / 10, jedi_pick: null };
  return { error: 'no Sports Jedi rating for this game yet' };
}

export function buildTools({ client, hasKey }) {
  async function freeParlay(legs) {
    const priced = [], skipped = [];
    for (const leg of legs) {
      try {
        const market = normalizeMarket(leg.market);
        if (!market) {
          skipped.push({ gameId: leg.gameId, pick: leg.pick, reason: 'only moneyline, spread and total legs can be graded' });
          continue;
        }
        if (market !== 'moneyline') {
          const game = await client.get(idPath(PUBLIC.game, leg.gameId)).then(unwrap);
          const matchup = game?.away && game?.home ? `${game.away.name} @ ${game.home.name}` : leg.gameId;
          const r = priceLineLeg(game, leg);
          if (r.error) skipped.push({ gameId: leg.gameId, market, pick: leg.pick, line: leg.line, matchup, reason: r.error });
          else priced.push({ gameId: leg.gameId, matchup, ...r });
          continue;
        }
        const [game, analysis] = await Promise.all([
          client.get(idPath(PUBLIC.game, leg.gameId)).then(unwrap),
          client.get(idPath(PUBLIC.analysis, leg.gameId)).then(unwrap),
        ]);
        const r = legConfidence(game, analysis, leg.pick);
        const matchup = game?.away && game?.home ? `${game.away.name} @ ${game.home.name}` : leg.gameId;
        if (r.error) skipped.push({ gameId: leg.gameId, pick: leg.pick, matchup, reason: r.error });
        else priced.push({ gameId: leg.gameId, pick: leg.pick.toUpperCase(), matchup, ...r });
      } catch (e) {
        skipped.push({ gameId: leg.gameId, pick: leg.pick, reason: e.status === 404 ? 'game not found' : e.message });
      }
    }
    const result = priced.length
      ? unwrap(await client.post(PUBLIC.gradeParlay, { legs: priced.map(l => ({ gameId: l.gameId, pick: l.pick, confidence: l.confidence })) }))
      : { message: 'No legs could be rated.' };
    return { ...result, legs: priced, skipped };
  }

  return [
    {
      name: 'grade_parlay',
      description:
        'Grade a parlay with the Sports Jedi Parlay Grader: confidence per leg, combined confidence and risk. Works without an API key. ' +
        'Legs can be moneyline (team to win), spread (team and its line, e.g. KC -3.5) or total (OVER/UNDER and the number). ' +
        'If the user shares a screenshot or photo of a bet slip, read every leg from the image yourself (teams, bet type, line) and grade it; ' +
        'do not ask them to type it. Call get_games first to find the game ids and team abbreviations for the matchups. ' +
        'Player props, team totals, first-half and other bets cannot be graded: list them back to the user as not graded.',
      shape: {
        legs: z.array(z.object({
          gameId: z.string().min(1).describe('Game id from get_games'),
          market: z.enum(['moneyline', 'spread', 'total']).optional().describe('Bet type; default moneyline'),
          pick: z.string().min(1).max(6).describe('Team abbreviation from get_games (moneyline, spread), or OVER / UNDER (total)'),
          line: z.number().optional().describe("Spread: the picked team's line, e.g. -3.5 or 7. Total: the number, e.g. 221.5. From the bet slip; omit to use the current consensus line"),
        })).min(1).max(15),
      },
      handler: async ({ legs }) => hasKey
        ? text(await client.post(ENDPOINTS.gradeParlay, {
          legs: legs.map(l => {
            const market = normalizeMarket(l.market);
            const base = { gameId: l.gameId, pick: l.pick.toUpperCase() };
            if (!market || market === 'moneyline') return base;
            return { ...base, market, ...(l.line === undefined ? {} : { line: l.line }) };
          }),
        }))
        : text(await freeParlay(legs), { note: FREE_NOTE }),
    },
    {
      name: 'list_leagues',
      description: 'Leagues Sports Jedi covers.',
      shape: {},
      handler: async () => text(await client.get(ENDPOINTS.leagues), { disclaimer: false }),
    },
    {
      name: 'get_games',
      description: 'Games for a league, with game ids, team abbreviations, records and lines. Works without an API key. Use the ids for grade_parlay.',
      shape: { league, date, status: z.string().optional().describe('Optional game status filter') },
      handler: async ({ league, date, status }) => hasKey
        ? text(await client.get(ENDPOINTS.games, { league: up(league), date, status }), { disclaimer: false })
        : text(await client.get(PUBLIC.games, { league: up(league), date, status }), { disclaimer: false }),
    },
    {
      name: 'get_game',
      description: "One game with Sports Jedi's analysis: the Jedi pick, confidence, market consensus and key factors. Works without an API key.",
      shape: { id: z.string().min(1).describe('Game id from get_games') },
      handler: async ({ id }) => hasKey
        ? text(await client.get(idPath(ENDPOINTS.game, id)))
        : text(await client.get(idPath(PUBLIC.analysis, id)), { note: FREE_NOTE }),
    },
    {
      name: 'get_picks',
      description: "Sports Jedi's model picks for a league, with confidence and reasoning. Paid: needs an API key.",
      shape: { league, min_confidence: z.number().min(0).max(100).optional().describe('Only picks at or above this confidence %'), limit },
      handler: async ({ league, min_confidence, limit = 10 }) => text(await client.get(ENDPOINTS.picks, { league: up(league), min_confidence, limit })),
    },
    {
      name: 'get_player_props',
      description:
        "Sports Jedi's own player props (its own projections, not copied sportsbook lines). NBA and NFL only — no college player props. Paid: needs an API key.",
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
      description: "The caller's Sports Jedi API plan and how many requests are left today. Needs an API key.",
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
