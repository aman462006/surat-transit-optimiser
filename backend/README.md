# Smart Transport Optimizer — Python Backend

A **FastAPI** backend that ports the "brains" of the React app (the engines in
`../src/utils`) to Python and exposes them as a JSON HTTP API. The existing
Vite/React frontend is untouched and can call this API instead of running the
logic in the browser.

## What's ported

| React (`src/utils`)         | Python (`app/services`)        | Endpoint(s)                          |
| --------------------------- | ------------------------------ | ------------------------------------ |
| `transitDataService.js`     | `data/transit_data.py`         | `GET /api/stations`, `GET /api/routes` |
| `graphUtils.js`             | `services/geo.py`, `graph.py`  | `GET /api/nearest-station`, `POST /api/multimodal-route` |
| `fareEngine.js`             | `services/fare.py`             | `GET /api/profiles`, `POST /api/fare` |
| `googleMapsService.js`      | `services/traffic.py`          | `POST /api/traffic`                  |
| `recommendationEngine.js`   | `services/recommendations.py`  | `POST /api/recommendations`          |

`geocodingService.js` and OSRM routing stay in the frontend — they call public
APIs that are simplest to hit directly from the browser. The backend takes the
resulting `distance`/`duration` as input.

## Run it

> Requires Python 3.11+. On Windows the launcher is `py`; elsewhere use `python3`.

```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1        # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

- Interactive docs (Swagger UI): http://localhost:8000/docs
- Health check: http://localhost:8000/api/health

## Example requests

Rank the modes for a 7 km / 18 min trip:

```bash
curl -X POST http://localhost:8000/api/recommendations \
  -H "Content-Type: application/json" \
  -d '{
    "distance": 7.0,
    "duration": 18,
    "source": {"lat": 21.1702, "lng": 72.7758},
    "destination": {"lat": 21.2045, "lng": 72.8407},
    "profileId": "student",
    "privateCar": {"fuelType": "petrol"}
  }'
```

Traffic-aware ETA via the Surat congestion model (no Google key needed):

```bash
curl -X POST http://localhost:8000/api/traffic \
  -H "Content-Type: application/json" \
  -d '{
    "source": {"lat": 21.16, "lng": 72.78},
    "destination": {"lat": 21.22, "lng": 72.84},
    "departureTime": "evening-rush",
    "baseDurationMins": 18
  }'
```

## Calling it from React (optional)

The frontend currently runs `generateRecommendations` in-browser. To use the
backend instead, replace that call with a fetch:

```js
const res = await fetch('http://localhost:8000/api/recommendations', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ distance: roadDistance, duration: googleDuration, source, destination, profileId: passengerProfile, privateCar: privateCarAssumptions }),
});
const recommendations = await res.json();
```

CORS is already configured for the Vite dev server (`localhost:5173`) and the
preview server (`localhost:4173`).
