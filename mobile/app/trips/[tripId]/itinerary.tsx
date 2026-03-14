import { useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform, Modal, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTripStore } from '../../../store/trip-store';
import { getDayCount } from '../../../lib/utils';
import { C } from '../../../lib/colors';
import { F } from '../../../lib/fonts';
import type { ActivityType } from '../../../types';

const ACTIVITY_TYPES: { key: ActivityType; label: string; icon: React.ComponentProps<typeof Feather>['name'] }[] = [
  { key: 'hiking', label: 'Hiking', icon: 'trending-up' },
  { key: 'walking', label: 'Walking', icon: 'navigation' },
  { key: 'museum', label: 'Museum', icon: 'home' },
  { key: 'landmark', label: 'Landmark', icon: 'map-pin' },
  { key: 'restaurant', label: 'Dining', icon: 'coffee' },
  { key: 'cafe', label: 'Café', icon: 'coffee' },
  { key: 'spa', label: 'Spa', icon: 'droplet' },
  { key: 'park', label: 'Park', icon: 'sun' },
  { key: 'beach', label: 'Beach', icon: 'sunrise' },
  { key: 'shopping', label: 'Shopping', icon: 'shopping-bag' },
  { key: 'market', label: 'Market', icon: 'shopping-cart' },
  { key: 'gallery', label: 'Gallery', icon: 'image' },
];

const ENERGY_LEVELS = [
  { value: 2, label: 'Chill', color: C.sage, icon: 'wind' as const },
  { value: 4, label: 'Easy', color: '#a8b89a', icon: 'sun' as const },
  { value: 6, label: 'Moderate', color: '#b8a06a', icon: 'activity' as const },
  { value: 8, label: 'Intense', color: '#c47a6e', icon: 'zap' as const },
];

function formatTime(date: Date): string {
  const h = date.getHours();
  const m = date.getMinutes();
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

function formatTimeDisplay(date: Date): string {
  const h = date.getHours();
  const m = date.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return m === 0 ? `${h12} ${ampm}` : `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
}

export default function ItineraryScreen() {
  const router = useRouter();
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { trips, addActivityBlock, activityBlocks } = useTripStore();

  const trip = trips.find((t) => t.id === tripId);
  const dayCount = trip ? getDayCount(trip.start_date, trip.end_date) : 3;
  const blocks = activityBlocks[tripId ?? ''] || [];

  const [dayIndex, setDayIndex] = useState(0);
  const [placeName, setPlaceName] = useState('');
  const [activityType, setActivityType] = useState<ActivityType>('other');
  const [energyLevel, setEnergyLevel] = useState(4);
  const [startTime, setStartTime] = useState(() => {
    const d = new Date(); d.setHours(9, 0, 0, 0); return d;
  });
  const [endTime, setEndTime] = useState(() => {
    const d = new Date(); d.setHours(11, 0, 0, 0); return d;
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showTimePicker, setShowTimePicker] = useState<'start' | 'end' | null>(null);

  const dayBlocks = blocks.filter(b => b.day_index === dayIndex);

  const handleAdd = async () => {
    if (!placeName) {
      setError('Give this activity a name');
      return;
    }
    setError('');
    setSuccess('');
    setLoading(true);

    const data = await addActivityBlock({
      trip_id: tripId ?? '',
      day_index: dayIndex,
      place_name: placeName,
      resolved_place_id: null,
      resolved_place_name: null,
      resolved_lat: null,
      resolved_lng: null,
      activity_type: activityType,
      energy_cost_estimate: energyLevel,
      start_time: formatTime(startTime),
      end_time: formatTime(endTime),
    });

    setLoading(false);

    if (data) {
      setSuccess(`Added "${placeName}"!`);
      setPlaceName('');
      setActivityType('other');
      // Bump times forward for next activity
      const newStart = new Date(endTime);
      newStart.setHours(newStart.getHours() + 1);
      const newEnd = new Date(newStart);
      newEnd.setHours(newEnd.getHours() + 2);
      setStartTime(newStart);
      setEndTime(newEnd);
      setTimeout(() => setSuccess(''), 2000);
    } else {
      setError('Failed to add activity');
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={s.header}>
            <Pressable onPress={() => router.back()} style={s.backBtn}>
              <Feather name="arrow-left" size={18} color={C.fg} />
            </Pressable>
            <View style={s.headerCenter}>
              <Text style={s.title}>Build Itinerary</Text>
              <Text style={s.headerSub}>{trip?.destination || 'Your Trip'}</Text>
            </View>
            <Pressable onPress={() => router.back()} style={s.doneBtn}>
              <Text style={s.doneBtnText}>Done</Text>
            </Pressable>
          </View>

          {/* Day selector */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.dayRow}>
            {Array.from({ length: dayCount }, (_, i) => {
              const count = blocks.filter(b => b.day_index === i).length;
              return (
                <Pressable key={i} onPress={() => setDayIndex(i)} style={[s.dayPill, dayIndex === i && s.dayPillActive]}>
                  <Text style={[s.dayPillText, dayIndex === i && s.dayPillTextActive]}>Day {i + 1}</Text>
                  {count > 0 && <View style={[s.dayCount, dayIndex === i && s.dayCountActive]}><Text style={[s.dayCountText, dayIndex === i && s.dayCountTextActive]}>{count}</Text></View>}
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Existing activities for this day */}
          {dayBlocks.length > 0 && (
            <View style={s.existingSection}>
              {dayBlocks.sort((a, b) => a.start_time.localeCompare(b.start_time)).map((block, i) => (
                <View key={block.id} style={s.existingBlock}>
                  <Text style={s.existingTime}>{block.start_time}</Text>
                  <View style={s.existingDot} />
                  <Text style={s.existingName}>{block.place_name}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Success toast */}
          {success ? (
            <View style={s.successBanner}>
              <Feather name="check-circle" size={16} color={C.eHighText} />
              <Text style={s.successText}>{success}</Text>
            </View>
          ) : null}

          {/* Activity name */}
          <View style={s.field}>
            <Text style={s.label}>What's the activity?</Text>
            <View style={s.inputRow}>
              <Feather name="map-pin" size={16} color={C.sage} />
              <TextInput
                style={s.input}
                placeholder="e.g. Visit Senso-ji Temple"
                placeholderTextColor={C.placeholder}
                value={placeName}
                onChangeText={setPlaceName}
              />
            </View>
          </View>

          {/* Activity type grid */}
          <View style={s.field}>
            <Text style={s.label}>Type</Text>
            <View style={s.typeGrid}>
              {ACTIVITY_TYPES.map((at) => (
                <Pressable
                  key={at.key}
                  style={[s.typeChip, activityType === at.key && s.typeChipActive]}
                  onPress={() => setActivityType(at.key)}
                >
                  <Feather name={at.icon} size={14} color={activityType === at.key ? C.sageDark : C.secondary} />
                  <Text style={[s.typeLabel, activityType === at.key && s.typeLabelActive]}>{at.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Time pickers */}
          <View style={s.field}>
            <Text style={s.label}>Time</Text>
            <View style={s.timeRow}>
              <Pressable style={s.timeBtn} onPress={() => setShowTimePicker('start')}>
                <Feather name="clock" size={14} color={C.sage} />
                <Text style={s.timeBtnText}>{formatTimeDisplay(startTime)}</Text>
              </Pressable>
              <Feather name="arrow-right" size={16} color={C.placeholder} />
              <Pressable style={s.timeBtn} onPress={() => setShowTimePicker('end')}>
                <Feather name="clock" size={14} color={C.sage} />
                <Text style={s.timeBtnText}>{formatTimeDisplay(endTime)}</Text>
              </Pressable>
            </View>
          </View>

          {/* Energy level */}
          <View style={s.field}>
            <Text style={s.label}>Energy demand</Text>
            <View style={s.energyRow}>
              {ENERGY_LEVELS.map((el) => (
                <Pressable
                  key={el.value}
                  style={[s.energyCard, energyLevel === el.value && { borderColor: el.color }]}
                  onPress={() => setEnergyLevel(el.value)}
                >
                  <Feather name={el.icon} size={18} color={energyLevel === el.value ? el.color : C.placeholder} />
                  <Text style={[s.energyLabel, energyLevel === el.value && { color: el.color, fontFamily: F.bold }]}>{el.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {error ? <Text style={s.error}>{error}</Text> : null}

          <Pressable style={s.addBtn} onPress={handleAdd} disabled={loading}>
            {loading ? <ActivityIndicator color={C.white} /> : (
              <>
                <Feather name="plus" size={16} color={C.white} />
                <Text style={s.addBtnText}>Add Activity</Text>
              </>
            )}
          </Pressable>

          {success ? (
            <View style={s.successBanner}>
              <Feather name="check-circle" size={16} color={C.sageDark} />
              <Text style={s.successText}>{success}</Text>
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Time Picker Modal */}
      <Modal visible={showTimePicker !== null} transparent animationType="slide">
        <Pressable style={s.modalOverlay} onPress={() => setShowTimePicker(null)}>
          <View style={s.modalSheet}>
            <View style={s.modalHandle} />
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>
                {showTimePicker === 'start' ? 'Start Time' : 'End Time'}
              </Text>
              <Pressable onPress={() => setShowTimePicker(null)}>
                <Text style={s.modalDone}>Done</Text>
              </Pressable>
            </View>
            <DateTimePicker
              value={showTimePicker === 'start' ? startTime : endTime}
              mode="time"
              display="spinner"
              minuteInterval={15}
              onChange={(_, date) => {
                if (!date) return;
                if (showTimePicker === 'start') setStartTime(date);
                else setEndTime(date);
              }}
              textColor={C.fg}
            />
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.white, justifyContent: 'center', alignItems: 'center' },
  headerCenter: { alignItems: 'center' },
  title: { fontSize: 18, fontFamily: F.bold, color: C.fg },
  headerSub: { fontSize: 12, fontFamily: F.regular, color: C.secondary, marginTop: 2 },
  doneBtn: { paddingHorizontal: 16, paddingVertical: 10 },
  doneBtnText: { fontSize: 15, fontFamily: F.semiBold, color: C.sage },

  dayRow: { gap: 8, marginBottom: 20, paddingVertical: 4 },
  dayPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999, backgroundColor: C.white,
  },
  dayPillActive: { backgroundColor: C.charcoal },
  dayPillText: { fontSize: 14, fontFamily: F.semiBold, color: C.secondary },
  dayPillTextActive: { color: C.white },
  dayCount: { backgroundColor: C.cardBg, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 1 },
  dayCountActive: { backgroundColor: 'rgba(255,255,255,0.2)' },
  dayCountText: { fontSize: 11, fontFamily: F.bold, color: C.secondary },
  dayCountTextActive: { color: C.white },

  existingSection: { backgroundColor: C.white, borderRadius: 16, padding: 16, marginBottom: 20 },
  existingBlock: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  existingTime: { fontSize: 12, fontFamily: F.medium, color: C.placeholder, width: 42 },
  existingDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.sage },
  existingName: { fontSize: 14, fontFamily: F.semiBold, color: C.fg },

  successBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: C.eHighBg, borderRadius: 12, padding: 14, marginBottom: 16,
  },
  successText: { fontSize: 14, fontFamily: F.semiBold, color: C.eHighText },

  field: { marginBottom: 20 },
  label: { fontSize: 14, fontFamily: F.semiBold, color: C.fg, marginBottom: 10 },
  inputRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: C.white, borderWidth: 1, borderColor: C.border, borderRadius: 16,
    paddingHorizontal: 16, paddingVertical: 14,
  },
  input: { flex: 1, fontSize: 15, fontFamily: F.regular, color: C.fg },

  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: C.white, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1.5, borderColor: 'transparent',
  },
  typeChipActive: { borderColor: C.sage, backgroundColor: C.sage + '10' },
  typeLabel: { fontSize: 13, fontFamily: F.medium, color: C.secondary },
  typeLabelActive: { color: C.sageDark, fontFamily: F.bold },

  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  timeBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: C.white, borderWidth: 1, borderColor: C.border, borderRadius: 16,
    paddingHorizontal: 16, paddingVertical: 14,
  },
  timeBtnText: { fontSize: 15, fontFamily: F.medium, color: C.fg },

  energyRow: { flexDirection: 'row', gap: 8 },
  energyCard: {
    flex: 1, alignItems: 'center', gap: 4,
    backgroundColor: C.white, borderRadius: 16, paddingVertical: 14,
    borderWidth: 2, borderColor: 'transparent',
  },
  energyLabel: { fontSize: 11, fontFamily: F.semiBold, color: C.secondary },

  error: { color: C.eLowText, fontSize: 13, fontFamily: F.regular, textAlign: 'center', marginBottom: 12 },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: C.charcoal, borderRadius: 999, paddingVertical: 16,
    shadowColor: C.charcoal, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.2, shadowRadius: 12,
  },
  addBtnText: { color: C.white, fontSize: 16, fontFamily: F.bold },

  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.3)' },
  modalSheet: { backgroundColor: C.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 40 },
  modalHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: C.border, alignSelf: 'center', marginTop: 12 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16 },
  modalTitle: { fontSize: 16, fontFamily: F.bold, color: C.fg },
  modalDone: { fontSize: 16, fontFamily: F.semiBold, color: C.sage },
});
