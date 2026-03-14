import { useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { useRouter, Link } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { C } from '../../lib/colors';
import { F } from '../../lib/fonts';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSignIn = async () => {
    if (!email || !password) {
      setError('Please enter both email and password');
      return;
    }
    setError('');
    setLoading(true);
    
    const { error } = await import('../../lib/supabase').then(m => m.supabase.auth.signInWithPassword({
      email,
      password,
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
        <View style={s.center}>
          <Text style={s.logo}>TripPulse</Text>
          <Text style={s.tagline}>Your wellness travel companion</Text>

          <View style={s.form}>
            <TextInput
              style={s.input}
              placeholder="Email address"
              placeholderTextColor={C.placeholder}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <TextInput
              style={s.input}
              placeholder="Password"
              placeholderTextColor={C.placeholder}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
            {error ? <Text style={s.error}>{error}</Text> : null}
            <Pressable style={s.btn} onPress={handleSignIn} disabled={loading}>
              {loading ? <ActivityIndicator color={C.white} /> : <Text style={s.btnText}>Sign In</Text>}
            </Pressable>
          </View>

          <View style={s.footer}>
            <Text style={s.footerText}>Don't have an account? </Text>
            <Link href="/signup" style={s.link}>Create one</Link>
          </View>
          <Text style={s.demo}>Demo — enter any email and password</Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  flex: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', paddingHorizontal: 32 },
  logo: { fontSize: 44, fontFamily: F.bold, color: C.fg, textAlign: 'center', letterSpacing: -1 },
  tagline: { fontSize: 14, fontFamily: F.regular, color: C.secondary, textAlign: 'center', marginTop: 8, marginBottom: 48 },
  form: { gap: 14 },
  input: {
    backgroundColor: C.white, borderWidth: 1, borderColor: C.border, borderRadius: 16,
    paddingHorizontal: 20, paddingVertical: 14, fontSize: 14, fontFamily: F.regular, color: C.fg,
  },
  btn: { backgroundColor: C.charcoal, borderRadius: 999, paddingVertical: 16, alignItems: 'center', marginTop: 4 },
  btnText: { color: C.white, fontFamily: F.semiBold, fontSize: 16 },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 32 },
  footerText: { fontSize: 14, fontFamily: F.regular, color: C.secondary },
  link: { fontSize: 14, fontFamily: F.semiBold, color: C.fg },
  error: { color: C.eLowText, fontSize: 13, fontFamily: F.regular, textAlign: 'center' },
  demo: { fontSize: 12, fontFamily: F.regular, color: C.placeholder, textAlign: 'center', marginTop: 24 },
});
