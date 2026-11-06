"use client";

import { useState } from "react";
import { DISTRICTS } from "@/lib/districts";
import type { AskResult } from "@/lib/orchestrate";
import type { CropKey } from "@/lib/intent";

type Lang = "ur" | "en";

const CROPS: Array<{ key: CropKey; ur: string; en: string }> = [
  { key: "wheat", ur: "گندم", en: "Wheat" },
  { key: "rice", ur: "چاول", en: "Rice" },
  { key: "maize", ur: "مکئی", en: "Maize" },
  { key: "cotton", ur: "کپاس", en: "Cotton" },
  { key: "sugarcane", ur: "گنا", en: "Sugarcane" },
];

const EXAMPLES_UR = [
  "اس ہفتے گندم کو پانی کب دوں؟",
  "گندم کب بوؤں؟",
  "فیصل آباد میں گندم کا ریٹ کیا ہے؟",
  "اس سال گندم کی پیداوار کتنی ہوگی؟",
];
const EXAMPLES_EN = [
  "When should I irrigate my wheat this week?",
  "When should I sow wheat?",
  "What is the wheat rate in Faisalabad?",
  "What will the wheat yield be this year?",
];

const STR: Record<
  Lang,
  Record<string, string>
> = {
  ur: {
    title: "ایگری ییلڈ ایڈوائزر",
    subtitle:
      "پاکستان کے چھوٹے کسانوں کے لیے اردو میں AI مشیر — موسم، مٹی، منڈی اور پیداوار، ہر نمبر حوالے کے ساتھ۔",
    district: "ضلع",
    crop: "فصل",
    sowingDate: "بوائی کی تاریخ (اختیاری)",
    question: "اپنا سوال لکھیں",
    questionPh: "مثال: اس ہفتے گندم کو پانی کب دوں؟",
    ask: "جواب پوچھیں",
    asking: "جواب تیار ہو رہا ہے…",
    examples: "مثالیں:",
    answer: "جواب",
    citations: "حوالے",
    plan: "بوائی اور پانی کا منصوبہ",
    weather: "موسم — اگلے 7 دن",
    soil: "مٹی (0–5 سینٹی میٹر)",
    market: "منڈی کی قیمتیں",
    yield: "پیداوار کا اندازہ",
    live: "براہ راست",
    reference: "حوالہ — براہ راست نہیں",
    baseline: "بیس لائن ماڈل",
    gemini: "Gemini AI جواب",
    fallback: "طے شدہ جواب (AI دستیاب نہیں)",
    failed: "سوال کا جواب نہیں مل سکا۔ دوبارہ کوشش کریں۔",
    date: "تاریخ",
    max: "زیادہ سے زیادہ",
    min: "کم سے کم",
    rain: "بارش",
    rainChance: "امکان",
    humidity: "نمی",
    wind: "ہوا",
    property: "خاصیت",
    value: "قدر",
    aboutTitle: "اس ایپ کے بارے میں",
    about:
      "AgriYield Advisor ایک AI ڈیٹا ایجنٹ ہے جو DATANOVA 2026 گلوبل ڈیٹا تھون (AI/ML ٹریک) کے لیے بنایا گیا ہے۔ ایجنٹ صرف پڑھتا ہے — کچھ بدلتا نہیں۔ موسم Open-Meteo سے براہ راست، مٹی ISRIC SoilGrids سے براہ راست، منڈی کی قیمتیں AMIS پنجاب کی شائع شدہ رپورٹوں (2–3 نومبر 2026) سے حوالے کے طور پر، اور پیداوار کا اندازہ FAO/OWID پاکستان سیریز (1961–2024) پر فٹ کیے گئے ٹرینڈ ماڈل سے ہے۔ اگر کوئی ذریعہ دستیاب نہ ہو تو جواب صاف کہتا ہے — اندازہ نہیں لگاتا۔",
    builtBy:
      "بنایا: عمر شریف — بی ایس سی ایس (آخری سال)، زرعی یونیورسٹی فیصل آباد، پاکستان۔",
  },
  en: {
    title: "AgriYield Advisor",
    subtitle:
      "An Urdu-first AI advisor for Pakistan's smallholder farmers — weather, soil, market and yield, every number cited.",
    district: "District",
    crop: "Crop",
    sowingDate: "Sowing date (optional)",
    question: "Ask your question",
    questionPh: "Example: When should I irrigate my wheat this week?",
    ask: "Ask",
    asking: "Preparing your answer…",
    examples: "Examples:",
    answer: "Answer",
    citations: "Sources",
    plan: "Sowing & irrigation plan",
    weather: "Weather — next 7 days",
    soil: "Soil (0–5 cm)",
    market: "Market prices",
    yield: "Yield forecast",
    live: "Live",
    reference: "Reference — not live",
    baseline: "Baseline model",
    gemini: "Gemini AI answer",
    fallback: "Deterministic answer (AI unavailable)",
    failed: "Could not answer the question. Please try again.",
    date: "Date",
    max: "Max",
    min: "Min",
    rain: "Rain",
    rainChance: "Chance",
    humidity: "Humidity",
    wind: "Wind",
    property: "Property",
    value: "Value",
    aboutTitle: "About this app",
    about:
      "AgriYield Advisor is an AI data agent built for the DATANOVA 2026 Global Data-thon (AI/ML track). The agent is read-only — it changes nothing. Weather is live from Open-Meteo, soil is live from ISRIC SoilGrids, market prices are a dated reference from AMIS Punjab reports (2–3 Nov 2026), and the yield forecast is a trend model fitted on the FAO/OWID Pakistan series (1961–2024). If a source is unavailable, the answer says so plainly — it never guesses.",
    builtBy:
      "Built by Umar Shareef — BSCS (Final Year), University of Agriculture Faisalabad, Pakistan.",
  },
};

export default function Home() {
  const [lang, setLang] = useState<Lang>("ur");
  const [district, setDistrict] = useState("faisalabad");
  const [crop, setCrop] = useState<CropKey>("wheat");
  const [sowingDate, setSowingDate] = useState("");
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AskResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const t = STR[lang];
  const examples = lang === "ur" ? EXAMPLES_UR : EXAMPLES_EN;

  async function ask(q?: string) {
    const text = (q ?? question).trim();
    if (!text) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: text,
          district,
          crop,
          sowingDate: sowingDate || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? t.failed);
      setResult(data as AskResult);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const w = result?.tools.weather;
  const s = result?.tools.soil;
  const m = result?.tools.market.data;
  const y = result?.tools.yield.data;
  const maxYield = y ? Math.max(...y.seriesLast10.map((p) => p.yield_t_ha)) : 0;

  return (
    <div dir={lang === "ur" ? "rtl" : "ltr"}>
      <header className="hero">
        <div className="container">
          <h1>{t.title}</h1>
          <p className="sub">{t.subtitle}</p>
          <div className="lang-toggle">
            <button
              className={lang === "ur" ? "active" : ""}
              onClick={() => setLang("ur")}
            >
              اردو
            </button>
            <button
              className={lang === "en" ? "active" : ""}
              onClick={() => setLang("en")}
            >
              English
            </button>
          </div>
        </div>
      </header>

      <main className="container">
        <section className="card">
          <div className="row">
            <div>
              <label htmlFor="district">{t.district}</label>
              <select
                id="district"
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
              >
                {DISTRICTS.map((d) => (
                  <option key={d.slug} value={d.slug}>
                    {lang === "ur" ? d.nameUr : d.nameEn}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="crop">{t.crop}</label>
              <select
                id="crop"
                value={crop}
                onChange={(e) => setCrop(e.target.value as CropKey)}
              >
                {CROPS.map((c) => (
                  <option key={c.key} value={c.key}>
                    {lang === "ur" ? c.ur : c.en}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <label htmlFor="sowing">{t.sowingDate}</label>
          <input
            id="sowing"
            type="date"
            value={sowingDate}
            onChange={(e) => setSowingDate(e.target.value)}
          />
          <label htmlFor="q">{t.question}</label>
          <textarea
            id="q"
            value={question}
            placeholder={t.questionPh}
            onChange={(e) => setQuestion(e.target.value)}
          />
          <div className="chips">
            <span className="muted">{t.examples}</span>
            {examples.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => {
                  setQuestion(ex);
                  ask(ex);
                }}
              >
                {ex}
              </button>
            ))}
          </div>
          <button className="ask" disabled={loading} onClick={() => ask()}>
            {loading ? t.asking : t.ask}
          </button>
          {error && <p className="error">{error}</p>}
        </section>

        {result && (
          <>
            <section className="card">
              <h2>
                {t.answer}
                <span
                  className={`badge ${result.answer.source === "gemini" ? "gemini" : "fallback"}`}
                >
                  {result.answer.source === "gemini" ? t.gemini : t.fallback}
                </span>
              </h2>
              {result.answer.fallbackReason && (
                <p className="muted">{result.answer.fallbackReason}</p>
              )}
              <p className="answer">{result.answer.text}</p>
              <h3>{t.citations}</h3>
              <ul className="cites">
                {result.citations.map((c, i) => (
                  <li key={i}>
                    <strong>{c.label}:</strong> {c.detail}{" "}
                    <span className="muted">({c.source})</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="card">
              <h2>{t.plan}</h2>
              <ol className="plan">
                {result.plan.map((step, i) => (
                  <li key={i}>
                    <span className="date">{step.date}</span> —{" "}
                    <strong>{lang === "ur" ? step.titleUr : step.titleEn}</strong>
                    <br />
                    {lang === "ur" ? step.detailUr : step.detailEn}
                    <br />
                    <span className="muted">{step.basis}</span>
                  </li>
                ))}
              </ol>
            </section>

            <section className="card">
              <h2>
                {t.weather}
                <span className="badge live">{t.live}</span>
              </h2>
              {w?.status === "unavailable" ? (
                <div className="warn-box">{w.error}</div>
              ) : (
                <table className="data">
                  <thead>
                    <tr>
                      <th>{t.date}</th>
                      <th>
                        {t.max} °C
                      </th>
                      <th>
                        {t.min} °C
                      </th>
                      <th>
                        {t.rain} (mm)
                      </th>
                      <th>
                        {t.rainChance} %
                      </th>
                      <th>
                        {t.humidity} %
                      </th>
                      <th>
                        {t.wind} km/h
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {w?.days?.map((d) => (
                      <tr key={d.date}>
                        <td>{d.date}</td>
                        <td>{d.tMaxC ?? "—"}</td>
                        <td>{d.tMinC ?? "—"}</td>
                        <td>{d.precipMm ?? "—"}</td>
                        <td>{d.precipProbPct ?? "—"}</td>
                        <td>{d.humidityPct ?? "—"}</td>
                        <td>{d.windKmh ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <p className="muted">Open-Meteo — {result.district.nameEn}</p>
            </section>

            <section className="card">
              <h2>
                {t.soil}
                <span className="badge live">{t.live}</span>
              </h2>
              {s?.status === "unavailable" ? (
                <div className="warn-box">{s.error}</div>
              ) : (
                <table className="data">
                  <thead>
                    <tr>
                      <th>{t.property}</th>
                      <th>0–5 cm</th>
                    </tr>
                  </thead>
                  <tbody>
                    {s?.data?.properties.map((p) => (
                      <tr key={p.name}>
                        <td>
                          {p.label} ({p.unit})
                        </td>
                        <td>
                          {p.values[0]?.mean !== null &&
                          p.values[0]?.mean !== undefined
                            ? p.values[0].mean.toFixed(2)
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <p className="muted">
                ISRIC SoilGrids (250 m) — {result.district.nameEn}. “—” means
                not reported for this point.
              </p>
            </section>

            <section className="card">
              <h2>
                {t.market}
                <span className="badge ref">{t.reference}</span>
              </h2>
              {m ? (
                <>
                  <div className="ref-box">
                    {lang === "ur"
                      ? `یہ براہ راست ریٹ نہیں ہے — ${m.published} کو شائع شدہ حوالہ قیمتیں۔ بیچنے سے پہلے اپنی منڈی سے تصدیق کریں۔`
                      : `Not a live rate — reference prices published ${m.published}. Confirm at your local mandi before selling.`}
                  </div>
                  <table className="data">
                    <tbody>
                      {m.districtPrice !== null && (
                        <tr>
                          <td>
                            {result.district.nameEn} — {m.nameEn}
                          </td>
                          <td>
                            Rs. {m.districtPrice.toLocaleString()} {m.unit}
                          </td>
                        </tr>
                      )}
                      {m.punjabAverage !== null && (
                        <tr>
                          <td>Punjab average</td>
                          <td>
                            Rs. {m.punjabAverage.toLocaleString()} {m.unit}
                          </td>
                        </tr>
                      )}
                      {m.rangeLow !== null && m.rangeHigh !== null && (
                        <tr>
                          <td>Punjab range</td>
                          <td>
                            Rs. {m.rangeLow.toLocaleString()} –{" "}
                            {m.rangeHigh.toLocaleString()} {m.unit}
                          </td>
                        </tr>
                      )}
                      {m.spot !== null && (
                        <tr>
                          <td>Spot rate</td>
                          <td>
                            Rs. {m.spot.toLocaleString()} {m.unit}
                          </td>
                        </tr>
                      )}
                      {m.govtIndicative !== null && (
                        <tr>
                          <td>Govt indicative (2027 crop)</td>
                          <td>
                            Rs. {m.govtIndicative.toLocaleString()} {m.unit}
                          </td>
                        </tr>
                      )}
                      {m.varieties?.map((v) => (
                        <tr key={v.name}>
                          <td>{v.name}</td>
                          <td>
                            Rs. {v.low.toLocaleString()} –{" "}
                            {v.high.toLocaleString()} {m.unit}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {m.comparisonEn && (
                    <p>{lang === "ur" ? m.comparisonUr : m.comparisonEn}</p>
                  )}
                  <p className="muted">{m.source}</p>
                </>
              ) : (
                <div className="warn-box">
                  {result.tools.market.error ?? "No market data for this crop."}
                </div>
              )}
            </section>

            <section className="card">
              <h2>
                {t.yield}
                <span className="badge base">{t.baseline}</span>
              </h2>
              {y ? (
                <>
                  <p>
                    <strong>
                      {y.targetYear}: {y.forecast} t/ha
                    </strong>{" "}
                    (range {y.bandLow}–{y.bandHigh} t/ha)
                  </p>
                  <p className="muted">
                    {lang === "ur"
                      ? `طریقہ: ${y.method} نمونہ میں RMSE ${y.rmse} ٹن/ہیکٹر۔ آخری درج ${y.lastValue} ٹن/ہیکٹر (${y.lastYear})؛ 5 سال کی اوسط ${y.avg5} ٹن/ہیکٹر؛ 10 سال کی اوسط ${y.avg10} ٹن/ہیکٹر۔ یہ قومی اوسط ہے — ضلعی پیداوار مختلف ہو سکتی ہے۔`
                      : `Method: ${y.method} In-sample RMSE ${y.rmse} t/ha. Last observed ${y.lastValue} t/ha (${y.lastYear}); 5-year average ${y.avg5} t/ha; 10-year average ${y.avg10} t/ha. National average — district yields will differ.`}
                  </p>
                  <div className="bars">
                    {y.seriesLast10.map((p) => (
                      <div className="bar" key={p.year}>
                        <div
                          className="fill"
                          style={{
                            height: `${Math.max(8, (p.yield_t_ha / maxYield) * 100)}%`,
                          }}
                        />
                        <div className="lbl">{p.year}</div>
                      </div>
                    ))}
                  </div>
                  <p className="muted">
                    Pakistan {y.nameEn} yield, last 10 years (t/ha). Source:{" "}
                    {y.source}
                  </p>
                </>
              ) : (
                <div className="warn-box">
                  {result.tools.yield.error ?? "No yield forecast for this crop."}
                </div>
              )}
            </section>
          </>
        )}

        <footer>
          <h3>{t.aboutTitle}</h3>
          <p>{t.about}</p>
          <p>{t.builtBy}</p>
        </footer>
      </main>
    </div>
  );
}
