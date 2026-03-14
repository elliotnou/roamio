import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);

async function test() {
  const { data, error } = await supabase.auth.signUp({
    email: 'test' + Date.now() + '@test.com',
    password: 'password123',
  });
  console.log(error ? error.message : "User created: " + data.user.id);
  
  if (data?.user) {
      await supabase.from('users').upsert({
        id: data.user.id,
        email: data.user.email,
        display_name: 'Test Tester'
      });
      
      const { data: tripData, error: tripError } = await supabase.from('trips').insert([{
        user_id: data.user.id,
        destination: 'Test City',
        start_date: new Date().toISOString(),
        end_date: new Date().toISOString(),
      }]).select().single();
      
      console.log(tripError ? "Trip Error: " + tripError.message : "Trip created: " + tripData.id);
  }
}
test();
