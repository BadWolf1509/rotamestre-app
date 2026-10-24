// Guarda estática da Migration 46 (o SOS chega a um gestor, ou o motorista
// sabe que não chegou). O banco único é produção e não há pgTAP: o
// comportamento se prova com a sonda transacional (`database/sondas/`), rodada
// no SQL Editor. Esta guarda impede que a migration perca, numa edição, as
// peças que fecham o B1: sem rota, os gestores de TODAS as lojas com vínculo
// ativo (e não só a do vínculo principal); com rota, só a loja da rota; o
// texto por `descricao`; o SOS nunca derrubando o INSERT do log; e a RPC que
// diz ao app quantos gestores receberam.
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const ARQUIVO = '20261024100000_sos_chega_a_um_gestor.sql';
const raiz = join(__dirname, '..', '..');
const caminhoDb = join(raiz, 'database', 'migrations', ARQUIVO);
const caminhoSupa = join(raiz, 'supabase', 'migrations', ARQUIVO);
const caminhoSonda = join(
  raiz,
  'database',
  'sondas',
  '20261024100000_sonda_migration46.sql',
);
const caminhoDoc = join(raiz, 'database', 'MIGRATIONS.md');

const ler = (p: string) =>
  existsSync(p) ? readFileSync(p, 'utf8').replace(/\r\n/g, '\n') : '';
const sql = ler(caminhoDb);
const semComentarios = (texto: string) =>
  texto
    .split('\n')
    .map((l) => l.replace(/--.*$/, ''))
    .join('\n');
// Só o que roda: o bloco ROLLBACK e o roteiro de conferência são comentados.
const executavel = semComentarios(sql);
const normaliza = (s: string) => s.replace(/\s+/g, ' ').trim();

function corpoDaFuncao(nome: string): string {
  const re = new RegExp(
    `CREATE OR REPLACE FUNCTION public\\.${nome}\\([^)]*\\)[\\s\\S]*?AS \\$\\$([\\s\\S]*?)\\$\\$;`,
  );
  return re.exec(executavel)?.[1] ?? '';
}

function cabecalhoDaFuncao(nome: string): string {
  const re = new RegExp(
    `CREATE OR REPLACE FUNCTION public\\.${nome}\\([^)]*\\)([\\s\\S]*?)AS \\$\\$`,
  );
  return normaliza(re.exec(executavel)?.[1] ?? '');
}

describe('Migration 46: o SOS chega a um gestor, ou o motorista sabe', () => {
  it('existe nas duas pastas, com conteúdo idêntico', () => {
    expect(existsSync(caminhoDb)).toBe(true);
    expect(existsSync(caminhoSupa)).toBe(true);
    expect(ler(caminhoSupa)).toBe(sql);
  });

  it('roda numa transação só', () => {
    expect(executavel).toMatch(/^\s*BEGIN;/m);
    expect(executavel).toMatch(/^\s*COMMIT;/m);
  });

  describe('avisar_gestores_do_sos (fonte única de quem recebe)', () => {
    const corpo = normaliza(corpoDaFuncao('avisar_gestores_do_sos'));

    it('existe, SECURITY DEFINER com search_path vazio', () => {
      expect(corpo).not.toBe('');
      const cab = cabecalhoDaFuncao('avisar_gestores_do_sos');
      expect(cab).toMatch(/RETURNS integer/);
      expect(cab).toMatch(/SECURITY DEFINER/);
      expect(cab).toMatch(/SET search_path = ''/);
    });

    it('com rota, a loja da rota', () => {
      expect(corpo).toMatch(
        /SELECT r\.unidade_id INTO v_unidade_id FROM public\.rotas r WHERE r\.id = p_rota_id/,
      );
    });

    it('sem loja da rota, os gestores de TODAS as lojas com vínculo ativo, sem repetir', () => {
      // nada de vínculo principal nem LIMIT: era o que deixava 10 de 11 sem aviso
      expect(corpo).not.toMatch(/is_principal/);
      expect(corpo).not.toMatch(/LIMIT/);
      expect(corpo).toMatch(
        /FROM public\.usuario_unidades uu CROSS JOIN LATERAL public\.gestores_ativos_da_unidade\(uu\.unidade_id\)/,
      );
      expect(corpo).toMatch(/uu\.usuario_id = p_motorista_id/);
      expect(corpo).toMatch(/uu\.ativo = true/);
      // UNION (não UNION ALL) tira o gestor repetido entre lojas
      expect(corpo).toMatch(/\bUNION\b(?! ALL)/);
    });

    it('o texto vem de descricao, depois motivo, depois "Emergência acionada"', () => {
      expect(corpo).toMatch(
        /COALESCE\( NULLIF\(btrim\(p_detalhes->>'descricao'\), ''\), NULLIF\(btrim\(p_detalhes->>'motivo'\), ''\), 'Emergência acionada' \)/,
      );
    });

    it('conta só a notificação que de fato nasceu', () => {
      expect(corpo).toMatch(
        /IF public\.criar_notificacao\([\s\S]*?\) IS NOT NULL THEN v_avisados := v_avisados \+ 1;/,
      );
    });

    it('nunca levanta: na falha devolve 0 (a subtransação desfez os avisos)', () => {
      expect(corpo).toMatch(/EXCEPTION WHEN OTHERS THEN[\s\S]*RETURN 0;/);
    });

    it('fechada para a API', () => {
      expect(executavel).toMatch(
        /REVOKE ALL ON FUNCTION public\.avisar_gestores_do_sos\(uuid, uuid, jsonb\) FROM PUBLIC, anon, authenticated;/,
      );
    });
  });

  describe('notify_sos_acionado (gatilho)', () => {
    const corpo = normaliza(corpoDaFuncao('notify_sos_acionado'));

    it('avisa pelo helper e grava no log quantos gestores receberam', () => {
      expect(corpo).toMatch(
        /v_avisados := public\.avisar_gestores_do_sos\(NEW\.usuario_id, NEW\.rota_id, NEW\.detalhes\);/,
      );
      expect(corpo).toMatch(
        /UPDATE public\.logs SET detalhes = COALESCE\(detalhes, '\{\}'::jsonb\) \|\| jsonb_build_object\('gestores_avisados', v_avisados\) WHERE id = NEW\.id;/,
      );
    });

    it('não decide mais a loja sozinho (nem vínculo principal, nem motivo)', () => {
      expect(corpo).not.toMatch(/is_principal/);
      expect(corpo).not.toMatch(/'motivo'/);
    });

    it('nunca derruba o INSERT do log', () => {
      expect(corpo).toMatch(
        /EXCEPTION WHEN OTHERS THEN RAISE WARNING[\s\S]*RETURN NEW;/,
      );
    });

    it('a falha do UPDATE da contagem não desfaz os avisos (bloco próprio, depois do aviso)', () => {
      // Rodada 1: no mesmo bloco, a subtransação desfaria as notificações.
      expect(corpo).toMatch(
        /v_avisados := public\.avisar_gestores_do_sos\([^;]*\); BEGIN UPDATE public\.logs [^;]*; EXCEPTION WHEN OTHERS THEN RAISE WARNING [^;]*; END;/,
      );
    });
  });

  describe('registrar_sos (RPC do app)', () => {
    const corpo = normaliza(corpoDaFuncao('registrar_sos'));
    const cab = cabecalhoDaFuncao('registrar_sos');

    it('existe e devolve quantos gestores foram avisados', () => {
      expect(corpo).not.toBe('');
      expect(cab).toMatch(/RETURNS integer/);
      expect(cab).toMatch(/SECURITY DEFINER/);
      expect(cab).toMatch(/SET search_path = ''/);
    });

    it('exige sessão e, com rota, a mesma regra da policy de INSERT', () => {
      expect(corpo).toMatch(/IF v_uid IS NULL THEN RAISE EXCEPTION/);
      expect(corpo).toMatch(
        /IF p_rota_id IS NOT NULL AND NOT public\.pode_registrar_log_na_rota\(p_rota_id\) THEN RAISE EXCEPTION/,
      );
    });

    it('grava em nome de quem chama, sem aceitar a contagem vinda do cliente', () => {
      expect(corpo).toMatch(
        /INSERT INTO public\.logs \(usuario_id, rota_id, evento, detalhes\) VALUES \(v_uid, p_rota_id, 'sos_acionado', COALESCE\(p_detalhes, '\{\}'::jsonb\) - 'gestores_avisados'\)/,
      );
    });

    it('SOS repetido em 5 s (descartado pelo prevent_duplicate_log) responde pelo SOS anterior', () => {
      expect(corpo).toMatch(/IF v_log_id IS NULL THEN/);
      expect(corpo).toMatch(
        /l\.usuario_id = v_uid AND l\.evento = 'sos_acionado' AND l\.rota_id IS NOT DISTINCT FROM p_rota_id/,
      );
    });

    it('o COMMENT diz que "avisado" é notificação criada, não push entregue', () => {
      expect(normaliza(sql)).toMatch(
        /COMMENT ON FUNCTION public\.registrar_sos\(jsonb, uuid\) IS '[^']*notificação criada[^']*não[^']*push entregue/,
      );
    });

    it('só authenticated executa', () => {
      expect(executavel).toMatch(
        /REVOKE ALL ON FUNCTION public\.registrar_sos\(jsonb, uuid\) FROM PUBLIC, anon;/,
      );
      expect(executavel).toMatch(
        /GRANT EXECUTE ON FUNCTION public\.registrar_sos\(jsonb, uuid\) TO authenticated;/,
      );
    });
  });

  it('tem sonda transacional que termina em RAISE e cobre os casos do brief', () => {
    const sonda = ler(caminhoSonda);
    expect(sonda).not.toBe('');
    expect(sonda).toMatch(/RAISE EXCEPTION 'SONDA M46 \(desfeita\):%', r;/);
    expect(sonda).toMatch(/registrar_sos/);
    // dois vínculos ativos, um inativo, e um gestor nas duas lojas
    expect(sonda).toMatch(/'motorista', false/);
    // caso 12: o UPDATE da contagem falha e os avisos ficam
    expect(sonda).toMatch(/12a OK/);
  });

  it('a sonda não usa DELETE nem DROP', () => {
    const sonda = semComentarios(ler(caminhoSonda));
    expect(sonda).not.toMatch(/\bDELETE\b/i);
    expect(sonda).not.toMatch(/\bDROP\b/i);
  });

  it('está documentada no MIGRATIONS.md', () => {
    const doc = ler(caminhoDoc);
    expect(doc).toMatch(/### .* Migration 46: /);
    expect(doc).toContain(ARQUIVO);
  });
});
