"""
Transport recommendation engine (port of recommendationEngine.js).

Computes travel time, trip cost, CO2 and a weighted composite score for each
mode (BRTS electric bus, auto rickshaw pooling, private car) on the same OSRM route, then
labels and ranks them.
"""
from app.services.graph import find_multimodal_route

# Per-unit tailpipe CO2 + city default mileage/price for the private car.
# Petrol/diesel are billed per LITRE; CNG per KILOGRAM (mileage km/kg, CO2 kg/kg).
PRIVATE_CAR_FUELS = {
    "petrol": {"unit": "L",  "co2PerUnit": 2.31, "mileage": 15, "pricePerUnit": 96.0},
    "diesel": {"unit": "L",  "co2PerUnit": 2.68, "mileage": 18, "pricePerUnit": 92.0},
    "cng":    {"unit": "kg", "co2PerUnit": 2.75, "mileage": 28, "pricePerUnit": 79.0},
}

# Tailpipe CO2 per kg of CNG combustion (methane stoichiometric, 44/16).
CO2_KG_PER_KG_CNG = 2.75
# Official Indian grid carbon intensity, CEA CO2 Baseline Database v20.0 (2024).
GRID_CO2_KG_PER_KWH = 0.757

PRIVATE_CAR_EMISSION_FACTOR = 150.0  # g CO2 per passenger-km (legacy, unused — car CO2 is fuel-based)

TRANSIT_MODES = {
    "BUS": {
        # 1.20 kWh/km * 0.757 kg CO2/kWh (CEA 2024) / 40 passengers = 22.71 g CO2/passenger-km
        "id": "electric-bus", "name": "Electric Bus BRTS", "icon": "🚌",
        "speedFactor": 1.10, "baseFare": 5, "costPerKm": 1,
        "energyKwhPerKm": 1.20, "occupancy": 40, "emissionFactor": 22.71,
        "safetyIndex": 90, "accessibilityIndex": 98, "walkingRequiredMeters": 450, "transfersRequired": 1,
    },
    "AUTO_POOL": {
        # Surat/Gujarat metered auto tariff split across pooled riders:
        #   singleAutoFare = autoBaseFare + max(0, km - autoBaseDistanceKm) * autoPerKm
        #   farePerPerson  = round(singleAutoFare / autoOccupancy)
        # Gujarat RTO metered auto card: Rs.18 base (incl. first 1.25 km), Rs.13/km thereafter.
        # CO2 = (km / autoCngMileage) * 2.75 kg CO2/kg -- FULL trip total (not per-person).
        "id": "auto-pool", "name": "Auto Rickshaw Pooling", "icon": "🛺",
        "speedFactor": 0.95,
        "autoBaseFare": 18, "autoBaseDistanceKm": 1.25, "autoPerKm": 13, "autoOccupancy": 3,
        "autoCngMileage": 30,  # km per kg of CNG (avg city auto, range 25-35 km/kg)
        "safetyIndex": 82, "accessibilityIndex": 75, "walkingRequiredMeters": 80, "transfersRequired": 0,
    },
    "PRIVATE_CAR": {
        "id": "private-car", "name": "Private Car", "icon": "🚙",
        "speedFactor": 1.00, "baseFare": 0, "costPerKm": 0, "emissionFactor": 154.0,
        "mileageKmpl": 15.0, "fuelPricePerLitre": 96.0, "defaultFuelType": "petrol",
        "safetyIndex": 75, "accessibilityIndex": 100, "walkingRequiredMeters": 5, "transfersRequired": 0,
    },
}


def _normalize(value, vmin, vmax):
    """Min-max scaling: low -> 0 (best), high -> 1 (worst)."""
    if vmax == vmin:
        return 0
    return (value - vmin) / (vmax - vmin)


def generate_recommendations(distance, duration, source=None, destination=None,
                             profile_id="standard", private_car_options=None):
    """Build, score, label and rank the available transport modes."""
    if not distance or not duration:
        return []

    private_car_options = private_car_options or {}

    # Fixed balanced weights (time, cost, emissions). Other dimensions reserved.
    w = {"time": 0.40, "cost": 0.30, "emissions": 0.30,
         "safety": 0.0, "accessibility": 0.0, "walking": 0.0, "transfer": 0.0}

    fuel_type = private_car_options.get("fuelType")
    if fuel_type not in PRIVATE_CAR_FUELS:
        fuel_type = "petrol"
    fuel_spec = PRIVATE_CAR_FUELS[fuel_type]  # {unit, co2PerUnit, mileage, pricePerUnit}

    brts_route = (find_multimodal_route(source, destination, profile_id, 0.1)
                  if source and destination else None)

    options = []
    for mode in TRANSIT_MODES.values():
        # BRTS bus uses high-fidelity multimodal graph metrics when available
        if mode["id"] == "electric-bus" and brts_route:
            co2 = round((brts_route["transitDistanceKm"] * mode["emissionFactor"]) / 1000, 3)
            options.append({
                **mode,
                "travelTime": brts_route["totalTimeMins"],
                "tripCost": brts_route["fareDetails"]["finalFare"],
                "co2Emissions": co2,
                "fuelUsedLitres": 0,
                "walkingRequiredMeters": round(brts_route["walkingDistanceKm"] * 1000),
                "transfersRequired": brts_route["transfersCount"],
                "brtsItinerary": brts_route,
                "convenienceSummary": "Bus + station access",
            })
            continue

        travel_time = max(2, round(duration * mode["speedFactor"]))

        if mode["id"] == "private-car":
            # Mileage/price units follow the fuel: km/L & Rs/L for petrol-diesel, km/kg & Rs/kg for CNG
            opt_mileage = private_car_options.get("mileageKmpl")
            mileage = opt_mileage if isinstance(opt_mileage, (int, float)) and opt_mileage > 0 else fuel_spec["mileage"]
            opt_price = private_car_options.get("fuelPricePerLitre")
            price = opt_price if isinstance(opt_price, (int, float)) and opt_price > 0 else fuel_spec["pricePerUnit"]

            fuel_used = round(distance / mileage, 3)  # litres for petrol/diesel, kg for CNG
            trip_cost = round(fuel_used * price, 2)
            co2 = round(fuel_used * fuel_spec["co2PerUnit"], 3)

            options.append({
                **mode,
                "travelTime": travel_time,
                "tripCost": trip_cost,
                "co2Emissions": co2,
                "fuelUsedLitres": fuel_used,
                "privateCarFuelType": fuel_type,
                "privateCarFuelUnit": fuel_spec["unit"],
                "privateCarMileageKmpl": mileage,
                "privateCarFuelPricePerLitre": price,
                "privateCarCo2KgPerLitre": fuel_spec["co2PerUnit"],
                "convenienceSummary": "Door-to-door",
            })
            continue

        if mode["id"] == "auto-pool":
            # Metered Surat/Gujarat auto fare, then split across pooled riders
            billable_km = max(0.0, distance - mode["autoBaseDistanceKm"])
            single_auto_fare = mode["autoBaseFare"] + billable_km * mode["autoPerKm"]
            trip_cost = round(single_auto_fare / mode["autoOccupancy"])
            # CO2 = CNG used (kg) * 2.75 kg CO2/kg -- full trip total for the shared auto
            cng_used_kg = round(distance / mode["autoCngMileage"], 3)
            co2 = round(cng_used_kg * CO2_KG_PER_KG_CNG, 3)
            options.append({
                **mode,
                "travelTime": travel_time,
                "tripCost": trip_cost,
                "co2Emissions": co2,
                "fuelUsedLitres": 0,
                "cngUsedKg": cng_used_kg,
                "autoSingleFare": round(single_auto_fare),  # full metered fare before pooling split
                "convenienceSummary": "Shared auto ride",
            })
            continue

        trip_cost = round(mode["baseFare"] + distance * mode["costPerKm"])
        co2 = round((distance * mode["emissionFactor"]) / 1000, 3)
        options.append({
            **mode,
            "travelTime": travel_time,
            "tripCost": trip_cost,
            "co2Emissions": co2,
            "fuelUsedLitres": 0,
            "convenienceSummary": "Bus + station access",
        })

    # Min-max boundaries for normalization
    times = [o["travelTime"] for o in options]
    costs = [o["tripCost"] for o in options]
    emissions = [o["co2Emissions"] for o in options]
    safeties = [o["safetyIndex"] for o in options]
    accessibilities = [o["accessibilityIndex"] for o in options]
    walkings = [o["walkingRequiredMeters"] for o in options]
    transfers = [o["transfersRequired"] for o in options]

    min_time, max_time = min(times), max(times)
    min_cost, max_cost = min(costs), max(costs)
    min_em, max_em = min(emissions), max(emissions)
    min_safety, max_safety = min(safeties), max(safeties)
    min_access, max_access = min(accessibilities), max(accessibilities)
    min_walk, max_walk = min(walkings), max(walkings)
    min_trans, max_trans = min(transfers), max(transfers)

    scored = []
    for opt in options:
        norm_time = _normalize(opt["travelTime"], min_time, max_time)
        norm_cost = _normalize(opt["tripCost"], min_cost, max_cost)
        norm_em = _normalize(opt["co2Emissions"], min_em, max_em)
        norm_safety = 1 - _normalize(opt["safetyIndex"], min_safety, max_safety)
        norm_access = 1 - _normalize(opt["accessibilityIndex"], min_access, max_access)
        norm_walk = _normalize(opt["walkingRequiredMeters"], min_walk, max_walk)
        norm_trans = _normalize(opt["transfersRequired"], min_trans, max_trans)

        composite = round(
            w["time"] * norm_time + w["cost"] * norm_cost + w["emissions"] * norm_em
            + w["safety"] * norm_safety + w["accessibility"] * norm_access
            + w["walking"] * norm_walk + w["transfer"] * norm_trans, 4
        )
        scored.append({
            **opt,
            "compositeScore": composite,
            "metrics": {
                "normTime": norm_time, "normCost": norm_cost, "normEmissions": norm_em,
                "normSafety": norm_safety, "normAccess": norm_access,
                "normWalk": norm_walk, "normTrans": norm_trans,
            },
        })

    fastest_id = min(scored, key=lambda o: o["travelTime"])["id"]
    cheapest_id = min(scored, key=lambda o: o["tripCost"])["id"]
    greenest_id = min(scored, key=lambda o: o["co2Emissions"])["id"]
    best_value_id = min(scored, key=lambda o: o["compositeScore"])["id"]

    for opt in scored:
        label, label_type = "STANDARD", "standard"
        if opt["id"] == best_value_id:
            label, label_type = "BALANCED MATCH", "optimal"
        elif opt["id"] == fastest_id:
            label, label_type = "FASTEST", "fastest"
        elif opt["id"] == cheapest_id:
            label, label_type = "CHEAPEST", "cheapest"
        elif opt["id"] == greenest_id:
            label, label_type = "GREENEST", "greenest"
        opt["label"] = label
        opt["labelType"] = label_type

    scored.sort(key=lambda o: o["compositeScore"])
    return scored
