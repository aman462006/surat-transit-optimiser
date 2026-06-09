import { findMultimodalRoute } from './graphUtils';

/**
 * Transit Mode Definitions
 * Modeled parameters representing realistic physical constraints, pricing tiers,
 * and environmental profiles in Surat, Gujarat.
 * 
 * =========================================================================
 * RIGOROUS PASSENGER-KILOMETER EMISSION MODELING
 * =========================================================================
 * Energy-to-emissions modeling relies on physical vehicle specifications,
 * occupant capacity factors, and electrical grid carbon intensities in India:
 * 
 * 1. GASOLINE BASELINE VEHICLE:
 *    - Direct exhaust: 150g CO2 per vehicle-kilometer.
 *    - Average single occupancy: 150.0g CO2 / passenger-km.
 * 
 * 2. SHARED MOBILITY OPTIMIZATION (Auto Rickshaw Pooling):
 *    - Vehicle: CNG three-wheeler auto rickshaw shared across pooled riders.
 *    - Fare: metered Surat/Gujarat tariff (₹18 base + ₹13/km) split across 3 occupants.
 *    - Net passenger emission rate: 30.00g CO2 / passenger-km (PLACEHOLDER —
 *      to be recalibrated to CNG auto emissions and real occupancy in the next pass).
 * 
 * 3. ELECTRIC BUS BRTS (Sitilink e-Bus — 100% electric across all 13 routes since Sep 2024):
 *    - Vehicle: Heavy-duty 12-meter electric transit bus.
 *    - Energy consumption: 1.20 kWh per vehicle-km.
 *    - Indian grid carbon intensity: 0.757 kg CO2 / kWh (official CEA CO2 Baseline DB v20.0, 2024).
 *    - Commuter occupancy factor: 40 passengers.
 *    - Net passenger emission rate:
 *        (1.20 kWh/km * 757g CO2/kWh) / 40 passengers = 22.71g CO2 / passenger-km.
 */
export const PRIVATE_CAR_EMISSION_FACTOR = 150.0; // grams of CO2 per passenger-km (legacy, unused — car CO2 is fuel-based)

/** Official Indian grid carbon intensity, CEA CO2 Baseline Database v20.0 (2024). */
export const GRID_CO2_KG_PER_KWH = 0.757;

/**
 * Per-unit tailpipe CO₂ factors + city default tank-to-wheel assumptions for the private car.
 * Petrol/diesel are billed per LITRE; CNG is billed per KILOGRAM (mileage in km/kg, CO₂ in kg/kg).
 *   - Petrol: 2.31 kg CO₂/L   - Diesel: 2.68 kg CO₂/L   - CNG: 2.75 kg CO₂/kg (methane stoichiometric)
 */
export const PRIVATE_CAR_FUELS = {
  petrol: { unit: 'L',  co2PerUnit: 2.31, mileage: 15, pricePerUnit: 96.0 },
  diesel: { unit: 'L',  co2PerUnit: 2.68, mileage: 18, pricePerUnit: 92.0 },
  cng:    { unit: 'kg', co2PerUnit: 2.75, mileage: 28, pricePerUnit: 79.0 }
};

/** Tailpipe CO₂ per kg of CNG combustion (≈methane stoichiometric: 44/16). */
export const CO2_KG_PER_KG_CNG = 2.75;

export const TRANSIT_MODES = {
  BUS: {
    id: 'electric-bus',
    name: 'Electric Bus BRTS',
    icon: '🚌',
    // 10% slower due to pre-scheduled stops, but immune to rush hour (bus lane)
    speedFactor: 1.10,
    baseFare: 5,       // base fare (₹) calibrated to match SMC Sitilink base
    costPerKm: 1,      // cost per km (₹) calibrated to match SMC Sitilink rate
    // 1.20 kWh/km × 0.757 kg CO2/kWh (CEA 2024) ÷ 40 passengers = 22.71 g CO2/passenger-km
    energyKwhPerKm: 1.20,
    occupancy: 40,
    emissionFactor: 22.71, // grams of CO2 per passenger-km (grid-electric BRTS e-bus)
    
    // Future architectural attributes (Scale stubs):
    safetyIndex: 90,           // Out of 100 (Dedicated BRTS lanes)
    accessibilityIndex: 98,    // Out of 100 (BRTS elevated high-platform boarding)
    walkingRequiredMeters: 450,// Need to walk to designated bus station
    transfersRequired: 1       // Might need terminal shift
  },
  AUTO_POOL: {
    id: 'auto-pool',
    name: 'Auto Rickshaw Pooling',
    icon: '🛺',
    // Shared autos run optimized local routes; marginally faster than mixed traffic
    speedFactor: 0.95,

    /**
     * SURAT / GUJARAT METERED AUTO TARIFF, SPLIT ACROSS POOLED RIDERS:
     *   singleAutoFare = autoBaseFare + max(0, distanceKm − autoBaseDistanceKm) × autoPerKm
     *   farePerPerson  = round(singleAutoFare / autoOccupancy)
     * Calibrated to the Gujarat RTO metered auto card: ₹18 base (incl. first 1.25 km),
     * ₹13 per km thereafter, shared across 3 pooled passengers.
     */
    autoBaseFare: 18,          // ₹ base fare (covers the first 1.25 km)
    autoBaseDistanceKm: 1.25,  // km included in the base fare
    autoPerKm: 13,             // ₹ per km beyond the base distance
    autoOccupancy: 3,          // pooled riders sharing one auto rickshaw

    // CO2 = (distanceKm / autoCngMileage) × 2.75 kg CO2/kg — FULL trip total (not per-person)
    autoCngMileage: 30,        // km per kg of CNG (avg city auto, range 25–35 km/kg)

    // Future architectural attributes (Scale stubs):
    safetyIndex: 82,           // Out of 100 (Regulated fleet safety)
    accessibilityIndex: 75,    // Out of 100 (Easy three-wheeler ingress/egress)
    walkingRequiredMeters: 80, // Pick-up from optimized virtual stops
    transfersRequired: 0       // Direct drop-off
  },
  PRIVATE_CAR: {
    id: 'private-car',
    name: 'Private Car',
    icon: '🚙',
    speedFactor: 1.00,
    baseFare: 0,
    costPerKm: 0, // Handled dynamically via fuel calculations
    /** Legacy g CO₂/pass-km; private-car emissions are computed from fuel used × per-unit CO₂ factor. */
    emissionFactor: 154.0,
    mileageKmpl: 15.0,
    fuelPricePerLitre: 96.0,
    defaultFuelType: 'petrol', // petrol | diesel | cng (see PRIVATE_CAR_FUELS)
    // Future architectural attributes (Scale stubs):
    safetyIndex: 75,           // Out of 100 (Subject to high accident rates)
    accessibilityIndex: 100,   // Out of 100 (Door-to-door)
    walkingRequiredMeters: 5,  // Driveway to car
    transfersRequired: 0       // None
  }
};

/**
 * Normalizes a value using Min-Max scaling
 * Lower values scale to 0 (perfect), higher values scale to 1 (worst)
 */
const normalize = (value, min, max) => {
  if (max === min) return 0;
  return (value - min) / (max - min);
};

/**
 * Transport Recommendation Engine
 * Computes travel times, trip costs, carbon footprints, and composite scores
 * for each available transit mode based on OSRM route data and user weights.
 * 
 * Supports dynamic scaling with transit preferences (safety, walking, transfer, accessibility).
 * 
 * @param {number} distance - Real OSRM driving distance in kilometers
 * @param {number} duration - Real OSRM traffic duration in minutes
 * @param {Object} source - Starting coordinates { lat, lng }
 * @param {Object} destination - Destination coordinates { lat, lng }
 * @param {string} profileId - Passenger fare profile (e.g. 'student', 'senior', 'standard')
 * @param {Object} [privateCarOptions] - Baseline private-car assumptions
 * @param {'petrol'|'diesel'} [privateCarOptions.fuelType]
 * @param {number} [privateCarOptions.mileageKmpl] - km per litre (overrides default for fuel type)
 * @param {number} [privateCarOptions.fuelPricePerLitre] - ₹ per litre
 * @returns {Array} List of processed and ranked recommendation cards
 */
export const generateRecommendations = (
  distance,
  duration,
  source = null,
  destination = null,
  profileId = 'standard',
  privateCarOptions = {}
) => {
  if (!distance || !duration) return [];

  // Fixed core logic weights for a balanced urban mobility score (no user-facing sliders)
  const w = {
    time: 0.40,
    cost: 0.30,
    emissions: 0.30,
    safety: 0.0,
    accessibility: 0.0,
    walking: 0.0,
    transfer: 0.0
  };

  const fuelType = PRIVATE_CAR_FUELS[privateCarOptions.fuelType] ? privateCarOptions.fuelType : 'petrol';
  const fuelSpec = PRIVATE_CAR_FUELS[fuelType]; // { unit, co2PerUnit, mileage, pricePerUnit }

  // Stable internal preference for BRTS pathfinding (replaces former slider)
  const brtsRoute = (source && destination)
    ? findMultimodalRoute(source, destination, profileId, 0.1)
    : null;

  // 1. Calculate raw metrics for each transport mode
  const options = Object.values(TRANSIT_MODES).map(mode => {
    // If the mode is BUS and a real multimodal BRTS route was resolved,
    // dynamically overwrite standard OSRM parameters with high-fidelity transit grid details!
    if (mode.id === 'electric-bus' && brtsRoute) {
      const travelTime = brtsRoute.totalTimeMins;
      const tripCost = brtsRoute.fareDetails.finalFare;
      
      // Emissions: Calculate solely based on actual EV BRTS bus travel distance
      const co2Emissions = parseFloat(((brtsRoute.transitDistanceKm * mode.emissionFactor) / 1000).toFixed(3));
      
      return {
        ...mode,
        travelTime,
        tripCost,
        co2Emissions,
        fuelUsedLitres: 0,
        walkingRequiredMeters: Math.round(brtsRoute.walkingDistanceKm * 1000),
        transfersRequired: brtsRoute.transfersCount,
        brtsItinerary: brtsRoute,
        convenienceSummary: 'Bus + station access'
      };
    }

    // Default road-based calculations (auto pooling, private car, or BRTS without graph path)
    const travelTime = Math.max(2, Math.round(duration * mode.speedFactor));

    if (mode.id === 'private-car') {
      // Mileage / price units follow the fuel: km/L & ₹/L for petrol-diesel, km/kg & ₹/kg for CNG
      const mileage = Number.isFinite(privateCarOptions.mileageKmpl) && privateCarOptions.mileageKmpl > 0
        ? privateCarOptions.mileageKmpl
        : fuelSpec.mileage;
      const fuelPrice = Number.isFinite(privateCarOptions.fuelPricePerLitre) && privateCarOptions.fuelPricePerLitre > 0
        ? privateCarOptions.fuelPricePerLitre
        : fuelSpec.pricePerUnit;

      // fuelUsed = distance ÷ mileage (litres for petrol/diesel, kg for CNG)
      const fuelUsed = parseFloat((distance / mileage).toFixed(3));
      const tripCost = parseFloat((fuelUsed * fuelPrice).toFixed(2));
      const co2Emissions = parseFloat((fuelUsed * fuelSpec.co2PerUnit).toFixed(3));

      return {
        ...mode,
        travelTime,
        tripCost,
        co2Emissions,
        fuelUsedLitres: fuelUsed, // amount of fuel used (in fuelUnit)
        privateCarFuelType: fuelType,
        privateCarFuelUnit: fuelSpec.unit, // 'L' or 'kg'
        privateCarMileageKmpl: mileage,
        privateCarFuelPricePerLitre: fuelPrice,
        privateCarCo2KgPerLitre: fuelSpec.co2PerUnit, // kg CO2 per fuelUnit
        convenienceSummary: 'Door-to-door'
      };
    }

    if (mode.id === 'auto-pool') {
      // Metered Surat/Gujarat auto fare, then split across pooled riders
      const billableKm = Math.max(0, distance - mode.autoBaseDistanceKm);
      const singleAutoFare = mode.autoBaseFare + billableKm * mode.autoPerKm;
      const tripCost = Math.round(singleAutoFare / mode.autoOccupancy);

      // CO2 = CNG used (kg) × 2.75 kg CO2/kg — full trip total for the shared auto
      const cngUsedKg = parseFloat((distance / mode.autoCngMileage).toFixed(3));
      const co2Emissions = parseFloat((cngUsedKg * CO2_KG_PER_KG_CNG).toFixed(3));

      return {
        ...mode,
        travelTime,
        tripCost,
        co2Emissions,
        fuelUsedLitres: 0,
        cngUsedKg, // CNG burned by the auto over the trip
        autoSingleFare: Math.round(singleAutoFare), // full metered fare before the pooling split
        convenienceSummary: 'Shared auto ride'
      };
    }

    const tripCost = Math.round(mode.baseFare + distance * mode.costPerKm);
    const co2Emissions = parseFloat(((distance * mode.emissionFactor) / 1000).toFixed(3));

    return {
      ...mode,
      travelTime,
      tripCost,
      co2Emissions,
      fuelUsedLitres: 0,
      convenienceSummary: 'Bus + station access'
    };
  });

  // 2. Extract Min-Max boundaries for normalization
  const times = options.map(o => o.travelTime);
  const costs = options.map(o => o.tripCost);
  const emissions = options.map(o => o.co2Emissions);
  
  // Future normalization limits
  const safeties = options.map(o => o.safetyIndex);
  const accessibilities = options.map(o => o.accessibilityIndex);
  const walkings = options.map(o => o.walkingRequiredMeters);
  const transfers = options.map(o => o.transfersRequired);

  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);

  const minCost = Math.min(...costs);
  const maxCost = Math.max(...costs);

  const minEmissions = Math.min(...emissions);
  const maxEmissions = Math.max(...emissions);

  // Future metric limits (Stubs)
  const minSafety = Math.min(...safeties);
  const maxSafety = Math.max(...safeties);
  const minAccess = Math.min(...accessibilities);
  const maxAccess = Math.max(...accessibilities);
  const minWalk = Math.min(...walkings);
  const maxWalk = Math.max(...walkings);
  const minTrans = Math.min(...transfers);
  const maxTrans = Math.max(...transfers);

  // 3. Weighted Scoring & Normalization Logic
  // Composite Score = Sum( W_i * Norm(Metric_i) )
  // Since high safety and high accessibility are GOOD (unlike time/cost/CO2 which are BAD),
  // they are inverted as (1 - Norm) so that a high score represents optimal choice (0 = best, 1 = worst)
  const scoredOptions = options.map(opt => {
    const normTime = normalize(opt.travelTime, minTime, maxTime);
    const normCost = normalize(opt.tripCost, minCost, maxCost);
    const normEmissions = normalize(opt.co2Emissions, minEmissions, maxEmissions);

    // Future-Proof Normalizations (Invert for indicators where high is good)
    const normSafety = 1 - normalize(opt.safetyIndex, minSafety, maxSafety);
    const normAccess = 1 - normalize(opt.accessibilityIndex, minAccess, maxAccess);
    const normWalk = normalize(opt.walkingRequiredMeters, minWalk, maxWalk);
    const normTrans = normalize(opt.transfersRequired, minTrans, maxTrans);

    // Composite score: fixed balanced weights (time, cost, emissions)
    const compositeScore = parseFloat(
      (
        w.time * normTime +
        w.cost * normCost +
        w.emissions * normEmissions +
        w.safety * normSafety +
        w.accessibility * normAccess +
        w.walking * normWalk +
        w.transfer * normTrans
      ).toFixed(4)
    );

    return {
      ...opt,
      compositeScore,
      metrics: { 
        normTime, 
        normCost, 
        normEmissions,
        normSafety,
        normAccess,
        normWalk,
        normTrans
      }
    };
  });

  // 4. Assign Intelligent Recommendation Labels
  // Identify key absolute winners
  const fastestId = scoredOptions.reduce((prev, curr) => prev.travelTime < curr.travelTime ? prev : curr).id;
  const cheapestId = scoredOptions.reduce((prev, curr) => prev.tripCost < curr.tripCost ? prev : curr).id;
  const greenestId = scoredOptions.reduce((prev, curr) => prev.co2Emissions < curr.co2Emissions ? prev : curr).id;

  // Identify composite winner (lowest score)
  const bestValueId = scoredOptions.reduce((prev, curr) => prev.compositeScore < curr.compositeScore ? prev : curr).id;

  const labeledOptions = scoredOptions.map(opt => {
    let label = 'STANDARD';
    let labelType = 'standard';

    // Assign labels with descending precedence
    if (opt.id === bestValueId) {
      label = 'BALANCED MATCH';
      labelType = 'optimal';
    } else if (opt.id === fastestId) {
      label = 'FASTEST';
      labelType = 'fastest';
    } else if (opt.id === cheapestId) {
      label = 'CHEAPEST';
      labelType = 'cheapest';
    } else if (opt.id === greenestId) {
      label = 'GREENEST';
      labelType = 'greenest';
    }

    return {
      ...opt,
      label,
      labelType
    };
  });

  // 5. Rank transit options by score (lowest score first -> highly optimal first)
  return labeledOptions.sort((a, b) => a.compositeScore - b.compositeScore);
};
