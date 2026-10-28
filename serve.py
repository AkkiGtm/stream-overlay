#!/usr/bin/env python3
"""
Local development server & CricHeroes CORS-free proxy for Cricket Live Stream Overlay.
Pure Python 3 standard library (no pip packages required).

Usage:
    python3 serve.py
Then open:
    http://localhost:8080/controller.html
"""

import http.server
import socketserver
import urllib.request
import urllib.error
import urllib.parse
import json
import uuid
import sys
import os
import re
import time

PORT = int(os.environ.get("PORT", 8080))
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

# CricHeroes WebTicker API Endpoints
API_MINI = "https://api.cricheroes.in/api/v1/scorecard/get-mini-scorecard/"
API_UPCOMING = "https://api.cricheroes.in/api/v1/scorecard/get-upcoming-scorecard/"
API_SCORECARD = "https://api.cricheroes.in/api/v1/scorecard/v2/get-scorecard/"
API_COMMENTARY = "https://api.cricheroes.in/api/v1/scorecard/get-commentary/"
API_TEAM_MATCHES = "https://api.cricheroes.in/api/v1/team/get-team-match/"

# Official WebTicker Headers that bypass Cloudflare & authenticate requests
UPSTREAM_HEADERS = {
    "api-key": "cr!CkH3r0s",
    "udid": str(uuid.uuid4()),
    "device-type": "3",
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15"
    ),
    "Referer": "https://webticker.cricheroes.com/",
    "Origin": "https://webticker.cricheroes.com",
    "Accept": "application/json",
}

def fetch_upstream_json(url, timeout=7):
    """Fetch JSON from CricHeroes upstream API with official headers."""
    req = urllib.request.Request(url, headers=UPSTREAM_HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read()
            return json.loads(raw.decode('utf-8', errors='replace')), resp.status
    except urllib.error.HTTPError as e:
        try:
            return json.loads(e.read().decode('utf-8', errors='replace')), e.code
        except Exception:
            return {"status": False, "error": f"HTTP {e.code}"}, e.code
    except Exception as e:
        return {"status": False, "error": str(e)}, 502

def fetch_unified_match_data(match_id):
    """
    Fetch comprehensive match data using matchId only:
    1. Tries get-mini-scorecard (Live & Completed matches)
    2. If not started yet, tries get-upcoming-scorecard + team fixture metadata
    3. Falls back to v2/get-scorecard
    """
    # 1. Live or Completed Match (Mini-Scorecard)
    mini_data, mini_code = fetch_upstream_json(API_MINI + match_id)
    if mini_data.get("status") and mini_data.get("data"):
        return mini_data, 200

    # 2. Upcoming Match (Not yet started)
    print(f"[Proxy] Mini-scorecard not active for {match_id}. Fetching upcoming match details...")
    up_data, up_code = fetch_upstream_json(API_UPCOMING + match_id)
    if up_data.get("status") and up_data.get("data"):
        inner = up_data["data"]
        team_a_id = inner.get("team_a_id")
        match_meta = {}

        # Fetch match schedule & venue metadata from team fixture list
        if team_a_id:
            try:
                team_fixtures, _ = fetch_upstream_json(f"{API_TEAM_MATCHES}{team_a_id}")
                for fixture in team_fixtures.get("data", []):
                    if str(fixture.get("match_id")) == str(match_id):
                        match_meta = fixture
                        print(f"[Proxy] Found fixture schedule for match {match_id}: {match_meta.get('ground_name', '')}")
                        break
            except Exception as meta_err:
                print(f"[Proxy Notice] Fixture schedule fetch notice: {meta_err}")

        # Extract captains
        squad_a = inner.get("team_a_squad", [])
        squad_b = inner.get("team_b_squad", [])
        captain_a = next((p.get("player_name") for p in squad_a if p.get("is_captain") or p.get("isCaptain")), "")
        captain_b = next((p.get("player_name") for p in squad_b if p.get("is_captain") or p.get("isCaptain")), "")
        cap_a_photo = next((p.get("profile_photo") for p in squad_a if (p.get("is_captain") or p.get("isCaptain")) and p.get("profile_photo")), "")
        cap_b_photo = next((p.get("profile_photo") for p in squad_b if (p.get("is_captain") or p.get("isCaptain")) and p.get("profile_photo")), "")

        # Synthesize unified response compatible with overlay.js adaptCricHeroesData
        combined = {
            "match_id": int(match_id),
            "status": "upcoming",
            "match_type": match_meta.get("match_type", "Limited Overs"),
            "tournament_name": inner.get("tournament_name") or match_meta.get("tournament_name", ""),
            "ground_name": match_meta.get("ground_name", ""),
            "city_name": match_meta.get("city_name", ""),
            "start_datetime": match_meta.get("match_start_time", ""),
            "match_start_time": match_meta.get("match_start_time", ""),
            "overs": match_meta.get("overs", 20),
            "ball_type": match_meta.get("ball_type", "LEATHER"),
            "toss_details": match_meta.get("toss_details", ""),
            "is_super_over": 0,
            "current_inning": 0,
            "team_a": {
                "id": team_a_id or match_meta.get("team_a_id"),
                "name": inner.get("team_a_name") or match_meta.get("team_a", "Team A"),
                "logo": inner.get("team_a_logo") or match_meta.get("team_a_logo", ""),
                "short_name": "",
                "summary": "Yet to bat",
                "captain_name": captain_a,
                "captain_photo": cap_a_photo,
                "squad": squad_a
            },
            "team_b": {
                "id": inner.get("team_b_id") or match_meta.get("team_b_id"),
                "name": inner.get("team_b_name") or match_meta.get("team_b", "Team B"),
                "logo": inner.get("team_b_logo") or match_meta.get("team_b_logo", ""),
                "short_name": "",
                "summary": "Yet to bat",
                "captain_name": captain_b,
                "captain_photo": cap_b_photo,
                "squad": squad_b
            }
        }
        return {"status": True, "data": combined}, 200

    # 3. Full scorecard fallback
    sc_data, sc_code = fetch_upstream_json(API_SCORECARD + match_id)
    if sc_data.get("status") and sc_data.get("data"):
        return sc_data, 200

    return {
        "status": False,
        "error": f"Match {match_id} could not be resolved from CricHeroes."
    }, 404


class CricketHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def send_cors_json(self, code, obj):
        data = json.dumps(obj).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate")
        self.end_headers()
        self.wfile.write(data)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, api-key")
        self.end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)

        if parsed.path == "/favicon.ico":
            self.send_response(204)
            self.end_headers()
            return

        # 1. REST API endpoint: /api/<id>, /api/sc/<id>, /api/cm/<id>
        if parsed.path.startswith("/api/"):
            rest = parsed.path[len("/api/"):].split("?")[0].strip("/")
            if rest.startswith("sc/"):
                mid = rest[len("sc/"):]
                data, code = fetch_upstream_json(API_SCORECARD + mid)
                return self.send_cors_json(code, data)
            elif rest.startswith("cm/"):
                mid = rest[len("cm/"):]
                data, code = fetch_upstream_json(API_COMMENTARY + mid)
                return self.send_cors_json(code, data)
            else:
                mid = rest
                if not mid.isdigit():
                    return self.send_cors_json(400, {"status": False, "error": "Invalid match ID"})
                data, code = fetch_unified_match_data(mid)
                return self.send_cors_json(code, data)

        # 2. Query parameter proxy endpoint: /proxy?matchId=XXXX or /proxy?url=XXXX
        if parsed.path == "/proxy":
            query = urllib.parse.parse_qs(parsed.query)
            raw_match_id = query.get("matchId", [None])[0]
            custom_url = query.get("url", [None])[0]

            # Extract numeric match ID from either parameter or pasted URL
            target_id = None
            for candidate in [raw_match_id, custom_url]:
                if candidate:
                    if candidate.lower() in ("demo", "test", "mock"):
                        target_id = "demo"
                        break
                    m = re.search(r"\b(\d{7,10})\b", candidate)
                    if m:
                        target_id = m.group(1)
                        break

            if not target_id:
                return self.send_cors_json(400, {
                    "status": False,
                    "error": "matchId required (e.g. 27909503 or 27924686)"
                })

            # Built-in live demo simulation for offline testing
            if target_id == "demo":
                sec = int(time.time())
                ball_step = (sec // 3) % 12
                demo_data = {
                    "status": "live",
                    "batting_team_short_name": "IND",
                    "total_runs": 142 + ball_step * 2,
                    "total_wickets": 3 + (1 if ball_step > 8 else 0),
                    "overs": f"16.{ball_step % 6}",
                    "crr": "8.75",
                    "striker": {
                        "name": "V. Kohli*",
                        "runs": 58 + ball_step,
                        "balls": 38 + ball_step,
                        "fours": 6,
                        "sixes": 2
                    },
                    "non_striker": {
                        "name": "H. Pandya",
                        "runs": 32,
                        "balls": 18,
                        "fours": 2,
                        "sixes": 2
                    },
                    "bowler": {
                        "name": "M. Starc",
                        "overs": "3.4",
                        "maidens": 0,
                        "runs": 38,
                        "wickets": 2,
                        "economy": "10.36"
                    },
                    "this_over": ["1", "4", "•", "6", "2"][:(ball_step % 6) + 1]
                }
                return self.send_cors_json(200, {"status": True, "data": demo_data})

            # Fetch unified match data from CricHeroes
            data, code = fetch_unified_match_data(target_id)
            return self.send_cors_json(code, data)

        # Fall through to static file serving
        return super().do_GET()


def main():
    print("=" * 60)
    print(f" Cricket Live Stream Studio Server")
    print(f" Local URL:       http://localhost:{PORT}")
    print(f" Controller URL:  http://localhost:{PORT}/controller.html")
    print(f" Live Overlay:    http://localhost:{PORT}/index.html")
    print(f" Mini-scorecard:  http://localhost:{PORT}/api/<match_id>")
    print("=" * 60)

    # Allow fast address reuse on restarts
    socketserver.TCPServer.allow_reuse_address = True
    with http.server.ThreadingHTTPServer(("0.0.0.0", PORT), CricketHandler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down server...")

if __name__ == "__main__":
    main()
