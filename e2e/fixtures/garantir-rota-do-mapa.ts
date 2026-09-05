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
  acao: 'nada-a-fazer' | 'restaurada';
  rotaId: string;
  statusAntes: string;
  dataAntes: string;
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
  const hoje = new Date();
  const hojeStr = hoje.toISOString().slice(0, 10);
  const limite = new Date(hoje.getTime() - 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const jaServe = rota.status === 'em_andamento' && rota.data > limite;

  if (jaServe) {
    return {
      acao: 'nada-a-fazer',
      rotaId: rota.id,
      statusAntes: rota.status,
      dataAntes: rota.data,
    };
  }

  const { error: erroUpdate } = await supabase
    .from('rotas')
    .update({ status: 'em_andamento', data: hojeStr })
    .eq('id', rota.id);

  if (erroUpdate) {
    throw new Error(`Não foi possível restaurar a rota: ${erroUpdate.message}`);
  }

  return {
    acao: 'restaurada',
    rotaId: rota.id,
    statusAntes: rota.status,
    dataAntes: rota.data,
  };
}
