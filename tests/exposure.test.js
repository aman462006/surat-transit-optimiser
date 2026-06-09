import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyAqi,
  classifyPm25,
  getModeExposureFactor,
  computeModeExposure
} from '../src/utils/airQualityService.js';

const close = (a, b, eps = 0.15) => assert.ok(Math.abs(a - b) <= eps, `${a} ≈ ${b}`);

test('classifyAqi: official US-EPA band boundaries', () => {
  assert.equal(classifyAqi(50).level, 'good');
  assert.equal(classifyAqi(51).level, 'moderate');
  assert.equal(classifyAqi(100).level, 'moderate');
  assert.equal(classifyAqi(101).level, 'usg');
  assert.equal(classifyAqi(200).level, 'unhealthy');
  assert.equal(classifyAqi(201).level, 'very-unhealthy');
  assert.equal(classifyAqi(450).level, 'hazardous');
});

test('classifyPm25: concentration bands', () => {
  assert.equal(classifyPm25(12).level, 'good');
  assert.equal(classifyPm25(35.4).level, 'moderate');
  assert.equal(classifyPm25(35.5).level, 'usg');
  assert.equal(classifyPm25(60).level, 'unhealthy');
});

test('getModeExposureFactor: enclosed car < bus < open auto', () => {
  const car = getModeExposureFactor('private-car');
  const bus = getModeExposureFactor('electric-bus');
  const auto = getModeExposureFactor('auto-pool');
  assert.equal(car, 0.40);   // windows closed, AC: midpoint of 20–60%
  assert.equal(auto, 0.83);  // open three-wheeler: midpoint of 70–95%
  assert.ok(car < bus && bus < auto, 'ordering car < bus < auto');
});

test('getModeExposureFactor: BRTS blends walk + ride legs by time', () => {
  const itinerary = { itinerary: [
    { type: 'walk', durationMins: 10 },
    { type: 'ride', durationMins: 30 }
  ] };
  // (10*1.0 + 30*0.75) / 40 = 0.8125
  close(getModeExposureFactor('electric-bus', itinerary), 0.8125, 0.02);
});

test('computeModeExposure: open auto inhales more than enclosed car (same trip)', () => {
  const ambient = { ok: true, avgPm25: 40 };
  const auto = computeModeExposure(ambient, { modeId: 'auto-pool', durationMins: 30 });
  const car = computeModeExposure(ambient, { modeId: 'private-car', durationMins: 30 });

  assert.equal(auto.effectivePm25, 33.2);  // 40 × 0.83
  assert.equal(car.effectivePm25, 16);     // 40 × 0.40
  close(auto.inhaledPm25Ug, 13.94);        // 33.2 × 0.84 × 0.5h
  close(car.inhaledPm25Ug, 6.72);          // 16 × 0.84 × 0.5h
  assert.ok(auto.inhaledPm25Ug > car.inhaledPm25Ug, 'auto worse than car');
});

test('computeModeExposure: longer time raises the dose', () => {
  const ambient = { ok: true, avgPm25: 40 };
  const short = computeModeExposure(ambient, { modeId: 'private-car', durationMins: 15 });
  const long = computeModeExposure(ambient, { modeId: 'private-car', durationMins: 45 });
  assert.ok(long.dosePm25 > short.dosePm25);
});

test('computeModeExposure: guards bad input', () => {
  assert.equal(computeModeExposure(null, { modeId: 'private-car', durationMins: 10 }), null);
  assert.equal(computeModeExposure({ ok: true, avgPm25: 40 }, { modeId: 'x', durationMins: 0 }), null);
});
