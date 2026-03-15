import { useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform, Modal, StyleSheet, Keyboard } from 'react-native';
import type { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTripStore } from '../../../store/trip-store';
import { getDayCount } from '../../../lib/utils';
import { fetchPlaceAutocomplete, PlaceAutocompleteItem } from '../../../lib/places';
import { C } from '../../../lib/colors';
import { F } from '../../../lib/fonts';
import type { ActivityType } from '../../../types';



function parseTime(s: string): Date | null {
  if (!s) return null;
  if (/^\d{2}:\d{2}/.test(s) && !s.includes('T')) {
    const [h, m] = s.split(':').map(Number);
    const d = new Date();
    d.setHours(h ?? 0, m ?? 0, 0, 0);
    return d;
  }
  try { const d = new Date(s); return isNaN(d.getTime()) ? null : d; } catch { return null; }
}

function hasConflict(blocks: { start_time: string; end_time: string; place_name: string }[], start: Date, end: Date): string | null {
  const s = start.getTime(), e = end.getTime();
  for (const b of blocks) {
    const bs = parseTime(b.start_time)?.getTime() ?? 0;
    const be = parseTime(b.end_time)?.getTime() ?? 0;
    if (s < be && e > bs) return b.place_name;
  }
  return null;
}

function formatTime(date: Date): string {
  const h = date.getHours();
  const m = date.getMinutes();
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

function toActivityTimestamp(tripStartDate: string, dayIndex: number, time: Date): string {
  const base = new Date(`${tripStartDate}T00:00:00`);
  base.setDate(base.getDate() + dayIndex);
  base.setHours(time.getHours(), time.getMinutes(), 0, 0);

  // Persist as full ISO with timezone so timestamptz stores intended local clock time.
  return base.toISOString();
}

function formatExistingBlockTime(value: string): string {
  if (!value.includes('T')) {
    return value;
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    return value;
  }
  return formatTime(d);
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
  const placeInputRef = useRef<TextInput>(null);
  const autocompleteRequestRef = useRef(0);

  const trip = trips.find((t) => t.id === tripId);
  const dayCount = trip ? getDayCount(trip.start_date, trip.end_date) : 3;
  const blocks = activityBlocks[tripId ?? ''] || [];

  const [dayIndex, setDayIndex] = useState(0);
  const [placeName, setPlaceName] = useState('');
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
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
  const [suggestions, setSuggestions] = useState<PlaceAutocompleteItem[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  const dayBlocks = blocks.filter(b => b.day_index === dayIndex);

  const handlePlaceNameChange = (text: string) => {
    setPlaceName(text);
    setSelectedPlaceId(null);

    const input = text.trim();
    if (input.length <= 2) {
      autocompleteRequestRef.current += 1;
      setSuggestions([]);
      setLoadingSuggestions(false);
      return;
    }

    const requestId = autocompleteRequestRef.current + 1;
    autocompleteRequestRef.current = requestId;
    setLoadingSuggestions(true);

    fetchPlaceAutocomplete(input)
      .then((results) => {
        if (autocompleteRequestRef.current !== requestId) {
          return;
        }
        setSuggestions(results);
      })
      .catch(() => {
        if (autocompleteRequestRef.current !== requestId) {
          return;
        }
        setSuggestions([]);
      })
      .finally(() => {
        if (autocompleteRequestRef.current === requestId) {
          setLoadingSuggestions(false);
        }
      });
  };

  const handleSelectSuggestion = (item: PlaceAutocompleteItem) => {
    autocompleteRequestRef.current += 1;
    setPlaceName(item.fullText);
    setSelectedPlaceId(item.placeId);
    setSuggestions([]);
    setLoadingSuggestions(false);
    Keyboard.dismiss();
    placeInputRef.current?.blur();
  };

  const handleTimePickerChange = (event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') {
      // Android uses a native dialog with OK/Cancel, so always close after interaction.
      setShowTimePicker(null);
    }

    if (event.type !== 'set' || !date) {
      return;
    }

    if (showTimePicker === 'start') {
      setStartTime(date);
      return;
    }

    if (showTimePicker === 'end') {
      setEndTime(date);
    }
  };

  const handleAdd = async () => {
    if (!placeName) {
      setError('Give this activity a name');
      return;
    }
    const conflict = hasConflict(dayBlocks, startTime, endTime);
    if (conflict) {
      setError(`Time conflicts with "${conflict}"`);
      return;
    }
    setError('');
    setSuccess('');
    setLoading(true);

    const data = await addActivityBlock({
      trip_id: tripId ?? '',
      day_index: dayIndex,
      place_name: placeName,
      resolved_place_id: selectedPlaceId,
      resolved_place_name: selectedPlaceId ? placeName : null,
      resolved_lat: null,
      resolved_lng: null,
      activity_type: 'other',
      energy_cost_estimate: 4,
      start_time: toActivityTimestamp(trip?.start_date || new Date().toISOString().split('T')[0], dayIndex, startTime),
      end_time: toActivityTimestamp(trip?.start_date || new Date().toISOString().split('T')[0], dayIndex, endTime),
    });

    setLoading(false);

    if (data) {
      setSuccess(`Added "${placeName}"!`);
      setPlaceName('');
      setSelectedPlaceId(null);
      setSuggestions([]);
      setLoadingSuggestions(false);
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
        <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="always" showsVerticalScrollIndicator={false}>
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
                  <Text style={s.existingTime}>{formatExistingBlockTime(block.start_time)}</Text>
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
          <View style={[s.field, { zIndex: 10 }]}>
            <Text style={s.label}>What's the activity?</Text>
            <View style={s.inputRow}>
              <Feather name="map-pin" size={16} color={C.sage} />
              <TextInput
                ref={placeInputRef}
                style={s.input}
                placeholder="e.g. Visit Senso-ji Temple"
                placeholderTextColor={C.placeholder}
                value={placeName}
                onChangeText={handlePlaceNameChange}
                onFocus={() => {
                  if (!selectedPlaceId && placeName.trim().length > 2) {
                    handlePlaceNameChange(placeName);
                  }
                }}
              />
              {loadingSuggestions && <ActivityIndicator size="small" color={C.sage} />}
            </View>
            {suggestions.length > 0 && (
              <View style={s.suggestionsBox}>
                {suggestions.map((item) => (
                  <Pressable
                    key={item.placeId}
                    style={s.suggestionItem}
                    onPress={() => handleSelectSuggestion(item)}
                  >
                    <Feather name="map-pin" size={14} color={C.placeholder} />
                    <View style={{ flex: 1 }}>
                      <Text style={s.suggestionPrimary}>{item.primaryText}</Text>
                      {item.secondaryText ? <Text style={s.suggestionSecondary}>{item.secondaryText}</Text> : null}
                    </View>
                  </Pressable>
                ))}
              </View>
            )}
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
        <View style={s.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setShowTimePicker(null)} />
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
              onChange={handleTimePickerChange}
              textColor={C.fg}
            />
          </View>
        </View>
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
  suggestionsBox: {
    position: 'absolute', top: 84, left: 0, right: 0,
    backgroundColor: C.white, borderRadius: 16, paddingVertical: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.1, shadowRadius: 16, elevation: 8,
    borderWidth: 1, borderColor: C.border, zIndex: 20
  },
  suggestionItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.bg },
  suggestionPrimary: { fontSize: 14, fontFamily: F.semiBold, color: C.fg },
  suggestionSecondary: { fontSize: 12, fontFamily: F.regular, color: C.secondary, marginTop: 2 },

  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  timeBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: C.white, borderWidth: 1, borderColor: C.border, borderRadius: 16,
    paddingHorizontal: 16, paddingVertical: 14,
  },
  timeBtnText: { fontSize: 15, fontFamily: F.medium, color: C.fg },

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
