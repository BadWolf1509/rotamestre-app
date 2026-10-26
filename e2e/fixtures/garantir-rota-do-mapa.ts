import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import {
  decidirRestauracao,
  diaLocal,
  type RotaDoFixture,
} from './decidirRestauracao';
import { contarEntregasAbertas } from './entregasAbertas';
import {
  chaveDaCopia,
  escolherRotaDoMapa,
  montarParadasDaCopia,
  type ParadaDoModelo,
  type PlanoDaRotaDoMapa,
  type RotaCandidata,
} from './planoDaRotaDoMapa';

/**
 * Garante que o motorista de E2E tenha uma rota cujo mapa monta.
 *
 * POR QUE EXISTE: em 01/09/2026 o `renders motorista mapa` começou a falhar em
 * **todo** PR, com "Mapa não montou: o motorista de teste precisa ter rota
 * ativa". Não era regressão de código — a rota que servia de fixture era um
 * registro semeado à mão em produção, e a regra de expiração criada em 31/08
 * (migrations 25 e 26) a encerrou por estar aberta há 24 dias. O sistema fez o
 * certo; o fixture é que dependia de uma rota permanentemente aberta, condição
 * que o produto não permite mais.
 *
 * POR QUE `em_andamento` COM DATA RECENTE, e não outra coisa. Cruzando as regras
 * de expiração, é o único estado estável:
 *
 *   pendente     + data  = hoje       -> expira às 22:00 de hoje
 *   pendente     + data  < hoje       -> expira na próxima execução
 *   em_andamento + data <= hoje - 7   -> expira na próxima execução
 *   em_andamento + data  > hoje - 7   -> SOBREVIVE
 *
 * Por isso não serve reativar pelo caminho do app (`useMapaRotaHandlers` deixa
 * `pendente` datada de hoje): correto como produto — dá ao motorista o dia de
 * hoje —, inútil como fixture, porque morre às 22:00.
 *
 * POSTURA: isto faz o CI **escrever no banco de produção**, que é o único que
 * existe. A escrita é a menor possível e idempotente: com rota aberta, um
 * UPDATE de status/data nela. Sem rota aberta — a rota demo encerrada —, uma
 * CÓPIA da encerrada mais recente pela RPC do painel (`criar_rota_com_paradas`),
 * iniciada como o app (`pendente → em_andamento`). Desde a Migration 75 rota
 * `cancelada`/`concluida`/`nao_executada` não muda de status por UPDATE da API
 * (P0001 ROTA_ENCERRADA); reabrir a encerrada, como o fixture fazia até
 * 26/10/2026, deixou de ser possível. A cópia acumula uma rota por vez que a
 * demo se encerra (o histórico do motorista demo cresce), e nunca existe mais
 * de uma aberta: o fixture só cria quando não há rota aberta, e usa a mesma
 * que o app abre (ver `planoDaRotaDoMapa.ts`). Se um dia houver staging, isto
 * deve apontar para lá.
 *
 * COMPARE-AND-SET. PRs concorrentes rodam este fixture ao mesmo tempo sobre a
 * MESMA linha (há uma só rota demo): um PR lê 'concluida' e outro já a reabriu,
 * e o UPDATE cego do primeiro sobrescreveria o estado do segundo — ou o
 * restauraria de volta. Por isso os UPDATEs só pegam a linha se ela ainda está
 * no estado que foi LIDO (`.eq('status', lido)`) e devolvem as linhas tocadas
 * (`.select('id')`): 0 linhas = alguém mudou antes, e a decisão é reler, não
 * insistir. Também ficam presos à unidade demo, para que um motorista com
 * vínculo em outra loja nunca leve a escrita para fora dela. `paradas` não tem
 * `unidade_id` (a RLS decide por `rotas.unidade_id`); o escopo vem do
 * `rota_id`, que já é da demo.
 */

const UNIDADE_DEMO = 'aaaa0000-0000-4000-8000-000000000001';

function exigirEnv(nome: string): string {
  const valor = process.env[nome];
  if (!valor) {
    throw new Error(
      `${nome} não está definida — o fixture do mapa não tem como preparar o cenário.`,
    );
  }
  return valor;
}

export interface ResultadoDoFixture {
  /** O que foi feito com a ROTA ('criada' = cópia da encerrada `statusAntes`). */
  acao: 'nada-a-fazer' | 'restaurada' | 'criada';
  /** O que foi feito com as PARADAS — independente da rota. */
  paradas: 'nada-a-fazer' | 'reabertas';
  rotaId: string;
  statusAntes: string;
  dataAntes: string;
  iniciadaAntes: string | null;
  pendentesAntes: number;
}

/**
 * Idempotente: só escreve quando o estado não serve. Devolve o que fez, para o
 * teste registrar — fixture que age em silêncio esconde a causa quando falha.
 */
export async function garantirRotaDoMapa(): Promise<ResultadoDoFixture> {
  const supabase = createClient(
    exigirEnv('EXPO_PUBLIC_SUPABASE_URL'),
    exigirEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY'),
    { auth: { persistSession: false } },
  );

  const { error: erroLogin } = await supabase.auth.signInWithPassword({
    email: exigirEnv('E2E_GESTOR_EMAIL'),
    password: exigirEnv('E2E_GESTOR_PASSWORD'),
  });
  if (erroLogin) {
    throw new Error(`Login do gestor falhou no fixture: ${erroLogin.message}`);
  }

  // O motorista é achado pela unidade, não por e-mail: a credencial é secreta e
  // o e-mail de login não precisa coincidir com o cadastro.
  //
  // ATENÇÃO ao `ativo` e à ordenação. Isto já era um `.limit(1)` sem `order by`
  // — coin flip do Postgres — e funcionava só porque a unidade demo tinha um
  // motorista só. Em 05/09/2026 um segundo motorista foi cadastrado ali (teste
  // de gestão de equipe, depois desativado) e o fixture o escolheu: ele não
  // tinha rota nenhuma, e o `renders motorista mapa` quebrou num PR que não
  // tinha nada a ver. Agora: só motorista ATIVO (inativo não executa rota, logo
  // nunca é o cenário), ordem estável, e quem decide é ter rota — não a sorte.
  const { data: motoristas, error: erroMotorista } = await supabase
    .from('usuarios')
    .select('id, nome')
    .eq('unidade_id', UNIDADE_DEMO)
    .eq('papel', 'motorista')
    .eq('ativo', true)
    .order('created_at', { ascending: true });

  if (erroMotorista) {
    throw new Error(
      `Não foi possível ler o motorista: ${erroMotorista.message}`,
    );
  }
  if (!motoristas?.length) {
    throw new Error(
      'Nenhum motorista ativo na unidade demo. O cenário do mapa não existe — ' +
        'isto é problema de dado, não do teste.',
    );
  }

  let motorista: (typeof motoristas)[number] | null = null;
  let plano: PlanoDaRotaDoMapa<RotaCandidata> = { tipo: 'sem-rota' };

  for (const candidato of motoristas) {
    // Todas as abertas entram na conta (o app abre a em_andamento de data
    // MAIS ANTIGA, não a mais recente); as encerradas mais recentes vêm junto
    // para servir de modelo quando não há aberta.
    const { data: rotas, error: erroRota } = await supabase
      .from('rotas')
      .select('id, status, data, created_at, iniciada_em, concluida_em')
      .eq('motorista_id', candidato.id)
      .eq('unidade_id', UNIDADE_DEMO)
      .order('data', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(50);

    if (erroRota) {
      throw new Error(`Não foi possível ler as rotas: ${erroRota.message}`);
    }
    const abertasForaDoLote = await contarAbertasForaDoLote(
      supabase,
      candidato.id,
      rotas ?? [],
    );
    if (abertasForaDoLote > 0) {
      throw new Error(
        `O motorista demo tem ${abertasForaDoLote} rota(s) aberta(s) além das ` +
          '50 mais recentes. Encerre as antigas antes — o app abriria uma delas.',
      );
    }
    plano = escolherRotaDoMapa(rotas ?? []);
    if (plano.tipo !== 'sem-rota') {
      motorista = candidato;
      break;
    }
  }

  if (!motorista || plano.tipo === 'sem-rota') {
    // Deliberadamente NÃO cria rota do nada: sem modelo, fabricar dado aqui
    // esconderia um problema real de cadastro atrás de um teste verde.
    const nomes = motoristas.map((m) => m.nome).join(', ');
    throw new Error(
      `Nenhum motorista ativo da unidade demo tem rota (${nomes}). O fixture ` +
        'restaura ou copia a rota demo, não inventa cenário — crie a rota demo antes.',
    );
  }
  const hoje = new Date();
  const hojeStr = diaLocal(hoje);

  if (plano.tipo === 'criar') {
    return criarCopiaEmAndamento(supabase, motorista.id, plano.modelo, hoje);
  }
  const rota: RotaDoFixture & { id: string } = plano.rota;

  // NÃO BASTA A ROTA ESTAR ATIVA — ela precisa ter parada pendente.
  //
  // POR QUE. Até 17/09/2026 este fixture olhava só `rotas.status` e `rotas.data`.
  // Restaurar uma rota CONCLUÍDA a devolve para `em_andamento` sem tocar nas
  // paradas, que seguem todas `concluida`: uma rota "em andamento" sem nada a
  // fazer. O mapa monta e o `renders motorista mapa` passa, mas as telas que
  // dependem de parada pendente ficam vazias — cinco testes de
  // `motorista-route-execution.e2e.ts` passaram a falhar com "element(s) not
  // found" em vez de pular pelo `test.skip(!temLista)`.
  //
  // Pior: o estado se auto-perpetuava. Com a rota já `em_andamento`, o fixture
  // respondia `nada-a-fazer` indefinidamente, porque a rota sozinha servia —
  // então ninguém consertava e o vermelho reaparecia em PR sem relação.
  const { data: paradas, error: erroParadas } = await supabase
    .from('paradas')
    .select('id, status, is_checkpoint')
    .eq('rota_id', rota.id);

  if (erroParadas) {
    throw new Error(`Não foi possível ler as paradas: ${erroParadas.message}`);
  }
  if (!paradas?.length) {
    throw new Error(
      `A rota ${rota.id} não tem parada nenhuma. O fixture restaura estado, ` +
        'não inventa cenário — recrie a rota demo.',
    );
  }

  // Só as ENTREGAS (`is_checkpoint=true`): partida e chegada ficam `pendente`
  // numa rota de entregas todas concluídas e enganavam este critério.
  const pendentesAntes = contarEntregasAbertas(paradas);

  // A ROTA TAMBÉM PRECISA SER COERENTE, não só ativa. Até 19/10/2026 a
  // restauração tocava `status` e `data` e deixava `iniciada_em`/`concluida_em`
  // da execução original — a rota demo, concluída em 11/09, voltou como
  // "em andamento desde 11/09", e a Início do motorista mostrava "916h" de
  // tempo em rota (`getElapsedTime` em `app/motorista/_screens/inicio.tsx`).
  // Mesma armadilha das paradas acima: com status e data servindo, o fixture
  // respondia `nada-a-fazer` e o vestígio nunca saía. O produto não produz
  // esse estado — `startRoute` sempre grava `iniciada_em`, e a reativação do
  // gestor zera os dois — então a coerência entra no critério. A janela de
  // `iniciada_em` é a mesma de `data`; a expiração não lê nenhum dos dois
  // timestamps (só `status` e `data`), então gravá-los não muda quando a rota
  // expira.
  const decisao = decidirRestauracao(rota, pendentesAntes, hoje);
  let rotaServe = !decisao.restaurarRota;
  const paradasServem = !decisao.reabrirParadas;

  if (!rotaServe) {
    // Compare-and-set: só restaura se a rota ainda está no status que lemos.
    const { data: tocadas, error: erroUpdate } = await supabase
      .from('rotas')
      .update({
        status: 'em_andamento',
        data: hojeStr,
        iniciada_em: hoje.toISOString(),
        concluida_em: null,
      })
      .eq('id', rota.id)
      .eq('unidade_id', UNIDADE_DEMO)
      .eq('status', rota.status)
      .select('id');

    if (erroUpdate) {
      throw new Error(
        `Não foi possível restaurar a rota: ${erroUpdate.message}`,
      );
    }
    if (!tocadas?.length) {
      // Outro PR mudou a rota entre a leitura e a escrita. Se o estado atual já
      // serve, seguimos; senão não há o que afirmar sobre o cenário.
      const { data: relida, error: erroRelida } = await supabase
        .from('rotas')
        .select('status, data, iniciada_em, concluida_em')
        .eq('id', rota.id)
        .eq('unidade_id', UNIDADE_DEMO)
        .maybeSingle();
      if (erroRelida) {
        throw new Error(`Não foi possível reler a rota: ${erroRelida.message}`);
      }
      if (
        !relida ||
        decidirRestauracao(relida, pendentesAntes, hoje).restaurarRota
      ) {
        throw new Error(
          `O estado da rota ${rota.id} mudou durante a fixture (era ` +
            `'${rota.status}') e o novo estado não serve ao mapa. Outro PR ` +
            'pode estar mexendo na rota demo — rode de novo.',
        );
      }
      rotaServe = true;
    }
  }

  if (!paradasServem) {
    // Reabre só as paradas não pendentes (`.neq('status', 'pendente')`) e limpa
    // os vestígios de conclusão dessas mesmas linhas: parada `pendente`
    // com `concluida_em` ou foto de comprovante é a mesma classe de incoerência
    // que esta correção existe para eliminar. O arquivo em storage fica órfão,
    // e tudo bem — órfão é inerte, e este fixture nunca limpou storage.
    const { error: erroReabrir } = await supabase
      .from('paradas')
      .update({
        status: 'pendente',
        concluida_em: null,
        foto_url: null,
        motivo_skip: null,
      })
      .eq('rota_id', rota.id)
      .neq('status', 'pendente')
      .select('id');

    if (erroReabrir) {
      throw new Error(
        `Não foi possível reabrir as paradas: ${erroReabrir.message}`,
      );
    }
  }

  return {
    acao: rotaServe ? 'nada-a-fazer' : 'restaurada',
    paradas: paradasServem ? 'nada-a-fazer' : 'reabertas',
    rotaId: rota.id,
    statusAntes: rota.status,
    dataAntes: rota.data,
    iniciadaAntes: rota.iniciada_em,
    pendentesAntes,
  };
}

const STATUS_ABERTOS = ['pendente', 'em_andamento'];

/**
 * Abertas do motorista na loja demo que ficaram fora do lote lido. Sem isso, um
 * lote só de encerradas faria o fixture criar uma cópia enquanto uma rota
 * aberta antiga continua lá — e o app abriria a antiga.
 */
async function contarAbertasForaDoLote(
  supabase: SupabaseClient,
  motoristaId: string,
  lote: ReadonlyArray<{ status: string }>,
): Promise<number> {
  const { count, error } = await supabase
    .from('rotas')
    .select('id', { count: 'exact', head: true })
    .eq('motorista_id', motoristaId)
    .eq('unidade_id', UNIDADE_DEMO)
    .in('status', STATUS_ABERTOS);
  if (error) {
    throw new Error(
      `Não foi possível contar as rotas abertas: ${error.message}`,
    );
  }
  const noLote = lote.filter((r) => STATUS_ABERTOS.includes(r.status)).length;
  return Math.max(0, (count ?? 0) - noLote);
}

/**
 * Sem rota aberta: copia a encerrada mais recente pela RPC do painel e a
 * inicia como o app. A chave idempotente vem do modelo (`chaveDaCopia`), então
 * dois PRs concorrentes recebem a MESMA rota da RPC; o início é compare-and-set
 * (`.eq('status', 'pendente')`), e 0 linhas com a rota já `em_andamento` é o
 * outro PR que chegou antes.
 */
async function criarCopiaEmAndamento(
  supabase: SupabaseClient,
  motoristaId: string,
  modelo: RotaCandidata,
  hoje: Date,
): Promise<ResultadoDoFixture> {
  const { data: dadosModelo, error: erroModelo } = await supabase
    .from('rotas')
    .select('distancia_total, tempo_total, polyline')
    .eq('id', modelo.id)
    .eq('unidade_id', UNIDADE_DEMO)
    .maybeSingle();
  if (erroModelo || !dadosModelo) {
    throw new Error(
      `Não foi possível ler a rota modelo ${modelo.id}: ` +
        (erroModelo?.message ?? 'não encontrada'),
    );
  }

  const { data: paradasModelo, error: erroParadas } = await supabase
    .from('paradas')
    .select(
      'tipo, endereco, latitude, longitude, ordem, is_checkpoint, destinatario, telefone, observacoes, status',
    )
    .eq('rota_id', modelo.id)
    .returns<(ParadaDoModelo & { status: string })[]>();
  if (erroParadas || !paradasModelo?.length) {
    throw new Error(
      `Não foi possível ler as paradas da rota modelo ${modelo.id}: ` +
        (erroParadas?.message ?? 'nenhuma parada'),
    );
  }

  const { data: criada, error: erroCriar } = await supabase.rpc(
    'criar_rota_com_paradas',
    {
      p_request_id: chaveDaCopia(modelo.id),
      p_unidade_id: UNIDADE_DEMO,
      p_motorista_id: motoristaId,
      p_data: diaLocal(hoje),
      p_distancia_total: dadosModelo.distancia_total,
      p_tempo_total: dadosModelo.tempo_total,
      p_polyline: dadosModelo.polyline,
      p_paradas: montarParadasDaCopia(paradasModelo),
    },
  );
  const rotaId = (criada as { success?: boolean; rota_id?: string } | null)
    ?.rota_id;
  if (erroCriar || !rotaId) {
    throw new Error(
      `Não foi possível criar a cópia da rota demo ${modelo.id}: ` +
        (erroCriar?.message ?? 'a RPC não devolveu rota_id'),
    );
  }

  // Início como o app (`startRoute`): só se ainda pendente.
  const agoraIso = hoje.toISOString();
  const { data: iniciadas, error: erroIniciar } = await supabase
    .from('rotas')
    .update({ status: 'em_andamento', iniciada_em: agoraIso })
    .eq('id', rotaId)
    .eq('unidade_id', UNIDADE_DEMO)
    .eq('status', 'pendente')
    .select('id');
  if (erroIniciar) {
    throw new Error(`Não foi possível iniciar a cópia: ${erroIniciar.message}`);
  }
  if (!iniciadas?.length) {
    const { data: relida } = await supabase
      .from('rotas')
      .select('status')
      .eq('id', rotaId)
      .eq('unidade_id', UNIDADE_DEMO)
      .maybeSingle();
    if (relida?.status !== 'em_andamento') {
      throw new Error(
        `A cópia ${rotaId} não ficou em andamento (está ` +
          `'${relida?.status ?? 'ausente'}'). Outro PR pode estar mexendo na ` +
          'rota demo — rode de novo.',
      );
    }
  } else {
    // Partida (ordem 0) concluída, como o `startRoute` faz.
    const { error: erroPartida } = await supabase
      .from('paradas')
      .update({ status: 'concluida', concluida_em: agoraIso })
      .eq('rota_id', rotaId)
      .eq('ordem', 0)
      .eq('is_checkpoint', false)
      .eq('status', 'pendente');
    if (erroPartida) {
      throw new Error(
        `Não foi possível concluir a partida da cópia: ${erroPartida.message}`,
      );
    }
  }

  // Nunca duas em andamento: o app abriria a de data mais antiga.
  const { count: emAndamento, error: erroContar } = await supabase
    .from('rotas')
    .select('id', { count: 'exact', head: true })
    .eq('motorista_id', motoristaId)
    .eq('unidade_id', UNIDADE_DEMO)
    .eq('status', 'em_andamento');
  if (erroContar) {
    throw new Error(
      `Não foi possível conferir as rotas em andamento: ${erroContar.message}`,
    );
  }
  if ((emAndamento ?? 0) > 1) {
    throw new Error(
      `O motorista demo ficou com ${emAndamento} rotas em andamento depois da ` +
        `cópia ${rotaId}. O app abre a de data mais antiga — encerre a sobra.`,
    );
  }

  return {
    acao: 'criada',
    paradas: 'nada-a-fazer',
    rotaId,
    statusAntes: modelo.status,
    dataAntes: modelo.data,
    iniciadaAntes: modelo.iniciada_em,
    pendentesAntes: contarEntregasAbertas(paradasModelo),
  };
}
