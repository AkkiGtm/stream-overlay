/**
 * Cloudflare Worker: CricHeroes Live Score & Upcoming Match Proxy (CORS-Free)
 *
 * Deploy for free on Cloudflare Workers:
 *   1. npm i -g wrangler
 *   2. wrangler login
 *   3. wrangler deploy
 *
 * Endpoints:
 *   GET /?matchId=<ID>
 *   GET /<ID>
 *   GET /sc/<ID>   (Full Scorecard)
 *   GET /cm/<ID>   (Commentary / Worm)
 */

const API_MINI = "https://api.cricheroes.in/api/v1/scorecard/get-mini-scorecard/";
const API_UPCOMING = "https://api.cricheroes.in/api/v1/scorecard/get-upcoming-scorecard/";
const API_SCORECARD = "https://api.cricheroes.in/api/v1/scorecard/v2/get-scorecard/";
const API_COMMENTARY = "https://api.cricheroes.in/api/v1/scorecard/get-commentary/";
const API_TEAM_MATCHES = "https://api.cricheroes.in/api/v1/team/get-team-match/";

const UPSTREAM_HEADERS = {
  "api-key": "cr!CkH3r0s",
  "udid": "8df0c0de-0000-4000-8000-cric0heroes00",
  "device-type": "3",
  "User-Agent": (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) " +
    "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15"
  ),
  "Referer": "https://webticker.cricheroes.com/",
  "Origin": "https://webticker.cricheroes.com",
  "Accept": "application/json",
};

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, api-key",
  "Cache-Control": "no-store, no-cache, must-revalidate",
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...CORS_HEADERS,
    },
  });
}

async function fetchJSON(url) {
  const resp = await fetch(url, { headers: UPSTREAM_HEADERS });
  if (!resp.ok) {
    try {
      const errBody = await resp.json();
      return { data: errBody, ok: false, status: resp.status };
    } catch {
      return { data: null, ok: false, status: resp.status };
    }
  }
  const body = await resp.json();
  return { data: body, ok: true, status: 200 };
}

export default {
  async fetch(request) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const pathParts = url.pathname.replace(/^\/+|\/+$/g, "").split("/");
    const kind = pathParts[0] === "sc" || pathParts[0] === "cm" ? pathParts[0] : "";
    
    // Extract match ID from query param (?matchId= or ?id=) or path
    let matchId = url.searchParams.get("matchId") || url.searchParams.get("id");
    if (!matchId) {
      matchId = kind ? pathParts[1] : pathParts[pathParts.length - 1];
    }

    if (matchId) {
      const idMatch = matchId.match(/\b\d{7,10}\b/);
      if (idMatch) matchId = idMatch[0];
    }

    if (!matchId || !/^\d+$/.test(matchId)) {
      return jsonResponse({ status: false, error: "Please pass a valid numeric matchId." }, 400);
    }

    // 1. Full Scorecard route (/sc/<id>)
    if (kind === "sc") {
      const sc = await fetchJSON(API_SCORECARD + matchId);
      return jsonResponse(sc.data || { status: false }, sc.status);
    }

    // 2. Commentary route (/cm/<id>)
    if (kind === "cm") {
      const cm = await fetchJSON(API_COMMENTARY + matchId);
      return jsonResponse(cm.data || { status: false }, cm.status);
    }

    // 3. Mini-Scorecard / Live Route (with automatic upcoming fallback)
    const mini = await fetchJSON(API_MINI + matchId);
    if (mini.ok && mini.data && mini.data.status && mini.data.data) {
      return jsonResponse(mini.data, 200);
    }

    // Upcoming Match Handler
    const upcoming = await fetchJSON(API_UPCOMING + matchId);
    if (upcoming.ok && upcoming.data && upcoming.data.status && upcoming.data.data) {
      const inner = upcoming.data.data;
      const teamAId = inner.team_a_id;
      let matchMeta = {};

      if (teamAId) {
        try {
          const fixtures = await fetchJSON(API_TEAM_MATCHES + teamAId);
          if (fixtures.ok && fixtures.data && Array.isArray(fixtures.data.data)) {
            const found = fixtures.data.data.find(m => String(m.match_id) === String(matchId));
            if (found) matchMeta = found;
          }
        } catch (_) {}
      }

      const squadA = inner.team_a_squad || [];
      const squadB = inner.team_b_squad || [];
      const captainA = (squadA.find(p => p.is_captain || p.isCaptain) || {}).player_name || "";
      const captainB = (squadB.find(p => p.is_captain || p.isCaptain) || {}).player_name || "";
      const capAPhoto = (squadA.find(p => (p.is_captain || p.isCaptain) && p.profile_photo) || {}).profile_photo || "";
      const capBPhoto = (squadB.find(p => (p.is_captain || p.isCaptain) && p.profile_photo) || {}).profile_photo || "";

      const combined = {
        match_id: parseInt(matchId, 10),
        status: "upcoming",
        match_type: matchMeta.match_type || "Limited Overs",
        tournament_name: inner.tournament_name || matchMeta.tournament_name || "",
        ground_name: matchMeta.ground_name || "",
        city_name: matchMeta.city_name || "",
        start_datetime: matchMeta.match_start_time || "",
        match_start_time: matchMeta.match_start_time || "",
        overs: matchMeta.overs || 20,
        ball_type: matchMeta.ball_type || "LEATHER",
        toss_details: matchMeta.toss_details || "",
        is_super_over: 0,
        current_inning: 0,
        team_a: {
          id: teamAId || matchMeta.team_a_id,
          name: inner.team_a_name || matchMeta.team_a || "Team A",
          logo: inner.team_a_logo || matchMeta.team_a_logo || "",
          short_name: "",
          summary: "Yet to bat",
          captain_name: captainA,
          captain_photo: capAPhoto,
          squad: squadA
        },
        team_b: {
          id: inner.team_b_id || matchMeta.team_b_id,
          name: inner.team_b_name || matchMeta.team_b || "Team B",
          logo: inner.team_b_logo || matchMeta.team_b_logo || "",
          short_name: "",
          summary: "Yet to bat",
          captain_name: captainB,
          captain_photo: capBPhoto,
          squad: squadB
        }
      };

      return jsonResponse({ status: true, data: combined }, 200);
    }

    return jsonResponse({ status: false, error: `Match ${matchId} not found` }, 404);
  }
};
