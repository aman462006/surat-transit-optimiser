# Route-Variation Study: "Cleanest Air" vs Fastest

Generated: 2026-10-15T16:40:00.548Z by `scripts/route_variation_study.js` (deterministic, cache-backed rerun).

## Question

Is the "cleanest air" route meaningfully different from the fastest across a
fixed, pre-registered set of 30 Surat OD pairs, or is the difference
negligible enough that the feature overpromises?

## Method

The pairs in `scripts/od_pairs.json` were written **before** any run, taken
verbatim from the repo's own city model, and spread deliberately across short /
medium / long trips, Tapi-river crossings, BRTS corridors, the industrial south,
the coast, and the outskirts. No pair was chosen, added, or removed after seeing
results. The route pipeline (`computeRoadRouteOptions`) was not modified: BFS
corridor enumeration + A* fastest + per-corridor exposure + traffic ETA run
exactly as in production. Departure window fixed to `morning-rush`.

Data sources during this run (honest disclosure):

* OpenAQ (CPCB ground sensors): key present, live
* WAQI: no token — layer skipped (falls through to CAMS where needed)
* data.gov.in: no key — legacy path skipped
* TomTom: key present, live ETAs
* CAMS via Open-Meteo: keyless, available as the coarse fallback (~40 km grid)

All HTTP responses are cached in `scripts/.study_cache/`, so reruns replay the
same bytes: this report is reproducible. `--fresh` busts the cache.

## Raw results

| # | OD pair | Straight-line km | Corridors | Fastest PM2.5 | Cleanest PM2.5 | Balanced PM2.5 | Δ PM2.5 (µg/m³) | Δ time (min) | Δ dist (km) | AQ source |
|---|---------|------------------|-----------|---------------|----------------|----------------|-----------------|--------------|-------------|-----------|
| 1 | Surat Railway Station Hub → Katargam Darwaja BRTS | 0.7 | 16 | 56.4 | 56.4 | 56.4 | 0 | 0 | 0 | cpcb *(collapsed: short-trip)* |
| 2 | Katargam BRTS Station → Adajan Circle BRTS | 6.1 | 17 | 53.1 | 52.3 | 52.3 | 0.8 | -2 | 0.2 | cpcb |
| 3 | Hirabaug BRTS Station → Piplod BRTS Station | 9.8 | 16 | 51.5 | 51.5 | 51.5 | 0 | 0 | 0 | cpcb *(collapsed: tie/identical air)* |
| 4 | Varachha BRTS Station → SVNIT BRTS Station | 10.1 | 16 | 51.5 | 51.5 | 51.5 | 0 | 0 | 0 | cpcb *(collapsed: tie/identical air)* |
| 5 | Kapodra BRTS Station → Vesu BRTS Station | 14 | 17 | 50.6 | 50.5 | 50.7 | 0.1 | 7 | 0.9 | cpcb |
| 6 | Amroli BRTS Station → Althan Depot BRTS Terminal | 8.8 | 16 | 53.8 | 52.5 | 53.2 | 1.3 | 5 | 1.4 | cpcb |
| 7 | Ved Gam BRTS Station → Bhatar BRTS Station | 5.2 | 17 | 52.4 | 52.4 | 52.4 | 0 | 0 | 0 | cpcb *(collapsed: tie/identical air)* |
| 8 | Variav BRTS Station → Adajan Patiya BRTS | 6.9 | 17 | 55.1 | 52.7 | 52.7 | 2.4 | -22 | -2.9 | cpcb |
| 9 | Rander Road BRTS Station → Majura Gate BRTS Hub | 3.6 | 17 | 50.1 | 48.2 | 48.2 | 1.9 | -5 | -1.1 | cpcb |
| 10 | Surat Railway Station Hub → Dumas Beach Terminal | 18.7 | 16 | 47.7 | 47.7 | 47.7 | 0 | 0 | 0 | cpcb *(collapsed: tie/identical air)* |
| 11 | SVNIT BRTS Station → Sachin G.I.D.C. Naka BRTS | 11.2 | 17 | 46.6 | 46.4 | 46.4 | 0.2 | -5 | -0.3 | cpcb |
| 12 | Piplod BRTS Station → Pandesara G.I.D.C. BRTS | 9.1 | 17 | 46 | 46 | 46 | 0 | 0 | 0 | cpcb *(collapsed: tie/identical air)* |
| 13 | Adajan Patiya BRTS → Kadodara BRTS Terminal | 11.4 | 16 | 46.9 | 46.9 | 46.9 | 0 | 0 | 0 | cpcb *(collapsed: tie/identical air)* |
| 14 | Vesu BRTS Station → Kumbharia BRTS Station | 10.8 | 16 | 47.4 | 47.3 | 47.3 | 0.1 | -12 | -0.3 | cpcb |
| 15 | Dumas Beach Terminal → Sarthana Nature Park BRTS | 25.3 | 17 | 49.5 | 48.2 | 49.1 | 1.3 | 30 | 8 | cpcb |
| 16 | Olpad BRTS Terminal → Ring Road BRTS Station | 16.7 | 16 | 52.2 | 52.1 | 52.1 | 0.1 | -5 | -7 | cpcb |
| 17 | Sayan BRTS Terminal → Udhna Darwaja BRTS | 15.1 | 16 | 54.9 | 54.4 | 54.5 | 0.5 | 7 | -1.3 | cpcb |
| 18 | Kamrej BRTS Terminal → Bombay Market BRTS Station | 12.7 | 17 | 54 | 54 | 54 | 0 | 0 | 0 | cpcb *(collapsed: tie/identical air)* |
| 19 | Pasodara Gam BRTS Station → Parvat Patia BRTS Station | 10.8 | 16 | 53.9 | 53.9 | 53.9 | 0 | -8 | -3.1 | cpcb |
| 20 | Mota Varachha BRTS Station → Athwa Gate BRTS Station | 10 | 16 | 54.5 | 53.7 | 53.7 | 0.8 | -25 | -0.6 | cpcb |
| 21 | Kosad Bus Depot BRTS → Adajan Circle BRTS | 9.6 | 17 | 51.7 | 51.7 | 51.7 | 0 | -4 | -2.2 | cpcb |
| 22 | Utran R.O.B. Bridge BRTS → Gavier BRTS Station | 19 | 17 | 50.5 | 50.5 | 50.5 | 0 | 0 | 0 | cpcb *(collapsed: tie/identical air)* |
| 23 | Ugat BRTS Station → Bhulka Vihar School BRTS | 4.7 | 16 | 47.8 | 47.4 | 47.4 | 0.4 | -10 | -1.2 | cpcb |
| 24 | Jahangirpura Community Hall BRTS → Pal R.T.O. BRTS Station | 5.7 | 17 | 47.7 | 47.7 | 47.7 | 0 | 0 | 0 | cpcb *(collapsed: tie/identical air)* |
| 25 | Vivekanand College BRTS → Chiku Wadi BRTS Station | 9.6 | 16 | 49.3 | 49.3 | 49.3 | 0 | 0 | 0 | cpcb *(collapsed: tie/identical air)* |
| 26 | ONGC Colony Terminal → Majura Gate BRTS Hub | 9.1 | 16 | 45.8 | 45.8 | 45.8 | 0 | 0 | 0 | cpcb *(collapsed: tie/identical air)* |
| 27 | Gajera Circle BRTS Hub → St Thomas School Junction BRTS | 10 | 16 | 49.8 | 49.4 | 49.4 | 0.4 | -6 | 0 | cpcb |
| 28 | Bhestan Garden BRTS Station → Udhna Academy BRTS | 4.9 | 17 | 48.9 | 48.9 | 49 | 0 | 0 | 0 | cpcb *(collapsed: tie/identical air)* |
| 29 | Dindoli Gam BRTS Station → Kumbharia BRTS Station | 5.2 | 16 | 51.4 | 51.4 | 51.4 | 0 | 0 | 0 | cpcb *(collapsed: tie/identical air)* |
| 30 | Magdalla BRTS Station → Godadara BRTS Station | 17 | 17 | 47.8 | 47.8 | 47.8 | 0 | 0 | 0 | cpcb *(collapsed: tie/identical air)* |

*Δ PM2.5 = fastest minus cleanest (positive = cleanest is cleaner). Δ time/dist = cleanest minus fastest. PM2.5 values are average concentrations along the corridor, µg/m³, µg = micrograms.*

## Summary

* Trips analysed: **30** of 30 (0 failed to resolve a road geometry)
* Trips with usable exposure data: **30**
* Trips where cleanest beats fastest by **≥1 µg/m³**: **4** — **13%** of trips with data
* Median PM2.5 difference (fastest − cleanest): **0 µg/m³**
* Median time penalty, all trips: **0 min**
* Trips that diverged (a cleanest route was actually offered): **15 (50%)**
  * Median PM2.5 difference among divergent trips: **0.4 µg/m³**
  * Median time penalty among divergent trips: **-5 min**
  * Median distance penalty among divergent trips: **-0.6 km**
* Trips that collapsed to a single route: **15 (50%)**
  * Collapse reasons: short-trip: 1; tie/identical air: 14
* AQ source mix: cpcb: 30

## Conclusion

The difference is mostly negligible: fewer than a quarter of trips have a ≥1 µg/m³ gap between the fastest and the cleanest corridor. The feature should be relabelled **"exposure-aware (limited by sensor density)"** rather than suggesting a meaningfully "cleaner" route exists.

This verdict is computed from the numbers above with thresholds fixed in
advance (≥1 µg/m³ as "meaningful", 25% and 50% of trips as the banding). If the
run used the calibrated offline traffic model rather than live TomTom ETAs, the
absolute minutes carry model uncertainty, but the fastest-vs-cleanest ordering
and the PM2.5 differences — the substance of this study — are unaffected by
that caveat. Sensor density is the binding constraint: with only a handful of
ground monitors in the city, most corridors sample the same interpolated air.
