import React from 'react';

/**
 * AboutPage
 * Full-screen intro shown on startup. Explains what the optimizer does, who it
 * helps and how, walks through every feature, and is honest about the accuracy
 * and measured error of each calculation. A "Proceed" button enters the app.
 */

const FEATURES = [
  { icon: '🚌', title: 'BRTS journey planning (A*)',
    body: 'Plans the best Surat Sitilink BRTS trip over a real station graph — bus legs, transfers, and the first/last-mile walks to and from stations — using A* search with a traffic-physics travel-time model.' },
  { icon: '🛣️', title: 'Exposure-aware road routing (car & auto)',
    body: 'A breadth-first search builds many real road corridors between your points, then ranks them three ways: Fastest, Cleanest Air (lowest PM2.5), and a Balanced ½-time + ½-air pick.' },
  { icon: '🫁', title: 'Personal pollution exposure',
    body: 'Not just the ambient AQI — how much PM2.5 you actually breathe in each mode, adjusting for the microenvironment (an open auto exposes you to far more than an enclosed AC car) and how long the trip takes.' },
  { icon: '🛰️', title: 'Honest, multi-source air quality',
    body: 'Live CPCB ground sensors first, then a WAQI station, then the Copernicus CAMS model — and the screen always tells you which source it used and how far the nearest sensor is.' },
  { icon: '🚦', title: 'Traffic-aware ETAs',
    body: 'Live TomTom traffic via a backend proxy, falling back to an on-device, self-calibrating Surat congestion model with rush-hour curves and Tapi-bridge queueing.' },
  { icon: '🎫', title: 'Fare profiles & SMC concessions',
    body: 'Pick your rider profile (standard, digital, student, senior, prepaid pass) to apply the right BRTS discount — with plain explanations of each scheme and links to apply officially.' },
  { icon: '⚖️', title: 'Side-by-side mode comparison',
    body: 'Compare BRTS, shared auto, and a private-car baseline head-to-head on time, cost, CO₂ and convenience — so the trade-offs are obvious.' },
  { icon: '🗺️', title: 'Real road-following maps',
    body: 'Every route is snapped to the actual street network via OSRM and drawn turn-by-turn, never as a straight line across the city.' }
];

const ACCURACY = [
  { metric: 'Trip distance', kind: 'measured',
    body: 'OSRM real-road geometry, cross-checked live against TomTom’s router. The app shows the actual ± difference; it flags it green under ~5% and amber under ~15%. The two engines differ only by slightly different road/turn choices.' },
  { metric: 'Travel time / ETA', kind: 'measured',
    body: 'When online, this is live TomTom traffic-aware time (real, not modeled). Offline, an on-device Surat congestion model is used and its error is measured against TomTom whenever available — typically within ~10% (green), and it self-corrects over time by learning from past live samples.' },
  { metric: 'BRTS fare', kind: 'exact',
    body: 'A deterministic lookup of the official SMC Sitilink distance slabs (₹5 → ₹25 cap). There is no statistical error by design — it matches the published fare structure. Discount percentages for passes/concessions are modeled; confirm current rates on the official Sitilink pages.' },
  { metric: 'Auto / car cost & fuel', kind: 'modeled',
    body: 'Derived from the trip distance × a metered-fare or fuel-price formula. Accuracy depends on assumptions you can edit (fuel price, mileage) and on the distance above — it’s an estimate, not a quote.' },
  { metric: 'CO₂ emissions', kind: 'modeled',
    body: 'Fuel or energy used × standard emission factors (kg CO₂ per litre/kg). These are reference values, so treat the figure as a well-grounded estimate.' },
  { metric: 'Air quality (AQI / PM2.5)', kind: 'measured',
    body: 'Best case: live CPCB sensors interpolated along your route (genuinely measured). If none are near, a WAQI station, then the CAMS model (~40 km grid, coarser). The app states the source and sensor distance, so you always know how measured vs modeled the number is.' },
  { metric: 'Personal exposure dose', kind: 'modeled',
    body: 'Ambient PM2.5 × a microenvironment factor (AC car ~0.5×, auto ~1.5×, bus ~0.7×, walking ~1.2×) × time. The factors are literature-informed estimates, not a personal measurement.' }
];

const KIND_LABEL = { measured: 'Measured', exact: 'Exact', modeled: 'Modeled estimate' };

const AboutPage = ({ onProceed }) => {
  return (
    <div className="about-page">
      <div className="about-inner">

        <header className="about-hero">
          <span className="about-eyebrow">Surat Smart Transport Optimizer</span>
          <h1>Plan a Surat trip by time, cost, <em>and</em> the air you’ll breathe.</h1>
          <p className="about-lead">
            A door-to-door planner for Surat that compares the BRTS, a shared auto, and a private car —
            not just on speed and price, but on CO₂ and the PM2.5 you actually inhale on the way.
            It’s built to be honest: every figure says whether it’s measured or modeled.
          </p>
        </header>

        <section className="about-section">
          <h2>Why it’s helpful — and who it helps most</h2>
          <p>
            Most maps optimise for time alone. Real commuting decisions also weigh money, health and
            convenience. This tool puts all of them on one screen so you can make an informed choice in seconds.
          </p>
          <div className="about-audience">
            <div className="about-audience-card">
              <span className="about-audience-icon">🧑‍💼</span>
              <h4>Daily Surat commuters</h4>
              <p>See, side by side, whether BRTS, an auto or your car wins today on time, cost and pollution.</p>
            </div>
            <div className="about-audience-card">
              <span className="about-audience-icon">🎓</span>
              <h4>Students &amp; seniors</h4>
              <p>Apply the right concession (SARAL pass, senior discount) and see the real discounted fare — with how to get it.</p>
            </div>
            <div className="about-audience-card">
              <span className="about-audience-icon">🫁</span>
              <h4>Health-conscious riders</h4>
              <p>People with asthma, kids or the elderly can pick the lowest-exposure route and mode, not just the fastest.</p>
            </div>
            <div className="about-audience-card">
              <span className="about-audience-icon">🌱</span>
              <h4>Eco-minded travellers</h4>
              <p>Compare CO₂ across modes and lean toward public transit when the trade-off is small.</p>
            </div>
          </div>
        </section>

        <section className="about-section">
          <h2>How to use it</h2>
          <ol className="about-steps">
            <li><strong>Set your start and destination</strong> — click the map or search for a place.</li>
            <li><strong>Pick a travel mode</strong> from the strip — BRTS, Auto Pool, or Private Car. The map and details update instantly.</li>
            <li><strong>For BRTS</strong>, choose your fare profile in the popup (student, senior, pass…) to apply the right discount.</li>
            <li><strong>For car / auto</strong>, switch between Fastest, Cleanest Air and Balanced road routes.</li>
            <li><strong>Open the side-by-side comparison</strong> to weigh all modes on time, cost, CO₂ and convenience at once.</li>
            <li><strong>Check the exposure card</strong> to see the air quality and the PM2.5 you’d breathe on the trip.</li>
          </ol>
        </section>

        <section className="about-section">
          <h2>Everything it does</h2>
          <div className="about-feature-grid">
            {FEATURES.map((f) => (
              <div key={f.title} className="about-feature-card">
                <span className="about-feature-icon">{f.icon}</span>
                <h4>{f.title}</h4>
                <p>{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="about-section">
          <h2>How accurate is it?</h2>
          <p className="about-accuracy-note">
            We don’t fake precision. Where the app can check itself against a live source, it shows the
            real ± error on screen; where a number is modeled, it’s labelled as an estimate. Here’s the honest
            breakdown per calculation:
          </p>
          <div className="about-accuracy-list">
            {ACCURACY.map((a) => (
              <div key={a.metric} className="about-accuracy-row">
                <div className="about-accuracy-head">
                  <span className="about-accuracy-metric">{a.metric}</span>
                  <span className={`about-accuracy-tag tag-${a.kind}`}>{KIND_LABEL[a.kind]}</span>
                </div>
                <p>{a.body}</p>
              </div>
            ))}
          </div>
          <p className="about-accuracy-fineprint">
            Air-quality data depends on government feeds (CPCB / data.gov.in) that occasionally rate-limit;
            when they’re down the app falls back to the coarser CAMS model and says so. Fare concession rules
            and prices follow official SMC Sitilink schemes and can change — always confirm on the linked pages.
          </p>
        </section>

        <div className="about-cta">
          <button type="button" className="about-proceed-btn" onClick={onProceed}>
            Proceed to the planner →
          </button>
          <p className="about-cta-sub">Built for Surat urban mobility · BRTS · Auto · Private Car</p>
        </div>

      </div>
    </div>
  );
};

export default AboutPage;
