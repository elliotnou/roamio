import { useState, useEffect, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, Dimensions, PanResponder, Animated, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useTripStore } from '../../store/trip-store';
import { C } from '../../lib/colors';
import { F } from '../../lib/fonts';

const SLIDER_W = Dimensions.get('window').width - 80;
const ENERGY_COLORS = ['#c47a6e', '#c47a6e', '#c47a6e', '#b8a06a', '#b8a06a', '#a8b89a', '#a8b89a', C.sage, C.sage, C.sage];

function getEnergyColor(level: number): string {
  return ENERGY_COLORS[Math.max(0, Math.min(9, level - 1))];
}
function getEnergyLabel(level: number): string {
  if (level <= 2) return 'Very Low';
  if (level <= 4) return 'Low';
  if (level <= 6) return 'Moderate';
  if (level <= 8) return 'Good';
  return 'Energized';
}
function getEnergyIcon(level: number): React.ComponentProps<typeof Feather>['name'] {
  if (level <= 3) return 'moon';
  if (level <= 5) return 'cloud';
  if (level <= 7) return 'sun';
  return 'zap';
}

export default function CheckInScreen() {
  const router = useRouter();
  const { blockId } = useLocalSearchParams<{ blockId: string }>();
  const { activityBlocks, startCheckIn } = useTripStore();

  const [energyLevel, setEnergyLevel] = useState(5);
  const [submitted, setSubmitted] = useState(false);
  const [affirmationMessage, setAffirmationMessage] = useState("You're all set.");
  const [submitting, setSubmitting] = useState(false);
  const [currentCoords, setCurrentCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [error, setError] = useState('');

  const posAnim = useRef(new Animated.Value((5 / 10) * SLIDER_W)).current;
  const fillWidth = posAnim;
  const thumbBorderColor = posAnim.interpolate({
    inputRange: [0, SLIDER_W * 0.3, SLIDER_W * 0.5, SLIDER_W * 0.8, SLIDER_W],
    outputRange: ['#c47a6e', '#c47a6e', '#b8a06a', '#a8b89a', C.sage],
    extrapolate: 'clamp',
  });
  const fillColor = posAnim.interpolate({
    inputRange: [0, SLIDER_W * 0.3, SLIDER_W * 0.5, SLIDER_W * 0.8, SLIDER_W],
    outputRange: ['#c47a6e', '#c47a6e', '#b8a06a', '#a8b89a', C.sage],
    extrapolate: 'clamp',
  });
  const levelRef = useRef(5);

  useEffect(() => {
    const id = posAnim.addListener(({ value }) => {
      const level = Math.max(1, Math.min(10, Math.round((value / SLIDER_W) * 10)));
      if (level !== levelRef.current) {
        levelRef.current = level;
        setEnergyLevel(level);
      }
    });
    return () => posAnim.removeListener(id);
  }, [posAnim]);

  useEffect(() => {
    let cancelled = false;
    const loadLocation = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (!cancelled) setCurrentCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      } catch {}
    };
    loadLocation();
    return () => { cancelled = true; };
  }, []);

  const block = Object.values(activityBlocks).flat().find((b) => b.id === blockId);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const x = Math.max(0, Math.min(evt.nativeEvent.locationX, SLIDER_W));
        posAnim.setValue(x);
      },
      onPanResponderMove: (evt) => {
        const x = Math.max(0, Math.min(evt.nativeEvent.locationX, SLIDER_W));
        posAnim.setValue(x);
      },
      onPanResponderRelease: () => {
        const snapped = (levelRef.current / 10) * SLIDER_W;
        Animated.spring(posAnim, { toValue: snapped, useNativeDriver: false, speed: 40, bounciness: 6 }).start();
      },
    })
  ).current;

  const handleSubmit = async () => {
    if (!block || submitting) return;
    setSubmitting(true);
    setError('');

    const lat = currentCoords?.lat ?? block.resolved_lat ?? 51.1784;
    const lng = currentCoords?.lng ?? block.resolved_lng ?? -115.5708;

    const result = await startCheckIn({ activityBlock: block, energyLevel, currentLat: lat, currentLng: lng });
    setSubmitting(false);

    if (result.needs_rerouting) {
      router.replace(`/checkin/suggestions?blockId=${blockId}` as never);
      return;
    }
    if (result.affirmation_message) {
      setAffirmationMessage(result.affirmation_message);
      setSubmitted(true);
      return;
    }
    setError('Unable to complete check-in right now.');
  };

  const color = getEnergyColor(energyLevel);

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView scrollEnabled={false} contentContainerStyle={{ flex: 1 }} keyboardShouldPersistTaps="handled">
        <View style={s.topBar}>
          <Pressable onPress={() => router.back()} style={s.closeBtn}>
            <Feather name="x" size={20} color={C.secondary} />
          </Pressable>
          <View style={{ width: 40 }} />
        </View>

        <View style={s.center}>
          {submitted ? (
            <View style={s.successWrap}>
              <View style={[s.successIcon, { backgroundColor: color }]}>
                <Feather name="check" size={32} color={C.white} />
              </View>
              <Text style={s.successTitle}>You're all set</Text>
              <Text style={s.successSub}>{affirmationMessage}</Text>
            </View>
          ) : (
            <>
              <View style={s.activityCard}>
                <Text style={s.activityLabel}>CHECKING IN</Text>
                <Text style={s.activityName}>{block?.place_name ?? 'Your Activity'}</Text>
              </View>

              <Text style={s.question}>How's your energy right now?</Text>

              <View style={[s.energyIndicator, { backgroundColor: color + '15' }]}>
                <Feather name={getEnergyIcon(energyLevel)} size={24} color={color} />
                <Text style={[s.energyLabel2, { color }]}>{getEnergyLabel(energyLevel)}</Text>
                <Text style={[s.energyNum, { color }]}>{energyLevel}</Text>
              </View>

              <View style={s.sliderWrap}>
                <View style={s.sliderTrack} {...panResponder.panHandlers}>
                  <Animated.View style={[s.sliderFill, { width: fillWidth, backgroundColor: fillColor }]} pointerEvents="none" />
                  <Animated.View
                    style={[s.sliderThumb, { transform: [{ translateX: Animated.add(posAnim, new Animated.Value(-14)) }], borderColor: thumbBorderColor }]}
                    pointerEvents="none"
                  />
                </View>
                <View style={s.sliderLabels}>
                  <Text style={s.sliderLabelText}>Low energy</Text>
                  <Text style={s.sliderLabelText}>High energy</Text>
                </View>
              </View>

              {error ? <Text style={s.errorText}>{error}</Text> : null}

              <Pressable
                style={[s.submitBtn, { backgroundColor: color }, submitting && s.submitBtnDisabled]}
                onPress={handleSubmit}
                disabled={submitting}
              >
                <Feather name="check-circle" size={16} color={C.white} />
                <Text style={s.submitBtnText}>
                  {submitting ? 'Checking in...' : energyLevel <= 6 ? 'Find gentler alternatives' : 'Check in'}
                </Text>
              </Pressable>

              <Pressable onPress={() => router.back()} style={s.cancelBtn}>
                <Text style={s.cancelText}>Not now</Text>
              </Pressable>
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.white },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 8 },
  closeBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.bg, justifyContent: 'center', alignItems: 'center' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40, minHeight: Dimensions.get('window').height - 120 },

  activityCard: { width: '100%', backgroundColor: C.bg, borderRadius: 16, paddingHorizontal: 20, paddingVertical: 16, alignItems: 'center', marginBottom: 32 },
  activityLabel: { fontSize: 10, fontFamily: F.semiBold, color: C.placeholder, letterSpacing: 1.5, marginBottom: 6 },
  activityName: { fontSize: 18, fontFamily: F.bold, color: C.fg, textAlign: 'center' },

  question: { fontSize: 16, fontFamily: F.medium, color: C.secondary, marginBottom: 28 },

  energyIndicator: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 999, marginBottom: 32 },
  energyLabel2: { fontSize: 16, fontFamily: F.semiBold },
  energyNum: { fontSize: 16, fontFamily: F.bold, marginLeft: 2 },

  sliderWrap: { width: SLIDER_W, marginBottom: 40 },
  sliderTrack: { height: 10, backgroundColor: C.cardBg, borderRadius: 5, position: 'relative', overflow: 'visible' },
  sliderFill: { position: 'absolute', left: 0, top: 0, height: 10, borderRadius: 5 },
  sliderThumb: {
    position: 'absolute', top: -11, width: 32, height: 32, borderRadius: 16,
    backgroundColor: C.white, borderWidth: 3,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.18, shadowRadius: 6, elevation: 6,
  },
  sliderLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 14 },
  sliderLabelText: { fontSize: 12, fontFamily: F.medium, color: C.placeholder },

  submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, width: '100%', borderRadius: 999, paddingVertical: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8 },
  submitBtnText: { color: C.white, fontSize: 16, fontFamily: F.bold },
  submitBtnDisabled: { opacity: 0.75 },
  errorText: { color: C.eLowText, fontSize: 13, fontFamily: F.regular, marginBottom: 12, textAlign: 'center' },

  cancelBtn: { marginTop: 16 },
  cancelText: { fontSize: 14, fontFamily: F.medium, color: C.placeholder },

  successWrap: { alignItems: 'center' },
  successIcon: { width: 72, height: 72, borderRadius: 36, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  successTitle: { fontSize: 24, fontFamily: F.bold, color: C.fg, marginBottom: 8 },
  successSub: { fontSize: 16, fontFamily: F.regular, color: C.secondary },
});
