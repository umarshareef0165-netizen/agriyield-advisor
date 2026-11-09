<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## AgriYield Advisor — house rules

- Honesty first: every number shown must come from a named live source, a
  dated reference dataset, or a fitted model whose method is shown. Never
  present a reference/sample number as live, and never invent an accuracy,
  R², or pilot result.
- The agent is read-only: it queries data, it never writes anything.
- If a live source fails (Open-Meteo rate limit, SoilGrids 500), the answer
  says so and uses only what is available. No invented weather, no invented soil.
- Gemini is optional: `GEMINI_API_KEY` is set at deploy time only. Without it
  (or when Gemini 503s), answers are deterministic templates built from the
  same tool results, labelled as fallback.
- Yield model: linear trend fitted on the real FAO/OWID Pakistan yield series
  (1961–2024) shipped in `data/yield-series.json`. National average only —
  no invented district multiplier. In-sample RMSE is reported as measured.
  Backtest (`lib/backtest.ts`): the same trend fitted excluding 2020–2024,
  scored against the real held-out yields, with naive and 5-year-average
  baselines shown alongside — including where the trend loses (rice vs the
  5-year average). Never hide a losing baseline.
- Irrigation water need (`lib/weather.ts` `waterNeed`): net need =
  max(0, ΣET0 − Σrain) over the forecast window; 1 mm = 10,000 L/ha =
  4,046.86 L/acre. Reference (ET0) demand only — no crop coefficient is
  applied, and the UI must say so.
- Revenue estimate (`lib/revenue.ts`): gross revenue/ha = forecast yield ×
  dated reference price (per 40 kg × 25 = per tonne). Gross BEFORE costs,
  never profit. Rice has no single reference price (three varieties) — no
  estimate for rice, never a picked variety.
- Market prices: curated reference dataset in `data/market-reference.json`
  (AMIS Punjab, 2–3 Nov 2026). Labelled REFERENCE, never "live".
- Latency budget (see `lib/timeout.ts`): every upstream fetch is capped
  at 8s; Gemini at most 2 attempts with 0.5s backoff. Worst-case ask is
  ~25s — under Vercel's 60s serverless limit. A slow upstream degrades
  to "unavailable", never stalls the answer.
