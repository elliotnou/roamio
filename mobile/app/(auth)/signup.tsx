import { useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform, StyleSheet, ScrollView } from 'react-native';
import { useRouter, Link } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { C } from '../../lib/colors';
import { F } from '../../lib/fonts';

export default function SignupScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSignup = async () => {
    if (!email || !password || !name) { setError('Please fill in all fields'); return; }
    if (password !== confirm) { setError('Passwords do not match'); return; }
    
    setError('');
    setLoading(true);
    
    const { error } = await import('../../lib/supabase').then(m => m.supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: name,
        }
      }
    }));

    setLoading(false);

    if (error) {
      setError(error.message);
    } else {
      router.replace('/(tabs)');
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={s.center} keyboardShouldPersistTaps="handled">
          <Text style={s.logo}>TripPulse</Text>
          <Text style={s.tagline}>Create your account</Text>

          <View style={s.form}>
            <TextInput style={s.input} placeholder="Display name" placeholderTextColor={C.placeholder} value={name} onChangeText={setName} />
            <TextInput style={s.input} placeholder="Email address" placeholderTextColor={C.placeholder} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
            <TextInput style={s.input} placeholder="Password" placeholderTextColor={C.placeholder} value={password} onChangeText={setPassword} secureTextEntry />
            <TextInput style={s.input} placeholder="Confirm password" placeholderTextColor={C.placeholder} value={confirm} onChangeText={setConfirm} secureTextEntry />
            {error ? <Text style={s.error}>{error}</Text> : null}
            <Pressable style={s.btn} onPress={handleSignup} disabled={loading}>
              {loading ? <ActivityIndicator color={C.white} /> : <Text style={s.btnText}>Create Account</Text>}
            </Pressable>
          </View>

          <View style={s.footer}>
            <Text style={s.footerText}>Already have an account? </Text>
            <Link href="/login" style={s.link}>Sign in</Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  flex: { flex: 1 },
  center: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 32, paddingVertical: 40 },
  logo: { fontSize: 44, fontFamily: F.bold, color: C.fg, textAlign: 'center', letterSpacing: -1 },
  tagline: { fontSize: 14, fontFamily: F.regular, color: C.secondary, textAlign: 'center', marginTop: 8, marginBottom: 48 },
  form: { gap: 14 },
  input: {
    backgroundColor: C.white, borderWidth: 1, borderColor: C.border, borderRadius: 16,
    paddingHorizontal: 20, paddingVertical: 14, fontSize: 14, fontFamily: F.regular, color: C.fg,
  },
  btn: { backgroundColor: C.charcoal, borderRadius: 999, paddingVertical: 16, alignItems: 'center', marginTop: 4 },
  btnText: { color: C.white, fontFamily: F.semiBold, fontSize: 16 },
  error: { color: C.eLowText, fontSize: 13, fontFamily: F.regular, textAlign: 'center' },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 32 },
  footerText: { fontSize: 14, fontFamily: F.regular, color: C.secondary },
  link: { fontSize: 14, fontFamily: F.semiBold, color: C.fg },
});
