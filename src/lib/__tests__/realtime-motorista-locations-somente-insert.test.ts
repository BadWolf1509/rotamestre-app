import {
  arquivosDeProducao,
  comStringsNeutralizadas,
  lerFonte,
} from './helpers/varreduraDeFontes';

/**
 * Remove comentários SEM apagar o conteúdo das strings.
 *
 * `semComentarios` do helper não serve aqui: ele neutraliza os literais antes
 * de cortar os comentários, então `'motorista_locations'` chega como `'####'` e
 * esta varredura não acha nada — verde por cegueira, que foi exatamente o que
 * o segundo teste deste arquivo pegou na primeira tentativa.
 *
 * A saída é usar a versão neutralizada só como MÁSCARA: ela tem o mesmo
 * comprimento do original, então os intervalos de comentário encontrados nela
 * valem como índices no texto original.
 */
function semComentariosMantendoStrings(fonte: string): string {
  const mascara = comStringsNeutralizadas(fonte);
  const intervalos: [number, number][] = [];
  const regex = /\/\*[\s\S]*?\*\/|\/\/[^\n]*/g;

  let achado: RegExpExecArray | null;
  while ((achado = regex.exec(mascara)) !== null) {
    intervalos.push([achado.index, achado.index + achado[0].length]);
  }

  let saida = fonte;
  for (const [inicio, fim] of intervalos.reverse()) {
    saida =
      saida.slice(0, inicio) + ' '.repeat(fim - inicio) + saida.slice(fim);
  }
  return saida;
}

/**
 * Guarda: assinatura de `motorista_locations` só pode ser de INSERT.
 *
 * POR QUE. A Migration de 08/09/2026 publicou `motorista_locations` em
 * `supabase_realtime` para o gestor finalmente ver o motorista se mover. A
 * segurança disso repousa em `realtime.apply_rls`, que — verificado lendo o
 * corpo da função implantada, não a documentação — aplica a policy de SELECT
 * da tabela a cada assinante antes de entregar o evento.
 *
 * SÓ QUE ESSA PROTEÇÃO TEM UM BURACO EXPLÍCITO. No mesmo `apply_rls`:
 *
 *     if not is_rls_enabled or action = 'DELETE' then
 *         visible_role_sub_ids := visible_role_sub_ids || subscription_id;
 *
 * DELETE é entregue a QUALQUER assinatura cujo filtro de cliente case, sem
 * passar por RLS. Como o filtro é declarado pelo cliente (`rota_id=eq.…`) e
 * cliente não é fronteira de segurança, uma assinatura de DELETE ou de `'*'`
 * nesta tabela vazaria posição de motorista entre unidades.
 *
 * O invariante mora no código do cliente, e é aqui que ele é vigiado: nada no
 * banco impede alguém de assinar `'*'` amanhã. A guarda é estática porque o
 * defeito que ela impede não tem sintoma em teste de runtime — o vazamento
 * seria silencioso e só apareceria como dado de outro tenant na tela de alguém.
 */
const TABELA = 'motorista_locations';

/** Eventos que NÃO passam pela checagem de RLS do realtime. */
const EVENTOS_SEM_RLS = ['DELETE', '*'];

function assinaturasDaTabela(fonte: string): string[] {
  const eventos: string[] = [];

  // Cada `.on('postgres_changes', { ... })` vira um bloco; só interessam os que
  // mencionam esta tabela.
  for (const bloco of fonte.split('postgres_changes').slice(1)) {
    const ateOFecho = bloco.slice(0, 400);
    if (!ateOFecho.includes(TABELA)) continue;

    const evento = ateOFecho.match(/event\s*:\s*['"`]([^'"`]+)['"`]/);
    if (evento) eventos.push(evento[1].toUpperCase());
  }

  return eventos;
}

describe('realtime de motorista_locations', () => {
  it('nenhuma assinatura usa DELETE ou "*", que burlam o RLS', () => {
    const infratores: string[] = [];

    for (const caminho of arquivosDeProducao()) {
      const fonte = semComentariosMantendoStrings(lerFonte(caminho));
      if (!fonte.includes(TABELA)) continue;

      for (const evento of assinaturasDaTabela(fonte)) {
        if (EVENTOS_SEM_RLS.includes(evento)) {
          infratores.push(`${caminho}: event '${evento}'`);
        }
      }
    }

    expect(infratores).toEqual([]);
  });

  it('as assinaturas existentes continuam sendo encontradas pela guarda', () => {
    // Sem isto, renomear a tabela ou mudar a forma da chamada faria a guarda
    // passar por não encontrar nada — verde por cegueira, que é o modo de
    // falha clássico de varredura estática.
    const encontradas = arquivosDeProducao().flatMap((caminho) => {
      const fonte = semComentariosMantendoStrings(lerFonte(caminho));
      return fonte.includes(TABELA) ? assinaturasDaTabela(fonte) : [];
    });

    expect(encontradas.length).toBeGreaterThan(0);
    expect(encontradas.every((evento) => evento === 'INSERT')).toBe(true);
  });
});
