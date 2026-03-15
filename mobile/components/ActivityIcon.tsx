import { Feather } from '@expo/vector-icons';
import type { ActivityType } from '../types';

const iconMap: Record<ActivityType, React.ComponentProps<typeof Feather>['name']> = {
  hiking: 'trending-up',
  walking: 'navigation',
  cycling: 'wind',
  museum: 'home',
  gallery: 'image',
  landmark: 'map-pin',
  restaurant: 'coffee',
  cafe: 'coffee',
  shopping: 'shopping-bag',
  market: 'shopping-cart',
  spa: 'droplet',
  park: 'sun',
  beach: 'sunrise',
  mindful: 'heart',
  other: 'map-pin',
};

export function ActivityIcon({ type, size = 16, color = '#6B6B6B' }: { type: ActivityType; size?: number; color?: string }) {
  return <Feather name={iconMap[type] ?? 'map-pin'} size={size} color={color} />;
}
