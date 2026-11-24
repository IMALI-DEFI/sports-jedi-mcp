import { test } from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import { startMock } from './mock.js';
import { createClient } from '../src/client.js';
import { buildTools, legConfidence, DISCLAIMER } from '../src/tools.js';

const find = (tools, n) => tools.find(t => t.name === n);
const GAME = { id: 'g1', home: { name: 'Minnesota Timberwolves', abbr: 'MIN' }, away: { name: 'Brooklyn Nets', abbr: 'BKN' } };

test('keyed: parlay grader posts {gameId, pick} legs to /v1 with the key', async () => {
  const api = await startMock({ 'POST /v1/parlays/analyze': ({ body }) => [200, { success: true, data: { legs: body.legs } }] });
  const tools = buildTools({ client: createClient({ baseUrl: api.url, apiKey: 'sj1' }), hasKey: true });
  const r = await find(tools, 'grade_parlay').handler({ legs: [{ gameId: 'g1', pick: 'lal' }, { gameId: 'g2', pick: 'KC' }] });
  assert.deepEqual(api.calls[0].body, { legs: [{ gameId: 'g1', pick: 'LAL' }, { gameId: 'g2', pick: 'KC' }] });
  assert.ok(r.content[0].text.includes(DISCLAIMER));
  assert.equal(api.calls[0].auth, 'Bearer sj1');
  await api.close();
});

test('free: parlay grader prices legs from public analysis and grades via /api/parlays/analyze', async () => {
  const api = await startMock({
    'GET /api/games/g1': () => [200, { success: true, data: GAME }],
    'GET /api/games/g1/analysis': () => [200, { success: true, data: { pick: 'MIN', confidence: 70 } }],
    'GET /api/games/g2': () => [200, { success: true, data: { home: { name: 'A', abbr: 'AAA' }, away: { name: 'B', abbr: 'BBB' } } }],
    'GET /api/games/g2/analysis': () => [200, { success: true, data: { pick: null, confidence: 0 } }],
    'POST /api/parlays/analyze': ({ body }) => [200, { success: true, data: { legs: body.legs.length, combinedConfidence: 30, risk: 'Medium' } }],
  });
  const tools = buildTools({ client: createClient({ baseUrl: api.url }), hasKey: false });
  const r = await find(tools, 'grade_parlay').handler({ legs: [{ gameId: 'g1', pick: 'bkn' }, { gameId: 'g2', pick: 'AAA' }] });
  const posted = api.calls.find(c => c.path === '/api/parlays/analyze').body;
  assert.deepEqual(posted, { legs: [{ gameId: 'g1', pick: 'BKN', confidence: 30 }] }); // against the Jedi pick: 100-70
  assert.match(r.content[0].text, /"risk": "Medium"/);
  assert.match(r.content[0].text, /no Sports Jedi rating/);
  assert.match(r.content[0].text, /utm_source=mcp/);
  assert.ok(api.calls.every(c => !c.path.startsWith('/v1')));
  await api.close();
});

test('legConfidence: agrees by abbr or name, rejects wrong team, falls back to win probability', () => {
  assert.equal(legConfidence(GAME, { pick: 'MIN', confidence: 64 }, 'min').confidence, 64);
  assert.equal(legConfidence(GAME, { pick: 'Minnesota Timberwolves', confidence: 64 }, 'MIN').confidence, 64);
  assert.equal(legConfidence(GAME, { pick: 'MIN', confidence: 64 }, 'BKN').confidence, 36);
  assert.match(legConfidence(GAME, { pick: 'MIN', confidence: 64 }, 'LAL').error, /MIN or BKN/);
  assert.equal(legConfidence(GAME, { confidence: 0, homeWinProbability: 0.58 }, 'MIN').confidence, 58);
});

test('free: games use the public route; picks still need a key with a tagged link', async () => {
  const api = await startMock({
    'GET /api/games': ({ url }) => [200, { success: true, data: [{ id: 'g1', league: url.searchParams.get('league') }] }],
    'GET /v1/picks': () => [401, { error: 'Send your API key in the X-API-Key header.' }],
  });
  const tools = buildTools({ client: createClient({ baseUrl: api.url }), hasKey: false });
  const g = await find(tools, 'get_games').handler({ league: 'nba' });
  assert.match(g.content[0].text, /"league": "NBA"/);
  const p = await find(tools, 'get_picks').handler({ league: 'nfl' });
  assert.equal(p.isError, true);
  assert.match(p.content[0].text, /developers\?utm_source=mcp/);
  await api.close();
});

test('schemas: covered leagues only, no college props, parlay legs need gameId', () => {
  const tools = buildTools({ client: {}, hasKey: true });
  const props = z.object(find(tools, 'get_player_props').shape);
  assert.equal(props.safeParse({ league: 'ncaaf' }).success, false);
  assert.equal(props.safeParse({ league: 'nfl' }).success, true);
  const parlay = z.object(find(tools, 'grade_parlay').shape);
  assert.equal(parlay.safeParse({ legs: [{ pick: 'KC' }] }).success, false);
  assert.equal(z.object(find(tools, 'get_games').shape).safeParse({ league: 'nhl' }).success, false);
});

test('unreachable API returns a clean error, not a crash', async () => {
  const tools = buildTools({ client: createClient({ baseUrl: 'http://127.0.0.1:1', timeoutMs: 2000 }), hasKey: true });
  const r = await find(tools, 'get_games').handler({ league: 'nba' });
  assert.equal(r.isError, true);
  assert.match(r.content[0].text, /Could not reach API/);
});
