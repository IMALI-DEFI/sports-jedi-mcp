import { test } from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import { startMock } from './mock.js';
import { createClient } from '../src/client.js';
import { buildTools, DISCLAIMER } from '../src/tools.js';

const find = (tools, n) => tools.find(t => t.name === n);

test('parlay grader posts {gameId, pick} legs with uppercase picks and the key', async () => {
  const api = await startMock({ 'POST /v1/parlays/analyze': ({ body }) => [200, { success: true, data: { legs: body.legs } }] });
  const tools = buildTools({ client: createClient({ baseUrl: api.url, apiKey: 'sj1' }) });
  const r = await find(tools, 'grade_parlay').handler({ legs: [{ gameId: 'g1', pick: 'lal' }, { gameId: 'g2', pick: 'KC' }] });
  assert.deepEqual(api.calls[0].body, { legs: [{ gameId: 'g1', pick: 'LAL' }, { gameId: 'g2', pick: 'KC' }] });
  assert.ok(r.content[0].text.includes(DISCLAIMER));
  assert.equal(api.calls[0].auth, 'Bearer sj1');
  await api.close();
});

test('props hit /v1/props with league + player; 429 explains upgrade', async () => {
  const api = await startMock({
    'GET /v1/props': ({ url }) => [200, { league: url.searchParams.get('league'), props: [] }],
    'GET /v1/picks': () => [429, { error: 'Plan limit of 100 requests per day reached.' }],
  });
  const tools = buildTools({ client: createClient({ baseUrl: api.url, apiKey: 'k1' }) });
  const r = await find(tools, 'get_player_props').handler({ league: 'nba', player: 'Jokic' });
  assert.match(r.content[0].text, /"league": "NBA"/);
  assert.equal(api.calls[0].query.player, 'Jokic');
  const bad = await find(tools, 'get_picks').handler({ league: 'nfl' });
  assert.equal(bad.isError, true);
  assert.match(bad.content[0].text, /API 429[\s\S]*sportsjedi\.com\/developers/);
  await api.close();
});

test('schemas: covered leagues only, no college props, parlay legs need gameId', () => {
  const tools = buildTools({ client: {} });
  const props = z.object(find(tools, 'get_player_props').shape);
  assert.equal(props.safeParse({ league: 'ncaaf' }).success, false);
  assert.equal(props.safeParse({ league: 'nfl' }).success, true);
  const parlay = z.object(find(tools, 'grade_parlay').shape);
  assert.equal(parlay.safeParse({ legs: [{ pick: 'KC' }] }).success, false);
  assert.equal(parlay.safeParse({ legs: [{ gameId: 'g1', pick: 'KC' }] }).success, true);
  const games = z.object(find(tools, 'get_games').shape);
  assert.equal(games.safeParse({ league: 'nhl' }).success, false);
});

test('unreachable API returns a clean error, not a crash', async () => {
  const tools = buildTools({ client: createClient({ baseUrl: 'http://127.0.0.1:1', timeoutMs: 2000 }) });
  const r = await find(tools, 'get_games').handler({ league: 'nba' });
  assert.equal(r.isError, true);
  assert.match(r.content[0].text, /Could not reach API/);
});
