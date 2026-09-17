import { createClient } from '@supabase/supabase-js';

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
  let rota: { id: string; status: string; data: string } | null = null;

  for (const candidato of motoristas) {
    const { data: rotas, error: erroRota } = await supabase
      .from('rotas')
      .select('id, status, data')
      .eq('motorista_id', candidato.id)
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
  // Dia LOCAL, nunca `toISOString()`. A coluna `rotas.data` é `date` e as regras
  // de expiração acima raciocinam em dias do calendário local: em UTC-3, a
  // partir das 21:00 o `toISOString().slice(0, 10)` já devolve AMANHÃ, e o
  // fixture datava a rota no futuro — estado que o produto nunca produz. Mesma
  // conta de `toLocalISODate` (`src/lib/dateUtils.ts`), replicada em vez de
  // importada porque nenhum arquivo de `e2e/` importa de `src/` (transform
  // próprio do Playwright). O guard estático `data-local-sem-utc.test.ts` varre
  // só `src` e `app`, então aqui não havia nada impedindo o erro.
  const diaLocal = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-` +
    `${String(d.getDate()).padStart(2, '0')}`;

  const hoje = new Date();
  const hojeStr = diaLocal(hoje);
  const limite = diaLocal(new Date(hoje.getTime() - 7 * 24 * 60 * 60 * 1000));

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
    .select('id, status')
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

  const pendentesAntes = paradas.filter((p) => p.status === 'pendente').length;
  const rotaServe = rota.status === 'em_andamento' && rota.data > limite;
  const paradasServem = pendentesAntes > 0;

  if (!rotaServe) {
    const { error: erroUpdate } = await supabase
      .from('rotas')
      .update({ status: 'em_andamento', data: hojeStr })
      .eq('id', rota.id);

    if (erroUpdate) {
      throw new Error(
        `Não foi possível restaurar a rota: ${erroUpdate.message}`,
      );
    }
  }

  if (!paradasServem) {
    // Reabre TODAS, e limpa os vestígios de conclusão junto: parada `pendente`
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
      .eq('rota_id', rota.id);

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
    pendentesAntes,
  };
}
