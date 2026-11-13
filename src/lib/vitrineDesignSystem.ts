/**
 * A vitrine `/design-system` é ferramenta de desenvolvimento: abre em dev e no
 * CI, que builda a `dist` de produção com `EXPO_PUBLIC_VITRINE_DS=1` para o e2e
 * (`e2e/design-system.e2e.ts`). Na Vercel a flag não existe e a rota redireciona.
 *
 * A tela passa `__DEV__` e `process.env.EXPO_PUBLIC_VITRINE_DS` **literal**: o
 * Metro só injeta o valor de `EXPO_PUBLIC_*` acessado assim.
 */
export function vitrineLiberada(
  emDesenvolvimento: boolean,
  flag: string | undefined,
): boolean {
  return emDesenvolvimento || flag === '1';
}
