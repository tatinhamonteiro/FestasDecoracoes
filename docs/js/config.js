// =====================================================================
//  Configuração do Supabase (Project Settings → API Keys → aba "Legacy")
//    - Project URL        → supabaseUrl
//    - anon / public key  → supabaseAnonKey  (começa com eyJ...)
//  A chave "anon" é pública por natureza: a segurança fica nas regras
//  (RLS) do supabase/schema.sql. NUNCA coloque aqui a "service_role".
// =====================================================================
window.APP_CONFIG = {
  supabaseUrl: 'https://SEU-PROJETO.supabase.co',
  supabaseAnonKey: 'COLE-AQUI-A-CHAVE-ANON',
};
