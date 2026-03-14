// ─── Public API for _task2_ai module ───

// Types
export type {
  ActivityType,
  GeminiConfig,
  PlaceResolverInput,
  PlaceResolverOutput,
  ActivityBlock,
  PriorCheckIn,
  IntentClassifierInput,
  IntentClassifierOutput,
  NearbyPlaceCandidate,
  RankedSuggestion,
  AlternativeRankerInput,
  AlternativeRankerOutput,
} from "./types";

export { GeminiClientError, ValidationError } from "./types";

// Core modules
export { resolvePlace } from "./resolve";
export { classifyCheckIn } from "./classifier";
export { rankAlternatives } from "./ranker";

// Fixtures (for teammate integration testing)
export {
  FIXTURE_PLACE_RESOLVER_INPUT,
  FIXTURE_PLACE_RESOLVER_OUTPUT,
  FIXTURE_CLASSIFIER_LOW_ENERGY_INPUT,
  FIXTURE_CLASSIFIER_LOW_ENERGY_OUTPUT,
  FIXTURE_CLASSIFIER_HIGH_ENERGY_INPUT,
  FIXTURE_CLASSIFIER_HIGH_ENERGY_OUTPUT,
  FIXTURE_RANKER_CANDIDATES,
  FIXTURE_RANKER_INPUT,
  FIXTURE_RANKER_OUTPUT,
} from "./fixtures";
