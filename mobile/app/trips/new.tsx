import { useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform, Modal, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTripStore } from '../../store/trip-store';
import { C } from '../../lib/colors';
import { F } from '../../lib/fonts';

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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPicker, setShowPicker] = useState<'start' | 'end' | null>(null);

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
    const data = await addTrip({
      user_id: user?.id || '',
      destination,
      start_date: toISODate(startDate),
      end_date: toISODate(endDate),
    });

    setLoading(false);

    if (data) {
      router.back();
    } else {
      setError('Failed to create trip');
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
          <View style={s.header}>
            <Pressable onPress={() => router.back()} style={s.backBtn}>
              <Feather name="arrow-left" size={18} color={C.fg} />
            </Pressable>
            <Text style={s.title}>New Trip</Text>
            <View style={{ width: 40 }} />
          </View>

          <View style={s.form}>
            <View style={s.field}>
              <Text style={s.label}>Destination</Text>
              <View style={s.inputRow}>
                <Feather name="map-pin" size={16} color={C.placeholder} />
                <TextInput
                  style={s.input}
                  placeholder="e.g. Banff, Alberta"
                  placeholderTextColor={C.placeholder}
                  value={destination}
                  onChangeText={setDestination}
                />
              </View>
            </View>

            <View style={s.field}>
              <Text style={s.label}>Start date</Text>
              <Pressable style={s.inputRow} onPress={() => setShowPicker('start')}>
                <Feather name="calendar" size={16} color={C.placeholder} />
                <Text style={[s.input, !startDate && { color: C.placeholder }]}>
                  {startDate ? formatDisplayDate(startDate) : 'Select start date'}
                </Text>
                <Feather name="chevron-down" size={16} color={C.placeholder} />
              </Pressable>
            </View>

            <View style={s.field}>
              <Text style={s.label}>End date</Text>
              <Pressable style={s.inputRow} onPress={() => setShowPicker('end')}>
                <Feather name="calendar" size={16} color={C.placeholder} />
                <Text style={[s.input, !endDate && { color: C.placeholder }]}>
                  {endDate ? formatDisplayDate(endDate) : 'Select end date'}
                </Text>
                <Feather name="chevron-down" size={16} color={C.placeholder} />
              </Pressable>
            </View>

            {error ? <Text style={s.error}>{error}</Text> : null}

            <Pressable style={s.submitBtn} onPress={handleCreate} disabled={loading}>
              {loading ? <ActivityIndicator color={C.white} /> : <Text style={s.submitText}>Create Trip</Text>}
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
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.white, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 18, fontFamily: F.bold, color: C.fg },
  form: { gap: 20 },
  field: { gap: 8 },
  label: { fontSize: 14, fontFamily: F.semiBold, color: C.fg },
  inputRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: C.white, borderWidth: 1, borderColor: C.border, borderRadius: 16,
    paddingHorizontal: 16, paddingVertical: 14,
  },
  input: { flex: 1, fontSize: 14, fontFamily: F.regular, color: C.fg },
  error: { color: C.eLowText, fontSize: 13, fontFamily: F.regular, textAlign: 'center' },
  submitBtn: { backgroundColor: C.charcoal, borderRadius: 999, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  submitText: { color: C.white, fontSize: 16, fontFamily: F.semiBold },

  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.3)' },
  modalSheet: { backgroundColor: C.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 40 },
  modalHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: C.border, alignSelf: 'center', marginTop: 12 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16 },
  modalTitle: { fontSize: 16, fontFamily: F.bold, color: C.fg },
  modalDone: { fontSize: 16, fontFamily: F.semiBold, color: C.sage },
});
