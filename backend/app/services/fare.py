"""
Surat SMC Sitilink BRTS Fare Engine (port of fareEngine.js).

Deterministic progressive distance-slab fares calibrated to SMC Sitilink,
capped at Rs.25, with passenger-profile discounts and free integrated transfers.
"""
import math

# Progressive distance-stage slabs (km -> fare in Rupees). math.inf = max-fare cap.
SITILINK_FARE_SLABS = [
    {"maxKm": 3, "fare": 5.0},
    {"maxKm": 6, "fare": 10.0},
    {"maxKm": 10, "fare": 15.0},
    {"maxKm": 15, "fare": 20.0},
    {"maxKm": math.inf, "fare": 25.0},
]

FARE_CONFIG = {
    "transferMode": "integrated",  # free platform-level transfers inside the pay-zone
    "PASSENGER_PROFILES": {
        "standard": {"id": "standard", "name": "Standard Fare", "discountRate": 0.0,
                     "description": "Standard single-journey electronic ticket"},
        "digital": {"id": "digital", "name": "Digital Ticket (20% Off)", "discountRate": 0.20,
                    "description": "Official Sitilink App mobile ticket discount"},
        "student": {"id": "student", "name": "Student Discount (50% Off)", "discountRate": 0.50,
                    "description": "Verified student pass issued by Surat Municipal Corporation"},
        "senior": {"id": "senior", "name": "Senior Citizen (30% Off)", "discountRate": 0.30,
                   "description": "Supportive fare structure for citizens aged 60+"},
        "pass_holder": {"id": "pass_holder", "name": "Daily/Monthly Pass Holder", "discountRate": 1.00,
                        "description": "Unlimited transit pass. Displays as Rs.0 per trip."},
    },
}


def lookup_slab_fare(distance_km: float) -> float:
    """Progressive distance-slab lookup matching SMC Sitilink pricing bands."""
    if distance_km <= 0:
        return 0.0
    for slab in SITILINK_FARE_SLABS:
        if distance_km <= slab["maxKm"]:
            return slab["fare"]
    return 25.0  # max fare cap


def calculate_transit_fare(distance_km: float, transfer_count: int = 0,
                           profile_id: str = "standard", stops_count: int = 0) -> dict:
    """Compute the public transport fare from transit distance and passenger profile."""
    distance = max(0.0, distance_km)
    profiles = FARE_CONFIG["PASSENGER_PROFILES"]
    profile = profiles.get(profile_id, profiles["standard"])

    raw_total = lookup_slab_fare(distance)
    discount_amount = raw_total * profile["discountRate"]
    final_total = max(0, round(raw_total - discount_amount))

    return {
        "baseFare": raw_total,
        "distanceFare": 0.0,
        "stopsFare": 0.0,
        "transferFare": 0.0,
        "discount": round(discount_amount, 2),
        "rawFare": round(raw_total, 2),
        "finalFare": final_total,
        "profileName": profile["name"],
        "description": profile["description"],
    }


def get_passenger_profiles():
    return list(FARE_CONFIG["PASSENGER_PROFILES"].values())
