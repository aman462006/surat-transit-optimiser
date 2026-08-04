/**
 * decisionInsights — derives the "AI reasoning" layer (confidence, why-bullets,
 * tradeoffs, pros/cons, comfort) from the existing recommendation objects.
 * Pure functions, no side effects — the presentation components stay dumb.
 *
 * Recommendation shape (from recommendationEngine.generateRecommendations):
 *   { id, name, icon, travelTime, tripCost, co2Emissions, co2EmissionsRange?,
 *     walkingRequiredMeters?, transfersRequired?, safetyIndex, accessibilityIndex,
 *     compositeScore, label, labelType, brtsItinerary? }
 */

const MODE_LABEL = { 'electric-bus': 'BRTS', 'auto-pool': 'Auto Pool', 'private-car': 'Private Car' };
export const shortModeLabel = (id) => MODE_LABEL[id] || 'Mode';

const pct = (from, to) => (from <= 0 ? 0 : Math.round(((from - to) / from) * 100));
const walkKm = (o) =>
  o?.brtsItinerary?.walkingDistanceKm != null
    ? o.brtsItinerary.walkingDistanceKm
    : (o?.walkingRequiredMeters ?? 0) / 1000;

/** Comfort score 0..100 from accessibility, safety, walking and transfers. */
export const comfortScore = (o) => {
  if (!o) return 0;
  const access = o.accessibilityIndex ?? 70;
  const safety = o.safetyIndex ?? 70;
  const walkPenalty = Math.min(30, walkKm(o) * 18);
  const transferPenalty = Math.min(18, (o.transfersRequired ?? 0) * 9);
  const raw = access * 0.5 + safety * 0.3 + 20 - walkPenalty * 0.5 - transferPenalty * 0.5;
  return Math.max(20, Math.min(100, Math.round(raw)));
};

/** Confidence % from the composite-score gap between best and runner-up. */
export const recommendationConfidence = (ranked) => {
  if (!ranked || ranked.length < 2) return ranked?.length ? 80 : 0;
  const [best, second] = ranked;
  const gap = Math.max(0, (second.compositeScore ?? 0) - (best.compositeScore ?? 0));
  return Math.max(58, Math.min(97, Math.round(62 + gap * 150)));
};

/** Concise "why this mode wins" bullets, comparing the pick to its rivals. */
export const whyBullets = (recommended, ranked, exposureByMode = {}) => {
  if (!recommended || !ranked?.length) return [];
  const others = ranked.filter((o) => o.id !== recommended.id);
  const out = [];

  const cheapest = [...ranked].sort((a, b) => a.tripCost - b.tripCost)[0];
  const pricier = others.reduce((m, o) => (o.tripCost > m.tripCost ? o : m), others[0]);
  if (recommended.id === cheapest.id && pricier && pricier.tripCost > recommended.tripCost) {
    const p = pct(pricier.tripCost, recommended.tripCost);
    if (p >= 5) out.push(`${p}% cheaper than ${shortModeLabel(pricier.id)}`);
  }

  const greenest = [...ranked].sort((a, b) => a.co2Emissions - b.co2Emissions)[0];
  const dirtier = others.reduce((m, o) => (o.co2Emissions > m.co2Emissions ? o : m), others[0]);
  if (recommended.id === greenest.id && dirtier && dirtier.co2Emissions > recommended.co2Emissions) {
    const p = pct(dirtier.co2Emissions, recommended.co2Emissions);
    if (p >= 10) out.push(`${p}% lower CO₂ than ${shortModeLabel(dirtier.id)}`);
  }

  const fastest = [...ranked].sort((a, b) => a.travelTime - b.travelTime)[0];
  if (recommended.id === fastest.id) {
    out.push('Fastest door-to-door option');
  } else {
    const delta = recommended.travelTime - fastest.travelTime;
    if (delta > 0 && delta <= 8) out.push(`Only ${delta} min slower than the quickest`);
  }

  // Exposure: lowest inhaled PM2.5 among modes with data
  const doses = Object.entries(exposureByMode)
    .filter(([, v]) => v && v.inhaledPm25Ug != null)
    .map(([id, v]) => ({ id, dose: v.inhaledPm25Ug }));
  if (doses.length >= 2) {
    const min = doses.reduce((m, d) => (d.dose < m.dose ? d : m), doses[0]);
    if (min.id === recommended.id) out.push('Lowest PM2.5 you’ll actually breathe');
  }

  if ((recommended.transfersRequired ?? 0) === 0 && recommended.id !== 'private-car') {
    out.push('No transfers — a single direct ride');
  }
  return out.slice(0, 4);
};

/** A single most-salient tradeoff sentence vs the fastest rival. */
export const tradeoff = (recommended, ranked) => {
  if (!recommended || !ranked?.length) return null;
  const fastest = [...ranked].sort((a, b) => a.travelTime - b.travelTime)[0];
  if (!fastest || fastest.id === recommended.id) {
    // Pick the cheapest rival instead
    const rival = ranked.find((o) => o.id !== recommended.id);
    if (!rival) return null;
    const save = rival.travelTime - recommended.travelTime;
    if (save > 0) return `${shortModeLabel(rival.id)} would cost ₹${Math.abs(rival.tripCost - recommended.tripCost)} more to save ${save} min.`;
    return null;
  }
  const mins = recommended.travelTime - fastest.travelTime;
  const co2Ratio = recommended.co2Emissions > 0 ? (fastest.co2Emissions / recommended.co2Emissions) : 0;
  if (mins > 0 && co2Ratio > 1.4) {
    return `Taking ${shortModeLabel(fastest.id)} saves ${mins} min but emits ${co2Ratio.toFixed(1)}× more CO₂.`;
  }
  if (mins > 0) {
    const costDiff = fastest.tripCost - recommended.tripCost;
    if (costDiff > 0) return `${shortModeLabel(fastest.id)} saves ${mins} min but costs ₹${costDiff} more.`;
    return `${shortModeLabel(fastest.id)} is ${mins} min quicker if time matters most.`;
  }
  return null;
};

/** Pros / cons per mode, comparison-aware. */
export const prosCons = (o, ranked) => {
  if (!o) return { pros: [], cons: [] };
  const pros = [];
  const cons = [];
  const others = (ranked || []).filter((x) => x.id !== o.id);
  const minCost = Math.min(o.tripCost, ...others.map((x) => x.tripCost));
  const minCo2 = Math.min(o.co2Emissions, ...others.map((x) => x.co2Emissions));
  const minTime = Math.min(o.travelTime, ...others.map((x) => x.travelTime));
  const w = walkKm(o);

  if (o.tripCost === minCost) pros.push('Lowest cost');
  if (o.co2Emissions === minCo2) pros.push('Greenest choice');
  if (o.travelTime === minTime) pros.push('Fastest trip');

  if (o.id === 'electric-bus') {
    pros.push('Zero-emission electric bus', 'Immune to rush-hour jams (bus lane)');
    if (w >= 0.6) cons.push(`${w.toFixed(1)} km of walking to stations`);
    if ((o.transfersRequired ?? 0) > 0) cons.push(`${o.transfersRequired} transfer${o.transfersRequired > 1 ? 's' : ''}`);
  } else if (o.id === 'auto-pool') {
    pros.push('Door-to-door with minimal walking', 'Shared fare beats driving alone');
    cons.push('Open cabin — higher PM2.5 exposure');
    if (o.travelTime !== minTime) cons.push('Subject to mixed traffic');
  } else if (o.id === 'private-car') {
    pros.push('Fully door-to-door', 'Enclosed cabin lowers exposure');
    if (o.tripCost !== minCost) cons.push('Highest running cost');
    if (o.co2Emissions !== minCo2) cons.push('Highest CO₂ per trip');
  }
  return { pros: pros.slice(0, 3), cons: cons.slice(0, 3) };
};
