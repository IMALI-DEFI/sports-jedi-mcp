# Sports Jedi MCP

Bring [Sports Jedi](https://sportsjedi.com) into Claude, ChatGPT, Cursor and any MCP client.

| Tool | What | Free | Paid key |
|---|---|---|---|
| `grade_parlay` | Parlay Grader for moneyline, spread and total legs: confidence per leg, combined confidence, risk. Reads bet slip screenshots | ✅ | ✅ |
| `get_games` | Games with ids, teams, records and lines | ✅ | ✅ |
| `get_game` | One game with the Jedi pick, confidence and factors | ✅ | ✅ |
| `list_leagues` | Covered leagues (NFL, NCAAF, NBA, MLB) | ✅ | ✅ |
| `get_picks` | Model picks with reasoning | | ✅ |
| `get_player_props` | Sports Jedi's own NBA/NFL props (no college props) | | ✅ |
| `my_usage` / `api_plans` | Your plan and requests left today | | ✅ |

Works with no key: games, game analysis and the Parlay Grader. Picks and props need a key (`sj_live_…`): https://sportsjedi.com/developers

## Install (Claude Desktop / any stdio client)

```json
{
  "mcpServers": {
    "sports-jedi": {
      "command": "npx",
      "args": ["-y", "sports-jedi-mcp"],
      "env": { "SPORTS_JEDI_API_KEY": "sj_live_... (optional)" }
    }
  }
}
```

Optional: `SPORTS_JEDI_API_URL` (default `https://api.sportsjedi.com`).

Try: *"Grade my parlay tonight: Lakers, Celtics and Nuggets to win."*

Or paste a screenshot of a bet slip and say *"Grade this."* Claude reads the legs from the image. Moneyline, spread and total legs are graded; player props and other bet types are listed as not graded.

How spread and total legs are scored: the market's consensus line is treated as the expected result, and each leg's chance is how likely the game beats that leg's own line (about 50% at the consensus line, higher when your line is better).

## Routes used
`/v1/leagues`, `/v1/games`, `/v1/games/:id`, `/v1/picks`, `/v1/props`, `POST /v1/parlays/analyze`, `/v1/usage`, `/v1/plans` (all in `src/endpoints.js`). The key is sent in `X-API-Key` (also as `Authorization: Bearer`). Full spec: https://api.sportsjedi.com/v1/openapi.json

Analysis only, not betting advice. 21+. 1-800-GAMBLER.
