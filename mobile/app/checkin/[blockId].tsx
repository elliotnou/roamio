import { useState, useEffect, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, Dimensions, PanResponder, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTripStore } from '../../store/trip-store';
import { C } from '../../lib/colors';
import { F } from '../../lib/fonts';

const SLIDER_W = Dimensions.get('window').width - 80;

function getEnergyColor(level: number): string {
  if (level <= 3) return '#c47a6e';
  if (level <= 5) return '#b8a06a';
  if (level <= 7) return '#a8b89a';
  return C.sage;
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
  const { activityBlocks, submitCheckIn, user } = useTripStore();

  const [energyLevel, setEnergyLevel] = useState(5);
  const [submitted, setSubmitted] = useState(false);
  const [sliderX] = useState(new Animated.Value((5 / 10) * SLIDER_W));
  const energyRef = useRef(5);

  const block = Object.values(activityBlocks).flat().find((b) => b.id === blockId);

  useEffect(() => {
    if (submitted) {
      const timer = setTimeout(() => router.replace('/(tabs)'), 2000);
      return () => clearTimeout(timer);
    }
  }, [submitted, router]);

  const updateSlider = (x: number) => {
    const clamped = Math.max(0, Math.min(x, SLIDER_W));
    const level = Math.max(1, Math.min(10, Math.round((clamped / SLIDER_W) * 10)));
    energyRef.current = level;
    sliderX.setValue(clamped);
  };

  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (evt) => updateSlider(evt.nativeEvent.locationX),
    onPanResponderMove: (evt) => updateSlider(evt.nativeEvent.locationX),
    onPanResponderRelease: () => setEnergyLevel(energyRef.current),
  })).current;

  const handleSubmit = async () => {
    if (block) {
      await submitCheckIn({
        activity_block_id: block.id,
        user_id: user?.id || '',
        energy_level: energyLevel,
        current_lat: block.resolved_lat ?? 51.1784,
        current_lng: block.resolved_lng ?? -115.5708,
        agent_outcome: energyLevel <= 4 ? 'rerouted' : 'affirmed',
        selected_place_id: null,
        selected_place_name: null,
      });
    }

    if (energyLevel <= 4) {
      router.replace(`/checkin/suggestions?blockId=${blockId}` as never);
    } else {
      setSubmitted(true);
    }
  };

  const color = getEnergyColor(energyLevel);
  const fraction = energyLevel / 10;

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.topBar}>
        <Pressable onPress={() => router.back()} style={s.closeBtn}>
          <Feather name="x" size={20} color={C.secondary} />
        </Pressable>
      </View>

      <View style={s.center}>
        {submitted ? (
          <View style={s.successWrap}>
            <View style={[s.successIcon, { backgroundColor: color }]}>
              <Feather name="check" size={32} color={C.white} />
            </View>
            <Text style={s.successTitle}>You're all set</Text>
            <Text style={s.successSub}>Enjoy {block?.place_name ?? 'your activity'}</Text>
          </View>
        ) : (
          <>
            <View style={s.activityCard}>
              <Text style={s.activityLabel}>CHECKING IN</Text>
              <Text style={s.activityName}>{block?.place_name ?? 'Your Activity'}</Text>
            </View>

            <Text style={s.question}>How's your energy right now?</Text>

            {/* Energy icon + label */}
            <View style={[s.energyIndicator, { backgroundColor: color + '15' }]}>
              <Feather name={getEnergyIcon(energyLevel)} size={24} color={color} />
              <Text style={[s.energyLabel2, { color }]}>{getEnergyLabel(energyLevel)}</Text>
            </View>

            {/* Continuous slider */}
            <View style={s.sliderWrap}>
              <View style={s.sliderTrack} {...panResponder.panHandlers}>
                <View style={[s.sliderFill, { width: `${fraction * 100}%`, backgroundColor: color }]} />
                <Animated.View style={[s.sliderThumb, { left: Animated.multiply(sliderX, 1), borderColor: color }]} />
              </View>
              <View style={s.sliderLabels}>
                <Text style={s.sliderLabelText}>Low energy</Text>
                <Text style={s.sliderLabelText}>High energy</Text>
              </View>
            </View>

            <Pressable style={[s.submitBtn, { backgroundColor: color }]} onPress={handleSubmit}>
              <Feather name="check-circle" size={16} color={C.white} />
              <Text style={s.submitBtnText}>
                {energyLevel <= 4 ? 'Find gentler alternatives' : 'Check in'}
              </Text>
            </Pressable>

            <Pressable onPress={() => router.back()} style={s.cancelBtn}>
              <Text style={s.cancelText}>Not now</Text>
            </Pressable>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.white },
  topBar: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 20, paddingVertical: 8 },
  closeBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.bg, justifyContent: 'center', alignItems: 'center' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },

  activityCard: { width: '100%', backgroundColor: C.bg, borderRadius: 16, paddingHorizontal: 20, paddingVertical: 16, alignItems: 'center', marginBottom: 32 },
  activityLabel: { fontSize: 10, fontFamily: F.semiBold, color: C.placeholder, letterSpacing: 1.5, marginBottom: 6 },
  activityName: { fontSize: 18, fontFamily: F.bold, color: C.fg, textAlign: 'center' },

  question: { fontSize: 16, fontFamily: F.medium, color: C.secondary, marginBottom: 28 },

  energyIndicator: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 20, paddingVertical: 12, borderRadius: 999, marginBottom: 32,
  },
  energyLabel2: { fontSize: 16, fontFamily: F.semiBold },

  sliderWrap: { width: SLIDER_W, marginBottom: 32 },
  sliderTrack: {
    height: 8, backgroundColor: C.cardBg, borderRadius: 4, position: 'relative',
  },
  sliderFill: { height: 8, borderRadius: 4, position: 'absolute', left: 0, top: 0 },
  sliderThumb: {
    position: 'absolute', top: -10, width: 28, height: 28, borderRadius: 14,
    backgroundColor: C.white, borderWidth: 3,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 4,
  },
  sliderLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  sliderLabelText: { fontSize: 12, fontFamily: F.medium, color: C.placeholder },

  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    width: '100%', borderRadius: 999, paddingVertical: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8,
  },
  submitBtnText: { color: C.white, fontSize: 16, fontFamily: F.bold },

  cancelBtn: { marginTop: 16 },
  cancelText: { fontSize: 14, fontFamily: F.medium, color: C.placeholder },

  successWrap: { alignItems: 'center' },
  successIcon: { width: 72, height: 72, borderRadius: 36, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  successTitle: { fontSize: 24, fontFamily: F.bold, color: C.fg, marginBottom: 8 },
  successSub: { fontSize: 16, fontFamily: F.regular, color: C.secondary },
});
