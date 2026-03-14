import { useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTripStore } from '../../store/trip-store';
import { C } from '../../lib/colors';

export default function NewTripScreen() {
  const router = useRouter();
  const { addTrip } = useTripStore();
  const [destination, setDestination] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async () => {
    if (!destination || !startDate || !endDate) {
      setError('All fields are required');
      return;
    }
    setError('');
    setLoading(true);
    await new Promise((r) => setTimeout(r, 500));

    const newTrip = {
      id: `trip-${Date.now()}`,
      user_id: 'user-001',
      destination,
      start_date: startDate,
      end_date: endDate,
      created_at: new Date().toISOString(),
    };
    addTrip(newTrip);
    setLoading(false);
    router.back();
  };

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
          {/* Header */}
          <View style={s.header}>
            <Pressable onPress={() => router.back()} style={s.backBtn}>
              <Feather name="arrow-left" size={18} color={C.fg} />
            </Pressable>
            <Text style={s.title}>New Trip</Text>
            <View style={{ width: 40 }} />
          </View>

          {/* Form */}
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
              <View style={s.inputRow}>
                <Feather name="calendar" size={16} color={C.placeholder} />
                <TextInput
                  style={s.input}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={C.placeholder}
                  value={startDate}
                  onChangeText={setStartDate}
                />
              </View>
            </View>

            <View style={s.field}>
              <Text style={s.label}>End date</Text>
              <View style={s.inputRow}>
                <Feather name="calendar" size={16} color={C.placeholder} />
                <TextInput
                  style={s.input}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={C.placeholder}
                  value={endDate}
                  onChangeText={setEndDate}
                />
              </View>
            </View>

            {error ? <Text style={s.error}>{error}</Text> : null}

            <Pressable style={s.submitBtn} onPress={handleCreate} disabled={loading}>
              {loading ? <ActivityIndicator color={C.white} /> : <Text style={s.submitText}>Create Trip</Text>}
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
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.white, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 18, fontWeight: '700', color: C.fg },
  form: { gap: 20 },
  field: { gap: 8 },
  label: { fontSize: 14, fontWeight: '600', color: C.fg },
  inputRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: C.white, borderWidth: 1, borderColor: C.border, borderRadius: 16,
    paddingHorizontal: 16, paddingVertical: 14,
  },
  input: { flex: 1, fontSize: 14, color: C.fg },
  error: { color: C.eLowText, fontSize: 13, textAlign: 'center' },
  submitBtn: { backgroundColor: C.charcoal, borderRadius: 999, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  submitText: { color: C.white, fontSize: 16, fontWeight: '600' },
});
