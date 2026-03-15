import type { ActivityType } from '../types';

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function getDayCount(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
}

export function formatTimeRange(start: string, end: string): string {
  const fmt = (value: string) => {
    const minutes = toClockMinutes(value);
    if (minutes == null) return value;

    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    const ampm = hours >= 12 ? 'pm' : 'am';
    const h12 = hours % 12 || 12;
    return mins === 0 ? `${h12}${ampm}` : `${h12}:${String(mins).padStart(2, '0')}${ampm}`;
  };

  return `${fmt(start)} - ${fmt(end)}`;
}

export function getEnergyColor(cost: number): { bg: string; text: string } {
  if (cost <= 3) return { bg: '#e8ede4', text: '#5a6b4e' };
  if (cost <= 6) return { bg: '#f5edd4', text: '#8a7340' };
  return { bg: '#f5ddd4', text: '#8a4a40' };
}

export function getEnergyLabel(cost: number): string {
  if (cost <= 3) return 'Low';
  if (cost <= 6) return 'Medium';
  return 'High';
}

export function isBlockActive(startTime: string, endTime: string, currentMinutes: number): boolean {
  const startMinutes = toClockMinutes(startTime);
  const endMinutes = toClockMinutes(endTime);
  if (startMinutes == null || endMinutes == null) return false;
  return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
}

function toClockMinutes(value: string): number | null {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;

  const hhmmMatch = raw.match(/^(\d{1,2}):(\d{2})/);
  if (hhmmMatch) {
    const h = Number(hhmmMatch[1]);
    const m = Number(hhmmMatch[2]);
    if (Number.isNaN(h) || Number.isNaN(m)) return null;
    if (h < 0 || h > 23 || m < 0 || m > 59) return null;
    return h * 60 + m;
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.getHours() * 60 + parsed.getMinutes();
}

export const DEMO_CURRENT_MINUTES = 15 * 60 + 45;
export const DEMO_CURRENT_DAY = 0;
