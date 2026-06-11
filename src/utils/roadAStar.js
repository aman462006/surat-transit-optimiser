/**
 * A* Fastest Road-Route Search
 *
 * BFS (bfsRouteGenerator.js) is a candidate GENERATOR — it fans out many real
 * corridors so "Cleanest Air" and "Balanced" have a pool to rank over. Picking
 * the FASTEST of those by a plain argmin was never a search; it just scanned a
 * list. This module instead SOLVES for the fastest corridor with A*.
 *
 * The open road network isn't stored as a graph (OSRM returns one geometry per
 * request), so — exactly as the BFS generator does — we build a small layered
 * graph and search it:
 *
 *   layer 0      = source
 *   layers 1..K  = the K waypoint columns (M lateral offsets each)
 *   layer K+1    = destination
 *
 * Every node in a layer connects to every node in the next layer (a layered
 * DAG). Each edge is routed once through OSRM so its weight is the REAL
 * free-flow road time (minutes) between those two points. A* then settles the
 * minimum-time source→destination path:
 *
 *   f(node) = g(node) + h(node)
 *   g       = real road minutes accumulated from the source
 *   h       = haversine(node, destination) / MAX_ROAD_KMH * 60   (minutes)
 *
 * h is an ADMISSIBLE, consistent heuristic: nothing on a road travels faster
 * than MAX_ROAD_KMH, so the straight-line-at-top-speed time can never exceed
 * the true remaining time — A* therefore returns the optimal corridor and, with
 * a consistent heuristic, the first time the destination is popped it is final.
 *
 * The winning column sequence is realized as a single real OSRM route (almost
 * always a cache hit, since the BFS generator already routed that via-sequence)
 * and returned in the same shape BFS routes use, so the exposure/traffic scoring
 * downstream consumes it unchanged.
 */

import { buildWaypointColumns } from './bfsRouteGenerator.js';
import { fetchRoadRoute } from './osrmService.js';

// Upper bound on any free-flow road speed OSRM could imply for a Surat segment.
// Kept generously high so the heuristic stays an admissible LOWER bound on the
// remaining time (a higher cap can only ever UNDER-estimate, never over-).
const MAX_ROAD_KMH = 100;

// Throttle edge routing to stay kind to the public OSRM demo server, matching
// the BFS generator's budget.
const OSRM_CONCURRENCY = 5;

/** Great-circle distance (km) between two {lat,lng} points. */
const haversineKm = (a, b) => {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
};

/** Runs async thunks in fixed-size batches to throttle outbound requests. */
const runThrottled = async (thunks, batchSize) => {
  const results = [];
  for (let i = 0; i < thunks.length; i += batchSize) {
    const batch = thunks.slice(i, i + batchSize);
    results.push(...(await Promise.all(batch.map((t) => t()))));
  }
  return results;
};

/**
 * Binary Min-Heap keyed on a node's `f` score (g + h) — the A* frontier.
 * O(log n) push/pop instead of an O(n) scan for the cheapest open node.
 */
class MinHeap {
  constructor() { this.nodes = []; }
  get size() { return this.nodes.length; }

  push(node) {
    const nodes = this.nodes;
    nodes.push(node);
    let i = nodes.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (nodes[parent].f <= nodes[i].f) break;
      [nodes[parent], nodes[i]] = [nodes[i], nodes[parent]];
      i = parent;
    }
  }

  pop() {
    const nodes = this.nodes;
    const top = nodes[0];
    const last = nodes.pop();
    if (nodes.length > 0) {
      nodes[0] = last;
      let i = 0;
      const n = nodes.length;
      while (true) {
        const left = 2 * i + 1;
        const right = 2 * i + 2;
        let smallest = i;
        if (left < n && nodes[left].f < nodes[smallest].f) smallest = left;
        if (right < n && nodes[right].f < nodes[smallest].f) smallest = right;
        if (smallest === i) break;
        [nodes[smallest], nodes[i]] = [nodes[i], nodes[smallest]];
        i = smallest;
      }
    }
    return top;
  }
}

/**
 * Solves for the fastest real-road corridor between two points with A* over the
 * layered waypoint graph. Returns a single realized route in the BFS route shape
 * ({coordinates, distanceKm, durationMins}), or null if routing fails.
 *
 * @param {{lat:number,lng:number}} source
 * @param {{lat:number,lng:number}} destination
 * @returns {Promise<{coordinates:Array<[number,number]>,distanceKm:number,durationMins:number}|null>}
 */
export const findFastestRoadRoute = async (source, destination) => {
  if (!source || !destination) return null;

  // Same layered fan the BFS generator uses; [] for very short trips.
  const columns = buildWaypointColumns(source, destination);
  const layers = [
    [{ lat: source.lat, lng: source.lng }],
    ...columns,
    [{ lat: destination.lat, lng: destination.lng }]
  ];
  const goalL = layers.length - 1;

  // Route every adjacent-layer edge once to get its real free-flow road time.
  const edgeJobs = [];
  for (let l = 0; l < goalL; l++) {
    for (let i = 0; i < layers[l].length; i++) {
      for (let j = 0; j < layers[l + 1].length; j++) {
        edgeJobs.push({ l, i, j, a: layers[l][i], b: layers[l + 1][j] });
      }
    }
  }
  const routed = await runThrottled(
    edgeJobs.map((e) => () =>
      fetchRoadRoute([[e.a.lat, e.a.lng], [e.b.lat, e.b.lng]])
        .then((r) => ({ ...e, route: r }))
        .catch(() => ({ ...e, route: null }))
    ),
    OSRM_CONCURRENCY
  );

  // edgeCost: "l:i->l+1:j" -> minutes. Fall back to a straight-line-at-top-speed
  // estimate for any edge OSRM couldn't resolve, so the search never stalls.
  const edgeCost = new Map();
  for (const e of routed) {
    const mins = e.route && e.route.durationMins >= 0
      ? e.route.durationMins
      : (haversineKm(e.a, e.b) / MAX_ROAD_KMH) * 60;
    edgeCost.set(`${e.l}:${e.i}->${e.l + 1}:${e.j}`, mins);
  }

  // ---- A* over the layered DAG ----
  const heuristic = (node) => (haversineKm(node, destination) / MAX_ROAD_KMH) * 60;
  const gScore = { '0:0': 0 };
  const cameFrom = {};
  const open = new MinHeap();
  open.push({ key: '0:0', l: 0, i: 0, node: layers[0][0], g: 0, f: heuristic(layers[0][0]) });

  let goalKey = null;
  while (open.size > 0) {
    const cur = open.pop();
    if (cur.g > (gScore[cur.key] ?? Infinity)) continue; // stale frontier entry
    if (cur.l === goalL) { goalKey = cur.key; break; }   // destination settled = optimal

    const nextL = cur.l + 1;
    for (let j = 0; j < layers[nextL].length; j++) {
      const w = edgeCost.get(`${cur.l}:${cur.i}->${nextL}:${j}`);
      if (w == null) continue;
      const tentative = cur.g + w;
      const nKey = `${nextL}:${j}`;
      if (tentative < (gScore[nKey] ?? Infinity)) {
        gScore[nKey] = tentative;
        cameFrom[nKey] = cur.key;
        const node = layers[nextL][j];
        open.push({ key: nKey, l: nextL, i: j, node, g: tentative, f: tentative + heuristic(node) });
      }
    }
  }

  if (!goalKey) return null;

  // Walk predecessors back to recover the chosen via-points (the column layers
  // only — source and destination are added when realizing the route).
  const vias = [];
  let k = goalKey;
  while (k) {
    const [l, i] = k.split(':').map(Number);
    if (l !== 0 && l !== goalL) vias.unshift(layers[l][i]);
    k = cameFrom[k];
  }

  const waypoints = [
    [source.lat, source.lng],
    ...vias.map((v) => [v.lat, v.lng]),
    [destination.lat, destination.lng]
  ];
  // Realize the winning corridor as one real road route (usually a cache hit,
  // since BFS already routed this via-sequence).
  return fetchRoadRoute(waypoints).catch(() => null);
};
