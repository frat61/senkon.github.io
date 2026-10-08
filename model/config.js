// Public configuration of the model viewer. Only the Supabase *anon* key belongs here.
// The anon key is designed to be public; row level security and the get_model function
// decide what it can see. Never put the service-role key in this file.
window.SENKON_CONFIG = {
  SUPABASE_URL: '',       // e.g. https://abcdefghijkl.supabase.co
  SUPABASE_ANON_KEY: ''   // "anon public" key from Project Settings > API
};
