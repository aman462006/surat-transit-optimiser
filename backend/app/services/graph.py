"""
BRTS transit graph traversal & multimodal routing (port of graphUtils.js).

Builds an adjacency-list graph of BRTS stations, solves optimal transit paths
with an adjacency BFS (<=2 transfers), and stitches walking legs to user GPS
coordinates to form a complete multimodal itinerary.
"""
from collections import deque

from app.data.transit_data import BRTS_STATIONS, BRTS_ROUTES
from app.services.fare import calculate_transit_fare
from app.services.geo import calculate_haversine, find_nearest_station, WALKING_SPEED_KMH

# High-fidelity operational BRTS travel-time modeling constants.
CRUISE_SPEED_KMH = 42
DWELL_TIME_MINS = 0.50       # 30s passenger boarding/alighting per stop
ACCEL_DECEL_MINS = 0.25      # 15s braking + accelerating penalty per stop


def _edge_duration(dist_km: float) -> float:
    cruise_time_mins = (dist_km / CRUISE_SPEED_KMH) * 60
    return round(cruise_time_mins + DWELL_TIME_MINS + ACCEL_DECEL_MINS, 2)


def build_transit_graph() -> dict:
    """Adjacency list { stationId: [ {edge}, ... ] } from ordered route station sequences."""
    graph = {station_id: [] for station_id in BRTS_STATIONS}

    for route in BRTS_ROUTES.values():
        stations = route["stations"]

        # Forward direction edges
        for i in range(len(stations) - 1):
            current_id = stations[i]
            next_id = stations[i + 1]
            dist = calculate_haversine(
                BRTS_STATIONS[current_id]["lat"], BRTS_STATIONS[current_id]["lng"],
                BRTS_STATIONS[next_id]["lat"], BRTS_STATIONS[next_id]["lng"],
            )
            graph[current_id].append({
                "routeId": route["id"],
                "routeNumber": route.get("routeNumber") or route.get("shortName"),
                "color": route["color"],
                "nextStationId": next_id,
                "distanceKm": dist,
                "durationMins": _edge_duration(dist),
                "direction": "forward",
            })

        # Reverse direction edges (bidirectional routes)
        if route.get("bidirectional"):
            for i in range(len(stations) - 1, 0, -1):
                current_id = stations[i]
                next_id = stations[i - 1]
                dist = calculate_haversine(
                    BRTS_STATIONS[current_id]["lat"], BRTS_STATIONS[current_id]["lng"],
                    BRTS_STATIONS[next_id]["lat"], BRTS_STATIONS[next_id]["lng"],
                )
                graph[current_id].append({
                    "routeId": route["id"],
                    "routeNumber": route.get("routeNumber") or route.get("shortName"),
                    "color": route["color"],
                    "nextStationId": next_id,
                    "distanceKm": dist,
                    "durationMins": _edge_duration(dist),
                    "direction": "backward",
                })

    return graph


def _clean_name(name: str) -> str:
    for suffix in (" BRTS Station", " BRTS Hub", " BRTS Terminal", " Terminal", " Hub", " BRTS"):
        name = name.replace(suffix, "")
    return name


def generate_route_instructions(itinerary: list) -> list:
    """Compile concise human-readable step-by-step directions from itinerary legs."""
    if not itinerary:
        return []
    instructions = []
    for idx, leg in enumerate(itinerary):
        if leg["type"] == "walk":
            if idx == 0:
                instructions.append(f"Walk to {_clean_name(leg['to'])} BRTS Station")
            else:
                instructions.append("Walk to Destination")
        elif leg["type"] == "ride":
            instructions.append(f"Take {leg['routeNumber']} toward {_clean_name(leg['to'])}")
            instructions.append(f"Exit at {_clean_name(leg['to'])}")
        elif leg["type"] == "transfer":
            # description format: "Switch from X to Y at Z"
            transfer_to = leg["description"].split("to ")[1].split(" at")[0]
            instructions.append(f"Transfer to {transfer_to}")
    return instructions


def find_optimal_transit_route(start_id: str, end_id: str, transfer_avoidance_weight: float = 0.1):
    """Adjacency BFS pathfinder across explicit station corridors (<=2 transfers)."""
    graph = build_transit_graph()
    candidates = []

    queue = deque([{
        "currId": start_id,
        "edgesTraversed": [],
        "visitedStops": {start_id},
        "currentRouteId": None,
        "transfers": 0,
    }])

    while queue:
        node = queue.popleft()
        curr_id = node["currId"]

        if curr_id == end_id:
            candidates.append(node["edgesTraversed"])
            continue

        for edge in graph.get(curr_id, []):
            if edge["nextStationId"] in node["visitedStops"]:
                continue

            is_transfer = node["currentRouteId"] is not None and node["currentRouteId"] != edge["routeId"]
            new_transfers = node["transfers"] + (1 if is_transfer else 0)
            if new_transfers > 2:  # cap at 2 transfers (3 ride segments)
                continue

            new_visited = set(node["visitedStops"])
            new_visited.add(edge["nextStationId"])

            queue.append({
                "currId": edge["nextStationId"],
                "edgesTraversed": node["edgesTraversed"] + [edge],
                "visitedStops": new_visited,
                "currentRouteId": edge["routeId"],
                "transfers": new_transfers,
            })

    if not candidates:
        return None

    processed_routes = []
    for edges in candidates:
        legs = []
        current_leg = None
        total_distance = 0.0

        for index, edge in enumerate(edges):
            from_station_id = start_id if index == 0 else edges[index - 1]["nextStationId"]
            to_station_id = edge["nextStationId"]
            total_distance += edge["distanceKm"]

            if current_leg and current_leg["routeId"] == edge["routeId"]:
                # Continue same bus line: accumulate metrics and trace stops
                current_leg["distanceKm"] += edge["distanceKm"]
                current_leg["durationMins"] += edge["durationMins"]
                current_leg["stopsCount"] += 1
                current_leg["stations"].append({
                    "id": to_station_id, "name": BRTS_STATIONS[to_station_id]["name"],
                    "lat": BRTS_STATIONS[to_station_id]["lat"], "lng": BRTS_STATIONS[to_station_id]["lng"],
                })
                current_leg["to"] = BRTS_STATIONS[to_station_id]["name"]
                current_leg["toId"] = to_station_id
            else:
                # Route mismatch -> new segment; insert transfer node if transitioning
                if current_leg:
                    next_route = BRTS_ROUTES[edge["routeId"]]
                    transfer_wait = round(next_route["headway"] / 2)
                    transfer_walk = 3  # 3 mins platform walk
                    legs.append(current_leg)
                    legs.append({
                        "type": "transfer",
                        "stationName": current_leg["to"],
                        "durationMins": transfer_wait + transfer_walk,
                        "description": f"Switch from {current_leg['routeNumber']} to {edge['routeNumber']} at {current_leg['to']}",
                    })

                route = BRTS_ROUTES[edge["routeId"]]
                initial_wait = round(route["headway"] / 2)  # avg headway boarding wait

                current_leg = {
                    "type": "ride",
                    "routeId": edge["routeId"],
                    "routeName": route["shortName"],
                    "routeNumber": edge["routeNumber"],
                    "color": edge["color"],
                    "from": BRTS_STATIONS[from_station_id]["name"],
                    "to": BRTS_STATIONS[to_station_id]["name"],
                    "fromId": from_station_id,
                    "toId": to_station_id,
                    "distanceKm": edge["distanceKm"],
                    "durationMins": edge["durationMins"] + (initial_wait if len(legs) == 0 else 0),
                    "stopsCount": 1,
                    "stations": [
                        {"id": from_station_id, "name": BRTS_STATIONS[from_station_id]["name"],
                         "lat": BRTS_STATIONS[from_station_id]["lat"], "lng": BRTS_STATIONS[from_station_id]["lng"]},
                        {"id": to_station_id, "name": BRTS_STATIONS[to_station_id]["name"],
                         "lat": BRTS_STATIONS[to_station_id]["lat"], "lng": BRTS_STATIONS[to_station_id]["lng"]},
                    ],
                }

        if current_leg:
            legs.append(current_leg)

        total_duration = 0
        total_stops = 0
        for leg in legs:
            total_duration += round(leg["durationMins"])
            if leg["type"] == "ride":
                total_stops += leg["stopsCount"]

        transfers_count = len([l for l in legs if l["type"] == "transfer"])
        penalty_per_transfer = transfer_avoidance_weight * 24
        composite_time_score = total_duration + transfers_count * penalty_per_transfer

        ride_legs = [l for l in legs if l["type"] == "ride"]
        route_num_seq = [l["routeNumber"] for l in ride_legs]

        processed_routes.append({
            "routeId": "->".join(l["routeId"] for l in ride_legs),
            "routeName": " ➔ ".join(route_num_seq),
            "longName": (f"Direct via {route_num_seq[0]}" if transfers_count == 0
                         else "Transfer via " + ", ".join(l["stationName"] for l in legs if l["type"] == "transfer")),
            "color": ride_legs[0]["color"],
            "distanceKm": round(total_distance, 3),
            "durationMins": total_duration,
            "stopsCount": total_stops,
            "isDirect": transfers_count == 0,
            "transfersCount": transfers_count,
            "compositeTimeScore": composite_time_score,
            "legs": legs,
        })

    processed_routes.sort(key=lambda r: r["compositeTimeScore"])
    return processed_routes[0]


def find_multimodal_route(source: dict, destination: dict, profile_id: str = "standard",
                          transfer_avoidance_weight: float = 0.1):
    """Connect user GPS coords to the BRTS grid via walking edges and solve the full itinerary."""
    if not source or not destination:
        return None

    nearest_start = find_nearest_station(source["lat"], source["lng"])
    nearest_end = find_nearest_station(destination["lat"], destination["lng"])

    start_station = nearest_start["station"]
    end_station = nearest_end["station"]

    walk1_dist = nearest_start["distanceKm"]
    walk2_dist = nearest_end["distanceKm"]
    walk1_mins = round((walk1_dist / WALKING_SPEED_KMH) * 60)
    walk2_mins = round((walk2_dist / WALKING_SPEED_KMH) * 60)

    # Fallback: both endpoints snap to the same station -> direct walk
    if start_station["id"] == end_station["id"]:
        direct_dist = calculate_haversine(source["lat"], source["lng"], destination["lat"], destination["lng"])
        direct_mins = round((direct_dist / WALKING_SPEED_KMH) * 60)
        itinerary = [{
            "type": "walk", "from": "Your Location", "to": "Destination",
            "distanceKm": direct_dist, "durationMins": direct_mins,
            "description": "Walk directly to destination",
        }]
        return {
            "routeName": "Direct Walk",
            "totalTimeMins": direct_mins,
            "totalDistanceKm": direct_dist,
            "transitDistanceKm": 0,
            "walkingDistanceKm": direct_dist,
            "walkingTimeMins": direct_mins,
            "transitTimeMins": 0,
            "transfersCount": 0,
            "stopsCount": 0,
            "startStationName": start_station["name"],
            "endStationName": end_station["name"],
            "fareDetails": calculate_transit_fare(0, 0, profile_id),
            "itinerary": itinerary,
            "transitInstructions": generate_route_instructions(itinerary),
        }

    transit_path = find_optimal_transit_route(start_station["id"], end_station["id"], transfer_avoidance_weight)

    # Fallback virtual corridor if grid traversal finds no connected path
    if not transit_path:
        crowd_dist = calculate_haversine(start_station["lat"], start_station["lng"],
                                         end_station["lat"], end_station["lng"])
        estimated_stops = max(1, round(crowd_dist / 1.5))
        cruise_time = (crowd_dist / 42) * 60
        dwell_time = estimated_stops * 0.75
        initial_wait = 4.0
        mock_mins = round(cruise_time + dwell_time + initial_wait)

        mock_transit_leg = {
            "type": "ride", "routeId": "virtual-connector", "routeName": "BRTS", "routeNumber": "BRTS",
            "color": "#6366f1", "from": start_station["name"], "to": end_station["name"],
            "fromId": start_station["id"], "toId": end_station["id"],
            "distanceKm": crowd_dist, "durationMins": mock_mins, "stopsCount": estimated_stops,
            "stations": [
                {"id": start_station["id"], "name": start_station["name"], "lat": start_station["lat"], "lng": start_station["lng"]},
                {"id": end_station["id"], "name": end_station["name"], "lat": end_station["lat"], "lng": end_station["lng"]},
            ],
        }
        itinerary = [
            {"type": "walk", "from": "Your Location", "to": start_station["name"],
             "distanceKm": walk1_dist, "durationMins": walk1_mins,
             "description": f"Walk from start location to {start_station['name']}"},
            mock_transit_leg,
            {"type": "walk", "from": end_station["name"], "to": "Destination",
             "distanceKm": walk2_dist, "durationMins": walk2_mins,
             "description": f"Exit station {end_station['name']} and walk to final destination"},
        ]
        total_time = walk1_mins + mock_mins + walk2_mins
        total_distance = round(walk1_dist + crowd_dist + walk2_dist, 3)
        transit_fare = calculate_transit_fare(crowd_dist, 0, profile_id, mock_transit_leg["stopsCount"])
        return {
            "routeName": "BRTS Express Fallback",
            "totalTimeMins": total_time,
            "totalDistanceKm": total_distance,
            "transitDistanceKm": crowd_dist,
            "walkingDistanceKm": round(walk1_dist + walk2_dist, 3),
            "walkingTimeMins": walk1_mins + walk2_mins,
            "transitTimeMins": mock_mins,
            "transfersCount": 0,
            "stopsCount": mock_transit_leg["stopsCount"],
            "startStationName": start_station["name"],
            "endStationName": end_station["name"],
            "fareDetails": transit_fare,
            "routeColor": "#6366f1",
            "itinerary": itinerary,
            "transitInstructions": generate_route_instructions(itinerary),
        }

    itinerary = [
        {"type": "walk", "from": "Your Location", "to": start_station["name"],
         "distanceKm": walk1_dist, "durationMins": walk1_mins,
         "description": f"Walk from start location to {start_station['name']}"},
        *transit_path["legs"],
        {"type": "walk", "from": end_station["name"], "to": "Destination",
         "distanceKm": walk2_dist, "durationMins": walk2_mins,
         "description": f"Exit station {end_station['name']} and walk to final destination"},
    ]
    total_time = walk1_mins + transit_path["durationMins"] + walk2_mins
    total_distance = round(walk1_dist + transit_path["distanceKm"] + walk2_dist, 3)
    transit_fare = calculate_transit_fare(transit_path["distanceKm"], transit_path["transfersCount"],
                                          profile_id, transit_path["stopsCount"])
    return {
        "routeName": transit_path["routeName"],
        "totalTimeMins": total_time,
        "totalDistanceKm": total_distance,
        "transitDistanceKm": transit_path["distanceKm"],
        "walkingDistanceKm": round(walk1_dist + walk2_dist, 3),
        "walkingTimeMins": walk1_mins + walk2_mins,
        "transitTimeMins": transit_path["durationMins"],
        "transfersCount": transit_path["transfersCount"],
        "stopsCount": transit_path["stopsCount"],
        "startStationName": start_station["name"],
        "endStationName": end_station["name"],
        "fareDetails": transit_fare,
        "routeColor": transit_path["color"],
        "itinerary": itinerary,
        "transitInstructions": generate_route_instructions(itinerary),
    }
