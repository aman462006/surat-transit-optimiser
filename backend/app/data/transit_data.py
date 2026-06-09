"""
Surat Sitilink BRTS Transit Data Layer (Python port of transitDataService.js)

Models the Surat Bus Rapid Transit System (BRTS / Sitilink) operated by
Surat Municipal Corporation (SMC): 62 stations across all operational
corridors, and 16 routes (13 real Sitilink routes + Dumas corridor + 2
planned extensions).

Each station: { id, name, lat, lng, corridors, amenities }
Each route:   { id, routeNumber, shortName, longName, corridorName,
                color, headway, averageSpeedKmh, bidirectional, stations }
"""

# ---------------------------------------------------------------------------
# BRTS STATION NETWORK — 62 stations
# ---------------------------------------------------------------------------
BRTS_STATIONS = {
    # Dumas Road Corridor (Southwest)
    "dumas_beach": {"id": "dumas_beach", "name": "Dumas Beach Terminal", "lat": 21.0870, "lng": 72.7120,
                    "corridors": ["Dumas Road Corridor"], "amenities": ["Terminal Parking", "Ticket Booth", "Restrooms"]},
    "magdalla": {"id": "magdalla", "name": "Magdalla BRTS Station", "lat": 21.1080, "lng": 72.7250,
                 "corridors": ["Dumas Road Corridor"], "amenities": ["Elevated High Platform", "Bicycle Dock"]},
    "gavier": {"id": "gavier", "name": "Gavier BRTS Station", "lat": 21.1270, "lng": 72.7480,
               "corridors": ["Dumas Road Corridor"], "amenities": ["Elevated High Platform", "Bicycle Dock"]},

    # ONGC / Piplod area (South-Central)
    "ongc_colony": {"id": "ongc_colony", "name": "ONGC Colony Terminal", "lat": 21.1390, "lng": 72.7490,
                    "corridors": ["Corridor 2: ONGC–Sarthana", "Dumas Road Corridor"],
                    "amenities": ["Terminal Hub", "EV Charging Station", "Ticketing Gate"]},
    "vesu": {"id": "vesu", "name": "Vesu BRTS Station", "lat": 21.1390, "lng": 72.7710,
             "corridors": ["Dumas Road Corridor"], "amenities": ["Elevated High Platform", "Wheelchair Ramps"]},
    "anuvrat_dwar": {"id": "anuvrat_dwar", "name": "Anuvrat Dwar Junction BRTS", "lat": 21.1480, "lng": 72.7600,
                     "corridors": ["Corridor 6: Anuvrat Dwar–St Thomas", "Dumas Road Corridor"],
                     "amenities": ["Interchange Platform", "Wheelchair Ramps", "Ticket Vending Machine"]},

    # South-Central zone
    "svnit": {"id": "svnit", "name": "SVNIT BRTS Station", "lat": 21.1648, "lng": 72.7844,
              "corridors": ["Dumas Road Corridor"], "amenities": ["Elevated High Platform", "Bicycle Dock", "Ticket Vending Machine"]},
    "piplod": {"id": "piplod", "name": "Piplod BRTS Station", "lat": 21.1712, "lng": 72.7758,
               "corridors": ["Corridor 2: ONGC–Sarthana", "Dumas Road Corridor"],
               "amenities": ["Elevated High Platform", "Visual Assist Screens"]},
    "st_thomas_jn": {"id": "st_thomas_jn", "name": "St Thomas School Junction BRTS", "lat": 21.1550, "lng": 72.7800,
                     "corridors": ["Corridor 6: Anuvrat Dwar–St Thomas", "Corridor 7: St Thomas–Daksheshwar"],
                     "amenities": ["Elevated High Platform", "Wheelchair Ramps"]},

    # Pal / Adajan corridor (West-Central)
    "pal_rto": {"id": "pal_rto", "name": "Pal R.T.O. BRTS Station", "lat": 21.1750, "lng": 72.7620,
                "corridors": ["Corridor 4: Adajan–Pal", "Corridor 5: Pal–ONGC"],
                "amenities": ["Elevated High Platform", "Ticketing Counter"]},
    "pal": {"id": "pal", "name": "Pal BRTS Station", "lat": 21.1770, "lng": 72.7710,
            "corridors": ["Corridor 4: Adajan–Pal"], "amenities": ["Elevated High Platform", "Bicycle Dock"]},
    "bhulka_vihar": {"id": "bhulka_vihar", "name": "Bhulka Vihar School BRTS", "lat": 21.1780, "lng": 72.7680,
                     "corridors": ["Corridor 4: Adajan–Pal"], "amenities": ["Elevated High Platform", "Wheelchair Ramps"]},
    "adajan_gam": {"id": "adajan_gam", "name": "Adajan Gam BRTS Station", "lat": 21.1860, "lng": 72.8000,
                   "corridors": ["Corridor 3: Adajan–Jahangirpura"], "amenities": ["Elevated High Platform"]},
    "adajan_circle": {"id": "adajan_circle", "name": "Adajan Circle BRTS", "lat": 21.1895, "lng": 72.7980,
                      "corridors": ["Corridor 3: Adajan–Jahangirpura", "Corridor 4: Adajan–Pal"],
                      "amenities": ["Interchange Platform", "Ticket Vending Machine"]},
    "adajan_patia": {"id": "adajan_patia", "name": "Adajan Patiya BRTS", "lat": 21.1980, "lng": 72.8080,
                     "corridors": ["Corridor 3: Adajan–Jahangirpura", "Corridor 4: Adajan–Pal"],
                     "amenities": ["Interchange Hub", "Prepaid Ticketing Gate"]},

    # Central spine
    "kargil_chowk": {"id": "kargil_chowk", "name": "Kargil Chowk BRTS", "lat": 21.1738, "lng": 72.7938,
                     "corridors": ["Corridor 2: ONGC–Sarthana", "Dumas Road Corridor"],
                     "amenities": ["Interchange Gate", "Wheelchair Ramps"]},
    "athwa_gate": {"id": "athwa_gate", "name": "Athwa Gate BRTS Station", "lat": 21.1820, "lng": 72.8050,
                   "corridors": ["Central Hub", "Corridor 3: Adajan–Jahangirpura"],
                   "amenities": ["Multi-line Interchange Hub", "Ticketing Counter", "Security Office"]},
    "parle_point": {"id": "parle_point", "name": "Parle Point BRTS Station", "lat": 21.1810, "lng": 72.8150,
                    "corridors": ["Corridor 2: ONGC–Sarthana"], "amenities": ["Elevated High Platform", "Bicycle Dock"]},
    "bhatar": {"id": "bhatar", "name": "Bhatar BRTS Station", "lat": 21.1800, "lng": 72.8080,
               "corridors": ["Central Hub"], "amenities": ["Elevated High Platform", "Wheelchair Ramps"]},
    "chiku_wadi": {"id": "chiku_wadi", "name": "Chiku Wadi BRTS Station", "lat": 21.1650, "lng": 72.8050,
                   "corridors": ["Corridor 2: ONGC–Sarthana", "Canal Road Corridor"], "amenities": ["Elevated High Platform"]},

    # Canal Road / Althan zone
    "canal_road": {"id": "canal_road", "name": "Canal Road BRTS", "lat": 21.1794, "lng": 72.8122,
                   "corridors": ["Canal Road Corridor"], "amenities": ["Elevated High Platform"]},
    "althan": {"id": "althan", "name": "Althan Depot BRTS Terminal", "lat": 21.1620, "lng": 72.8200,
               "corridors": ["Canal Road Corridor"], "amenities": ["Bus Depot", "EV Charging Station", "Ticket Vending Machine"]},
    "y_junction": {"id": "y_junction", "name": "Canal Rd Y Junction Hub", "lat": 21.1834, "lng": 72.8256,
                   "corridors": ["Canal Road Corridor", "Corridor 2: ONGC–Sarthana"],
                   "amenities": ["Multi-level Platform", "Coffee Kiosk", "Pass Center"]},

    # Central-East hub
    "majura_gate": {"id": "majura_gate", "name": "Majura Gate BRTS Hub", "lat": 21.1850, "lng": 72.8220,
                    "corridors": ["Central Hub", "Corridor 2: ONGC–Sarthana"],
                    "amenities": ["Multi-line Interchange Hub", "Wheelchair Ramps", "Visual Assist Screens", "Information Desk"]},
    "ring_road": {"id": "ring_road", "name": "Ring Road BRTS Station", "lat": 21.1900, "lng": 72.8300,
                  "corridors": ["Ring Road Corridor"], "amenities": ["Elevated High Platform", "Bicycle Dock"]},

    # Udhna zone (Corridor 1 north end)
    "udhna_darwaja": {"id": "udhna_darwaja", "name": "Udhna Darwaja BRTS", "lat": 21.1782, "lng": 72.8354,
                      "corridors": ["Corridor 1: Udhna–Sachin", "Central Hub"],
                      "amenities": ["Interchange Hub", "Prepaid Ticketing Gate", "Security Station"]},
    "sahara_darwaja": {"id": "sahara_darwaja", "name": "Sahara Darwaja BRTS", "lat": 21.1720, "lng": 72.8380,
                       "corridors": ["Corridor 1: Udhna–Sachin"], "amenities": ["Elevated High Platform", "Wheelchair Ramps"]},
    "udhna_gnd": {"id": "udhna_gnd", "name": "Udhna Teen Rasta BRTS", "lat": 21.1680, "lng": 72.8420,
                  "corridors": ["Corridor 1: Udhna–Sachin"], "amenities": ["Interchange Gate", "Wheelchair Ramps"]},
    "udhna_academy": {"id": "udhna_academy", "name": "Udhna Academy BRTS", "lat": 21.1630, "lng": 72.8440,
                      "corridors": ["Corridor 1: Udhna–Sachin"], "amenities": ["Elevated High Platform"]},
    "kharwar_nagar": {"id": "kharwar_nagar", "name": "Kharwar Nagar BRTS", "lat": 21.1750, "lng": 72.8500,
                      "corridors": ["Corridor 1: Udhna–Sachin", "Kamrej Corridor"],
                      "amenities": ["Elevated High Platform", "Ticket Vending Machine"]},

    # Sachin corridor (Corridor 1 south)
    "pandesara_gidc": {"id": "pandesara_gidc", "name": "Pandesara G.I.D.C. BRTS", "lat": 21.1350, "lng": 72.8550,
                       "corridors": ["Corridor 1: Udhna–Sachin"], "amenities": ["Elevated High Platform", "Wheelchair Ramps"]},
    "unn_industrial": {"id": "unn_industrial", "name": "UNN Industrial Estate BRTS", "lat": 21.1200, "lng": 72.8580,
                       "corridors": ["Corridor 1: Udhna–Sachin"], "amenities": ["Elevated High Platform"]},
    "sachin_gidc": {"id": "sachin_gidc", "name": "Sachin G.I.D.C. Naka BRTS", "lat": 21.0950, "lng": 72.8620,
                    "corridors": ["Corridor 1: Udhna–Sachin"], "amenities": ["Terminal Hub", "Ticket Counter", "Security Station"]},
    "paliwal": {"id": "paliwal", "name": "Paliwal BRTS Station", "lat": 21.0900, "lng": 72.8550,
                "corridors": ["Sachin Extension"], "amenities": ["Elevated High Platform"]},
    "sachin_rly_stn": {"id": "sachin_rly_stn", "name": "Sachin Railway Station BRTS", "lat": 21.0880, "lng": 72.8500,
                       "corridors": ["Sachin Extension"], "amenities": ["Railway Interchange", "Ticket Counter", "Waiting Room"]},

    # Dindoli zone
    "dindoli": {"id": "dindoli", "name": "Dindoli Gam BRTS Station", "lat": 21.1450, "lng": 72.8600,
                "corridors": ["Corridor 8: Dindoli–Hirabaug"], "amenities": ["Elevated High Platform", "Wheelchair Ramps"]},

    # North-Central — Surat Railway Station hub
    "railway_station": {"id": "railway_station", "name": "Surat Railway Station Hub", "lat": 21.2045, "lng": 72.8407,
                        "corridors": ["Central Hub", "Corridor 2: ONGC–Sarthana", "Kamrej Corridor"],
                        "amenities": ["Central Transit Terminal", "Information Desk", "Restrooms", "Security Office", "EV Charging"]},
    "chowk_bazar": {"id": "chowk_bazar", "name": "Chowk Bazar BRTS Station", "lat": 21.2000, "lng": 72.8350,
                    "corridors": ["Central Hub"], "amenities": ["Elevated High Platform", "Ticketing Counter"]},
    "rander_road": {"id": "rander_road", "name": "Rander Road BRTS Station", "lat": 21.2050, "lng": 72.7950,
                    "corridors": ["Corridor 3: Adajan–Jahangirpura"], "amenities": ["Elevated High Platform"]},

    # Jahangirpura (Northwest terminal)
    "jahangirpura": {"id": "jahangirpura", "name": "Jahangirpura Community Hall BRTS", "lat": 21.2220, "lng": 72.7850,
                     "corridors": ["Corridor 3: Adajan–Jahangirpura", "Corridor 10: Gajera–Jahangirpura"],
                     "amenities": ["Terminal Parking", "EV Charging Station", "EV Bus Depot"]},

    # Katargam zone
    "katargam_darwaja": {"id": "katargam_darwaja", "name": "Katargam Darwaja BRTS", "lat": 21.2100, "lng": 72.8430,
                         "corridors": ["Corridor 11: Katargam–Kosad", "Corridor 2: ONGC–Sarthana"],
                         "amenities": ["Interchange Platform", "Ticketing Counter"]},
    "katargam": {"id": "katargam", "name": "Katargam BRTS Station", "lat": 21.2150, "lng": 72.8500,
                 "corridors": ["Corridor 11: Katargam–Kosad"], "amenities": ["Elevated High Platform", "Bicycle Dock", "Wheelchair Ramps"]},
    "gajera_circle": {"id": "gajera_circle", "name": "Gajera Circle BRTS Hub", "lat": 21.2100, "lng": 72.8560,
                      "corridors": ["Corridor 10: Gajera–Jahangirpura", "Corridor 11: Katargam–Kosad"],
                      "amenities": ["Interchange Hub", "Ticket Vending Machine"]},
    "hirabaug": {"id": "hirabaug", "name": "Hirabaug BRTS Station", "lat": 21.2200, "lng": 72.8550,
                 "corridors": ["Corridor 8: Dindoli–Hirabaug", "Corridor 9: Hirabaug–Lake Garden"],
                 "amenities": ["Interchange Platform", "Wheelchair Ramps"]},

    # Varachha / Northeast zone
    "varachha": {"id": "varachha", "name": "Varachha BRTS Station", "lat": 21.2200, "lng": 72.8620,
                 "corridors": ["Corridor 2: ONGC–Sarthana", "Varachha Corridor"], "amenities": ["Elevated High Platform", "Ramps"]},
    "kapodra": {"id": "kapodra", "name": "Kapodra BRTS Station", "lat": 21.2250, "lng": 72.8700,
                "corridors": ["Varachha Corridor"], "amenities": ["Elevated High Platform", "Bicycle Dock"]},

    # Kosad zone
    "kosad": {"id": "kosad", "name": "Kosad BRTS Station", "lat": 21.2100, "lng": 72.8800,
              "corridors": ["Corridor 11: Katargam–Kosad"], "amenities": ["Elevated High Platform", "Ticket Vending Machine"]},
    "kosad_ews": {"id": "kosad_ews", "name": "Kosad EWS H2 BRTS Terminal", "lat": 21.2000, "lng": 72.8850,
                  "corridors": ["Corridor 11: Katargam–Kosad"], "amenities": ["Terminal Hub", "Ticketing Gate", "Waiting Room"]},
    "kosad_depot": {"id": "kosad_depot", "name": "Kosad Bus Depot BRTS", "lat": 21.1950, "lng": 72.8900,
                    "corridors": ["Corridor 11: Katargam–Kosad"], "amenities": ["Bus Depot", "EV Charging Station", "Maintenance Bay"]},

    # Sarthana (Northeast terminal)
    "sarthana": {"id": "sarthana", "name": "Sarthana Nature Park BRTS", "lat": 21.2330, "lng": 72.8990,
                 "corridors": ["Corridor 2: ONGC–Sarthana"],
                 "amenities": ["Terminal Parking", "EV Charging Station", "Drinking Water", "Nature Park Access"]},

    # Kamrej corridor (Far Northeast)
    "purushottam_nagar": {"id": "purushottam_nagar", "name": "Purushottam Nagar BRTS", "lat": 21.1950, "lng": 72.8600,
                          "corridors": ["Kamrej Corridor"], "amenities": ["Elevated High Platform"]},
    "diamond_nagar": {"id": "diamond_nagar", "name": "Diamond Nagar BRTS Station", "lat": 21.2480, "lng": 72.9100,
                      "corridors": ["Kamrej Corridor"], "amenities": ["Elevated High Platform", "Bicycle Dock"]},
    "laskana": {"id": "laskana", "name": "Laskana Gam BRTS Station", "lat": 21.2400, "lng": 72.9050,
                "corridors": ["Kamrej Corridor"], "amenities": ["Elevated High Platform"]},
    "sagwadi": {"id": "sagwadi", "name": "Sagwadi BRTS Station", "lat": 21.2300, "lng": 72.8950,
                "corridors": ["Kamrej Corridor"], "amenities": ["Elevated High Platform", "Wheelchair Ramps"]},
    "pasodara": {"id": "pasodara", "name": "Pasodara Gam BRTS Station", "lat": 21.2600, "lng": 72.9250,
                 "corridors": ["Kamrej Corridor"], "amenities": ["Elevated High Platform"]},
    "kamrej_terminal": {"id": "kamrej_terminal", "name": "Kamrej BRTS Terminal", "lat": 21.2720, "lng": 72.9350,
                        "corridors": ["Kamrej Corridor"], "amenities": ["Terminal Hub", "Cafeteria", "Waiting Lounge", "Security Station"]},

    # Utran
    "utran": {"id": "utran", "name": "Utran R.O.B. Bridge BRTS", "lat": 21.2450, "lng": 72.8800,
              "corridors": ["Varachha Corridor"], "amenities": ["Elevated High Platform", "Ticket Vending Machine"]},

    # Amroli
    "amroli": {"id": "amroli", "name": "Amroli BRTS Station", "lat": 21.2400, "lng": 72.8350,
               "corridors": ["Sayan Extension"], "amenities": ["Elevated High Platform", "Bicycle Dock"]},

    # Kadodara (Far South)
    "kadodara": {"id": "kadodara", "name": "Kadodara BRTS Terminal", "lat": 21.0960, "lng": 72.8150,
                 "corridors": ["South Extension"], "amenities": ["Terminal Hub", "Ticketing Gate", "Parking Lot"]},

    # Extended north corridors (planned)
    "jahangirabad": {"id": "jahangirabad", "name": "Jahangirabad BRTS Station", "lat": 21.2700, "lng": 72.7650,
                     "corridors": ["Olpad Extension"], "amenities": ["Elevated High Platform"]},
    "olpad_terminal": {"id": "olpad_terminal", "name": "Olpad BRTS Terminal", "lat": 21.3200, "lng": 72.7500,
                       "corridors": ["Olpad Extension"], "amenities": ["Terminal Hub", "EV Bus Depot", "Ticketing Gate"]},
    "sayan_terminal": {"id": "sayan_terminal", "name": "Sayan BRTS Terminal", "lat": 21.3100, "lng": 72.8700,
                       "corridors": ["Sayan Extension"],
                       "amenities": ["Terminal Hub", "EV Charging Dock", "Ticket Vending Machine", "Waiting Area"]},
}


# ---------------------------------------------------------------------------
# BRTS ROUTE NETWORK — 16 routes
# ---------------------------------------------------------------------------
BRTS_ROUTES = {
    "route-dc": {"id": "route-dc", "routeNumber": "DC", "shortName": "Dumas Corridor",
                 "longName": "Dumas Beach ↔ Surat Railway Station", "corridorName": "Dumas Road Corridor",
                 "color": "#f97316", "headway": 12, "averageSpeedKmh": 32, "bidirectional": True,
                 "stations": ["dumas_beach", "magdalla", "gavier", "vesu", "anuvrat_dwar", "st_thomas_jn",
                              "svnit", "piplod", "kargil_chowk", "athwa_gate", "majura_gate", "railway_station"]},

    "route-11": {"id": "route-11", "routeNumber": "11", "shortName": "Route 11",
                 "longName": "Udhna Darwaja ↔ Sachin G.I.D.C. Naka", "corridorName": "Corridor 1: Udhna–Sachin",
                 "color": "#ea580c", "headway": 8, "averageSpeedKmh": 35, "bidirectional": True,
                 "stations": ["udhna_darwaja", "sahara_darwaja", "udhna_gnd", "udhna_academy",
                              "pandesara_gidc", "unn_industrial", "sachin_gidc"]},

    "route-12": {"id": "route-12", "routeNumber": "12", "shortName": "Route 12",
                 "longName": "ONGC Colony ↔ Sarthana Nature Park", "corridorName": "Corridor 2: ONGC–Sarthana",
                 "color": "#06b6d4", "headway": 8, "averageSpeedKmh": 35, "bidirectional": True,
                 "stations": ["ongc_colony", "piplod", "kargil_chowk", "chiku_wadi", "canal_road", "parle_point",
                              "y_junction", "majura_gate", "railway_station", "katargam_darwaja", "varachha", "sarthana"]},

    "route-13": {"id": "route-13", "routeNumber": "13", "shortName": "Route 13",
                 "longName": "Jahangirpura Community Hall ↔ Kadodara", "corridorName": "Cross-City North–South",
                 "color": "#10b981", "headway": 12, "averageSpeedKmh": 32, "bidirectional": True,
                 "stations": ["jahangirpura", "rander_road", "adajan_patia", "athwa_gate", "majura_gate",
                              "udhna_darwaja", "sahara_darwaja", "dindoli", "kadodara"]},

    "route-14": {"id": "route-14", "routeNumber": "14", "shortName": "Route 14",
                 "longName": "ONGC Colony ↔ Kosad EWS H2", "corridorName": "ONGC–Kosad Connector",
                 "color": "#3b82f6", "headway": 12, "averageSpeedKmh": 32, "bidirectional": True,
                 "stations": ["ongc_colony", "piplod", "kargil_chowk", "athwa_gate", "majura_gate", "ring_road",
                              "gajera_circle", "katargam", "kosad", "kosad_ews"]},

    "route-15": {"id": "route-15", "routeNumber": "15", "shortName": "Route 15",
                 "longName": "Althan Depot Circular (via Athwa, Majura)", "corridorName": "Canal Road Corridor",
                 "color": "#ec4899", "headway": 15, "averageSpeedKmh": 30, "bidirectional": True,
                 "stations": ["althan", "chiku_wadi", "kargil_chowk", "athwa_gate", "majura_gate",
                              "y_junction", "canal_road", "althan"]},

    "route-16": {"id": "route-16", "routeNumber": "16", "shortName": "Route 16",
                 "longName": "Kosad Depot ↔ Sachin G.I.D.C. Junction", "corridorName": "Kosad–Sachin Connector",
                 "color": "#8b5cf6", "headway": 15, "averageSpeedKmh": 32, "bidirectional": True,
                 "stations": ["kosad_depot", "kosad", "gajera_circle", "katargam_darwaja", "railway_station",
                              "udhna_darwaja", "pandesara_gidc", "sachin_gidc"]},

    "route-17a": {"id": "route-17a", "routeNumber": "17A", "shortName": "Route 17A",
                  "longName": "Kamrej Terminal ↔ Bhulka Vihar School BRTS", "corridorName": "Kamrej–Pal Cross-City",
                  "color": "#ef4444", "headway": 12, "averageSpeedKmh": 32, "bidirectional": True,
                  "stations": ["kamrej_terminal", "pasodara", "diamond_nagar", "sarthana", "kapodra", "varachha",
                               "katargam", "railway_station", "majura_gate", "athwa_gate", "adajan_circle",
                               "pal", "pal_rto", "bhulka_vihar"]},

    "route-18": {"id": "route-18", "routeNumber": "18", "shortName": "Route 18",
                 "longName": "Railway Station Terminal ↔ Utran R.O.B. Bridge", "corridorName": "Utran Radial",
                 "color": "#f59e0b", "headway": 15, "averageSpeedKmh": 30, "bidirectional": True,
                 "stations": ["railway_station", "katargam_darwaja", "katargam", "hirabaug", "kapodra", "utran"]},

    "route-19": {"id": "route-19", "routeNumber": "19", "shortName": "Route 19",
                 "longName": "Railway Station Terminal ↔ Kadodara", "corridorName": "South Radial",
                 "color": "#14b8a6", "headway": 12, "averageSpeedKmh": 32, "bidirectional": True,
                 "stations": ["railway_station", "chowk_bazar", "udhna_darwaja", "sahara_darwaja", "dindoli", "kadodara"]},

    "route-20": {"id": "route-20", "routeNumber": "20", "shortName": "Route 20",
                 "longName": "Kosad EWS H2 ↔ Kharwar Nagar", "corridorName": "Kosad–Kharwar Connector",
                 "color": "#a855f7", "headway": 15, "averageSpeedKmh": 30, "bidirectional": True,
                 "stations": ["kosad_ews", "kosad", "kharwar_nagar"]},

    "route-21": {"id": "route-21", "routeNumber": "21", "shortName": "Route 21",
                 "longName": "Jahangirpura Community Hall ↔ Althan Depot", "corridorName": "Jahangirpura–Althan Arc",
                 "color": "#6366f1", "headway": 12, "averageSpeedKmh": 30, "bidirectional": True,
                 "stations": ["jahangirpura", "rander_road", "adajan_patia", "adajan_circle", "adajan_gam",
                              "athwa_gate", "bhatar", "canal_road", "chiku_wadi", "althan"]},

    "route-22": {"id": "route-22", "routeNumber": "22", "shortName": "Route 22",
                 "longName": "Kosad EWS H2 ↔ Sarthana Nature Park", "corridorName": "Kosad–Sarthana Connector",
                 "color": "#22c55e", "headway": 15, "averageSpeedKmh": 30, "bidirectional": True,
                 "stations": ["kosad_ews", "kosad", "kapodra", "varachha", "sarthana"]},

    "route-23": {"id": "route-23", "routeNumber": "23", "shortName": "Route 23",
                 "longName": "Kamrej Terminal ↔ Sachin Railway Station", "corridorName": "Kamrej–Sachin Eastern Spine",
                 "color": "#e11d48", "headway": 12, "averageSpeedKmh": 32, "bidirectional": True,
                 "stations": ["kamrej_terminal", "pasodara", "diamond_nagar", "laskana", "sagwadi",
                              "purushottam_nagar", "kharwar_nagar", "udhna_darwaja", "sahara_darwaja", "udhna_gnd",
                              "udhna_academy", "pandesara_gidc", "unn_industrial", "sachin_gidc", "paliwal", "sachin_rly_stn"]},

    "route-ol": {"id": "route-ol", "routeNumber": "OL", "shortName": "Olpad Ext.",
                 "longName": "Olpad Terminal ↔ Surat Railway Station", "corridorName": "Olpad Extension",
                 "color": "#0ea5e9", "headway": 15, "averageSpeedKmh": 30, "bidirectional": True,
                 "stations": ["olpad_terminal", "jahangirabad", "jahangirpura", "rander_road", "adajan_patia", "railway_station"]},

    "route-sy": {"id": "route-sy", "routeNumber": "SY", "shortName": "Sayan Ext.",
                 "longName": "Sayan Terminal ↔ Surat Railway Station", "corridorName": "Sayan Extension",
                 "color": "#d946ef", "headway": 15, "averageSpeedKmh": 30, "bidirectional": True,
                 "stations": ["sayan_terminal", "amroli", "railway_station"]},
}


def get_all_stations():
    return list(BRTS_STATIONS.values())


def get_all_routes():
    return list(BRTS_ROUTES.values())
