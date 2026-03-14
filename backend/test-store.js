import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);

async function testFetch() {
  try {
      console.log("Attempting sign in...");
      const { data: sessionData, error: signInError } = await supabase.auth.signInWithPassword({
        email: 'test1773518335031@test.com', // use the user we created earlier
        password: 'password123',
      });
      if (signInError) {
          console.error("Sign in error:", signInError);
          return;
      }
      console.log("Signed in:", sessionData.session?.user?.id);
      
      const userId = sessionData.session?.user?.id;
      
      console.log("Fetching trips...");
      const { data: trips, error: tripsError } = await supabase.from('trips').select('*').eq('user_id', userId).order('start_date', { ascending: true });
      if (tripsError) {
          console.error("Trips error", tripsError);
          return;
      }
      
      console.log("Trips:", trips?.length);
  } catch (err) {
      console.error("Caught error:", err);
  }
}
testFetch();
