import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { supabase } from '../lib/supabase';
import { useTripStore } from '../store/trip-store';
import { C } from '../lib/colors';

export default function Index() {
  const router = useRouter();
  const { fetchData } = useTripStore();
  const didInit = useRef(false);

  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;

    const boot = async () => {
      try {
        // Race session check against a 3s timeout so the app never hangs
        const result = await Promise.race([
          supabase.auth.getSession(),
          new Promise<null>((r) => setTimeout(() => r(null), 3000)),
        ]);

        const session =
          result && typeof result === 'object' && 'data' in result
            ? (result as any).data.session
            : null;

        if (session) {
          await fetchData();
          router.replace('/(tabs)');
        } else {
          router.replace('/login');
        }
      } catch {
        router.replace('/login');
      }
    };

    boot();

    // Listen for future auth changes (login / logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'INITIAL_SESSION') return;
        if (session) {
          await fetchData();
          router.replace('/(tabs)');
        } else {
          router.replace('/login');
        }
      },
    );

    return () => subscription.unsubscribe();
  }, []);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.bg }}>
      <ActivityIndicator color={C.charcoal} />
    </View>
  );
}
