# 🏏 Cricket Live Stream Overlay System for YouTube Live

Broadcast-grade, transparent live cricket overlay web application engineered for **YouTube Live** streams using **PRISM Live Studio**, **OBS Studio**, or **vMix**.

Supports real-time CricHeroes live ball-by-ball updates via zero-latency MQTT WebSockets, automated boundary stingers (`FOUR!` & `SIX!`), wicket stingers with instant replay bug, and center broadcast cards for upcoming matches.

---

## 📁 Files in This Repository

| File | Purpose |
| :--- | :--- |
| **`index.html`** | The transparent broadcast overlay loaded by PRISM Live Studio / OBS Browser Source. |
| **`overlay.css`** | Broadcast television styling, themes (IPL, Dark Neon, Classic), animations, and popups. |
| **`overlay.js`** | Real-time CricHeroes MQTT 3.1.1 WebSocket engine, trigger engine, and animation lifecycle. |
| **`controller.html`** | Web Studio Controller & 16:9 Live Preview for switching themes, simulator, and match presets. |
| **`serve.py`** | Local Python dev server & CORS proxy with CricHeroes WebTicker headers. |
| **`proxy_worker.js`** | Production Cloudflare Worker script (100% free serverless CORS proxy for 24/7 cloud streaming). |
| **`.gitignore`** | Excludes system and temporary debug files from GitHub. |

---

## ✨ Features

1. **Center Match Preview Card (Upcoming Matches):**
   - When a match ID is upcoming (before toss / start), the bottom ticker is hidden and a **Center Broadcast Preview Card** displays:
     - Team A: Logo, Full Team Name, and **Captain Name** with glowing `[C]` badge.
     - Center: Glowing animated `VS` graphic and toss status (`TOSS PENDING`).
     - Team B: Full Team Name, **Captain Name** with glowing `[C]` badge, and Logo.
     - Match Details: Scheduled start date/time, venue ground & city, and overs/ball format.
   - The moment the match starts, the center card smoothly dismisses and the live scorecard slides up automatically!

2. **Real-Time Live Scorecard & Player Figures:**
   - Score / Wickets & Overs (`87/2 (9.5 ov)`).
   - Striker (`*`) & Non-Striker runs, balls, 4s, 6s, and strike rate.
   - Active bowler figures: Overs, Maidens, Runs, Wickets, and Economy.
   - **This Over Pill Bar:** Dynamic indicators for Dots (`•`), 4s (Blue), 6s (Purple), Wickets (Red), and Extras (Orange).
   - Inning 2 Target chase calculations (`TARGET: 156 • NEED 28 RUNS IN 24 BALLS • RRR: 7.00`).

3. **Broadcast Stingers & Alerts:**
   - **`FOUR!` Alert:** Electric Cyan & Sapphire animated boundary banner with batsman name.
   - **`SIX!` Alert:** Explosive Royal Violet & Magenta maximum banner with batsman name.
   - **`WICKET!` Stinger:** Dramatic red dismissal alert banner.
   - **`INSTANT REPLAY` Bug:** Corner broadcast recording bug with blinking red dot.
   - **End of Over Stats Popup:** Automatically drops down every completed over (`1.0`, `2.0`, `3.0`...) for 6s.
   - **Team Scorecard Modal:** Broadcast batting card after every 2nd over (`2.0`, `4.0`, `6.0`...) for 9s.

4. **3 Broadcast Themes:**
   - **IPL Modern (`theme-ipl`):** Navy blue, gold accents, and amber typography (Default).
   - **Dark Neon (`theme-neon`):** Obsidian slate, cyber cyan, and magenta glow.
   - **Classic TV (`theme-classic`):** Clean white, slate, and deep maroon.

---

## 🚀 How to Commit & Push to GitHub

Run these commands in your terminal to initialize and push your repository:

```bash
cd stream-overlay

# 1. Initialize git (if not already done)
git init

# 2. Add remote repository
git remote add origin https://github.com/AkkiGtm/stream-overlay.git

# 3. Stage all necessary files
git add index.html overlay.css overlay.js controller.html serve.py proxy_worker.js README.md .gitignore

# 4. Commit changes
git commit -m "feat: complete cricket live stream overlay with upcoming center card, boundaries, and cricheroes live sync"

# 5. Push to GitHub
git branch -M main
git push -u origin main
```

---

## 🌐 Free 24/7 Cloud Deployment (No Local Server Needed)

### Step 1: Deploy Overlay to GitHub Pages (100% Free)
1. On GitHub, go to your repository: `https://github.com/AkkiGtm/stream-overlay`
2. Click **Settings** $\rightarrow$ **Pages** (in the left sidebar).
3. Under **Branch**, select `main` and `/ (root)`, then click **Save**.
4. Within 1-2 minutes, your free hosted overlay URL will be:
   ```
   https://akkigtm.github.io/stream-overlay/index.html
   ```

### Step 2: Deploy Free Cloudflare Worker Proxy (1-minute setup)
*(Since GitHub Pages is purely static, this free worker passes the CricHeroes WebTicker headers so CricHeroes doesn't block your browser).*

1. Go to [dash.cloudflare.com](https://dash.cloudflare.com) (free signup).
2. Go to **Workers & Pages** $\rightarrow$ **Create Application** $\rightarrow$ **Create Worker**.
3. Name it `cricket-proxy` and click **Deploy**.
4. Click **Edit code**, replace everything in `worker.js` with the contents of [`proxy_worker.js`](proxy_worker.js), and click **Deploy**.
5. Copy your worker URL (e.g. `https://cricket-proxy.<your-subdomain>.workers.dev`).

---

## 📱 PRISM Live Studio Setup for YouTube Live

PRISM Live Studio is available for **macOS, Windows, iOS, and Android**.

### Option A: Using Hosted Cloud URLs (Recommended)
1. In PRISM Live Studio, connect your **YouTube** account and configure your stream title and resolution (`1080p60`).
2. Add your Video Source (Camera, Capture Card, or Video file).
3. Click **Add Source (+)** $\rightarrow$ Select **Web / Browser Source** (or **Web** widget on mobile).
4. Set the URL:
   ```
   https://akkigtm.github.io/stream-overlay/index.html?mode=live&matchId=<YOUR_MATCH_ID>&proxyUrl=https://cricket-proxy.<your-subdomain>.workers.dev
   ```
   *(Replace `<YOUR_MATCH_ID>` with your numeric CricHeroes match ID, e.g. `27909503` for upcoming, or your live match ID).*
5. Set **Width**: `1920` and **Height**: `1080`.
6. Position the Browser Source above your camera/video layer.
7. Click **Go Live** on PRISM!

### Option B: Running Locally on Mac while Streaming from Mac
1. Open Terminal and start the local server:
   ```bash
   python3 serve.py
   ```
2. In PRISM Live Studio Browser Source, set URL to:
   ```
   http://localhost:8080/index.html?mode=live&matchId=<YOUR_MATCH_ID>
   ```
3. Set **Width**: `1920`, **Height**: `1080`.
4. Open `http://localhost:8080/controller.html` in Safari/Chrome to monitor the match or test animations live!
