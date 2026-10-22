// Schedule Workbench settings. These two Supabase values are designed to be public:
// your data is protected by sign-in and the access rules in supabase/schema.sql.
// Find them in Supabase: Project Settings -> API (Project URL and the "anon" public key).
window.SW_CONFIG = {
  supabaseUrl: "https://YOUR-PROJECT-REF.supabase.co",
  supabaseAnonKey: "YOUR-ANON-KEY",

  // Sign-in options shown on the sign-in page.
  signIn: { microsoft: true, email: true },

  // AI Analyst and AI schedule build. Needs the ai-proxy function and an Anthropic API key.
  // Set to false to hide AI features.
  ai: true,
  aiFunction: "ai-proxy"
};
