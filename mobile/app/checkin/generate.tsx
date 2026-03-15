import React, { useState } from 'react';
import {
  View, Text, Pressable, StyleSheet, ActivityIndicator,
  Dimensions, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTripStore } from '../../store/trip-store';
import { C } from '../../lib/colors';
import { F } from '../../lib/fonts';

type Pace = 'light' | 'balanced' | 'packed';

const PACE_OPTIONS: { id: Pace; label: string; icon: React.ComponentProps<typeof Feather>['name']; desc: string }[] = [
  { id: 'light', label: 'Light', icon: 'sun', desc: '2-3 activities, lots of breathing room' },
  { id: 'balanced', label: 'Balanced', icon: 'sliders', desc: '3-5 activities, a good mix with breaks' },
  { id: 'packed', label: 'Packed', icon: 'zap', desc: '5-7 activities, see it all' },
];

export default function GenerateScreen() {
  const router = useRouter();
  const { tripId, dayIndex: dayIndexParam } = useLocalSearchParams<{ tripId: string; dayIndex?: string }>();
  const dayIndex = Number(dayIndexParam ?? 0);
  const { generateCuratedItinerary, activeTrip } = useTripStore();

  const [pace, setPace] = useState<Pace>('balanced');
  const [generating, setGenerating] = useState(false);
  const [done, setDone] = useState(false);
  const [resultCount, setResultCount] = useState(0);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const result = await generateCuratedItinerary(tripId, {
        replaceExisting: false,
        pace,
        dayIndex,
      });
      setResultCount(result?.length ?? 0);
      setDone(true);
    } catch (err: any) {
      Alert.alert('Generation failed', String(err?.message ?? err));
    } finally {
      setGenerating(false);
    }
  };

  if (generating) {
    return (
      <View style={s.loadingWrap}>
        <LinearGradient colors={[C.sage, C.sageDark]} style={StyleSheet.absoluteFillObject} />
        <LinearGradient colors={['rgba(0,0,0,0.1)', 'rgba(0,0,0,0.5)']} style={StyleSheet.absoluteFillObject} />
        <View style={s.loadingContent}>
          <Feather name="map" size={48} color={C.white} />
          <Text style={s.loadingTitle}>Gemini is building your plan</Text>
          <Text style={s.loadingSub}>
            Finding real places, scheduling meals, pacing your energy...
          </Text>
          <ActivityIndicator color={C.white} style={{ marginTop: 24 }} />
        </View>
      </View>
    );
  }

  if (done) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.doneWrap}>
          <View style={s.doneCircle}>
            <Feather name="map" size={32} color={C.white} />
          </View>
          <Text style={s.doneTitle}>Plan generated</Text>
          <Text style={s.doneSub}>
            {resultCount} activities added to your trip. Go explore!
          </Text>
          <Pressable style={s.doneBtn} onPress={() => router.replace(`/trips/${tripId}` as never)}>
            <Text style={s.doneBtnText}>View itinerary</Text>
            <Feather name="arrow-right" size={16} color={C.white} />
          </Pressable>
          <Pressable style={s.backBtn} onPress={() => router.replace('/(tabs)' as never)}>
            <Text style={s.backBtnText}>Back to today</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.container}>
        {/* Header */}
        <View style={s.topBar}>
          <Pressable onPress={() => router.back()} style={s.closeBtn}>
            <Feather name="x" size={20} color={C.secondary} />
          </Pressable>
        </View>

        <Text style={s.title}>Generate Day {dayIndex + 1}</Text>
        <Text style={s.subtitle}>
          Gemini will fill your day in{' '}
          {activeTrip?.destination ?? 'your trip'} with meals, sights, and smart pacing.
        </Text>

        {/* Pace picker */}
        <Text style={s.sectionLabel}>HOW PACKED?</Text>
        <View style={s.paceList}>
          {PACE_OPTIONS.map((opt) => {
            const active = pace === opt.id;
            return (
              <Pressable
                key={opt.id}
                style={[s.paceCard, active && s.paceCardActive]}
                onPress={() => setPace(opt.id)}
              >
                <View style={[s.paceIconWrap, active && s.paceIconWrapActive]}>
                  <Feather name={opt.icon} size={18} color={active ? C.white : C.secondary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.paceLabel, active && s.paceLabelActive]}>{opt.label}</Text>
                  <Text style={s.paceDesc}>{opt.desc}</Text>
                </View>
                {active && (
                  <View style={s.paceCheck}>
                    <Feather name="check" size={14} color={C.white} />
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>

        {/* Generate CTA */}
        <Pressable style={s.generateBtn} onPress={handleGenerate}>
          <Feather name="zap" size={16} color={C.white} />
          <Text style={s.generateBtnText}>Generate with Gemini</Text>
        </Pressable>

        <Text style={s.footnote}>
          Uses real Google Places locations. Activities are added to your trip — nothing is deleted.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  container: { flex: 1, paddingHorizontal: 20 },

  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', minHeight: Dimensions.get('window').height },
  loadingContent: { alignItems: 'center', paddingHorizontal: 40 },
  loadingSparkle: { fontSize: 48, color: C.white, marginBottom: 20 },
  loadingTitle: { fontSize: 22, fontFamily: F.bold, color: C.white, textAlign: 'center', marginBottom: 10 },
  loadingSub: { fontSize: 15, fontFamily: F.regular, color: 'rgba(255,255,255,0.75)', textAlign: 'center' },

  topBar: { paddingTop: 8, paddingBottom: 4, alignItems: 'flex-end' },
  closeBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.white, justifyContent: 'center', alignItems: 'center' },

  title: { fontSize: 26, fontFamily: F.bold, color: C.fg, marginBottom: 8 },
  subtitle: { fontSize: 14, fontFamily: F.regular, color: C.secondary, lineHeight: 20, marginBottom: 28 },

  sectionLabel: { fontSize: 10, fontFamily: F.bold, color: C.placeholder, letterSpacing: 1.5, marginBottom: 12 },

  paceList: { gap: 10, marginBottom: 32 },
  paceCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: C.white, borderRadius: 16, padding: 16,
    borderWidth: 2, borderColor: C.border,
  },
  paceCardActive: { borderColor: C.sage, backgroundColor: '#f5f9f2' },
  paceIconWrap: { width: 36, height: 36, borderRadius: 12, backgroundColor: C.cardBg, justifyContent: 'center', alignItems: 'center' },
  paceIconWrapActive: { backgroundColor: C.sage },
  paceLabel: { fontSize: 15, fontFamily: F.bold, color: C.fg },
  paceLabelActive: { color: C.sageDark },
  paceDesc: { fontSize: 12, fontFamily: F.regular, color: C.secondary, marginTop: 2 },
  paceCheck: { width: 24, height: 24, borderRadius: 12, backgroundColor: C.sage, justifyContent: 'center', alignItems: 'center' },

  generateBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: C.charcoal, borderRadius: 999, paddingVertical: 16,
  },
  generateIcon: { fontSize: 16, color: C.white },
  generateBtnText: { color: C.white, fontSize: 16, fontFamily: F.semiBold },

  footnote: { fontSize: 11, fontFamily: F.regular, color: C.placeholder, textAlign: 'center', marginTop: 14, lineHeight: 16 },

  doneWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
  doneCircle: { width: 72, height: 72, borderRadius: 36, backgroundColor: C.sage, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  doneTitle: { fontSize: 24, fontFamily: F.bold, color: C.fg, marginBottom: 8 },
  doneSub: { fontSize: 15, fontFamily: F.regular, color: C.secondary, textAlign: 'center', marginBottom: 32 },
  doneBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: C.charcoal, borderRadius: 999, paddingVertical: 14, paddingHorizontal: 28, marginBottom: 12,
  },
  doneBtnText: { color: C.white, fontSize: 15, fontFamily: F.semiBold },
  backBtn: { paddingVertical: 10 },
  backBtnText: { fontSize: 14, fontFamily: F.medium, color: C.placeholder },
});
