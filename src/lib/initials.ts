/**
 * Iniciais de um nome, para avatares sem foto.
 *
 * Existe como modulo proprio porque a regra estava duplicada em `Avatar` e
 * `AvatarEditable`, e as duas copias tinham o mesmo defeito: pegavam a primeira
 * letra da ultima palavra sem descartar pontuacao. Com "Gestor Demo
 * (Avaliacao)" — o padrao dos nomes de demonstracao — a ultima palavra era
 * "(Avaliacao)" e o avatar exibia "G(", justamente na conta que o revisor da
 * Play usa.
 */

/**
 * Letras latinas com os acentos usados em portugues. Evita `\p{L}`, que depende
 * de suporte a unicode property escapes no Hermes.
 */
const LETRA = /[A-Za-zÀ-ÖØ-öø-ÿ]/;

/** Mantem so o trecho a partir da primeira letra, e ate a ultima. */
function apenasLetrasNasBordas(palavra: string): string {
  const inicio = palavra.search(LETRA);
  if (inicio === -1) return '';

  let fim = palavra.length;
  while (fim > inicio && !LETRA.test(palavra[fim - 1])) fim -= 1;

  return palavra.slice(inicio, fim);
}

function palavrasUteis(texto: string): string[] {
  return texto.split(/\s+/).map(apenasLetrasNasBordas).filter(Boolean);
}

/**
 * Retorna 1 ou 2 letras maiusculas para o avatar, ou '?' quando o nome nao tem
 * nenhuma letra.
 */
export function getInitials(fullName: string | null | undefined): string {
  if (!fullName) return '?';

  // Sufixos entre parenteses sao anotacao, nao sobrenome.
  const semAnotacao = palavrasUteis(fullName.replace(/\([^)]*\)/g, ' '));
  const palavras =
    semAnotacao.length > 0 ? semAnotacao : palavrasUteis(fullName);

  if (palavras.length === 0) return '?';
  if (palavras.length === 1) return palavras[0].substring(0, 2).toUpperCase();

  return (palavras[0][0] + palavras[palavras.length - 1][0]).toUpperCase();
}
