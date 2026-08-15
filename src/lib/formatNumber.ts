/**
 * Formatação numérica para pt-BR.
 *
 * Por que não `Intl.NumberFormat('pt-BR')`: o Hermes, motor JS do app Android,
 * pode ser compilado sem os dados de locale do ICU. Nesse caso `Intl` aceita
 * 'pt-BR' sem reclamar e devolve o formato en-US — o mesmo texto sairia com
 * vírgula na web e com ponto no aparelho, sem erro em lugar nenhum. O
 * `toFixed` + `replace` é determinístico em qualquer motor.
 *
 * Use apenas para EXIBIÇÃO. Valores que vão para o banco, para chave de cache
 * ou para célula numérica de planilha devem continuar como número.
 */

/**
 * Formata um número com vírgula decimal.
 *
 * @param valor número a formatar
 * @param casas casas decimais (padrão 1)
 *
 * @example formatarDecimal(18.13) // '18,1'
 * @example formatarDecimal(18)    // '18,0'
 */
export function formatarDecimal(valor: number, casas = 1): string {
  return valor.toFixed(casas).replace('.', ',');
}
