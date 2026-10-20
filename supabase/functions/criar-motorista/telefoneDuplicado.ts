// Decisão pura (sem Deno/URL) sobre telefone já cadastrado. Testável no Jest.

export const CODIGO_TELEFONE_JA_CADASTRADO = 'telefone_ja_cadastrado';

export const MSG_TELEFONE_OUTRA_LOJA =
  'Este motorista já usa o RotaMestre em outra loja. Para usar o mesmo motorista em mais de uma loja, fale com o suporte.';
export const MSG_TELEFONE_MESMA_LOJA =
  'Já existe um motorista com este telefone na sua loja.';

export interface RespostaTelefoneDuplicado {
  status: 409;
  error: string;
  codigo: string;
}

export function respostaTelefoneDuplicado(
  encontrados: Array<{ id: string; unidade_id: string | null }>,
  unidadeDoGestor: string,
  unidadesVinculadas: Record<string, string[]>,
): RespostaTelefoneDuplicado | null {
  if (encontrados.length === 0) return null;

  const naMesmaLoja = encontrados.some(
    (m) =>
      m.unidade_id === unidadeDoGestor ||
      (unidadesVinculadas[m.id] ?? []).includes(unidadeDoGestor),
  );

  return {
    status: 409,
    error: naMesmaLoja ? MSG_TELEFONE_MESMA_LOJA : MSG_TELEFONE_OUTRA_LOJA,
    codigo: CODIGO_TELEFONE_JA_CADASTRADO,
  };
}

export function ehViolacaoTelefoneUnico(
  err: { code?: string; message?: string } | null,
): boolean {
  return (
    err?.code === '23505' &&
    (err.message ?? '').includes('usuarios_motorista_telefone_unico')
  );
}
