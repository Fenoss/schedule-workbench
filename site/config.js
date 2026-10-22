// Schedule Workbench settings. These two Supabase values are designed to be public:
// your data is protected by sign-in and the access rules in supabase/schema.sql.
// Find them in Supabase: Project Settings -> API Keys (the "publishable" key) and the Connect dialog (Project URL).
window.SW_CONFIG = {
  supabaseUrl: "https://qrwtibsgdzsaajwjafwy.supabase.co",
  supabaseAnonKey: "sb_publishable_1e3o6meNSlYXayBfHRJc2Q_8WkgN4Ll",

  // Sign-in options shown on the sign-in page.
  signIn: { microsoft: true, email: true },

  // AI Analyst and AI schedule build. Needs the ai-proxy function and an Anthropic API key.
  // Set to false to hide AI features.
  ai: true,
  aiFunction: "ai-proxy"
};
