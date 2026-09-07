/**
 * Guarda: número decimal na tela sai de `formatarDecimal`, não do ICU.
 *
 * POR QUE EXISTE. O Hermes, motor JS do app Android, pode ser compilado sem os
 * dados de locale do ICU. Nesse caso `toLocaleString('pt-BR', …)` e
 * `Intl.NumberFormat('pt-BR')` **aceitam o locale sem reclamar** e devolvem o
 * formato en-US. Não há erro, não há aviso: o mesmo número sai com vírgula na
 * web e com ponto no aparelho.
 *
 * Foi exatamente isso que aconteceu em `app/motorista/resumo.tsx`, o único
 * outlier entre ~30 chamadas: numa build sem ICU o motorista via `12.5 km` no
 * Resumo e `12,5 km` no Histórico — a mesma distância, na mesma sessão, em duas
 * telas vizinhas. E o CI não pega, porque o Node do runner tem ICU completo.
 *
 * O QUE ELA NÃO PEGA. `toLocaleString` para DATA é legítimo e continua livre
 * (`dateUtils.ts`, `timeline.ts`, `RotaHistoricoCard.tsx` usam para timestamp,
 * que carrega fuso e não sofre do problema decimal). A guarda mira só as
 * opções NUMÉRICAS — que são o que distingue os dois usos no texto.
 */
import {
  arquivosDeProducao,
  lerFonte,
  semComentarios,
} from './helpers/varreduraDeFontes';

const FONTE_DO_FORMATO = 'src/lib/formatNumber.ts';

const EXCECOES = [
  // `CurrencyCell` formata MOEDA, não decimal — `formatarDecimal` não serve, e
  // escrever um formatador que na prática só trata BRL, para um componente
  // cuja prop `currency` promete moeda arbitrária, seria pior que a chamada
  // que ele substituiria. Além disso é inalcançável hoje: ninguém importa
  // `@/design-system/renderers`. Fica de fora com o motivo, e como dívida —
  // quando a cobrança (Asaas) chegar, isto vira código vivo e precisa de um
  // formatador de moeda de verdade.
  'src/design-system/renderers/DataTableRenderers.tsx',
];

/**
 * As opções que só existem em formatação de NÚMERO. `dateStyle`,
 * `timeStyle`, `day`, `month` e afins não aparecem aqui de propósito.
 */
const OPCOES_NUMERICAS =
  /\b(minimumFractionDigits|maximumFractionDigits|minimumIntegerDigits|maximumSignificantDigits|minimumSignificantDigits)\b/;

function formataNumeroPorICU(fonte: string): boolean {
  const limpa = semComentarios(fonte);

  // `Intl.NumberFormat` é numérico por definição — não precisa de opção.
  if (/\bIntl\.NumberFormat\b/.test(limpa)) return true;

  // `toLocaleString` só conta como numérico quando traz opção de número.
  for (const m of limpa.matchAll(/\.toLocaleString\(([\s\S]{0,200})/g)) {
    if (OPCOES_NUMERICAS.test(m[1])) return true;
  }
  return false;
}

describe('fonte única do número decimal em pt-BR', () => {
  it('nenhuma tela formata decimal pelo ICU', () => {
    const infratores = arquivosDeProducao()
      .filter((caminho) => caminho !== FONTE_DO_FORMATO)
      .filter((caminho) => !EXCECOES.includes(caminho))
      .filter((caminho) => formataNumeroPorICU(lerFonte(caminho)));

    expect(infratores).toEqual([]);
  });

  it('formatarDecimal existe e não usa Intl', () => {
    // Sem isto a guarda passaria por ausência.
    const fonte = lerFonte(FONTE_DO_FORMATO);
    expect(fonte).toContain('export function formatarDecimal');
    // Sem `semComentarios` esta asserção falha lendo o PRÓPRIO cabeçalho do
    // módulo, que cita `Intl.NumberFormat` para explicar por que não o usa.
    expect(semComentarios(fonte)).not.toContain('Intl.NumberFormat');
  });

  it('o detector reconhece as duas formas proibidas', () => {
    expect(
      formataNumeroPorICU(
        "x.toLocaleString('pt-BR', { minimumFractionDigits: 1 })",
      ),
    ).toBe(true);
    expect(
      formataNumeroPorICU("new Intl.NumberFormat('pt-BR').format(x)"),
    ).toBe(true);
  });

  it('o detector deixa a formatação de DATA em paz', () => {
    // Este é o uso legítimo, e é a maioria das ocorrências no repo.
    expect(
      formataNumeroPorICU(
        "d.toLocaleString('pt-BR', { day: '2-digit', month: 'short' })",
      ),
    ).toBe(false);
    expect(formataNumeroPorICU("d.toLocaleDateString('pt-BR')")).toBe(false);
  });
});
