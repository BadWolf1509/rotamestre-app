/* eslint-disable no-undef */
// Edge Function: Expirar Rotas Pendentes
// Chamada pelo workflow .github/workflows/expire-routes.yml às 22:00 BRT.
//
// A decisão de QUAIS rotas expirar é da função SQL `expire_old_pending_routes`,
// não daqui: ela só expira rotas do dia corrente após as 22:00 America/Sao_Paulo
// (migration 20260827190000). Uma execução atrasada do agendador é, portanto,
// inofensiva — ela limpa dias anteriores e deixa o dia corrente em paz.
//
// ATENÇÃO AO ORDENAR O DEPLOY: esta função é fail-closed no CRON_SECRET.
// Configure o segredo ANTES de fazer deploy, senão o endpoint passa a responder
// 500 e a expiração para:
//   1) supabase secrets set CRON_SECRET=<segredo> --project-ref xezslsyxjivunmhhyxtd
//   2) cadastre o MESMO valor como secret CRON_SECRET no repositório GitHub
//   3) supabase functions deploy expire-routes
//
// Deploy: supabase functions deploy expire-routes
// Test:   curl -X POST https://<project>.supabase.co/functions/v1/expire-routes \
//           -H "Authorization: Bearer <anon_key>" -H "x-cron-secret: <segredo>"

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { chaveSecreta } from '../_shared/chaves.ts';
import { requireCronSecret } from '../_shared/cronAuth.ts';

interface ExpireResult {
  expired_count: number;
  notifications_sent: number;
}

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
    // Criar cliente Supabase com service_role para bypass RLS
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = chaveSecreta();

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing SUPABASE_URL or SUPABASE_SECRET_KEYS');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Chamar função SQL que expira rotas e notifica gestores
    const { data, error } = await supabase.rpc('expire_old_pending_routes');

    if (error) {
      console.error('Error calling expire_old_pending_routes:', error);
      return new Response(
        // Detalhe só no log acima: o workflow público imprime este corpo.
        JSON.stringify({
          success: false,
          error: 'Falha ao chamar expire_old_pending_routes',
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const result = data as ExpireResult[] | null;
    const stats = result?.[0] || { expired_count: 0, notifications_sent: 0 };

    console.log(
      `Expired ${stats.expired_count} routes, sent ${stats.notifications_sent} notifications`,
    );

    // Retenção de motorista_locations (90 dias, Migration 37). Sem pg_cron no
    // projeto, roda aqui; falha na limpeza só vai para o log, não derruba a
    // expiração que já aconteceu.
    let localizacoesApagadas: number | null = null;
    const limpeza = await supabase.rpc('limpar_localizacoes_antigas');
    if (limpeza.error) {
      console.error(
        'Error calling limpar_localizacoes_antigas:',
        limpeza.error,
      );
    } else {
      localizacoesApagadas = limpeza.data as number;
      console.log(`Deleted ${localizacoesApagadas} old driver locations`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        expired_count: stats.expired_count,
        notifications_sent: stats.notifications_sent,
        localizacoes_apagadas: localizacoesApagadas,
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
