import { useState, useEffect, useCallback } from 'react';
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { useTripStore } from '../../store/trip-store';
import { C } from '../../lib/colors';

function getEnergyIcon(level: number): { name: React.ComponentProps<typeof Feather>['name']; color: string } {
  if (level <= 2) return { name: 'battery', color: '#c47a6e' };
  if (level <= 4) return { name: 'battery', color: '#b8906a' };
  if (level <= 6) return { name: 'battery-charging', color: '#b8a06a' };
  if (level <= 8) return { name: 'battery-charging', color: C.sage };
  return { name: 'zap', color: C.sageDark };
}

function getDescription(level: number): string {
  if (level <= 2) return 'Running on empty';
  if (level <= 4) return 'Feeling a bit tired';
  if (level <= 6) return 'Doing okay';
  if (level <= 8) return 'Feeling energized';
  return 'Absolutely crushing it';
}

function getSliderColor(level: number): string {
  if (level <= 3) return '#c47a6e';
  if (level <= 6) return '#b8a06a';
  return C.sage;
}

function getTextColor(level: number): string {
  if (level <= 3) return '#8a4a40';
  if (level <= 6) return '#8a7340';
  return '#5a6b4e';
}

export default function CheckInScreen() {
  const router = useRouter();
  const { blockId } = useLocalSearchParams<{ blockId: string }>();
  const { activityBlocks, setEnergyLevel, submitCheckIn, user } = useTripStore();

  const [energy, setEnergy] = useState(5.0);
  const [loading, setLoading] = useState(false);
  const [affirmed, setAffirmed] = useState(false);

  const block = Object.values(activityBlocks)
    .flat()
    .find((b) => b.id === blockId);

  const updateEnergy = useCallback((val: number) => {
    setEnergy(val);
    setEnergyLevel(Math.round(val));
  }, [setEnergyLevel]);

  useEffect(() => {
    if (affirmed) {
      const timer = setTimeout(() => router.replace('/(tabs)'), 2000);
      return () => clearTimeout(timer);
    }
  }, [affirmed, router]);

  const handleSubmit = async () => {
    setLoading(true);
    await new Promise((r) => setTimeout(r, 500));
    const rounded = Math.round(energy);

    if (block) {
      submitCheckIn({
        id: `checkin-${Date.now()}`,
        activity_block_id: block.id,
        user_id: user.id,
        energy_level: rounded,
        current_lat: block.resolved_lat ?? 51.1784,
        current_lng: block.resolved_lng ?? -115.5708,
        agent_outcome: rounded <= 6 ? 'rerouted' : 'affirmed',
        selected_place_id: null,
        selected_place_name: null,
        timestamp: new Date().toISOString(),
      });
    }

    setLoading(false);
    if (rounded <= 6) {
      router.replace(`/checkin/suggestions?blockId=${blockId}` as never);
    } else {
      setAffirmed(true);
    }
  };

  const rounded = Math.round(energy);
  const icon = getEnergyIcon(rounded);
  const textColor = getTextColor(energy);

  return (
    <SafeAreaView style={s.safe}>
      {/* Top bar */}
      <View style={s.topBar}>
        <Pressable onPress={() => router.back()} style={s.backBtn}>
          <Feather name="arrow-left" size={18} color={C.secondary} />
        </Pressable>
        <Text style={s.topTitle}>Energy Check-In</Text>
        <View style={{ width: 36 }} />
      </View>

      <View style={s.center}>
        {/* Activity card */}
        <View style={s.activityCard}>
          <Text style={s.activityLabel}>CURRENT ACTIVITY</Text>
          <Text style={s.activityName}>{block?.place_name ?? 'Your Activity'}</Text>
        </View>

        {affirmed ? (
          <View style={s.affirmedWrap}>
            <Feather name="check-circle" size={64} color={C.sage} />
            <Text style={[s.affirmedTitle, { color: C.eHighText }]}>You're all set</Text>
            <Text style={s.affirmedSub}>Enjoy your activity</Text>
            <Text style={s.affirmedHint}>Returning to dashboard...</Text>
          </View>
        ) : (
          <>
            {/* Energy icon */}
            <View style={s.iconWrap}>
              <Feather name={icon.name} size={48} color={icon.color} />
            </View>

            {/* Energy display */}
            <View style={s.energyDisplay}>
              <Text style={[s.energyNum, { color: textColor }]}>
                {energy.toFixed(1)}
                <Text style={s.energyMax}> / 10</Text>
              </Text>
              <Text style={[s.energyDesc, { color: textColor }]}>{getDescription(rounded)}</Text>
            </View>

            {/* Slider */}
            <View style={s.sliderWrap}>
              <View style={s.sliderLabels}>
                <View style={s.sliderLabelRow}>
                  <Feather name="battery" size={14} color={C.placeholder} />
                  <Text style={s.sliderLabel}>Low</Text>
                </View>
                <View style={s.sliderLabelRow}>
                  <Text style={s.sliderLabel}>High</Text>
                  <Feather name="zap" size={14} color={C.placeholder} />
                </View>
              </View>
              <Slider
                style={s.slider}
                minimumValue={1}
                maximumValue={10}
                step={0}
                value={energy}
                onValueChange={updateEnergy}
                minimumTrackTintColor={getSliderColor(energy)}
                maximumTrackTintColor={C.border}
                thumbTintColor={C.white}
              />
            </View>

            {/* Submit */}
            <Pressable style={s.submitBtn} onPress={handleSubmit} disabled={loading}>
              {loading ? <ActivityIndicator color={C.white} /> : <Text style={s.submitText}>Submit Check-In</Text>}
            </Pressable>

            <Pressable onPress={() => router.back()} style={s.cancelBtn}>
              <Text style={s.cancelText}>Cancel</Text>
            </Pressable>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.white },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 8 },
  backBtn: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  topTitle: { fontSize: 14, fontWeight: '600', color: C.secondary },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  activityCard: { width: '100%', backgroundColor: C.bg, borderRadius: 16, paddingHorizontal: 20, paddingVertical: 16, alignItems: 'center', marginBottom: 40 },
  activityLabel: { fontSize: 10, fontWeight: '600', color: C.placeholder, letterSpacing: 1, marginBottom: 4 },
  activityName: { fontSize: 18, fontWeight: '700', color: C.fg, textAlign: 'center' },

  affirmedWrap: { alignItems: 'center' },
  affirmedTitle: { fontSize: 24, fontWeight: '700', marginTop: 16, marginBottom: 8 },
  affirmedSub: { fontSize: 16, color: C.secondary },
  affirmedHint: { fontSize: 14, color: C.placeholder, marginTop: 12 },

  iconWrap: { marginBottom: 16 },
  energyDisplay: { alignItems: 'center', marginBottom: 40 },
  energyNum: { fontSize: 48, fontWeight: '700' },
  energyMax: { fontSize: 24, fontWeight: '400', color: C.placeholder },
  energyDesc: { fontSize: 14, fontWeight: '500', marginTop: 8 },

  sliderWrap: { width: '100%', marginBottom: 40 },
  sliderLabels: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  sliderLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  sliderLabel: { fontSize: 12, color: C.placeholder, fontWeight: '500' },
  slider: { width: '100%', height: 40 },

  submitBtn: { width: '100%', backgroundColor: C.charcoal, borderRadius: 999, paddingVertical: 16, alignItems: 'center' },
  submitText: { color: C.white, fontSize: 16, fontWeight: '600' },
  cancelBtn: { marginTop: 16 },
  cancelText: { fontSize: 14, color: C.placeholder, fontWeight: '500' },
});
