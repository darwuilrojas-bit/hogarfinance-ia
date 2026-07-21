/**
 * Indica si las credenciales de Supabase ya fueron configuradas
 * en .env.local. Permite que la app corra en modo demostración
 * (sin autenticación real) mientras tanto.
 */
export const isSupabaseConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
    !process.env.NEXT_PUBLIC_SUPABASE_URL.includes("TU-PROYECTO")
);
