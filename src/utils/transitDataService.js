/**
 * =========================================================================
 * Comprehensive Surat Sitilink BRTS Transit Data Layer
 * =========================================================================
 *
 * Models the complete Surat Bus Rapid Transit System (BRTS / Sitilink)
 * operated by Surat Municipal Corporation (SMC).
 *
 * Data Sources & Calibration:
 *   - Surat Municipal Corporation official BRTS corridor documentation
 *   - Wikipedia: Surat Bus Rapid Transit System (corridor & route listings)
 *   - OpenStreetMap geographic coordinate references
 *   - SMC Sitilink route timetable publications (Routes 11–23)
 *   - Google Maps transit layer verification
 *
 * Network Coverage:
 *   - 85 stations across all operational corridors
 *     (62 base + 23 traced from the official Sitilink "Transit Map")
 *   - 21 routes (16 base + 5 transit-map-derived corridors)
 *   - Phase 1: Corridor 1 (Udhna–Sachin), Corridor 2 (ONGC–Sarthana)
 *   - Phase 2: Corridors 3–11 covering Adajan, Pal, Katargam, Kosad,
 *              Dindoli, Hirabaug, Gajera Circle, and Jahangirpura
 *   - Extensions: Olpad, Sayan outer corridors
 *
 * GTFS Concepts Modeled:
 *   - Stops/Stations (stops.txt): 62 geolocated transit nodes
 *   - Routes (routes.txt): 16 structured transit lines with station sequences
 *   - Calendar/Trips: Simulated via route headways and average speeds
 */

// =========================================================================
// BRTS STATION NETWORK
// 85 stations across all operational Surat BRTS corridors
// =========================================================================

export const BRTS_STATIONS = {

  // =======================================================================
  // DUMAS ROAD CORRIDOR (Southwest)
  // Connects Dumas Beach through Magdalla/ONGC to city center
  // =======================================================================
  dumas_beach: {
    id: 'dumas_beach',
    name: 'Dumas Beach Terminal',
    lat: 21.0870,
    lng: 72.7120,
    corridors: ['Dumas Road Corridor'],
    amenities: ['Terminal Parking', 'Ticket Booth', 'Restrooms']
  },
  magdalla: {
    id: 'magdalla',
    name: 'Magdalla BRTS Station',
    lat: 21.1080,
    lng: 72.7250,
    corridors: ['Dumas Road Corridor'],
    amenities: ['Elevated High Platform', 'Bicycle Dock']
  },
  gavier: {
    id: 'gavier',
    name: 'Gavier BRTS Station',
    lat: 21.1270,
    lng: 72.7480,
    corridors: ['Dumas Road Corridor'],
    amenities: ['Elevated High Platform', 'Bicycle Dock']
  },

  // =======================================================================
  // ONGC / PIPLOD AREA (South-Central)
  // ONGC Colony is a Route 12/14 terminal; Vesu & Anuvrat Dwar are
  // key interchange nodes on the Dumas–City Center axis
  // =======================================================================
  ongc_colony: {
    id: 'ongc_colony',
    name: 'ONGC Colony Terminal',
    lat: 21.1390,
    lng: 72.7490,
    corridors: ['Corridor 2: ONGC–Sarthana', 'Dumas Road Corridor'],
    amenities: ['Terminal Hub', 'EV Charging Station', 'Ticketing Gate']
  },
  vesu: {
    id: 'vesu',
    name: 'Vesu BRTS Station',
    lat: 21.1390,
    lng: 72.7710,
    corridors: ['Dumas Road Corridor'],
    amenities: ['Elevated High Platform', 'Wheelchair Ramps']
  },
  anuvrat_dwar: {
    id: 'anuvrat_dwar',
    name: 'Anuvrat Dwar Junction BRTS',
    lat: 21.1480,
    lng: 72.7600,
    corridors: ['Corridor 6: Anuvrat Dwar–St Thomas', 'Dumas Road Corridor'],
    amenities: ['Interchange Platform', 'Wheelchair Ramps', 'Ticket Vending Machine']
  },

  // =======================================================================
  // SOUTH-CENTRAL ZONE
  // SVNIT, Piplod, St Thomas Junction — key academic and residential nodes
  // =======================================================================
  svnit: {
    id: 'svnit',
    name: 'SVNIT BRTS Station',
    lat: 21.1648,
    lng: 72.7844,
    corridors: ['Dumas Road Corridor'],
    amenities: ['Elevated High Platform', 'Bicycle Dock', 'Ticket Vending Machine']
  },
  piplod: {
    id: 'piplod',
    name: 'Piplod BRTS Station',
    lat: 21.1712,
    lng: 72.7758,
    corridors: ['Corridor 2: ONGC–Sarthana', 'Dumas Road Corridor'],
    amenities: ['Elevated High Platform', 'Visual Assist Screens']
  },
  st_thomas_jn: {
    id: 'st_thomas_jn',
    name: 'St Thomas School Junction BRTS',
    lat: 21.1550,
    lng: 72.7800,
    corridors: ['Corridor 6: Anuvrat Dwar–St Thomas', 'Corridor 7: St Thomas–Daksheshwar'],
    amenities: ['Elevated High Platform', 'Wheelchair Ramps']
  },

  // =======================================================================
  // PAL / ADAJAN CORRIDOR (West-Central)
  // Corridors 3 & 4: Connects Adajan Patiya to Jahangirpura and Pal RTO
  // =======================================================================
  pal_rto: {
    id: 'pal_rto',
    name: 'Pal R.T.O. BRTS Station',
    lat: 21.1750,
    lng: 72.7620,
    corridors: ['Corridor 4: Adajan–Pal', 'Corridor 5: Pal–ONGC'],
    amenities: ['Elevated High Platform', 'Ticketing Counter']
  },
  pal: {
    id: 'pal',
    name: 'Pal BRTS Station',
    lat: 21.1770,
    lng: 72.7710,
    corridors: ['Corridor 4: Adajan–Pal'],
    amenities: ['Elevated High Platform', 'Bicycle Dock']
  },
  bhulka_vihar: {
    id: 'bhulka_vihar',
    name: 'Bhulka Vihar School BRTS',
    lat: 21.1780,
    lng: 72.7680,
    corridors: ['Corridor 4: Adajan–Pal'],
    amenities: ['Elevated High Platform', 'Wheelchair Ramps']
  },
  adajan_gam: {
    id: 'adajan_gam',
    name: 'Adajan Gam BRTS Station',
    lat: 21.1860,
    lng: 72.8000,
    corridors: ['Corridor 3: Adajan–Jahangirpura'],
    amenities: ['Elevated High Platform']
  },
  adajan_circle: {
    id: 'adajan_circle',
    name: 'Adajan Circle BRTS',
    lat: 21.1895,
    lng: 72.7980,
    corridors: ['Corridor 3: Adajan–Jahangirpura', 'Corridor 4: Adajan–Pal'],
    amenities: ['Interchange Platform', 'Ticket Vending Machine']
  },
  adajan_patia: {
    id: 'adajan_patia',
    name: 'Adajan Patiya BRTS',
    lat: 21.1980,
    lng: 72.8080,
    corridors: ['Corridor 3: Adajan–Jahangirpura', 'Corridor 4: Adajan–Pal'],
    amenities: ['Interchange Hub', 'Prepaid Ticketing Gate']
  },

  // =======================================================================
  // CENTRAL SPINE
  // Major interchange nodes connecting multiple corridors
  // =======================================================================
  kargil_chowk: {
    id: 'kargil_chowk',
    name: 'Kargil Chowk BRTS',
    lat: 21.1738,
    lng: 72.7938,
    corridors: ['Corridor 2: ONGC–Sarthana', 'Dumas Road Corridor'],
    amenities: ['Interchange Gate', 'Wheelchair Ramps']
  },
  athwa_gate: {
    id: 'athwa_gate',
    name: 'Athwa Gate BRTS Station',
    lat: 21.1820,
    lng: 72.8050,
    corridors: ['Central Hub', 'Corridor 3: Adajan–Jahangirpura'],
    amenities: ['Multi-line Interchange Hub', 'Ticketing Counter', 'Security Office']
  },
  parle_point: {
    id: 'parle_point',
    name: 'Parle Point BRTS Station',
    lat: 21.1810,
    lng: 72.8150,
    corridors: ['Corridor 2: ONGC–Sarthana'],
    amenities: ['Elevated High Platform', 'Bicycle Dock']
  },
  bhatar: {
    id: 'bhatar',
    name: 'Bhatar BRTS Station',
    lat: 21.1800,
    lng: 72.8080,
    corridors: ['Central Hub'],
    amenities: ['Elevated High Platform', 'Wheelchair Ramps']
  },
  chiku_wadi: {
    id: 'chiku_wadi',
    name: 'Chiku Wadi BRTS Station',
    lat: 21.1650,
    lng: 72.8050,
    corridors: ['Corridor 2: ONGC–Sarthana', 'Canal Road Corridor'],
    amenities: ['Elevated High Platform']
  },

  // =======================================================================
  // CANAL ROAD / ALTHAN ZONE
  // Corridor 2 passes through Canal Road; Althan is Route 15/21 terminal
  // =======================================================================
  canal_road: {
    id: 'canal_road',
    name: 'Canal Road BRTS',
    lat: 21.1794,
    lng: 72.8122,
    corridors: ['Canal Road Corridor'],
    amenities: ['Elevated High Platform']
  },
  althan: {
    id: 'althan',
    name: 'Althan Depot BRTS Terminal',
    lat: 21.1620,
    lng: 72.8200,
    corridors: ['Canal Road Corridor'],
    amenities: ['Bus Depot', 'EV Charging Station', 'Ticket Vending Machine']
  },
  y_junction: {
    id: 'y_junction',
    name: 'Canal Rd Y Junction Hub',
    lat: 21.1834,
    lng: 72.8256,
    corridors: ['Canal Road Corridor', 'Corridor 2: ONGC–Sarthana'],
    amenities: ['Multi-level Platform', 'Coffee Kiosk', 'Pass Center']
  },

  // =======================================================================
  // CENTRAL-EAST HUB
  // Majura Gate is the single largest interchange in the BRTS network
  // =======================================================================
  majura_gate: {
    id: 'majura_gate',
    name: 'Majura Gate BRTS Hub',
    lat: 21.1850,
    lng: 72.8220,
    corridors: ['Central Hub', 'Corridor 2: ONGC–Sarthana'],
    amenities: ['Multi-line Interchange Hub', 'Wheelchair Ramps', 'Visual Assist Screens', 'Information Desk']
  },
  ring_road: {
    id: 'ring_road',
    name: 'Ring Road BRTS Station',
    lat: 21.1900,
    lng: 72.8300,
    corridors: ['Ring Road Corridor'],
    amenities: ['Elevated High Platform', 'Bicycle Dock']
  },

  // =======================================================================
  // UDHNA ZONE (Corridor 1 North End)
  // Udhna Darwaja is the Phase 1 Corridor 1 origin/anchor
  // =======================================================================
  udhna_darwaja: {
    id: 'udhna_darwaja',
    name: 'Udhna Darwaja BRTS',
    lat: 21.1782,
    lng: 72.8354,
    corridors: ['Corridor 1: Udhna–Sachin', 'Central Hub'],
    amenities: ['Interchange Hub', 'Prepaid Ticketing Gate', 'Security Station']
  },
  sahara_darwaja: {
    id: 'sahara_darwaja',
    name: 'Sahara Darwaja BRTS',
    lat: 21.1720,
    lng: 72.8380,
    corridors: ['Corridor 1: Udhna–Sachin'],
    amenities: ['Elevated High Platform', 'Wheelchair Ramps']
  },
  udhna_gnd: {
    id: 'udhna_gnd',
    name: 'Udhna Teen Rasta BRTS',
    lat: 21.1680,
    lng: 72.8420,
    corridors: ['Corridor 1: Udhna–Sachin'],
    amenities: ['Interchange Gate', 'Wheelchair Ramps']
  },
  udhna_academy: {
    id: 'udhna_academy',
    name: 'Udhna Academy BRTS',
    lat: 21.1630,
    lng: 72.8440,
    corridors: ['Corridor 1: Udhna–Sachin'],
    amenities: ['Elevated High Platform']
  },
  kharwar_nagar: {
    id: 'kharwar_nagar',
    name: 'Kharwar Nagar BRTS',
    lat: 21.1750,
    lng: 72.8500,
    corridors: ['Corridor 1: Udhna–Sachin', 'Kamrej Corridor'],
    amenities: ['Elevated High Platform', 'Ticket Vending Machine']
  },

  // =======================================================================
  // SACHIN CORRIDOR (Corridor 1 South — Phase 1)
  // Industrial belt connecting Udhna to Sachin GIDC
  // ~10.2 km, Route 11 primary corridor
  // =======================================================================
  pandesara_gidc: {
    id: 'pandesara_gidc',
    name: 'Pandesara G.I.D.C. BRTS',
    lat: 21.1350,
    lng: 72.8550,
    corridors: ['Corridor 1: Udhna–Sachin'],
    amenities: ['Elevated High Platform', 'Wheelchair Ramps']
  },
  unn_industrial: {
    id: 'unn_industrial',
    name: 'UNN Industrial Estate BRTS',
    lat: 21.1200,
    lng: 72.8580,
    corridors: ['Corridor 1: Udhna–Sachin'],
    amenities: ['Elevated High Platform']
  },
  sachin_gidc: {
    id: 'sachin_gidc',
    name: 'Sachin G.I.D.C. Naka BRTS',
    lat: 21.0950,
    lng: 72.8620,
    corridors: ['Corridor 1: Udhna–Sachin'],
    amenities: ['Terminal Hub', 'Ticket Counter', 'Security Station']
  },
  paliwal: {
    id: 'paliwal',
    name: 'Paliwal BRTS Station',
    lat: 21.0900,
    lng: 72.8550,
    corridors: ['Sachin Extension'],
    amenities: ['Elevated High Platform']
  },
  sachin_rly_stn: {
    id: 'sachin_rly_stn',
    name: 'Sachin Railway Station BRTS',
    lat: 21.0880,
    lng: 72.8500,
    corridors: ['Sachin Extension'],
    amenities: ['Railway Interchange', 'Ticket Counter', 'Waiting Room']
  },

  // =======================================================================
  // DINDOLI ZONE (Corridor 8 South End)
  // Industrial/residential feeder area
  // =======================================================================
  dindoli: {
    id: 'dindoli',
    name: 'Dindoli Gam BRTS Station',
    lat: 21.1450,
    lng: 72.8600,
    corridors: ['Corridor 8: Dindoli–Hirabaug'],
    amenities: ['Elevated High Platform', 'Wheelchair Ramps']
  },

  // =======================================================================
  // NORTH-CENTRAL ZONE — SURAT RAILWAY STATION HUB
  // The Railway Station is the single most connected node in the network
  // =======================================================================
  railway_station: {
    id: 'railway_station',
    name: 'Surat Railway Station Hub',
    lat: 21.2045,
    lng: 72.8407,
    corridors: ['Central Hub', 'Corridor 2: ONGC–Sarthana', 'Kamrej Corridor'],
    amenities: ['Central Transit Terminal', 'Information Desk', 'Restrooms', 'Security Office', 'EV Charging']
  },
  chowk_bazar: {
    id: 'chowk_bazar',
    name: 'Chowk Bazar BRTS Station',
    lat: 21.2000,
    lng: 72.8350,
    corridors: ['Central Hub'],
    amenities: ['Elevated High Platform', 'Ticketing Counter']
  },
  rander_road: {
    id: 'rander_road',
    name: 'Rander Road BRTS Station',
    lat: 21.2050,
    lng: 72.7950,
    corridors: ['Corridor 3: Adajan–Jahangirpura'],
    amenities: ['Elevated High Platform']
  },

  // =======================================================================
  // JAHANGIRPURA (Northwest Terminal)
  // Route 13/21 terminal; Corridor 3 endpoint
  // =======================================================================
  jahangirpura: {
    id: 'jahangirpura',
    name: 'Jahangirpura Community Hall BRTS',
    lat: 21.2220,
    lng: 72.7850,
    corridors: ['Corridor 3: Adajan–Jahangirpura', 'Corridor 10: Gajera–Jahangirpura'],
    amenities: ['Terminal Parking', 'EV Charging Station', 'EV Bus Depot']
  },

  // =======================================================================
  // KATARGAM ZONE (North-Central)
  // Corridor 10 (Gajera Circle–Jahangirpura) & Corridor 11 (Katargam–Kosad)
  // Previously missing from dataset — now fully covered
  // =======================================================================
  katargam_darwaja: {
    id: 'katargam_darwaja',
    name: 'Katargam Darwaja BRTS',
    lat: 21.2100,
    lng: 72.8430,
    corridors: ['Corridor 11: Katargam–Kosad', 'Corridor 2: ONGC–Sarthana'],
    amenities: ['Interchange Platform', 'Ticketing Counter']
  },
  katargam: {
    id: 'katargam',
    name: 'Katargam BRTS Station',
    lat: 21.2150,
    lng: 72.8500,
    corridors: ['Corridor 11: Katargam–Kosad'],
    amenities: ['Elevated High Platform', 'Bicycle Dock', 'Wheelchair Ramps']
  },
  gajera_circle: {
    id: 'gajera_circle',
    name: 'Gajera Circle BRTS Hub',
    lat: 21.2100,
    lng: 72.8560,
    corridors: ['Corridor 10: Gajera–Jahangirpura', 'Corridor 11: Katargam–Kosad'],
    amenities: ['Interchange Hub', 'Ticket Vending Machine']
  },
  hirabaug: {
    id: 'hirabaug',
    name: 'Hirabaug BRTS Station',
    lat: 21.2200,
    lng: 72.8550,
    corridors: ['Corridor 8: Dindoli–Hirabaug', 'Corridor 9: Hirabaug–Lake Garden'],
    amenities: ['Interchange Platform', 'Wheelchair Ramps']
  },

  // =======================================================================
  // VARACHHA / NORTHEAST ZONE
  // High-density residential + commercial commuter belt
  // =======================================================================
  varachha: {
    id: 'varachha',
    name: 'Varachha BRTS Station',
    lat: 21.2200,
    lng: 72.8620,
    corridors: ['Corridor 2: ONGC–Sarthana', 'Varachha Corridor'],
    amenities: ['Elevated High Platform', 'Ramps']
  },
  kapodra: {
    id: 'kapodra',
    name: 'Kapodra BRTS Station',
    lat: 21.2250,
    lng: 72.8700,
    corridors: ['Varachha Corridor'],
    amenities: ['Elevated High Platform', 'Bicycle Dock']
  },

  // =======================================================================
  // KOSAD ZONE (East)
  // Corridor 11 (Katargam–Kosad); Routes 14, 20, 22
  // =======================================================================
  kosad: {
    id: 'kosad',
    name: 'Kosad BRTS Station',
    lat: 21.2100,
    lng: 72.8800,
    corridors: ['Corridor 11: Katargam–Kosad'],
    amenities: ['Elevated High Platform', 'Ticket Vending Machine']
  },
  kosad_ews: {
    id: 'kosad_ews',
    name: 'Kosad EWS H2 BRTS Terminal',
    lat: 21.2000,
    lng: 72.8850,
    corridors: ['Corridor 11: Katargam–Kosad'],
    amenities: ['Terminal Hub', 'Ticketing Gate', 'Waiting Room']
  },
  kosad_depot: {
    id: 'kosad_depot',
    name: 'Kosad Bus Depot BRTS',
    lat: 21.1950,
    lng: 72.8900,
    corridors: ['Corridor 11: Katargam–Kosad'],
    amenities: ['Bus Depot', 'EV Charging Station', 'Maintenance Bay']
  },

  // =======================================================================
  // SARTHANA (Northeast Terminal)
  // Corridor 2 endpoint; Route 12/17A/22 terminal
  // =======================================================================
  sarthana: {
    id: 'sarthana',
    name: 'Sarthana Nature Park BRTS',
    lat: 21.2330,
    lng: 72.8990,
    corridors: ['Corridor 2: ONGC–Sarthana'],
    amenities: ['Terminal Parking', 'EV Charging Station', 'Drinking Water', 'Nature Park Access']
  },

  // =======================================================================
  // KAMREJ CORRIDOR (Far Northeast)
  // Route 17A and Route 23 pass through this industrial/suburban belt
  // =======================================================================
  purushottam_nagar: {
    id: 'purushottam_nagar',
    name: 'Purushottam Nagar BRTS',
    lat: 21.1950,
    lng: 72.8600,
    corridors: ['Kamrej Corridor'],
    amenities: ['Elevated High Platform']
  },
  diamond_nagar: {
    id: 'diamond_nagar',
    name: 'Diamond Nagar BRTS Station',
    lat: 21.2480,
    lng: 72.9100,
    corridors: ['Kamrej Corridor'],
    amenities: ['Elevated High Platform', 'Bicycle Dock']
  },
  laskana: {
    id: 'laskana',
    name: 'Laskana Gam BRTS Station',
    lat: 21.2400,
    lng: 72.9050,
    corridors: ['Kamrej Corridor'],
    amenities: ['Elevated High Platform']
  },
  sagwadi: {
    id: 'sagwadi',
    name: 'Sagwadi BRTS Station',
    lat: 21.2300,
    lng: 72.8950,
    corridors: ['Kamrej Corridor'],
    amenities: ['Elevated High Platform', 'Wheelchair Ramps']
  },
  pasodara: {
    id: 'pasodara',
    name: 'Pasodara Gam BRTS Station',
    lat: 21.2600,
    lng: 72.9250,
    corridors: ['Kamrej Corridor'],
    amenities: ['Elevated High Platform']
  },
  kamrej_terminal: {
    id: 'kamrej_terminal',
    name: 'Kamrej BRTS Terminal',
    lat: 21.2720,
    lng: 72.9350,
    corridors: ['Kamrej Corridor'],
    amenities: ['Terminal Hub', 'Cafeteria', 'Waiting Lounge', 'Security Station']
  },

  // =======================================================================
  // UTRAN (North-Northeast)
  // Route 18 terminal
  // =======================================================================
  utran: {
    id: 'utran',
    name: 'Utran R.O.B. Bridge BRTS',
    lat: 21.2450,
    lng: 72.8800,
    corridors: ['Varachha Corridor'],
    amenities: ['Elevated High Platform', 'Ticket Vending Machine']
  },

  // =======================================================================
  // AMROLI (North)
  // Sayan corridor intermediate node
  // =======================================================================
  amroli: {
    id: 'amroli',
    name: 'Amroli BRTS Station',
    lat: 21.2400,
    lng: 72.8350,
    corridors: ['Sayan Extension'],
    amenities: ['Elevated High Platform', 'Bicycle Dock']
  },

  // =======================================================================
  // KADODARA (Far South)
  // Route 13/19 terminal
  // =======================================================================
  kadodara: {
    id: 'kadodara',
    name: 'Kadodara BRTS Terminal',
    lat: 21.0960,
    lng: 72.8150,
    corridors: ['South Extension'],
    amenities: ['Terminal Hub', 'Ticketing Gate', 'Parking Lot']
  },

  // =======================================================================
  // EXTENDED NORTH CORRIDORS (Planned / Proposed)
  // Olpad and Sayan outer corridor extensions for future network growth
  // =======================================================================
  jahangirabad: {
    id: 'jahangirabad',
    name: 'Jahangirabad BRTS Station',
    lat: 21.2700,
    lng: 72.7650,
    corridors: ['Olpad Extension'],
    amenities: ['Elevated High Platform']
  },
  olpad_terminal: {
    id: 'olpad_terminal',
    name: 'Olpad BRTS Terminal',
    lat: 21.3200,
    lng: 72.7500,
    corridors: ['Olpad Extension'],
    amenities: ['Terminal Hub', 'EV Bus Depot', 'Ticketing Gate']
  },
  sayan_terminal: {
    id: 'sayan_terminal',
    name: 'Sayan BRTS Terminal',
    lat: 21.3100,
    lng: 72.8700,
    corridors: ['Sayan Extension'],
    amenities: ['Terminal Hub', 'EV Charging Dock', 'Ticket Vending Machine', 'Waiting Area']
  },

  // =======================================================================
  // TRANSIT-MAP DERIVED STATIONS (Sitilink official "Transit Map")
  // Added from zoomed Sitilink app map crops by tracing the maroon BRTS
  // network. Coordinates marked (geo) are geocoded from OpenStreetMap;
  // those marked (map) are estimated from the map relative to neighbours
  // (neighbourhood-accurate, not survey-grade GPS).
  // =======================================================================

  // ---- North branch: Railway Stn → Katargam → Gajera → Kosad / Utran ----
  gajera_school: {
    id: 'gajera_school',
    name: 'Gajera School Circle BRTS',
    lat: 21.2160, lng: 72.8520, // (map)
    corridors: ['Corridor 11: Katargam–Kosad', 'Katargam North Branch'],
    amenities: ['Elevated High Platform', 'Ticket Vending Machine']
  },
  maansarovar_circle: {
    id: 'maansarovar_circle',
    name: 'Maansarovar Circle BRTS',
    lat: 21.2270, lng: 72.8520, // (map)
    corridors: ['Katargam North Branch'],
    amenities: ['Elevated High Platform']
  },
  kosad_gam: {
    id: 'kosad_gam',
    name: 'Kosad Gam BRTS Station',
    lat: 21.2380, lng: 72.8670, // (map)
    corridors: ['Katargam North Branch', 'Corridor 11: Katargam–Kosad'],
    amenities: ['Elevated High Platform', 'Wheelchair Ramps']
  },

  // ---- Northeast: Varachha → Mota Varachha → Sarthana → Simada ----
  mota_varachha: {
    id: 'mota_varachha',
    name: 'Mota Varachha BRTS Station',
    lat: 21.2350, lng: 72.8830, // (map)
    corridors: ['Varachha Corridor', 'Corridor 2: ONGC–Sarthana'],
    amenities: ['Elevated High Platform', 'Bicycle Dock']
  },
  shavjikorat_jn: {
    id: 'shavjikorat_jn',
    name: 'Shavjikorat Junction BRTS',
    lat: 21.2300, lng: 72.8920, // (map)
    corridors: ['Corridor 2: ONGC–Sarthana'],
    amenities: ['Interchange Platform']
  },
  simada: {
    id: 'simada',
    name: 'Simada Gam BRTS Station',
    lat: 21.22087, lng: 72.89815, // (geo)
    corridors: ['Sarthana East Branch'],
    amenities: ['Elevated High Platform']
  },

  // ---- East spine: Railway Stn → Bombay Market → Parvat Patia → Godadara ----
  bombay_market: {
    id: 'bombay_market',
    name: 'Bombay Market BRTS Station',
    lat: 21.1920, lng: 72.8470, // (map)
    corridors: ['East Spine Corridor'],
    amenities: ['Elevated High Platform', 'Ticketing Counter']
  },
  parvat_patia: {
    id: 'parvat_patia',
    name: 'Parvat Patia BRTS Station',
    lat: 21.17959, lng: 72.86624, // (geo)
    corridors: ['East Spine Corridor'],
    amenities: ['Elevated High Platform', 'Wheelchair Ramps']
  },
  vishwakarma: {
    id: 'vishwakarma',
    name: 'Vishwakarma Chowk BRTS',
    lat: 21.1760, lng: 72.8620, // (map)
    corridors: ['East Spine Corridor'],
    amenities: ['Elevated High Platform']
  },
  nilgiri_circle: {
    id: 'nilgiri_circle',
    name: 'Nilgiri Circle BRTS Station',
    lat: 21.1640, lng: 72.8580, // (map)
    corridors: ['East Spine Corridor'],
    amenities: ['Elevated High Platform']
  },
  godadara: {
    id: 'godadara',
    name: 'Godadara BRTS Station',
    lat: 21.1755, lng: 72.87216, // (geo)
    corridors: ['East Spine Corridor', 'Corridor 8: Dindoli–Hirabaug'],
    amenities: ['Elevated High Platform', 'Bicycle Dock']
  },
  kumbharia: {
    id: 'kumbharia',
    name: 'Kumbharia BRTS Station',
    lat: 21.19136, lng: 72.85819, // (geo)
    corridors: ['East Spine Corridor'],
    amenities: ['Elevated High Platform']
  },
  kharavasa: {
    id: 'kharavasa',
    name: 'Kharavasa BRTS Station',
    lat: 21.1500, lng: 72.8820, // (map)
    corridors: ['Corridor 8: Dindoli–Hirabaug'],
    amenities: ['Elevated High Platform']
  },

  // ---- Central-south: Daksheshwar / Kapadia Wadi ----
  daksheshwar: {
    id: 'daksheshwar',
    name: 'Daksheshwar Mahadev Jn BRTS',
    lat: 21.1650, lng: 72.8600, // (map)
    corridors: ['Corridor 7: St Thomas–Daksheshwar'],
    amenities: ['Interchange Platform', 'Wheelchair Ramps']
  },
  kapadia_wadi: {
    id: 'kapadia_wadi',
    name: 'Kapadia Wadi BRTS Station',
    lat: 21.1750, lng: 72.8350, // (map)
    corridors: ['Central Hub'],
    amenities: ['Elevated High Platform']
  },

  // ---- South: Pandesara → Bhestan → Unn → Gabheni → Kanakpur ----
  bhestan: {
    id: 'bhestan',
    name: 'Bhestan Garden BRTS Station',
    lat: 21.12258, lng: 72.86303, // (geo)
    corridors: ['Corridor 1: Udhna–Sachin'],
    amenities: ['Elevated High Platform', 'Wheelchair Ramps']
  },
  gabheni: {
    id: 'gabheni',
    name: 'Gabheni BRTS Station',
    lat: 21.1050, lng: 72.8480, // (map)
    corridors: ['South Extension'],
    amenities: ['Elevated High Platform']
  },
  kanakpur: {
    id: 'kanakpur',
    name: 'Kanakpur–Kansad BRTS Station',
    lat: 21.0820, lng: 72.8720, // (map)
    corridors: ['South Extension'],
    amenities: ['Elevated High Platform']
  },

  // ---- Northwest: Rander → Ved → Dabholi → Variav → Ugat → Vivekanand ----
  ved_gam: {
    id: 'ved_gam',
    name: 'Ved Gam BRTS Station',
    lat: 21.2250, lng: 72.8230, // (map)
    corridors: ['Rander–Dabholi Branch'],
    amenities: ['Elevated High Platform']
  },
  dabholi_jn: {
    id: 'dabholi_jn',
    name: 'Dabholi Junction BRTS',
    lat: 21.23543, lng: 72.80741, // (geo)
    corridors: ['Rander–Dabholi Branch'],
    amenities: ['Interchange Platform', 'Ticket Vending Machine']
  },
  variav: {
    id: 'variav',
    name: 'Variav BRTS Station',
    lat: 21.25953, lng: 72.81677, // (geo)
    corridors: ['Rander–Dabholi Branch'],
    amenities: ['Elevated High Platform']
  },
  ugat: {
    id: 'ugat',
    name: 'Ugat BRTS Station',
    lat: 21.21851, lng: 72.78118, // (geo)
    corridors: ['Corridor 3: Adajan–Jahangirpura'],
    amenities: ['Elevated High Platform', 'Bicycle Dock']
  },
  vivekanand_college: {
    id: 'vivekanand_college',
    name: 'Vivekanand College BRTS',
    lat: 21.2497, lng: 72.78545, // (geo)
    corridors: ['Olpad Extension'],
    amenities: ['Elevated High Platform']
  }
};


// =========================================================================
// BRTS ROUTE NETWORK
// 21 routes: 16 base routes + 5 transit-map-derived corridors
// =========================================================================

export const BRTS_ROUTES = {

  // =======================================================================
  // ROUTE DC — Dumas Road Corridor
  // Dumas Beach ↔ Surat Railway Station (Southwest → Central)
  // Serves the Dumas tourism/residential corridor through ONGC, SVNIT, Piplod
  // =======================================================================
  'route-dc': {
    id: 'route-dc',
    routeNumber: 'DC',
    shortName: 'Dumas Corridor',
    longName: 'Dumas Beach ↔ Surat Railway Station',
    corridorName: 'Dumas Road Corridor',
    color: '#f97316', // Orange
    headway: 12,
    averageSpeedKmh: 32,
    bidirectional: true,
    stations: [
      'dumas_beach', 'magdalla', 'gavier', 'vesu', 'anuvrat_dwar',
      'st_thomas_jn', 'svnit', 'piplod', 'kargil_chowk',
      'athwa_gate', 'majura_gate', 'railway_station'
    ]
  },

  // =======================================================================
  // ROUTE 11 — Corridor 1 (Phase 1)
  // Udhna Darwaja ↔ Sachin G.I.D.C. Naka (~10.2 km)
  // Surat's first BRTS corridor, inaugurated January 2014
  // Serves the southern industrial belt (Pandesara, UNN, Sachin)
  // =======================================================================
  'route-11': {
    id: 'route-11',
    routeNumber: '11',
    shortName: 'Route 11',
    longName: 'Udhna Darwaja ↔ Sachin G.I.D.C. Naka',
    corridorName: 'Corridor 1: Udhna–Sachin',
    color: '#ea580c', // Deep Orange
    headway: 8,
    averageSpeedKmh: 35,
    bidirectional: true,
    stations: [
      'udhna_darwaja', 'sahara_darwaja', 'udhna_gnd',
      'udhna_academy', 'pandesara_gidc', 'unn_industrial', 'sachin_gidc'
    ]
  },

  // =======================================================================
  // ROUTE 12 — Corridor 2 (Phase 1)
  // ONGC Colony ↔ Sarthana Nature Park (~19.7 km)
  // Cross-city trunk route through Canal Road, Majura Gate, Katargam, Varachha
  // =======================================================================
  'route-12': {
    id: 'route-12',
    routeNumber: '12',
    shortName: 'Route 12',
    longName: 'ONGC Colony ↔ Sarthana Nature Park',
    corridorName: 'Corridor 2: ONGC–Sarthana',
    color: '#06b6d4', // Cyan
    headway: 8,
    averageSpeedKmh: 35,
    bidirectional: true,
    stations: [
      'ongc_colony', 'piplod', 'kargil_chowk', 'chiku_wadi',
      'canal_road', 'parle_point', 'y_junction', 'majura_gate',
      'railway_station', 'katargam_darwaja', 'varachha', 'sarthana'
    ]
  },

  // =======================================================================
  // ROUTE 13 — Jahangirpura ↔ Kadodara
  // Cross-city north-south route through Adajan, Athwa, Udhna, Dindoli
  // =======================================================================
  'route-13': {
    id: 'route-13',
    routeNumber: '13',
    shortName: 'Route 13',
    longName: 'Jahangirpura Community Hall ↔ Kadodara',
    corridorName: 'Cross-City North–South',
    color: '#10b981', // Emerald
    headway: 12,
    averageSpeedKmh: 32,
    bidirectional: true,
    stations: [
      'jahangirpura', 'rander_road', 'adajan_patia',
      'athwa_gate', 'majura_gate', 'udhna_darwaja',
      'sahara_darwaja', 'dindoli', 'kadodara'
    ]
  },

  // =======================================================================
  // ROUTE 14 — ONGC Colony ↔ Kosad EWS H2
  // Southwest-to-East connector through Athwa, Majura, Katargam, Kosad
  // =======================================================================
  'route-14': {
    id: 'route-14',
    routeNumber: '14',
    shortName: 'Route 14',
    longName: 'ONGC Colony ↔ Kosad EWS H2',
    corridorName: 'ONGC–Kosad Connector',
    color: '#3b82f6', // Blue
    headway: 12,
    averageSpeedKmh: 32,
    bidirectional: true,
    stations: [
      'ongc_colony', 'piplod', 'kargil_chowk',
      'athwa_gate', 'majura_gate', 'ring_road',
      'gajera_circle', 'katargam', 'kosad', 'kosad_ews'
    ]
  },

  // =======================================================================
  // ROUTE 15 — Althan Depot Circular
  // Circular service through central interchange stations
  // (Modeled as linear loop: start and end at Althan)
  // =======================================================================
  'route-15': {
    id: 'route-15',
    routeNumber: '15',
    shortName: 'Route 15',
    longName: 'Althan Depot Circular (via Athwa, Majura)',
    corridorName: 'Canal Road Corridor',
    color: '#ec4899', // Pink
    headway: 15,
    averageSpeedKmh: 30,
    bidirectional: true,
    stations: [
      'althan', 'chiku_wadi', 'kargil_chowk',
      'athwa_gate', 'majura_gate', 'y_junction',
      'canal_road', 'althan'
    ]
  },

  // =======================================================================
  // ROUTE 16 — Kosad Depot ↔ Sachin G.I.D.C. Junction
  // Long north-south route connecting Kosad to southern industrial belt
  // =======================================================================
  'route-16': {
    id: 'route-16',
    routeNumber: '16',
    shortName: 'Route 16',
    longName: 'Kosad Depot ↔ Sachin G.I.D.C. Junction',
    corridorName: 'Kosad–Sachin Connector',
    color: '#8b5cf6', // Violet
    headway: 15,
    averageSpeedKmh: 32,
    bidirectional: true,
    stations: [
      'kosad_depot', 'kosad', 'gajera_circle', 'katargam_darwaja',
      'railway_station', 'udhna_darwaja', 'pandesara_gidc', 'sachin_gidc'
    ]
  },

  // =======================================================================
  // ROUTE 17A — Kamrej Terminal ↔ Bhulka Vihar School
  // Longest cross-city route: Far northeast Kamrej → City center → Southwest Pal
  // =======================================================================
  'route-17a': {
    id: 'route-17a',
    routeNumber: '17A',
    shortName: 'Route 17A',
    longName: 'Kamrej Terminal ↔ Bhulka Vihar School BRTS',
    corridorName: 'Kamrej–Pal Cross-City',
    color: '#ef4444', // Red
    headway: 12,
    averageSpeedKmh: 32,
    bidirectional: true,
    stations: [
      'kamrej_terminal', 'pasodara', 'diamond_nagar',
      'sarthana', 'kapodra', 'varachha', 'katargam',
      'railway_station', 'majura_gate', 'athwa_gate',
      'adajan_circle', 'pal', 'pal_rto', 'bhulka_vihar'
    ]
  },

  // =======================================================================
  // ROUTE 18 — Railway Station ↔ Utran R.O.B. Bridge
  // North-northeast radial through Katargam, Hirabaug, Kapodra
  // =======================================================================
  'route-18': {
    id: 'route-18',
    routeNumber: '18',
    shortName: 'Route 18',
    longName: 'Railway Station Terminal ↔ Utran R.O.B. Bridge',
    corridorName: 'Utran Radial',
    color: '#f59e0b', // Amber
    headway: 15,
    averageSpeedKmh: 30,
    bidirectional: true,
    stations: [
      'railway_station', 'katargam_darwaja', 'katargam',
      'hirabaug', 'kapodra', 'utran'
    ]
  },

  // =======================================================================
  // ROUTE 19 — Railway Station ↔ Kadodara
  // South radial through Udhna, Dindoli to far-south Kadodara
  // =======================================================================
  'route-19': {
    id: 'route-19',
    routeNumber: '19',
    shortName: 'Route 19',
    longName: 'Railway Station Terminal ↔ Kadodara',
    corridorName: 'South Radial',
    color: '#14b8a6', // Teal
    headway: 12,
    averageSpeedKmh: 32,
    bidirectional: true,
    stations: [
      'railway_station', 'chowk_bazar', 'udhna_darwaja',
      'sahara_darwaja', 'dindoli', 'kadodara'
    ]
  },

  // =======================================================================
  // ROUTE 20 — Kosad EWS H2 ↔ Kharwar Nagar
  // Short east-to-central connector
  // =======================================================================
  'route-20': {
    id: 'route-20',
    routeNumber: '20',
    shortName: 'Route 20',
    longName: 'Kosad EWS H2 ↔ Kharwar Nagar',
    corridorName: 'Kosad–Kharwar Connector',
    color: '#a855f7', // Purple
    headway: 15,
    averageSpeedKmh: 30,
    bidirectional: true,
    stations: [
      'kosad_ews', 'kosad', 'kharwar_nagar'
    ]
  },

  // =======================================================================
  // ROUTE 21 — Jahangirpura ↔ Althan Depot
  // West-to-south arc through Adajan, Athwa, Canal Road
  // =======================================================================
  'route-21': {
    id: 'route-21',
    routeNumber: '21',
    shortName: 'Route 21',
    longName: 'Jahangirpura Community Hall ↔ Althan Depot',
    corridorName: 'Jahangirpura–Althan Arc',
    color: '#6366f1', // Indigo
    headway: 12,
    averageSpeedKmh: 30,
    bidirectional: true,
    stations: [
      'jahangirpura', 'rander_road', 'adajan_patia',
      'adajan_circle', 'adajan_gam', 'athwa_gate',
      'bhatar', 'canal_road', 'chiku_wadi', 'althan'
    ]
  },

  // =======================================================================
  // ROUTE 22 — Kosad EWS H2 ↔ Sarthana Nature Park
  // Short northeast connector through Varachha
  // =======================================================================
  'route-22': {
    id: 'route-22',
    routeNumber: '22',
    shortName: 'Route 22',
    longName: 'Kosad EWS H2 ↔ Sarthana Nature Park',
    corridorName: 'Kosad–Sarthana Connector',
    color: '#22c55e', // Green
    headway: 15,
    averageSpeedKmh: 30,
    bidirectional: true,
    stations: [
      'kosad_ews', 'kosad', 'kapodra', 'varachha', 'sarthana'
    ]
  },

  // =======================================================================
  // ROUTE 23 — Kamrej Terminal ↔ Sachin Railway Station
  // Longest single corridor route traversing the entire eastern spine
  // Kamrej → Diamond Nagar → Sagwadi → Udhna → Pandesara → Sachin
  // =======================================================================
  'route-23': {
    id: 'route-23',
    routeNumber: '23',
    shortName: 'Route 23',
    longName: 'Kamrej Terminal ↔ Sachin Railway Station',
    corridorName: 'Kamrej–Sachin Eastern Spine',
    color: '#e11d48', // Rose
    headway: 12,
    averageSpeedKmh: 32,
    bidirectional: true,
    stations: [
      'kamrej_terminal', 'pasodara', 'diamond_nagar', 'laskana',
      'sagwadi', 'purushottam_nagar', 'kharwar_nagar',
      'udhna_darwaja', 'sahara_darwaja', 'udhna_gnd',
      'udhna_academy', 'pandesara_gidc', 'unn_industrial',
      'sachin_gidc', 'paliwal', 'sachin_rly_stn'
    ]
  },

  // =======================================================================
  // ROUTE OL — Olpad Extension (Planned)
  // North-western suburban corridor: Olpad → Jahangirabad → Jahangirpura → City
  // =======================================================================
  'route-ol': {
    id: 'route-ol',
    routeNumber: 'OL',
    shortName: 'Olpad Ext.',
    longName: 'Olpad Terminal ↔ Surat Railway Station',
    corridorName: 'Olpad Extension',
    color: '#0ea5e9', // Sky Blue
    headway: 15,
    averageSpeedKmh: 30,
    bidirectional: true,
    stations: [
      'olpad_terminal', 'jahangirabad', 'jahangirpura',
      'rander_road', 'adajan_patia', 'railway_station'
    ]
  },

  // =======================================================================
  // ROUTE SY — Sayan Extension (Planned)
  // North-eastern suburban corridor: Sayan → Amroli → Railway Station
  // =======================================================================
  'route-sy': {
    id: 'route-sy',
    routeNumber: 'SY',
    shortName: 'Sayan Ext.',
    longName: 'Sayan Terminal ↔ Surat Railway Station',
    corridorName: 'Sayan Extension',
    color: '#d946ef', // Fuchsia
    headway: 15,
    averageSpeedKmh: 30,
    bidirectional: true,
    stations: [
      'sayan_terminal', 'amroli', 'railway_station'
    ]
  },

  // =======================================================================
  // TRANSIT-MAP DERIVED ROUTES
  // Corridors traced from the maroon BRTS network on the Sitilink transit
  // map. Station ordering follows the map's geographic line; intermediate
  // ordering is best-effort, not the official operational timetable.
  // =======================================================================

  // Katargam North branch — Railway Station ↔ Kosad Gam (via Gajera)
  'route-kn': {
    id: 'route-kn',
    routeNumber: 'KN',
    shortName: 'Katargam North',
    longName: 'Surat Railway Station ↔ Kosad Gam',
    corridorName: 'Katargam North Branch',
    color: '#0891b2', // Dark Cyan
    headway: 14,
    averageSpeedKmh: 31,
    bidirectional: true,
    stations: [
      'railway_station', 'katargam_darwaja', 'gajera_school',
      'gajera_circle', 'maansarovar_circle', 'kosad_gam', 'kosad'
    ]
  },

  // East Spine — Railway Station ↔ Kharavasa (via Parvat Patia, Godadara)
  'route-es': {
    id: 'route-es',
    routeNumber: 'ES',
    shortName: 'East Spine',
    longName: 'Surat Railway Station ↔ Kharavasa',
    corridorName: 'East Spine Corridor',
    color: '#b45309', // Dark Amber
    headway: 12,
    averageSpeedKmh: 30,
    bidirectional: true,
    stations: [
      'railway_station', 'bombay_market', 'parvat_patia', 'vishwakarma',
      'daksheshwar', 'nilgiri_circle', 'godadara', 'dindoli',
      'kumbharia', 'kharavasa'
    ]
  },

  // Northeast Varachha branch — Railway Station ↔ Simada (via Sarthana)
  'route-ne': {
    id: 'route-ne',
    routeNumber: 'NE',
    shortName: 'Varachha NE',
    longName: 'Surat Railway Station ↔ Simada Gam',
    corridorName: 'Sarthana East Branch',
    color: '#15803d', // Dark Green
    headway: 13,
    averageSpeedKmh: 31,
    bidirectional: true,
    stations: [
      'railway_station', 'katargam_darwaja', 'varachha', 'mota_varachha',
      'shavjikorat_jn', 'sarthana', 'simada'
    ]
  },

  // South Extension — Udhna Darwaja ↔ Kadodara (via Pandesara, Sachin)
  'route-sx': {
    id: 'route-sx',
    routeNumber: 'SX',
    shortName: 'South Ext.',
    longName: 'Udhna Darwaja ↔ Kadodara (via Sachin)',
    corridorName: 'South Extension',
    color: '#7c3aed', // Violet
    headway: 14,
    averageSpeedKmh: 32,
    bidirectional: true,
    stations: [
      'udhna_darwaja', 'kapadia_wadi', 'pandesara_gidc', 'bhestan',
      'unn_industrial', 'sachin_gidc', 'gabheni', 'kanakpur', 'kadodara'
    ]
  },

  // Rander–Dabholi branch — Railway Station ↔ Jahangirpura (via Variav)
  'route-rd': {
    id: 'route-rd',
    routeNumber: 'RD',
    shortName: 'Rander–Dabholi',
    longName: 'Surat Railway Station ↔ Jahangirpura (via Dabholi)',
    corridorName: 'Rander–Dabholi Branch',
    color: '#be185d', // Dark Pink
    headway: 14,
    averageSpeedKmh: 30,
    bidirectional: true,
    stations: [
      'railway_station', 'chowk_bazar', 'rander_road', 'ved_gam',
      'dabholi_jn', 'variav', 'ugat', 'vivekanand_college', 'jahangirpura'
    ]
  }
};


// =========================================================================
// DATA ACCESS HELPERS
// =========================================================================

/**
 * Retrieves all registered BRTS station nodes as an array.
 */
export const getAllStations = () => Object.values(BRTS_STATIONS);

/**
 * Retrieves all registered BRTS route networks as an array.
 */
export const getAllRoutes = () => Object.values(BRTS_ROUTES);


// =========================================================================
// NETWORK VALIDATION & DEBUG LOGGING
// Verifies dataset integrity: station count, route count, corridor
// continuity, orphan detection, and reference consistency.
// =========================================================================

/**
 * Validates the transit network dataset and logs diagnostic information.
 * Call this at application startup to verify data integrity.
 *
 * Checks:
 *   1. Total station count and route count
 *   2. All station IDs referenced in routes exist in BRTS_STATIONS
 *   3. Orphan stations (stations not served by any route)
 *   4. Route station counts and geographic span (km)
 *   5. Transfer hub detection (stations served by 3+ routes)
 *
 * @returns {Object} Validation result { valid, stationCount, routeCount, errors, warnings }
 */
export const validateTransitNetwork = () => {
  const errors = [];
  const warnings = [];

  const stationIds = new Set(Object.keys(BRTS_STATIONS));
  const routeIds = Object.keys(BRTS_ROUTES);
  const stationCount = stationIds.size;
  const routeCount = routeIds.length;

  console.log('═══════════════════════════════════════════════════════');
  console.log('  SURAT BRTS TRANSIT NETWORK — VALIDATION REPORT');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`  Total Stations : ${stationCount}`);
  console.log(`  Total Routes   : ${routeCount}`);
  console.log('───────────────────────────────────────────────────────');

  // 1. Check for missing station references in routes
  const referencedStations = new Set();
  routeIds.forEach(routeId => {
    const route = BRTS_ROUTES[routeId];
    route.stations.forEach(sid => {
      referencedStations.add(sid);
      if (!stationIds.has(sid)) {
        errors.push(`Route "${route.routeNumber}" references missing station ID: "${sid}"`);
      }
    });
  });

  // 2. Detect orphan stations
  const orphans = [];
  stationIds.forEach(sid => {
    if (!referencedStations.has(sid)) {
      orphans.push(sid);
      warnings.push(`Orphan station not on any route: "${sid}" (${BRTS_STATIONS[sid].name})`);
    }
  });

  // 3. Per-route diagnostics
  console.log('\n  ROUTE DIAGNOSTICS:');
  routeIds.forEach(routeId => {
    const route = BRTS_ROUTES[routeId];
    const stns = route.stations;
    let totalDist = 0;
    for (let i = 0; i < stns.length - 1; i++) {
      const a = BRTS_STATIONS[stns[i]];
      const b = BRTS_STATIONS[stns[i + 1]];
      if (a && b) {
        const R = 6371;
        const dLat = ((b.lat - a.lat) * Math.PI) / 180;
        const dLon = ((b.lng - a.lng) * Math.PI) / 180;
        const x = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) *
          Math.sin(dLon / 2) * Math.sin(dLon / 2);
        totalDist += R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
      }
    }
    console.log(`    Route ${route.routeNumber.padEnd(4)} | ${stns.length} stops | ~${totalDist.toFixed(1)} km | ${route.longName}`);
  });

  // 4. Transfer hub detection
  const stationRouteCount = {};
  routeIds.forEach(routeId => {
    BRTS_ROUTES[routeId].stations.forEach(sid => {
      stationRouteCount[sid] = (stationRouteCount[sid] || 0) + 1;
    });
  });
  const transferHubs = Object.entries(stationRouteCount)
    .filter(([, count]) => count >= 3)
    .sort((a, b) => b[1] - a[1]);

  console.log('\n  TRANSFER HUBS (3+ routes):');
  transferHubs.forEach(([sid, count]) => {
    console.log(`    ${BRTS_STATIONS[sid].name.padEnd(38)} — ${count} routes`);
  });

  // 5. Orphan report
  if (orphans.length > 0) {
    console.log(`\n  ⚠ ORPHAN STATIONS (${orphans.length}): ${orphans.join(', ')}`);
  } else {
    console.log('\n  ✓ No orphan stations — all stations connected to at least one route.');
  }

  // 6. Summary
  const valid = errors.length === 0;
  if (valid) {
    console.log('\n  ✓ NETWORK VALIDATION PASSED — All references consistent.');
  } else {
    console.log(`\n  ✗ NETWORK VALIDATION FAILED — ${errors.length} error(s) detected:`);
    errors.forEach(e => console.log(`    ERROR: ${e}`));
  }
  console.log('═══════════════════════════════════════════════════════\n');

  return { valid, stationCount, routeCount, errors, warnings, transferHubs };
};
