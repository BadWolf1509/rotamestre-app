import { vitrineLiberada } from '../vitrineDesignSystem';

// A vitrine `/design-system` só abre em desenvolvimento e no CI (que builda a
// `dist` de produção com EXPO_PUBLIC_VITRINE_DS=1 para o e2e). Na Vercel, sem a
// flag, a rota redireciona.
describe('vitrineLiberada', () => {
  it('libera em desenvolvimento', () => {
    expect(vitrineLiberada(true, undefined)).toBe(true);
  });

  it('libera com a flag do CI', () => {
    expect(vitrineLiberada(false, '1')).toBe(true);
  });

  it('fecha em produção sem flag', () => {
    expect(vitrineLiberada(false, undefined)).toBe(false);
  });

  it('fecha com flag diferente de "1"', () => {
    expect(vitrineLiberada(false, 'true')).toBe(false);
  });
});
