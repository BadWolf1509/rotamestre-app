/**
 * Edge Function: send-push-notification
 * Envia push notifications via Expo Push Notification Service
 *
 * Chamada via:
 * 1. Database webhook quando notificação é criada
 * 2. API direta para testes
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

interface ExpoPushTicket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
}

// Tipos de notificação que devem gerar push
const PUSH_NOTIFICATION_TYPES = [
  'nova_rota_atribuida',
  'rota_atrasada',
  'sos_acionado',
  'incidente_reportado',
];

// Configuração de prioridade por tipo
const NOTIFICATION_PRIORITY: Record<string, 'high' | 'normal'> = {
  nova_rota_atribuida: 'high',
  sos_acionado: 'high',
  incidente_reportado: 'high',
  rota_atrasada: 'normal',
};

Deno.serve(async (req: Request) => {
  // CORS headers
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers });
  }

  try {
    const body = await req.json();
    console.log('[send-push] Received:', JSON.stringify(body));

    // Inicializar Supabase client com service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
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
          JSON.stringify({ success: true, skipped: true, reason: 'tipo_nao_requer_push' }),
          { headers }
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
      return new Response(
        JSON.stringify({ error: 'Invalid request body' }),
        { status: 400, headers }
      );
    }

    // Buscar push token do usuário
    const { data: usuario, error: userError } = await supabase
      .from('usuarios')
      .select('push_token, nome')
      .eq('id', usuario_id)
      .single();

    if (userError) {
      console.error('[send-push] Erro ao buscar usuário:', userError);
      await logPushAttempt(supabase, {
        notificacao_id,
        usuario_id,
        push_token: null,
        status: 'failed',
        error_message: `Erro ao buscar usuário: ${userError.message}`,
      });
      return new Response(
        JSON.stringify({ error: 'User not found', details: userError }),
        { status: 404, headers }
      );
    }

    if (!usuario.push_token) {
      console.log(`[send-push] Usuário ${usuario.nome} não tem push_token registrado`);
      await logPushAttempt(supabase, {
        notificacao_id,
        usuario_id,
        push_token: null,
        status: 'no_token',
        error_message: 'Usuário não tem push_token registrado',
      });
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: 'no_push_token' }),
        { headers }
      );
    }

    // Validar formato do token Expo
    if (!usuario.push_token.startsWith('ExponentPushToken[')) {
      console.error(`[send-push] Token inválido: ${usuario.push_token}`);
      await logPushAttempt(supabase, {
        notificacao_id,
        usuario_id,
        push_token: usuario.push_token,
        status: 'failed',
        error_message: 'Token não é um Expo Push Token válido',
      });
      return new Response(
        JSON.stringify({ error: 'Invalid push token format' }),
        { status: 400, headers }
      );
    }

    // Montar mensagem push
    const pushMessage: ExpoPushMessage = {
      to: usuario.push_token,
      title: titulo,
      body: mensagem,
      data,
      sound: 'default',
      priority: NOTIFICATION_PRIORITY[tipo] || 'normal',
      channelId: tipo === 'sos_acionado' ? 'emergencia' : 'default',
      ttl: 86400, // 24 horas
    };

    console.log('[send-push] Enviando para Expo:', JSON.stringify(pushMessage));

    // Enviar para Expo Push Service
    const expoPushResponse = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(pushMessage),
    });

    const expoPushResult = await expoPushResponse.json();
    console.log('[send-push] Resposta Expo:', JSON.stringify(expoPushResult));

    // Processar resultado
    const ticket: ExpoPushTicket = expoPushResult.data?.[0] || expoPushResult;
    const success = ticket.status === 'ok';

    // Atualizar notificação como enviada
    if (notificacao_id && success) {
      await supabase
        .from('notificacoes')
        .update({
          push_enviado: true,
          push_enviado_at: new Date().toISOString(),
        })
        .eq('id', notificacao_id);
    }

    // Log do resultado
    await logPushAttempt(supabase, {
      notificacao_id,
      usuario_id,
      push_token: usuario.push_token,
      status: success ? 'sent' : 'failed',
      response: expoPushResult,
      error_message: ticket.message || ticket.details?.error || null,
    });

    return new Response(
      JSON.stringify({
        success,
        ticket_id: ticket.id,
        message: success ? 'Push notification enviado' : ticket.message,
      }),
      { headers }
    );
  } catch (error) {
    console.error('[send-push] Erro:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: String(error) }),
      { status: 500, headers }
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
    status: 'sent' | 'failed' | 'no_token';
    response?: unknown;
    error_message?: string | null;
  }
) {
  try {
    await supabase.from('push_notification_logs').insert({
      notificacao_id: data.notificacao_id,
      usuario_id: data.usuario_id,
      push_token: data.push_token,
      status: data.status,
      response: data.response || null,
      error_message: data.error_message || null,
    });
  } catch (error) {
    console.error('[send-push] Erro ao salvar log:', error);
  }
}
