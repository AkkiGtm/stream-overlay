/**
 * Cricket Broadcast Live Stream Overlay Engine
 * Supports: Themes, CricHeroes Live Sync, Auto Over Summary,
 * 2nd-Over Scorecard Popups, and Automated Wicket Stinger + Replay Bug.
 */

(function () {
  // --- 1. Parse Configuration & URL Parameters ---
  const urlParams = new URLSearchParams(window.location.search);
  const theme = urlParams.get('theme') || 'ipl'; // 'ipl', 'neon', 'classic'
  const mode = urlParams.get('mode') || 'mock'; // 'mock' or 'live'
  const matchId = urlParams.get('matchId') || '';
  const matchUrl = urlParams.get('matchUrl') || '';
  const proxyUrl = urlParams.get('proxyUrl') || '';
  const customTournament = urlParams.get('tournament') || '';
  const pollInterval = parseInt(urlParams.get('pollInterval') || '3000', 10);

  // Apply theme to body
  document.body.className = `theme-${theme}`;

  // --- 1.5. Dynamic Canvas Auto-Fit Engine (Mobile Prism, Tablets & PC OBS) ---
  function autoFitCanvas() {
    const w = window.innerWidth || document.documentElement.clientWidth || 1920;
    const h = window.innerHeight || document.documentElement.clientHeight || 1080;
    if (w <= 0 || h <= 0) return;
    const scale = Math.min(w / 1920, h / 1080);
    document.documentElement.style.setProperty('--overlay-scale', scale);
  }
  window.addEventListener('resize', autoFitCanvas);
  window.addEventListener('orientationchange', autoFitCanvas);
  autoFitCanvas();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoFitCanvas);
  }

  // --- 2. State Tracking ---
  let isInitialLiveLoad = true;
  let previousState = {
    overs: 0,
    wickets: 0,
    totalRuns: 0,
    lastOverNotified: -1,
    lastScorecardOverNotified: -1,
    thisOverLen: 0,
    lastBall: ""
  };

  // Default Mock Match State (used for immediate testing & fallback)
  let currentState = {
    isUpcoming: false,
    teamA: { name: "MUMBAI WARRIORS", shortName: "MUM" },
    teamB: { name: "DELHI STRIKERS", shortName: "DEL" },
    venue: "",
    startTime: "",
    toss: "",
    tournament: customTournament ? customTournament.toUpperCase() : "LIVE CRICKET",
    matchStatus: "1ST INNINGS • TARGET: 184",
    crr: "8.65",
    rrr: "9.20",
    battingTeam: {
      name: "MUMBAI WARRIORS",
      shortName: "MUM",
      score: 87,
      wickets: 2,
      overs: "9.5"
    },
    bowlingTeam: {
      name: "DELHI STRIKERS",
      shortName: "DEL"
    },
    batsmen: [
      { name: "Rohit S.", runs: 48, balls: 32, fours: 5, sixes: 2, isStriker: true },
      { name: "Surya K.", runs: 24, balls: 14, fours: 3, sixes: 1, isStriker: false }
    ],
    bowler: {
      name: "A. Nortje",
      overs: "2.5",
      maidens: 0,
      runs: 22,
      wickets: 1,
      economy: "7.76"
    },
    thisOver: ["1", "4", "0", "6", "2"],
    // Extended scorecard for 2nd-over popup
    teamScorecard: [
      { name: "Ishan K. (wk)", dismissal: "c Pant b Nortje", runs: 12, balls: 9, fours: 2, sixes: 0 },
      { name: "Rohit S. (c)", dismissal: "not out", runs: 48, balls: 32, fours: 5, sixes: 2, active: true },
      { name: "Tilak V.", dismissal: "b Kuldeep", runs: 3, balls: 5, fours: 0, sixes: 0 },
      { name: "Surya K.", dismissal: "not out", runs: 24, balls: 14, fours: 3, sixes: 1, active: true }
    ],
    partnerships: "52 (31 balls)",
    extras: "Lbw: 0, Wd: 4, Nb: 1"
  };

  // --- 3. DOM Element References ---
  const els = {
    scoreboardContainer: document.getElementById('scoreboard-container'),
    tournament: document.getElementById('subbar-tournament'),
    matchStatus: document.getElementById('subbar-status'),
    crr: document.getElementById('subbar-crr'),
    teamBadge: document.getElementById('team-badge'),
    scoreNum: document.getElementById('score-num'),
    oversNum: document.getElementById('overs-num'),
    strikerRow: document.getElementById('striker-row'),
    nonStrikerRow: document.getElementById('nonstriker-row'),
    bowlerName: document.getElementById('bowler-name'),
    bowlerStats: document.getElementById('bowler-stats'),
    thisOverPills: document.getElementById('this-over-pills'),
    // Upcoming Match Center Card
    upcomingCard: document.getElementById('upcoming-card'),
    upcomingTournament: document.getElementById('upcoming-tournament'),
    upcomingFormat: document.getElementById('upcoming-format'),
    upcomingTeamAName: document.getElementById('upcoming-team-a-name'),
    upcomingTeamALogo: document.getElementById('upcoming-team-a-logo'),
    upcomingTeamAAvatar: document.getElementById('upcoming-team-a-avatar'),
    upcomingTeamACaptain: document.getElementById('upcoming-team-a-captain'),
    upcomingTeamACaptainRow: document.getElementById('upcoming-team-a-captain-row'),
    upcomingTeamBName: document.getElementById('upcoming-team-b-name'),
    upcomingTeamBLogo: document.getElementById('upcoming-team-b-logo'),
    upcomingTeamBAvatar: document.getElementById('upcoming-team-b-avatar'),
    upcomingTeamBCaptain: document.getElementById('upcoming-team-b-captain'),
    upcomingTeamBCaptainRow: document.getElementById('upcoming-team-b-captain-row'),
    upcomingTossBadge: document.getElementById('upcoming-toss-badge'),
    upcomingTime: document.getElementById('upcoming-time'),
    upcomingVenue: document.getElementById('upcoming-venue'),
    upcomingStatusText: document.getElementById('upcoming-status-text'),
    // Over Summary Card
    overSummaryCard: document.getElementById('over-summary-card'),
    overSummaryTitle: document.getElementById('over-summary-title'),
    overSummaryRuns: document.getElementById('over-summary-runs'),
    overSummaryBowler: document.getElementById('over-summary-bowler'),
    // Team Scorecard Modal
    scorecardModal: document.getElementById('team-scorecard-modal'),
    scorecardTableBody: document.getElementById('scorecard-tbody'),
    scorecardTeamScore: document.getElementById('scorecard-team-score'),
    scorecardPartnership: document.getElementById('scorecard-partnership'),
    // Wicket, Boundary and Replay
    wicketStinger: document.getElementById('wicket-stinger'),
    boundaryStinger: document.getElementById('boundary-stinger'),
    boundaryBox: document.getElementById('boundary-box'),
    boundaryTitle: document.getElementById('boundary-title'),
    boundarySubtitle: document.getElementById('boundary-subtitle'),
    replayBug: document.getElementById('replay-bug'),
    wicketDismissalText: document.getElementById('wicket-dismissal-text')
  };

  // --- 4. Render Engine ---
  function renderOverlay(state) {
    if (!state) return;

    // Handle Upcoming / Pre-Match Fixture Center Card View
    if (state.isUpcoming) {
      console.log('%c[Upcoming Match Card Active]%c', 'color:orange;font-weight:bold', '', `${state.teamA?.name} vs ${state.teamB?.name}`);

      // 1. Hide lower-third ticker and activate center preview box
      if (els.scoreboardContainer) els.scoreboardContainer.classList.add('hidden');
      if (els.upcomingCard) els.upcomingCard.classList.add('active');

      // 2. Populate Header
      if (els.upcomingTournament) {
        els.upcomingTournament.innerText = state.tournament || "MATCH PREVIEW";
      }
      if (els.upcomingFormat) {
        els.upcomingFormat.innerText = state.format || "LIMITED OVERS";
      }

      // 3. Populate Team A Details
      if (els.upcomingTeamAName) {
        els.upcomingTeamAName.innerText = state.teamA?.name || "Team A";
      }
      if (els.upcomingTeamALogo && els.upcomingTeamAAvatar) {
        if (state.teamA?.logo) {
          els.upcomingTeamALogo.src = state.teamA.logo;
          els.upcomingTeamALogo.style.display = 'block';
          els.upcomingTeamAAvatar.style.display = 'none';
          els.upcomingTeamALogo.onerror = () => {
            els.upcomingTeamALogo.style.display = 'none';
            els.upcomingTeamAAvatar.style.display = 'flex';
            els.upcomingTeamAAvatar.innerText = (state.teamA?.name || "A")[0];
          };
        } else {
          els.upcomingTeamALogo.style.display = 'none';
          els.upcomingTeamAAvatar.style.display = 'flex';
          els.upcomingTeamAAvatar.innerText = (state.teamA?.name || "A")[0];
        }
      }
      if (els.upcomingTeamACaptain && els.upcomingTeamACaptainRow) {
        if (state.teamA?.captain) {
          els.upcomingTeamACaptain.innerText = state.teamA.captain;
          els.upcomingTeamACaptainRow.style.display = 'inline-flex';
        } else {
          els.upcomingTeamACaptainRow.style.display = 'none';
        }
      }

      // 4. Populate Team B Details
      if (els.upcomingTeamBName) {
        els.upcomingTeamBName.innerText = state.teamB?.name || "Team B";
      }
      if (els.upcomingTeamBLogo && els.upcomingTeamBAvatar) {
        if (state.teamB?.logo) {
          els.upcomingTeamBLogo.src = state.teamB.logo;
          els.upcomingTeamBLogo.style.display = 'block';
          els.upcomingTeamBAvatar.style.display = 'none';
          els.upcomingTeamBLogo.onerror = () => {
            els.upcomingTeamBLogo.style.display = 'none';
            els.upcomingTeamBAvatar.style.display = 'flex';
            els.upcomingTeamBAvatar.innerText = (state.teamB?.name || "B")[0];
          };
        } else {
          els.upcomingTeamBLogo.style.display = 'none';
          els.upcomingTeamBAvatar.style.display = 'flex';
          els.upcomingTeamBAvatar.innerText = (state.teamB?.name || "B")[0];
        }
      }
      if (els.upcomingTeamBCaptain && els.upcomingTeamBCaptainRow) {
        if (state.teamB?.captain) {
          els.upcomingTeamBCaptain.innerText = state.teamB.captain;
          els.upcomingTeamBCaptainRow.style.display = 'inline-flex';
        } else {
          els.upcomingTeamBCaptainRow.style.display = 'none';
        }
      }

      // 5. Populate Center VS & Toss
      if (els.upcomingTossBadge) {
        els.upcomingTossBadge.innerText = state.toss || "TOSS PENDING";
      }

      // 6. Populate Footer Details
      if (els.upcomingTime) {
        els.upcomingTime.innerText = state.startTime || "SCHEDULED SOON";
      }
      if (els.upcomingVenue) {
        els.upcomingVenue.innerText = state.venue || "VENUE TO BE ANNOUNCED";
      }
      if (els.upcomingStatusText) {
        els.upcomingStatusText.innerText = state.matchStatus || "STARTING SOON";
      }
      return;
    }

    // --- Live Match Active: Dismiss Center Card & Display Broadcast Ticker ---
    if (els.upcomingCard) els.upcomingCard.classList.remove('active');
    if (els.scoreboardContainer) els.scoreboardContainer.classList.remove('hidden');

    console.log('%c[Live Overlay Rendered]%c', 'color:lime;font-weight:bold', '', `${state.battingTeam.shortName} ${state.battingTeam.score}/${state.battingTeam.wickets} (${state.battingTeam.overs} ov)`);

    // Header info
    if (els.tournament) els.tournament.innerText = state.tournament || "LIVE CRICKET";
    if (els.matchStatus) els.matchStatus.innerText = state.matchStatus || "";
    if (els.crr) els.crr.innerText = `CRR: ${state.crr || "0.00"}`;

    // Score ticker
    if (els.teamBadge) els.teamBadge.innerText = state.battingTeam.shortName || "BAT";
    if (els.scoreNum) {
      els.scoreNum.innerHTML = `<span class="score-highlight">${state.battingTeam.score}</span>/${state.battingTeam.wickets}`;
    }
    if (els.oversNum) {
      els.oversNum.innerText = `OVERS ${state.battingTeam.overs}`;
    }

    // Batsmen
    if (state.batsmen && state.batsmen.length >= 2) {
      const b1 = state.batsmen[0];
      const b2 = state.batsmen[1];
      if (els.strikerRow) {
        els.strikerRow.innerHTML = `
          <div class="player-name ${b1.isStriker ? 'is-striker' : ''}">${b1.name}</div>
          <div class="player-stats">${b1.runs} <span class="sub">(${b1.balls})</span></div>
        `;
      }
      if (els.nonStrikerRow) {
        els.nonStrikerRow.innerHTML = `
          <div class="player-name ${b2.isStriker ? 'is-striker' : ''}">${b2.name}</div>
          <div class="player-stats">${b2.runs} <span class="sub">(${b2.balls})</span></div>
        `;
      }
    }

    // Bowler
    if (state.bowler && els.bowlerName && els.bowlerStats) {
      els.bowlerName.innerText = state.bowler.name;
      els.bowlerStats.innerText = `${state.bowler.wickets}-${state.bowler.runs} (${state.bowler.overs})`;
    }

    // This Over Balls
    if (els.thisOverPills && Array.isArray(state.thisOver)) {
      els.thisOverPills.innerHTML = state.thisOver.map(ball => {
        let pillClass = "ball-pill";
        const b = String(ball).toUpperCase();
        if (b === "0" || b === "•") pillClass += " dot";
        else if (b === "4") pillClass += " four";
        else if (b === "6") pillClass += " six";
        else if (b.includes("W") && !b.includes("WD")) pillClass += " wicket";
        else if (b.includes("WD") || b.includes("NB")) pillClass += " extra";
        return `<div class="${pillClass}">${b}</div>`;
      }).join('');
    }

    // Check for Trigger Events: Wickets, Over Change, 2nd Over Scorecard
    evaluateTriggers(state);
  }

  // --- 5. Trigger Engine (Over Summary, 2nd Over Scorecard, Wickets, Boundaries & Replay) ---
  function evaluateTriggers(state) {
    const currentOversFloat = parseFloat(state.battingTeam.overs || "0");
    const completedOvers = Math.floor(currentOversFloat);
    const isOverComplete = (currentOversFloat % 1 === 0 && completedOvers > 0);
    const currentRuns = state.battingTeam.score || 0;
    const currentWickets = state.battingTeam.wickets || 0;
    const striker = (state.batsmen && state.batsmen[0]) ? state.batsmen[0].name : '';

    // First Live Snapshot Load: Set baseline values without firing historic alerts
    if (isInitialLiveLoad) {
      previousState.wickets = currentWickets;
      previousState.totalRuns = currentRuns;
      previousState.overs = currentOversFloat;
      previousState.thisOverLen = Array.isArray(state.thisOver) ? state.thisOver.length : 0;
      previousState.lastBall = (Array.isArray(state.thisOver) && state.thisOver.length > 0) ? String(state.thisOver[state.thisOver.length - 1]).toUpperCase() : '';
      previousState.lastOverNotified = completedOvers;
      isInitialLiveLoad = false;
      return;
    }

    // Event A: WICKET DETECTED (fires on ANY wicket, including 1st wicket 0 -> 1)!
    if (currentWickets > previousState.wickets) {
      triggerWicketEvent(state);
    }

    // Event B: BOUNDARY DETECTED (FOUR or SIX)!
    if (Array.isArray(state.thisOver) && state.thisOver.length > 0) {
      const curLen = state.thisOver.length;
      const latestBall = String(state.thisOver[curLen - 1]).toUpperCase();
      if (curLen !== previousState.thisOverLen || latestBall !== previousState.lastBall) {
        if (latestBall === '4' || latestBall === '4B' || latestBall === '4LB') {
          triggerBoundaryEvent('four', striker);
        } else if (latestBall === '6' || latestBall === '6NB') {
          triggerBoundaryEvent('six', striker);
        }
        previousState.thisOverLen = curLen;
        previousState.lastBall = latestBall;
      }
    } else if (previousState.totalRuns > 0) {
      const runDelta = currentRuns - previousState.totalRuns;
      if (runDelta === 4) {
        triggerBoundaryEvent('four', striker);
      } else if (runDelta === 6) {
        triggerBoundaryEvent('six', striker);
      }
    }

    // Event C: OVER CHANGE STATS POPUP
    if (isOverComplete && previousState.lastOverNotified !== completedOvers) {
      previousState.lastOverNotified = completedOvers;
      triggerOverSummary(completedOvers, state);

      // Event D: TEAM SCORECARD AFTER EVERY 2nd OVER (2, 4, 6, 8, etc.)
      if (completedOvers % 2 === 0 && previousState.lastScorecardOverNotified !== completedOvers) {
        previousState.lastScorecardOverNotified = completedOvers;
        // Trigger after the short over summary finishes
        setTimeout(() => {
          triggerTeamScorecard(state);
        }, 3500);
      }
    }

    // Update previous tracker
    previousState.wickets = currentWickets;
    previousState.totalRuns = currentRuns;
    previousState.overs = currentOversFloat;
  }

  // Trigger: Boundary Stinger (FOUR or SIX Animated Banner)
  let boundaryTimer = null;
  function triggerBoundaryEvent(type, batsmanName) {
    if (!els.boundaryStinger || !els.boundaryBox) return;

    clearTimeout(boundaryTimer);
    const isFour = type === 'four' || type === 4;
    const isSix = type === 'six' || type === 6;

    if (isFour) {
      els.boundaryBox.className = 'boundary-box four';
      if (els.boundaryTitle) els.boundaryTitle.innerText = 'FOUR!';
      if (els.boundarySubtitle) {
        els.boundarySubtitle.innerText = batsmanName ? `${batsmanName} • CRACKING BOUNDARY` : 'CRACKING BOUNDARY!';
      }
    } else if (isSix) {
      els.boundaryBox.className = 'boundary-box six';
      if (els.boundaryTitle) els.boundaryTitle.innerText = 'SIX!';
      if (els.boundarySubtitle) {
        els.boundarySubtitle.innerText = batsmanName ? `${batsmanName} • MASSIVE MAXIMUM` : 'MASSIVE MAXIMUM!';
      }
    }

    els.boundaryStinger.classList.add('active');

    boundaryTimer = setTimeout(() => {
      els.boundaryStinger.classList.remove('active');
    }, 2800);
  }

  // Trigger: Wicket Celebration & Automated Replay Bug
  function triggerWicketEvent(state) {
    if (!els.wicketStinger || !els.replayBug) return;

    // 1. Show WICKET! Stinger Banner
    if (els.wicketDismissalText) {
      els.wicketDismissalText.innerText = `${state.battingTeam.shortName} ${state.battingTeam.score}/${state.battingTeam.wickets}`;
    }
    els.wicketStinger.classList.add('active');

    // 2. Hide Stinger after 3.5s and Activate REPLAY Bug for 8 seconds
    setTimeout(() => {
      els.wicketStinger.classList.remove('active');
      els.replayBug.classList.add('active');

      setTimeout(() => {
        els.replayBug.classList.remove('active');
      }, 8000);
    }, 3200);
  }

  // Trigger: Over Summary Card Popup
  function triggerOverSummary(overNum, state) {
    if (!els.overSummaryCard) return;

    if (els.overSummaryTitle) els.overSummaryTitle.innerText = `END OF OVER ${overNum}`;
    if (els.overSummaryRuns) els.overSummaryRuns.innerText = `${state.battingTeam.score}/${state.battingTeam.wickets}`;
    if (els.overSummaryBowler && state.bowler) {
      els.overSummaryBowler.innerText = `${state.bowler.name}: ${state.bowler.wickets}/${state.bowler.runs}`;
    }

    els.overSummaryCard.classList.add('active');
    setTimeout(() => {
      els.overSummaryCard.classList.remove('active');
    }, 6000); // Display for 6 seconds
  }

  // Trigger: Team Scorecard Modal
  function triggerTeamScorecard(state) {
    if (!els.scorecardModal) return;

    if (els.scorecardTeamScore) {
      els.scorecardTeamScore.innerText = `${state.battingTeam.shortName} ${state.battingTeam.score}/${state.battingTeam.wickets} (${state.battingTeam.overs})`;
    }
    if (els.scorecardPartnership) {
      els.scorecardPartnership.innerText = state.partnerships || "N/A";
    }

    // Populate Batting Table
    if (els.scorecardTableBody && Array.isArray(state.teamScorecard)) {
      els.scorecardTableBody.innerHTML = state.teamScorecard.map(b => `
        <tr class="${b.active ? 'active-batsman' : ''}">
          <td><strong>${b.name}</strong><br><small style="color:#94a3b8">${b.dismissal}</small></td>
          <td class="stat-num">${b.runs}</td>
          <td class="stat-num">${b.balls}</td>
          <td class="stat-num">${b.fours}</td>
          <td class="stat-num">${b.sixes}</td>
        </tr>
      `).join('');
    }

    els.scorecardModal.classList.add('active');
    setTimeout(() => {
      els.scorecardModal.classList.remove('active');
    }, 9000); // Display for 9 seconds
  }

  // --- 6. Live CricHeroes MQTT Real-Time Connection or Controller Simulator ---
  if (mode === 'live' && matchId) {
    const cleanMatchId = matchId.match(/\d{7,10}/) ? matchId.match(/\d{7,10}/)[0] : matchId.trim();

    if (cleanMatchId.toLowerCase() === 'demo' || cleanMatchId.toLowerCase() === 'test') {
      // Local Demo Mode via Proxy Simulation
      const pUrl = proxyUrl || '/proxy';
      async function fetchDemo() {
        try {
          const res = await fetch(`${pUrl}?matchId=demo`);
          if (res.ok) {
            const data = await res.json();
            adaptCricHeroesData(data);
            renderOverlay(currentState);
          }
        } catch (e) {}
      }
      setInterval(fetchDemo, 3000);
      fetchDemo();
    } else {
      // Direct Real-Time CricHeroes MQTT WebSocket Engine (Zero-Latency)
      connectCricHeroesMQTT(cleanMatchId);

      // Pre-fetch match / upcoming metadata via proxy immediately + continuous sync
      const pUrl = (proxyUrl || '/proxy').replace(/\/+$/, '');
      let fetchEndpoint;
      if (matchUrl) {
        fetchEndpoint = pUrl.includes('?') ? `${pUrl}&url=${encodeURIComponent(matchUrl)}` : `${pUrl}?url=${encodeURIComponent(matchUrl)}`;
      } else {
        if (pUrl.includes('matchId=') || pUrl.includes('id=')) {
          fetchEndpoint = pUrl;
        } else {
          fetchEndpoint = pUrl.includes('?') ? `${pUrl}&matchId=${cleanMatchId}` : `${pUrl}?matchId=${cleanMatchId}`;
        }
      }

      function syncMatchState() {
        fetch(fetchEndpoint)
          .then(r => r.json())
          .then(initialData => {
            if (initialData && (initialData.status || initialData.data || initialData.team_a || initialData.teams || initialData.matchDetails)) {
              adaptCricHeroesData(initialData);
              renderOverlay(currentState);
            }
          })
          .catch(err => {
            console.warn('[HTTP Sync Notice]', err);
          });
      }

      syncMatchState();
      setInterval(syncMatchState, 4000); // 4s periodic background refresh
    }
  } else {
    // Simulator Mode: Listen for manual actions or messages from controller.html
    renderOverlay(currentState);

    window.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'UPDATE_OVERLAY_STATE') {
        currentState = Object.assign({}, currentState, event.data.state);
        renderOverlay(currentState);
      } else if (event.data && event.data.type === 'TRIGGER_WICKET') {
        currentState.battingTeam.wickets += 1;
        triggerWicketEvent(currentState);
        renderOverlay(currentState);
      } else if (event.data && event.data.type === 'TRIGGER_FOUR') {
        const striker = (currentState.batsmen && currentState.batsmen[0]) ? currentState.batsmen[0].name : '';
        triggerBoundaryEvent('four', event.data.batsman || striker);
      } else if (event.data && event.data.type === 'TRIGGER_SIX') {
        const striker = (currentState.batsmen && currentState.batsmen[0]) ? currentState.batsmen[0].name : '';
        triggerBoundaryEvent('six', event.data.batsman || striker);
      } else if (event.data && event.data.type === 'TRIGGER_SCORECARD') {
        triggerTeamScorecard(currentState);
      } else if (event.data && event.data.type === 'TRIGGER_OVER_SUMMARY') {
        triggerOverSummary(Math.floor(parseFloat(currentState.battingTeam.overs)), currentState);
      } else if (event.data && event.data.type === 'SET_THEME') {
        document.body.className = `theme-${event.data.theme}`;
      }
    });
  }

  // Native Zero-Dependency MQTT 3.1.1 WebSocket Client for CricHeroes
  function connectCricHeroesMQTT(mId) {
    const brokerUrls = [
      'wss://ajpqtrpkadas99.cricheroes.in:8884/mqtt',
      'wss://axkvj8kbcq.cricheroes.in:8884/mqtt'
    ];
    let currentBrokerIdx = 0;
    let ws = null;
    let pingTimer = null;

    function initWS() {
      const brokerUrl = brokerUrls[currentBrokerIdx];
      console.log(`%c[CricHeroes Live MQTT]%c Connecting to ${brokerUrl} for match ${mId}...`, 'color:orange;font-weight:bold', '');

      try {
        ws = new WebSocket(brokerUrl, 'mqtt');
        ws.binaryType = 'arraybuffer';
      } catch (err) {
        console.error('[CricHeroes MQTT] WebSocket creation failed:', err);
        return;
      }

      ws.onopen = () => {
        console.log('%c[CricHeroes Live MQTT]%c WebSocket Connected. Sending MQTT CONNECT packet...', 'color:lime;font-weight:bold', '');
        const clientId = 'CHWS-' + Math.floor(Math.random() * 900 + 100) + '_' + Date.now() + '_score_';
        const clientBytes = new TextEncoder().encode(clientId);

        // MQTT 3.1.1 Connect Packet Header
        const varHeader = [0x00, 0x04, 0x4D, 0x51, 0x54, 0x54, 0x04, 0x02, 0x00, 0x3C];
        const payload = [clientBytes.length >> 8, clientBytes.length & 0xFF, ...clientBytes];
        const remainLen = varHeader.length + payload.length;

        const connectPkt = new Uint8Array([0x10, remainLen, ...varHeader, ...payload]);
        ws.send(connectPkt);

        // MQTT Keep-Alive PINGREQ every 25 seconds
        clearInterval(pingTimer);
        pingTimer = setInterval(() => {
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(new Uint8Array([0xC0, 0x00]));
          }
        }, 25000);
      };

      ws.onmessage = (event) => {
        try {
          const buf = new Uint8Array(event.data);
          const packetType = buf[0] >> 4;

          // 2 = CONNACK (Connected)
          if (packetType === 2) {
            console.log('%c[CricHeroes Live MQTT]%c Connected & Authorized. Subscribing to match topics...', 'color:lime;font-weight:bold', '');
            sendSubscribe(ws, `scorecard-${mId}`, 1);
            sendSubscribe(ws, `webminiscorecard-${mId}`, 2);
          }
          // 3 = PUBLISH (Incoming Real-Time Match Data)
          else if (packetType === 3) {
            const text = new TextDecoder().decode(buf);
            const firstBrace = text.indexOf('{');
            const lastBrace = text.lastIndexOf('}');
            if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
              const jsonStr = text.substring(firstBrace, lastBrace + 1);
              try {
                const parsed = JSON.parse(jsonStr);
                if (parsed && (parsed.status || parsed.data)) {
                  console.log('%c[Live Ball Update Received]%c', 'color:cyan;font-weight:bold', '', parsed);
                  adaptCricHeroesData(parsed);
                  renderOverlay(currentState);
                }
              } catch (e) {
                // Ignore partial frames
              }
            }
          }
        } catch (err) {
          console.warn('[CricHeroes MQTT] Message parse warning:', err);
        }
      };

      ws.onerror = (err) => {
        console.warn('[CricHeroes MQTT] Connection error:', err);
      };

      ws.onclose = () => {
        clearInterval(pingTimer);
        console.warn('[CricHeroes MQTT] Connection lost. Reconnecting in 3s...');
        currentBrokerIdx = (currentBrokerIdx + 1) % brokerUrls.length;
        setTimeout(initWS, 3000);
      };
    }

    function sendSubscribe(wsSock, topic, pktId) {
      const topicBytes = new TextEncoder().encode(topic);
      const varHeader = [pktId >> 8, pktId & 0xFF];
      const payload = [topicBytes.length >> 8, topicBytes.length & 0xFF, ...topicBytes, 0x00];
      const remainLen = varHeader.length + payload.length;
      const subPkt = new Uint8Array([0x82, remainLen, ...varHeader, ...payload]);
      wsSock.send(subPkt);
      console.log(`[CricHeroes MQTT] Subscribed to topic: ${topic}`);
    }

    initWS();
  }

  // Data adapter for CricHeroes API & MQTT real-time payloads
  function adaptCricHeroesData(chData) {
    if (!chData) return;
    const d = chData.data ? chData.data : chData;

    // 1. Check if Match is Upcoming / Yet to Start
    const statusLower = String(d.status || d.matchStatus || '').toLowerCase();
    const isUpcomingStatus = statusLower === 'upcoming' || statusLower === 'not_started' || statusLower === 'yet_to_start';
    const bothYetToBat = d.team_a && d.team_b && d.team_a.summary === 'Yet to bat' && d.team_b.summary === 'Yet to bat' && (!d.current_inning || d.current_inning === 0);
    const hasMatchDetails = Boolean(d.matchDetails || (d.teams && (d.teams.teamA || d.teams.team_a)));

    if (isUpcomingStatus || bothYetToBat || (hasMatchDetails && !d.current_inning)) {
      currentState.isUpcoming = true;

      // Tournament
      if (customTournament) {
        currentState.tournament = customTournament.toUpperCase();
      } else if (d.tournament_name && d.tournament_name.trim()) {
        const round = (d.tournament_round_name && d.tournament_round_name.trim()) ? ` • ${d.tournament_round_name.trim()}` : '';
        currentState.tournament = `${d.tournament_name.trim()}${round}`.toUpperCase();
      } else {
        const oversPart = d.overs ? `${d.overs} OVERS` : (d.match_type || 'LIMITED OVERS');
        const ballPart = d.ball_type ? ` • ${d.ball_type}` : '';
        currentState.tournament = `MATCH PREVIEW • ${oversPart}${ballPart}`.toUpperCase();
      }

      // Teams (supports string names, objects, or team_a_name keys)
      const tA = d.team_a || d.teams?.teamA || d.teams?.team_a || d.matchDetails?.teams?.teamA || {};
      const tB = d.team_b || d.teams?.teamB || d.teams?.team_b || d.matchDetails?.teams?.teamB || {};
      const tAName = typeof tA === 'string' ? tA : (tA.name || d.team_a_name || "TEAM A");
      const tBName = typeof tB === 'string' ? tB : (tB.name || d.team_b_name || "TEAM B");

      // Extract captains
      const capA = tA.captain_name || tA.captain || tA.captain_info?.player_name || (Array.isArray(tA.squad) ? tA.squad.find(p => p.is_captain || p.isCaptain)?.player_name : "") || "";
      const capB = tB.captain_name || tB.captain || tB.captain_info?.player_name || (Array.isArray(tB.squad) ? tB.squad.find(p => p.is_captain || p.isCaptain)?.player_name : "") || "";
      const capAPhoto = tA.captain_photo || (Array.isArray(tA.squad) ? tA.squad.find(p => (p.is_captain || p.isCaptain) && p.profile_photo)?.profile_photo : "") || "";
      const capBPhoto = tB.captain_photo || (Array.isArray(tB.squad) ? tB.squad.find(p => (p.is_captain || p.isCaptain) && p.profile_photo)?.profile_photo : "") || "";

      currentState.teamA = {
        name: tAName,
        shortName: (tA.short_name || tA.shortName || d.team_a_short_name || tAName.split(' ').map(w => w[0]).join('').slice(0, 4) || "TM1").toUpperCase(),
        logo: typeof tA === 'object' ? (tA.logo || d.team_a_logo || "") : (d.team_a_logo || ""),
        captain: capA,
        captainPhoto: capAPhoto
      };
      currentState.teamB = {
        name: tBName,
        shortName: (tB.short_name || tB.shortName || d.team_b_short_name || tBName.split(' ').map(w => w[0]).join('').slice(0, 4) || "TM2").toUpperCase(),
        logo: typeof tB === 'object' ? (tB.logo || d.team_b_logo || "") : (d.team_b_logo || ""),
        captain: capB,
        captainPhoto: capBPhoto
      };

      // Match Format & Overs
      const oversStr = d.overs ? `${d.overs} OVERS` : "";
      const ballStr = d.ball_type ? `${d.ball_type} BALL` : "";
      const matchTypeStr = d.match_type || "";
      currentState.format = [oversStr, ballStr, matchTypeStr].filter(Boolean).join(" • ").toUpperCase() || "LIMITED OVERS";

      // Venue
      const venueName = d.ground_name || d.venue?.name || d.matchDetails?.venue?.name || "";
      const cityName = d.city_name || d.venue?.city || d.matchDetails?.venue?.city || "";
      currentState.venue = [venueName, cityName].filter(Boolean).join(", ").toUpperCase();

      // Start Time
      const startTimeRaw = d.match_start_time || d.start_datetime || d.startTime || d.matchDetails?.startTime || "";
      if (startTimeRaw) {
        try {
          const dt = new Date(startTimeRaw);
          currentState.startTime = dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + " • " + dt.toLocaleDateString([], { month: 'short', day: 'numeric' });
        } catch (e) {
          currentState.startTime = startTimeRaw;
        }
      }

      // Toss
      currentState.toss = (d.toss_details || d.toss?.status || d.matchDetails?.toss?.status || "Toss Pending").toUpperCase();
      currentState.matchStatus = `MATCH STARTING SOON • ${currentState.toss}`;
      return;
    }

    currentState.isUpcoming = false;

    // 2. Resolve Tournament / Match Title
    if (customTournament) {
      currentState.tournament = customTournament.toUpperCase();
    } else if (d.tournament_name && d.tournament_name.trim()) {
      const round = (d.tournament_round_name && d.tournament_round_name.trim()) ? ` • ${d.tournament_round_name.trim()}` : '';
      currentState.tournament = `${d.tournament_name.trim()}${round}`.toUpperCase();
    } else {
      // Individual match / bilateral friendly (no tournament registered on CricHeroes)
      const oversPart = d.overs ? `${d.overs} OVERS` : (d.match_type || 'LIMITED OVERS');
      const ballPart = d.ball_type ? ` • ${d.ball_type}` : '';
      const groundPart = d.ground_name ? ` • ${d.ground_name.split(',')[0].trim()}` : '';
      currentState.tournament = `${oversPart}${ballPart}${groundPart}`.toUpperCase();
    }

    // 2. Determine Inning & Match Status
    const currentInning = parseInt(d.current_inning || d.match_inning || 1, 10);
    const isFinished = d.status === 'past' || Boolean(d.winning_team) || Boolean(d.match_result);
    if (isFinished) {
      const finishMsg = d.match_summary?.summary || d.match_result || (d.winning_team ? `${d.winning_team} won` : "MATCH COMPLETED");
      currentState.matchStatus = finishMsg.toUpperCase();
    } else if (currentInning === 2 && d.match_summary) {
      const ms = d.match_summary;
      const targetStr = ms.target && ms.target !== '-' ? `TARGET: ${ms.target}` : "";
      const summaryStr = ms.summary ? `• ${ms.summary}` : "";
      currentState.matchStatus = `2ND INNINGS • ${targetStr} ${summaryStr}`.trim().toUpperCase();
      if (ms.rrr && ms.rrr !== '0.00') currentState.rrr = String(ms.rrr);
    } else if (d.toss_details) {
      currentState.matchStatus = `1ST INNINGS • ${d.toss_details}`.toUpperCase();
    }

    // 3. Batting & Bowling Teams
    if (d.team_a && d.team_b) {
      let batTeam = currentInning === 2 ? d.team_b : d.team_a;
      let bowlTeam = currentInning === 2 ? d.team_a : d.team_b;

      // Swap if toss or summary indicates opposite team is batting
      if (currentInning === 1 && d.team_a.summary === "Yet to bat" && d.team_b.summary !== "Yet to bat") {
        batTeam = d.team_b;
        bowlTeam = d.team_a;
      }

      // Update Batting Team Details
      if (batTeam) {
        const teamName = batTeam.name || "BATTING";
        currentState.battingTeam.name = teamName.toUpperCase();
        currentState.battingTeam.shortName = (batTeam.short_name || teamName.split(' ').map(w => w[0]).join('').slice(0, 4) || "BAT").toUpperCase();

        // Score, Wickets, Overs extraction
        let score = 0;
        let wickets = 0;
        let overs = "0.0";

        // From innings array
        if (Array.isArray(batTeam.innings) && batTeam.innings.length > 0) {
          const inn = batTeam.innings.find(i => parseInt(i.inning, 10) === currentInning) || batTeam.innings[batTeam.innings.length - 1];
          if (inn.total_run !== undefined) score = parseInt(inn.total_run, 10);
          if (inn.total_wicket !== undefined) wickets = parseInt(inn.total_wicket, 10);
          if (inn.overs_played !== undefined) overs = String(inn.overs_played);
          if (inn.summary && inn.summary.rr) currentState.crr = String(inn.summary.rr);
        }

        // Fallback: Parse from batTeam.summary (e.g. "155/9" or "25/1 (3.2 Ov)")
        if (score === 0 && batTeam.summary && batTeam.summary !== "Yet to bat") {
          const scoreMatch = batTeam.summary.match(/(\d+)\/(\d+)/);
          if (scoreMatch) {
            score = parseInt(scoreMatch[1], 10);
            wickets = parseInt(scoreMatch[2], 10);
          }
          const overMatch = batTeam.summary.match(/\(([\d.]+)\s*Ov/i);
          if (overMatch) overs = overMatch[1];
        }

        // Fallback for Inning 2 Target chase calculation
        if (currentInning === 2 && d.match_summary && d.match_summary.target && d.match_summary.required_run !== undefined) {
          const tgt = parseInt(d.match_summary.target, 10);
          const req = parseInt(d.match_summary.required_run, 10);
          if (tgt > 0 && req >= 0 && score === 0) {
            score = tgt - req;
          }
          if (d.match_summary.required_ball !== undefined && (overs === "0.0" || overs === "0")) {
            const totalBalls = parseInt(d.overs || 20, 10) * 6;
            const reqBalls = parseInt(d.match_summary.required_ball, 10);
            const bowledBalls = Math.max(0, totalBalls - reqBalls);
            if (bowledBalls > 0) {
              overs = `${Math.floor(bowledBalls / 6)}.${bowledBalls % 6}`;
            }
          }
        }

        currentState.battingTeam.score = score;
        currentState.battingTeam.wickets = wickets;
        currentState.battingTeam.overs = overs;
      }

      // Update Bowling Team Details
      if (bowlTeam) {
        const bowlName = bowlTeam.name || "BOWLING";
        currentState.bowlingTeam.name = bowlName.toUpperCase();
        currentState.bowlingTeam.shortName = (bowlTeam.short_name || bowlName.split(' ').map(w => w[0]).join('').slice(0, 4) || "BOWL").toUpperCase();
      }

      // 4. Batsmen Extraction
      // Strategy A: Direct batsmen object (webminiscorecard: sb & nsb)
      let batsmenFound = false;
      if (d.batsmen && (d.batsmen.sb || d.batsmen.nsb)) {
        if (d.batsmen.sb) {
          currentState.batsmen[0] = {
            name: d.batsmen.sb.name || "Striker",
            runs: parseInt(d.batsmen.sb.runs || 0, 10),
            balls: parseInt(d.batsmen.sb.balls || 0, 10),
            fours: parseInt(d.batsmen.sb['4s'] || 0, 10),
            sixes: parseInt(d.batsmen.sb['6s'] || 0, 10),
            isStriker: true
          };
          batsmenFound = true;
        }
        if (d.batsmen.nsb) {
          currentState.batsmen[1] = {
            name: d.batsmen.nsb.name || "Non-Striker",
            runs: parseInt(d.batsmen.nsb.runs || 0, 10),
            balls: parseInt(d.batsmen.nsb.balls || 0, 10),
            fours: parseInt(d.batsmen.nsb['4s'] || 0, 10),
            sixes: parseInt(d.batsmen.nsb['6s'] || 0, 10),
            isStriker: false
          };
          batsmenFound = true;
        }
      }

      // Strategy B: Extract from batTeam.scorecard batting list (scorecard packet)
      if (!batsmenFound && batTeam && Array.isArray(batTeam.scorecard)) {
        for (const sc of batTeam.scorecard) {
          if (Array.isArray(sc.batting) && sc.batting.length > 0) {
            // Find currently active "not out" batsmen
            const notOutBatsmen = sc.batting.filter(b => {
              const hto = (b.how_to_out || b.how_to_out_short_name || '').toLowerCase().trim();
              return hto === '' || hto === 'not out' || hto === 'batting';
            });

            if (notOutBatsmen.length >= 1) {
              currentState.batsmen[0] = {
                name: notOutBatsmen[0].name || "Striker",
                runs: parseInt(notOutBatsmen[0].runs || 0, 10),
                balls: parseInt(notOutBatsmen[0].balls || 0, 10),
                fours: parseInt(notOutBatsmen[0]['4s'] || 0, 10),
                sixes: parseInt(notOutBatsmen[0]['6s'] || 0, 10),
                isStriker: true
              };
            }
            if (notOutBatsmen.length >= 2) {
              currentState.batsmen[1] = {
                name: notOutBatsmen[1].name || "Non-Striker",
                runs: parseInt(notOutBatsmen[1].runs || 0, 10),
                balls: parseInt(notOutBatsmen[1].balls || 0, 10),
                fours: parseInt(notOutBatsmen[1]['4s'] || 0, 10),
                sixes: parseInt(notOutBatsmen[1]['6s'] || 0, 10),
                isStriker: false
              };
            }

            // Also populate extended scorecard
            currentState.teamScorecard = sc.batting.map(b => ({
              name: b.name,
              dismissal: b.how_to_out_short_name || b.how_to_out || "not out",
              runs: parseInt(b.runs || 0, 10),
              balls: parseInt(b.balls || 0, 10),
              fours: parseInt(b['4s'] || 0, 10),
              sixes: parseInt(b['6s'] || 0, 10),
              active: !b.how_to_out || b.how_to_out === "not out"
            }));
            break;
          }
        }
      }

      // 5. Bowler Extraction
      let bowlerFound = false;
      if (d.bowlers) {
        const b = d.bowlers.sb || d.bowlers.nsb || (Array.isArray(d.bowlers) ? d.bowlers[0] : null);
        if (b && (b.name || b.overs !== undefined)) {
          currentState.bowler = {
            name: b.name || "Bowler",
            overs: String(b.overs || "0.0"),
            maidens: parseInt(b.maidens || 0, 10),
            runs: parseInt(b.runs || 0, 10),
            wickets: parseInt(b.wickets || 0, 10),
            economy: String(b.economy_rate || "0.00")
          };
          bowlerFound = true;
        }
      }

      if (!bowlerFound) {
        // Search across both teams' scorecard arrays
        let allBowlers = [];
        [batTeam, bowlTeam].forEach(team => {
          if (team && Array.isArray(team.scorecard)) {
            team.scorecard.forEach(sc => {
              if (Array.isArray(sc.bowling)) allBowlers = allBowlers.concat(sc.bowling);
            });
          }
        });

        if (allBowlers.length > 0) {
          // Find bowlers with overs in the current spell
          const activeSpell = allBowlers.filter(b => parseFloat(b.overs || 0) > 0 || parseInt(b.balls || 0, 10) > 0);
          const currentBowler = activeSpell.length > 0 ? activeSpell[activeSpell.length - 1] : allBowlers[0];
          if (currentBowler) {
            currentState.bowler = {
              name: currentBowler.name || "Bowler",
              overs: String(currentBowler.overs || "0.0"),
              maidens: parseInt(currentBowler.maidens || 0, 10),
              runs: parseInt(currentBowler.runs || 0, 10),
              wickets: parseInt(currentBowler.wickets || 0, 10),
              economy: String(currentBowler.economy_rate || "0.00")
            };
          }
        }
      }

      // 6. This Over Balls
      if (typeof d.recent_over === 'string' && d.recent_over.trim()) {
        const parts = d.recent_over.trim().split('|');
        const lastOver = parts[parts.length - 1].trim();
        if (lastOver) {
          currentState.thisOver = lastOver.split(/\s+/);
        }
      } else if (Array.isArray(d.this_over)) {
        currentState.thisOver = d.this_over;
      } else if (Array.isArray(d.recent_balls)) {
        currentState.thisOver = d.recent_balls;
      }

      return;
    }

    // Flat Fallback / Legacy Structure
    currentState.battingTeam.shortName = d.batting_team_short_name || d.team_a_short || "BAT";
    currentState.battingTeam.score = parseInt(d.total_runs || d.score || 0, 10);
    currentState.battingTeam.wickets = parseInt(d.total_wickets || d.wickets || 0, 10);
    currentState.battingTeam.overs = String(d.overs || d.current_overs || "0.0");
    currentState.crr = String(d.crr || d.current_run_rate || "0.00");
    if (d.striker) {
      currentState.batsmen[0] = {
        name: d.striker.name || "Striker",
        runs: d.striker.runs || 0,
        balls: d.striker.balls || 0,
        fours: d.striker.fours || 0,
        sixes: d.striker.sixes || 0,
        isStriker: true
      };
    }
    if (d.non_striker) {
      currentState.batsmen[1] = {
        name: d.non_striker.name || "Non-Striker",
        runs: d.non_striker.runs || 0,
        balls: d.non_striker.balls || 0,
        fours: d.non_striker.fours || 0,
        sixes: d.non_striker.sixes || 0,
        isStriker: false
      };
    }
    if (d.bowler) {
      currentState.bowler = {
        name: d.bowler.name || "Bowler",
        overs: d.bowler.overs || "0.0",
        maidens: d.bowler.maidens || 0,
        runs: d.bowler.runs || 0,
        wickets: d.bowler.wickets || 0,
        economy: d.bowler.economy || "0.00"
      };
    }
    if (Array.isArray(d.this_over)) {
      currentState.thisOver = d.this_over;
    }
  }

  // Export functions to window for direct console testing
  window.cricketOverlay = {
    getState: () => currentState,
    setState: (newState) => {
      currentState = Object.assign({}, currentState, newState);
      renderOverlay(currentState);
    },
    triggerWicket: () => triggerWicketEvent(currentState),
    triggerFour: (b) => triggerBoundaryEvent('four', b || ((currentState.batsmen && currentState.batsmen[0]) ? currentState.batsmen[0].name : '')),
    triggerSix: (b) => triggerBoundaryEvent('six', b || ((currentState.batsmen && currentState.batsmen[0]) ? currentState.batsmen[0].name : '')),
    triggerScorecard: () => triggerTeamScorecard(currentState),
    triggerOverSummary: (o) => triggerOverSummary(o || 2, currentState),
    setTheme: (t) => { document.body.className = `theme-${t}`; }
  };
})();
