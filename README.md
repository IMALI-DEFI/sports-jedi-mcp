# Sports Jedi MCP

Bring [Sports Jedi](https://sportsjedi.com) into Claude, ChatGPT, Cursor and any MCP client.

| Tool | What |
|---|---|
| `grade_parlay` | Parlay Grader: confidence per leg and overall (legs = game id + team picked) |
| `get_games` | Games with ids, teams and lines |
| `get_game` | One game with Sports Jedi's analysis |
| `get_picks` | Model picks with reasoning |
| `get_player_props` | Sports Jedi's own NBA/NFL props (no college props) |
| `list_leagues` | Covered leagues (NFL, NCAAF, NBA, MLB) |
| `my_usage` | Your plan + requests left today |
| `api_plans` | Developer plans |

Access per tool follows your Sports Jedi API plan.

Get a key (`sj_live_…`): https://sportsjedi.com/developers

## Install (Claude Desktop / any stdio client)

```json
{
  "mcpServers": {
    "sports-jedi": {
      "command": "npx",
      "args": ["-y", "sports-jedi-mcp"],
      "env": { "SPORTS_JEDI_API_KEY": "sj_live_..." }
    }
  }
}
```

Optional: `SPORTS_JEDI_API_URL` (default `https://api.sportsjedi.com`).

Try: *"Grade my parlay tonight: Lakers, Celtics and Nuggets to win."*

## Routes used
`/v1/leagues`, `/v1/games`, `/v1/games/:id`, `/v1/picks`, `/v1/props`, `POST /v1/parlays/analyze`, `/v1/usage`, `/v1/plans` (all in `src/endpoints.js`). The key is sent in `X-API-Key` (also as `Authorization: Bearer`). Full spec: https://api.sportsjedi.com/v1/openapi.json

Analysis only, not betting advice. 21+. 1-800-GAMBLER.
