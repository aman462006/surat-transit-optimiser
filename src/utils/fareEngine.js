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

  // Supportive passenger profiles and discount rates modeled on SMC policies.
  // `info`/`howToAvail`/`availUrl` power the in-app fare-profile chooser. Discount
  // rates are this app's modelled calibration — confirm current official fares at
  // the linked SMC Sitilink pages.
  PASSENGER_PROFILES: {
    standard: {
      id: 'standard',
      name: 'Standard Fare',
      discountRate: 0.0,
      description: 'Standard single-journey electronic ticket',
      info: 'Pay-as-you-go single-journey ticket bought at the station counter or in the Sitilink app. No verification or registration needed — the default for occasional riders.',
      howToAvail: 'Just tap in and pay the listed fare at the BRTS station, or book a single ticket in the Surat Sitilink app.',
      availUrl: 'https://www.suratsitilink.org/GetFare.aspx',
      availLabel: 'See official Sitilink fares'
    },
    digital: {
      id: 'digital',
      name: 'Digital Ticket (20% Off)',
      discountRate: 0.20,
      description: 'Official Sitilink App mobile ticket / Surat Money Card discount',
      info: 'Cashless fares are cheaper than paper tickets. Book journeys in the official Surat Sitilink app or tap a Surat Money Card to ride at a discounted rate.',
      howToAvail: 'Download the official Surat Sitilink app (or get a Surat Money Card), top it up, and book/tap to travel.',
      availUrl: 'https://www.suratsitilink.org/download_sitilink_mobile_app.aspx',
      availLabel: 'Download the Surat Sitilink app'
    },
    student: {
      id: 'student',
      name: 'Student Discount (50% Off)',
      discountRate: 0.50,
      description: 'Concessional student travel under the SARAL pass scheme',
      info: 'Concessional travel for students under SMC Sitilink’s SARAL prepaid pass scheme — a big saving for daily college/school commutes.',
      howToAvail: 'Apply for a SARAL student pass with a bonafide certificate from a Government-approved educational institution plus a passport-size photo, at a Sitilink pass centre or online.',
      availUrl: 'https://www.suratmunicipal.gov.in/Services/Sitilink/SaralPassTravelScheme',
      availLabel: 'Apply for the SARAL student pass'
    },
    senior: {
      id: 'senior',
      name: 'Senior Citizen (30% Off)',
      discountRate: 0.30,
      description: 'Concessional fare for senior citizens (60+)',
      info: 'Supportive, discounted travel for senior citizens, issued against a Government senior-citizen card under the SARAL pass scheme.',
      howToAvail: 'Apply for a SARAL senior-citizen pass with a Government-issued senior citizen card / age proof and a passport-size photo at a Sitilink pass centre.',
      availUrl: 'https://www.suratmunicipal.gov.in/Services/Sitilink/SaralPassTravelScheme',
      availLabel: 'Apply for the SARAL senior pass'
    },
    pass_holder: {
      id: 'pass_holder',
      name: 'Daily/Monthly Pass Holder',
      discountRate: 1.00, // 100% discount per ride for active pass holders (the pass is paid for upfront)
      description: 'Unlimited prepaid SARAL pass — shows as ₹0 per trip',
      info: 'A SARAL prepaid pass gives unlimited rides for a fixed period, so each individual trip costs nothing extra — the per-trip fare here shows as ₹0.',
      howToAvail: 'Buy or recharge a SARAL pass through the Surat Sitilink app or at any Sitilink pass centre, then tap to ride as often as you like.',
      availUrl: 'https://www.suratmunicipal.gov.in/Services/Sitilink/SaralPassTravelScheme',
      availLabel: 'Get / recharge a SARAL pass'
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
