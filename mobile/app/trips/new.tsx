import { useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform, StyleSheet, Keyboard } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import type { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useTripStore } from '../../store/trip-store';
import { fetchPlaceAutocomplete, fetchPlacePrimaryPhotoUrl, PlaceAutocompleteItem } from '../../lib/places';
import { C } from '../../lib/colors';
import { F } from '../../lib/fonts';

const VIBES = [
  { key: 'relaxing', label: 'Relaxing', icon: 'sunset' as const, desc: 'Spas, parks, slow mornings' },
  { key: 'adventure', label: 'Adventure', icon: 'compass' as const, desc: 'Hikes, trails, exploration' },
  { key: 'culture', label: 'Culture', icon: 'book-open' as const, desc: 'Museums, landmarks, history' },
  { key: 'foodie', label: 'Foodie', icon: 'coffee' as const, desc: 'Markets, restaurants, cafes' },
] as const;

function formatDisplayDate(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function toISODate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function toDateOnly(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export default function NewTripScreen() {
  const router = useRouter();
  const { addTrip, user } = useTripStore();
  const today = toDateOnly(new Date());
  const destinationInputRef = useRef<TextInput>(null);
  const autocompleteRequestRef = useRef(0);
  const [destination, setDestination] = useState('');
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [startDate, setStartDate] = useState<Date>(today);
  const [endDate, setEndDate] = useState<Date>(today);
  const [selectedVibes, setSelectedVibes] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPicker, setShowPicker] = useState<'start' | 'end' | null>(null);
  
  const [suggestions, setSuggestions] = useState<PlaceAutocompleteItem[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  const handleDestinationChange = (text: string) => {
    setDestination(text);
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
    setDestination(item.fullText);
    setSelectedPlaceId(item.placeId);
    setSuggestions([]);
    setLoadingSuggestions(false);
    Keyboard.dismiss();
    destinationInputRef.current?.blur();
  };

  const toggleVibe = (key: string) => {
    setSelectedVibes((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const handleDateChange = (event: DateTimePickerEvent, date?: Date) => {
    if (event.type === 'dismissed' || !date || !showPicker) {
      setShowPicker(null);
      return;
    }

    const picked = toDateOnly(date);

    if (showPicker === 'start') {
      setStartDate(picked);
      if (endDate <= picked) {
        setEndDate(addDays(picked, 0));
      }
    } else {
      setEndDate(picked);
    }

    setShowPicker(null);
  };

  const handleCreate = async () => {
    if (!destination) {
      setError('Destination is required');
      return;
    }
    if (endDate < startDate) {
      setError('End date must be after start date');
      return;
    }

    // Validation: Check for overlapping trips
    const existingTrips = useTripStore.getState().trips;
    const newStart = startDate.getTime();
    const newEnd = endDate.getTime();
    
    for (const t of existingTrips) {
      const existingStart = new Date(t.start_date).getTime();
      const existingEnd = new Date(t.end_date).getTime();
      
      // Check if dates overlap
      // Overlap occurs if (StartA <= EndB) and (EndA >= StartB)
      if (newStart <= existingEnd && newEnd >= existingStart) {
        setError('You already have a trip scheduled during these dates.');
        return;
      }
    }

    setError('');
    setLoading(true);

    let destinationImage: string | null = null;
    if (selectedPlaceId) {
      try {
        destinationImage = await fetchPlacePrimaryPhotoUrl(selectedPlaceId);
      } catch {
        destinationImage = null;
      }
    }

    const trip = await addTrip({
      user_id: user?.id || '',
      destination,
      start_date: toISODate(startDate),
      end_date: toISODate(endDate),
      travel_vibes: Array.from(selectedVibes),
      destination_image: destinationImage ?? undefined,
    });

    setLoading(false);

    if (trip) {
      // Navigate to the trip detail so the user can add their itinerary
      router.replace(`/trips/${trip.id}` as never);
    } else {
      setError('Failed to create trip');
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="always">
          <View style={s.header}>
            <Pressable onPress={() => router.replace('/(tabs)')} style={s.backBtn}>
              <Feather name="arrow-left" size={18} color={C.fg} />
            </Pressable>
            <Text style={s.title}>Plan a Trip</Text>
            <View style={{ width: 40 }} />
          </View>

          <View style={s.form}>
            <View style={[s.field, { zIndex: 10 }]}>
              <Text style={s.label}>Where to?</Text>
              <View style={s.inputRow}>
                <Feather name="map-pin" size={16} color={C.sage} />
                <TextInput
                  ref={destinationInputRef}
                  style={s.input}
                  placeholder="e.g. Tokyo, Japan"
                  placeholderTextColor={C.placeholder}
                  value={destination}
                  onChangeText={handleDestinationChange}
                  onFocus={() => {
                    if (!selectedPlaceId && destination.trim().length > 2) {
                      handleDestinationChange(destination);
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

            <View style={s.dateRow}>
              <View style={[s.field, { flex: 1 }]}>
                <Text style={s.label}>Start</Text>
                <Pressable style={s.dateBtn} onPress={() => setShowPicker('start')}>
                  <Feather name="calendar" size={14} color={C.sage} />
                  <Text style={s.dateBtnText}>{formatDisplayDate(startDate)}</Text>
                </Pressable>
              </View>
              <View style={[s.field, { flex: 1 }]}>
                <Text style={s.label}>End</Text>
                <Pressable style={s.dateBtn} onPress={() => setShowPicker('end')}>
                  <Feather name="calendar" size={14} color={C.sage} />
                  <Text style={s.dateBtnText}>{formatDisplayDate(endDate)}</Text>
                </Pressable>
              </View>
            </View>

            {showPicker !== null && (
              <View style={s.pickerContainer}>
                <DateTimePicker
                  value={showPicker === 'start' ? startDate : endDate}
                  mode="date"
                  display="default"
                  minimumDate={showPicker === 'end' ? startDate : today}
                  onChange={handleDateChange}
                  textColor={C.fg}
                />
              </View>
            )}

            <View style={s.field}>
              <Text style={s.label}>Travel vibe</Text>
              <Text style={s.sublabel}>What kind of experience are you after?</Text>
              <View style={s.vibeGrid}>
                {VIBES.map((vibe) => {
                  const isActive = selectedVibes.has(vibe.key);
                  return (
                    <Pressable
                      key={vibe.key}
                      style={[s.vibeCard, isActive && s.vibeCardActive]}
                      onPress={() => toggleVibe(vibe.key)}
                    >
                      <View style={[s.vibeIconWrap, isActive && s.vibeIconWrapActive]}>
                        <Feather name={vibe.icon} size={20} color={isActive ? C.sage : C.secondary} />
                      </View>
                      <Text style={[s.vibeLabel, isActive && s.vibeLabelActive]}>{vibe.label}</Text>
                      <Text style={s.vibeDesc}>{vibe.desc}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {error ? <Text style={s.error}>{error}</Text> : null}

            <Pressable style={s.createBtn} onPress={handleCreate} disabled={loading}>
              {loading ? (
                <ActivityIndicator color={C.white} />
              ) : (
                <>
                  <Feather name="plus" size={16} color={C.white} />
                  <Text style={s.createBtnText}>Create Trip</Text>
                </>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.white, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 20, fontFamily: F.bold, color: C.fg },
  form: { gap: 20 },
  field: { gap: 8 },
  label: { fontSize: 14, fontFamily: F.semiBold, color: C.fg },
  sublabel: { fontSize: 12, fontFamily: F.regular, color: C.placeholder, marginTop: -4 },
  inputRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: C.white, borderWidth: 1, borderColor: C.border, borderRadius: 16,
    paddingHorizontal: 16, paddingVertical: 14,
  },
  input: { flex: 1, fontSize: 15, fontFamily: F.regular, color: C.fg },
  suggestionsBox: {
    position: 'absolute', top: 80, left: 0, right: 0,
    backgroundColor: C.white, borderRadius: 16, paddingVertical: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.1, shadowRadius: 16, elevation: 8,
    borderWidth: 1, borderColor: C.border, zIndex: 20
  },
  suggestionItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.bg },
  suggestionPrimary: { fontSize: 14, fontFamily: F.semiBold, color: C.fg },
  suggestionSecondary: { fontSize: 12, fontFamily: F.regular, color: C.secondary, marginTop: 2 },
  dateRow: { flexDirection: 'row', gap: 12 },
  dateBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: C.white, borderWidth: 1, borderColor: C.border, borderRadius: 16,
    paddingHorizontal: 14, paddingVertical: 14,
  },
  dateBtnText: { fontSize: 13, fontFamily: F.medium, color: C.fg },
  pickerContainer: {
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 16,
    marginTop: -6,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  vibeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  vibeCard: {
    width: '47%', backgroundColor: C.white, borderRadius: 16, padding: 16,
    borderWidth: 2, borderColor: 'transparent',
  },
  vibeCardActive: { borderColor: C.sage, backgroundColor: C.sage + '08' },
  vibeIconWrap: { width: 40, height: 40, borderRadius: 12, backgroundColor: C.cardBg, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  vibeIconWrapActive: { backgroundColor: C.sage + '18' },
  vibeLabel: { fontSize: 14, fontFamily: F.bold, color: C.fg, marginBottom: 2 },
  vibeLabelActive: { color: C.sageDark },
  vibeDesc: { fontSize: 11, fontFamily: F.regular, color: C.placeholder, lineHeight: 15 },
  error: { color: C.eLowText, fontSize: 13, fontFamily: F.regular, textAlign: 'center' },
  createBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: C.charcoal, borderRadius: 999, paddingVertical: 16,
    shadowColor: C.charcoal, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.25, shadowRadius: 12,
  },
  createBtnText: { color: C.white, fontSize: 16, fontFamily: F.bold },
});
