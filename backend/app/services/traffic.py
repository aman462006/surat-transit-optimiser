"""
Traffic-aware travel duration for Surat.

Resolution order (server-side, no key ever sent to the browser):
  1. TomTom Routing API — real, live/predictive traffic-aware ETA, used when
     TOMTOM_API_KEY is set in the environment (loaded from backend/.env).
  2. Calibrated "Surat Urban Mobility" model — a free offline fallback that
     shapes OSRM's free-flow time with an hour-by-hour congestion curve, a
     speed-aware calibration, and Tapi-bridge queueing. Used when no key is
     configured or the TomTom call fails for any reason.
"""
import os
from datetime import datetime, timedelta

import httpx


def crosses_tapi_river(source: dict, dest: dict) -> bool:
    """True if the trip crosses the Tapi River (lat ~21.200), i.e. North<->South Surat."""
    river_lat = 21.200
    return (source["lat"] > river_lat) != (dest["lat"] > river_lat)


# Per-hour congestion curve for Surat (multiplier on OSRM free-flow time).
# 1.0 = free flow; <1.0 = clearer-than-daytime late-night roads.
HOURLY_CONGESTION = [
    0.90, 0.88, 0.88, 0.88, 0.90, 0.95,   # 00-05
    1.03, 1.18, 1.40, 1.50, 1.34, 1.16,   # 06-11
    1.12, 1.14, 1.10, 1.14, 1.26, 1.46,   # 12-17
    1.60, 1.54, 1.30, 1.12, 1.00, 0.94,   # 18-23
]

# Representative departure hour for each explicit window (used when not 'now').
WINDOW_HOUR = {
    "morning-rush": 9,
    "midday-offpeak": 14,
    "evening-rush": 18,
    "night-freeflow": 1,
    "standard": 11,
}


def simulate_surat_traffic(source: dict, dest: dict, departure_time: str,
                           base_duration_mins: float, distance_km: float = None) -> dict:
    """Calibrated geographic + temporal congestion model (offline fallback)."""
    hour = datetime.now().hour if departure_time == "now" else WINDOW_HOUR.get(departure_time, 11)
    congestion = HOURLY_CONGESTION[hour] if 0 <= hour < 24 else 1.0

    # Speed-aware calibration from OSRM's implied free-flow speed.
    if distance_km and base_duration_mins > 0:
        free_flow_kmh = distance_km / (base_duration_mins / 60)
        if free_flow_kmh < 18:
            congestion = 1 + (congestion - 1) * 0.75   # already slow → dampen extra delay
        elif free_flow_kmh > 35:
            congestion = 1 + (congestion - 1) * 1.15   # open roads → peaks bite harder

    # Tapi River bridge bottleneck, scaled by how congested the hour already is.
    bottleneck_delay = 0
    if crosses_tapi_river(source, dest) and congestion > 1.05:
        bottleneck_delay = round((congestion - 1) * 18)  # ~0 off-peak up to ~11 min at peak

    standard_duration = max(1, round(base_duration_mins))
    traffic_duration = max(2, round(base_duration_mins * congestion + bottleneck_delay))
    delay_mins = max(0, traffic_duration - standard_duration)

    ratio = traffic_duration / standard_duration if standard_duration else 1
    status, color = "🟢 Free Flow", "traffic-light"
    description = "Typical driving conditions with standard road speeds."
    if ratio >= 1.4 or delay_mins >= 10:
        status, color = "🔴 Heavy Congestion", "traffic-heavy"
        description = "Peak commuter congestion. Slow-moving traffic on inner ring roads and arterials."
    elif ratio >= 1.12 or delay_mins >= 3:
        status, color = "🟡 Moderate Traffic", "traffic-moderate"
        description = "Moderate flow with minor delays at major intersections."
    elif congestion < 1:
        description = "Late-night free-flowing speeds. Roads clearer than the daytime baseline."
    if bottleneck_delay >= 3:
        description += f" Includes ~{bottleneck_delay} min Tapi River bridge queue (North<->South Surat)."

    return {
        "isSimulated": True,
        "source": "model",
        "standardDuration": standard_duration,
        "trafficDuration": traffic_duration,
        "delayMins": delay_mins,
        "status": status,
        "color": color,
        "description": description,
    }


def _tomtom_depart_at(departure_time: str):
    """ISO-8601 departAt for explicit windows; None for 'now' (uses live traffic)."""
    if departure_time == "now" or departure_time not in WINDOW_HOUR:
        return None
    now = datetime.now().astimezone()
    hour = WINDOW_HOUR[departure_time]
    target = now.replace(hour=hour, minute=0, second=0, microsecond=0)
    if target < now:
        target = target + timedelta(days=1)
    return target.isoformat()


def fetch_tomtom_traffic(source: dict, dest: dict, departure_time: str,
                         base_duration_mins: float, distance_km: float = None) -> dict:
    """Query the TomTom Routing API for a real traffic-aware ETA."""
    api_key = os.environ.get("TOMTOM_API_KEY", "").strip()
    if not api_key:
        return simulate_surat_traffic(source, dest, departure_time, base_duration_mins, distance_km)

    loc = f"{source['lat']},{source['lng']}:{dest['lat']},{dest['lng']}"
    params = {
        "key": api_key,
        "traffic": "true",
        "travelMode": "car",
        "computeTravelTimeFor": "all",
        "routeType": "fastest",
    }
    depart_at = _tomtom_depart_at(departure_time)
    if depart_at:
        params["departAt"] = depart_at

    url = f"https://api.tomtom.com/routing/1/calculateRoute/{loc}/json"
    try:
        resp = httpx.get(url, params=params, timeout=10.0)
        resp.raise_for_status()
        data = resp.json()
        summary = data["routes"][0]["summary"]

        traffic_secs = summary["travelTimeInSeconds"]
        no_traffic_secs = summary.get("noTrafficTravelTimeInSeconds", traffic_secs)
        delay_secs = summary.get("trafficDelayInSeconds", max(0, traffic_secs - no_traffic_secs))

        traffic_duration = max(1, round(traffic_secs / 60))
        standard_duration = max(1, round(no_traffic_secs / 60))
        delay_mins = max(0, round(delay_secs / 60))
        distance_val = round(summary.get("lengthInMeters", 0) / 1000, 2)

        status, color = "🟢 Free Flow", "traffic-light"
        description = "Live TomTom traffic — roads flowing at normal speeds."
        if delay_mins >= 10:
            status, color = "🔴 Heavy Congestion", "traffic-heavy"
            description = f"Live TomTom traffic — heavy congestion, +{delay_mins} min delay on this route."
        elif delay_mins >= 3:
            status, color = "🟡 Moderate Traffic", "traffic-moderate"
            description = f"Live TomTom traffic — moderate congestion, +{delay_mins} min delay."

        return {
            "isSimulated": False,
            "source": "tomtom",
            "standardDuration": standard_duration,
            "trafficDuration": traffic_duration,
            "delayMins": delay_mins,
            "status": status,
            "color": color,
            "description": description,
            "providerDistance": distance_val,
        }
    except Exception as err:  # noqa: BLE001 — any failure falls back to the offline model
        result = simulate_surat_traffic(source, dest, departure_time, base_duration_mins, distance_km)
        result["fallbackWarning"] = f"TomTom unavailable, using calibrated model (reason: {err})"
        return result


def fetch_traffic(source: dict, dest: dict, departure_time: str,
                  base_duration_mins: float, distance_km: float = None) -> dict:
    """Public entry point: TomTom when a key is configured, else the Surat model."""
    if not source or not dest:
        return None
    return fetch_tomtom_traffic(source, dest, departure_time, base_duration_mins, distance_km)
