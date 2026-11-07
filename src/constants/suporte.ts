/**
 * Contato de suporte do RotaMestre — fonte única.
 *
 * Antes o telefone e o e-mail estavam copiados no `SupportModal` e nas telas
 * de ajuda do gestor e do motorista; trocar um número exigia achar todas.
 */

/** Telefone/WhatsApp com DDI (55) e DDD, só dígitos. */
export const SUPORTE_TELEFONE = '5583987156206';

/** O mesmo número sem o DDI, para o discador (`tel:`). */
export const SUPORTE_TELEFONE_LOCAL = SUPORTE_TELEFONE.slice(2);

/** Como o número aparece na tela. */
export const SUPORTE_TELEFONE_EXIBICAO = '(83) 98715-6206';

/** E-mail geral de contato (modal, ajuda do motorista, páginas legais). */
export const SUPORTE_EMAIL = 'contato@rotamestre.tec.br';

/** E-mail que a ajuda do gestor usa desde antes da centralização. */
export const SUPORTE_EMAIL_GESTOR = 'suporte@rotamestre.tec.br';

/** Mensagem inicial do WhatsApp aberto pelo modal de suporte. */
export const SUPORTE_MENSAGEM = 'Olá! Preciso de ajuda com o RotaMestre.';

/** Aviso quando o aparelho não consegue abrir o app do contato. */
export function avisoContatoIndisponivel(canal: string): string {
  return `Não foi possível abrir ${canal}. Use o outro contato listado aqui.`;
}

/** Mensagem inicial do WhatsApp aberto pela Ajuda do motorista. */
export const SUPORTE_MENSAGEM_MOTORISTA =
  'Olá! Preciso de ajuda com o app RotaMestre.';

/** Mensagem inicial do WhatsApp aberto pela Ajuda do gestor. */
export const SUPORTE_MENSAGEM_GESTOR =
  'Olá! Sou gestor e preciso de suporte com o RotaMestre.';
