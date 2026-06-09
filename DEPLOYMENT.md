# Deployment Guide

This project deploys as two independent pieces:

- **Frontend** → **Vercel** (static Vite build, always-on, public URL)
- **Backend** → **Cloudflare Tunnel** (exposes the FastAPI app running on your own machine)

> The backend is **optional**. If it's offline, the frontend automatically falls back to its
> on-device Surat traffic model — routing, air quality, and mode comparison all keep working.
> The backend only adds **live TomTom traffic ETAs**.

---

## 1. Frontend on Vercel

### a. Push to GitHub
```bash
git add -A
git commit -m "Prepare for deployment"
git push origin main
```

### b. Import the repo on Vercel
1. Go to [vercel.com/new](https://vercel.com/new) and import your GitHub repo.
2. Vercel auto-detects **Vite** (build: `npm run build`, output: `dist`) — `vercel.json` already sets this.
3. Add **Environment Variables** (Project → Settings → Environment Variables):

   | Name | Value |
   |------|-------|
   | `VITE_WAQI_TOKEN` | your WAQI token (or leave unset) |
   | `VITE_DATAGOV_KEY` | your data.gov.in key |
   | `VITE_BACKEND_URL` | your Cloudflare tunnel URL (set this **after** step 2 below) |

4. Click **Deploy**. You'll get a URL like `https://transitoptima.vercel.app`.

> Re-deploy after setting `VITE_BACKEND_URL` (env vars are baked in at build time for Vite).

---

## 2. Backend via Cloudflare Tunnel

Cloudflare Tunnel publishes your **locally running** FastAPI server to a public HTTPS URL
without opening ports. Your backend is only reachable while your machine + the tunnel are running.

### a. Run the backend locally
```bash
cd backend
python -m venv .venv && .venv\Scripts\activate     # Windows  (use: source .venv/bin/activate on macOS/Linux)
pip install -r requirements.txt
# Optional: put TOMTOM_API_KEY and FRONTEND_ORIGINS in backend/.env
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### b. Install cloudflared
- **Windows:** `winget install --id Cloudflare.cloudflared`
- **macOS:** `brew install cloudflared`
- **Linux:** see https://pkg.cloudflare.com

### c. Option A — Quick tunnel (fastest, ephemeral URL)
```bash
cloudflared tunnel --url http://localhost:8000
```
This prints a random `https://<random>.trycloudflare.com` URL. Copy it.
The URL changes every time you restart, so it's best for quick demos.

### c. Option B — Named tunnel (stable URL, needs a domain on Cloudflare)
```bash
cloudflared tunnel login
cloudflared tunnel create transitoptima
# Map a hostname to the local service:
cloudflared tunnel route dns transitoptima api.yourdomain.com
```
Create `~/.cloudflared/config.yml`:
```yaml
tunnel: transitoptima
credentials-file: /home/you/.cloudflared/<TUNNEL-UUID>.json
ingress:
  - hostname: api.yourdomain.com
    service: http://localhost:8000
  - service: http_status:404
```
Run it:
```bash
cloudflared tunnel run transitoptima
```

### d. Wire the two together
1. Set `VITE_BACKEND_URL` on Vercel to your tunnel URL (e.g. `https://api.yourdomain.com`
   or the `trycloudflare.com` URL) and **re-deploy**.
2. Set `FRONTEND_ORIGINS` in `backend/.env` to your Vercel URL
   (e.g. `https://transitoptima.vercel.app`) so CORS allows it, then restart uvicorn.
   (Vercel `*.vercel.app` preview URLs are already allowed via regex.)

---

## 3. Verify
- Open the Vercel URL → plan a Surat trip → the mode comparison, map routes, and pollution
  card should all work.
- With the tunnel running, the ETA label should read **"Live TomTom traffic"** (if a TomTom
  key is set). Stop the tunnel and reload → it falls back to the **calibrated Surat model**,
  proving the graceful degradation.

---

## Alternative: always-on backend
If you'd rather not tie backend uptime to your machine, deploy `backend/` to a free host like
**Render** or **Railway** (Python web service, start command
`uvicorn app.main:app --host 0.0.0.0 --port $PORT`) and point `VITE_BACKEND_URL` at that URL
instead. Same `FRONTEND_ORIGINS` CORS step applies.
