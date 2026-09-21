# Suraksha-Map-Prototype-
This is an prototype of Suraksha Map an privacy preserving public safety website which ensures public space safety 
# SurakshaMap — Community Safety Reporting & Risk Intelligence

Built for the Avengers Hackathon (Unstop) · Open Innovation track

## Problem
Everyday public-space hazards — broken streetlights, open manholes, unsafe
crossings, waterlogging — go unreported because there's no easy, anonymous
way for residents to flag them, and no way to tell which spots are genuinely
dangerous versus a one-off complaint.

## Solution
SurakshaMap lets anyone report a public-space issue in under a minute — no
sign-up, no phone number — with an optional photo and a location pin. Reports
are automatically scored on transparent, explainable factors (severity,
category, recency, time of day, and how many similar reports cluster nearby)
and grouped into geographic hotspots, so residents and authorities can see
*where* to act first and *why* — not a black-box AI score.

## Features
- **Anonymous reporting** — category, severity, description, photo (resized/
  compressed in-browser), and location (manual entry or device GPS).
- **Explainable risk scoring** — every score shows its breakdown: severity
  points, category weight, recency, night-time factor, and repeat-report
  count. No hidden model.
- **Hotspot clustering** — nearby reports (within 200m) are grouped using
  haversine-distance clustering, with a plain-English explanation per
  hotspot.
- **Private tracking tokens** — reporters get a token (e.g. `SM-AB12-CD34`)
  to check their report's status later without an account.
- **Live map** — Leaflet-based map with color-coded risk markers, filterable
  by category and status.
- **Dashboard** — total/open/under-review/resolved counts, priority hotspot
  list, category breakdown, and a report-management table with status
  controls.
- **Fully responsive** — mobile-first layout, tested against actual overflow
  detection (not just eyeballing) across phone, small-Android, and tablet
  widths, in every view.
- **Privacy policy page** (`privacy.html`) — plain-language explanation of
  what's collected and how local storage works.
- **Admin panel** (`admin.html`) — manage all reports (status + delete) in
  one place, behind a demo sign-in gate (passphrase: `suraksha-demo`).
  Honestly labelled on-screen as a front-end-only demo convenience, not real
  access control, since there's no backend to authenticate against here.

## Tech stack
Plain HTML, CSS and JavaScript — no framework, no build step, no server.
Data persists in the browser's `localStorage`. Mapping via Leaflet +
OpenStreetMap tiles. Chosen deliberately: it removes every point of failure
that a live judged demo could hit (no backend to misconfigure, no API keys,
no deployment pipeline).

## Run it locally
No build step needed. Two options:
1. Just open `index.html` directly in a browser, **or**
2. From this folder, run a local server (recommended, avoids browser file://
   restrictions on some setups):
   ```bash
   python3 -m http.server 8000
   ```
   then open `http://localhost:8000`.

## Deploy it (for the "Deployment Link" field)
It's fully static — drag-and-drop the whole folder into any of these, free:
- **Netlify** (netlify.com/drop) — fastest, literally drag the folder in
- **GitHub Pages** — push to a repo, enable Pages in settings
- **Vercel** — `vercel deploy` from this folder

## Notes for judges
- Demo data is pre-seeded on first load so the map/dashboard aren't empty.
- Reports and their tracking tokens are stored per-browser (by design, for
  privacy — no server means no central database of who reported what).
- The admin panel (`admin.html`) sits behind a demo sign-in — passphrase
  `suraksha-demo` — shown on-screen. It's clearly labeled as a front-end
  convenience for the walkthrough, not real security.
- The risk-scoring formula and its rationale are documented at the top of
  `surakshamap-risk.js`.
