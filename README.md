# roamio: Wellness-first Trip Companion

roamio is a **mobile wellness companion for travel**: instead of only planning an itinerary, it helps you **pace your day based on how you feel**. You check in with an energy level (1–10) during your trip, and roamio can **reroute the rest of your day** with **nearby, lower-effort alternatives** when you’re running low.

---

Travel is meant to be a time for people to relax and recharge, yet up to 89% of travelers experience the opposite. Planning an itinerary can be overwhelming, with countless attractions, activities, and decisions to make. Once the trip begins, many travelers feel *pressure* to see everything, often sacrificing sleep and personal well-being just to fit more into their schedule.

Sometimes, the best plans are unplanned. We realized that travel plans rarely adapt to how people *actually feel* during the day, usually trying to maximize sightseeing. roamio was created to help travelers explore at their **own pace**, allowing their plans to adjust to their energy and well-being instead of forcing them to keep up with a rigid itinerary. 

## Project Summary

roamio: a wellness-first travel companion that adapts your itinerary based on how you feel. Users can create trips and plan activities, while the app helps curate balanced day plans. During the trip, users check in with their energy level, and roamio adjusts the itinerary by suggesting nearby, lower-effort alternatives when needed. The app also provides location-based recommendations and community support options, helping travelers find places that meet their immediate needs. By continuously adapting to the user’s well-being, roamio transforms travel from a stressful race into a calm and personalized experience.

### Key features
- **Login / Signup**
  - Users sign in and their trips/itineraries/check-ins persist across sessions.
- **Trips**
  - Create/delete trips; store destination and date range.
- **Itinerary blocks**
  - Create/update/delete activity blocks (place name + time window).
- **Energy check-ins**
  - Record energy level (1–10) tied to the current activity block + timestamp + current lat/lng.
- **Rerouting suggestions (Agentic AI)**
  - When energy is low, generates several nearby alternatives that are “less energy intensive.”
  - Suggestions include context (“why this fits”), distance, and a Google Maps link.
- **Simplify day**
  - If check-ins show low average energy, roamio can recommend dropping the most energy-expensive blocks for the day.
- **Calendar export (ICS)**
  - Generate an `.ics` calendar file from your itinerary blocks.

---

## Technology Stack

### Languages
- **TypeScript**
- **JavaScript**

### Frameworks & libraries
- **Expo + React Native** (mobile app)
- **Node.js + Express** (backend service)
- **Supabase** (Postgres + Auth + storage of trips/blocks/check-ins)
- **Google Places API** (place search, details, photos)
- **Gemini API** (agent steps: place resolution, reroute classification, ranking suggestions)
- Expo libraries used by the mobile app (commonly):
  - location access (for nearby suggestions)
  - secure/persistent session storage (via AsyncStorage)

### Platforms / cloud services
- **Supabase Cloud** (database + auth)
- **Google APIs** (Places)
- **Gemini** (LLM)

### Tools
- Git + GitHub (collaboration/version control)
- Expo tooling (local development, simulator/device testing)
- Visual Studio Code / Antigravity

---

## Architecture / Small Directory

- `mobile/` — Expo React Native app
  - UI + local state store
  - calls backend endpoints when available
  - has fallbacks that can call Supabase / Google Places / Gemini directly in some flows

- `backend/` — Express API
  - authenticated routes for trip ops, check-ins, suggestions, and other helpers
  - uses Supabase as the system of record

---

## Data Model (Supabase)

Core tables:
- `trips`: `id`, `user_id`, `destination`, `start_date`, `end_date`, (optional) destination image
- `activity_blocks`: `id`, `trip_id`, `place_name`, `start_time`, `end_time`, plus resolved place fields (place id, lat/lng) and energy metadata
- `checkins`: `id`, `activity_block_id`, `user_id`, `energy_level (1–10)`, `timestamp`, plus (optional) outcome and selected place fields

---

## Getting Started (Local Development)

### 1) Prerequisites
- Node.js (LTS recommended)
- Expo CLI tooling (or run via `npx expo`)
- A Supabase project
- Google Places API key
- Gemini API key

### 2) Backend environment variables
Create `backend/.env`:

```env
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
GEMINI_API_KEY=YOUR_GEMINI_API_KEY
GOOGLE_PLACES_KEY=YOUR_GOOGLE_PLACES_KEY
GEMINI_MODEL=gemini-2.0-flash
PORT=4000
```

> Do **not** commit real keys. Use `.env` files locally and keep them in `.gitignore`.

### 3) Mobile environment variables
Create `mobile/.env`:

```env
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
EXPO_PUBLIC_GOOGLE_MAPS_KEY=YOUR_GOOGLE_PLACES_KEY
EXPO_PUBLIC_GEMINI_API_KEY=YOUR_GEMINI_API_KEY
```

### 4) Install dependencies

```bash
cd backend
npm install
cd ../mobile
npm install
```

### 5) Run the app

```bash
cd mobile
npx expo start
```

---

## AI Use (Hackathon survey)

**Was more than 70% of the code generated by AI?**  
**Yes :)**

---
