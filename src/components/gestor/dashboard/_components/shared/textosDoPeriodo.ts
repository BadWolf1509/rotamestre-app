/**
 * Textos da Início do gestor que seguem o período escolhido (computador e
 * celular dizem o mesmo). Antes falavam em "hoje", que era o único recorte
 * da lista sem filtro de data.
 */
import { textoPeriodo, type Periodo } from '@/lib/periodo';

import { LIMITE_ROTAS_SEM_INICIO } from '../../limiteDaLista';

/**
 * O texto do período no meio de uma frase: inicial minúscula ("Nenhuma rota
 * em este mês (01/11 a 30/11)", nunca "em Este mês").
 */
export function periodoNaFrase(p: Periodo, hojeISO?: string): string {
  const texto = textoPeriodo(p, undefined, hojeISO);
  return texto.charAt(0).toLowerCase() + texto.slice(1);
}

/**
 * O que a Início diz sem rota, no vazio e no resumo (a mesma frase nos dois).
 * Com filtro de status ou motorista, o período pode ter rota que o filtro
 * esconde: nada de "escolha outro período" sozinho.
 */
export function textosDoVazio(
  periodo: Periodo,
  filtros: { status?: string | null; motoristaId?: string | null },
  hojeISO?: string,
): { titulo: string; descricao: string } {
  const titulo = `Nenhuma rota em ${periodoNaFrase(periodo, hojeISO)}`;
  if (filtros.status || filtros.motoristaId) {
    return {
      titulo: `${titulo} com esses filtros`,
      descricao: 'Ajuste os filtros ou crie uma nova rota',
    };
  }
  return {
    titulo,
    descricao: 'Escolha outro período ou crie uma nova rota',
  };
}

/** A lista de "Todo o período" bateu no limite (`listaCortada`). */
export const AVISO_LISTA_CORTADA = `Mostrando as primeiras ${LIMITE_ROTAS_SEM_INICIO} rotas, da data mais nova para a mais antiga. Escolha um período para ver as demais.`;
