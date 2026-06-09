"""
Smart Transport Optimizer — FastAPI backend.

Exposes the Surat BRTS routing, fare, traffic and recommendation engines
(ported from the React app's src/utils) as a JSON HTTP API that the existing
Vite/React frontend can call.

Run:  uvicorn app.main:app --reload --port 8000
Docs: http://localhost:8000/docs
"""
import os

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Load backend/.env (TOMTOM_API_KEY, FRONTEND_ORIGINS, …) before reading env.
load_dotenv()

from app.data.transit_data import get_all_routes, get_all_stations
from app.schemas import (
    FareRequest,
    MultimodalRequest,
    RecommendationsRequest,
    TrafficRequest,
)
from app.services.fare import calculate_transit_fare, get_passenger_profiles
from app.services.geo import find_nearest_station
from app.services.graph import find_multimodal_route
from app.services.recommendations import generate_recommendations
from app.services.traffic import fetch_traffic

app = FastAPI(
    title="Smart Transport Optimizer API",
    description="Surat BRTS multimodal routing, fares, traffic model and mode recommendations.",
    version="1.0.0",
)

# Allowed browser origins: local dev by default, plus any set in FRONTEND_ORIGINS
# (comma-separated, e.g. your Vercel URL). The regex also permits Vercel preview
# deployments (*.vercel.app) without listing each one.
_default_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:4173",
    "http://127.0.0.1:4173",
]
_env_origins = [
    o.strip() for o in os.environ.get("FRONTEND_ORIGINS", "").split(",") if o.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_default_origins + _env_origins,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health", tags=["meta"])
def health():
    stations = get_all_stations()
    routes = get_all_routes()
    return {"status": "ok", "stations": len(stations), "routes": len(routes)}


@app.get("/api/stations", tags=["network"])
def stations():
    """All BRTS stations in the network."""
    return get_all_stations()


@app.get("/api/routes", tags=["network"])
def routes():
    """All BRTS routes with their ordered station sequences."""
    return get_all_routes()


@app.get("/api/profiles", tags=["network"])
def profiles():
    """Available passenger fare profiles and discount rates."""
    return get_passenger_profiles()


@app.get("/api/nearest-station", tags=["network"])
def nearest_station(lat: float, lng: float):
    """Snap a coordinate to the nearest BRTS station."""
    return find_nearest_station(lat, lng)


@app.post("/api/fare", tags=["engine"])
def fare(req: FareRequest):
    """Compute a BRTS fare for a given transit distance and passenger profile."""
    return calculate_transit_fare(req.distanceKm, req.transferCount, req.profileId, req.stopsCount)


@app.post("/api/multimodal-route", tags=["engine"])
def multimodal_route(req: MultimodalRequest):
    """Solve the full walk + BRTS + walk itinerary between two coordinates."""
    return find_multimodal_route(
        req.source.model_dump(),
        req.destination.model_dump(),
        req.profileId,
        req.transferAvoidanceWeight,
    )


@app.post("/api/traffic", tags=["engine"])
def traffic(req: TrafficRequest):
    """Traffic-aware duration via TomTom (server-side key) or the Surat congestion model."""
    return fetch_traffic(
        req.source.model_dump(),
        req.destination.model_dump(),
        req.departureTime,
        req.baseDurationMins,
        req.distanceKm,
    )


@app.post("/api/recommendations", tags=["engine"])
def recommendations(req: RecommendationsRequest):
    """Rank BRTS, Auto Rickshaw Pooling and Private Car on time, cost and CO2 for one route."""
    return generate_recommendations(
        req.distance,
        req.duration,
        req.source.model_dump() if req.source else None,
        req.destination.model_dump() if req.destination else None,
        req.profileId,
        req.privateCar.model_dump(),
    )
