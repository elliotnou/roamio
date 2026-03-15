import type { ActivityBlock, Trip } from '../types';

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function toIcsDateTime(value: Date): string {
  return `${value.getUTCFullYear()}${pad(value.getUTCMonth() + 1)}${pad(value.getUTCDate())}T${pad(value.getUTCHours())}${pad(value.getUTCMinutes())}${pad(value.getUTCSeconds())}Z`;
}

function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

function getTripDayDate(tripStartDate: string, dayIndex: number): string {
  const date = new Date(`${tripStartDate}T00:00:00`);
  date.setDate(date.getDate() + dayIndex);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function resolveBlockDateTime(tripStartDate: string, dayIndex: number, source: string): Date | null {
  const direct = new Date(source);
  if (!Number.isNaN(direct.getTime())) return direct;

  const match = source.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;

  const day = getTripDayDate(tripStartDate, dayIndex);
  return new Date(`${day}T${pad(hours)}:${pad(minutes)}:00`);
}

export function buildTripCalendarIcs(trip: Trip, blocks: ActivityBlock[]): string {
  const now = toIcsDateTime(new Date());
  const header = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'CALSCALE:GREGORIAN',
    'PRODID:-//Roamio//Trip Itinerary//EN',
    'METHOD:PUBLISH',
  ];

  const sortedBlocks = [...blocks].sort((a, b) => {
    if (a.day_index !== b.day_index) return a.day_index - b.day_index;
    return a.start_time.localeCompare(b.start_time);
  });

  const eventLines: string[] = [];
  for (const block of sortedBlocks) {
    const start = resolveBlockDateTime(trip.start_date, block.day_index, block.start_time);
    const end = resolveBlockDateTime(trip.start_date, block.day_index, block.end_time);
    if (!start || !end) continue;

    const summary = escapeIcsText(block.place_name || 'Activity');
    const location = escapeIcsText(block.resolved_place_name || block.place_name || trip.destination);
    const descriptionParts = [
      `Trip: ${trip.destination}`,
      `Day ${block.day_index + 1}`,
      block.activity_type ? `Type: ${block.activity_type}` : null,
      block.energy_cost_estimate != null ? `Energy: ${block.energy_cost_estimate}/10` : null,
    ].filter(Boolean) as string[];

    eventLines.push(
      'BEGIN:VEVENT',
      `UID:${block.id}@roamio.app`,
      `DTSTAMP:${now}`,
      `DTSTART:${toIcsDateTime(start)}`,
      `DTEND:${toIcsDateTime(end)}`,
      `SUMMARY:${summary}`,
      `LOCATION:${location}`,
      `DESCRIPTION:${escapeIcsText(descriptionParts.join(' | '))}`,
      'END:VEVENT',
    );
  }

  const footer = ['END:VCALENDAR'];
  return [...header, ...eventLines, ...footer].join('\r\n');
}
