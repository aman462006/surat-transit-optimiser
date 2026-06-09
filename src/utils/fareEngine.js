/**
 * Surat SMC Sitilink BRTS Fare Calculation Engine
 * 
 * Provides a mathematically consistent, deterministic, and highly realistic
 * fare modeling system calibrated to mirror Surat Municipal Corporation (SMC)
 * Sitilink BRTS and public transit pricing structures.
 * 
 * =========================================================================
 * BRTS FARE CALIBRATION & DETERMINISTIC MODELING
 * =========================================================================
 * 
 * 1. OFFICIAL PROGRESSIVE DISTANCE-STAGE SLABS (SITILINK MODEL):
 *    Surat Municipal Corporation operates a progressive distance-slab structure
 *    that caps fares at ₹25 to ensure public transit remains highly accessible.
 *    Fares scale progressively through the following operational tiers:
 *      - Up to 3 km     : ₹5.00
 *      - 3 to 6 km      : ₹10.00
 *      - 6 to 10 km     : ₹15.00
 *      - 10 to 15 km    : ₹20.00
 *      - Above 15 km    : ₹25.00 (Maximum Fare Cap)
 * 
 * 2. DETERMINISTIC FARE LOGIC:
 *    - Arbitrary heuristical surcharges (e.g., per-stop floating point costs)
 *      have been completely removed to match real ticketing systems.
 *    - The fare is purely determined by the total continuous distance traversed 
 *      across the BRTS network.
 * 
 * 3. PLATFORM TRANSFER INTEGRATION LOGIC:
 *    - In integrated public transport networks like Surat Sitilink, if passengers
 *      remain inside the station pay-zone, there are no transfer penalties.
 *    - The transfer charge is strictly ₹0.00 to reflect this seamless integration.
 * 
 * 4. COMPOSITE DETERMINISTIC PRICING FORMULA:
 *    - Raw Fare = LookupSlab(Total Distance Km)
 *    - Final Fare = Round(Raw Fare * (1 - Passenger Discount Rate))
 */

export const SITILINK_FARE_SLABS = [
  { maxKm: 3, fare: 5.0 },
  { maxKm: 6, fare: 10.0 },
  { maxKm: 10, fare: 15.0 },
  { maxKm: 15, fare: 20.0 },
  { maxKm: Infinity, fare: 25.0 }
];

export const FARE_CONFIG = {
  // Configured default transfer mode in Surat BRTS: 
  // 'integrated' - Free platform-level transfers inside the station pay-zone (₹0.00 penalty)
  transferMode: 'integrated',

  // Supportive passenger profiles and discount rates modeled on SMC policies
  PASSENGER_PROFILES: {
    standard: {
      id: 'standard',
      name: 'Standard Fare',
      discountRate: 0.0,
      description: 'Standard single-journey electronic ticket'
    },
    digital: {
      id: 'digital',
      name: 'Digital Ticket (20% Off)',
      discountRate: 0.20,
      description: 'Official Sitilink App mobile ticket discount'
    },
    student: {
      id: 'student',
      name: 'Student Discount (50% Off)',
      discountRate: 0.50,
      description: 'Verified student pass issued by Surat Municipal Corporation'
    },
    senior: {
      id: 'senior',
      name: 'Senior Citizen (30% Off)',
      discountRate: 0.30,
      description: 'Supportive fare structure for citizens aged 60+'
    },
    pass_holder: {
      id: 'pass_holder',
      name: 'Daily/Monthly Pass Holder',
      discountRate: 1.00, // 100% discount per ride for active pass holders (Day Pass is ₹30 flat)
      description: 'Unlimited transit pass. Displays as ₹0 per trip.'
    }
  }
};

/**
 * Performs a progressive distance-slab lookup matching SMC Sitilink pricing bands.
 * Walking-only journeys (0 km) bypass the look-up and return exactly ₹0.0.
 * 
 * @param {number} distanceKm - Total travel distance on transit lines
 * @returns {number} Calibrated base slab fare in Rupees
 */
export const lookupSlabFare = (distanceKm) => {
  if (distanceKm <= 0) return 0.0;
  const slab = SITILINK_FARE_SLABS.find(s => distanceKm <= s.maxKm);
  return slab ? slab.fare : 25.0; // ₹25 is the max fare cap
};

/**
 * Computes public transport fare dynamically based on transit metrics and passenger profile.
 * 
 * Calibrated parameters:
 *   Slab Fare = LookupSlab(DistanceKm)
 *   Final Fare = Round(Slab Fare * (1 - Passenger Discount Rate))
 * 
 * @param {number} distanceKm - Travel distance on active transit lines (excluding walking)
 * @param {number} transferCount - Number of transfers made during the trip
 * @param {string} profileId - Key matching a valid profile in FARE_CONFIG
 * @param {number} stopsCount - Number of stations crossed on transit lines
 * @returns {Object} Calculated pricing details { baseFare, distanceFare, stopsFare, transferFare, discount, rawFare, finalFare, profileName, description }
 */
export const calculateTransitFare = (distanceKm, transferCount = 0, profileId = 'standard', stopsCount = 0) => {
  const distance = Math.max(0, distanceKm);
  
  // Retrieve profile configurations, falling back to standard
  const profile = FARE_CONFIG.PASSENGER_PROFILES[profileId] || FARE_CONFIG.PASSENGER_PROFILES.standard;
  
  // 1. Look up progressive distance slab fare
  const rawTotal = lookupSlabFare(distance);
  
  // 2. Apply profile discount
  const discountAmount = rawTotal * profile.discountRate;
  const finalTotal = Math.max(0, Math.round(rawTotal - discountAmount)); // round to nearest Rupee

  return {
    // Map slabFare to baseFare so the legacy UI formula breaks down cleanly
    baseFare: rawTotal,
    distanceFare: 0.0,
    stopsFare: 0.0, // Arbitrary stop surcharges removed for deterministic slab modeling
    transferFare: 0.0, // Surat BRTS has integrated free transfers
    discount: parseFloat(discountAmount.toFixed(2)),
    rawFare: parseFloat(rawTotal.toFixed(2)),
    finalFare: finalTotal,
    profileName: profile.name,
    description: profile.description
  };
};

/**
 * Exposes the profiles directory for dashboard controls rendering.
 */
export const getPassengerProfiles = () => Object.values(FARE_CONFIG.PASSENGER_PROFILES);
