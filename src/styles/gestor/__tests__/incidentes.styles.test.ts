import { defaultTheme } from '@/utils/styles';

import { styles } from '../incidentes.styles';

describe('incidentes.styles', () => {
  it('o número do cartão de resumo usa a fonte de exibição', () => {
    expect(styles.resumoValue.fontFamily).toBe(
      defaultTheme.typography.fontDisplay,
    );
  });
});
