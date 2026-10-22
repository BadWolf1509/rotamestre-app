/* eslint-disable no-undef */
// Chaves de API das Edge Functions — fonte única.
//
// Em 22/10/2026 as chaves antigas (`anon` e `service_role`, JWT do segredo
// legado) foram desligadas: a `service_role` estava no histórico do repositório
// público. Com elas desligadas, `SUPABASE_SERVICE_ROLE_KEY` e
// `SUPABASE_ANON_KEY` continuam injetadas, mas não abrem mais nada. As chaves
// novas chegam como JSON por nome em `SUPABASE_SECRET_KEYS` e
// `SUPABASE_PUBLISHABLE_KEYS`; usamos a de nome `default`.
//
// Sem fallback para a chave antiga de propósito: cair nela dá 401 lá na frente,
// com uma mensagem que não diz o motivo. Falhar aqui, com o nome da variável,
// encurta o diagnóstico.

function lerChave(variavel: string): string {
  const bruto = Deno.env.get(variavel);
  if (!bruto) {
    throw new Error(`${variavel} não está disponível na Edge Function.`);
  }
  const chave = (JSON.parse(bruto) as Record<string, string | undefined>)
    .default;
  if (!chave) {
    throw new Error(`${variavel} não tem a chave "default".`);
  }
  return chave;
}

/** Chave secreta (`sb_secret_...`): ignora RLS. Só no servidor. */
export function chaveSecreta(): string {
  return lerChave('SUPABASE_SECRET_KEYS');
}

/** Chave publishable (`sb_publishable_...`): mesma permissão da antiga `anon`. */
export function chavePublica(): string {
  return lerChave('SUPABASE_PUBLISHABLE_KEYS');
}
