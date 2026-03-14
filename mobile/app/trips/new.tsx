import { useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform, Modal, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTripStore } from '../../store/trip-store';
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

export default function NewTripScreen() {
  const router = useRouter();
  const { addTrip, user } = useTripStore();
  const [destination, setDestination] = useState('');
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [selectedVibes, setSelectedVibes] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPicker, setShowPicker] = useState<'start' | 'end' | null>(null);

  const toggleVibe = (key: string) => {
    setSelectedVibes((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const handleCreate = async () => {
    if (!destination || !startDate || !endDate) {
      setError('All fields are required');
      return;
    }
    if (endDate < startDate) {
      setError('End date must be after start date');
      return;
    }
    setError('');
    setLoading(true);

    const trip = await addTrip({
      user_id: user?.id || '',
      destination,
      start_date: toISODate(startDate),
      end_date: toISODate(endDate),
      travel_vibes: Array.from(selectedVibes),
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
        <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
          <View style={s.header}>
            <Pressable onPress={() => router.replace('/(tabs)')} style={s.backBtn}>
              <Feather name="arrow-left" size={18} color={C.fg} />
            </Pressable>
            <Text style={s.title}>Plan a Trip</Text>
            <View style={{ width: 40 }} />
          </View>

          <View style={s.form}>
            <View style={s.field}>
              <Text style={s.label}>Where to?</Text>
              <View style={s.inputRow}>
                <Feather name="map-pin" size={16} color={C.sage} />
                <TextInput
                  style={s.input}
                  placeholder="e.g. Tokyo, Japan"
                  placeholderTextColor={C.placeholder}
                  value={destination}
                  onChangeText={setDestination}
                />
              </View>
            </View>

            <View style={s.dateRow}>
              <View style={[s.field, { flex: 1 }]}>
                <Text style={s.label}>Start</Text>
                <Pressable style={s.dateBtn} onPress={() => setShowPicker('start')}>
                  <Feather name="calendar" size={14} color={C.sage} />
                  <Text style={[s.dateBtnText, !startDate && { color: C.placeholder }]}>
                    {startDate ? formatDisplayDate(startDate) : 'Pick date'}
                  </Text>
                </Pressable>
              </View>
              <View style={[s.field, { flex: 1 }]}>
                <Text style={s.label}>End</Text>
                <Pressable style={s.dateBtn} onPress={() => setShowPicker('end')}>
                  <Feather name="calendar" size={14} color={C.sage} />
                  <Text style={[s.dateBtnText, !endDate && { color: C.placeholder }]}>
                    {endDate ? formatDisplayDate(endDate) : 'Pick date'}
                  </Text>
                </Pressable>
              </View>
            </View>

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

      {/* Date Picker Modal */}
      <Modal visible={showPicker !== null} transparent animationType="slide">
        <Pressable style={s.modalOverlay} onPress={() => setShowPicker(null)}>
          <View style={s.modalSheet}>
            <View style={s.modalHandle} />
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>
                {showPicker === 'start' ? 'Start Date' : 'End Date'}
              </Text>
              <Pressable onPress={() => setShowPicker(null)}>
                <Text style={s.modalDone}>Done</Text>
              </Pressable>
            </View>
            <DateTimePicker
              value={
                showPicker === 'start'
                  ? (startDate ?? new Date())
                  : (endDate ?? startDate ?? new Date())
              }
              mode="date"
              display="spinner"
              minimumDate={showPicker === 'end' && startDate ? startDate : new Date()}
              onChange={(_, date) => {
                if (!date) return;
                if (showPicker === 'start') setStartDate(date);
                else setEndDate(date);
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
  dateRow: { flexDirection: 'row', gap: 12 },
  dateBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: C.white, borderWidth: 1, borderColor: C.border, borderRadius: 16,
    paddingHorizontal: 14, paddingVertical: 14,
  },
  dateBtnText: { fontSize: 13, fontFamily: F.medium, color: C.fg },
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
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.3)' },
  modalSheet: { backgroundColor: C.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 40 },
  modalHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: C.border, alignSelf: 'center', marginTop: 12 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16 },
  modalTitle: { fontSize: 16, fontFamily: F.bold, color: C.fg },
  modalDone: { fontSize: 16, fontFamily: F.semiBold, color: C.sage },
});
