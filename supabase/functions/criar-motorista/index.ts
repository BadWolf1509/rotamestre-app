/* global Deno */

// Edge Function para criar motorista usando Admin API
// Deploy: supabase functions deploy criar-motorista

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { desfazerContaCriada } from './compensacao.ts';
import {
  ehEmailDuplicadoNoAuth,
  normalizarEmail,
  respostaEmailJaCadastrado,
} from './emailExistente.ts';
import {
  decidirPermissao,
  MSG_CORPO_INVALIDO,
  MSG_PERMISSAO_INDISPONIVEL,
  validarCorpo,
} from './entrada.ts';
import {
  ehViolacaoTelefoneUnico,
  MSG_TELEFONE_OUTRA_LOJA,
  CODIGO_TELEFONE_JA_CADASTRADO,
  respostaTelefoneDuplicado,
} from './telefoneDuplicado.ts';
import {
  criarValidadorDeUsuario,
  exigirUsuario,
} from '../_shared/autenticacao.ts';
import { chavePublica, chaveSecreta } from '../_shared/chaves.ts';
import { CORS_PADRAO, jsonResponse, preflight } from '../_shared/http.ts';

const resposta = jsonResponse;

/** O Authorization recebido corresponde a um usuário do Auth? Qual? */
const usuarioValido = criarValidadorDeUsuario(
  createClient,
  Deno.env.get('SUPABASE_URL') ?? '',
  chavePublica,
);

serve(async (req) => {
  // Handle CORS preflight
  const respostaPreflight = preflight(req);
  if (respostaPreflight) {
    return respostaPreflight;
  }

  try {
    // Sem "Authorization: Bearer ..." ou com JWT que o Auth não reconhece, a
    // resposta é 401 antes de qualquer outra consulta; com usuário válido a
    // guarda devolve o id dele.
    const autenticacao = await exigirUsuario(req, usuarioValido, CORS_PADRAO);
    if (autenticacao instanceof Response) {
      return autenticacao;
    }
    const gestorId = autenticacao.usuario.id;

    // Cliente com a sessão de quem chama (a RLS vale): o Authorization já foi
    // conferido pela guarda acima.
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      chavePublica(),
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization') ?? '' },
        },
      },
    );

    // Cliente com a chave secreta (só disponível server-side)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      chaveSecreta(),
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );

    // Corpo: lido e validado antes de qualquer consulta (400 diz o campo).
    let corpo: unknown;
    try {
      corpo = await req.json();
    } catch {
      return resposta(400, { error: MSG_CORPO_INVALIDO });
    }
    const corpoValidado = validarCorpo(corpo);
    if (!corpoValidado.ok) {
      return resposta(corpoValidado.status, { error: corpoValidado.error });
    }
    const { nome, email, senha, telefone } = corpoValidado.dados;

    // Buscar dados do gestor
    const { data: gestorData, error: gestorError } = await supabaseClient
      .from('usuarios')
      .select('papel, unidade_id, ativo')
      .eq('id', gestorId)
      .single();

    // A loja é a que o gestor tem aberta na tela (`unidade_id`); app antigo não
    // manda e cai na principal. Nos dois casos, só com vínculo de gestor ATIVO
    // nela: esta função é a única porta de escrita em usuario_unidades, e o
    // papel/unidade_id de `usuarios` sobrevivem ao gestor sair da loja.
    const unidadeId: string | null =
      corpoValidado.dados.unidadeId ?? gestorData?.unidade_id ?? null;
    const { data: vinculoGestor, error: vinculoGestorError } = unidadeId
      ? await supabaseAdmin
          .from('usuario_unidades')
          .select('id')
          .eq('usuario_id', gestorId)
          .eq('unidade_id', unidadeId)
          .eq('papel', 'gestor')
          .eq('ativo', true)
          .maybeSingle()
      : { data: null, error: null };

    const permissao = decidirPermissao({
      erroGestor: gestorError,
      gestor: gestorData,
      unidadeId,
      erroVinculo: vinculoGestorError,
      vinculo: vinculoGestor,
    });
    if (permissao === 'indisponivel') {
      return resposta(503, { error: MSG_PERMISSAO_INDISPONIVEL });
    }
    if (permissao === 'proibido') {
      return resposta(403, {
        error: 'Apenas gestores podem criar motoristas',
      });
    }

    const emailNormalizado = normalizarEmail(email);

    // E-mail que já tem conta: recusa, nunca vincula (ver emailExistente.ts).
    // Igualdade, não ILIKE (no PostgREST `*` também é curinga): linha antiga
    // gravada com maiúscula escapa daqui, mas não do createUser, porque o Auth
    // guarda o e-mail em minúsculas e recusa a duplicata com a mesma 409.
    const { data: contasComEmail, error: emailError } = await supabaseAdmin
      .from('usuarios')
      .select('id')
      .eq('email', emailNormalizado)
      .limit(1);

    if (emailError) {
      // Sem a checagem não dá para saber se a conta já existe; não arrisca.
      return resposta(500, { error: 'Não foi possível verificar o e-mail.' });
    }

    if (contasComEmail && contasComEmail.length > 0) {
      const recusa = respostaEmailJaCadastrado();
      return resposta(recusa.status, {
        error: recusa.error,
        codigo: recusa.codigo,
      });
    }

    // Telefone já usado por motorista ativo (nunca vincula pelo telefone: só recusa)
    if (telefone?.trim()) {
      const { data: encontrados, error: telefoneError } =
        await supabaseAdmin.rpc('motorista_ativo_por_telefone', {
          p_telefone: telefone.trim(),
        });

      if (telefoneError) {
        // Não bloqueia o cadastro por falha de checagem; o índice único é a rede
        console.error(
          'Erro ao checar telefone duplicado:',
          telefoneError.message,
        );
      } else if (encontrados && encontrados.length > 0) {
        const ids = encontrados.map((m: { id: string }) => m.id);
        const { data: vinculos, error: vinculosError } = await supabaseAdmin
          .from('usuario_unidades')
          .select('usuario_id, unidade_id')
          .in('usuario_id', ids)
          .eq('ativo', true);

        if (vinculosError) {
          // Segue sem os vínculos: a decisão cai nas unidades de `encontrados`
          console.error(
            'Erro ao buscar vínculos do motorista duplicado:',
            vinculosError.message,
          );
        }

        const unidadesVinculadas: Record<string, string[]> = {};
        for (const v of vinculos ?? []) {
          (unidadesVinculadas[v.usuario_id] ??= []).push(v.unidade_id);
        }

        const duplicado = respostaTelefoneDuplicado(
          encontrados,
          unidadeId,
          unidadesVinculadas,
        );
        if (duplicado) {
          return resposta(duplicado.status, {
            error: duplicado.error,
            codigo: duplicado.codigo,
          });
        }
      }
    }

    // Conta só no Auth (sem linha em `usuarios`) é, por exemplo, um gestor no
    // meio do onboarding: o createUser abaixo recusa o e-mail e a resposta é a
    // mesma 409. Nunca apagar essa conta — apagar e recriar com a senha do
    // gestor chamador entregava o login de outra pessoa.
    const { data: authData, error: createAuthError } =
      await supabaseAdmin.auth.admin.createUser({
        email: emailNormalizado,
        password: senha.trim(),
        email_confirm: true, // Confirmar email automaticamente
        user_metadata: {
          nome: nome.trim(),
        },
      });

    if (createAuthError) {
      if (ehEmailDuplicadoNoAuth(createAuthError)) {
        const recusa = respostaEmailJaCadastrado();
        return resposta(recusa.status, {
          error: recusa.error,
          codigo: recusa.codigo,
        });
      }

      // Mensagem do Auth só no log; para fora, o motivo de negócio que o
      // gestor consegue corrigir, ou o genérico.
      console.error('[criar-motorista] createUser falhou:', createAuthError);
      const codigoAuth = (createAuthError as { code?: string }).code;
      const mensagemAuth =
        codigoAuth === 'weak_password'
          ? 'A senha não atende aos requisitos mínimos.'
          : codigoAuth === 'email_address_invalid'
            ? 'E-mail inválido.'
            : 'Não foi possível criar o usuário. Tente de novo.';
      return resposta(400, { error: mensagemAuth });
    }

    if (!authData.user) {
      return resposta(500, { error: 'Usuário não foi criado' });
    }

    // Criar registro na tabela usuarios
    const { data: usuarioData, error: insertError } = await supabaseAdmin
      .from('usuarios')
      .insert({
        id: authData.user.id,
        nome: nome.trim(),
        email: emailNormalizado,
        telefone: telefone?.trim() || null,
        papel: 'motorista',
        unidade_id: unidadeId,
        ativo: true,
      })
      .select()
      .single();

    if (insertError) {
      // Se falhar ao criar registro, deletar usuário do Auth
      await desfazerContaCriada(supabaseAdmin, authData.user.id);

      if (ehViolacaoTelefoneUnico(insertError)) {
        return resposta(409, {
          error: MSG_TELEFONE_OUTRA_LOJA,
          codigo: CODIGO_TELEFONE_JA_CADASTRADO,
        });
      }

      console.error(
        '[criar-motorista] insert em usuarios falhou:',
        insertError,
      );
      return resposta(400, {
        error: 'Não foi possível criar o motorista. Tente de novo.',
      });
    }

    // ✅ MULTI-UNIDADE: Criar vínculo em usuario_unidades
    const { error: vinculoError } = await supabaseAdmin
      .from('usuario_unidades')
      .insert({
        usuario_id: authData.user.id,
        unidade_id: unidadeId,
        papel: 'motorista',
        ativo: true,
      });

    if (vinculoError) {
      console.error(
        'Erro ao criar vínculo em usuario_unidades:',
        vinculoError.message,
      );
      // Sem vínculo o motorista não aparece na lista (que vem de
      // usuario_unidades) e o gestor não consegue criá-lo depois. Desfaz tudo:
      // apagar a conta leva junto a linha de `usuarios` (ON DELETE CASCADE).
      await desfazerContaCriada(supabaseAdmin, authData.user.id);
      return resposta(500, {
        error: 'Não foi possível vincular o motorista à loja. Tente de novo.',
      });
    }

    return resposta(200, {
      success: true,
      motorista: usuarioData,
    });
  } catch (error) {
    console.error('[criar-motorista] Erro inesperado:', error);
    return resposta(500, { error: 'Erro interno' });
  }
});
