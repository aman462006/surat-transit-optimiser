import { BRTS_STATIONS, BRTS_ROUTES } from './transitDataService';
import { calculateTransitFare } from './fareEngine';

// Walking speed average in urban spaces (used for snapped walking legs)
const WALKING_SPEED_KMH = 4.5; 

/**
 * Standard Haversine formula to compute great-circle distance between two GPS coordinates.
 * Relies on spherical trigonometry to calculate distance on Earth's curved surface.
 */
export const calculateHaversine = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return parseFloat((R * c).toFixed(3));
};

/**
 * Locates the nearest BRTS station to a given coordinate.
 * Used for dynamic snapping of user click coordinates to transit graph entry points.
 * 
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @returns {Object} { station, distanceKm }
 */
export const findNearestStation = (lat, lng) => {
  console.log(`[Nearest Station Search] Snapping coordinate (${lat.toFixed(5)}, ${lng.toFixed(5)}) to transit grid...`);
  const stations = Object.values(BRTS_STATIONS);
  let nearestStation = null;
  let minDistance = Infinity;

  stations.forEach(station => {
    const dist = calculateHaversine(lat, lng, station.lat, station.lng);
    if (dist < minDistance) {
      minDistance = dist;
      nearestStation = station;
    }
  });

  if (nearestStation) {
    console.log(`[Nearest Station Search] Snapped to closest station: "${nearestStation.name}" (ID: ${nearestStation.id}) at a distance of ${minDistance.toFixed(3)} km.`);
  }

  return {
    station: nearestStation,
    distanceKm: parseFloat(minDistance.toFixed(3))
  };
};

/**
 * Explicit Adjacent-Station Transit Graph Builder
 * 
 * Constructs a proper graph structure where:
 * - stations = nodes (vertices)
 * - route connections = edges
 * - each edge stores: routeId, routeNumber, color, nextStationId, distanceKm, durationMins (travel time + stop dwells)
 * 
 * @returns {Object} Adjacency list graph { [stationId]: [ { edgeDetails } ] }
 */
export const buildTransitGraph = () => {
  const graph = {};

  // Initialize all stations as empty graph nodes
  Object.keys(BRTS_STATIONS).forEach(stationId => {
    graph[stationId] = [];
  });

  // Build directed edges by traversing pre-ordered sequence of stations for all active routes
  Object.values(BRTS_ROUTES).forEach(route => {
    const stations = route.stations;

    // Forward Direction Edges
    for (let i = 0; i < stations.length - 1; i++) {
      const currentStationId = stations[i];
      const nextStationId = stations[i + 1];
      
      const dist = calculateHaversine(
        BRTS_STATIONS[currentStationId].lat,
        BRTS_STATIONS[currentStationId].lng,
        BRTS_STATIONS[nextStationId].lat,
        BRTS_STATIONS[nextStationId].lng
      );
      
      /**
       * High-Fidelity Operational BRTS Travel Time Modeling
       * Cruise Speed: 42 km/h dedicated corridor speed.
       * Dwell Time: 30 seconds (0.50 mins) per stop for passenger boarding/alighting.
       * Acceleration/Deceleration Penalty: 15 seconds (0.25 mins) lost in braking and accelerating at each station platform.
       */
      const cruiseSpeedKmh = 42; 
      const dwellTimeMins = 0.50; 
      const accelDecelMins = 0.25; 
      
      const cruiseTimeMins = (dist / cruiseSpeedKmh) * 60;
      const edgeDuration = parseFloat((cruiseTimeMins + dwellTimeMins + accelDecelMins).toFixed(2));
      
      graph[currentStationId].push({
        routeId: route.id,
        routeNumber: route.routeNumber || route.shortName,
        color: route.color,
        nextStationId: nextStationId,
        distanceKm: dist,
        durationMins: edgeDuration,
        direction: 'forward'
      });
    }

    // Bidirectional Reverse Direction Edges
    if (route.bidirectional) {
      for (let i = stations.length - 1; i > 0; i--) {
        const currentStationId = stations[i];
        const nextStationId = stations[i - 1];
        
        const dist = calculateHaversine(
          BRTS_STATIONS[currentStationId].lat,
          BRTS_STATIONS[currentStationId].lng,
          BRTS_STATIONS[nextStationId].lat,
          BRTS_STATIONS[nextStationId].lng
        );
        
        /**
         * High-Fidelity Reverse Direction Operational BRTS Travel Time Modeling
         * Cruise Speed: 42 km/h dedicated corridor speed.
         * Dwell Time: 30 seconds (0.50 mins) per stop.
         * Acceleration/Deceleration Penalty: 15 seconds (0.25 mins) per stop.
         */
        const cruiseSpeedKmh = 42; 
        const dwellTimeMins = 0.50; 
        const accelDecelMins = 0.25; 
        
        const cruiseTimeMins = (dist / cruiseSpeedKmh) * 60;
        const edgeDuration = parseFloat((cruiseTimeMins + dwellTimeMins + accelDecelMins).toFixed(2));
        
        graph[currentStationId].push({
          routeId: route.id,
          routeNumber: route.routeNumber || route.shortName,
          color: route.color,
          nextStationId: nextStationId,
          distanceKm: dist,
          durationMins: edgeDuration,
          direction: 'backward'
        });
      }
    }
  });

  return graph;
};

/**
 * Concise and Structured Multimodal Instructions Generator
 * 
 * Compiles high-fidelity human-readable directions matching the requested format:
 * - "Walk to Adajan BRTS Station"
 * - "Take B1 toward Majura Gate"
 * - "Exit at Majura Gate"
 * - "Transfer to B3"
 * - "Exit at Railway Station"
 * 
 * @param {Array} itinerary - Complete walk-and-transit itinerary list of legs
 * @returns {Array} List of step-by-step text instructions
 */
export const generateRouteInstructions = (itinerary) => {
  if (!itinerary || itinerary.length === 0) return [];
  const instructions = [];

  // Helper to strip verbose suffixes for clean visual reading
  const cleanName = (name) => {
    return name
      .replace(' BRTS Station', '')
      .replace(' BRTS Hub', '')
      .replace(' BRTS Terminal', '')
      .replace(' Terminal', '')
      .replace(' Hub', '')
      .replace(' BRTS', '');
  };

  itinerary.forEach((leg, idx) => {
    if (leg.type === 'walk') {
      if (idx === 0) {
        instructions.push(`Walk to ${cleanName(leg.to)} BRTS Station`);
      } else {
        instructions.push(`Walk to Destination`);
      }
    } else if (leg.type === 'ride') {
      // Direct toward destination alighting station of this specific leg
      instructions.push(`Take ${leg.routeNumber} toward ${cleanName(leg.to)}`);
      instructions.push(`Exit at ${cleanName(leg.to)}`);
    } else if (leg.type === 'transfer') {
      instructions.push(`Transfer to ${leg.description.split('to ')[1].split(' at')[0]}`);
    }
  });

  return instructions;
};

/**
 * Dynamic Transit Graph Traversal Engine (Adjacency BFS Pathfinder)
 * Resolves optimal paths across explicit adjacent-station corridors.
 * 
 * =========================================================================
 * HIGH-FIDELITY TRANSIT ETA MODELING & PHYSICS ASSUMPTIONS
 * =========================================================================
 * Our time-traversal engine calculates total journey ETA based on actual physical
 * parameters instead of idealized average highway speeds or random stubs:
 * 
 * 1. DEDICATED LANE CRUISE SPEED:
 *    - Modeled at 42 km/h. While a BRTS corridor isolates buses from standard traffic congestion,
 *      speed is limited by safety corridors, intersections, and signaling in Surat's urban spaces.
 * 
 * 2. STATION PLATFORM DWELL TIME:
 *    - Set to 30 seconds (0.50 minutes) per stop.
 *    - Account for door synchronization, high-platform step-free passenger boarding, and alighting.
 * 
 * 3. DECELERATION & ACCELERATION PENALTY:
 *    - Set to 15 seconds (0.25 minutes) lost in braking into a station and accelerating back to cruise speed.
 *    - Summing these two yields a net delay of 45 seconds (0.75 minutes) lost per stop crossed.
 * 
 * 4. INITIAL HEADWAY WAITING TIME (BOARDING DELAY):
 *    - In public transit modeling, the boarding wait time is estimated as half the scheduled headway (Headway / 2).
 *    - For instance, if B1 operates every 8 minutes, the expected initial waiting buffer is 4 minutes.
 * 
 * 5. PLATFORM TRANSFER WAITING LOGIC:
 *    - When transitioning between lines (e.g., B1 -> B3 at Majura Gate Hub):
 *      - We add a platform walking transfer transition penalty of 3 minutes.
 *      - We add a line headway waiting buffer of (Next Line Headway / 2) minutes.
 * 
 * DYNAMIC USER PREFERENCE SCORING (TRANSFER AVOIDANCE):
 * - To prioritize simpler journeys, we add a virtual transfer penalty:
 *     penaltyPerTransfer = transferAvoidanceWeight * 24 (minutes)
 * - Ranked candidates are sorted by this composite time score.
 * 
 * @param {string} startId - Starting BRTS station ID
 * @param {string} endId - Destination BRTS station ID
 * @param {number} transferAvoidanceWeight - Slider factor (0.0 to 1.0)
 * @returns {Object|null} Optimized path details or null
 */
export const findOptimalTransitRoute = (startId, endId, transferAvoidanceWeight = 0.1) => {
  const graph = buildTransitGraph();
  console.log(`[Dijkstra Transit] Solving shortest time-path between "${BRTS_STATIONS[startId].name}" (${startId}) and "${BRTS_STATIONS[endId].name}" (${endId})`);
  console.log(`[Dijkstra Transit] Active Avoidance Weight: ${transferAvoidanceWeight.toFixed(2)}`);

  if (startId === endId) return null;

  /**
   * =========================================================================
   * TIME-WEIGHTED DIJKSTRA OVER A ROUTE-AWARE STATE GRAPH
   * =========================================================================
   * Instead of brute-force enumerating every simple path (exponential as the
   * network grows), we run Dijkstra's shortest-path algorithm over an
   * expanded state space:
   *
   *   state = (stationId, currentRouteId)
   *
   * Carrying the current route in the state lets us price transfers correctly:
   * crossing from one line to another at a shared station incurs a real cost
   * (platform walk + half the next line's headway) plus a tunable virtual
   * penalty that discourages transfers. Edge weight (minutes):
   *
   *   stepCost = edge.durationMins
   *            + boardingCost   (initial wait headway/2 on first board,
   *                              or 3-min platform walk + headway/2 on transfer)
   *            + transferPenalty (transferAvoidanceWeight * 24, only on transfer)
   *
   * Dijkstra pops states in increasing cost, so the first time the destination
   * station is settled we have the optimal (lowest composite-time) path. We
   * still cap at 2 transfers to keep itineraries realistic.
   */
  const penaltyPerTransfer = transferAvoidanceWeight * 24;
  const START = '__start__';

  const dist = {};                 // stateKey -> best known cost
  const prev = {};                 // stateKey -> { fromKey, edge }
  const startKey = `${startId}|${START}`;
  dist[startKey] = 0;

  // Lightweight priority queue (linear extract-min — ample for this graph size)
  const pq = [{ key: startKey, stationId: startId, routeId: START, transfers: 0, cost: 0 }];
  let bestEndKey = null;

  while (pq.length > 0) {
    let minIdx = 0;
    for (let i = 1; i < pq.length; i++) {
      if (pq[i].cost < pq[minIdx].cost) minIdx = i;
    }
    const cur = pq.splice(minIdx, 1)[0];

    // Skip stale queue entries superseded by a cheaper relaxation
    if (cur.cost > (dist[cur.key] ?? Infinity)) continue;

    // First settle of the destination station = optimal path found
    if (cur.stationId === endId) { bestEndKey = cur.key; break; }

    const outgoing = graph[cur.stationId] || [];
    for (const edge of outgoing) {
      const isTransfer = cur.routeId !== START && cur.routeId !== edge.routeId;
      const newTransfers = cur.transfers + (isTransfer ? 1 : 0);
      if (newTransfers > 2) continue; // cap at 2 transfers (3 ride segments)

      const route = BRTS_ROUTES[edge.routeId];
      let boardingCost = 0;
      if (cur.routeId === START) boardingCost = route.headway / 2;       // initial headway wait
      else if (isTransfer) boardingCost = 3 + route.headway / 2;          // platform walk + headway wait

      const stepCost = edge.durationMins + boardingCost + (isTransfer ? penaltyPerTransfer : 0);
      const nextKey = `${edge.nextStationId}|${edge.routeId}`;
      const nextCost = cur.cost + stepCost;

      if (nextCost < (dist[nextKey] ?? Infinity)) {
        dist[nextKey] = nextCost;
        prev[nextKey] = { fromKey: cur.key, edge };
        pq.push({
          key: nextKey,
          stationId: edge.nextStationId,
          routeId: edge.routeId,
          transfers: newTransfers,
          cost: nextCost
        });
      }
    }
  }

  // Safety net: destination may have been relaxed but not popped (e.g. loop broke early)
  if (!bestEndKey) {
    let best = Infinity;
    for (const k of Object.keys(dist)) {
      if (k.startsWith(`${endId}|`) && dist[k] < best) { best = dist[k]; bestEndKey = k; }
    }
  }
  if (!bestEndKey) {
    console.log('[Dijkstra Transit] No connected transit path found.');
    return null;
  }

  // Reconstruct the optimal ordered edge sequence by walking predecessors back
  const edges = [];
  let walk = bestEndKey;
  while (prev[walk]) {
    edges.unshift(prev[walk].edge);
    walk = prev[walk].fromKey;
  }
  if (edges.length === 0) return null;

  console.log(`[Dijkstra Transit] Optimal path settled with cost ${dist[bestEndKey].toFixed(1)} (incl. penalties), ${edges.length} hops.`);

  // Process edges and reconstruct/collapse consecutive edges into continuous ride legs
  const buildRoute = (edges) => {
    const legs = [];
    let currentLeg = null;
    let totalDistance = 0;
    
    edges.forEach((edge, index) => {
      const fromStationId = index === 0 ? startId : edges[index - 1].nextStationId;
      const toStationId = edge.nextStationId;
      
      totalDistance += edge.distanceKm;

      if (currentLeg && currentLeg.routeId === edge.routeId) {
        // Continue riding the same bus line: accumulate metrics and trace stops
        currentLeg.distanceKm += edge.distanceKm;
        currentLeg.durationMins += edge.durationMins;
        currentLeg.stopsCount += 1;
        currentLeg.stations.push({
          id: toStationId,
          name: BRTS_STATIONS[toStationId].name,
          lat: BRTS_STATIONS[toStationId].lat,
          lng: BRTS_STATIONS[toStationId].lng
        });
        currentLeg.to = BRTS_STATIONS[toStationId].name;
        currentLeg.toId = toStationId;
      } else {
        // Route mismatch: start of a new bus segment. Insert a transfer node if transitioning.
        if (currentLeg) {
          const nextRoute = BRTS_ROUTES[edge.routeId];
          const transferWait = Math.round(nextRoute.headway / 2);
          const transferWalk = 3; // 3 mins platform walk
          const transferCost = transferWait + transferWalk;

          legs.push(currentLeg);
          legs.push({
            type: 'transfer',
            stationName: currentLeg.to,
            durationMins: transferCost,
            description: `Switch from ${currentLeg.routeNumber} to ${edge.routeNumber} at ${currentLeg.to}`
          });
        }

        const route = BRTS_ROUTES[edge.routeId];
        // Apply average headway wait time (headway / 2) for boarding
        const initialWait = Math.round(route.headway / 2);

        currentLeg = {
          type: 'ride',
          routeId: edge.routeId,
          routeName: route.shortName,
          routeNumber: edge.routeNumber,
          color: edge.color,
          from: BRTS_STATIONS[fromStationId].name,
          to: BRTS_STATIONS[toStationId].name,
          fromId: fromStationId,
          toId: toStationId,
          distanceKm: edge.distanceKm,
          durationMins: edge.durationMins + (legs.length === 0 ? initialWait : 0), // Include initial boarding delay
          stopsCount: 1,
          stations: [
            {
              id: fromStationId,
              name: BRTS_STATIONS[fromStationId].name,
              lat: BRTS_STATIONS[fromStationId].lat,
              lng: BRTS_STATIONS[fromStationId].lng
            },
            {
              id: toStationId,
              name: BRTS_STATIONS[toStationId].name,
              lat: BRTS_STATIONS[toStationId].lat,
              lng: BRTS_STATIONS[toStationId].lng
            }
          ]
        };
      }
    });

    if (currentLeg) {
      legs.push(currentLeg);
    }

    // Sum overall metrics
    let totalDuration = 0;
    let totalStops = 0;
    legs.forEach(leg => {
      totalDuration += Math.round(leg.durationMins);
      if (leg.type === 'ride') {
        totalStops += leg.stopsCount;
      }
    });

    const transfersCount = legs.filter(l => l.type === 'transfer').length;

    // Dynamic transfer penalty calculation
    const penaltyPerTransfer = transferAvoidanceWeight * 24;
    const compositeTimeScore = totalDuration + transfersCount * penaltyPerTransfer;

    const routeNumSeq = legs.filter(l => l.type === 'ride').map(l => l.routeNumber);

    return {
      routeId: legs.filter(l => l.type === 'ride').map(l => l.routeId).join('->'),
      routeName: routeNumSeq.join(' ➔ '),
      longName: transfersCount === 0 
        ? `Direct via ${routeNumSeq[0]}` 
        : `Transfer via ${legs.filter(l => l.type === 'transfer').map(l => l.stationName).join(', ')}`,
      color: legs.filter(l => l.type === 'ride')[0].color,
      distanceKm: parseFloat(totalDistance.toFixed(3)),
      durationMins: totalDuration,
      stopsCount: totalStops,
      isDirect: transfersCount === 0,
      transfersCount: transfersCount,
      compositeTimeScore: compositeTimeScore,
      legs: legs
    };
  };

  const bestRoute = buildRoute(edges);

  console.log(`[Path Reconstruction] Optimal path resolved: ${bestRoute.routeName} with ${bestRoute.transfersCount} transfer(s)`);
  return bestRoute;
};

/**
 * Core Multimodal Routing Solver
 * Connects User GPS Coordinates to the BRTS Corridor grid via walking edges.
 * 
 * Multimodal Graph Edges modeled:
 * 1. Walk Origin ➔ Start BRTS Station (Walking Edge)
 * 2. Ride Start BRTS Station ➔ End BRTS Station (Transit Edge, dynamically solved via Adjacency BFS)
 * 3. Walk End BRTS Station ➔ Destination Coordinate (Walking Edge)
 * 
 * @param {Object} source - Starting coordinates { lat, lng }
 * @param {Object} destination - Destination coordinates { lat, lng }
 * @param {string} profileId - Fare calculation passenger profile
 * @param {number} transferAvoidanceWeight - Slider factor (0.0 to 1.0)
 * @returns {Object} Complete optimized itinerary details
 */
export const findMultimodalRoute = (source, destination, profileId = 'standard', transferAvoidanceWeight = 0.1) => {
  if (!source || !destination) return null;

  // 1. Snapping coordinates to nearest nodes
  const nearestStart = findNearestStation(source.lat, source.lng);
  const nearestEnd = findNearestStation(destination.lat, destination.lng);

  const startStation = nearestStart.station;
  const endStation = nearestEnd.station;

  const walk1Dist = nearestStart.distanceKm;
  const walk2Dist = nearestEnd.distanceKm;

  const walk1Mins = Math.round((walk1Dist / WALKING_SPEED_KMH) * 60);
  const walk2Mins = Math.round((walk2Dist / WALKING_SPEED_KMH) * 60);

  // 2. Fallback direct walking itinerary if snapping to matching stations
  if (startStation.id === endStation.id) {
    const directDist = calculateHaversine(source.lat, source.lng, destination.lat, destination.lng);
    const directMins = Math.round((directDist / WALKING_SPEED_KMH) * 60);

    const itinerary = [
      {
        type: 'walk',
        from: 'Your Location',
        to: 'Destination',
        distanceKm: directDist,
        durationMins: directMins,
        description: 'Walk directly to destination'
      }
    ];

    return {
      routeName: 'Direct Walk',
      totalTimeMins: directMins,
      totalDistanceKm: directDist,
      transitDistanceKm: 0,
      walkingDistanceKm: directDist,
      walkingTimeMins: directMins,
      transitTimeMins: 0,
      transfersCount: 0,
      stopsCount: 0,
      startStationName: startStation.name,
      endStationName: endStation.name,
      fareDetails: calculateTransitFare(0, 0, profileId),
      itinerary,
      transitInstructions: generateRouteInstructions(itinerary)
    };
  }

  // 3. Solve pathfinding traversal across explicit adjacency list
  const transitPath = findOptimalTransitRoute(startStation.id, endStation.id, transferAvoidanceWeight);

  // Fallback virtual corridor in case grid traversal breaks
  if (!transitPath) {
    const crowdDist = calculateHaversine(startStation.lat, startStation.lng, endStation.lat, endStation.lng);
    
    /**
     * High-Fidelity Fallback Operational Travel Time Modeling
     * Replaces generic placeholder math with our calibrated physical transit variables:
     * - Cruise Speed: 42 km/h.
     * - Average station spacing: 1.5 km (determining estimated stops).
     * - Platform time per stop: 0.75 mins (0.50m dwell + 0.25m deceleration/acceleration penalty).
     * - Initial headway wait buffer: 4 mins (corresponds to average 8-min headway/2).
     */
    const estimatedStops = Math.max(1, Math.round(crowdDist / 1.5));
    const cruiseTime = (crowdDist / 42) * 60;
    const dwellTime = estimatedStops * 0.75;
    const initialWait = 4.0;
    const mockMins = Math.round(cruiseTime + dwellTime + initialWait);
    
    const mockTransitLeg = {
      type: 'ride',
      routeId: 'virtual-connector',
      routeName: 'BRTS',
      routeNumber: 'BRTS',
      color: '#6366f1',
      from: startStation.name,
      to: endStation.name,
      fromId: startStation.id,
      toId: endStation.id,
      distanceKm: crowdDist,
      durationMins: mockMins,
      stopsCount: estimatedStops,
      stations: [
        { id: startStation.id, name: startStation.name, lat: startStation.lat, lng: startStation.lng },
        { id: endStation.id, name: endStation.name, lat: endStation.lat, lng: endStation.lng }
      ]
    };

    const itinerary = [
      {
        type: 'walk',
        from: 'Your Location',
        to: startStation.name,
        distanceKm: walk1Dist,
        durationMins: walk1Mins,
        description: `Walk from start location to ${startStation.name}`
      },
      mockTransitLeg,
      {
        type: 'walk',
        from: endStation.name,
        to: 'Destination',
        distanceKm: walk2Dist,
        durationMins: walk2Mins,
        description: `Exit station ${endStation.name} and walk to final destination`
      }
    ];

    const totalTime = walk1Mins + mockMins + walk2Mins;
    const totalDistance = parseFloat((walk1Dist + crowdDist + walk2Dist).toFixed(3));
    const transitFare = calculateTransitFare(crowdDist, 0, profileId, mockTransitLeg.stopsCount);

    return {
      routeName: 'BRTS Express Fallback',
      totalTimeMins: totalTime,
      totalDistanceKm: totalDistance,
      transitDistanceKm: crowdDist,
      walkingDistanceKm: parseFloat((walk1Dist + walk2Dist).toFixed(3)),
      walkingTimeMins: walk1Mins + walk2Mins,
      transitTimeMins: mockMins,
      transfersCount: 0,
      stopsCount: mockTransitLeg.stopsCount,
      startStationName: startStation.name,
      endStationName: endStation.name,
      fareDetails: transitFare,
      routeColor: '#6366f1',
      itinerary,
      transitInstructions: generateRouteInstructions(itinerary)
    };
  }

  // 4. Multimodal Itinerary Compilation
  const itinerary = [
    {
      type: 'walk',
      from: 'Your Location',
      to: startStation.name,
      distanceKm: walk1Dist,
      durationMins: walk1Mins,
      description: `Walk from start location to ${startStation.name}`
    },
    ...transitPath.legs,
    {
      type: 'walk',
      from: endStation.name,
      to: 'Destination',
      distanceKm: walk2Dist,
      durationMins: walk2Mins,
      description: `Exit station ${endStation.name} and walk to final destination`
    }
  ];

  const totalTime = walk1Mins + transitPath.durationMins + walk2Mins;
  const totalDistance = parseFloat((walk1Dist + transitPath.distanceKm + walk2Dist).toFixed(3));
  const transitFare = calculateTransitFare(transitPath.distanceKm, transitPath.transfersCount, profileId, transitPath.stopsCount);

  return {
    routeName: transitPath.routeName,
    totalTimeMins: totalTime,
    totalDistanceKm: totalDistance,
    transitDistanceKm: transitPath.distanceKm,
    walkingDistanceKm: parseFloat((walk1Dist + walk2Dist).toFixed(3)),
    walkingTimeMins: walk1Mins + walk2Mins,
    transitTimeMins: transitPath.durationMins,
    transfersCount: transitPath.transfersCount,
    stopsCount: transitPath.stopsCount,
    startStationName: startStation.name,
    endStationName: endStation.name,
    fareDetails: transitFare,
    routeColor: transitPath.color,
    itinerary,
    transitInstructions: generateRouteInstructions(itinerary)
  };
};
