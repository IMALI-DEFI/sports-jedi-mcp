/*
 * Prices spread and total parlay legs (moneyline legs keep their existing
 * pricing in the routes). Pure functions, no I/O: the Sports Jedi MCP server
 * ships a copy of this file, so keep it dependency-free.
 *
 * Method: the market's consensus line is the expected result. Final margins
 * and totals are roughly normal around it, with a per-league spread (SD).
 * The chance a leg wins is the normal probability of beating the leg's own
 * line. At the consensus line that is ~50%; a better line scores higher.
 * Ignores pushes on whole-number lines and correlation between legs.
 */

// Typical standard deviation of final margin and of combined score, by league.
export const LEAGUE_SD = {
  NFL: { margin: 13.5, total: 10 },
  NCAAF: { margin: 16, total: 14 },
  NBA: { margin: 12, total: 18 },
  MLB: { margin: 4.2, total: 4.4 },
};

const MARKET_ALIASES = {
  moneyline: "moneyline", ml: "moneyline", h2h: "moneyline", winner: "moneyline",
  spread: "spread", spreads: "spread", ats: "spread", runline: "spread", run_line: "spread", puckline: "spread", handicap: "spread",
  total: "total", totals: "total", ou: "total", "over/under": "total", over_under: "total",
};

export function normalizeMarket(value) {
  if (value === undefined || value === null || value === "") return "moneyline";
  return MARKET_ALIASES[String(value).trim().toLowerCase()] || null;
}

const round1 = (n) => Math.round(n * 10) / 10;
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

// Standard normal CDF (Abramowitz-Stegun 7.1.26, error < 1.5e-7).
export function normalCdf(z) {
  const t = 1 / (1 + 0.3275911 * Math.abs(z) / Math.SQRT2);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-(z * z) / 2);
  return z >= 0 ? (1 + y) / 2 : (1 - y) / 2;
}

const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : Number.isFinite(Number(v)) && v !== "" && v !== null ? Number(v) : null);
const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const abbr = (t) => String(t?.abbr || "").toUpperCase();

function homeLineOf(spread, game) {
  const line = num(spread?.line);
  if (line === null || !spread?.favorite) return null;
  return String(spread.favorite).toUpperCase() === abbr(game.home) ? line : -line;
}

// Consensus spread from the home team's side (negative = home favored).
export function consensusHomeSpread(game) {
  const books = (game?.bookmakers || []).map((b) => homeLineOf(b.spread, game)).filter((v) => v !== null);
  if (books.length) return avg(books);
  return homeLineOf(game?.spread, game);
}

export function consensusTotal(game) {
  const books = (game?.bookmakers || []).map((b) => num(b.total)).filter((v) => v !== null && v > 0);
  if (books.length) return avg(books);
  const t = num(game?.total);
  return t !== null && t > 0 ? t : null;
}

/*
 * leg: { pick, market: "spread"|"total", line? }
 *   spread: pick = team abbreviation, line = that team's spread (e.g. -6.5, +3)
 *   total:  pick = "OVER" or "UNDER" (or "O"/"U"), line = the total (e.g. 221.5)
 *   line omitted = the current consensus line.
 * Returns { market, pick, line, confidence } or { error }.
 */
export function priceLineLeg(game, leg) {
  const market = normalizeMarket(leg?.market);
  if (market !== "spread" && market !== "total") return { error: "market must be spread or total" };
  const sd = LEAGUE_SD[String(game?.league || "").toUpperCase()];
  if (!sd) return { error: "spread and total legs cover NFL, NCAAF, NBA and MLB" };

  const rawLine = leg?.line;
  const given = rawLine === undefined || rawLine === null || rawLine === "" ? null : num(rawLine);
  if (rawLine !== undefined && rawLine !== null && rawLine !== "" && given === null) return { error: "line must be a number" };

  if (market === "spread") {
    const pick = String(leg?.pick || "").toUpperCase();
    const home = abbr(game.home), away = abbr(game.away);
    if (pick !== home && pick !== away) return { error: `pick must be ${home} or ${away}` };
    const homeSpread = consensusHomeSpread(game);
    if (homeSpread === null) return { error: "no spread line for this game yet" };
    const line = given !== null ? given : pick === home ? homeSpread : -homeSpread;
    if (Math.abs(line) > 60) return { error: "spread line looks wrong (more than 60 points)" };
    const expected = pick === home ? -homeSpread : homeSpread; // picked team's expected margin
    const p = 1 - normalCdf((-line - expected) / sd.margin);
    return { market, pick, line, confidence: round1(clamp(p * 100, 1, 99)) };
  }

  const side = String(leg?.pick || "").toUpperCase();
  const pick = side === "O" ? "OVER" : side === "U" ? "UNDER" : side;
  if (pick !== "OVER" && pick !== "UNDER") return { error: "pick must be OVER or UNDER for a total" };
  const total = consensusTotal(game);
  if (total === null) return { error: "no total for this game yet" };
  const line = given !== null ? given : total;
  if (line <= 0 || line > 400) return { error: "total line looks wrong" };
  const pOver = 1 - normalCdf((line - total) / sd.total);
  const p = pick === "OVER" ? pOver : 1 - pOver;
  return { market, pick, line, confidence: round1(clamp(p * 100, 1, 99)) };
}
