"""Pydantic request/response models for the API."""
from typing import Literal, Optional

from pydantic import BaseModel, Field

DepartureWindow = Literal["now", "morning-rush", "midday-offpeak", "evening-rush", "night-freeflow"]
PassengerProfile = Literal["standard", "digital", "student", "senior", "pass_holder"]


class Coord(BaseModel):
    lat: float = Field(..., ge=-90, le=90)
    lng: float = Field(..., ge=-180, le=180)


class PrivateCarOptions(BaseModel):
    fuelType: Literal["petrol", "diesel", "cng"] = "petrol"
    mileageKmpl: Optional[float] = Field(default=None, gt=0)  # km/L (petrol-diesel) or km/kg (CNG)
    fuelPricePerLitre: Optional[float] = Field(default=None, gt=0)  # Rs/L or Rs/kg (CNG)


class RecommendationsRequest(BaseModel):
    distance: float = Field(..., gt=0, description="OSRM driving distance in km")
    duration: float = Field(..., gt=0, description="Traffic-aware duration in minutes")
    source: Optional[Coord] = None
    destination: Optional[Coord] = None
    profileId: PassengerProfile = "standard"
    privateCar: PrivateCarOptions = Field(default_factory=PrivateCarOptions)


class MultimodalRequest(BaseModel):
    source: Coord
    destination: Coord
    profileId: PassengerProfile = "standard"
    transferAvoidanceWeight: float = Field(default=0.1, ge=0, le=1)


class TrafficRequest(BaseModel):
    source: Coord
    destination: Coord
    departureTime: DepartureWindow = "now"
    baseDurationMins: float = Field(..., gt=0, description="Base OSRM duration in minutes")
    distanceKm: Optional[float] = Field(default=None, gt=0, description="OSRM driving distance in km")


class FareRequest(BaseModel):
    distanceKm: float = Field(..., ge=0)
    transferCount: int = Field(default=0, ge=0)
    profileId: PassengerProfile = "standard"
    stopsCount: int = Field(default=0, ge=0)
