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
deadline: **Mon Nov 10, 2026, 2:00 PM PT** (Round 1 close — verified
2026-11-08; the Nov 13 date appears NOWHERE official).

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
  **Backtest (new):** the same trend, fitted excluding 2020–2024, scored
  against the real held-out yields — wheat MAE 0.090 t/ha (naive 0.228,
  5-year average 0.207), rice MAE 0.168 (naive 0.182, 5-year average 0.121 —
  the trend does NOT beat the 5-year average for rice, reported as
  measured), maize MAE 0.412 (naive 0.491, 5-year average 1.250). Shown in
  the UI and in `/api/yield` — see `lib/backtest.ts`.
- **Irrigation water need (new)** — from the forecast's own numbers: net
  need = max(0, ΣET0 − Σrain) over the 7-day window, in mm, litres per acre
  (1 mm = 4,046.86 L/acre) and per hectare. ET0 is now shown as a column in
  the weather table. Reference (ET0) demand only — no crop coefficient is
  applied, and the UI says so. See `lib/weather.ts` (`waterNeed`).
- **Gross revenue estimate (new)** — forecast yield × dated reference price
  (price per 40 kg × 25 = per tonne), per hectare with the yield band
  applied. Gross, BEFORE costs — never presented as profit. Wheat in
  Faisalabad: ≈ Rs. 401,700/ha (range 388,825–414,575). Rice has no single
  reference price (three varieties), so no estimate is given for it. See
  `lib/revenue.ts`.
- **Crop comparison (new)** — `/api/compare?district=…` and a homepage panel:
  wheat, rice and maize side by side (forecast, band, backtest MAE,
  reference price, gross revenue/ha) for the sowing decision.
- **Voice input (new)** — a microphone button (Web Speech API, `ur-PK` when
  the UI is Urdu, `en-US` in English) so farmers who cannot type can ask by
  speaking. Shown only where the browser supports it; permission denial is
  reported, typing still works.
- **Photo diagnosis (new)** — upload a photo of the affected plant; Gemini
  vision (`gemini-3.8-flash`, same 8s / 2-attempt / 0.5s-backoff budget)
  identifies the disease as strict JSON. Confidence is low/medium/high
  only — never a percentage. The photo is processed in memory and never
  stored. Without a `GEMINI_API_KEY` (or when Gemini fails) the answer is
  an honest "unavailable" with HTTP 200 — never a faked diagnosis. **This
  is AI-assisted identification, NOT a lab test** — the UI and the API
  response both say so, and the farmer is told to confirm with the
  district agriculture office or a plant clinic before spraying.
  See `lib/diagnose.ts`, `/api/diagnose`.
- **Symptom checker (new)** — tick the symptoms you see for wheat, rice,
  maize, cotton, sugarcane or tomato; 22 verified diseases are ranked by
  matched-symptom count, each with treatment, organic alternative and the
  pesticide safety block. No accuracy percentage is claimed anywhere.
  See `lib/symptoms.ts`, `/api/symptoms`.
- **Pesticide safety (new)** — "zehreeli dawa": the DPP/PARC banned list
  (with the "confirm with your district agriculture office" caveat),
  the Punjab 2025 paddy-only ban (12 named of 13 — the 13th name could
  not be verified and is not invented), fake/expired checks, storage,
  disposal and child/animal safety, and a per-disease safety block with
  the WHO class + colour band (Ia/Ib red, II yellow, III blue, U green).
  PHI and re-entry are **null for all 22 diseases** — the UI always shows
  "label ke mutabiq" (per label) and never a number. Virus entries
  (cotton/tomato leaf curl) state there is no chemical cure — the
  pesticide controls only the whitefly vector. See `lib/safety.ts`,
  `/api/safety`.
- **Fertilizer calculator (new)** — Punjab Agriculture Department doses:
  bags (50 kg) per crop and acres, whole bags rounded up. Wheat bags are
  quoted from the department's Nov 2026 advisory; other crops are
  calculated from the department's N-P-K ranges. Where no soil test is
  given (or no verified soil-adjustment rule exists) the standard dose is
  used and labelled **standard-dose**. **Tomato has no verified Punjab
  dose — the calculator refuses it and says so.** See
  `lib/fertilizer.ts`, `/api/fertilizer`.
- **Spray window (new)** — best spraying hours in the next 48h from the
  live Open-Meteo hourly forecast: rain chance < 20%, wind < 15 km/h,
  rain < 0.1 mm (thresholds stated in code, API and UI), plus a day-level
  guide from the daily forecast. See `lib/spray.ts`, `/api/spray`.
- **Seasonal watch (new)** — this month's pest/disease reminders from the
  Punjab cropping calendar; general-guidance entries are labelled as a
  reminder to scout, not a forecast. See `lib/seasonal.ts`,
  `/api/seasonal`.
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
  A **Method & limits** section on the homepage states every source, the
  model method, the backtest, and the limits in plain language.

## Data: what is live, reference, or baseline

| Data | Status | Source |
| --- | --- | --- |
| Weather (7-day forecast) | **LIVE** | Open-Meteo, free, no key |
| Soil properties | **LIVE** | ISRIC SoilGrids v2.0, CC-BY |
| Market prices | **REFERENCE** (published 2–3 Nov 2026) | AMIS Punjab mandi reports (via Zarat Ghar) |
| Yield forecast | **BASELINE** (trend model, method shown) | FAO/OWID Pakistan yield series 1961–2024 |
| Crop calendar | Standard guidance | Punjab crop calendar (PARC/UAF guidance) |
| Crop diseases (22) | **VERIFIED DATASET** (Nov 2026) | Punjab Agriculture Department / WRI, RRI, CCRI guidance; WHO 2019 pesticide classes |
| Pesticide safety / banned list | **VERIFIED DATASET** (Nov 2026) | DPP/PARC banned list (2013/2018); FAO/CropLife counterfeit guidance; WHO 2019 |
| Fertilizer doses | **VERIFIED DATASET** (Nov 2026) | Punjab Agriculture Department N-P-K (Nov 2026 advisory + kg/ha ranges); SBP 2020 cross-check |
| Seasonal watch | **VERIFIED DATASET** (Nov 2026) | Punjab cropping calendar + pest timing from the disease sources |
| Spray window (hourly) | **LIVE** | Open-Meteo hourly forecast |

Honesty rules: a failed live source is reported as unavailable — the answer
never invents weather or soil. No accuracy number, pilot result, or
testimonial is claimed anywhere.

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # vitest, 124 tests
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
- Photo diagnosis is AI-assisted, NOT a lab test — confirm with the
  district agriculture office or a plant clinic before spraying. It needs
  a `GEMINI_API_KEY`; without one it reports honestly as unavailable and
  the symptom checker still works. Confidence is low/medium/high only.
- Pesticide PHI and re-entry intervals are unverified for every product —
  the app shows "label ke mutabiq" (per label) and never a number. The
  banned list rests on the 2013 DPP list / PARC 2018 handbook; the live
  DPP register was not directly accessible — confirm with your district
  agriculture office.
- No tomato fertilizer dose is verified — the calculator refuses tomato
  rather than guessing. Virus diseases (cotton/tomato leaf curl) have no
  chemical cure; the pesticide listed controls only the whitefly vector.
- No accuracy or efficacy percentage is claimed anywhere in the app.
- Backtest honesty note: the trend beats both simple baselines for wheat
  and maize on 2020–2024, but for rice the 5-year average (MAE 0.121)
  beats the trend (MAE 0.168). All three numbers are shown; no baseline is
  hidden.
