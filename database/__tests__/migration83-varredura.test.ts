// Guarda estática da Migration 83 (varredura de 07/11/2026, banco):
//   B-1 `expire_old_pending_routes` avisa os gestores pelo vínculo ativo
//       (`gestores_ativos_da_unidade`), não pela coluna legada;
//   B-2 `remind_pending_routes` só avisa dentro da janela do horário de
//       Brasília e não repete o mesmo aviso para a mesma rota no dia;
//   B-4 o gatilho da Migration 76 recusa concluir rota com parada real aberta
//       (P0001 ROTA_PARADAS_PENDENTES), sem quebrar a `finalizar_rota`;
//   B-5 `limpar_notificacoes_antigas` apaga notificação lida e log de push
//       antigos, em lotes, chamada pela Edge Function `expire-routes`.
// O comportamento se prova com a sonda (desfeita pelo RAISE). Esta guarda
// impede que a coluna legada volte ao loop de gestores, que a janela ou a
// idempotência saiam do lembrete, que a recusa de paradas pendentes saia do
// gatilho (ou passe a valer para sessão sem usuário), que a ACL mude e que as
// cópias divirjam.
import { join } from 'path';

import {
  CAMINHO_DOC,
  RAIZ,
  carregarMigration,
  itExisteNasDuasPastas,
  ler,
  lerSonda,
} from './_helpers/migration';

const ARQUIVO = '20261107120000_varredura_07_11_banco.sql';

const m = carregarMigration(ARQUIVO);
const { executavel, rollback } = m;
const sonda = lerSonda('20261107120000_sonda_migration83.sql');
const expireRoutes = ler(
  join(RAIZ, 'supabase', 'functions', 'expire-routes', 'index.ts'),
);

const corpoDe = (inicio: string): string => {
  const i = executavel.indexOf(inicio);
  if (i < 0) return '';
  const fim = executavel.indexOf('$$;', i);
  return executavel.slice(i, fim < 0 ? undefined : fim);
};

const expire = corpoDe(
  'CREATE OR REPLACE FUNCTION public.expire_old_pending_routes(',
);
const lembrar = corpoDe(
  'CREATE OR REPLACE FUNCTION public.lembrar_rotas_no_horario(',
);
const remind = corpoDe(
  'CREATE OR REPLACE FUNCTION public.remind_pending_routes(',
);
const gatilho = corpoDe(
  'CREATE OR REPLACE FUNCTION public.rota_status_pelo_gestor(',
);
const limpar = corpoDe(
  'CREATE OR REPLACE FUNCTION public.limpar_notificacoes_antigas(',
);

describe('Migration 83: varredura de 07/11 (banco)', () => {
  itExisteNasDuasPastas(m);

  it('roda numa transação só, com lock_timeout logo depois do BEGIN', () => {
    expect(executavel).toMatch(/^\s*BEGIN;\s+SET LOCAL lock_timeout = '3s';/m);
    expect(executavel).toMatch(/^\s*COMMIT;/m);
  });

  it('define as cinco funções', () => {
    for (const corpo of [expire, lembrar, remind, gatilho, limpar]) {
      expect(corpo).not.toBe('');
    }
  });
});

describe('B-1: expire_old_pending_routes avisa pelo vínculo ativo', () => {
  it('mesma assinatura, retorno, DEFINER e search_path de antes', () => {
    expect(expire).toMatch(
      /expire_old_pending_routes\(p_dry_run boolean DEFAULT false\)\s+RETURNS TABLE\(\s*expired_count integer,\s*notifications_sent integer\s*\)/i,
    );
    expect(expire).toMatch(/SECURITY DEFINER/);
    expect(expire).toMatch(/SET search_path = public/);
  });

  it('o loop de gestores usa gestores_ativos_da_unidade, sem a coluna legada', () => {
    expect(expire).toMatch(
      /FOR g IN\s+SELECT ga\.id\s+FROM public\.gestores_ativos_da_unidade\(r\.unidade_id\) AS ga\(id\)\s+LOOP/,
    );
    expect(expire).not.toMatch(/papel\s*=\s*'gestor'/);
    expect(expire).not.toMatch(/WHERE unidade_id = r\.unidade_id/);
  });

  it('o resto do corpo é o da Migration 25 (predicados, textos, dry-run)', () => {
    expect(expire).toMatch(
      /OR \(ro\.data = v_hoje AND v_hora >= TIME '22:00'\)/,
    );
    expect(expire).toMatch(
      /ro\.status = 'em_andamento'\s+AND ro\.data <= v_hoje - 7/,
    );
    expect(expire).toMatch(/'⚠️ Rota abandonada'/);
    expect(expire).toMatch(/'⚠️ Rota não executada'/);
    expect(expire).toMatch(/IF NOT p_dry_run THEN\s+UPDATE rotas/);
    expect(expire.match(/PERFORM criar_notificacao\(/g)).toHaveLength(2);
  });

  it('ACL: só service_role executa', () => {
    expect(executavel).toMatch(
      /REVOKE ALL ON FUNCTION public\.expire_old_pending_routes\(boolean\) FROM PUBLIC, anon, authenticated;/,
    );
    expect(executavel).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.expire_old_pending_routes\(boolean\) TO service_role;/,
    );
  });
});

describe('B-2: lembrete só na janela e uma vez por dia', () => {
  it('a decisão mora numa função com o instante como argumento, sem DEFINER', () => {
    expect(lembrar).toMatch(
      /lembrar_rotas_no_horario\(p_urgency text, p_agora timestamptz\)\s+RETURNS TABLE\(\s*routes_found integer,\s*reminders_sent integer\s*\)/,
    );
    expect(lembrar).not.toMatch(/SECURITY DEFINER/);
    expect(lembrar).toMatch(/SET search_path = public/);
    expect(lembrar).toMatch(
      /v_local := p_agora AT TIME ZONE 'America\/Sao_Paulo';/,
    );
    expect(lembrar).not.toMatch(/\bnow\(\)/);
  });

  it('janelas: normal de 15:00 a 20:00, final de 19:00 a 22:00 (Brasília)', () => {
    expect(lembrar).toMatch(
      /IF p_urgency = 'final' THEN\s+v_na_janela := v_hora >= TIME '19:00' AND v_hora < TIME '22:00';\s+ELSE\s+v_na_janela := v_hora >= TIME '15:00' AND v_hora < TIME '20:00';\s+END IF;/,
    );
    const guarda = lembrar.indexOf('IF NOT v_na_janela THEN');
    const loop = lembrar.indexOf('FOR r IN');
    expect(guarda).toBeGreaterThan(-1);
    expect(loop).toBeGreaterThan(guarda);
    expect(lembrar.slice(guarda, loop)).toMatch(/RETURN NEXT;\s+RETURN;/);
  });

  it('não repete o mesmo aviso para a mesma rota e o mesmo motorista no dia', () => {
    expect(lembrar).toMatch(
      /v_inicio_do_dia := v_hoje::timestamp AT TIME ZONE 'America\/Sao_Paulo';/,
    );
    expect(lembrar).toMatch(
      /AND NOT EXISTS \(\s*SELECT 1\s+FROM notificacoes n\s+WHERE n\.rota_id = ro\.id\s+AND n\.usuario_id = ro\.motorista_id\s+AND n\.tipo = v_tipo_notificacao\s+AND n\.created_at >= v_inicio_do_dia\s*\)/,
    );
  });

  it('os predicados e textos da Migration 26 ficam', () => {
    expect(lembrar).toMatch(
      /\(ro\.status = 'pendente' AND ro\.data = v_hoje\)/,
    );
    expect(lembrar).toMatch(
      /\(ro\.status = 'em_andamento' AND ro\.data <= v_hoje - 7\)/,
    );
    expect(lembrar).toMatch(/'🚨 URGENTE: Rota expira em 2 horas!'/);
    expect(lembrar).toMatch(/'⏰ Lembrete: Rota em aberto!'/);
  });

  it('remind_pending_routes mantém a assinatura e delega com now()', () => {
    expect(remind).toMatch(
      /remind_pending_routes\(p_urgency text DEFAULT 'normal'\)\s+RETURNS TABLE\(\s*routes_found integer,\s*reminders_sent integer\s*\)/,
    );
    expect(remind).toMatch(/SECURITY DEFINER/);
    expect(remind).toMatch(
      /RETURN QUERY\s+SELECT l\.routes_found, l\.reminders_sent\s+FROM public\.lembrar_rotas_no_horario\(p_urgency, now\(\)\) AS l;/,
    );
  });

  it('ACL: remind só service_role; a interna, ninguém além do dono', () => {
    expect(executavel).toMatch(
      /REVOKE ALL ON FUNCTION public\.remind_pending_routes\(text\) FROM PUBLIC, anon, authenticated;/,
    );
    expect(executavel).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.remind_pending_routes\(text\) TO service_role;/,
    );
    expect(executavel).toMatch(
      /REVOKE ALL ON FUNCTION public\.lembrar_rotas_no_horario\(text, timestamptz\) FROM PUBLIC, anon, authenticated, service_role;/,
    );
    expect(executavel).not.toMatch(/GRANT [^;]*lembrar_rotas_no_horario[^;]*;/);
  });
});

describe('B-4: concluir rota com parada real aberta é recusado no gatilho', () => {
  it('mesma função da Migration 76 (DEFINER, search_path vazio)', () => {
    expect(gatilho).toMatch(/RETURNS trigger/);
    expect(gatilho).toMatch(/SECURITY DEFINER/);
    expect(gatilho).toMatch(/SET search_path = ''/);
  });

  it('sessão sem usuário passa antes da conferência; a conferência vem antes do gestor', () => {
    const semUsuario = gatilho.search(
      /IF v_uid IS NULL THEN\s+RETURN NEW;\s+END IF;/,
    );
    const conferencia = gatilho.indexOf("IF NEW.status = 'concluida' THEN");
    const gestor = gatilho.search(/uu\.papel::text = 'gestor'/);
    expect(semUsuario).toBeGreaterThan(-1);
    expect(conferencia).toBeGreaterThan(semUsuario);
    expect(gestor).toBeGreaterThan(conferencia);
  });

  it('conta parada real aberta como a finalizar_rota e recusa com ROTA_PARADAS_PENDENTES', () => {
    expect(gatilho).toMatch(
      /FROM public\.paradas p\s+WHERE p\.rota_id = OLD\.id\s+AND p\.is_checkpoint IS DISTINCT FROM false\s+AND p\.status IN \('pendente', 'em_andamento'\);/,
    );
    expect(gatilho).toMatch(
      /RAISE EXCEPTION 'ROTA_PARADAS_PENDENTES: não é possível concluir a rota com % parada\(s\) pendente\(s\)\.', v_pendentes\s+USING ERRCODE = 'P0001'/,
    );
  });

  it('as transições da Migration 76 seguem', () => {
    expect(gatilho).toMatch(
      /IF \(OLD\.status = 'pendente' AND NEW\.status = 'em_andamento'\)\s+OR \(OLD\.status = 'em_andamento' AND NEW\.status = 'concluida'\) THEN\s+RETURN NEW;/,
    );
    expect(gatilho).toMatch(/RAISE EXCEPTION 'ROTA_TRANSICAO_RECUSADA'/);
  });

  it('ACL de antes: ninguém da API executa a função do gatilho', () => {
    expect(executavel).toMatch(
      /REVOKE ALL ON FUNCTION public\.rota_status_pelo_gestor\(\) FROM PUBLIC, anon, authenticated;/,
    );
    // O gatilho em si não muda (só a função).
    expect(executavel).not.toMatch(/CREATE TRIGGER/);
  });
});

describe('B-5: limpar_notificacoes_antigas', () => {
  it('assinatura, retorno jsonb, DEFINER e search_path', () => {
    expect(limpar).toMatch(
      /limpar_notificacoes_antigas\(\s*p_dias_lidas integer DEFAULT 90,\s*p_dias_push_logs integer DEFAULT 30\s*\)\s+RETURNS jsonb/,
    );
    expect(limpar).toMatch(/SECURITY DEFINER/);
    expect(limpar).toMatch(/SET search_path = public/);
  });

  it('recusa retenção abaixo do mínimo (30 dias lidas, 7 dias logs)', () => {
    expect(limpar).toMatch(/IF p_dias_lidas IS NULL OR p_dias_lidas < 30 THEN/);
    expect(limpar).toMatch(
      /IF p_dias_push_logs IS NULL OR p_dias_push_logs < 7 THEN/,
    );
  });

  it('apaga em lotes, só notificação lida e log antigos', () => {
    expect(limpar).toMatch(/LIMIT c_lote/);
    expect(
      limpar.match(/EXIT WHEN v_n < c_lote OR v_lotes >= c_max_lotes;/g),
    ).toHaveLength(2);
    expect(limpar).toMatch(
      /WHERE n2\.lida = true\s+AND n2\.created_at < v_corte_lidas/,
    );
    expect(limpar).toMatch(/WHERE l2\.created_at < v_corte_logs/);
  });

  it('ACL: só service_role executa; índice de created_at nos logs', () => {
    expect(executavel).toMatch(
      /REVOKE ALL ON FUNCTION public\.limpar_notificacoes_antigas\(integer, integer\) FROM PUBLIC, anon, authenticated;/,
    );
    expect(executavel).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.limpar_notificacoes_antigas\(integer, integer\) TO service_role;/,
    );
    expect(executavel).toMatch(
      /CREATE INDEX IF NOT EXISTS idx_push_notification_logs_created_at\s+ON public\.push_notification_logs \(created_at\);/,
    );
  });

  it('a expire-routes chama a limpeza depois da de posições, sem derrubar a resposta', () => {
    const posicoes = expireRoutes.indexOf("rpc('limpar_localizacoes_antigas')");
    const notificacoes = expireRoutes.search(
      /rpc\(\s*'limpar_notificacoes_antigas',?\s*\)/,
    );
    expect(posicoes).toBeGreaterThan(-1);
    expect(notificacoes).toBeGreaterThan(posicoes);
    const trecho = expireRoutes.slice(notificacoes, notificacoes + 600);
    expect(trecho).toMatch(/if \(limpezaNotificacoes\.error\)/);
    expect(trecho).not.toMatch(/throw/);
  });
});

describe('Migration 83: COMMENT, rollback, sonda e documentação', () => {
  it('cada função tem COMMENT da Migration 83', () => {
    for (const assinatura of [
      'public.expire_old_pending_routes(boolean)',
      'public.lembrar_rotas_no_horario(text, timestamptz)',
      'public.remind_pending_routes(text)',
      'public.rota_status_pelo_gestor()',
      'public.limpar_notificacoes_antigas(integer, integer)',
    ]) {
      const i = executavel.indexOf(`COMMENT ON FUNCTION ${assinatura} IS`);
      expect(i).toBeGreaterThan(-1);
      expect(executavel.slice(i, i + 200)).toMatch(/IS\s+'Migration 83/);
    }
  });

  it('rollback colável: corpos anteriores e DROP das novas', () => {
    expect(rollback).toMatch(
      /CREATE OR REPLACE FUNCTION public\.expire_old_pending_routes\(/,
    );
    expect(rollback).toMatch(/AND papel = 'gestor'/);
    expect(rollback).toMatch(
      /CREATE OR REPLACE FUNCTION public\.remind_pending_routes\(/,
    );
    expect(rollback).toMatch(
      /CREATE OR REPLACE FUNCTION public\.rota_status_pelo_gestor\(\)/,
    );
    expect(rollback).toMatch(
      /DROP FUNCTION IF EXISTS public\.lembrar_rotas_no_horario\(text, timestamptz\);/,
    );
    expect(rollback).toMatch(
      /DROP FUNCTION IF EXISTS public\.limpar_notificacoes_antigas\(integer, integer\);/,
    );
    expect(rollback).toMatch(
      /DROP INDEX IF EXISTS public\.idx_push_notification_logs_created_at;/,
    );
  });

  it('sonda transacional desfeita pelo RAISE, com o resumo N OK | N FALHOU', () => {
    expect(sonda).toMatch(/^DO \$\$/m);
    expect(sonda).toMatch(
      /RAISE EXCEPTION 'SONDA M83 \(desfeita\): % OK \| % FALHOU/,
    );
    for (const termo of [
      'expire_old_pending_routes(',
      'lembrar_rotas_no_horario(',
      'finalizar_rota(',
      'limpar_notificacoes_antigas(',
      'ROTA_PARADAS_PENDENTES',
    ]) {
      expect(sonda).toContain(termo);
    }
    expect(sonda).not.toMatch(/^\s*COMMIT;/m);
  });

  it('MIGRATIONS.md registra a 83 como não aplicada', () => {
    const doc = ler(CAMINHO_DOC);
    expect(doc).toMatch(/### ⏳ Migration 83:/);
    expect(doc).toContain(ARQUIVO);
  });
});
