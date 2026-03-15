import { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Linking, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { C } from '../../lib/colors';
import { F } from '../../lib/fonts';
import {
  getCommunitySupportCategories,
  requestCommunitySupportPlaces,
} from '../../lib/backend';
import type {
  CommunityNeedCategory,
  CommunitySupportCategory,
  CommunitySupportPlace,
  CommunityFallbackResource,
} from '../../types';

const DEFAULT_CATEGORIES: CommunitySupportCategory[] = [
  {
    id: 'food_and_water',
    label: 'Food & Water',
    description: 'Find food and groceries nearby.',
    icon: 'coffee',
  },
  {
    id: 'medication',
    label: 'Medication',
    description: 'Find pharmacies and urgent medical support.',
    icon: 'plus-square',
  },
  {
    id: 'safe_rest',
    label: 'Safe Place to Rest',
    description: 'Find calmer spaces to recover.',
    icon: 'moon',
  },
  {
    id: 'mental_health',
    label: 'Mental Health Support',
    description: 'Find supportive services nearby.',
    icon: 'heart',
  },
  {
    id: 'transit_help',
    label: 'Transit Help',
    description: 'Find stations and transit support.',
    icon: 'navigation',
  },
];

function formatRating(place: CommunitySupportPlace): string {
  if (place.rating == null) return 'N/A';
  return `${place.rating.toFixed(1)}${place.user_rating_count ? ` (${place.user_rating_count})` : ''}`;
}

function openStatus(place: CommunitySupportPlace): string {
  if (place.open_now === true) return 'Open now';
  if (place.open_now === false) return 'Closed now';
  return 'Hours unknown';
}

export default function CommunitySupportScreen() {
  const [categories, setCategories] = useState<CommunitySupportCategory[]>(DEFAULT_CATEGORIES);
  const [selectedCategory, setSelectedCategory] = useState<CommunityNeedCategory>('food_and_water');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<CommunitySupportPlace[]>([]);
  const [resources, setResources] = useState<CommunityFallbackResource[]>([]);
  const [permissionState, setPermissionState] = useState<'unknown' | 'granted' | 'denied'>('unknown');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [error, setError] = useState('');
  const [impact, setImpact] = useState({
    requests: 0,
    placesFound: 0,
    mapsOpened: 0,
    fallbackShown: 0,
  });

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const response = await getCommunitySupportCategories();
        if (!active) return;
        if (Array.isArray(response?.categories) && response.categories.length > 0) {
          setCategories(response.categories);
        }
      } catch {
        // Keep local fallback categories.
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (!active) return;
        if (status !== 'granted') {
          setPermissionState('denied');
          return;
        }
        setPermissionState('granted');
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (!active) return;
        setCoords({ lat: location.coords.latitude, lng: location.coords.longitude });
      } catch {
        if (!active) return;
        setPermissionState('denied');
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const selectedCategoryDetails = useMemo(
    () => categories.find((c) => c.id === selectedCategory) || categories[0],
    [categories, selectedCategory]
  );

  async function handleFindSupport() {
    setError('');
    if (!coords) {
      setError('Location is required. Please enable location permission and try again.');
      return;
    }
    setLoading(true);
    try {
      const response = await requestCommunitySupportPlaces({
        need_category: selectedCategory,
        current_lat: coords.lat,
        current_lng: coords.lng,
      });
      setResults(response.results || []);
      setResources(response.fallback_resources || []);
      setImpact((prev) => ({
        requests: prev.requests + 1,
        placesFound: prev.placesFound + (response.results?.length || 0),
        mapsOpened: prev.mapsOpened,
        fallbackShown: prev.fallbackShown + ((response.results?.length || 0) === 0 ? 1 : 0),
      }));
    } catch (err: any) {
      setError(err?.message || 'Unable to find support places right now.');
      setResults([]);
      setResources([]);
    } finally {
      setLoading(false);
    }
  }

  async function openResource(item: CommunityFallbackResource) {
    try {
      await Linking.openURL(item.url);
    } catch {
      Alert.alert('Open failed', 'Could not open this resource link right now.');
    }
  }

  async function openMaps(place: CommunitySupportPlace) {
    try {
      await Linking.openURL(place.maps_url);
      setImpact((prev) => ({ ...prev, mapsOpened: prev.mapsOpened + 1 }));
    } catch {
      Alert.alert('Open failed', 'Could not open Maps right now.');
    }
  }

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <Text style={s.title}>Community Support</Text>
        <Text style={s.subtitle}>
          A separate support mode for essential needs, without changing your trip plan.
        </Text>

        <View style={s.impactCard}>
          <Text style={s.impactTitle}>Impact Snapshot</Text>
          <View style={s.impactRow}>
            <View style={s.impactStat}>
              <Text style={s.impactValue}>{impact.requests}</Text>
              <Text style={s.impactLabel}>Requests</Text>
            </View>
            <View style={s.impactStat}>
              <Text style={s.impactValue}>{impact.placesFound}</Text>
              <Text style={s.impactLabel}>Places Found</Text>
            </View>
            <View style={s.impactStat}>
              <Text style={s.impactValue}>{impact.mapsOpened}</Text>
              <Text style={s.impactLabel}>Maps Opened</Text>
            </View>
            <View style={s.impactStat}>
              <Text style={s.impactValue}>{impact.fallbackShown}</Text>
              <Text style={s.impactLabel}>Fallbacks</Text>
            </View>
          </View>
        </View>

        <Text style={s.sectionTitle}>What do you need right now?</Text>
        <View style={s.categoryList}>
          {categories.map((category) => {
            const active = category.id === selectedCategory;
            return (
              <Pressable
                key={category.id}
                style={[s.categoryCard, active && s.categoryCardActive]}
                onPress={() => setSelectedCategory(category.id)}
              >
                <View style={[s.iconWrap, active && s.iconWrapActive]}>
                  <Feather
                    name={(category.icon as any) || 'help-circle'}
                    size={18}
                    color={active ? C.sage : C.secondary}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.categoryTitle, active && s.categoryTitleActive]}>{category.label}</Text>
                  <Text style={s.categoryDesc}>{category.description}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        <View style={s.locationRow}>
          <Feather name="map-pin" size={14} color={C.secondary} />
          <Text style={s.locationText}>
            {permissionState === 'granted' && coords
              ? 'Location ready'
              : permissionState === 'denied'
                ? 'Location denied'
                : 'Requesting location'}
          </Text>
        </View>

        {error ? <Text style={s.error}>{error}</Text> : null}

        <Pressable style={[s.findBtn, loading && s.findBtnDisabled]} onPress={handleFindSupport} disabled={loading}>
          {loading ? (
            <ActivityIndicator size="small" color={C.white} />
          ) : (
            <Feather name="search" size={16} color={C.white} />
          )}
          <Text style={s.findBtnText}>
            {loading
              ? 'Finding support...'
              : `Find ${selectedCategoryDetails?.label || 'support'} nearby`}
          </Text>
        </Pressable>

        {results.length > 0 && (
          <>
            <Text style={s.sectionTitle}>Nearby Options</Text>
            <View style={s.resultsList}>
              {results.map((place) => (
                <View key={place.place_id} style={s.placeCard}>
                  <View style={s.placeTop}>
                    <Text style={s.placeName}>{place.place_name}</Text>
                    <Text style={s.distance}>{place.distance_km} km</Text>
                  </View>
                  <Text style={s.placeAddress}>{place.address || 'Address unavailable'}</Text>
                  <View style={s.metaRow}>
                    <View style={s.metaPill}>
                      <Feather name="star" size={12} color={C.secondary} />
                      <Text style={s.metaText}>{formatRating(place)}</Text>
                    </View>
                    <View style={s.metaPill}>
                      <Feather name="clock" size={12} color={C.secondary} />
                      <Text style={s.metaText}>{openStatus(place)}</Text>
                    </View>
                  </View>
                  {place.matched_tags.length > 0 && (
                    <View style={s.tagsRow}>
                      {place.matched_tags.slice(0, 3).map((tag) => (
                        <View key={`${place.place_id}-${tag}`} style={s.tag}>
                          <Text style={s.tagText}>{tag.replace(/_/g, ' ')}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                  <Pressable style={s.mapsBtn} onPress={() => openMaps(place)}>
                    <Feather name="external-link" size={14} color={C.white} />
                    <Text style={s.mapsBtnText}>Open in Maps</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          </>
        )}

        {results.length === 0 && resources.length > 0 && (
          <>
            <View style={s.emptyCard}>
              <Feather name="shield" size={24} color={C.secondary} />
              <Text style={s.emptyTitle}>No nearby matches found</Text>
              <Text style={s.emptyText}>
                Here are trusted fallback resources so support is still one tap away.
              </Text>
            </View>
            <View style={s.resultsList}>
              {resources.map((resource) => (
                <Pressable key={`${resource.name}-${resource.contact}`} style={s.resourceCard} onPress={() => openResource(resource)}>
                  <View style={s.placeTop}>
                    <Text style={s.placeName}>{resource.name}</Text>
                    <Text style={s.resourceType}>{resource.type}</Text>
                  </View>
                  <Text style={s.placeAddress}>{resource.description}</Text>
                  <View style={s.metaRow}>
                    <View style={s.metaPill}>
                      <Feather name={resource.type === 'phone' ? 'phone' : 'globe'} size={12} color={C.secondary} />
                      <Text style={s.metaText}>{resource.contact}</Text>
                    </View>
                  </View>
                </Pressable>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 120 },
  title: { fontSize: 30, fontFamily: F.bold, color: C.fg, letterSpacing: -0.5 },
  subtitle: { fontSize: 13, fontFamily: F.regular, color: C.secondary, marginTop: 6, marginBottom: 18 },

  impactCard: {
    backgroundColor: C.white,
    borderRadius: 18,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
    marginBottom: 20,
  },
  impactTitle: { fontSize: 14, fontFamily: F.bold, color: C.fg, marginBottom: 10 },
  impactRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  impactStat: { alignItems: 'center', flex: 1 },
  impactValue: { fontSize: 20, fontFamily: F.bold, color: C.sageDark },
  impactLabel: { fontSize: 11, fontFamily: F.medium, color: C.placeholder, marginTop: 2 },

  sectionTitle: { fontSize: 17, fontFamily: F.bold, color: C.fg, marginBottom: 12 },
  categoryList: { gap: 10, marginBottom: 12 },
  categoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: C.white,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1.5,
    borderColor: C.border,
  },
  categoryCardActive: { borderColor: C.sage },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: C.cardBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapActive: { backgroundColor: `${C.sage}20` },
  categoryTitle: { fontSize: 14, fontFamily: F.bold, color: C.fg },
  categoryTitleActive: { color: C.sageDark },
  categoryDesc: { fontSize: 12, fontFamily: F.regular, color: C.secondary, marginTop: 2 },

  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  locationText: { fontSize: 12, fontFamily: F.medium, color: C.secondary },
  error: { fontSize: 12, fontFamily: F.medium, color: C.eLowText, marginBottom: 10 },

  findBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: C.charcoal,
    borderRadius: 999,
    paddingVertical: 14,
    marginBottom: 18,
  },
  findBtnDisabled: { opacity: 0.8 },
  findBtnText: { color: C.white, fontSize: 14, fontFamily: F.semiBold },

  resultsList: { gap: 12, marginBottom: 8 },
  placeCard: {
    backgroundColor: C.white,
    borderRadius: 16,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 1,
  },
  placeTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  placeName: { fontSize: 15, fontFamily: F.bold, color: C.fg, flex: 1 },
  distance: { fontSize: 12, fontFamily: F.semiBold, color: C.sageDark },
  placeAddress: { fontSize: 12, fontFamily: F.regular, color: C.secondary, marginTop: 6 },

  metaRow: { flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: C.cardBg,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  metaText: { fontSize: 11, fontFamily: F.medium, color: C.secondary },

  tagsRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 10 },
  tag: { backgroundColor: `${C.sage}1A`, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  tagText: { fontSize: 10, fontFamily: F.medium, color: C.sageDark },

  mapsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: C.charcoal,
    borderRadius: 999,
    paddingVertical: 10,
    marginTop: 12,
  },
  mapsBtnText: { fontSize: 12, fontFamily: F.semiBold, color: C.white },

  emptyCard: {
    backgroundColor: C.white,
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    marginBottom: 12,
  },
  emptyTitle: { fontSize: 16, fontFamily: F.bold, color: C.fg, marginTop: 10, marginBottom: 4 },
  emptyText: { fontSize: 12, fontFamily: F.regular, color: C.secondary, textAlign: 'center' },

  resourceCard: {
    backgroundColor: C.white,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: C.border,
  },
  resourceType: {
    fontSize: 11,
    fontFamily: F.bold,
    color: C.placeholder,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
});
