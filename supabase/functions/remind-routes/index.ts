/* eslint-disable no-undef */
// Edge Function: Lembrete de Rotas Pendentes
// Deve ser chamada via cron job às 16:00 e 20:00 (horário de Brasília)
//
// Deploy: supabase functions deploy remind-routes
// Test: supabase functions invoke remind-routes
//
// ATENÇÃO AO ORDENAR O DEPLOY: fail-closed no CRON_SECRET. Configure o segredo
// nos secrets da Edge Function e no GitHub ANTES do deploy — ver o cabeçalho de
// expire-routes/index.ts para o passo a passo.
//
// Cron job externo (GitHub Actions):
// curl -X POST https://<project>.supabase.co/functions/v1/remind-routes \
//   -H "Authorization: Bearer <anon_key>" \
//   -H "x-cron-secret: <segredo>" \
//   -d '{"urgency": "normal"}' # ou "final" para aviso de 20:00

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import {
  estatisticasDoLembrete,
  urgenciaDoCorpo,
  type EstatisticasDoLembrete,
  type Urgencia,
} from './lembreteRotas.ts';
import { chaveSecreta } from '../_shared/chaves.ts';
import { requireCronSecret } from '../_shared/cronAuth.ts';

Deno.serve(async (req) => {
  // Verificar método
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed. Use POST.' }),
      { status: 405, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // A anon key sozinha não autoriza: ela é pública (vai no bundle web).
  const unauthorized = requireCronSecret(req);
  if (unauthorized) return unauthorized;

  try {
    // Parse request body to get urgency level
    let urgency: Urgencia = 'normal';
    try {
      urgency = urgenciaDoCorpo(await req.json());
    } catch {
      // No body or invalid JSON, use default
    }

    // Criar cliente Supabase com service_role para bypass RLS
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = chaveSecreta();

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing SUPABASE_URL or SUPABASE_SECRET_KEYS');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Chamar função SQL que envia lembretes (com parâmetro de urgência)
    const { data, error } = await supabase.rpc('remind_pending_routes', {
      p_urgency: urgency,
    });

    if (error) {
      console.error('Error calling remind_pending_routes:', error);
      return new Response(
        // Detalhe só no log acima: o workflow público imprime este corpo.
        JSON.stringify({
          success: false,
          error: 'Falha ao chamar remind_pending_routes',
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const stats = estatisticasDoLembrete(
      data as EstatisticasDoLembrete[] | null,
    );

    console.log(
      `Found ${stats.routes_found} pending routes, sent ${stats.reminders_sent} reminders`,
    );

    return new Response(
      JSON.stringify({
        success: true,
        routes_found: stats.routes_found,
        reminders_sent: stats.reminders_sent,
        executed_at: new Date().toISOString(),
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('Unexpected error:', err);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Erro interno',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
});
