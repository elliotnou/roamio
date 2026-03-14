# `_task2_ai/` — Gemini AI Logic Layer

> **Hackathon module – Task 2**
> Standalone TypeScript AI logic for the Roamio wellness travel app.

## What This Is

This folder contains three AI-powered modules that use Google Gemini to help travellers manage their energy during trips. It is **intentionally isolated** from the rest of the codebase so it can be developed in parallel without merge conflicts.

- **No React Native imports**
- **No Supabase imports**
- **No Expo imports**
- Pure TypeScript, `fetch`-only

## Modules

| File | What It Does |
|---|---|
| `resolve.ts` | **Place Resolver** — takes a freeform place name + destination and returns a Google Places query, activity type, and energy estimate |
| `classifier.ts` | **Intent Classifier** — takes the user's energy level and remaining itinerary, decides if rerouting is needed or returns an affirmation |
| `ranker.ts` | **Alternative Ranker** — ranks 3-5 lower-energy alternatives from pre-fetched Google Places candidates |

## Supporting Files

| File | Purpose |
|---|---|
| `types.ts` | All shared TypeScript interfaces and error classes |
| `prompts.ts` | Prompt-builder functions for each Gemini call |
| `gemini-client.ts` | Minimal Gemini REST client using native `fetch` |
| `validate.ts` | Runtime output validators (type-check + anti-hallucination checks) |
| `fixtures.ts` | Realistic mock inputs/outputs for Banff-themed test cases |
| `index.ts` | Barrel re-exports for the public API |

## Isolation from Task 1 & Task 3

| Concern | Owner | This module's boundary |
|---|---|---|
| Auth, Users, DB | **Task 1** | Does NOT import Supabase or manage users |
| Expo Location, Google Places fetch, check-in UI | **Task 3** | Does NOT call device APIs or render UI |
| Gemini prompts, classification, ranking logic | **Task 2 (this)** | Receives typed inputs, returns typed outputs |

## Where This Code Should Eventually Move

When the team is ready for integration:

```
_task2_ai/  →  mobile/lib/agent/   (or frontend/lib/agent/)
```

All imports are relative, so relocation requires minimal changes — just update the import paths in the consuming code.

## Quick Usage

```typescript
import { resolvePlace, classifyCheckIn, rankAlternatives } from "./_task2_ai";

const config = { apiKey: "YOUR_GEMINI_KEY" };

// 1. Resolve a place
const place = await resolvePlace(
  { place_name: "Johnston Canyon", destination: "Banff, Alberta, Canada" },
  config
);

// 2. Classify a check-in
const intent = await classifyCheckIn({ energy_level: 4, ... }, config);

// 3. Rank alternatives (only when rerouting)
if (intent.needs_rerouting) {
  const ranked = await rankAlternatives({ candidates: [...], ... }, config);
}
```
