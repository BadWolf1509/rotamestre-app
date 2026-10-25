/* eslint-disable no-undef */
/**
 * Edge Function: send-push-notification
 * Envia push notifications via Expo Push Notification Service
 *
 * Chamada via:
 * - Gatilho `send_push_notification_trigger` (pg_net) a cada notificação
 *   inserida, com o cabeçalho `x-push-secret` (segredo `push_webhook_secret` do
 *   Vault, igual ao secret `PUSH_WEBHOOK_SECRET` da função). Publicar com
 *   `verify_jwt` desligado: o segredo é a única porta. O webhook do painel saiu
 *   na Migration 32 — guardava a service_role antiga, vazada em 22/10/2026.
 *
 * Body esperado:
 * {
 *   type: 'INSERT',
 *   table: 'notificacoes',
 *   record: { id, usuario_id, tipo, titulo, mensagem, rota_id, ... }
 * }
 *
 * Ou para envio direto:
 * {
 *   usuario_id: 'uuid',
 *   titulo: 'string',
 *   mensagem: 'string',
 *   data?: { rota_id, ... }
 * }
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

import {
  extrairTicket,
  mascararToken,
  resumoDoTicket,
  tokenDeveSerLimpo,
} from './expoTicket.ts';
import {
  categoriaDoTipo,
  decidirEnvio,
  lerPreferenciaDePush,
} from './preferenciaDePush.ts';
import {
  apagarTokenMorto,
  lerTokensDaConta,
  tokenNoFormatoExpo,
} from './tokensDaConta.ts';
import { chaveSecreta } from '../_shared/chaves.ts';
import { requirePushSecret } from '../_shared/cronAuth.ts';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: 'default' | null;
  badge?: number;
  channelId?: string;
  priority?: 'default' | 'normal' | 'high';
  ttl?: number;
}

// Tipos de notificação que devem gerar push
const PUSH_NOTIFICATION_TYPES = [
  // Atribuição e lembretes (para motorista)
  'nova_rota_atribuida',
  'lembrete_rota_pendente',
  'lembrete_rota_urgente',

  // Execução da rota (para gestor)
  'rota_iniciada',
  'rota_concluida',
  'rota_atrasada',
  'rota_nao_executada',

  // Paradas (para gestor)
  'parada_pulada',
  'parada_reaberta',

  // Emergências (alta prioridade)
  'sos_acionado',
  'incidente_reportado',

  // Edição de rota pelo gestor (para motorista)
  'rota_parada_adicionada',
  'rota_parada_removida',
  'rota_parada_editada',
  'rota_reordenada',
];

// Configuração de prioridade por tipo
const NOTIFICATION_PRIORITY: Record<string, 'high' | 'normal'> = {
  // Atribuição e lembretes
  nova_rota_atribuida: 'high',
  lembrete_rota_pendente: 'normal',
  lembrete_rota_urgente: 'high',

  // Execução da rota
  rota_iniciada: 'normal',
  rota_concluida: 'normal',
  rota_atrasada: 'normal',
  rota_nao_executada: 'high',

  // Paradas
  parada_pulada: 'normal',
  parada_reaberta: 'normal',

  // Emergências (sempre alta)
  sos_acionado: 'high',
  incidente_reportado: 'high',

  // Edição de rota pelo gestor
  rota_parada_adicionada: 'high',
  rota_parada_removida: 'normal',
  rota_parada_editada: 'high',
  rota_reordenada: 'normal',
};

Deno.serve(async (req: Request) => {
  // CORS headers
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers':
      'authorization, x-client-info, apikey, content-type',
  };

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers });
  }

  // Roda sem verify_jwt: o segredo próprio é a única porta (ver _shared/cronAuth.ts).
  const naoAutorizado = requirePushSecret(req);
  if (naoAutorizado) return naoAutorizado;

  try {
    const body = await req.json();
    // Só ids e tipo no log: título e mensagem trazem nome e endereço de cliente.
    console.log('[send-push] Recebido:', {
      tipo: body?.record?.tipo ?? 'direct',
      notificacao_id: body?.record?.id ?? null,
      usuario_id: body?.record?.usuario_id ?? body?.usuario_id ?? null,
    });

    // Inicializar Supabase client com service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = chaveSecreta();
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Determinar se é webhook do banco ou chamada direta
    let usuario_id: string;
    let titulo: string;
    let mensagem: string;
    let data: Record<string, unknown> = {};
    let notificacao_id: string | null = null;
    let tipo: string = 'direct';

    if (body.type === 'INSERT' && body.table === 'notificacoes') {
      // Webhook do banco de dados
      const record = body.record;
      usuario_id = record.usuario_id;
      titulo = record.titulo;
      mensagem = record.mensagem;
      notificacao_id = record.id;
      tipo = record.tipo;

      // Verificar se esse tipo deve gerar push
      if (!PUSH_NOTIFICATION_TYPES.includes(tipo)) {
        console.log(`[send-push] Tipo '${tipo}' não requer push, ignorando`);
        return new Response(
          JSON.stringify({
            success: true,
            skipped: true,
            reason: 'tipo_nao_requer_push',
          }),
          { headers },
        );
      }

      // Dados adicionais para deep linking
      if (record.rota_id) data.rota_id = record.rota_id;
      if (record.parada_id) data.parada_id = record.parada_id;
      data.notificacao_id = notificacao_id;
      data.tipo = tipo;
    } else if (body.usuario_id && body.titulo) {
      // Chamada direta (para testes ou uso programático)
      usuario_id = body.usuario_id;
      titulo = body.titulo;
      mensagem = body.mensagem || '';
      data = body.data || {};
    } else {
      return new Response(JSON.stringify({ error: 'Invalid request body' }), {
        status: 400,
        headers,
      });
    }

    // Preferência de push da conta (Migration 47). O SOS sempre passa; sem
    // linha vale tudo ligado; consulta que falha (inclusive a tabela ainda
    // não existir) ENVIA — o aviso importa mais (ver preferenciaDePush.ts).
    // O SOS nem consulta: a leitura não tem prazo próprio e ele não espera.
    const ehSos = categoriaDoTipo(tipo) === 'sos';
    const { preferencia, erro: preferenciaErro } = ehSos
      ? { preferencia: null, erro: null }
      : await lerPreferenciaDePush(supabase, usuario_id);
    if (preferenciaErro) {
      console.warn(
        `[send-push] Preferência não lida (usuário ${usuario_id}); enviando:`,
        preferenciaErro,
      );
    }
    const decisao = decidirEnvio({
      tipo,
      preferencia,
      erro: preferenciaErro,
    });
    if (!decisao.envia) {
      console.log(
        `[send-push] Usuário ${usuario_id} desligou este push (${decisao.motivo}), tipo '${tipo}'`,
      );
      // Sem notificacao_id na coluna: a policy de push_notification_logs
      // mostra ao gestor da loja as linhas com ele, e a preferência do
      // motorista é só dele (Migration 47). O id vai em `response`, que só o
      // admin (chave secreta) lê.
      await logPushAttempt(supabase, {
        notificacao_id: null,
        usuario_id,
        push_token: null,
        status: 'skipped',
        response: { notificacao_id, motivo: decisao.motivo },
      });
      return new Response(
        JSON.stringify({
          success: true,
          skipped: true,
          reason: 'preferencia_do_usuario',
          motivo: decisao.motivo,
        }),
        { headers },
      );
    }

    // Tokens da conta (Migration 45): um por aparelho, em push_tokens. Sem a
    // migration aplicada, cai na coluna antiga (ver tokensDaConta.ts).
    const {
      tokens,
      origem,
      erro: tokensErro,
    } = await lerTokensDaConta(supabase, usuario_id);

    if (tokensErro) {
      console.error('[send-push] Erro ao buscar tokens:', tokensErro);
      await logPushAttempt(supabase, {
        notificacao_id,
        usuario_id,
        push_token: null,
        status: 'failed',
        error_message: `Erro ao buscar tokens: ${tokensErro}`,
      });
      return new Response(JSON.stringify({ error: 'Token lookup failed' }), {
        status: 500,
        headers,
      });
    }

    if (tokens.length === 0) {
      console.log(`[send-push] Usuário ${usuario_id} sem token registrado`);
      await logPushAttempt(supabase, {
        notificacao_id,
        usuario_id,
        push_token: null,
        status: 'no_token',
        error_message: 'Usuário não tem push_token registrado',
      });
      return new Response(
        JSON.stringify({
          success: true,
          skipped: true,
          reason: 'no_push_token',
        }),
        { headers },
      );
    }

    const ticketIds: string[] = [];
    let algumEnviado = false;
    let ultimoErro: string | null = null;

    // Um envio por aparelho: a leitura do ticket (expoTicket.ts) é a do envio
    // único, e cada token morto se limpa sozinho.
    for (const token of tokens) {
      // Validar formato do token Expo
      if (!tokenNoFormatoExpo(token)) {
        console.error(
          `[send-push] Token fora do formato Expo (usuário ${usuario_id}):`,
          mascararToken(token),
        );
        await logPushAttempt(supabase, {
          notificacao_id,
          usuario_id,
          push_token: token,
          status: 'failed',
          error_message: 'Token não é um Expo Push Token válido',
        });
        ultimoErro = 'Invalid push token format';
        continue;
      }

      // Montar mensagem push
      const pushMessage: ExpoPushMessage = {
        to: token,
        title: titulo,
        body: mensagem,
        data,
        sound: 'default',
        priority: NOTIFICATION_PRIORITY[tipo] || 'normal',
        channelId: tipo === 'sos_acionado' ? 'emergencia' : 'default',
        ttl: 86400, // 24 horas
      };

      console.log('[send-push] Enviando para Expo:', {
        notificacao_id,
        usuario_id,
        tipo,
        token: mascararToken(token),
      });

      // Enviar para Expo Push Service
      const expoPushResponse = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(pushMessage),
      });

      const expoPushResult = await expoPushResponse.json();

      // Envio único: a Expo devolve `data` como objeto (ver expoTicket.ts).
      const ticket = extrairTicket(expoPushResult);
      const success = ticket.status === 'ok';
      console.log('[send-push] Resposta Expo:', {
        notificacao_id,
        usuario_id,
        http: expoPushResponse.status,
        ...resumoDoTicket(ticket),
      });

      // Token morto (app desinstalado): sai do banco para não falhar de novo
      // a cada notificação. Só se ainda for desta conta — o aparelho pode ter
      // passado a outra conta enquanto este envio estava no ar.
      if (tokenDeveSerLimpo(ticket)) {
        const limparErro = await apagarTokenMorto(
          supabase,
          usuario_id,
          token,
          origem,
        );
        if (limparErro) {
          console.error(
            `[send-push] Falha ao limpar token morto (usuário ${usuario_id}):`,
            limparErro,
          );
        } else {
          console.log(
            `[send-push] Token morto removido (usuário ${usuario_id})`,
          );
        }
      }

      if (success) {
        algumEnviado = true;
        if (ticket.id) ticketIds.push(ticket.id);
      } else {
        ultimoErro = ticket.details?.error ?? 'Falha no envio';
      }

      // Log do resultado. Resumo e código de erro, nunca a resposta crua nem
      // a `message` da Expo: no DeviceNotRegistered elas trazem o token.
      await logPushAttempt(supabase, {
        notificacao_id,
        usuario_id,
        push_token: token,
        status: success ? 'sent' : 'failed',
        response: resumoDoTicket(ticket),
        error_message: ticket.details?.error ?? (success ? null : 'erro'),
      });
    }

    // Atualizar notificação como enviada (chegou a pelo menos um aparelho)
    if (notificacao_id && algumEnviado) {
      await supabase
        .from('notificacoes')
        .update({
          push_enviado: true,
          push_enviado_at: new Date().toISOString(),
        })
        .eq('id', notificacao_id);
    }

    return new Response(
      JSON.stringify({
        success: algumEnviado,
        ticket_id: ticketIds[0] ?? null,
        ticket_ids: ticketIds,
        aparelhos: tokens.length,
        message: algumEnviado
          ? 'Push notification enviado'
          : (ultimoErro ?? 'Falha no envio'),
      }),
      { headers },
    );
  } catch (error) {
    console.error('[send-push] Erro:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: String(error),
      }),
      { status: 500, headers },
    );
  }
});

// Helper para registrar tentativa de push
async function logPushAttempt(
  supabase: ReturnType<typeof createClient>,
  data: {
    notificacao_id: string | null;
    usuario_id: string;
    push_token: string | null;
    status: 'sent' | 'failed' | 'no_token' | 'skipped';
    response?: unknown;
    error_message?: string | null;
  },
) {
  try {
    await supabase.from('push_notification_logs').insert({
      notificacao_id: data.notificacao_id,
      usuario_id: data.usuario_id,
      // Só os 6 últimos: o token inteiro bastaria para tomar o aparelho.
      push_token: data.push_token ? mascararToken(data.push_token) : null,
      status: data.status,
      response: data.response || null,
      error_message: data.error_message || null,
    });
  } catch (error) {
    console.error('[send-push] Erro ao salvar log:', error);
  }
}
