/**
 * Decisão pura do fixture do mapa: o que precisa ser consertado na rota e nas
 * paradas. Fica fora de `garantir-rota-do-mapa.ts` para ser testável sem tocar
 * o banco (o fixture escreve em produção; este módulo não fala com ninguém).
 */

const SETE_DIAS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Dia LOCAL, nunca `toISOString()`. A coluna `rotas.data` é `date` e as regras
 * de expiração raciocinam em dias do calendário local: em UTC-3, a partir das
 * 21:00 o `toISOString().slice(0, 10)` já devolve AMANHÃ, e o fixture datava a
 * rota no futuro — estado que o produto nunca produz. Mesma conta de
 * `toLocalISODate` (`src/lib/dateUtils.ts`), replicada em vez de importada
 * porque nenhum arquivo de `e2e/` importa de `src/` (transform próprio do
 * Playwright). O guard `data-local-sem-utc.test.ts` varre só `src` e `app`.
 */
export const diaLocal = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-` +
  `${String(d.getDate()).padStart(2, '0')}`;

export interface RotaDoFixture {
  status: string;
  data: string;
  iniciada_em: string | null;
  concluida_em: string | null;
}

export interface DecisaoDeRestauracao {
  restaurarRota: boolean;
  reabrirParadas: boolean;
}

/**
 * Rota serve = `em_andamento`, datada dentro da janela de 7 dias (a expiração
 * só deixa sobreviver `data > hoje - 7`), sem `concluida_em` e com `iniciada_em`
 * na mesma janela (coerência: o produto sempre grava `iniciada_em` ao iniciar).
 * Paradas servem = há ao menos uma entrega aberta.
 */
export function decidirRestauracao(
  rota: RotaDoFixture,
  pendentes: number,
  agora: Date,
): DecisaoDeRestauracao {
  const limite = diaLocal(new Date(agora.getTime() - SETE_DIAS_MS));
  const limiteInicio = agora.getTime() - SETE_DIAS_MS;
  const inicioCoerente =
    rota.iniciada_em !== null &&
    new Date(rota.iniciada_em).getTime() > limiteInicio;
  const rotaServe =
    rota.status === 'em_andamento' &&
    rota.data > limite &&
    rota.concluida_em === null &&
    inicioCoerente;

  return { restaurarRota: !rotaServe, reabrirParadas: pendentes === 0 };
}
