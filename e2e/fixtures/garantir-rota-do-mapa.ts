import { createClient } from '@supabase/supabase-js';

import {
  decidirRestauracao,
  diaLocal,
  type RotaDoFixture,
} from './decidirRestauracao';
import { contarEntregasAbertas } from './entregasAbertas';

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
 * existe. A escrita é a menor possível e idempotente: um UPDATE de status/data
 * numa rota que já existe, nunca criação. Não acumula dado, não precisa de
 * cleanup, e se o teste morrer no meio não deixa resíduo. Se um dia houver
 * staging, isto deve apontar para lá.
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
  /** O que foi feito com a ROTA. */
  acao: 'nada-a-fazer' | 'restaurada';
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
  let rota: (RotaDoFixture & { id: string }) | null = null;

  for (const candidato of motoristas) {
    const { data: rotas, error: erroRota } = await supabase
      .from('rotas')
      .select('id, status, data, iniciada_em, concluida_em')
      .eq('motorista_id', candidato.id)
      .eq('unidade_id', UNIDADE_DEMO)
      .order('data', { ascending: false })
      .limit(1);

    if (erroRota) {
      throw new Error(`Não foi possível ler as rotas: ${erroRota.message}`);
    }
    if (rotas?.length) {
      motorista = candidato;
      rota = rotas[0];
      break;
    }
  }

  if (!motorista || !rota) {
    // Deliberadamente NÃO cria rota: fabricar dado aqui esconderia um problema
    // real de cadastro atrás de um teste verde.
    const nomes = motoristas.map((m) => m.nome).join(', ');
    throw new Error(
      `Nenhum motorista ativo da unidade demo tem rota (${nomes}). O fixture ` +
        'restaura estado, não inventa cenário — crie a rota demo antes.',
    );
  }
  const hoje = new Date();
  const hojeStr = diaLocal(hoje);

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
