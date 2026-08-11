// Configuração de conexão com o Supabase — valores públicos por natureza (a chave
// aqui é a "publishable"/"anon", feita para ficar exposta no navegador; a segurança
// real vem das políticas de RLS definidas em sql/schema.sql, não do sigilo desta
// chave). Nunca coloque aqui a chave "secret"/"service_role".
window.SUPABASE_URL = "https://axwvtjmwvblhxaxmjqdo.supabase.co";
window.SUPABASE_ANON_KEY = "sb_publishable_x-3iSmZmvm30DQgSKqNBgQ_OrQegDxK";
