# AgriYield Advisor

An Urdu-first AI data agent for Pakistan's smallholder farmers — built for the
**DATANOVA 2026 Global Data-thon (AI/ML track)**. A farmer asks a question in
plain Urdu (text; Urdu script, Roman Urdu, or English), and the agent checks
live weather, soil and market data with read-only tools, then answers with
the numbers and sources behind it — plus a yield forecast and a dated
sowing/irrigation plan.

Built by **Umar Shareef** (BSCS Final Year, University of Agriculture
Faisalabad, Pakistan). Registration is done (solo, Devpost); the Round 1
proposal PPT ("AgriYield Advisor") is already submitted. Project submission
deadline: **Nov 13, 2026, 11:59 PM PST**.

## What it does

- **Ask box** — the farmer types a question in Urdu, Roman Urdu, or English
  (e.g. "Is haftay gandum ko pani kab dun?"). Intent, crop, and district are
  detected from the question; the district/crop pickers are the fallback.
- **Live weather** — 7-day forecast from Open-Meteo for the farmer's Punjab
  district (25 districts). Irrigation advice is computed from the forecast
  numbers (rain in the next 48h → wait; dry → irrigate on the coolest
  morning).
- **Live soil** — ISRIC SoilGrids (pH, clay, sand, silt, organic carbon,
  nitrogen, CEC, bulk density, topsoil 0–5 cm) with plain-language
  interpretation (texture class, pH, organic carbon).
- **Market prices** — a curated **reference** dataset (AMIS Punjab mandi
  reports, 2–3 Nov 2026): wheat, rice, maize, cotton. Always labelled
  REFERENCE with its publication date — never presented as live. Includes a
  simple comparison against the government's indicative wheat price
  (Rs. 4,500/40 kg for the 2027 crop).
- **Yield forecast** — a transparent statistical baseline: a linear trend
  fitted on the most recent 25 seasons of the real FAO/OWID Pakistan yield
  series (2000–2024) for wheat, rice, and maize. Forecast with a ±1 SD band;
  in-sample RMSE reported as measured (wheat 2025: 3.12 t/ha, band
  3.02–3.22, RMSE 0.098). National average only — no district multiplier.
- **Agent layer** — Gemini-primary (`gemini-3.8-flash`, `x-goog-api-key`
  header, retry with backoff on 503/429, same pattern as PayPerPrompt). The
  prompt is grounded strictly on the tool results: cite every figure, say
  "I don't know" when data is missing, never invent a number. Without a key
  (or when Gemini fails), a deterministic template answer is composed from
  the same tool results and **labelled as a fallback**.
- **Sowing & irrigation plan** — dated steps (Asia/Karachi dates) from the
  standard Punjab crop calendar + the live forecast + the farmer's sowing
  date. Never shows a past-dated step.
- **Urdu-first UI** with an English toggle; every answer carries citations.

## Data: what is live, reference, or baseline

| Data | Status | Source |
| --- | --- | --- |
| Weather (7-day forecast) | **LIVE** | Open-Meteo, free, no key |
| Soil properties | **LIVE** | ISRIC SoilGrids v2.0, CC-BY |
| Market prices | **REFERENCE** (published 2–3 Nov 2026) | AMIS Punjab mandi reports (via Zarat Ghar) |
| Yield forecast | **BASELINE** (trend model, method shown) | FAO/OWID Pakistan yield series 1961–2024 |
| Crop calendar | Standard guidance | Punjab crop calendar (PARC/UAF guidance) |

Honesty rules: a failed live source is reported as unavailable — the answer
never invents weather or soil. No accuracy number, pilot result, or
testimonial is claimed anywhere.

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # vitest, 46 tests
npm run build      # must pass with zero errors
npm start          # production server
```

Optional env (set at deploy time only — never commit a key):

```bash
GEMINI_API_KEY=...   # enables real LLM answers; without it the app uses the
                     # labelled deterministic fallback end-to-end.
```

## Deploy (Vercel Hobby, $0)

Standard Next.js deploy. No separate backend, no database, no paid service.
Set `GEMINI_API_KEY` in the Vercel project env vars if LLM answers are
wanted; the app works without it.

## Architecture note

The proposal deck sketched a Python/FastAPI agent service + PostgreSQL.
This build colocates all logic in Next.js API routes instead (per the build
brief) to keep the deploy to one free service. The agent behaviour is the
same: tool-calling, read-only, cited answers, deterministic fallback.

## Known limits (verified 2026-11-06)

- **Open-Meteo is rate-limited from the build VM's shared egress IP**
  ("Daily API request limit exceeded"). The app handles this honestly
  (weather marked unavailable). **Re-verify the live forecast after deploy**
  — Vercel's egress IP is different and should be under the limit.
- **SoilGrids currently returns null means for Punjab points** (verified at
  Faisalabad, Lahore, Multan) and HTTP 500 on multi-property queries. The
  app fetches one property at a time (8 parallel requests, topsoil 0–5 cm)
  and shows "—" for unreported values. **Re-check soil values after deploy.**
- Market prices are a dated reference, not a live feed — refresh the
  dataset before the demo if newer AMIS reports are published.
- Yield forecasts are national averages; district yields differ.
- The yield model covers wheat, rice, and maize only (FAO/OWID series).
  Cotton and sugarcane have no forecast — the app says so.
