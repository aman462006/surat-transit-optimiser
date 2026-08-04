import React from 'react';
import Icon from '../ui/Icon';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import { useTheme } from '../../context/ThemeContext';

const FEATURES = [
  { icon: 'bus', title: 'BRTS journey planning (A*)', body: 'Plans the best Surat Sitilink BRTS trip over a real station graph — bus legs, transfers, and first/last-mile walks — using A* search with a traffic-physics travel-time model.' },
  { icon: 'route', title: 'Exposure-aware road routing', body: 'A breadth-first search builds many real road corridors, then ranks them three ways: Fastest, Cleanest Air (lowest PM2.5), and a Balanced ½-time + ½-air pick.' },
  { icon: 'wind', title: 'Personal pollution exposure', body: 'Not just ambient AQI — how much PM2.5 you actually breathe in each mode, adjusting for the microenvironment (open auto vs enclosed AC car) and trip duration.' },
  { icon: 'shield', title: 'Honest, multi-source air quality', body: 'Live CPCB ground sensors first, then a WAQI station, then the Copernicus CAMS model — and the screen always tells you which source it used.' },
  { icon: 'zap', title: 'Traffic-aware ETAs', body: 'Live TomTom traffic via a backend proxy, falling back to an on-device, self-calibrating Surat congestion model with rush-hour curves and Tapi-bridge queueing.' },
  { icon: 'wallet', title: 'Fare profiles & SMC concessions', body: 'Pick your rider profile (standard, digital, student, senior, prepaid pass) to apply the right BRTS discount — with links to apply officially.' },
  { icon: 'scale', title: 'Side-by-side mode comparison', body: 'Compare BRTS, shared auto, and a private-car baseline head-to-head on time, cost, CO₂ and convenience — so the trade-offs are obvious.' },
  { icon: 'map', title: 'Real road-following maps', body: 'Every route is snapped to the actual street network via OSRM and drawn turn-by-turn, never as a straight line across the city.' },
];

const AUDIENCE = [
  { icon: 'clock', title: 'Daily commuters', body: 'See whether BRTS, an auto or your car wins today on time, cost and pollution.' },
  { icon: 'wallet', title: 'Students & seniors', body: 'Apply the right concession and see the real discounted fare — with how to get it.' },
  { icon: 'wind', title: 'Health-conscious riders', body: 'Pick the lowest-exposure route and mode, not just the fastest.' },
  { icon: 'leaf', title: 'Eco-minded travellers', body: 'Compare CO₂ across modes and lean toward transit when the trade-off is small.' },
];

const ACCURACY = [
  { metric: 'Trip distance', kind: 'measured', body: 'OSRM real-road geometry, cross-checked live against TomTom’s router — green under ~5%, amber under ~15%.' },
  { metric: 'Travel time / ETA', kind: 'measured', body: 'Live TomTom traffic-aware time when online; offline, a self-calibrating Surat model measured against TomTom whenever available.' },
  { metric: 'BRTS fare', kind: 'exact', body: 'A deterministic lookup of official SMC Sitilink distance slabs (₹5 → ₹25 cap). No statistical error by design.' },
  { metric: 'Auto / car cost & fuel', kind: 'modeled', body: 'Distance × metered-fare or fuel-price formula. Depends on editable assumptions — an estimate, not a quote.' },
  { metric: 'CO₂ emissions', kind: 'modeled', body: 'Fuel or energy used × standard emission factors. A well-grounded estimate.' },
  { metric: 'Air quality (AQI / PM2.5)', kind: 'measured', body: 'Live CPCB sensors interpolated along your route where available; else a WAQI station, then the CAMS model.' },
  { metric: 'Personal exposure dose', kind: 'modeled', body: 'Ambient PM2.5 × a microenvironment factor × time. Literature-informed estimates, not a personal measurement.' },
];

const KIND = { measured: { label: 'Measured', tone: 'success' }, exact: { label: 'Exact', tone: 'accent' }, modeled: { label: 'Modeled', tone: 'warning' } };

/**
 * LandingPage — startup-grade intro. Hero + who-it-helps + features + honest
 * accuracy table. "Open the planner" enters the app. Content preserved from the
 * original About page.
 */
const LandingPage = ({ onProceed }) => {
  const { theme, toggleTheme } = useTheme();
  return (
    <div className="landing">
      <header className="landing-nav">
        <div className="topnav-brand">
          <span className="brand-mark"><Icon name="logo" size={19} strokeWidth={2.4} /></span>
          <span className="brand-title">Surat Transit Optimiser</span>
        </div>
        <div className="landing-nav-actions">
          <Button variant="ghost" size="md" iconOnly onClick={toggleTheme} aria-label="Toggle theme" icon={<Icon name={theme === 'dark' ? 'sun' : 'moon'} size={18} />} />
          <Button variant="primary" size="md" onClick={onProceed} trailingIcon={<Icon name="arrowRight" size={16} />}>Open planner</Button>
        </div>
      </header>

      <div className="landing-scroll">
        {/* Hero */}
        <section className="landing-hero">
          <Badge tone="accent" variant="soft" size="md" className="landing-eyebrow">
            <Icon name="sparkles" size={13} /> Intelligent multimodal transport decisions
          </Badge>
          <h1 className="landing-h1">
            Plan a Surat trip by time, cost,<br /><span className="landing-h1-accent">and the air you’ll breathe.</span>
          </h1>
          <p className="landing-lead">
            A door-to-door planner that compares the BRTS, a shared auto and a private car — not just on
            speed and price, but on CO₂ and the PM2.5 you actually inhale. Every figure says whether it’s
            measured or modeled.
          </p>
          <div className="landing-cta">
            <Button variant="primary" size="lg" onClick={onProceed} trailingIcon={<Icon name="arrowRight" size={18} />}>Open the planner</Button>
            <span className="landing-cta-sub">BRTS · Auto · Private Car · Live air quality</span>
          </div>
          <div className="landing-hero-stats">
            <div className="hero-stat"><span className="hero-stat-val">4</span><span className="hero-stat-label">metrics compared</span></div>
            <div className="hero-stat"><span className="hero-stat-val">3</span><span className="hero-stat-label">travel modes</span></div>
            <div className="hero-stat"><span className="hero-stat-val">3</span><span className="hero-stat-label">air-quality sources</span></div>
            <div className="hero-stat"><span className="hero-stat-val">A*</span><span className="hero-stat-label">transit pathfinding</span></div>
          </div>
        </section>

        {/* Audience */}
        <section className="landing-section">
          <h2 className="landing-h2">Built for real commuting decisions</h2>
          <p className="landing-section-lead">Most maps optimise for time alone. Real decisions also weigh money, health and convenience.</p>
          <div className="landing-audience">
            {AUDIENCE.map((a) => (
              <div key={a.title} className="audience-card">
                <span className="audience-icon"><Icon name={a.icon} size={18} /></span>
                <h4>{a.title}</h4>
                <p>{a.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Features */}
        <section className="landing-section">
          <h2 className="landing-h2">Everything it does</h2>
          <div className="landing-features">
            {FEATURES.map((f) => (
              <div key={f.title} className="feature-card">
                <span className="feature-icon"><Icon name={f.icon} size={19} /></span>
                <h4>{f.title}</h4>
                <p>{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Accuracy */}
        <section className="landing-section">
          <h2 className="landing-h2">How accurate is it?</h2>
          <p className="landing-section-lead">We don’t fake precision. Where the app can check itself against a live source, it shows the real ± error; where a number is modeled, it’s labelled as an estimate.</p>
          <div className="landing-accuracy">
            {ACCURACY.map((a) => (
              <div key={a.metric} className="accuracy-row">
                <div className="accuracy-head">
                  <span className="accuracy-metric">{a.metric}</span>
                  <Badge tone={KIND[a.kind].tone} variant="soft" size="sm">{KIND[a.kind].label}</Badge>
                </div>
                <p>{a.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Final CTA */}
        <section className="landing-final">
          <h2 className="landing-h2">Ready to plan a smarter trip?</h2>
          <Button variant="primary" size="lg" onClick={onProceed} trailingIcon={<Icon name="arrowRight" size={18} />}>Open the planner</Button>
          <p className="landing-footer">Built for Surat urban mobility · BRTS · Auto · Private Car</p>
        </section>
      </div>
    </div>
  );
};

export default LandingPage;
