# Integration Notes — Task 2 → App Merge

> For the teammate doing final integration after Tasks 1, 2, and 3 are all working.

## Where Each Function Should Be Called

### `resolvePlace(input, config)`
**Called during:** Trip itinerary input (Flow 1)
**Triggered by:** User finishes typing an activity's place name
**Caller file (future):** `mobile/lib/agent/resolve.ts` → called from the itinerary input screen

```
User types "Johnston Canyon" in the itinerary form
  → frontend calls resolvePlace({ place_name, destination }, geminiConfig)
  → returns { google_places_query, activity_type, energy_cost_estimate }
  → Task 3 uses google_places_query to fetch the real Google Places result
  → Task 1 stores resolved_place_id, activity_type, energy_cost_estimate in Supabase
```

### `classifyCheckIn(input, config)`
**Called during:** Check-in flow (Flow 2)
**Triggered by:** User taps "Check In" button and submits energy slider
**Caller file (future):** `mobile/lib/agent/classifier.ts` → called from the check-in screen

```
User submits energy_level via slider
  → frontend assembles IntentClassifierInput from:
      - energy_level (from slider — Task 3 UI)
      - current_time (Expo / Date.now())
      - current_block (from Supabase — Task 1)
      - remaining_blocks_today (from Supabase — Task 1)
      - prior_checkins_this_trip (from Supabase — Task 1)
  → calls classifyCheckIn(input, geminiConfig)
  → if needs_rerouting is true → proceed to rankAlternatives
  → if needs_rerouting is false → display affirmation_message
```

### `rankAlternatives(input, config)`
**Called during:** Check-in flow (Flow 2), only when rerouting is needed
**Triggered by:** classifyCheckIn returns `needs_rerouting: true`
**Caller file (future):** `mobile/lib/agent/ranker.ts` → called from the suggestion cards screen

```
classifyCheckIn said needs_rerouting: true
  → Task 3 fetches nearby Google Places candidates using Expo Location + Places API
  → frontend calls rankAlternatives({ candidates, energy_level, energy_gap, ... }, geminiConfig)
  → returns 3-5 ranked suggestions as swipeable cards
  → Task 1 stores the user's selected alternative in Supabase
```

---

## What Task 1 (Supabase / Auth / State) Must Provide

| Data | Type | Used By |
|---|---|---|
| Current user's trip | `Trip` row | All modules (destination) |
| Activity blocks for today | `ActivityBlock[]` | Classifier, Ranker |
| Prior check-ins this trip | `CheckIn[]` | Classifier |
| Gemini API key | `string` | All modules (via config) |

**Task 1 should also persist:**
- The `resolved_place_id` returned by Google Places after `resolvePlace` provides the query
- The `activity_type` and `energy_cost_estimate` from `resolvePlace`
- The new `CheckIn` row after the user submits the energy slider

---

## What Task 3 (Expo Location / Google Places / UI) Must Provide

| Data | Type | Used By |
|---|---|---|
| User's current GPS coordinates | `{ lat, lng }` | Google Places fetch (not this module) |
| Nearby place candidates | `NearbyPlaceCandidate[]` | Ranker |
| Energy slider value | `number` (1-10) | Classifier |
| Current time | `string` (ISO-8601) | Classifier |

**Task 3 is responsible for:**
- Fetching real Google Places results using queries from `resolvePlace`
- Fetching nearby candidates using Expo Location + Google Places API before calling `rankAlternatives`
- Rendering the check-in UI and suggestion cards

---

## Responsibility Boundaries

| Responsibility | Owner |
|---|---|
| Freeform text → Google Places search query | **Gemini (Task 2)** |
| Executing the Google Places search | **Task 3** |
| Deciding if rerouting is needed | **Gemini (Task 2)** |
| Fetching nearby place candidates | **Task 3** |
| Ranking/filtering candidates | **Gemini (Task 2)** |
| Storing results in the database | **Task 1** |
| Displaying UI and collecting user input | **Task 3** |

> **Key principle:** Gemini never invents locations. Location truth always comes from Google Places candidates provided by Task 3. Gemini only reasons over data it receives.

---

## API Key Configuration

During hackathon development, pass the Gemini API key directly:

```typescript
const config: GeminiConfig = { apiKey: "AIza..." };
```

For production, Task 1 should supply this from secure storage (Supabase secrets, Expo SecureStore, etc.). This module intentionally does not read environment variables.

---

## Relocation Checklist

When it's time to merge `_task2_ai/` into the app:

1. Copy `_task2_ai/*` → `mobile/lib/agent/` (or `frontend/lib/agent/`)
2. Update import paths in consuming screens/hooks
3. Wire `GeminiConfig.apiKey` from the app's secure env
4. Delete `_task2_ai/` from repo root
5. Remove `fixtures.ts` from production bundle (keep for tests)
