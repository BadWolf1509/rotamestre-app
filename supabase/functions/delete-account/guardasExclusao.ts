// Guardas da exclusão de conta (sem Deno/fetch), testáveis no Jest.
//
// A função apagava qualquer Bearer válido. Dois casos não podem ser apagados
// sem aviso, porque o dano cai em outras pessoas:
//   - o ÚNICO gestor ativo de uma loja: a loja ficaria sem ninguém que a
//     administre (e sem quem receba os incidentes e os avisos);
//   - quem tem rota `em_andamento`: o motorista some no meio da entrega e a
//     rota fica presa, sem dono.
// Em ambos a conta NÃO é apagada: a resposta traz um código estável (o app
// decide o que mostrar) e uma mensagem em PT-BR que diz o que fazer.
//
// Se a consulta falha, a guarda NÃO libera. "Não consegui conferir" e "está
// livre" têm o mesmo silêncio, e a exclusão é irreversível: recusa com 503 e
// o usuário tenta de novo.

export type CodigoRecusa =
  | 'ULTIMO_GESTOR'
  | 'ROTA_EM_ANDAMENTO'
  | 'GUARDA_INDISPONIVEL';

export interface Recusa {
  codigo: CodigoRecusa;
  mensagem: string;
  status: 409 | 503;
}

interface ErroSupabase {
  code?: string;
  message: string;
}

interface Resposta {
  data?: unknown;
  error: ErroSupabase | null;
}

// Só a parte da cadeia do supabase-js que este módulo usa.
interface Filtro extends PromiseLike<Resposta> {
  eq(coluna: string, valor: unknown): Filtro;
  neq(coluna: string, valor: unknown): Filtro;
  in(coluna: string, valores: unknown[]): Filtro;
  limit(n: number): Filtro;
}

export interface ClienteGuardas {
  from(tabela: string): { select(colunas: string): Filtro };
}

const INDISPONIVEL: Recusa = {
  codigo: 'GUARDA_INDISPONIVEL',
  mensagem:
    'Não foi possível conferir se a conta pode ser excluída agora. Nada foi apagado. Tente novamente em instantes.',
  status: 503,
};

function listaDeNomes(nomes: string[]): string {
  if (nomes.length <= 1) return nomes[0] ?? '';
  return `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}`;
}

async function lojasOndeSouOUnicoGestor(
  cliente: ClienteGuardas,
  usuarioId: string,
): Promise<string[] | 'falha'> {
  const minhas = await cliente
    .from('usuario_unidades')
    .select('unidade_id')
    .eq('usuario_id', usuarioId)
    .eq('papel', 'gestor')
    .eq('ativo', true);
  if (minhas.error) return 'falha';

  const lojas = ((minhas.data ?? []) as Array<{ unidade_id: string }>).map(
    (l) => l.unidade_id,
  );
  if (lojas.length === 0) return [];

  const outros = await cliente
    .from('usuario_unidades')
    .select('unidade_id, usuario_id')
    .in('unidade_id', lojas)
    .eq('papel', 'gestor')
    .eq('ativo', true)
    .neq('usuario_id', usuarioId);
  if (outros.error) return 'falha';

  const comOutroGestor = new Set(
    ((outros.data ?? []) as Array<{ unidade_id: string }>).map(
      (l) => l.unidade_id,
    ),
  );
  return lojas.filter((id) => !comOutroGestor.has(id));
}

async function nomesDasLojas(
  cliente: ClienteGuardas,
  ids: string[],
): Promise<string[]> {
  // Só enfeita a mensagem: sem o nome, a recusa continua valendo.
  const { data, error } = await cliente
    .from('unidades')
    .select('id, nome')
    .in('id', ids);
  if (error) return [];
  return ((data ?? []) as Array<{ nome: string | null }>)
    .map((l) => l.nome)
    .filter((n): n is string => !!n);
}

export async function verificarGuardas(
  cliente: ClienteGuardas,
  usuarioId: string,
): Promise<Recusa | null> {
  const sozinho = await lojasOndeSouOUnicoGestor(cliente, usuarioId);
  if (sozinho === 'falha') return INDISPONIVEL;

  if (sozinho.length > 0) {
    const nomes = await nomesDasLojas(cliente, sozinho);
    const onde =
      nomes.length > 0
        ? `da loja ${listaDeNomes(nomes)}`
        : sozinho.length > 1
          ? 'de mais de uma loja'
          : 'de uma loja';
    return {
      codigo: 'ULTIMO_GESTOR',
      mensagem: `Você é o único gestor ativo ${onde}. Antes de excluir a conta, a loja precisa de outro gestor ativo: peça ao suporte (contato@rotamestre.tec.br) para adicionar um. Nada foi apagado.`,
      status: 409,
    };
  }

  const emAndamento = await cliente
    .from('rotas')
    .select('id')
    .eq('motorista_id', usuarioId)
    .eq('status', 'em_andamento')
    .limit(1);
  if (emAndamento.error) return INDISPONIVEL;

  if (((emAndamento.data ?? []) as unknown[]).length > 0) {
    return {
      codigo: 'ROTA_EM_ANDAMENTO',
      mensagem:
        'Você tem uma rota em andamento. Finalize a rota antes de excluir a conta, ou peça ao gestor que a reatribua a outro motorista. Nada foi apagado.',
      status: 409,
    };
  }

  return null;
}
