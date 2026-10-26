// Avatar da conta (sem Deno/fetch), testável no Jest.
//
// A exclusão remove só o avatar desta conta: o arquivo `perfis/perfil_<uid>_<arquivo>`
// (formato gravado por `src/lib/storage.ts`). O nome carrega o id do dono, então
// a função confere o valor de `usuarios.foto_url` contra o id do token antes de
// pedir a remoção com a chave secreta. Qualquer outro valor (foto de entrega,
// de incidente, avatar de outra conta, subpasta) devolve null e nada é removido.
//
// Aceita path puro ou a URL pública legada (trecho depois de `/fotos-entrega/`,
// sem querystring, com decodificação tolerante).

const MARCADOR = '/fotos-entrega/';

function extrair(valor: string): string | null {
  if (valor.startsWith('perfis/')) return valor;

  const indice = valor.indexOf(MARCADOR);
  if (indice === -1) return null;

  const caminho = valor.slice(indice + MARCADOR.length).split('?')[0];
  try {
    return decodeURIComponent(caminho);
  } catch {
    return caminho;
  }
}

export function caminhoDoAvatarDaConta(
  valor: unknown,
  usuarioId: string,
): string | null {
  if (typeof valor !== 'string' || valor.length === 0) return null;
  if (typeof usuarioId !== 'string' || usuarioId.length === 0) return null;

  const caminho = extrair(valor);
  if (caminho === null) return null;

  const uid = usuarioId.replace(/[^0-9a-zA-Z-]/g, '');
  if (uid !== usuarioId) return null;

  return new RegExp(`^perfis/perfil_${uid}_[^/]+$`, 'i').test(caminho)
    ? caminho
    : null;
}
