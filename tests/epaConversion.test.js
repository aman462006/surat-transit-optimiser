import { test } from 'node:test';
import assert from 'node:assert/strict';
import { concentrationToAqi } from '../src/utils/cpcbService.js';
import { aqiToPm25Concentration } from '../src/utils/waqiService.js';

// Allow tiny floating-point slack.
const close = (a, b, eps = 0.15) => assert.ok(Math.abs(a - b) <= eps, `${a} ≈ ${b}`);

test('concentrationToAqi: PM2.5 breakpoint anchors map exactly', () => {
  assert.equal(concentrationToAqi('pm25', 0), 0);
  assert.equal(concentrationToAqi('pm25', 12), 50);
  assert.equal(concentrationToAqi('pm25', 35.4), 100);
});

test('concentrationToAqi: PM2.5 = 42 µg/m³ → ~117 (Unhealthy for Sensitive Groups)', () => {
  close(concentrationToAqi('pm25', 42), 117, 1);
});

test('concentrationToAqi: PM10 breakpoint anchors', () => {
  assert.equal(concentrationToAqi('pm10', 54), 50);
  assert.equal(concentrationToAqi('pm10', 155), 101);
});

test('concentrationToAqi: unknown pollutant or bad input returns null', () => {
  assert.equal(concentrationToAqi('xyz', 10), null);
  assert.equal(concentrationToAqi('pm25', -5), null);
});

test('aqiToPm25Concentration: inverts the EPA breakpoints', () => {
  assert.equal(aqiToPm25Concentration(0), 0);
  close(aqiToPm25Concentration(50), 12.0);
  close(aqiToPm25Concentration(93), 32.1); // matches a real Surat reading
});

test('round-trip: concentration → AQI → concentration is stable', () => {
  const conc = 28.5;
  const aqi = concentrationToAqi('pm25', conc);
  close(aqiToPm25Concentration(aqi), conc, 0.6);
});
