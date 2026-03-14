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
  const fmt = (t: string) => {
    const [hStr, mStr] = t.split(':');
    const h = parseInt(hStr, 10);
    const m = mStr;
    const ampm = h >= 12 ? 'pm' : 'am';
    const h12 = h % 12 || 12;
    return m === '00' ? `${h12}${ampm}` : `${h12}:${m}${ampm}`;
  };
  return `${fmt(start)} – ${fmt(end)}`;
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
  const toMin = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };
  return currentMinutes >= toMin(startTime) && currentMinutes <= toMin(endTime);
}

export const DEMO_CURRENT_MINUTES = 15 * 60 + 45;
export const DEMO_CURRENT_DAY = 0;
