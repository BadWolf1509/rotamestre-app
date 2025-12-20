// Edge Function: Expirar Rotas Pendentes de Dias Anteriores
// Deve ser chamada via cron job às 07:00 (horário de Brasília)
//
// Deploy: supabase functions deploy expire-routes
// Test: supabase functions invoke expire-routes
//
// Cron job externo (Vercel Cron, GitHub Actions, etc):
// curl -X POST https://<project>.supabase.co/functions/v1/expire-routes \
//   -H "Authorization: Bearer <anon_key>"

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface ExpireResult {
  expired_count: number;
  notifications_sent: number;
}

Deno.serve(async (req) => {
  // Verificar método
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed. Use POST.' }),
      { status: 405, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Criar cliente Supabase com service_role para bypass RLS
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Chamar função SQL que expira rotas e notifica gestores
    const { data, error } = await supabase.rpc('expire_old_pending_routes');

    if (error) {
      console.error('Error calling expire_old_pending_routes:', error);
      return new Response(
        JSON.stringify({
          success: false,
          error: error.message,
          details: error.details
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const result = data as ExpireResult[] | null;
    const stats = result?.[0] || { expired_count: 0, notifications_sent: 0 };

    console.log(`Expired ${stats.expired_count} routes, sent ${stats.notifications_sent} notifications`);

    return new Response(
      JSON.stringify({
        success: true,
        expired_count: stats.expired_count,
        notifications_sent: stats.notifications_sent,
        executed_at: new Date().toISOString(),
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Unexpected error:', err);
    return new Response(
      JSON.stringify({
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
