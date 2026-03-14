import { useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTripStore } from '../../../store/trip-store';
import { getDayCount } from '../../../lib/utils';
import { C } from '../../../lib/colors';
import { F } from '../../../lib/fonts';

export default function ItineraryScreen() {
  const router = useRouter();
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { trips, addActivityBlock } = useTripStore();

  const trip = trips.find((t) => t.id === tripId);
  const dayCount = trip ? getDayCount(trip.start_date, trip.end_date) : 3;

  const [dayIndex, setDayIndex] = useState(0);
  const [placeName, setPlaceName] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleAdd = async () => {
    if (!placeName || !startTime || !endTime) {
      setError('All fields are required');
      return;
    }
    setError('');
    setLoading(true);
    await new Promise((r) => setTimeout(r, 500));

    addActivityBlock({
      id: `block-${Date.now()}`,
      trip_id: tripId ?? '',
      day_index: dayIndex,
      place_name: placeName,
      resolved_place_id: null,
      resolved_place_name: null,
      resolved_lat: null,
      resolved_lng: null,
      activity_type: 'other',
      energy_cost_estimate: 5,
      start_time: startTime,
      end_time: endTime,
    });

    setLoading(false);
    router.back();
  };

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
          <View style={s.header}>
            <Pressable onPress={() => router.back()} style={s.backBtn}>
              <Feather name="arrow-left" size={18} color={C.fg} />
            </Pressable>
            <Text style={s.title}>Add Activity</Text>
            <View style={{ width: 40 }} />
          </View>

          <View style={s.field}>
            <Text style={s.label}>Day</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.dayRow}>
              {Array.from({ length: dayCount }, (_, i) => (
                <Pressable key={i} onPress={() => setDayIndex(i)} style={[s.dayPill, dayIndex === i && s.dayPillActive]}>
                  <Text style={[s.dayPillText, dayIndex === i && s.dayPillTextActive]}>Day {i + 1}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          <View style={s.field}>
            <Text style={s.label}>Place name</Text>
            <View style={s.inputRow}>
              <Feather name="map-pin" size={16} color={C.placeholder} />
              <TextInput style={s.input} placeholder="e.g. Banff Upper Hot Springs" placeholderTextColor={C.placeholder} value={placeName} onChangeText={setPlaceName} />
            </View>
          </View>

          <View style={s.field}>
            <Text style={s.label}>Start time</Text>
            <View style={s.inputRow}>
              <Feather name="clock" size={16} color={C.placeholder} />
              <TextInput style={s.input} placeholder="HH:MM (e.g. 09:00)" placeholderTextColor={C.placeholder} value={startTime} onChangeText={setStartTime} />
            </View>
          </View>

          <View style={s.field}>
            <Text style={s.label}>End time</Text>
            <View style={s.inputRow}>
              <Feather name="clock" size={16} color={C.placeholder} />
              <TextInput style={s.input} placeholder="HH:MM (e.g. 11:00)" placeholderTextColor={C.placeholder} value={endTime} onChangeText={setEndTime} />
            </View>
          </View>

          <View style={s.hint}>
            <Feather name="zap" size={14} color={C.sage} />
            <Text style={s.hintText}>Our AI will automatically classify this activity and estimate its energy demand</Text>
          </View>

          {error ? <Text style={s.error}>{error}</Text> : null}

          <Pressable style={s.submitBtn} onPress={handleAdd} disabled={loading}>
            {loading ? <ActivityIndicator color={C.white} /> : <Text style={s.submitText}>Add Activity</Text>}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.white, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 18, fontFamily: F.bold, color: C.fg },
  field: { marginBottom: 20 },
  label: { fontSize: 14, fontFamily: F.semiBold, color: C.fg, marginBottom: 8 },
  dayRow: { gap: 8 },
  dayPill: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999, backgroundColor: C.white },
  dayPillActive: { backgroundColor: C.charcoal },
  dayPillText: { fontSize: 14, fontFamily: F.semiBold, color: C.secondary },
  dayPillTextActive: { color: C.white },
  inputRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: C.white, borderWidth: 1, borderColor: C.border, borderRadius: 16,
    paddingHorizontal: 16, paddingVertical: 14,
  },
  input: { flex: 1, fontSize: 14, fontFamily: F.regular, color: C.fg },
  hint: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: C.eHighBg, borderRadius: 12, padding: 12, marginBottom: 20,
  },
  hintText: { flex: 1, fontSize: 12, fontFamily: F.regular, color: C.eHighText },
  error: { color: C.eLowText, fontSize: 13, fontFamily: F.regular, textAlign: 'center', marginBottom: 12 },
  submitBtn: { backgroundColor: C.charcoal, borderRadius: 999, paddingVertical: 16, alignItems: 'center' },
  submitText: { color: C.white, fontSize: 16, fontFamily: F.semiBold },
});
