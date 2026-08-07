/**
 * Estados brasileiros: nome por extenso -> sigla (UF).
 *
 * Necessário porque a Edge Function `google-place-details` extrai os
 * componentes de endereço com `longText`
 * (supabase/functions/google-place-details/index.ts:123), então
 * `administrative_area_level_1` chega como "Paraíba" e não "PB". Jogar esse
 * valor direto num campo de UF (maxLength 2) o truncaria para "Pa".
 */
const NOME_PARA_UF: Record<string, string> = {
  acre: 'AC',
  alagoas: 'AL',
  amapa: 'AP',
  amazonas: 'AM',
  bahia: 'BA',
  ceara: 'CE',
  'distrito federal': 'DF',
  'espirito santo': 'ES',
  goias: 'GO',
  maranhao: 'MA',
  'mato grosso': 'MT',
  'mato grosso do sul': 'MS',
  'minas gerais': 'MG',
  para: 'PA',
  paraiba: 'PB',
  parana: 'PR',
  pernambuco: 'PE',
  piaui: 'PI',
  'rio de janeiro': 'RJ',
  'rio grande do norte': 'RN',
  'rio grande do sul': 'RS',
  rondonia: 'RO',
  roraima: 'RR',
  'santa catarina': 'SC',
  'sao paulo': 'SP',
  sergipe: 'SE',
  tocantins: 'TO',
};

const SIGLAS_VALIDAS = new Set(Object.values(NOME_PARA_UF));

/** Remove acentos e caixa para comparar "Paraíba", "paraiba" e "PARAÍBA". */
function normalizar(valor: string): string {
  return valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

/**
 * Converte o estado devolvido pelo geocoding numa sigla de 2 letras.
 *
 * Aceita tanto o nome por extenso ("Paraíba") quanto a sigla já pronta
 * ("pb"). Devolve string vazia quando não reconhece: preencher um campo de UF
 * com lixo é pior do que deixá-lo como estava.
 */
export function nomeEstadoParaUF(valor?: string | null): string {
  if (!valor) return '';

  const normalizado = normalizar(valor);

  const porNome = NOME_PARA_UF[normalizado];
  if (porNome) return porNome;

  const candidataASigla = normalizado.toUpperCase();
  return SIGLAS_VALIDAS.has(candidataASigla) ? candidataASigla : '';
}
