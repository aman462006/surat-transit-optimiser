"""Geospatial helpers (port of the geo parts of graphUtils.js)."""
import math

from app.data.transit_data import BRTS_STATIONS

# Average urban walking speed (km/h) used for snapped walking legs.
WALKING_SPEED_KMH = 4.5


def calculate_haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance in km between two GPS coordinates, rounded to 3 dp."""
    R = 6371  # Earth's radius in km
    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)
    a = (
        math.sin(d_lat / 2) ** 2
        + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(d_lon / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return round(R * c, 3)


def find_nearest_station(lat: float, lng: float) -> dict:
    """Locate the nearest BRTS station to a coordinate. Returns { station, distanceKm }."""
    nearest_station = None
    min_distance = math.inf

    for station in BRTS_STATIONS.values():
        dist = calculate_haversine(lat, lng, station["lat"], station["lng"])
        if dist < min_distance:
            min_distance = dist
            nearest_station = station

    return {"station": nearest_station, "distanceKm": round(min_distance, 3)}
