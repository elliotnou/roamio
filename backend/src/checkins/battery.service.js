/**
 * Battery computation service placeholder.
 *
 * What this file should do:
 * 1. Compute passive battery drain from activity energy_cost_estimate.
 * 2. Correct curve at manual slider check-in points.
 * 3. Generate day time-series array for graph rendering.
 * 4. Return normalized values in range 0 to 100.
 */
export class BatteryServicePlaceholder {}
function toPercentFromEnergy(energyLevel) {
  const clamped = Math.max(1, Math.min(10, Number(energyLevel || 1)));
  return Math.round((clamped / 10) * 100);
}

export async function buildBatteryCurve(_userId, _activityBlockId, energyLevel) {
  // Placeholder time-series curve with manual check-in correction point.
  const now = Date.now();
  const corrected = toPercentFromEnergy(energyLevel);

  return [
    { t: new Date(now - 60 * 60 * 1000).toISOString(), value: Math.max(corrected - 10, 0) },
    { t: new Date(now).toISOString(), value: corrected },
    { t: new Date(now + 60 * 60 * 1000).toISOString(), value: Math.max(corrected - 8, 0) }
  ];
}
